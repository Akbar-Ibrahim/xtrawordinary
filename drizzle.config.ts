import { defineConfig } from "drizzle-kit";
import { getMySQLConnectionUrl } from "./server/mysql-config";

export default defineConfig({
  out: "./migrations",
  schema: "./server/db-schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: getMySQLConnectionUrl(),
  },
});
