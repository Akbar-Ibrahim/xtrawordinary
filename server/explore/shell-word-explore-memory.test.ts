import assert from "node:assert/strict";
import test from "node:test";
import { shellWordMemorySource } from "./shell-word-explore-memory";

test("Shell Words preview browsing is alphabetical and cursor scoped to submitted filters", async () => {
  const input = { depth: 1 as const, direction: "shell" as const, first: "B" };
  const firstPage = await shellWordMemorySource.search(input, 2);
  assert.deepEqual(firstPage.items.map((item) => item.shellWord), ["BEARD", "BLOWN"]);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);

  const secondPage = await shellWordMemorySource.search(input, 2, firstPage.page.nextCursor!);
  assert.deepEqual(secondPage.items.map((item) => item.shellWord), ["BRAND"]);

  await assert.rejects(
    shellWordMemorySource.search({ depth: 1, direction: "inner", first: "B" }, 2, firstPage.page.nextCursor!),
  );
  await assert.rejects(
    shellWordMemorySource.search({ depth: 2, direction: "shell", first: "BR" }, 2, firstPage.page.nextCursor!),
  );
});

test("Shell Words preview checks dictionary membership and its recorded inner relationship separately", async () => {
  const shell = await shellWordMemorySource.check({ depth: 1, direction: "shell", word: "brand" });
  assert.equal(shell.dictionaryMatch, true);
  assert.equal(shell.relationshipMatch, true);
  assert.equal(shell.innerWord, "RAN");
  assert.equal(shell.depth, 1);

  const noRelationship = await shellWordMemorySource.check({ depth: 1, direction: "shell", word: "PAINTING" });
  assert.equal(noRelationship.dictionaryMatch, true);
  assert.equal(noRelationship.relationshipMatch, false);
  assert.equal(noRelationship.innerWord, null);

  const missing = await shellWordMemorySource.check({ depth: 1, direction: "shell", word: "ZZZ" });
  assert.equal(missing.dictionaryMatch, false);
  assert.equal(missing.relationshipMatch, false);
});

test("inner-word lookups return linked shells at the selected depth", async () => {
  const shell = await shellWordMemorySource.check({ depth: 1, direction: "inner", word: "ran" });
  assert.equal(shell.dictionaryMatch, true);
  assert.equal(shell.relationshipMatch, true);
  assert.equal(shell.linkedShellCount, 2);
  assert.equal(shell.innerWord, null);

  const deep = await shellWordMemorySource.search({ depth: 2, direction: "shell", first: "AD" }, 10);
  assert.deepEqual(deep.items.map((item) => item.shellWord), ["ADVANCE"]);
  assert.equal(deep.items[0].innerWord, "VAN");

  const depthThree = await shellWordMemorySource.search({ depth: 3, direction: "shell" }, 10);
  assert.deepEqual(depthThree.items.map((item) => item.shellWord), ["COOPERATE", "EDUCATION"]);

  const depthFour = await shellWordMemorySource.search({ depth: 4, direction: "shell" }, 10);
  assert.deepEqual(depthFour.items, [{ shellWord: "CHOCOLATE", innerWord: "O" }]);

  const depthFourCheck = await shellWordMemorySource.check({ depth: 4, direction: "inner", word: "O" });
  assert.equal(depthFourCheck.dictionaryMatch, true);
  assert.equal(depthFourCheck.relationshipMatch, true);
  assert.equal(depthFourCheck.linkedShellCount, 1);
});
