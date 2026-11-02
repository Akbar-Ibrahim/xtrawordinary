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
 *
 * Real-driver integration tests are opt-in via MYSQL_ACHIEVEMENT_TEST_URL.
 * They require loopback MySQL and a database name containing a standalone
 * "test" segment, and create/drop scratch databases.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

import { deleteUser, getAllUsers } from "./admin.js";
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
import {
  getGameBySlug,
  mapDbRowToGame,
  setGameCreatorId,
  setGameSimilarGameSlugs,
  updateGameConfig,
} from "./games.js";
import { saveUserAchievement } from "./stats.js";
import { getUserById, recordUserActivity } from "./users.js";
import { getCommentsPage as getMySqlCommentsPage, setCommentPinned as setMySqlCommentPinned } from "./comments.js";
import { MemStorage } from "../mem-storage";
import * as schema from "../db-schema";

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
  ignore(...a: unknown[])              { this.calls.push({ method: "ignore",              args: a }); return this; }
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

/**
 * Run an integration assertion against a uniquely named database on a
 * loopback-only test server. The configured base database is never modified.
 */
async function withDisposableMysqlDatabase(
  label: string,
  run: (pool: mysql.Pool) => Promise<void>,
): Promise<void> {
  const connectionUrl = new URL(process.env.MYSQL_ACHIEVEMENT_TEST_URL!);
  assert.equal(connectionUrl.protocol, "mysql:", "test URL must use the mysql:// protocol");
  assert.equal(connectionUrl.search, "", "test URL must not contain connection options");
  assert.equal(connectionUrl.hash, "", "test URL must not contain a fragment");

  const host = connectionUrl.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "integration tests are restricted to a loopback MySQL server",
  );

  const baseDatabase = decodeURIComponent(connectionUrl.pathname.replace(/^\/+/, ""));
  assert.match(baseDatabase, /^[a-zA-Z0-9_]+$/, "test database name must contain only letters, numbers, and underscores");
  assert.match(baseDatabase, /(^|_)test($|_)/i, "test database name must include a standalone 'test' segment");
  assert.doesNotMatch(baseDatabase, /prod|production|live/i, "test database name must not resemble production");
  assert.ok(connectionUrl.username, "test URL must include a MySQL username");

  const disposableDatabase = `${baseDatabase.slice(0, 18)}_${label}_${randomUUID().replaceAll("-", "")}`;
  const connectionConfig = {
    host,
    port: connectionUrl.port ? Number(connectionUrl.port) : 3306,
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    timezone: "Z" as const,
  };
  const adminPool = mysql.createPool({
    ...connectionConfig,
    database: baseDatabase,
    connectionLimit: 1,
  });

  let disposablePool: mysql.Pool | undefined;
  let databaseCreated = false;
  try {
    await adminPool.query(`CREATE DATABASE \`${disposableDatabase}\``);
    databaseCreated = true;
    disposablePool = mysql.createPool({
      ...connectionConfig,
      database: disposableDatabase,
      connectionLimit: 10,
    });
    await run(disposablePool);
  } finally {
    try {
      if (disposablePool) await disposablePool.end();
    } finally {
      try {
        if (databaseCreated) await adminPool.query(`DROP DATABASE \`${disposableDatabase}\``);
      } finally {
        await adminPool.end();
      }
    }
  }
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

test("mapDbRowToGame maps persisted standard-play config", () => {
  const gameRow = {
    id: 1,
    slug: "no-repeats",
    name: "No Repeats",
    description: "Description",
    longDescription: "Long description",
    rules: [],
    difficulty: "medium",
    estimatedTime: "2 minutes",
    icon: "Gamepad2",
    color: "#000000",
    playCount: 0,
    isActive: true,
    hasSurvival: false,
    modes: null,
    similarGameSlugs: null,
    timeLimitSeconds: 90,
    wordTarget: 12,
    livesCount: null,
    survivalSecondsPerWord: 8,
    creatorId: 17,
  };
  const game = mapDbRowToGame(gameRow);
  assert.equal(game.timeLimitSeconds, 90);
  assert.equal(game.wordTarget, 12);
  assert.equal(game.livesCount, undefined);
  assert.equal("survivalSecondsPerWord" in game, false);
  assert.equal(game.creatorId, 17);
  assert.equal(mapDbRowToGame({ ...gameRow, creatorId: null }).creatorId, null);
  assert.deepEqual(
    mapDbRowToGame({ ...gameRow, similarGameSlugs: ["word-maker"] }).similarGameSlugs,
    ["word-maker"],
  );
});

