export type StorageMode = "mysql" | "memory";

export function getStorageMode(environment: NodeJS.ProcessEnv = process.env): StorageMode {
  const rawMode = environment.STORAGE_MODE?.trim().toLowerCase();

  if (!rawMode) return environment.NODE_ENV === "production" ? "mysql" : "memory";
  if (rawMode === "mysql" || rawMode === "memory") return rawMode;

  throw new Error(
    `Invalid STORAGE_MODE "${environment.STORAGE_MODE}". Expected "mysql" or "memory".`,
  );
}

export function isMySQLStorageEnabled(): boolean {
  return getStorageMode() === "mysql";
}