import assert from "node:assert/strict";
import test from "node:test";
import { getStorageMode } from "./storage-config";

test("development defaults to in-memory storage", () => {
  assert.equal(getStorageMode({ NODE_ENV: "development" }), "memory");
});

test("production defaults to persistent MySQL storage", () => {
  assert.equal(getStorageMode({ NODE_ENV: "production" }), "mysql");
});

test("explicit storage mode overrides the environment default", () => {
  assert.equal(getStorageMode({ NODE_ENV: "production", STORAGE_MODE: "memory" }), "memory");
  assert.equal(getStorageMode({ NODE_ENV: "development", STORAGE_MODE: "mysql" }), "mysql");
});