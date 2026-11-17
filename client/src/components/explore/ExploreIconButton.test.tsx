import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExploreIconButton } from "./ExploreIconButton";

test("renders an icon-only search button with an accessible name", () => {
  const html = renderToStaticMarkup(
    createElement(ExploreIconButton, { label: "Search words" }),
  );

  assert.match(html, /aria-label="Search words"/);
  assert.match(html, /title="Search words"/);
  assert.match(html, /data-explore-icon-button=""/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /Search words<\/button>/);
});

test("keeps its accessible name and exposes the loading state", () => {
  const html = renderToStaticMarkup(
    createElement(ExploreIconButton, { label: "Search words", isLoading: true }),
  );

  assert.match(html, /aria-label="Search words"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /animate-spin/);
});
