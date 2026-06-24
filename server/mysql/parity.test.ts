/**
 * MySQL domain-file parity smoke tests.
 *
 * Mocks the `db` argument (recording Drizzle query chains) and asserts that each
 * domain function issues queries with the correct shape — no spurious limits,
 * correct default values, correct operation order, correct computed return values.
 *
 * No live MySQL connection is required; no server is started.
 *
 * Run with:  npx tsx server/mysql/parity.test.ts
 *   or:      node --import tsx/esm server/mysql/parity.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { getAllUsers } from "./admin.js";
import { getDuelChallengesForUser, getOpenDuelChallenges, getDuelLeaderboard } from "./duels.js";
import { getHuddleChallengesForGroup } from "./huddle.js";
import { getTeamRaceChallengesForGroup } from "./team-race.js";
import {
  listWordWarsTournaments,
  createWordWarsTournament,
  createWordWarsRegistration,
} from "./word-wars.js";
import { listGuildWarsTournaments, createGuildWarsRegistration } from "./guild-wars.js";
import { addGroupReaction, submitGroupRoundScore } from "./groups.js";

// ── Mock DB infrastructure ─────────────────────────────────────────────────

/**
 * Records every chained Drizzle method call on a single query builder.
 * Awaiting the instance returns the preconfigured result.
 */
class ChainRecorder {
  readonly calls: { method: string; args: any[] }[] = [];
  private readonly _result: unknown;

  constructor(result: unknown) {
    this._result = result;
  }

  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(this._result).then(resolve, reject);
  }

  from(...a: unknown[])                 { this.calls.push({ method: "from",                 args: a }); return this; }
  where(...a: unknown[])                { this.calls.push({ method: "where",                args: a }); return this; }
  orderBy(...a: unknown[])              { this.calls.push({ method: "orderBy",              args: a }); return this; }
  limit(...a: unknown[])                { this.calls.push({ method: "limit",                args: a }); return this; }
  groupBy(...a: unknown[])              { this.calls.push({ method: "groupBy",              args: a }); return this; }
  having(...a: unknown[])               { this.calls.push({ method: "having",               args: a }); return this; }
  set(...a: unknown[])                  { this.calls.push({ method: "set",                  args: a }); return this; }
  values(...a: unknown[])               { this.calls.push({ method: "values",               args: a }); return this; }
  onDuplicateKeyUpdate(...a: unknown[]) { this.calls.push({ method: "onDuplicateKeyUpdate", args: a }); return this; }
  innerJoin(...a: unknown[])            { this.calls.push({ method: "innerJoin",            args: a }); return this; }
  leftJoin(...a: unknown[])             { this.calls.push({ method: "leftJoin",             args: a }); return this; }
}

type Op = "select" | "insert" | "delete" | "update";

/**
 * Minimal mock database.
 * Consumes results from a queue (FIFO); each top-level call (select/insert/…)
 * pops the next result off the queue.  A fallback is used when the queue is empty.
 */
class MockDb {
  readonly ops: { op: Op; recorder: ChainRecorder }[] = [];
  private readonly queue: unknown[];

  constructor(...results: unknown[]) {
    this.queue = [...results];
  }

  private dequeue(fallback: unknown): unknown {
    return this.queue.length > 0 ? this.queue.shift() : fallback;
  }

  select(..._a: unknown[]) {
    const r = new ChainRecorder(this.dequeue([]));
    this.ops.push({ op: "select", recorder: r });
    return r;
  }

  insert(..._a: unknown[]) {
    const r = new ChainRecorder(this.dequeue([{ insertId: 1 }]));
    this.ops.push({ op: "insert", recorder: r });
    return r;
  }

  delete(..._a: unknown[]) {
    const r = new ChainRecorder(this.dequeue({ affectedRows: 0 }));
    this.ops.push({ op: "delete", recorder: r });
    return r;
  }

  update(..._a: unknown[]) {
    const r = new ChainRecorder(this.dequeue([{ affectedRows: 1 }]));
    this.ops.push({ op: "update", recorder: r });
    return r;
  }
}

