---
name: E2E testing with in-memory storage and dev restarts
description: Why multi-step API setup + runTest() browser flows can fail with fresh 401s even when credentials are correct.
---

The dev workflow can auto-restart (observed via changing log file timestamps) even without an explicit file edit in between, which wipes `MemStorage` (in-memory storage/session store) entirely. Any test user registered/verified/logged-in via a setup script becomes invalid if a restart happens before `runTest()` (or any subsequent request) runs.

**Why:** MemStorage and the in-memory session store have no persistence across process restarts; the dev server restarts more often than expected during long agent sessions.

**How to apply:** When building an e2e test that requires a pre-seeded user/data via API calls before invoking `runTest()`, do the setup and the test invocation as close together as possible (same turn ideally), and re-verify the setup (e.g. re-check login still works) immediately before calling `runTest()`. If `runTest()` reports a fresh 401/"invalid credentials" for credentials that worked seconds earlier, suspect a restart wiped state rather than a code bug — re-seed and retry once before treating it as a real failure. Prefer verifying core logic via direct API assertions (curl/node fetch) as the primary evidence when the browser e2e path is flaky for this reason.
