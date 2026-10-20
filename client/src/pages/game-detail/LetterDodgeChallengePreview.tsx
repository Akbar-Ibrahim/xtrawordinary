import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Swords } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { FriendChallenge } from "@shared/schema";
import {
  getLetterDodgeChallengeDifficulty,
  getLetterDodgeChallengeModeLabel,
  LETTER_DODGE_VARIANTS,
} from "@shared/letter-dodge";

interface Props {
  challenge: FriendChallenge | undefined;
  challengeLoading: boolean;
  challengeError: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  onSignIn: () => void;
  onStart: () => void;
}

export function LetterDodgeChallengePreview({
  challenge,
  challengeLoading,
  challengeError,
  isAuthenticated,
  isAuthLoading,
  onSignIn,
  onStart,
}: Props) {
  if (isAuthLoading || (isAuthenticated && challengeLoading)) {
    return (
      <Card data-testid="card-letter-dodge-challenge-preview-loading">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading challenge details…</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card data-testid="card-letter-dodge-challenge-preview-sign-in">
        <CardContent className="p-8 text-center">
          <Swords className="h-8 w-8 mx-auto mb-4 text-primary" />
          <h1 className="text-xl font-semibold mb-2">Review your Letter Dodge challenge</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Sign in to see the challenge settings and play for a score.
          </p>
          <Button onClick={onSignIn} data-testid="button-sign-in-challenge-preview">
            Sign in to continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (challengeError || !challenge) {
    return (
      <Card data-testid="card-letter-dodge-challenge-preview-error">
        <CardContent className="p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Challenge unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This challenge may have expired or you may not have permission to view it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const difficulty = getLetterDodgeChallengeDifficulty(challenge.gameConfig);
  const difficultyLabel = LETTER_DODGE_VARIANTS.find(
    ({ difficulty: variantDifficulty }) => variantDifficulty === difficulty,
  )?.label ?? "Advanced (random 1–5)";
  const modeLabel = getLetterDodgeChallengeModeLabel(challenge.gameConfig);
  const isPending = challenge.status === "pending";

  return (
    <Card data-testid="card-letter-dodge-challenge-preview">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Swords className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Review your Letter Dodge challenge</h1>
            <p className="text-sm text-muted-foreground">
              {challenge.senderName ?? "A friend"} challenged you
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-4 mb-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserAvatar
              name={challenge.senderName ?? "Friend"}
              avatarUrl={challenge.senderAvatarUrl ?? null}
              className="h-7 w-7 text-[10px]"
            />
            <span>Score to beat</span>
          </div>
          <span className="text-lg font-bold">{challenge.senderScore} pts</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Difficulty</p>
            <p className="font-medium" data-testid="text-letter-dodge-preview-difficulty">
              {difficultyLabel}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Mode</p>
            <Badge
              variant="outline"
              data-testid="badge-letter-dodge-preview-mode"
            >
              {modeLabel}
            </Badge>
          </div>
        </div>

        {isPending ? (
          <Button className="w-full" onClick={onStart} data-testid="button-start-letter-dodge-challenge">
            Start challenge
          </Button>
        ) : (
          <p className="text-sm text-center text-muted-foreground" data-testid="text-letter-dodge-challenge-inactive">
            This challenge is no longer waiting for a response.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
