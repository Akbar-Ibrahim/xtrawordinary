/**
 * Seed script — populates the `word_categories` table from the Progressive Reveal data files.
 *
 * Usage (run from the project root):
 *
 *   Option A — inline env var:
 *     MYSQL_DATABASE_URL="mysql://user:pass@host:3306/dbname" npx tsx data/seed-words.ts
 *
 *   Option B — .env file (Node 20.6+):
 *     node --env-file=.env ./node_modules/.bin/tsx data/seed-words.ts
 *
 *   Option C — export first, then run:
 *     export MYSQL_DATABASE_URL="mysql://user:pass@host:3306/dbname"
 *     npx tsx data/seed-words.ts
 *
 * The script is idempotent — safe to run multiple times.
 * Existing rows are updated (subcategory + word_length) if the word already exists.
 */

import { config } from "dotenv";
import mysql, { ResultSetHeader } from "mysql2/promise";
import { fourLetterWords } from "./progressive-reveal-words-4";
import { fiveLetterWords } from "./progressive-reveal-words-5";
import { sixLetterWords } from "./progressive-reveal-words-6";
import { sevenLetterWords } from "./progressive-reveal-words-7";
import { eightLetterWords } from "./progressive-reveal-words-8";
import { nineLetterWords } from "./progressive-reveal-words-9";
import { tenLetterWords } from "./progressive-reveal-words-10";

config();

const DATABASE_URL = process.env.MYSQL_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: MYSQL_DATABASE_URL is not set.");
  process.exit(1);
}

const allWords = [
  ...fourLetterWords,
  ...fiveLetterWords,
  ...sixLetterWords,
  ...sevenLetterWords,
  ...eightLetterWords,
  ...nineLetterWords,
  ...tenLetterWords,
];

const BATCH_SIZE = 500;

async function seed() {
  const connection = await mysql.createConnection(DATABASE_URL!);
  console.log(`Connected to database. Seeding ${allWords.length} words…`);

  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
    const batch = allWords.slice(i, i + BATCH_SIZE);
    const values = batch.map((w) => [w.word, w.subcategory, w.word.length]);

    const placeholders = values.map(() => "(?, ?, ?)").join(", ");
    const flat = values.flat();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO word_categories (word, subcategory, word_length)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         subcategory = VALUES(subcategory),
         word_length = VALUES(word_length)`,
      flat
    );

    inserted += result.affectedRows - result.changedRows;
    updated += result.changedRows;

    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows processed`
    );
  }

  await connection.end();
  console.log(`\nDone! ${inserted} inserted, ${updated} updated.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