test("setGameCreatorId persists creator ownership and supports legacy unowned games", async () => {
  const assignDb = new MockDb();
  await setGameCreatorId(assignDb, "word-chain", 23);
  assert.deepEqual(
    assignDb.ops[0].recorder.calls.find(call => call.method === "set")?.args[0],
    { creatorId: 23 },
  );

  const clearDb = new MockDb();
  await setGameCreatorId(clearDb, "word-chain", null);
  assert.deepEqual(
    clearDb.ops[0].recorder.calls.find(call => call.method === "set")?.args[0],
    { creatorId: null },
  );
});

test("setGameSimilarGameSlugs persists the ordered recommendation list", async () => {
  const db = new MockDb();
  await setGameSimilarGameSlugs(db, "word-sweep", ["word-maker", "word-split"]);
  const setCall = db.ops[0].recorder.calls.find((call) => call.method === "set");
  assert.deepEqual(setCall?.args[0], { similarGameSlugs: ["word-maker", "word-split"] });
});

test("updateGameConfig persists only standard-play config fields", async () => {
  const db = new MockDb();
  await updateGameConfig(db, "word-fusion", {
    timeLimitSeconds: 120,
    wordTarget: 7,
  });
  const setCall = db.ops[0].recorder.calls.find(call => call.method === "set");
  assert.deepEqual(setCall?.args[0], {
    timeLimitSeconds: 120,
    wordTarget: 7,
  });
});

test("saveUserAchievement reports a new MySQL insert and ignores a duplicate", async () => {
  const unlockedAt = "2026-10-21T12:00:00.000Z";
  const savedRow = {
    id: 42,
    userId: 7,
    achievementId: "games_bronze",
    unlockedAt: new Date(unlockedAt),
  };
  const firstDb = new MockDb([{ affectedRows: 1 }], [savedRow]);
  const first = await saveUserAchievement(firstDb, 7, "games_bronze", unlockedAt);

  assert.equal(first.newlyEarned, true, "an affected row means the achievement is new");
  assert.equal(first.id, savedRow.id);
  assert.equal(first.userId, savedRow.userId);
  assert.equal(first.achievementId, savedRow.achievementId);
  assert.ok(firstInsert(firstDb).calls.some(call => call.method === "ignore"), "must use INSERT IGNORE");
  assert.ok(fromTable(firstDb.ops.find(op => op.op === "select")!.recorder, "user_achievements"));

  const duplicateDb = new MockDb([{ affectedRows: 0 }], [savedRow]);
  const duplicate = await saveUserAchievement(duplicateDb, 7, "games_bronze", unlockedAt);

  assert.equal(duplicate.newlyEarned, false, "an ignored duplicate must not be considered new");
  assert.equal(duplicate.id, savedRow.id, "must return the already-saved achievement");
  assert.ok(firstInsert(duplicateDb).calls.some(call => call.method === "ignore"), "duplicate attempts must also use INSERT IGNORE");
});

test("saveUserAchievement reports concurrent duplicate inserts using the MySQL2 driver", {
  skip: !process.env.MYSQL_ACHIEVEMENT_TEST_URL,
}, async () => {
  await withDisposableMysqlDatabase("achievement", async disposablePool => {
    await disposablePool.query(`
      CREATE TABLE user_achievements (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        achievement_id VARCHAR(100) NOT NULL,
        unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY ua_user_achievement_idx (user_id, achievement_id),
        KEY ua_user_id_idx (user_id)
      ) ENGINE=InnoDB
    `);

    const db = drizzle(disposablePool, { schema, mode: "default" });
    const unlockedAt = "2026-10-21T12:00:00.000Z";
    const first = await saveUserAchievement(db, 7, "games_bronze", unlockedAt);
    assert.equal(first.newlyEarned, true, "the first insert must be reported as new");

    const concurrentDuplicates = await Promise.all(
      Array.from({ length: 8 }, () => saveUserAchievement(db, 7, "games_bronze", unlockedAt)),
    );
    assert.ok(
      concurrentDuplicates.every(result => result.newlyEarned === false),
      "all concurrent duplicate inserts must be reported as existing",
    );
    assert.ok(
      concurrentDuplicates.every(result => result.id === first.id),
      "all duplicate attempts must return the original achievement row",
    );

    const rows = await db.select().from(schema.userAchievements);
    assert.equal(rows.length, 1, "concurrent duplicate attempts must leave one achievement row");
  });
});

