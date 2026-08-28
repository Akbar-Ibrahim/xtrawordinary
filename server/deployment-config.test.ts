import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("deployment verifies analytics persistence after applying the schema", async () => {
  const config = await readFile(".replit", "utf8");
  assert.match(
    config,
    /build = \["bash", "-lc", "npm run db:push && npm run verify:analytics:persistence && npm run build"\]/,
  );
});