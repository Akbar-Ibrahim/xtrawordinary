import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./db-schema";
import { getMySQLConnectionConfig } from "./mysql-config";

const pool = mysql.createPool(getMySQLConnectionConfig());

export const db = drizzle(pool, { schema, mode: "default" });
