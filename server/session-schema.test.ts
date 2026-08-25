import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { sessions } from "./db-schema";

test("sessions table matches the MySQL session-store contract", () => {
  const config = getTableConfig(sessions);
  const columns = Object.fromEntries(config.columns.map((column) => [column.name, column]));

  assert.equal(config.name, "sessions");
  assert.equal(columns.session_id.getSQLType(), "varchar(128)");
  assert.equal(columns.expires.getSQLType(), "int unsigned");
  assert.equal(columns.data.getSQLType(), "mediumtext");
  assert.equal(columns.session_id.primary, true);
});