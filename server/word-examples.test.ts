import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDatabaseWordExampleRequest } from "./routes/word-examples.routes.ts";

test("normalizes and preserves Length Challenge's positional variation", () => {
  const result = parseDatabaseWordExampleRequest({
    game: "word-length",
    limit: 10,
    length: 6,
    variation: 4,
    startsWith: "s",
    contains: "e",
  });

  assert.deepEqual(result, {
    game: "word-length",
    length: 6,
    variation: 4,
    startsWith: "S",
    endsWith: undefined,
    contains: "E",
  });
});

test("rejects duplicate or malformed Letter Frequency constraints", () => {
  assert.equal(
    parseDatabaseWordExampleRequest({
      game: "letter-frequency",
      limit: 10,
      mode: "minimum",
      constraints: "A:2,A:1",
    }),
    null,
  );

  assert.equal(
    parseDatabaseWordExampleRequest({
      game: "letter-frequency",
      limit: 10,
      mode: "exact",
      constraints: "A:7",
    }),
    null,
  );
});

test("requires concrete values for Vowels & Consonants rules", () => {
  assert.equal(
    parseDatabaseWordExampleRequest({
      game: "letter-balance",
      limit: 10,
      category: "locked_balance",
      length: 6,
    }),
    null,
  );

  assert.deepEqual(
    parseDatabaseWordExampleRequest({
      game: "letter-balance",
      limit: 10,
      category: "locked_balance",
      length: 6,
      consonantCount: 4,
      vowelCount: 2,
    }),
    {
      game: "letter-balance",
      category: "locked_balance",
      length: 6,
      consonantCount: 4,
      vowelCount: 2,
    },
  );
});