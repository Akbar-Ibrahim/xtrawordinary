import assert from "node:assert/strict";
import test from "node:test";
import { deepShellWordMemorySource, shellWordMemorySource } from "./shell-word-explore-memory";

test("Shell Words preview browsing is alphabetical and cursor scoped to submitted filters", async () => {
  const input = { direction: "shell" as const, first: "B" };
  const firstPage = await shellWordMemorySource.search(input, 2);
  assert.deepEqual(firstPage.items.map((item) => item.shellWord), ["BEARD", "BLOWN"]);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);

  const secondPage = await shellWordMemorySource.search(input, 2, firstPage.page.nextCursor!);
  assert.deepEqual(secondPage.items.map((item) => item.shellWord), ["BRAND"]);

  await assert.rejects(
    shellWordMemorySource.search({ direction: "inner", first: "B" }, 2, firstPage.page.nextCursor!),
  );
});

test("Shell Words preview checks dictionary membership and its recorded inner relationship separately", async () => {
  const shell = await shellWordMemorySource.check({ direction: "shell", word: "brand" });
  assert.equal(shell.dictionaryMatch, true);
  assert.equal(shell.relationshipMatch, true);
  assert.equal(shell.innerWord, "RAN");

  const noRelationship = await shellWordMemorySource.check({ direction: "shell", word: "PAINTING" });
  assert.equal(noRelationship.dictionaryMatch, true);
  assert.equal(noRelationship.relationshipMatch, false);
  assert.equal(noRelationship.innerWord, null);

  const missing = await shellWordMemorySource.check({ direction: "shell", word: "ZZZ" });
  assert.equal(missing.dictionaryMatch, false);
  assert.equal(missing.relationshipMatch, false);
});

test("inner-word lookups return linked shell counts, including for Deep Shell Words", async () => {
  const shell = await shellWordMemorySource.check({ direction: "inner", word: "ran" });
  assert.equal(shell.dictionaryMatch, true);
  assert.equal(shell.relationshipMatch, true);
  assert.equal(shell.linkedShellCount, 2);
  assert.equal(shell.innerWord, null);

  const deep = await deepShellWordMemorySource.search({ direction: "shell", first: "AD" }, 10);
  assert.deepEqual(deep.items.map((item) => item.shellWord), ["ADVANCE"]);
  assert.equal(deep.items[0].innerWord, "VAN");
});
