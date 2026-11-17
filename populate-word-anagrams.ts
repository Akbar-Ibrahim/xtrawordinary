/**
 * Populate word_anagrams with bidirectional links between exact anagrams.
 *
 * A group is included when at least one of its words has is_anagram = 1.
 * Every distinct word in that exact-letter group is then linked to every
 * other word in the group, including a canonical word whose flag is 0.
 *
 * Safe by default: this script only reports what it would create.
 *
 * Usage:
 *   npx tsx ./populate-word-anagrams.ts
 *   npx tsx ./populate-word-anagrams.ts --apply
 *
 * Set DB_URL, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD in the environment
 * or in a local .env file before running it.
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getMySQLConnectionConfig } from "./server/mysql-config";

interface WordRow extends RowDataPacket {
  id: number;
  word: string;
}

interface WordPair {
  wordId: number;
  anagramId: number;
}

const READ_BATCH_SIZE = 1_000;
const INSERT_BATCH_SIZE = 500;

function parseApplyMode(args: string[]): boolean {
  const unknownArgs = args.filter((arg) => arg !== "--apply");
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }
  return args.includes("--apply");
}

function getLetterSignature(word: string): string | null {
  const normalized = word.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return null;
  return [...normalized].sort().join("");
}

async function* readWordBatches(
  connection: mysql.Connection,
  onlyAnagramFlagged: boolean,
): AsyncGenerator<WordRow[]> {
  let lastId = 0;
  const query = onlyAnagramFlagged
    ? `SELECT id, word
       FROM words
       WHERE is_anagram = 1 AND id > ?
       ORDER BY id
       LIMIT ?`
    : `SELECT id, word
       FROM words
       WHERE id > ?
       ORDER BY id
       LIMIT ?`;

  while (true) {
    const [rows] = await connection.execute<WordRow[]>(query, [lastId, READ_BATCH_SIZE]);
    if (rows.length === 0) return;

    yield rows;
    lastId = rows[rows.length - 1].id;
    if (rows.length < READ_BATCH_SIZE) return;
  }
}

async function findAnagramSignatures(
  connection: mysql.Connection,
): Promise<{ signatures: Set<string>; invalidFlaggedWords: number }> {
  const signatures = new Set<string>();
  let invalidFlaggedWords = 0;

  for await (const batch of readWordBatches(connection, true)) {
    for (const row of batch) {
      const signature = getLetterSignature(row.word);
      if (signature) signatures.add(signature);
      else invalidFlaggedWords += 1;
    }
  }

  return { signatures, invalidFlaggedWords };
}

async function collectAnagramGroups(
  connection: mysql.Connection,
  signatures: ReadonlySet<string>,
): Promise<Map<string, WordRow[]>> {
  const groups = new Map<string, WordRow[]>();

  for await (const batch of readWordBatches(connection, false)) {
    for (const row of batch) {
      const signature = getLetterSignature(row.word);
      if (!signature || !signatures.has(signature)) continue;

      const group = groups.get(signature);
      if (group) group.push(row);
      else groups.set(signature, [row]);
    }
  }

  for (const [signature, group] of groups) {
    if (group.length < 2) groups.delete(signature);
  }

  return groups;
}

function countDirectedLinks(groups: ReadonlyMap<string, WordRow[]>): number {
  let count = 0;
  for (const group of groups.values()) {
    count += group.length * (group.length - 1);
  }
  return count;
}

async function insertPairs(
  connection: mysql.Connection,
  pairs: WordPair[],
): Promise<number> {
  if (pairs.length === 0) return 0;

  const placeholders = pairs.map(() => "(?, ?)").join(", ");
  const values = pairs.flatMap(({ wordId, anagramId }) => [wordId, anagramId]);
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT IGNORE INTO word_anagrams (word_id, anagram_id)
     VALUES ${placeholders}`,
    values,
  );

  return result.affectedRows;
}

async function writeAnagramLinks(
  connection: mysql.Connection,
  groups: ReadonlyMap<string, WordRow[]>,
): Promise<number> {
  let insertedCount = 0;
  let pendingPairs: WordPair[] = [];

  const flush = async () => {
    insertedCount += await insertPairs(connection, pendingPairs);
    pendingPairs = [];
  };

  for (const group of groups.values()) {
    for (const word of group) {
      for (const anagram of group) {
        if (word.id === anagram.id) continue;
        pendingPairs.push({ wordId: word.id, anagramId: anagram.id });

        if (pendingPairs.length >= INSERT_BATCH_SIZE) {
          await flush();
        }
      }
    }
  }

  await flush();
  return insertedCount;
}

async function main(): Promise<void> {
  const applyChanges = parseApplyMode(process.argv.slice(2));
  const connection = await mysql.createConnection(getMySQLConnectionConfig());

  try {
    console.log("Connected to MySQL. Finding exact-letter anagram groups…");

    const { signatures, invalidFlaggedWords } = await findAnagramSignatures(connection);
    const groups = await collectAnagramGroups(connection, signatures);
    const expectedLinks = countDirectedLinks(groups);
    const groupedWords = [...groups.values()].reduce((total, group) => total + group.length, 0);

    console.log(`Anagram signatures found: ${signatures.size}`);
    console.log(`Words in linked groups: ${groupedWords}`);
    console.log(`Directed links represented by those groups: ${expectedLinks}`);
    if (invalidFlaggedWords > 0) {
      console.warn(
        `Skipped ${invalidFlaggedWords} is_anagram=1 word(s) that contain characters outside A-Z.`,
      );
    }

    if (!applyChanges) {
      console.log("Dry run only; no database rows were changed.");
      console.log("Run with --apply to insert missing bidirectional links.");
      return;
    }

    const insertedLinks = await writeAnagramLinks(connection, groups);
    console.log(
      `Done. Inserted ${insertedLinks} missing link(s); existing links were left unchanged.`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Word-anagram population failed: ${message}`);
  process.exitCode = 1;
});