test("recordUserActivity preserves the UTC instant through the MySQL2 driver", {
  skip: !process.env.MYSQL_ACHIEVEMENT_TEST_URL,
}, async () => {
  await withDisposableMysqlDatabase("activity", async disposablePool => {
    await disposablePool.query(`
      CREATE TABLE users (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(20) NOT NULL,
        username_normalized VARCHAR(20) NOT NULL UNIQUE,
        password_hash TEXT NULL,
        google_id VARCHAR(255) NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        avatar_url TEXT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_banned BOOLEAN NOT NULL DEFAULT FALSE,
        is_premium BOOLEAN NOT NULL DEFAULT FALSE,
        bio TEXT NULL,
        hide_activity BOOLEAN NOT NULL DEFAULT FALSE,
        last_active_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    const [insertResult] = await disposablePool.query(
      `INSERT INTO users (email, name, username, username_normalized)
       VALUES (?, ?, ?, ?)`,
      ["mysql-activity@example.test", "Activity test", "activity-test", "activity-test"],
    );
    const userId = (insertResult as mysql.ResultSetHeader).insertId;
    const db = drizzle(disposablePool, { schema, mode: "default" });
    const activityAt = "2026-10-22T18:42:13.000Z";

    await recordUserActivity(db, userId, activityAt);

    const user = await getUserById(db, userId);
    assert.equal(
      user?.lastActiveAt,
      activityAt,
      "the MySQL timestamp column and configured driver must preserve the UTC instant at seconds precision",
    );
  });
});

test("game creator migration preserves legacy ownership and clears deleted creators using MySQL", {
  skip: !process.env.MYSQL_ACHIEVEMENT_TEST_URL,
}, async () => {
  await withDisposableMysqlDatabase("game_creators", async disposablePool => {
    await disposablePool.query(`
      CREATE TABLE users (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY
      ) ENGINE=InnoDB
    `);
    await disposablePool.query(`
      CREATE TABLE games (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        long_description TEXT NOT NULL,
        rules JSON NOT NULL,
        difficulty VARCHAR(20) NOT NULL,
        estimated_time VARCHAR(50) NOT NULL,
        icon VARCHAR(100) NOT NULL,
        color VARCHAR(100) NOT NULL,
        play_count INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        has_survival BOOLEAN NOT NULL DEFAULT FALSE,
        modes JSON NULL,
        time_limit_seconds INT NULL,
        word_target INT NULL,
        lives_count INT NULL,
        survival_seconds_per_word INT NULL
      ) ENGINE=InnoDB
    `);
    await disposablePool.query(`
      INSERT INTO games
        (slug, name, description, long_description, rules, difficulty, estimated_time, icon, color)
      VALUES
        ('legacy-game', 'Legacy Game', 'Description', 'Long description', JSON_ARRAY(), 'medium', '2 minutes', 'Gamepad2', '#000000')
    `);

    const migration = await readFile(
      new URL("../../migrations/20261026_add_game_creators.sql", import.meta.url),
      "utf8",
    );
    await disposablePool.query(migration);

    // deleteUser removes the user's related rows before deleting the account.
    // Keep these cleanup targets minimal; the creator FK is the behavior under test.
    const cleanupTables = [
      ["leaderboard_entries", "user_id INT NOT NULL"],
      ["user_achievements", "user_id INT NOT NULL"],
      ["user_streaks", "user_id INT NOT NULL"],
      ["user_game_stats", "user_id INT NOT NULL"],
      ["friendships", "requester_id INT NOT NULL, addressee_id INT NOT NULL"],
      ["user_blocks", "blocker_id INT NOT NULL, blocked_user_id INT NOT NULL"],
      ["friend_challenges", "sender_id INT NOT NULL, receiver_id INT NOT NULL"],
      ["notifications", "user_id INT NOT NULL"],
      ["comments", "user_id INT NOT NULL"],
      ["likes", "user_id INT NOT NULL"],
      ["notification_preferences", "user_id INT NOT NULL"],
      ["email_verification_tokens", "user_id INT NOT NULL"],
      ["password_reset_tokens", "user_id INT NOT NULL"],
    ] as const;
    for (const [table, columns] of cleanupTables) {
      await disposablePool.query(
        `CREATE TABLE \`${table}\` (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, ${columns}) ENGINE=InnoDB`,
      );
    }

    const [userInsert] = await disposablePool.query("INSERT INTO users () VALUES ()");
    const creatorId = (userInsert as mysql.ResultSetHeader).insertId;
    const db = drizzle(disposablePool, { schema, mode: "default" });

    const legacyGame = await getGameBySlug(db, "legacy-game");
    assert.equal(legacyGame?.creatorId, null, "pre-existing games must remain unowned after migration");
    assert.notEqual(legacyGame?.creatorId, creatorId, "legacy games must not gain a non-admin owner");

    await setGameCreatorId(db, "legacy-game", creatorId);
    assert.equal(
      (await getGameBySlug(db, "legacy-game"))?.creatorId,
      creatorId,
      "assigning a creator must persist through the MySQL driver",
    );

    await setGameCreatorId(db, "legacy-game", null);
    assert.equal(
      (await getGameBySlug(db, "legacy-game"))?.creatorId,
      null,
      "clearing a creator must persist through the MySQL driver",
    );

    await setGameCreatorId(db, "legacy-game", creatorId);
    await deleteUser(db, creatorId);
    assert.equal(
      (await getGameBySlug(db, "legacy-game"))?.creatorId,
      null,
      "deleting the creator through the account-removal path must leave the game unowned",
    );
    const [remainingUsers] = await disposablePool.query("SELECT id FROM users");
    assert.equal((remainingUsers as unknown[]).length, 0, "creator deletion must complete successfully");
  });
});

