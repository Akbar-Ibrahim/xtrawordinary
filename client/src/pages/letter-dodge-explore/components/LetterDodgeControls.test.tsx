import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LetterDodgeControls } from "./LetterDodgeControls";

test("Letter Dodge Explore uses a text input instead of letter buttons", () => {
  const html = renderToStaticMarkup(
    createElement(LetterDodgeControls, {
      letters: "AE",
      isSearching: false,
      onSetLetters: () => {},
      onSearch: () => {},
    }),
  );

  assert.match(html, /data-testid="input-forbidden-letters"/);
  assert.match(html, /id="dodge-forbidden-letters"/);
  assert.match(html, /value="AE"/);
  assert.match(html, /sm:max-w-md/);
  assert.match(html, /data-testid="button-find-letter-dodge-words"/);
  assert.doesNotMatch(html, /data-letter-choice/);
  assert.doesNotMatch(html, /Select forbidden letters/);
});
