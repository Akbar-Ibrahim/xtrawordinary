import assert from "node:assert/strict";
import test from "node:test";
import { copyResultText, shareResultText, type BrowserSharingApi } from "./result-sharing";

const fullText = "🏆 A result\n\nScore: 1,234\n  Keep these spaces  \nhttps://example.com/daily";
const data = { title: "Result", text: "A result", url: "https://example.com/daily" };

test("successful copy preserves all text and uses the clipboard method's receiver", async () => {
  let written = "";
  const clipboard = {
    async writeText(text: string) {
      assert.equal(this, clipboard);
      written = text;
    },
  };
  assert.equal(await copyResultText(fullText, { clipboard }), "copied");
  assert.equal(written, fullText);
});

test("absent or inaccessible clipboard returns manual recovery", async () => {
  assert.equal(await copyResultText(fullText, {}), "manual");
  const api = Object.defineProperty({}, "clipboard", {
    get() { throw new Error("Unavailable"); },
  });
  assert.equal(await copyResultText(fullText, api), "manual");
});

test("synchronous copy errors and rejected permissions return manual recovery", async () => {
  for (const writeText of [
    () => { throw new Error("Unavailable"); },
    async () => { throw new DOMException("Denied", "NotAllowedError"); },
  ]) {
    assert.equal(await copyResultText(fullText, { clipboard: { writeText } }), "manual");
  }
});

test("native sharing succeeds with the original payload and never copies", async () => {
  const api: BrowserSharingApi = {
    async share(payload) { assert.equal(this, api); assert.deepEqual(payload, data); },
    clipboard: { async writeText() { assert.fail("Should not copy after native success"); } },
  };
  assert.equal(await shareResultText(data, fullText, api), "shared");
});

test("missing native sharing falls back to copying full text", async () => {
  let written = "";
  const api = { clipboard: { async writeText(text: string) { written = text; } } };
  assert.equal(await shareResultText(data, fullText, api), "copied");
  assert.equal(written, fullText);
});

test("native sharing denial or synchronous failure falls back to copying", async () => {
  for (const share of [
    () => { throw new Error("Unavailable"); },
    async () => { throw new DOMException("Denied", "NotAllowedError"); },
  ]) {
    let written = "";
    const api = { share, clipboard: { async writeText(text: string) { written = text; } } };
    assert.equal(await shareResultText(data, fullText, api), "copied");
    assert.equal(written, fullText);
  }
});

test("native share cancellation is silent and never copies", async () => {
  const api = {
    async share() { throw new DOMException("Cancelled", "AbortError"); },
    clipboard: { async writeText() { assert.fail("Cancellation must not copy"); } },
  };
  assert.equal(await shareResultText(data, fullText, api), "cancelled");
});

test("unavailable or rejected sharing and copying return manual recovery", async () => {
  assert.equal(await shareResultText(data, fullText, {}), "manual");
  const api = {
    async share() { throw new Error("Share failed"); },
    clipboard: { async writeText() { throw new Error("Copy failed"); } },
  };
  assert.equal(await shareResultText(data, fullText, api), "manual");
});