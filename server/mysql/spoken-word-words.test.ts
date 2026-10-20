import assert from "node:assert/strict";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  getSpokenWordWords,
  SPOKEN_WORD_FREQUENCY_LEVELS,
} from "./spoken-word";

function createFakeDb(rows: Array<{ id: number; word: string }>) {
  const state: {
    limit?: number;
    orderBy?: unknown[];
    where?: unknown;
  } = {};

  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          state.where = condition;
          return {
            orderBy: (...orders: unknown[]) => {
              state.orderBy = orders;
              return {
                limit: async (limit: number) => {
                  state.limit = limit;
                  return rows.slice(0, limit);
                },
              };
            },
          };
        },
      }),
    }),
  };

  return { db, state };
}

const eligibleWords = [
  "able", "about", "above", "accept", "across",
  "active", "actor", "admit", "adopt", "adult",
].map((word, index) => ({ id: index + 1, word: word.toUpperCase() }));

assert.deepEqual(
  SPOKEN_WORD_FREQUENCY_LEVELS,
  ["high", "very_high", "medium", "medium_high", "medium_low"],
);

{
  const { db, state } = createFakeDb(eligibleWords);
  const words = await getSpokenWordWords(db);
  assert.deepEqual(words, eligibleWords.map(({ word }) => word.toLowerCase()));
  assert.equal(state.limit, 10);
  assert.ok(state.where, "the database query should apply its filters");
  assert.ok(state.orderBy?.length, "the database query should order its results");
  const dialect = new MySqlDialect();
  const filters = dialect.sqlToQuery(state.where as any);
  assert.deepEqual(filters.params.slice(0, 5), SPOKEN_WORD_FREQUENCY_LEVELS);
  assert.ok(filters.sql.includes("word_length` between"), "database words should remain within the game’s length rules");
  assert.equal(dialect.sqlToQuery(state.orderBy?.[0] as any).sql, "RAND()");
}

{
  const seed = 7123;
  const { db, state } = createFakeDb(eligibleWords);
  await getSpokenWordWords(db, seed);
  const seededOrder = new MySqlDialect().sqlToQuery(state.orderBy?.[0] as any);
  assert.ok(seededOrder.sql.includes("CRC32"), "seeded play should use a stable database ordering");
  assert.deepEqual(seededOrder.params, [seed]);
}

{
  const { db } = createFakeDb([]);
  assert.deepEqual(await getSpokenWordWords(db, 5), []);
}
