import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FriendChallenge } from "@shared/schema";
import { LetterDodgeChallengePreview } from "./LetterDodgeChallengePreview";

function renderPreview(gameConfig: string, status: "pending" | "completed" = "pending") {
  const challenge = {
    id: 5,
    senderId: 1,
    receiverId: 2,
    gameSlug: "letter-dodge",
    senderScore: 120,
    receiverScore: null,
    status,
    message: null,
    seed: 42,
    gameConfig,
    senderViewed: true,
    receiverViewed: true,
    createdAt: "2026-10-16T00:00:00.000Z",
    senderName: "Alex",
    senderAvatarUrl: null,
  } as FriendChallenge;

  return renderToStaticMarkup(
    <LetterDodgeChallengePreview
      challenge={challenge}
      challengeLoading={false}
      challengeError={false}
      isAuthenticated
      isAuthLoading={false}
      onSignIn={() => {}}
      onStart={() => {}}
    />,
  );
}

test("Letter Dodge preview shows saved difficulty and Survival mode", () => {
  const html = renderPreview(JSON.stringify({ difficulty: 3, survival: true }));

  assert.match(html, /text-letter-dodge-preview-difficulty[^>]*>Hard \(3 letters\)/);
  assert.match(html, /badge-letter-dodge-preview-mode[^>]*>Survival/);
  assert.match(html, /button-start-letter-dodge-challenge/);
});

test("standard Letter Dodge preview is labeled Standard without a Survival marker", () => {
  const html = renderPreview(JSON.stringify({ difficulty: 2, survival: false }));

  assert.match(html, /text-letter-dodge-preview-difficulty[^>]*>Medium \(2 letters\)/);
  assert.match(html, /badge-letter-dodge-preview-mode[^>]*>Standard/);
  assert.doesNotMatch(html, />Survival</);
});

test("inactive Letter Dodge challenges show settings but cannot be started", () => {
  const html = renderPreview(JSON.stringify({ difficulty: 4 }), "completed");

  assert.match(html, /Expert \(4 letters\)/);
  assert.match(html, /This challenge is no longer waiting for a response/);
  assert.doesNotMatch(html, /button-start-letter-dodge-challenge/);
});
