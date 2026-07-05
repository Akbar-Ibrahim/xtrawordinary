import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Trophy, Swords, Loader2 } from "lucide-react";
import type { GameResult } from "@/components/duel-turn-engine";
import type { PublicUser } from "@shared/schema";

interface GameOverViewProps {
  gameResult: GameResult;
  isRace: boolean;
  raceTarget: number;
  user: PublicUser | null | undefined;
  opponentName: string;
  opponentId: number | null;
  rematchPending: boolean;
  handleRematch: () => void;
  gameSlug: string;
}

export function GameOverView({
  gameResult,
  isRace,
  raceTarget,
  user,
  opponentName,
  opponentId,
  rematchPending,
  handleRematch,
  gameSlug,
}: GameOverViewProps) {
  return (
    <motion.div key="over" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <Card className={
        gameResult.outcome === "you_win" || gameResult.outcome === "forfeit"
          ? "border-yellow-400"
          : gameResult.outcome === "draw"
          ? "border-blue-400"
          : "border-muted"
      }>
        <CardContent className="py-10 space-y-6">
          <div className="text-center space-y-2">
            <Trophy className={`h-14 w-14 mx-auto ${
              gameResult.outcome === "you_win" || gameResult.outcome === "forfeit"
                ? "text-yellow-500"
                : "text-muted-foreground"
            }`} />
            <h2 className="text-3xl font-black" data-testid="text-outcome">
              {gameResult.outcome === "you_win"
                ? "You Win! 🎉"
                : gameResult.outcome === "you_lose"
                ? "You Lose"
                : gameResult.outcome === "draw"
                ? "It's a Draw"
                : "Forfeit Victory 🎉"}
            </h2>
            {(gameResult.outcome === "forfeit") && (
              <p className="text-sm text-muted-foreground">
                Your opponent{" "}
                {gameResult.forfeitReason === "disconnect" ? "disconnected" : "forfeited"}.
              </p>
            )}
          </div>

          {isRace && gameResult.myFinalCount != null && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3" data-testid="section-race-counts">
              <p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-2">Final Scores</p>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-0.5 truncate max-w-[90px]">{user?.name ?? "You"}</p>
                  <p className="text-3xl font-black text-green-600" data-testid="text-my-final-count">
                    {gameResult.myFinalCount}
                    <span className="text-sm font-normal text-muted-foreground"> / {raceTarget}</span>
                  </p>
                </div>
                <div className="flex items-center text-muted-foreground font-bold text-lg">vs</div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-0.5 truncate max-w-[90px]">{opponentName || "Opponent"}</p>
                  <p className="text-3xl font-black text-blue-600" data-testid="text-opp-final-count">
                    {gameResult.opponentFinalCount ?? 0}
                    <span className="text-sm font-normal text-muted-foreground"> / {raceTarget}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">ELO change</p>
              <p
                className={`text-2xl font-bold ${
                  gameResult.eloChange > 0
                    ? "text-green-600"
                    : gameResult.eloChange < 0
                    ? "text-red-500"
                    : "text-muted-foreground"
                }`}
                data-testid="text-elo-change"
              >
                {gameResult.eloChange > 0 ? `+${gameResult.eloChange}` : gameResult.eloChange}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">New ELO</p>
              <p className="text-2xl font-bold" data-testid="text-new-elo">
                {gameResult.newElo}
              </p>
            </div>
          </div>

          {(gameResult.myWords.length > 0 || gameResult.opponentWords.length > 0) && (
            <div className="grid grid-cols-2 gap-3" data-testid="section-word-lists">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Your words ({gameResult.myWords.length})
                </p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto" data-testid="list-my-words">
                  {gameResult.myWords.length > 0 ? (
                    gameResult.myWords.map((w, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-mono" data-testid={`word-mine-${i}`}>
                        {w}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">None</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {opponentName || "Opponent"}'s words ({gameResult.opponentWords.length})
                </p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto" data-testid="list-opponent-words">
                  {gameResult.opponentWords.length > 0 ? (
                    gameResult.opponentWords.map((w, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-mono" data-testid={`word-opponent-${i}`}>
                        {w}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">None</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center pt-1">
            <Link href="/duels/leaderboard">
              <Button variant="outline" className="gap-1.5" data-testid="button-see-rankings">
                <Trophy className="h-4 w-4" />
                See Rankings
              </Button>
            </Link>
            <Link href="/friends">
              <Button variant="outline" data-testid="button-back-friends">Back to Friends</Button>
            </Link>
            {opponentId && (
              <Button
                variant="secondary"
                onClick={handleRematch}
                disabled={rematchPending}
                data-testid="button-rematch"
              >
                {rematchPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                ) : (
                  <><Swords className="h-4 w-4 mr-2" />Rematch</>
                )}
              </Button>
            )}
            <Link href={`/games/${gameSlug}`}>
              <Button data-testid="button-play-again">
                Play Again
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
