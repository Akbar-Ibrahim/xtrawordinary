import { defineConfig } from "drizzle-kit";

if (!process.env.MYSQL_DATABASE_URL) {
  throw new Error("MYSQL_DATABASE_URL is not set. Ensure the MySQL database is provisioned.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./server/db-schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.MYSQL_DATABASE_URL,
  },
});
