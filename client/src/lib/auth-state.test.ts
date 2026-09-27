import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "@shared/schema";
import { resolveAuthStatus } from "./auth-state";

const user = { id: 1 } as AuthenticatedUser;

test("auth remains unresolved while the session check is loading", () => {
  assert.equal(resolveAuthStatus(null, true), "loading");
  assert.equal(resolveAuthStatus(user, true), "loading");
});

test("auth resolves from the confirmed user value", () => {
  assert.equal(resolveAuthStatus(user, false), "authenticated");
  assert.equal(resolveAuthStatus(null, false), "unauthenticated");
});