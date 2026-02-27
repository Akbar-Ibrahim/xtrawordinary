import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./db-schema";

const connectionString = process.env.MYSQL_DATABASE_URL;

if (!connectionString) {
  throw new Error("MYSQL_DATABASE_URL is required for MySQL storage");
}

const pool = mysql.createPool(connectionString);

export const db = drizzle(pool, { schema, mode: "default" });
