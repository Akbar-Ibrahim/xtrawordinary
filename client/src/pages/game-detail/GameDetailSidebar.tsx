import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Swords, GraduationCap, Sparkles } from "lucide-react";
import { PremiumBanner } from "@/components/premium-banner";
import { MiniLeaderboard } from "@/components/mini-leaderboard";
import { UserAvatar } from "@/components/user-avatar";
import type { Game, DuelChallenge } from "@shared/schema";
import { SEEDED_GAME_SLUGS, QUIZ_MASTER_GAME_SLUGS, DUEL_GAME_SLUGS } from "@shared/schema";
import { CUSTOM_PLAY_SLUGS, UNTIMED_GAME_SLUGS } from "./constants";

type OpenDuel = DuelChallenge & {
  challengerName: string | null | undefined;
  challengerAvatarUrl: string | null | undefined;
};

interface Props {
  slug: string;
  game: Game;
  isAuthenticated: boolean;
  isPremium: boolean;
  openDuels: OpenDuel[];
  onPlay: () => void;
  onChallenge: () => void;
  onDuel: () => void;
  onQuiz: () => void;
  onCustomPlay: () => void;
  onUntimed: () => void;
}

export function GameDetailSidebar({
  slug,
  game,
  isAuthenticated,
  isPremium,
  openDuels,
  onPlay,
  onChallenge,
  onDuel,
  onQuiz,
  onCustomPlay,
  onUntimed,
}: Props) {
  const [, navigate] = useLocation();

  return (
    <div className="lg:sticky lg:top-24 h-fit space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <h3 className="font-semibold mb-2">Ready to play?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Test your word skills and have fun!
            </p>
          </div>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={onPlay}
            data-testid="button-play"
          >
            <Play className="h-5 w-5" />
            Play Now
          </Button>
          {isAuthenticated && SEEDED_GAME_SLUGS.has(slug) && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onChallenge}
              data-testid="button-challenge-friend"
            >
              <Swords className="h-4 w-4" />
              Challenge a Player
            </Button>
          )}
          {isAuthenticated && (DUEL_GAME_SLUGS.has(slug) || slug === "ladder-rush" || slug === "ladder-rush-double") && (
            <Button
              variant="outline"
              className="w-full gap-2 border-violet-400 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/20"
              onClick={onDuel}
              data-testid="button-duel-friend"
            >
              <Swords className="h-4 w-4" />
              Duel a Player
            </Button>
          )}
          {isAuthenticated && DUEL_GAME_SLUGS.has(slug) && openDuels.length > 0 && (
            <div className="border border-violet-200 dark:border-violet-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Swords className="h-3 w-3" />
                  Players Waiting
                </span>
                <span className="text-xs text-violet-500" data-testid="text-open-duels-count">{openDuels.length}</span>
              </div>
              <div className="divide-y divide-border">
                {openDuels.slice(0, 5).map((challenge) => (
                  <div key={challenge.id} className="flex items-center gap-2 px-3 py-2">
                    <UserAvatar
                      name={challenge.challengerName ?? "Player"}
                      avatarUrl={challenge.challengerAvatarUrl ?? null}
                      className="h-7 w-7 shrink-0"
                    />
                    <span className="text-sm font-medium flex-1 truncate" data-testid={`text-challenger-name-${challenge.id}`}>
                      {challenge.challengerName ?? "Player"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${challenge.format === "race" ? "border-orange-400 text-orange-600" : "border-blue-400 text-blue-600"}`}
                    >
                      {challenge.format === "race" ? "Race" : "Turn"}
                    </Badge>
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs shrink-0 bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => navigate(`/duel/${challenge.roomCode}`)}
                      data-testid={`button-join-duel-${challenge.id}`}
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-border bg-muted/30">
                <Link href="/duels" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View all live duels →
                </Link>
              </div>
            </div>
          )}
          {isAuthenticated && QUIZ_MASTER_GAME_SLUGS.has(slug) && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onQuiz}
              data-testid="button-create-quiz"
            >
              <GraduationCap className="h-4 w-4" />
              Create Quiz Session
            </Button>
          )}
          {isAuthenticated && isPremium && CUSTOM_PLAY_SLUGS.has(slug) && (
            <Button
              variant="outline"
              className="w-full gap-2 border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              onClick={onCustomPlay}
              data-testid="button-custom-play"
            >
              <Sparkles className="h-4 w-4" />
              Custom Play
            </Button>
          )}
          {isAuthenticated && isPremium && UNTIMED_GAME_SLUGS.has(slug) && (
            <Button
              variant="outline"
              className="w-full gap-2 border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
              onClick={onUntimed}
              data-testid="button-untimed-mode"
            >
              <span className="text-base leading-none">∞</span>
              Untimed Mode
            </Button>
          )}
        </CardContent>
      </Card>
      <PremiumBanner variant="card" />
      <MiniLeaderboard game={game} />
    </div>
  );
}
