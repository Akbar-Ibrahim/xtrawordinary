import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql, asc } from "drizzle-orm";
import * as schema from "../db-schema";
import { getMySQLConnectionConfig } from "../mysql-config";

const BATCH_SIZE = 500;

/**
 * Compute per-letter frequency counts for a word.
 * Returns a map of uppercase letter → count.
 * Only counts A-Z characters.
 */
function computeLetterFrequency(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of word.toUpperCase()) {
    if (ch >= "A" && ch <= "Z") {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
  }
  return counts;
}

async function main() {
  const pool = mysql.createPool(getMySQLConnectionConfig());
  const db = drizzle(pool, { schema, mode: "default" });

  console.log("Connected to database. Counting words...");

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(schema.words);

  console.log(`Found ${total} words to process.\n`);

  let offset = 0;
  let processed = 0;
  let rowsInserted = 0;

  while (offset < total) {
    // ORDER BY id ensures stable, deterministic pagination even if rows are modified during the run
    const rows = await db
      .select({ id: schema.words.id, word: schema.words.word })
      .from(schema.words)
      .orderBy(asc(schema.words.id))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (rows.length === 0) break;

    // Build all insert values for this batch
    const insertValues: { wordId: number; letter: string; frequency: number }[] = [];

    for (const row of rows) {
      const freq = computeLetterFrequency(row.word);
      for (const [letter, frequency] of freq) {
        insertValues.push({ wordId: row.id, letter, frequency });
      }
    }

    if (insertValues.length > 0) {
      // INSERT IGNORE is idempotent — silently skips rows where (word_id, letter) already exists
      const placeholders = insertValues.map(() => "(?, ?, ?)").join(", ");
      const values = insertValues.flatMap(v => [v.wordId, v.letter, v.frequency]);
      await pool.execute(
        `INSERT IGNORE INTO letter_frequency (word_id, letter, frequency) VALUES ${placeholders}`,
        values,
      );
      rowsInserted += insertValues.length;
    }

    processed += rows.length;
    offset += BATCH_SIZE;

    const pct = Math.round((processed / total) * 100);
    process.stdout.write(`\rProgress: ${processed} / ${total} (${pct}%)`);
  }

  console.log(`\n\nDone! Processed ${processed} words, attempted ${rowsInserted} letter_frequency row inserts.`);

  // Validation: compare word count vs coverage in letter_frequency
  const [{ wordCount }] = await db
    .select({ wordCount: sql<number>`COUNT(DISTINCT word_id)` })
    .from(schema.letterFrequency);
  console.log(`Validation: ${wordCount} / ${total} words have letter_frequency rows.`);

  await pool.end();
}

main().catch(err => {
  console.error("\nScript failed:", err);
  process.exit(1);
});
