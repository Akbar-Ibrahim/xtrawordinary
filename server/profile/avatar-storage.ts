import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAX_AVATAR_UPLOAD_BYTES } from "@shared/avatar";

const AVATAR_PUBLIC_PATH = "/uploads/avatars";
const MAX_AVATAR_PIXELS = 25_000_000;

export class InvalidAvatarImageError extends Error {
  constructor(message = "Choose a valid PNG, JPEG, or WebP image.") {
    super(message);
    this.name = "InvalidAvatarImageError";
  }
}

export function getAvatarStorageDirectory(): string {
  const configuredDirectory = process.env.AVATAR_STORAGE_DIR?.trim();
  return path.resolve(
    configuredDirectory || path.join(process.cwd(), ".data", "avatars"),
  );
}

async function createAvatarWebp(image: Buffer): Promise<Buffer> {
  if (image.length === 0 || image.length > MAX_AVATAR_UPLOAD_BYTES) {
    throw new InvalidAvatarImageError("Avatar image must be no larger than 5 MB.");
  }

  try {
    const source = sharp(image, {
      failOn: "error",
      limitInputPixels: MAX_AVATAR_PIXELS,
    });
    const metadata = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
      throw new InvalidAvatarImageError();
    }

    return await sharp(image, {
      failOn: "error",
      limitInputPixels: MAX_AVATAR_PIXELS,
    })
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof InvalidAvatarImageError) throw error;
    throw new InvalidAvatarImageError();
  }
}

export async function storeAvatarImage(
  image: Buffer,
  directory = getAvatarStorageDirectory(),
): Promise<string> {
  const optimizedImage = await createAvatarWebp(image);
  await mkdir(directory, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  await writeFile(path.join(directory, filename), optimizedImage, {
    flag: "wx",
    mode: 0o644,
  });

  return `${AVATAR_PUBLIC_PATH}/${filename}`;
}

export async function removeStoredAvatar(
  avatarUrl: string | null | undefined,
  directory = getAvatarStorageDirectory(),
): Promise<void> {
  const filename = avatarUrl?.match(
    /^\/uploads\/avatars\/([0-9a-f-]{36}\.webp)$/i,
  )?.[1];
  if (!filename) return;

  try {
    await unlink(path.join(directory, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
