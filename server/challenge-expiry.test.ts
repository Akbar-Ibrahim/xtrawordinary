import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getOpenChallengeExpiresAt,
  isOpenChallengeExpired,
  OPEN_CHALLENGE_TTL_MS,
} from "./challenge-expiry.ts";

test("open duel challenges receive a 24-hour deadline", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  const expiresAt = getOpenChallengeExpiresAt(now);

  assert.equal(expiresAt.getTime() - now.getTime(), OPEN_CHALLENGE_TTL_MS);
});

test("legacy open challenges without a deadline use the same 24-hour policy", () => {
  const createdAt = "2026-08-22T12:00:00.000Z";

  assert.equal(
    isOpenChallengeExpired(createdAt, null, new Date("2026-08-22T23:59:59.999Z")),
    false,
  );
  assert.equal(
    isOpenChallengeExpired(createdAt, null, new Date("2026-08-23T12:00:00.000Z")),
    true,
  );
});

test("an explicit deadline takes precedence over the legacy fallback", () => {
  assert.equal(
    isOpenChallengeExpired(
      "2026-08-23T12:00:00.000Z",
      "2026-08-23T13:00:00.000Z",
      new Date("2026-08-23T13:00:00.000Z"),
    ),
    true,
  );
});