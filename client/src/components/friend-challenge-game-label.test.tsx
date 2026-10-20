import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FriendChallengeGameLabel } from "./friend-challenge-game-label";

function renderChallengeHeading({
  challengeId,
  status,
  gameSlug = "letter-dodge",
  gameConfig,
}: {
  challengeId: number;
  status: "pending" | "completed";
  gameSlug?: string;
  gameConfig?: string | null;
}) {
  return renderToStaticMarkup(
    <div data-testid={`row-challenge-${challengeId}`} data-status={status}>
      <FriendChallengeGameLabel
        challengeId={challengeId}
        gameName={gameSlug === "letter-dodge" ? "Letter Dodge" : "Word Fusion"}
        gameSlug={gameSlug}
        gameConfig={gameConfig}
      />
    </div>,
  );
}

test("pending and completed Letter Dodge challenge headings show their saved difficulty", () => {
  const pending = renderChallengeHeading({
    challengeId: 11,
    status: "pending",
    gameConfig: JSON.stringify({ difficulty: 3, survival: true }),
  });
  const completed = renderChallengeHeading({
    challengeId: 12,
    status: "completed",
    gameConfig: JSON.stringify({ difficulty: "savant", survival: true }),
  });

  assert.match(pending, /data-status="pending"/);
  assert.match(pending, /data-testid="badge-challenge-difficulty-11"[^>]*>Hard \(3 letters\)/);
  assert.match(pending, /data-testid="badge-challenge-survival-11"[^>]*>Survival/);
  assert.match(completed, /data-status="completed"/);
  assert.match(completed, /data-testid="badge-challenge-difficulty-12"[^>]*>Savant \(6–12 letters\)/);
  assert.match(completed, /data-testid="badge-challenge-survival-12"[^>]*>Survival/);
});

test("standard Letter Dodge challenges do not display a Survival badge", () => {
  const html = renderChallengeHeading({
    challengeId: 15,
    status: "pending",
    gameConfig: JSON.stringify({ difficulty: 3, survival: false }),
  });

  assert.match(html, /badge-challenge-difficulty-15/);
  assert.doesNotMatch(html, /badge-challenge-survival-15/);
});

test("Letter Dodge challenge headings use the Advanced default when difficulty is missing", () => {
  const html = renderChallengeHeading({
    challengeId: 13,
    status: "pending",
    gameConfig: null,
  });

  assert.match(html, /Advanced \(random 1–5\)/);
});

test("other game challenge headings do not display a Letter Dodge difficulty", () => {
  const html = renderChallengeHeading({
    challengeId: 14,
    status: "completed",
    gameSlug: "word-fusion",
    gameConfig: JSON.stringify({ difficulty: 4 }),
  });

  assert.match(html, /Word Fusion/);
  assert.doesNotMatch(html, /badge-challenge-difficulty-14/);
  assert.doesNotMatch(html, /badge-challenge-survival-14/);
  assert.doesNotMatch(html, /Expert \(4 letters\)/);
});

test("Letter Balance challenge headings show their saved Locked Balance settings", () => {
  const html = renderChallengeHeading({
    challengeId: 21,
    status: "completed",
    gameSlug: "letter-balance",
    gameConfig: JSON.stringify({
      category: "locked_balance",
      level: 6,
      consonantCount: 3,
    }),
  });

  assert.match(
    html,
    /data-testid="badge-challenge-letter-balance-config-21"[^>]*>Locked Balance · 6-letter words · 3C\/3V/,
  );
  assert.doesNotMatch(html, /badge-challenge-difficulty-21/);
});

test("Letter Balance headings include count-based level and other persisted settings", () => {
  const html = renderChallengeHeading({
    challengeId: 22,
    status: "completed",
    gameSlug: "letter-balance",
    gameConfig: JSON.stringify({
      category: "consonant_count",
      level: 4,
      survival: true,
      wordCount: 12,
      timeLimitSeconds: 45,
    }),
  });

  assert.match(
    html,
    /Consonant Count · 4 consonants · Survival · 12 words · 45s/,
  );
});

test("Random Letter Balance challenge headings show the saved category and level", () => {
  const html = renderChallengeHeading({
    challengeId: 24,
    status: "completed",
    gameSlug: "letter-balance",
    gameConfig: JSON.stringify({
      category: "start_end_vowel",
      level: "advanced",
    }),
  });

  assert.match(
    html,
    /data-testid="badge-challenge-letter-balance-config-24"[^>]*>Start &amp; End Vowels · Advanced/,
  );
});

test("malformed Letter Balance settings do not produce a config badge", () => {
  const html = renderChallengeHeading({
    challengeId: 23,
    status: "completed",
    gameSlug: "letter-balance",
    gameConfig: "{invalid",
  });

  assert.doesNotMatch(html, /badge-challenge-letter-balance-config-23/);
});
