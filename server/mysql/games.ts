import { eq, sql } from "drizzle-orm";
import type { Game, GameMode } from "@shared/schema";
import * as schema from "../db-schema";

export function mapDbRowToGame(row: typeof schema.games.$inferSelect): Game {
  let rules: string[];
  if (typeof row.rules === "string") {
    rules = JSON.parse(row.rules);
  } else if (Array.isArray(row.rules)) {
    rules = row.rules;
  } else {
    rules = [];
  }
  const validDifficulties = ["easy", "medium", "hard"] as const;
  const difficulty = validDifficulties.includes(row.difficulty as any)
    ? (row.difficulty as Game["difficulty"])
    : "medium";
  let modes: GameMode[] | undefined;
  if (typeof row.modes === "string") {
    modes = JSON.parse(row.modes);
  } else if (Array.isArray(row.modes)) {
    modes = row.modes;
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    longDescription: row.longDescription,
    rules,
    difficulty,
    estimatedTime: row.estimatedTime,
    icon: row.icon,
    color: row.color,
    playCount: row.playCount,
    isActive: row.isActive,
    hasSurvival: row.hasSurvival,
    ...(modes && modes.length > 0 ? { modes } : {}),
    ...(row.timeLimitSeconds != null ? { timeLimitSeconds: row.timeLimitSeconds } : {}),
    ...(row.wordTarget != null ? { wordTarget: row.wordTarget } : {}),
    ...(row.livesCount != null ? { livesCount: row.livesCount } : {}),
    ...(row.survivalSecondsPerWord != null ? { survivalSecondsPerWord: row.survivalSecondsPerWord } : {}),
  };
}

export async function updateGameConfig(db: any, slug: string, config: { timeLimitSeconds?: number | null; wordTarget?: number | null; livesCount?: number | null; survivalSecondsPerWord?: number | null }): Promise<void> {
  const updateData: Record<string, number | null> = {};
  if ("timeLimitSeconds" in config) updateData.timeLimitSeconds = config.timeLimitSeconds ?? null;
  if ("wordTarget" in config) updateData.wordTarget = config.wordTarget ?? null;
  if ("livesCount" in config) updateData.livesCount = config.livesCount ?? null;
  if ("survivalSecondsPerWord" in config) updateData.survivalSecondsPerWord = config.survivalSecondsPerWord ?? null;
  if (Object.keys(updateData).length > 0) {
    await db.update(schema.games).set(updateData).where(eq(schema.games.slug, slug));
  }
}

export async function getGames(db: any): Promise<Game[]> {
  const rows = await db.select().from(schema.games).where(eq(schema.games.isActive, true));
  return rows.map((row: typeof schema.games.$inferSelect) => mapDbRowToGame(row));
}

export async function getAllGames(db: any): Promise<Game[]> {
  const rows = await db.select().from(schema.games);
  return rows.map((row: typeof schema.games.$inferSelect) => mapDbRowToGame(row));
}

export async function setGameActive(db: any, slug: string, isActive: boolean): Promise<void> {
  await db.update(schema.games).set({ isActive }).where(eq(schema.games.slug, slug));
}

export async function getGameBySlug(db: any, slug: string): Promise<Game | undefined> {
  const rows = await db.select().from(schema.games).where(eq(schema.games.slug, slug));
  if (rows.length === 0) return undefined;
  return mapDbRowToGame(rows[0]);
}

export async function backfillGameConfigFromSeed(db: any): Promise<void> {
  const { gamesData } = await import("../game-data");

  // Idempotent upsert for newly added games that may not yet exist in the DB.
  // Each entry here is targeted and explicit; failures are surfaced, not swallowed.
  const newGames = gamesData.filter((g: any) => NEW_GAME_SLUGS.has(g.slug));
  for (const g of newGames) {
    await db.execute(sql`
      INSERT INTO games
        (id, slug, name, description, long_description, rules, difficulty, estimated_time, icon, color, play_count, is_active, has_survival, time_limit_seconds)
      VALUES
        (${g.id}, ${g.slug}, ${g.name}, ${g.description ?? ""}, ${g.longDescription ?? ""},
         ${JSON.stringify(g.rules ?? [])}, ${g.difficulty ?? "medium"}, ${g.estimatedTime ?? ""},
         ${g.icon ?? ""}, ${g.color ?? ""}, 0, 1, 0, ${g.timeLimitSeconds ?? null})
      ON DUPLICATE KEY UPDATE
        name            = VALUES(name),
        time_limit_seconds = COALESCE(time_limit_seconds, VALUES(time_limit_seconds))
    `);
  }

  // Back-fill numeric config columns for existing games (COALESCE preserves admin overrides).
  const configGames = gamesData.filter(
    (g: any) => g.timeLimitSeconds != null || g.wordTarget != null || g.livesCount != null
  );
  for (const g of configGames) {
    const updates: Record<string, any> = {};
    if (g.timeLimitSeconds != null)
      updates.timeLimitSeconds = sql`COALESCE(${schema.games.timeLimitSeconds}, ${g.timeLimitSeconds})`;
    if (g.wordTarget != null)
      updates.wordTarget = sql`COALESCE(${schema.games.wordTarget}, ${g.wordTarget})`;
    if (g.livesCount != null)
      updates.livesCount = sql`COALESCE(${schema.games.livesCount}, ${g.livesCount})`;
    if (Object.keys(updates).length > 0) {
      await db.update(schema.games).set(updates).where(eq(schema.games.slug, g.slug));
    }
  }
}

/** Slugs for games added after the initial DB seed; these receive an explicit upsert on startup. */
const NEW_GAME_SLUGS = new Set(["word-extension", "word-fusion"]);