test("commenter filtering and reply context match between MySQL and memory", {
  skip: !process.env.MYSQL_ACHIEVEMENT_TEST_URL,
}, async () => {
  await withDisposableMysqlDatabase("comments", async disposablePool => {
    await disposablePool.query(`
      CREATE TABLE users (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(20) NOT NULL,
        avatar_url TEXT NULL
      ) ENGINE=InnoDB
    `);
    await disposablePool.query(`
      CREATE TABLE comments (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        target_type VARCHAR(20) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        user_id INT NOT NULL,
        parent_id INT NULL,
        content TEXT NOT NULL,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NULL
      ) ENGINE=InnoDB
    `);
    await disposablePool.query(`
      CREATE TABLE likes (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const db = drizzle(disposablePool, { schema, mode: "default" });
    const memory = new MemStorage();
    const selectedUser = await memory.createUser({
      email: "comment-selected@example.test",
      name: "Selected Commenter",
      username: "selected",
      usernameNormalized: "selected",
      passwordHash: null,
      googleId: null,
      emailVerified: true,
      avatarUrl: null,
      isAdmin: false,
      isBanned: false,
      isPremium: false,
    });
    const otherUser = await memory.createUser({
      email: "comment-other@example.test",
      name: "Other Commenter",
      username: "other",
      usernameNormalized: "other",
      passwordHash: null,
      googleId: null,
      emailVerified: true,
      avatarUrl: null,
      isAdmin: false,
      isBanned: false,
      isPremium: false,
    });
    await disposablePool.query(
      `INSERT INTO users (id, name, username) VALUES
        (?, ?, ?), (?, ?, ?)`,
      [selectedUser.id, selectedUser.name, selectedUser.username, otherUser.id, otherUser.name, otherUser.username],
    );

    const targetId = "commenter-filter-parity";
    const rows = [
      { userId: otherUser.id, parentId: null, content: "Parent by another commenter" },
      { userId: selectedUser.id, parentId: 1, content: "The comet phrase appears in selected reply" },
      { userId: otherUser.id, parentId: 1, content: "A context reply that matches neither filter" },
      { userId: selectedUser.id, parentId: null, content: "Top-level selected commenter mentions bright star" },
      { userId: otherUser.id, parentId: 4, content: "Another unmatched reply remains in context" },
      { userId: otherUser.id, parentId: null, content: "Unmatched thread discusses comet too" },
      { userId: selectedUser.id, parentId: 6, content: "Selected commenter reply to the pinned comment" },
      { userId: otherUser.id, parentId: 6, content: "Another reply to the pinned comment" },
      { userId: selectedUser.id, parentId: null, content: "Selected author mentions quiet moon" },
    ];

    for (const row of rows) {
      await memory.createComment({
        targetType: "game",
        targetId,
        userId: row.userId,
        parentId: row.parentId,
        content: row.content,
      });
    }
    for (const [index, row] of rows.entries()) {
      await disposablePool.query(
        `INSERT INTO comments
          (id, target_type, target_id, user_id, parent_id, content, created_at)
         VALUES (?, 'game', ?, ?, ?, ?, ?)`,
        [
          index + 1,
          targetId,
          row.userId,
          row.parentId,
          row.content,
          new Date(Date.UTC(2026, 0, 1, 0, 0, index + 1)),
        ],
      );
    }
    assert.ok(await memory.setCommentPinned(6, "game", targetId, true));
    assert.ok(await setMySqlCommentPinned(db, 6, "game", targetId, true));

    const summarizeComment = (comment: any) => ({
      id: comment.id,
      userId: comment.userId,
      parentId: comment.parentId,
      content: comment.content,
      isDeleted: comment.isDeleted,
      replies: (comment.replies ?? []).map(summarizeComment),
    });
    const summarizePage = (result: Awaited<ReturnType<typeof memory.getCommentsPage>>) => ({
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      commenters: result.commenters?.map(({ id, name, username, avatarUrl }) => ({ id, name, username, avatarUrl })),
      pinnedComment: result.pinnedComment ? summarizeComment(result.pinnedComment) : null,
      comments: result.comments.map(summarizeComment),
    });
    const compareCase = async (
      label: string,
      page: number,
      searchTerm?: string,
    ) => {
      const memoryResult = await memory.getCommentsPage(
        "game", targetId, undefined, page, 1, "oldest", searchTerm, selectedUser.id,
      );
      const mysqlResult = await getMySqlCommentsPage(
        db, "game", targetId, undefined, page, 1, "oldest", searchTerm, selectedUser.id,
      );
      assert.deepEqual(
        summarizePage(mysqlResult),
        summarizePage(memoryResult),
        label,
      );
      return summarizePage(mysqlResult);
    };

    const firstPage = await compareCase("commenter-only page one preserves full reply context", 1);
    const secondPage = await compareCase("commenter-only page two preserves full reply context", 2);
    const thirdPage = await compareCase("commenter-only final page has the same boundary", 3);
    assert.equal(firstPage.totalCount, 4, "count matching comments, not matching threads");
    assert.equal(firstPage.hasMore, true);
    assert.equal(firstPage.pinnedComment?.id, 6, "the pinned comment by another commenter stays in the separate pinned section");
    assert.equal(firstPage.pinnedComment?.userId, otherUser.id, "the pinned comment is authored by someone other than the filtered commenter");
    assert.deepEqual(
      firstPage.pinnedComment?.replies.map(reply => reply.id),
      [7, 8],
      "the pinned comment retains its complete reply context despite the commenter filter",
    );
    assert.ok(
      !firstPage.comments.some(comment =>
        [6, 7, 8].includes(comment.id) || comment.replies.some(reply => [6, 7, 8].includes(reply.id))),
      "the pinned comment and its replies must not appear in the regular filtered comments",
    );
    assert.equal(secondPage.hasMore, true);
    assert.equal(thirdPage.hasMore, false);
    assert.deepEqual(firstPage.comments.map(comment => comment.id), [1]);
    assert.deepEqual(firstPage.comments[0].replies.map(reply => reply.id), [2, 3]);
    assert.deepEqual(secondPage.comments.map(comment => comment.id), [4]);
    assert.deepEqual(secondPage.comments[0].replies.map(reply => reply.id), [5]);
    assert.deepEqual(thirdPage.comments.map(comment => comment.id), [9]);

    const combinedMatch = await compareCase("combined commenter and case-insensitive text search", 1, "COMET PHRASE");
    assert.equal(combinedMatch.totalCount, 1, "search and commenter conditions must both match");
    assert.equal(combinedMatch.hasMore, false);
    assert.deepEqual(combinedMatch.comments.map(comment => comment.id), [1]);
    assert.deepEqual(
      combinedMatch.comments[0].replies.map(reply => reply.id),
      [2, 3],
      "search results must retain all replies in the matching thread",
    );

    const combinedNonMatch = await compareCase("combined filters exclude another author's text match", 1, "unmatched thread");
    assert.equal(combinedNonMatch.totalCount, 0);
    assert.equal(combinedNonMatch.hasMore, false);
    assert.deepEqual(combinedNonMatch.comments, []);
  });
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
