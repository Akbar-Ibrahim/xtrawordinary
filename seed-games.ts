import "dotenv/config";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { gamesData } from "./server/game-data";
import { getMySQLConnectionConfig } from "./server/mysql-config";

type CatalogGame = (typeof gamesData)[number];

interface SeededGameRow extends RowDataPacket {
  slug: string;
  modes: unknown;
  has_survival: unknown;
}

const INSERT_GAME_SQL = `
  INSERT INTO games (
    slug,
    name,
    description,
    long_description,
    rules,
    difficulty,
    estimated_time,
    icon,
    color,
    play_count,
    is_active,
    has_survival,
    modes,
    time_limit_seconds,
    word_target,
    lives_count
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    long_description = VALUES(long_description),
    rules = VALUES(rules),
    difficulty = VALUES(difficulty),
    estimated_time = VALUES(estimated_time),
    icon = VALUES(icon),
    color = VALUES(color),
    has_survival = VALUES(has_survival),
    modes = VALUES(modes)
`;

function validateCatalog(games: readonly CatalogGame[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const game of games) {
    if (seen.has(game.slug)) duplicates.add(game.slug);
    seen.add(game.slug);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate game slugs in server/game-data.ts: ${[...duplicates].join(", ")}`);
  }

  if (!seen.has("spoken-word-transformations")) {
    throw new Error("Spoken Word Transformations is missing from the game catalogue.");
  }
}

function getInsertValues(game: CatalogGame): unknown[] {
  return [
    game.slug,
    game.name,
    game.description,
    game.longDescription,
    JSON.stringify(game.rules),
    game.difficulty,
    game.estimatedTime,
    game.icon,
    game.color,
    game.isActive ?? true,
    game.hasSurvival ?? false,
    game.modes ? JSON.stringify(game.modes) : null,
    game.timeLimitSeconds ?? null,
    game.wordTarget ?? null,
    game.livesCount ?? null,
  ];
}

function parseDatabaseJson(value: unknown): unknown {
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("The database returned invalid JSON in games.modes.");
  }
}

function modesMatch(actualValue: unknown, expected: CatalogGame["modes"]): boolean {
  const actual = parseDatabaseJson(actualValue);
  if (expected == null) return actual == null;
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;

  return actual.every((entry, index) =>
    entry !== null &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    (entry as Record<string, unknown>).label === expected[index].label &&
    (entry as Record<string, unknown>).slug === expected[index].slug
  );
}

function hasSurvivalEnabled(value: unknown): boolean {
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  return value === true || value === 1 || value === "1";
}

function printDryRun(games: readonly CatalogGame[], replace: boolean): void {
  console.log(`Dry run: ${replace ? "replace" : "upsert"} ${games.length} catalogue games.`);
  for (const game of games) {
    const modes = game.modes?.map(({ slug }) => slug).join(", ") || "no variant modes";
    console.log(`- ${game.slug}: ${game.name} [${modes}]`);
  }
}

async function seedGames(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const replace = args.has("--replace");
  const unknownArgs = [...args].filter((arg) => arg !== "--dry-run" && arg !== "--replace");

  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }
  validateCatalog(gamesData);
  if (dryRun) {
    printDryRun(gamesData, replace);
    return;
  }

  const connection = await mysql.createConnection(getMySQLConnectionConfig());
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    if (replace) {
      await connection.execute("DELETE FROM games");
    }

    for (const game of gamesData) {
      await connection.execute(INSERT_GAME_SQL, getInsertValues(game));
    }

    const slugs = gamesData.map(({ slug }) => slug);
    const placeholders = slugs.map(() => "?").join(", ");
    const [rows] = await connection.execute<SeededGameRow[]>(
      `SELECT slug, modes, has_survival
       FROM games
       WHERE slug IN (${placeholders})`,
      slugs,
    );
    const rowsBySlug = new Map(rows.map((row) => [row.slug, row]));
    const failedGames = gamesData.filter((game) => {
      const row = rowsBySlug.get(game.slug);
      return !row ||
        !modesMatch(row.modes, game.modes) ||
        hasSurvivalEnabled(row.has_survival) !== (game.hasSurvival ?? false);
    });

    if (failedGames.length > 0) {
      throw new Error(
        `Seed verification failed for: ${failedGames.map(({ slug }) => slug).join(", ")}`,
      );
    }

    await connection.commit();
    transactionStarted = false;
    console.log(
      `${gamesData.length} catalogue games are present and verified. Existing play counts and admin settings were preserved.`,
    );
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

seedGames().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Game catalogue seed failed: ${message}`);
  process.exitCode = 1;
});
