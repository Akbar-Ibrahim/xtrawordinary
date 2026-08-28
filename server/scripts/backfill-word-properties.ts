import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import { getMySQLConnectionConfig } from "../mysql-config";

const BATCH_SIZE = 500;
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function computeProperties(word: string) {
  const lower = word.toLowerCase();

  const wordLength = lower.length;

  let vowelCount = 0;
  let consonantCount = 0;
  const vowels: string[] = [];
  const consonants: string[] = [];
  for (const ch of lower) {
    if (ch >= "a" && ch <= "z") {
      if (VOWELS.has(ch)) { vowelCount++; vowels.push(ch); }
      else { consonantCount++; consonants.push(ch); }
    }
  }

  const letterCounts = new Map<string, number>();
  for (const ch of lower) {
    if (ch >= "a" && ch <= "z") {
      letterCounts.set(ch, (letterCounts.get(ch) ?? 0) + 1);
    }
  }
  const isIsogram = [...letterCounts.values()].every(count => count === 1);

  const lettersOnly = lower.replace(/[^a-z]/g, "");
  const isPalindrome = lettersOnly === lettersOnly.split("").reverse().join("");

  return { wordLength, vowelCount, consonantCount, isIsogram, isPalindrome, meta: { vowels, consonants } };
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

  while (offset < total) {
    const rows = await db
      .select({ id: schema.words.id, word: schema.words.word })
      .from(schema.words)
      .limit(BATCH_SIZE)
      .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      const props = computeProperties(row.word);
      await db
        .update(schema.words)
        .set({
          wordLength: props.wordLength,
          vowelCount: props.vowelCount,
          consonantCount: props.consonantCount,
          isIsogram: props.isIsogram,
          isPalindrome: props.isPalindrome,
          meta: props.meta,
        })
        .where(eq(schema.words.id, row.id));
    }

    processed += rows.length;
    offset += BATCH_SIZE;

    const pct = Math.round((processed / total) * 100);
    process.stdout.write(`\rProgress: ${processed} / ${total} (${pct}%)`);
  }

  console.log("\n\nDone! All word properties have been filled in.");
  await pool.end();
}

main().catch(err => {
  console.error("\nScript failed:", err);
  process.exit(1);
});
