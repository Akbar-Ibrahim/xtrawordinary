import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommentContent } from "./CommentContent";

test("comment markdown renders supported inline formatting, links, and bullet lists", () => {
  const html = renderToStaticMarkup(createElement(CommentContent, {
    content: "**bold** and *italic* with `code`\n[site](https://example.com)\n- first\n- second",
  }));

  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<code[^>]*>code<\/code>/);
  assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /<ul[^>]*><li>first<\/li><li>second<\/li><\/ul>/);
});

test("only resolved username mentions link to profiles, including inside emphasis", () => {
  const html = renderToStaticMarkup(createElement(CommentContent, {
    content: "Hi @Valid__Player, unknown @missing_user, person@example.com, and **@valid__player**",
    mentionUsers: [{ id: 42, username: "Valid__Player" }],
  }));

  assert.equal((html.match(/<a\b[^>]*data-testid="link-comment-mention-42"/g) ?? []).length, 2);
  assert.match(html, /href="\/u\/Valid__Player"[^>]*>@Valid__Player<\/a>/);
  assert.match(html, /<strong><a[^>]*>@valid__player<\/a><\/strong>/);
  assert.match(html, /unknown @missing_user, person@example\.com/);
  assert.equal((html.match(/<a\b/g) ?? []).length, 2);
});

test("comment markdown treats raw HTML and unsafe links as plain text", () => {
  const html = renderToStaticMarkup(createElement(CommentContent, {
    content: "<script>alert(1)</script> [bad](javascript:alert(1))",
  }));

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test("comment search highlights matching text inside supported markdown", () => {
  const html = renderToStaticMarkup(createElement(CommentContent, {
    content: "**A UNIQUE phrase** in a [unique phrase link](https://example.com) and `unique phrase`",
    highlightTerm: "unique phrase",
  }));

  assert.equal((html.match(/<mark\b/g) ?? []).length, 3);
  assert.match(html, /<strong>A <mark[^>]*>UNIQUE phrase<\/mark><\/strong>/);
  assert.match(html, /<a[^>]*><mark[^>]*>unique phrase<\/mark> link<\/a>/);
  assert.match(html, /<code[^>]*><mark[^>]*>unique phrase<\/mark><\/code>/);
});

test("comment search does not highlight a non-matching thread-context comment", () => {
  const html = renderToStaticMarkup(createElement(CommentContent, {
    content: "This comment is included for thread context.",
    highlightTerm: "unique phrase",
  }));

  assert.doesNotMatch(html, /<mark\b/);
});

test("highlighted search text does not make raw HTML active", () => {
  const html = renderToStaticMarkup(createElement(CommentContent, {
    content: "<script>alert(1)</script> find me",
    highlightTerm: "find me",
  }));

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<mark[^>]*>find me<\/mark>/);
  assert.doesNotMatch(html, /<script>/);
});
