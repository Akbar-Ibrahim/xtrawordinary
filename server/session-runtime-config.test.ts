import assert from "node:assert/strict";
import test from "node:test";
import { getSessionRuntimeConfig, verifyPersistentSessionStore } from "./auth";

test("development can use in-memory sessions", () => {
  assert.deepEqual(
    getSessionRuntimeConfig({ NODE_ENV: "development" }),
    {
      isProduction: false,
      storageMode: "memory",
      secret: "wordplay-dev-secret",
    },
  );
});

test("production requires a configured session secret", () => {
  assert.throws(
    () => getSessionRuntimeConfig({ NODE_ENV: "production", STORAGE_MODE: "mysql" }),
    /SESSION_SECRET/,
  );
});

test("production rejects an explicit in-memory session configuration", () => {
  assert.throws(
    () => getSessionRuntimeConfig({
      NODE_ENV: "production",
      STORAGE_MODE: "memory",
      SESSION_SECRET: "test-secret",
    }),
    /STORAGE_MODE=mysql/,
  );
});

test("production defaults to a persistent MySQL session configuration", () => {
  assert.deepEqual(
    getSessionRuntimeConfig({
      NODE_ENV: "production",
      SESSION_SECRET: "test-secret",
    }),
    {
      isProduction: true,
      storageMode: "mysql",
      secret: "test-secret",
    },
  );
});

test("verifies the sessions table before production startup", async () => {
  const queries: string[] = [];
  let closed = false;

  await verifyPersistentSessionStore(
    async () => ({
      query: async (query: string) => {
        queries.push(query);
        return [] as any;
      },
      end: async () => {
        closed = true;
        return undefined as any;
      },
    }),
    {
      host: "db.example.test",
      port: 3306,
      database: "wordplay",
      user: "player",
      password: "secret",
      timezone: "Z",
    },
  );

  assert.deepEqual(queries, ["SELECT 1 FROM `sessions` LIMIT 1"]);
  assert.equal(closed, true);
});

test("closes the database connection when the sessions table check fails", async () => {
  let closed = false;

  await assert.rejects(
    verifyPersistentSessionStore(
      async () => ({
        query: async () => {
          throw new Error("Table 'wordplay.sessions' doesn't exist");
        },
        end: async () => {
          closed = true;
          return undefined as any;
        },
      }),
      {
        host: "db.example.test",
        port: 3306,
        database: "wordplay",
        user: "player",
        password: "secret",
        timezone: "Z",
      },
    ),
    /sessions/,
  );

  assert.equal(closed, true);
});