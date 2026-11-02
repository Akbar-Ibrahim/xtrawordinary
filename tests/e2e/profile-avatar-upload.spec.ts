import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { MAX_AVATAR_UPLOAD_BYTES } from "../../shared/avatar";

const PASSWORD = "ProfileAvatar123!";

async function createAvatarImage(format: "jpeg" | "webp"): Promise<Buffer> {
  const image = sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: "#d24c4c",
    },
  });
  return format === "jpeg" ? image.jpeg().toBuffer() : image.webp().toBuffer();
}

async function createAvatarImageAtExactSize(
  format: "jpeg" | "webp",
  size: number,
): Promise<Buffer> {
  const image = await createAvatarImage(format);
  if (image.length > size) {
    throw new Error(`Generated image exceeds the requested size of ${size} bytes.`);
  }
  return Buffer.concat([image, Buffer.alloc(size - image.length)]);
}

async function selectFileUsingKeyboard(
  page: import("@playwright/test").Page,
  fileInput: import("@playwright/test").Locator,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await expect(fileInput).toBeFocused();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Space");
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(file);
}

test("profile editor keyboard access and photo upload work in a real browser", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 480 });

  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `avatar_upload_${unique}@example.com`;
  const username = `avatar${unique}`.slice(0, 20);

  const registration = await page.request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await page.request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(200);
  const { user } = await me.json();

  let releaseFirstUpload!: () => void;
  let firstUploadArrived!: () => void;
  const firstUploadGate = new Promise<void>((resolve) => {
    releaseFirstUpload = resolve;
  });
  const firstUploadStarted = new Promise<void>((resolve) => {
    firstUploadArrived = resolve;
  });
  let uploadAttempts = 0;
  const uploadedContentTypes: string[] = [];
  const uploadedBodySizes: number[] = [];

  await page.addInitScript(() => localStorage.setItem("xw_changelog_seen_v2.5", "1"));
  await page.route("**/api/users/me/avatar", async (route) => {
    uploadAttempts += 1;
    uploadedContentTypes.push(route.request().headers()["content-type"] ?? "");
    uploadedBodySizes.push(route.request().postDataBuffer()?.length ?? 0);
    if (uploadAttempts === 1) {
      firstUploadArrived();
      await firstUploadGate;
      try {
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      } catch {
        // The keyboard cancellation test aborts this held request.
      }
      return;
    }
    if (uploadAttempts === 2) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary upload failure" }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto(`/profile/${user.id}`);
  await expect(page.getByTestId("text-profile-name")).toBeVisible();
  await page.getByTestId("button-edit-profile").click();
  await expect(page.getByTestId("dialog-edit-profile")).toBeVisible();

  const profileContent = page.getByTestId("edit-profile-content");
  const backgroundScrollY = await page.evaluate(() => window.scrollY);
  const nameInput = page.getByTestId("input-edit-name");
  const usernameInput = page.getByTestId("input-edit-username");
  const avatarUrlInput = page.getByTestId("input-edit-avatar-url");
  const avatarFileInput = page.getByTestId("input-edit-avatar-file");
  const bioInput = page.getByTestId("input-edit-bio");
  const activitySwitch = page.getByTestId("switch-show-activity");
  const cancelButton = page.getByTestId("button-cancel-edit");
  const saveButton = page.getByTestId("button-save-profile");
  const cancelUploadButton = page.getByTestId("button-cancel-avatar-upload");

  await expect(nameInput).toBeFocused();
  for (const control of [usernameInput, avatarUrlInput, avatarFileInput, bioInput, activitySwitch]) {
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
    expect(
      await control.evaluate((element) => {
        const { top, right, bottom, left } = element.getBoundingClientRect();
        return top >= 0 && right <= window.innerWidth && bottom <= window.innerHeight && left >= 0;
      }),
    ).toBe(true);
    await expect(cancelButton).toBeVisible();
  }
  expect(await profileContent.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(cancelButton).toBeFocused();
  await expect(cancelButton).toBeVisible();
  expect(
    await cancelButton.evaluate((element) => {
      const { top, right, bottom, left } = element.getBoundingClientRect();
      return top >= 0 && right <= window.innerWidth && bottom <= window.innerHeight && left >= 0;
    }),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(saveButton).toBeFocused();
  await expect(saveButton).toBeVisible();
  expect(
    await saveButton.evaluate((element) => {
      const { top, right, bottom, left } = element.getBoundingClientRect();
      return top >= 0 && right <= window.innerWidth && bottom <= window.innerHeight && left >= 0;
    }),
  ).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScrollY);

  expect(
    await profileContent.evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true);
  await profileContent.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await profileContent.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScrollY);

  for (const control of [
    page.getByTestId("button-cancel-edit"),
    page.getByTestId("button-save-profile"),
  ]) {
    expect(
      await control.evaluate((element) => {
        const { top, right, bottom, left } = element.getBoundingClientRect();
        return top >= 0 && right <= window.innerWidth && bottom <= window.innerHeight && left >= 0;
      }),
    ).toBe(true);
  }

  await page.getByTestId("button-cancel-edit").click();
  await expect(page.getByTestId("dialog-edit-profile")).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScrollY);
  await page.getByTestId("button-edit-profile").click();
  await expect(page.getByTestId("dialog-edit-profile")).toBeVisible();

  await expect(nameInput).toBeFocused();
  for (const control of [usernameInput, avatarUrlInput, avatarFileInput]) {
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
  }

  async function tabFromPhotoInputToCancel() {
    for (const control of [bioInput, activitySwitch, cancelButton]) {
      await page.keyboard.press("Tab");
      await expect(control).toBeFocused();
    }
    await expect(page.getByTestId("dialog-edit-profile")).toBeVisible();
    await expect(cancelButton).toBeVisible();
  }
  async function returnToPhotoInputFromCancel() {
    for (const control of [activitySwitch, bioInput, avatarFileInput]) {
      await page.keyboard.press("Shift+Tab");
      await expect(control).toBeFocused();
    }
  }

  await selectFileUsingKeyboard(page, avatarFileInput, {
    name: "avatar.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(page.getByRole("alert")).toHaveText("Choose a PNG, JPEG, or WebP image.");
  await expect(saveButton).toBeDisabled();
  await tabFromPhotoInputToCancel();
  await returnToPhotoInputFromCancel();

  await selectFileUsingKeyboard(page, avatarFileInput, {
    name: "avatar-too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toHaveText("Choose an image no larger than 5 MB.");
  await expect(saveButton).toBeDisabled();
  await tabFromPhotoInputToCancel();
  await returnToPhotoInputFromCancel();

  const jpegBuffer = await createAvatarImageAtExactSize("jpeg", MAX_AVATAR_UPLOAD_BYTES);
  expect(jpegBuffer.length).toBe(MAX_AVATAR_UPLOAD_BYTES);
  await selectFileUsingKeyboard(page, avatarFileInput, {
    name: "avatar-exact-limit.jpg",
    mimeType: "image/jpeg",
    buffer: jpegBuffer,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(saveButton).toBeEnabled();

  await tabFromPhotoInputToCancel();
  await page.keyboard.press("Tab");
  await expect(saveButton).toBeFocused();
  await expect(saveButton).toBeEnabled();
  await page.keyboard.press("Enter");
  await firstUploadStarted;
  expect(uploadedContentTypes[0]).toBe("image/jpeg");
  expect(uploadedBodySizes[0]).toBe(MAX_AVATAR_UPLOAD_BYTES);

  const uploadProgress = page.getByTestId("avatar-upload-progress");
  await expect(uploadProgress).toBeVisible();
  await expect(uploadProgress).toContainText("Uploading photo…");
  await expect(saveButton).toBeDisabled();
  await expect(page.getByTestId("dialog-edit-profile")).toBeVisible();

  let reachedCancelUpload = false;
  for (let index = 0; index < 20; index += 1) {
    if (await cancelUploadButton.evaluate((element) => element === document.activeElement)) {
      reachedCancelUpload = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  expect(reachedCancelUpload).toBe(true);
  await expect(cancelUploadButton).toBeFocused();
  await expect(cancelUploadButton).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(uploadProgress).toHaveCount(0);
  await expect(saveButton).toBeEnabled();
  await expect(page.getByTestId("dialog-edit-profile")).toBeVisible();
  let reachedBioAfterCancel = false;
  for (let index = 0; index < 20; index += 1) {
    if (await bioInput.evaluate((element) => element === document.activeElement)) {
      reachedBioAfterCancel = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  expect(reachedBioAfterCancel).toBe(true);
  await page.keyboard.type("Keyboard recovery works");
  await expect(bioInput).toHaveValue("Keyboard recovery works");
  await bioInput.fill("");

  releaseFirstUpload();
  await saveButton.click();
  await expect.poll(() => uploadAttempts).toBe(2);
  await expect(page.getByTestId("avatar-upload-progress")).toHaveCount(0);
  await expect(saveButton).toBeEnabled();
  await expect(page.getByTestId("dialog-edit-profile")).toBeVisible();
  await expect(page.getByText("Temporary upload failure", { exact: true })).toBeVisible();

  await saveButton.click();
  await expect.poll(() => uploadAttempts).toBe(3);
  expect(uploadedContentTypes[2]).toBe("image/jpeg");
  expect(uploadedBodySizes[2]).toBe(MAX_AVATAR_UPLOAD_BYTES);
  await expect(page.getByTestId("dialog-edit-profile")).toHaveCount(0);

  await page.getByTestId("button-edit-profile").click();
  await expect(page.getByTestId("dialog-edit-profile")).toBeVisible();
  await avatarFileInput.setInputFiles({
    name: "avatar.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(page.getByRole("alert")).toHaveText("Choose a PNG, JPEG, or WebP image.");
  await expect(saveButton).toBeDisabled();

  await avatarFileInput.setInputFiles({
    name: "avatar.webp",
    mimeType: "image/webp",
    buffer: await createAvatarImage("webp"),
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect.poll(() => uploadAttempts).toBe(4);
  expect(uploadedContentTypes[3]).toBe("image/webp");
  await expect(page.getByTestId("dialog-edit-profile")).toHaveCount(0);
});
