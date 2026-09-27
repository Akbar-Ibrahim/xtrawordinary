import test from "node:test";
import assert from "node:assert/strict";
import { is } from "drizzle-orm";
import { getTableConfig, MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../db-schema";

test("MySQL foreign-key names fit its identifier limit", () => {
  const tables = Object.values(schema).filter((value) => is(value, MySqlTable));
  const oversized = tables.flatMap((table) =>
    getTableConfig(table).foreignKeys
      .map((key) => key.getName())
      .filter((name) => name.length > 64),
  );

  assert.deepEqual(oversized, []);
});

test("contact replies reference their message with cascade delete", () => {
  const keys = getTableConfig(schema.contactMessageReplies).foreignKeys;
  assert.equal(keys.length, 1);
  const key = keys[0];
  const reference = key.reference();

  assert.equal(key.getName(), "contact_replies_message_fk");
  assert.equal(reference.columns[0], schema.contactMessageReplies.contactMessageId);
  assert.equal(reference.foreignColumns[0], schema.contactMessages.id);
  assert.equal(key.onDelete, "cascade");
});