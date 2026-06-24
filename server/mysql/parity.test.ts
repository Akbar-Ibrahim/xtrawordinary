/**
 * MySQL domain-file parity smoke tests.
 *
 * Mocks the `db` argument (recording Drizzle query chains) and asserts that
 * each domain function issues queries with the correct shape:
 *   – no spurious LIMIT clause
 *   – correct target table (via drizzle BaseName symbol)
 *   – correct ORDER BY column and direction (via drizzle queryChunks AST)
 *   – correct INSERT semantics (plain insert vs onDuplicateKeyUpdate)
 *   – correct computed return values
 *
 * No live MySQL connection is required; no server is started.
 *
 * Run:  npx tsx server/mysql/parity.test.ts
 *  or:  npm run test:mysql-parity
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
import { countWordsAtLetterPosition } from "./words.js";

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
 * Consumes results from a queue (FIFO); each top-level call pops the next
 * result.  A default fallback is used when the queue is exhausted.
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

// ── Assertion helpers ──────────────────────────────────────────────────────

/** True when the chain never called .limit() */
function noLimit(rec: ChainRecorder): boolean {
  return !rec.calls.some(c => c.method === "limit");
}

/**
 * Verify the FROM target matches the expected drizzle table name.
 * Drizzle exposes the SQL table name via Symbol.for("drizzle:BaseName").
 */
const DRIZZLE_TABLE_SYM = Symbol.for("drizzle:BaseName");
function fromTable(rec: ChainRecorder, tableName: string): boolean {
  const call = rec.calls.find(c => c.method === "from");
  if (!call) return false;
  return (call.args[0] as any)?.[DRIZZLE_TABLE_SYM] === tableName;
}

/**
 * Verify that orderBy was called with a drizzle `desc(col)` / `asc(col)` SQL
 * expression targeting the given column name.
 *
 * Drizzle SQL objects expose their AST via `queryChunks`:
 *   queryChunks[0] = { value: [""] }          (empty prefix)
 *   queryChunks[1] = { name: "col_name", … }  (the column)
 *   queryChunks[2] = { value: [" desc"] }     (direction keyword)
 */
function hasSortByColumn(
  rec: ChainRecorder,
  columnName: string,
  direction: "asc" | "desc",
): boolean {
  const call = rec.calls.find(c => c.method === "orderBy");
  if (!call) return false;
  const arg = call.args[0] as any;
  const chunks: any[] = arg?.queryChunks ?? [];
  const colChunk = chunks.find((c: any) => typeof c?.name === "string");
  const dirChunk = chunks.find(
    (c: any) =>
      Array.isArray(c?.value) &&
      typeof c.value[0] === "string" &&
      c.value[0].trim().length > 0,
  );
  return colChunk?.name === columnName && dirChunk?.value?.[0]?.trim() === direction;
}

/** Returns the ChainRecorder for the first "insert" op */
function firstInsert(db: MockDb): ChainRecorder {
  const op = db.ops.find(o => o.op === "insert");
  assert.ok(op, "Expected at least one insert operation");
  return op.recorder;
}

// ── No-limit + table-target + sort-order tests ─────────────────────────────

test("getAllUsers: no limit, targets users table, ordered by created_at desc", async () => {
  const db = new MockDb([]);
  await getAllUsers(db);
  const rec = db.ops[0].recorder;
  assert.ok(noLimit(rec),                               "must not apply a row limit");
  assert.ok(fromTable(rec, "users"),                    "must query the users table");
  assert.ok(hasSortByColumn(rec, "created_at", "desc"), "must order by created_at DESC");
});

test("getDuelChallengesForUser: no limit, targets duel_challenges table", async () => {
  const db = new MockDb([]);
  await getDuelChallengesForUser(db, 1);
  const rec = db.ops[0].recorder;
  assert.ok(noLimit(rec),                      "must not apply a row limit");
  assert.ok(fromTable(rec, "duel_challenges"), "must query the duel_challenges table");
});

