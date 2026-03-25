import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./server/db-schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.MYSQL_DATABASE_URL!,
  },
});
