import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import sharp from "sharp";
import test from "node:test";
import { MAX_AVATAR_UPLOAD_BYTES } from "@shared/avatar";
import { registerProfileRoutes } from "../routes/profile.routes";
import { initStorage, storage } from "../storage";
import {
  InvalidAvatarImageError,
  removeStoredAvatar,
  storeAvatarImage,
} from "./avatar-storage";

async function createTestPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 1,
      channels: 3,
      background: "#d24c4c",
    },
  }).png().toBuffer();
}

async function createMaxSizeTestPng(): Promise<Buffer> {
  const image = await createTestPng();
  assert.ok(image.length <= MAX_AVATAR_UPLOAD_BYTES);
  const paddedImage = Buffer.alloc(MAX_AVATAR_UPLOAD_BYTES);
  image.copy(paddedImage);
  return paddedImage;
}

async function createTestJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 1,
      channels: 3,
      background: "#4c73d2",
    },
  }).jpeg().toBuffer();
}

async function createTestWebp(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 1,
      channels: 3,
      background: "#4cd273",
    },
  }).webp().toBuffer();
}

test("avatar uploads are converted to a small square WebP file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avatar-storage-"));
  try {
    const avatarUrl = await storeAvatarImage(await createTestPng(), directory);
    const filename = path.basename(avatarUrl);
    const storedImage = await readFile(path.join(directory, filename));
    const metadata = await sharp(storedImage).metadata();

    assert.match(avatarUrl, /^\/uploads\/avatars\/[0-9a-f-]{36}\.webp$/i);
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 256);
    assert.equal(metadata.height, 256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("avatar uploads reject invalid image bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avatar-storage-"));
  try {
    await assert.rejects(
      storeAvatarImage(Buffer.from("not an image"), directory),
      InvalidAvatarImageError,
    );
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("avatar cleanup deletes only generated local avatar files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avatar-storage-"));
  try {
    const avatarUrl = await storeAvatarImage(await createTestPng(), directory);
    await removeStoredAvatar("https://example.com/avatar.webp", directory);
    assert.equal((await readdir(directory)).length, 1);

    await removeStoredAvatar(avatarUrl, directory);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("signed-in profile avatar uploads are served, replaced, cleared, and reject invalid payloads", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avatar-route-"));
  const previousStorageDirectory = process.env.AVATAR_STORAGE_DIR;
  const previousStorageMode = process.env.STORAGE_MODE;
  process.env.AVATAR_STORAGE_DIR = directory;
  process.env.STORAGE_MODE = "memory";

  let server: ReturnType<express.Express["listen"]> | undefined;
  try {
    const testStorage = await initStorage();
    const testId = Date.now();
    const user = await testStorage.createUser({
      email: `avatar-test-${testId}@example.com`,
      name: "Avatar Test",
      username: `avatar_test_${testId}`,
      usernameNormalized: `avatar_test_${testId}`,
      passwordHash: null,
      googleId: null,
      emailVerified: true,
      avatarUrl: null,
      isAdmin: false,
      isBanned: false,
      isPremium: false,
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const authenticated = req.header("x-test-user") === String(user.id);
      (req as any).isAuthenticated = () => authenticated;
      if (authenticated) (req as any).user = user;
      next();
    });
    registerProfileRoutes(app);
    app.use((error: { status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (res.headersSent) return next(error);
      res.status(error.status ?? 500).json({ error: "Test request failed" });
    });
    server = app.listen(0);

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    const base = `http://127.0.0.1:${address.port}`;
    const authHeaders = { "x-test-user": String(user.id) };
    const upload = (image: Buffer, contentType = "image/png") =>
      fetch(`${base}/api/users/me/avatar`, {
        method: "POST",
        headers: { ...authHeaders, "content-type": contentType },
        body: image,
      });

    const unauthenticatedResponse = await fetch(`${base}/api/users/me/avatar`, {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: await createTestPng(),
    });
    assert.equal(unauthenticatedResponse.status, 401);
    assert.equal((await upload(await createTestPng(), "text/plain")).status, 400);
    const firstUpload = await upload(await createTestJpeg(), "image/jpeg");
    assert.equal(firstUpload.status, 200);
    const firstProfile = await firstUpload.json() as { avatarUrl: string };
    assert.match(firstProfile.avatarUrl, /^\/uploads\/avatars\/[0-9a-f-]{36}\.webp$/i);

    const firstImageResponse = await fetch(new URL(firstProfile.avatarUrl, base));
    assert.equal(firstImageResponse.status, 200);
    assert.match(firstImageResponse.headers.get("content-type") ?? "", /image\/webp/);
    const firstImage = Buffer.from(await firstImageResponse.arrayBuffer());
    const firstMetadata = await sharp(firstImage).metadata();
    assert.equal(firstMetadata.format, "webp");
    assert.equal(firstMetadata.width, 256);
    assert.equal(firstMetadata.height, 256);
    assert.deepEqual(await readdir(directory), [path.basename(firstProfile.avatarUrl)]);

    const webpUpload = await upload(await createTestWebp(), "image/webp");
    assert.equal(webpUpload.status, 200);
    const webpProfile = await webpUpload.json() as { avatarUrl: string };
    assert.match(webpProfile.avatarUrl, /^\/uploads\/avatars\/[0-9a-f-]{36}\.webp$/i);
    assert.notEqual(webpProfile.avatarUrl, firstProfile.avatarUrl);

    const webpImageResponse = await fetch(new URL(webpProfile.avatarUrl, base));
    assert.equal(webpImageResponse.status, 200);
    assert.match(webpImageResponse.headers.get("content-type") ?? "", /image\/webp/);
    const webpImage = Buffer.from(await webpImageResponse.arrayBuffer());
    const webpMetadata = await sharp(webpImage).metadata();
    assert.equal(webpMetadata.format, "webp");
    assert.equal(webpMetadata.width, 256);
    assert.equal(webpMetadata.height, 256);
    assert.equal((await storage.getUserById(user.id))?.avatarUrl, webpProfile.avatarUrl);
    assert.equal((await fetch(new URL(firstProfile.avatarUrl, base))).status, 404);
    assert.deepEqual(await readdir(directory), [path.basename(webpProfile.avatarUrl)]);

    const replacementResponse = await upload(await createTestPng());
    assert.equal(replacementResponse.status, 200);
    const replacementProfile = await replacementResponse.json() as { avatarUrl: string };
    assert.notEqual(replacementProfile.avatarUrl, firstProfile.avatarUrl);
    assert.equal((await fetch(new URL(firstProfile.avatarUrl, base))).status, 404);
    assert.deepEqual(await readdir(directory), [path.basename(replacementProfile.avatarUrl)]);

    const originalUpdateUser = testStorage.updateUser.bind(testStorage);
    try {
      testStorage.updateUser = async () => {
        throw new Error("Simulated profile update failure");
      };
      const failedReplacementResponse = await upload(await createTestPng());
      assert.equal(failedReplacementResponse.status, 500);
      assert.equal((await storage.getUserById(user.id))?.avatarUrl, replacementProfile.avatarUrl);
      assert.equal((await fetch(new URL(replacementProfile.avatarUrl, base))).status, 200);
      assert.deepEqual(await readdir(directory), [path.basename(replacementProfile.avatarUrl)]);
    } finally {
      testStorage.updateUser = originalUpdateUser;
    }

    const clearResponse = await fetch(`${base}/api/users/me`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ avatarUrl: null }),
    });
    assert.equal(clearResponse.status, 200);
    assert.equal((await clearResponse.json()).avatarUrl, null);
    assert.equal((await storage.getUserById(user.id))?.avatarUrl, null);
    assert.equal((await fetch(new URL(replacementProfile.avatarUrl, base))).status, 404);
    assert.deepEqual(await readdir(directory), []);

    const invalidResponse = await upload(Buffer.from("not an image"));
    assert.equal(invalidResponse.status, 400);

    const maxSizeImage = await createMaxSizeTestPng();
    assert.equal(maxSizeImage.length, MAX_AVATAR_UPLOAD_BYTES);
    const maxSizeResponse = await upload(maxSizeImage);
    assert.equal(maxSizeResponse.status, 200);
    const maxSizeProfile = await maxSizeResponse.json() as { avatarUrl: string };
    assert.match(maxSizeProfile.avatarUrl, /^\/uploads\/avatars\/[0-9a-f-]{36}\.webp$/i);
    assert.equal((await storage.getUserById(user.id))?.avatarUrl, maxSizeProfile.avatarUrl);
    const maxSizeImageResponse = await fetch(new URL(maxSizeProfile.avatarUrl, base));
    assert.equal(maxSizeImageResponse.status, 200);
    assert.match(maxSizeImageResponse.headers.get("content-type") ?? "", /image\/webp/);
    const maxSizeStoredImage = Buffer.from(await maxSizeImageResponse.arrayBuffer());
    const maxSizeMetadata = await sharp(maxSizeStoredImage).metadata();
    assert.equal(maxSizeMetadata.format, "webp");
    assert.equal(maxSizeMetadata.width, 256);
    assert.equal(maxSizeMetadata.height, 256);

    const clearMaxSizeResponse = await fetch(`${base}/api/users/me`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ avatarUrl: null }),
    });
    assert.equal(clearMaxSizeResponse.status, 200);
    assert.equal((await storage.getUserById(user.id))?.avatarUrl, null);
    assert.equal((await fetch(new URL(maxSizeProfile.avatarUrl, base))).status, 404);
    assert.deepEqual(await readdir(directory), []);

    const oversizedResponse = await upload(Buffer.alloc(MAX_AVATAR_UPLOAD_BYTES + 1));
    assert.equal(oversizedResponse.status, 413);
    assert.deepEqual(await readdir(directory), []);
    try {
      testStorage.updateUser = async (id) => {
        await testStorage.deleteUser(id);
        return undefined;
      };
      const missingUserResponse = await upload(await createTestPng());
      assert.equal(missingUserResponse.status, 404);
      assert.equal(await storage.getUserById(user.id), undefined);
      assert.deepEqual(await readdir(directory), []);
    } finally {
      testStorage.updateUser = originalUpdateUser;
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
    if (previousStorageDirectory === undefined) delete process.env.AVATAR_STORAGE_DIR;
    else process.env.AVATAR_STORAGE_DIR = previousStorageDirectory;
    if (previousStorageMode === undefined) delete process.env.STORAGE_MODE;
    else process.env.STORAGE_MODE = previousStorageMode;
    await rm(directory, { recursive: true, force: true });
  }
});
