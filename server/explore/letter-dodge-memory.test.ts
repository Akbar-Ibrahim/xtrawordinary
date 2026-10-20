import assert from "node:assert/strict";
import test from "node:test";
import { letterDodgeMemorySource } from "./letter-dodge-memory";

test("preview Letter Dodge results exclude every forbidden letter and expose short dictionary words", async () => {
  const results = await letterDodgeMemorySource.search("EA", 100);
  const cot = results.items.find(({ word }) => word === "COT");
  assert.ok(cot);
  assert.equal(cot.playableInGame, false);
  assert.match(cot.gameplayExclusion ?? "", /4 letters/);
  assert.ok(results.items.every(({ word }) => !/[EA]/.test(word)));

  const answer = await letterDodgeMemorySource.check("COT", "AE");
  assert.equal(answer.dictionaryMatch, true);
  assert.equal(answer.constraintMatch, true);
  assert.equal(answer.playableInGame, false);
});

test("preview Letter Dodge host checks reject a forbidden letter", async () => {
  const answer = await letterDodgeMemorySource.check("CAT", "AE");
  assert.equal(answer.dictionaryMatch, true);
  assert.equal(answer.constraintMatch, false);
  assert.equal(answer.playableInGame, false);
});
