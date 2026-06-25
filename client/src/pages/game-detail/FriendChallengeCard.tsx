import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { FriendChallenge } from "@shared/schema";
import type { ChallengeResult } from "./constants";

interface Friend {
  id: number;
  friendUser: { id: number; name: string; avatarUrl: string | null };
}

interface Props {
  challengeResult: ChallengeResult;
  isTied: boolean;
  opponentName: string | undefined;
  receiverChallenge: FriendChallenge | undefined;
  challengeNewFriendId: string | null;
  friends: Friend[];
  slug: string | undefined;
  challengeNewLbCategory: string | null;
  challengeNewLbLevel: string | null;
  challengeNewLbConsonantCount: string | null;
  isReceiverMode: boolean;
}

export function FriendChallengeCard({
  challengeResult,
  isTied,
  opponentName,
  receiverChallenge,
  challengeNewFriendId,
  friends,
  slug,
  challengeNewLbCategory,
  challengeNewLbLevel,
  challengeNewLbConsonantCount,
  isReceiverMode,
}: Props) {
  const opponentAvatarUrl = !challengeResult.isSender
    ? (receiverChallenge?.senderAvatarUrl ?? null)
    : (friends.find(f => String(f.friendUser.id) === challengeNewFriendId)?.friendUser.avatarUrl ?? null);

  return (
    <Card className={`mb-6 border-2 ${isTied ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" : challengeResult.won ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-muted bg-muted/30"}`}>
      <CardContent className="py-5 px-6">
        <div className="flex items-center gap-3 mb-3">
          <Trophy className={`h-6 w-6 ${isTied ? "text-blue-500" : challengeResult.won ? "text-yellow-500" : "text-muted-foreground"}`} />
          <p className="text-lg font-bold">
            {isTied
              ? "It's a tie!"
              : challengeResult.won
                ? opponentName ? `You beat ${opponentName}!` : "You won the challenge!"
                : opponentName ? `${opponentName} wins this one!` : "Your friend wins this one!"}
          </p>
        </div>
        {slug === "letter-balance" && (() => {
          const lbCfgStr = isReceiverMode ? receiverChallenge?.gameConfig : null;
          const senderLbStr = (challengeNewLbCategory === "locked_balance" && challengeNewLbLevel && challengeNewLbConsonantCount)
            ? JSON.stringify({ category: "locked_balance", level: parseInt(challengeNewLbLevel), consonantCount: parseInt(challengeNewLbConsonantCount) })
            : null;
          const cfgStr = isReceiverMode ? lbCfgStr : senderLbStr;
          if (!cfgStr) return null;
          try {
            const cfg = JSON.parse(cfgStr);
            if (cfg?.category === "locked_balance" && cfg.level && cfg.consonantCount) {
              const vowels = cfg.level - cfg.consonantCount;
              return (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-challenge-lb-config">
                  Locked Balance · {cfg.level}-letter words · {cfg.consonantCount}C/{vowels}V
                </p>
              );
            }
          } catch {}
          return null;
        })()}
        <div className="flex gap-6 text-sm mt-2">
          <div>
            <p className="text-muted-foreground">Your score</p>
            <p className="text-2xl font-bold">{challengeResult.myScore}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <UserAvatar name={opponentName ?? "Opponent"} avatarUrl={opponentAvatarUrl} className="h-6 w-6 inline-block align-middle" data-testid="img-result-opponent-avatar" />
              {opponentName ? `${opponentName}'s score` : "Their score"}
            </p>
            <p className="text-2xl font-bold">{challengeResult.opponentScore}</p>
          </div>
        </div>
        <Link href="/friends">
          <Button className="mt-4" size="sm" data-testid="button-back-to-friends">
            See all challenges
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
