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
  };
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
