import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import type { FriendChallenge } from "@shared/schema";
import { FriendChallengeCard } from "./FriendChallengeCard";

function renderResult({
  isSender = false,
  slug = "letter-dodge",
  gameConfig = null,
  dodgeDifficulty = null,
  dodgeSurvival = false,
}: {
  isSender?: boolean;
  slug?: string;
  gameConfig?: string | null;
  dodgeDifficulty?: string | null;
  dodgeSurvival?: boolean;
}) {
  return renderToStaticMarkup(
    <Router ssrPath="/">
      <FriendChallengeCard
        challengeResult={{ myScore: 100, opponentScore: 80, won: true, isSender }}
        isTied={false}
        opponentName="Sam"
        receiverChallenge={
          gameConfig === null
            ? undefined
            : ({ gameConfig, senderAvatarUrl: null } as FriendChallenge)
        }
        challengeNewFriendId="2"
        friends={[
          {
            id: 1,
            friendUser: { id: 2, name: "Sam", avatarUrl: null },
          },
        ]}
        slug={slug}
        challengeNewLbCategory={null}
        challengeNewLbLevel={null}
        challengeNewLbConsonantCount={null}
        challengeNewDodgeDifficulty={dodgeDifficulty}
        challengeNewDodgeSurvival={dodgeSurvival}
        isReceiverMode={!isSender}
      />
    </Router>,
  );
}

test("sender Letter Dodge results show the selected difficulty and Survival mode", () => {
  const html = renderResult({
    isSender: true,
    dodgeDifficulty: "4",
    dodgeSurvival: true,
  });

  assert.match(html, /data-testid="text-challenge-dodge-config"[^>]*>Expert \(4 letters\) · Survival/);
});

test("receiver Letter Dodge results use the saved config and omit Survival for standard play", () => {
  const html = renderResult({
    gameConfig: JSON.stringify({ difficulty: "savant", survival: false }),
  });

  assert.match(html, /data-testid="text-challenge-dodge-config"[^>]*>Savant \(6–12 letters\)/);
  assert.doesNotMatch(html, /text-challenge-dodge-config[^<]*Survival/);
});

test("receiver Letter Dodge results show Survival when it is saved as enabled", () => {
  const html = renderResult({
    gameConfig: JSON.stringify({ difficulty: 2, survival: true }),
  });

  assert.match(html, /data-testid="text-challenge-dodge-config"[^>]*>Medium \(2 letters\) · Survival/);
});

test("other game results keep their existing presentation", () => {
  const html = renderResult({
    slug: "word-fusion",
    gameConfig: JSON.stringify({ difficulty: 4, survival: true }),
  });

  assert.doesNotMatch(html, /text-challenge-dodge-config/);
  assert.doesNotMatch(html, /Expert \(4 letters\)/);
  assert.doesNotMatch(html, /Survival/);
});
