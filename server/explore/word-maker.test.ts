import assert from "node:assert/strict";
import test from "node:test";
import { canFormFromLetters } from "./letter-matching";
import { wordMakerMemorySource } from "./word-maker-memory";

test("letter matching respects repeated-letter counts and casing", () => {
  assert.equal(canFormFromLetters("LETTER", "tree"), true);
  assert.equal(canFormFromLetters("LETTER", "treett"), false);
  assert.equal(canFormFromLetters("LETTER", "words"), false);
});

test("preview results are alphabetized, include short words, and stay small", async () => {
  const result = await wordMakerMemorySource.getWords("CHAMPION", 100);
  const words = result.items.map((item) => item.word);

  assert.equal(result.baseWord, "CHAMPION");
  assert.equal(result.source, "preview");
  assert.ok(words.length <= 12);
  assert.deepEqual(words, [...words].sort((left, right) => left.localeCompare(right, "en")));
  assert.ok(words.some((word) => word.length < 3));
});

test("preview pagination continues after the last item without duplicates", async () => {
  const firstPage = await wordMakerMemorySource.searchBaseWords("C", 1);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);

  const secondPage = await wordMakerMemorySource.searchBaseWords("C", 1, firstPage.page.nextCursor!);
  assert.notEqual(secondPage.items[0]?.baseWord, firstPage.items[0]?.baseWord);
});

test("random preview selection always has at least one matching result", async () => {
  const { baseWord } = await wordMakerMemorySource.randomBaseWord();
  const result = await wordMakerMemorySource.getWords(baseWord, 100);
  assert.ok(result.items.length > 0);
});

test("host checks expose short dictionary matches without changing gameplay rules", async () => {
  const result = await wordMakerMemorySource.checkAnswer("CHAMPION", "AM");

  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.playableInGame, false);
  assert.equal(result.gameplayExclusion, "below_minimum_length");
});

test("every preview Browse word is accepted by Host, including PAINTING/NAG", async () => {
  const bases = await wordMakerMemorySource.searchBaseWords("", 100);
  for (const { baseWord } of bases.items) {
    const { items } = await wordMakerMemorySource.getWords(baseWord, 100);
    for (const { word } of items) {
      const check = await wordMakerMemorySource.checkAnswer(baseWord.toLowerCase(), word.toLowerCase());
      assert.equal(check.dictionaryMatch, true, `${baseWord}/${word}`);
    }
  }
  const painting = await wordMakerMemorySource.getWords("painting", 100);
  assert.ok(painting.items.some(({ word }) => word === "NAG"));
  assert.equal((await wordMakerMemorySource.checkAnswer("painting", "nag")).dictionaryMatch, true);
});

test("Host rejects the base itself, unknown words and unavailable letters", async () => {
  for (const answer of ["PAINTING", "ZZZZZZ", "TREE"]) {
    assert.equal((await wordMakerMemorySource.checkAnswer("PAINTING", answer)).dictionaryMatch, false);
  }
});
