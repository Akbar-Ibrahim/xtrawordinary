import assert from "node:assert/strict";
import test from "node:test";
import { deepShellWordSet, shellWordSet } from "../game-data";
import { MemStorage } from "../mem-storage";

test("in-memory Shell Words gameplay pool only includes five-letter outer words", async () => {
  assert.ok([...shellWordSet].every((word) => word.length >= 5));

  const storage = new MemStorage();
  assert.deepEqual(
    await storage.validateShellWord("CARE"),
    { valid: false, innerWord: null },
  );
  const validShellWord = [...shellWordSet][0];
  assert.ok(validShellWord);
  assert.equal((await storage.validateShellWord(validShellWord)).valid, true);
});

test("in-memory Deep Shell Words gameplay pool keeps its seven-letter minimum", async () => {
  assert.ok([...deepShellWordSet].every((word) => word.length >= 7));

  const storage = new MemStorage();
  assert.deepEqual(
    await storage.validateDeepShellWord("ABCDEF"),
    { valid: false, innerWord: null },
  );
  const validShellWord = [...deepShellWordSet][0];
  assert.ok(validShellWord);
  assert.equal((await storage.validateDeepShellWord(validShellWord)).valid, true);
});