// ── Small assertion helpers ────────────────────────────────────────────────

/** True when the chain never called .limit() */
function noLimit(rec: ChainRecorder): boolean {
  return !rec.calls.some(c => c.method === "limit");
}

/** Returns the ChainRecorder for the first "insert" op */
function firstInsert(db: MockDb): ChainRecorder {
  const op = db.ops.find(o => o.op === "insert");
  assert.ok(op, "Expected at least one insert operation");
  return op.recorder;
}

// ── No-limit tests ─────────────────────────────────────────────────────────
// Each test verifies that the primary (first) select query carries no .limit()
// call.  Returning [] short-circuits any follow-up selects so we only inspect
// the main query.

test("getAllUsers: primary query has no limit", async () => {
  const db = new MockDb([]);
  await getAllUsers(db);
  assert.ok(noLimit(db.ops[0].recorder), "getAllUsers must not apply a row limit");
});

test("getDuelChallengesForUser: primary query has no limit", async () => {
  const db = new MockDb([]);
  await getDuelChallengesForUser(db, 1);
  assert.ok(noLimit(db.ops[0].recorder), "getDuelChallengesForUser must not apply a row limit");
});

test("getOpenDuelChallenges: primary query has no limit", async () => {
  const db = new MockDb([]);
  await getOpenDuelChallenges(db, 1);
  assert.ok(noLimit(db.ops[0].recorder), "getOpenDuelChallenges must not apply a row limit");
});

test("getHuddleChallengesForGroup: primary query has no limit", async () => {
  const db = new MockDb([]);
  await getHuddleChallengesForGroup(db, 1);
  assert.ok(noLimit(db.ops[0].recorder), "getHuddleChallengesForGroup must not apply a row limit");
});

test("getTeamRaceChallengesForGroup: primary query has no limit", async () => {
  const db = new MockDb([]);
  await getTeamRaceChallengesForGroup(db, 1);
  assert.ok(noLimit(db.ops[0].recorder), "getTeamRaceChallengesForGroup must not apply a row limit");
});

test("listWordWarsTournaments: primary query has no limit", async () => {
  const db = new MockDb([]);
  await listWordWarsTournaments(db);
  assert.ok(noLimit(db.ops[0].recorder), "listWordWarsTournaments must not apply a row limit");
});

test("listGuildWarsTournaments: primary query has no limit", async () => {
  const db = new MockDb([]);
  await listGuildWarsTournaments(db);
  assert.ok(noLimit(db.ops[0].recorder), "listGuildWarsTournaments must not apply a row limit");
});

// ── Default-value tests ────────────────────────────────────────────────────

test("createWordWarsTournament: minPlayers defaults to 2 when not provided", async () => {
  const db = new MockDb(
    [{ insertId: 1 }],
    [{
      id: 1, name: "T", status: "registration",
      registrationDeadline: new Date(), roundDeadlineHours: 24,
      minPlayers: 2, maxPlayers: null, recurringCron: null,
      createdBy: 0, createdAt: new Date(),
    }],
  );
  const data = {
    name: "T",
    registrationDeadline: new Date().toISOString(),
    roundDeadlineHours: 24,
    createdBy: 1,
    // minPlayers intentionally omitted
  } as any;
  await createWordWarsTournament(db, data);
  const valuesCall = firstInsert(db).calls.find(c => c.method === "values");
  assert.ok(valuesCall, "insert must have a .values() call");
  assert.equal(
    (valuesCall.args[0] as any).minPlayers,
    2,
    "minPlayers must default to 2 when not provided in input data",
  );
});

// ── Plain-insert (no upsert) tests ─────────────────────────────────────────

test("createWordWarsRegistration: uses plain insert, not onDuplicateKeyUpdate", async () => {
  const db = new MockDb(
    [{ insertId: 5 }],
    [{ id: 5, tournamentId: 1, userId: 2, createdAt: new Date() }],
  );
  await createWordWarsRegistration(db, 1, 2);
  const rec = firstInsert(db);
  assert.ok(
    !rec.calls.some(c => c.method === "onDuplicateKeyUpdate"),
    "createWordWarsRegistration must use a plain insert — no onDuplicateKeyUpdate",
  );
});

