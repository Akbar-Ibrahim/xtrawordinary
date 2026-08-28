import assert from "node:assert/strict";
import test from "node:test";
import { getMySQLConnectionConfig, getMySQLConnectionUrl } from "./mysql-config";

const dbVariables = ["DB_URL", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;

function withDatabaseEnvironment(values: Record<(typeof dbVariables)[number], string>, action: () => void) {
  const previous = new Map(dbVariables.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    action();
  } finally {
    for (const key of dbVariables) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("builds MySQL connection settings from DB_* variables", () => {
  withDatabaseEnvironment({
    DB_URL: "db.example.test",
    DB_PORT: "3307",
    DB_NAME: "word games",
    DB_USER: "word player",
    DB_PASSWORD: "p@ss word",
  }, () => {
    assert.deepEqual(getMySQLConnectionConfig(), {
      host: "db.example.test",
      port: 3307,
      database: "word games",
      user: "word player",
      password: "p@ss word",
      timezone: "Z",
    });
    assert.equal(
      getMySQLConnectionUrl(),
      "mysql://word%20player:p%40ss%20word@db.example.test:3307/word%20games",
    );
  });
});

test("requires all configured MySQL connection variables", () => {
  withDatabaseEnvironment({
    DB_URL: "",
    DB_PORT: "3306",
    DB_NAME: "words",
    DB_USER: "player",
    DB_PASSWORD: "",
  }, () => {
    assert.throws(() => getMySQLConnectionConfig(), /DB_URL/);
  });
});