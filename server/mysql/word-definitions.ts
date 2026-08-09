import { eq, asc, sql } from "drizzle-orm";
import type { PartOfSpeech, InsertPartOfSpeech, WordDefinition, InsertWordDefinition } from "@shared/schema";
import * as schema from "../db-schema";

const STANDARD_POS = [
  "noun", "verb", "adjective", "adverb", "pronoun",
  "preposition", "conjunction", "interjection", "article", "determiner",
];

export async function seedPartsOfSpeech(db: any): Promise<void> {
  for (const name of STANDARD_POS) {
    await db
      .insert(schema.partsOfSpeech)
      .values({ name })
      .onDuplicateKeyUpdate({ set: { name } });
  }
}

export async function listPartsOfSpeech(db: any): Promise<PartOfSpeech[]> {
  const rows = await db
    .select()
    .from(schema.partsOfSpeech)
    .orderBy(asc(schema.partsOfSpeech.name));
  return rows.map((r: any) => ({ id: r.id, name: r.name }));
}

export async function getPartOfSpeech(db: any, id: number): Promise<PartOfSpeech | undefined> {
  const rows = await db
    .select()
    .from(schema.partsOfSpeech)
    .where(eq(schema.partsOfSpeech.id, id))
    .limit(1);
  if (rows.length === 0) return undefined;
  return { id: rows[0].id, name: rows[0].name };
}

export async function getWordDefinitions(db: any, wordId: number): Promise<WordDefinition[]> {
  const rows = await db
    .select()
    .from(schema.wordDefinitions)
    .where(eq(schema.wordDefinitions.wordId, wordId))
    .orderBy(asc(schema.wordDefinitions.sortOrder));
  return rows.map((r: any) => ({
    id: r.id,
    wordId: r.wordId,
    partOfSpeechId: r.partOfSpeechId,
    definition: r.definition,
    sortOrder: r.sortOrder,
  }));
}

export async function addWordDefinition(db: any, def: InsertWordDefinition): Promise<WordDefinition> {
  const result = await db
    .insert(schema.wordDefinitions)
    .values({
      wordId: def.wordId,
      partOfSpeechId: def.partOfSpeechId,
      definition: def.definition,
      sortOrder: def.sortOrder,
    });
  const insertId = result[0].insertId;
  return {
    id: insertId,
    wordId: def.wordId,
    partOfSpeechId: def.partOfSpeechId,
    definition: def.definition,
    sortOrder: def.sortOrder,
  };
}

export async function deleteWordDefinition(db: any, id: number): Promise<void> {
  await db.delete(schema.wordDefinitions).where(eq(schema.wordDefinitions.id, id));
}
