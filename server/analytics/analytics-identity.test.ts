import test from "node:test";
import assert from "node:assert/strict";
import {
  getExistingAnalyticsIdentity,
  getOrCreateAnalyticsIdentity,
  namespacedDedupeKey,
} from "./analytics-identity";

test("analytics identities are server-issued, signed, and reusable", () => {
  const headers: string[] = [];
  const first = getOrCreateAnalyticsIdentity(
    { headers: {} } as never,
    { append: (_name: string, value: string) => { headers.push(value); } } as never,
  );
  assert.equal(headers.length, 2);
  assert.ok(headers.every((header) => header.includes("HttpOnly") && header.includes("SameSite=Lax")));

  const cookie = headers.map((header) => header.split(";")[0]).join("; ");
  const existing = getExistingAnalyticsIdentity({ headers: { cookie } } as never);
  assert.deepEqual(existing, first);
});

test("analytics identities reject tampered cookies and namespace dedupe keys", () => {
  const headers: string[] = [];
  const identity = getOrCreateAnalyticsIdentity(
    { headers: {} } as never,
    { append: (_name: string, value: string) => { headers.push(value); } } as never,
  );
  const cookie = headers.map((header) => `${header.split(";")[0]}tampered`).join("; ");
  assert.equal(getExistingAnalyticsIdentity({ headers: { cookie } } as never), null);
  assert.notEqual(
    namespacedDedupeKey(identity.sessionId, "same-client-key"),
    namespacedDedupeKey("another-session", "same-client-key"),
  );
});

test("malformed analytics cookies never throw", () => {
  assert.doesNotThrow(() => {
    assert.equal(
      getExistingAnalyticsIdentity({
        headers: { cookie: "xw_analytics_visitor=%; xw_analytics_session=%E0%A4%A" },
      } as never),
      null,
    );
  });
});