test("getOpenDuelChallenges: no limit, targets duel_challenges table", async () => {
  const db = new MockDb([]);
  await getOpenDuelChallenges(db, 1);
  const rec = db.ops[0].recorder;
  assert.ok(noLimit(rec),                      "must not apply a row limit");
  assert.ok(fromTable(rec, "duel_challenges"), "must query the duel_challenges table");
});

test("getHuddleChallengesForGroup: no limit, targets huddle_challenges table", async () => {
  const db = new MockDb([]);
  await getHuddleChallengesForGroup(db, 1);
  const rec = db.ops[0].recorder;
  assert.ok(noLimit(rec),                         "must not apply a row limit");
  assert.ok(fromTable(rec, "huddle_challenges"),  "must query the huddle_challenges table");
});

test("getTeamRaceChallengesForGroup: no limit, targets team_race_challenges table", async () => {
  const db = new MockDb([]);
  await getTeamRaceChallengesForGroup(db, 1);
  const rec = db.ops[0].recorder;
  assert.ok(noLimit(rec),                              "must not apply a row limit");
  assert.ok(fromTable(rec, "team_race_challenges"),   "must query the team_race_challenges table");
});

test("listWordWarsTournaments: no limit, targets word_wars_tournaments, ordered by created_at desc", async () => {
  const db = new MockDb([]);
  await listWordWarsTournaments(db);
  const rec = db.ops[0].recorder;
  assert.ok(noLimit(rec),                               "must not apply a row limit");
  assert.ok(fromTable(rec, "word_wars_tournaments"),    "must query word_wars_tournaments");
  assert.ok(hasSortByColumn(rec, "created_at", "desc"), "must order by created_at DESC");
});

test("listGuildWarsTournaments: no limit, targets guild_wars_tournaments, ordered by created_at desc", async () => {
  const db = new MockDb([]);
  await listGuildWarsTournaments(db);
  const rec = db.ops[0].recorder;
  assert.ok(noLimit(rec),                               "must not apply a row limit");
  assert.ok(fromTable(rec, "guild_wars_tournaments"),   "must query guild_wars_tournaments");
  assert.ok(hasSortByColumn(rec, "created_at", "desc"), "must order by created_at DESC");
});

// ── Default-value test ─────────────────────────────────────────────────────

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
    "minPlayers must default to 2 when not provided",
  );
});

// ── Plain-insert (no upsert) tests ─────────────────────────────────────────

test("createWordWarsRegistration: plain insert into word_wars_registrations, no onDuplicateKeyUpdate", async () => {
  const db = new MockDb(
    [{ insertId: 5 }],
    [{ id: 5, tournamentId: 1, userId: 2, createdAt: new Date() }],
  );
  await createWordWarsRegistration(db, 1, 2);
  const rec = firstInsert(db);
  assert.ok(
    !rec.calls.some(c => c.method === "onDuplicateKeyUpdate"),
    "must be a plain insert — no onDuplicateKeyUpdate",
  );
});

test("createGuildWarsRegistration: plain insert into guild_wars_registrations, no onDuplicateKeyUpdate", async () => {
  const db = new MockDb(
    [{ insertId: 7 }],
    [{ id: 7, tournamentId: 1, groupId: 3, registeredBy: 4, createdAt: new Date() }],
  );
  await createGuildWarsRegistration(db, 1, 3, 4);
  const rec = firstInsert(db);
  assert.ok(
    !rec.calls.some(c => c.method === "onDuplicateKeyUpdate"),
    "must be a plain insert — no onDuplicateKeyUpdate",
  );
});

// ── Operation-sequence test ────────────────────────────────────────────────

test("addGroupReaction: delete fires before insert (not upsert)", async () => {
  const db = new MockDb(
    { affectedRows: 0 },        // delete result
    [{ insertId: 42 }],         // insert result
    [{                          // select for fetch-after-insert
      id: 42, roundId: 1, scoreId: 2, userId: 3,
      emoji: "🔥", createdAt: new Date(),
    }],
  );
  await addGroupReaction(db, 1, 2, 3, "🔥");
  assert.equal(db.ops[0].op, "delete", "first operation must be delete");
  assert.equal(db.ops[1].op, "insert", "second operation must be insert");
  assert.ok(
    !db.ops[1].recorder.calls.some(c => c.method === "onDuplicateKeyUpdate"),
    "insert must not use onDuplicateKeyUpdate",
  );
});