test("createGuildWarsRegistration: uses plain insert, not onDuplicateKeyUpdate", async () => {
  const db = new MockDb(
    [{ insertId: 7 }],
    [{ id: 7, tournamentId: 1, groupId: 3, registeredBy: 4, createdAt: new Date() }],
  );
  await createGuildWarsRegistration(db, 1, 3, 4);
  const rec = firstInsert(db);
  assert.ok(
    !rec.calls.some(c => c.method === "onDuplicateKeyUpdate"),
    "createGuildWarsRegistration must use a plain insert — no onDuplicateKeyUpdate",
  );
});

// ── Operation-sequence tests ───────────────────────────────────────────────

test("addGroupReaction: delete fires before insert (not upsert)", async () => {
  const db = new MockDb(
    { affectedRows: 0 },        // delete result
    [{ insertId: 42 }],         // insert result
    [{                          // select result for the fetch-after-insert
      id: 42, roundId: 1, scoreId: 2, userId: 3,
      emoji: "🔥", createdAt: new Date(),
    }],
  );
  await addGroupReaction(db, 1, 2, 3, "🔥");
  assert.equal(db.ops[0].op, "delete", "First operation must be delete");
  assert.equal(db.ops[1].op, "insert", "Second operation must be insert");
  assert.ok(
    !db.ops[1].recorder.calls.some(c => c.method === "onDuplicateKeyUpdate"),
    "addGroupReaction insert must not use onDuplicateKeyUpdate",
  );
});

test("submitGroupRoundScore: returns existing score without inserting on duplicate", async () => {
  const existingRow = {
    id: 9, roundId: 1, userId: 2,
    score: 150, durationMs: 5000, completedAt: new Date(),
  };
  // Provide only one result — the check-existing select; if insert runs it will
  // consume a second result (which doesn't exist → fallback insertId:1 would
  // cause a subsequent select that has no row → crash or wrong result).
  // Cleanest proof: verify no insert op occurred at all.
  const db = new MockDb([existingRow]);
  const result = await submitGroupRoundScore(db, 1, 2, 200, 3000);
  assert.equal(result.score, 150, "Must return the existing score, not the new score 200");
  assert.equal(result.id, 9, "Must return the existing record id");
  assert.ok(
    !db.ops.some(o => o.op === "insert"),
    "Must not insert when a score for this (roundId, userId) already exists",
  );
});

// ── Computed-value tests ───────────────────────────────────────────────────

test("getDuelLeaderboard: winRate is an integer percentage (0-100)", async () => {
  const db = new MockDb(
    // First select: all rating rows (ordered by ELO desc in real code)
    [{ id: 1, userId: 42, elo: 1300, wins: 3, losses: 1, draws: 0, updatedAt: new Date() }],
    // Second select: matching user rows
    [{ id: 42, name: "Alice", avatarUrl: null }],
  );
  const result = await getDuelLeaderboard(db, 10);
  assert.equal(result.length, 1);
  // 3 wins / (3+1+0) total = 75%, not 0.75
  assert.equal(result[0].winRate, 75, "3/4 games = 75, not 0.75");
  assert.ok(Number.isInteger(result[0].winRate), "winRate must be an integer");
  assert.ok(
    result[0].winRate >= 0 && result[0].winRate <= 100,
    "winRate must be in the 0-100 range",
  );
});

test("getDuelLeaderboard: winRate is 0 when no games played", async () => {
  const db = new MockDb(
    [{ id: 1, userId: 99, elo: 1200, wins: 0, losses: 0, draws: 0, updatedAt: new Date() }],
    [{ id: 99, name: "Newbie", avatarUrl: null }],
  );
  const result = await getDuelLeaderboard(db, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].winRate, 0, "winRate must be 0 when no games have been played");
});

// Force exit after tests complete (avoids lingering async handles)
setTimeout(() => process.exit(process.exitCode ?? 0), 3000).unref();
