export type StorageMode = "mysql" | "memory";

export function getStorageMode(): StorageMode {
  const rawMode = process.env.STORAGE_MODE?.trim().toLowerCase();

  if (!rawMode) return "memory";
  if (rawMode === "mysql" || rawMode === "memory") return rawMode;

  throw new Error(
    `Invalid STORAGE_MODE "${process.env.STORAGE_MODE}". Expected "mysql" or "memory".`,
  );
}

export function isMySQLStorageEnabled(): boolean {
  return getStorageMode() === "mysql";
}