test("submitGroupRoundScore: returns existing score without inserting on duplicate", async () => {
  const existingRow = {
    id: 9, roundId: 1, userId: 2,
    score: 150, durationMs: 5000, completedAt: new Date(),
  };
  // Only one queued result — if insert fires it consumes the fallback and the
  // subsequent re-fetch returns [] causing a crash or wrong return value.
  const db = new MockDb([existingRow]);
  const result = await submitGroupRoundScore(db, 1, 2, 200, 3000);
  assert.equal(result.score, 150, "must return existing score (150), not the new score (200)");
  assert.equal(result.id, 9, "must return the existing record id");
  assert.ok(
    !db.ops.some(o => o.op === "insert"),
    "must not insert when a score for this (roundId, userId) already exists",
  );
});

// ── countWordsAtLetterPosition pure function ───────────────────────────────
// Validates the 1-based → 0-based position conversion that was the root cause
// of a prior regression in MySQLStorage.countLetterPositionWords.

test("countWordsAtLetterPosition: position=1 matches first character (0-based index 0)", () => {
  const words = new Set(["APPLE", "ANVIL", "BRAVE", "CRANE"]);
  // Position 1 = first letter.  Words starting with A: APPLE, ANVIL → 2
  const count = countWordsAtLetterPosition(words, "A", 1);
  assert.equal(count, 2, "position=1 must match words whose first letter is A");
});

test("countWordsAtLetterPosition: position=2 matches second character", () => {
  // BRAVE[1]=R, CRANE[1]=R, APPLE[1]=P, DANCE[1]=A  → 2 words with R at index 1
  const words = new Set(["BRAVE", "CRANE", "APPLE", "DANCE"]);
  const countR = countWordsAtLetterPosition(words, "R", 2);
  assert.equal(countR, 2, "position=2 must match words whose second letter is R");
});

test("countWordsAtLetterPosition: position=1 is NOT equivalent to position=2", () => {
  // Regression guard: the old bug used `w[position]` (0-based) instead of
  // `w[position - 1]` (1-based), meaning position=1 behaved like position=2.
  const words = new Set(["APPLE", "BRAVE"]);
  const atPos1 = countWordsAtLetterPosition(words, "A", 1); // APPLE → 1
  const atPos2 = countWordsAtLetterPosition(words, "A", 2); // none  → 0
  assert.equal(atPos1, 1, "position=1 should match APPLE (starts with A)");
  assert.equal(atPos2, 0, "position=2 should not match APPLE (second letter is P, not A)");
  assert.notEqual(atPos1, atPos2, "position=1 and position=2 must not be interchangeable");
});

test("countWordsAtLetterPosition: letter comparison is case-insensitive", () => {
  const words = new Set(["APPLE", "ANVIL"]);
  assert.equal(
    countWordsAtLetterPosition(words, "a", 1),
    countWordsAtLetterPosition(words, "A", 1),
    "lowercase and uppercase letter args must produce identical counts",
  );
});

// ── Computed-value tests ───────────────────────────────────────────────────

test("getDuelLeaderboard: winRate is an integer percentage (0-100)", async () => {
  const db = new MockDb(
    [{ id: 1, userId: 42, elo: 1300, wins: 3, losses: 1, draws: 0, updatedAt: new Date() }],
    [{ id: 42, name: "Alice", avatarUrl: null }],
  );
  const result = await getDuelLeaderboard(db, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].winRate, 75, "3/4 games = 75, not 0.75");
  assert.ok(Number.isInteger(result[0].winRate),                              "winRate must be an integer");
  assert.ok(result[0].winRate >= 0 && result[0].winRate <= 100,               "winRate must be in the 0-100 range");
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
