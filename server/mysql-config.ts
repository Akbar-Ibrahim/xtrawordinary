export interface MySQLConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function getMySQLConnectionConfig(): MySQLConnectionConfig {
  const missing = ["DB_URL", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    .filter((key) => process.env[key] === undefined || (key !== "DB_PASSWORD" && !process.env[key]?.trim()));

  if (missing.length > 0) {
    throw new Error(`Missing MySQL environment variables: ${missing.join(", ")}`);
  }

  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be a valid TCP port number");
  }

  return {
    host: process.env.DB_URL!.trim(),
    port,
    database: process.env.DB_NAME!.trim(),
    user: process.env.DB_USER!.trim(),
    password: process.env.DB_PASSWORD ?? "",
  };
}

export function getMySQLConnectionUrl(): string {
  const config = getMySQLConnectionConfig();
  return `mysql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${encodeURIComponent(config.database)}`;
}