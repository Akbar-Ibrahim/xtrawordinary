import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Crown, LogIn, Timer, Flame } from "lucide-react";
import { getAvatarColor, getInitials } from "@/lib/avatar-utils";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { motion } from "framer-motion";
import type { LeaderboardEntry, Game, GameMode } from "@shared/schema";

const RANK_ICONS = [Crown, Medal, Award];
const RANK_COLORS = ["text-yellow-500", "text-gray-400", "text-amber-600"];

function LeaderboardEntries({
  slug,
  user,
  onSignIn,
}: {
  slug: string;
  user: ReturnType<typeof useAuth>["user"];
  onSignIn: () => void;
}) {
  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug],
    queryFn: async () => {
      const url = slug === "overall" ? "/api/leaderboard" : `/api/leaderboard/${slug}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-4" data-testid="text-no-entries">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>No scores yet. Be the first to play!</p>
        {!user && (
          <div className="space-y-2">
            <p className="text-sm">Sign in to track your scores and appear here.</p>
            <Button onClick={onSignIn} variant="outline" size="sm" className="gap-2" data-testid="button-signin-leaderboard">
              <LogIn className="h-4 w-4" /> Sign In
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {entries.map((entry, index) => {
          const isCurrentUser = user && entry.userId === user.id;
          const RankIcon = index < 3 ? RANK_ICONS[index] : null;
          const rankColor = index < 3 ? RANK_COLORS[index] : "";

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isCurrentUser ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
              }`}
              data-testid={`row-leaderboard-${index}`}
            >
              <div className="w-8 text-center font-bold">
                {RankIcon ? (
                  <RankIcon className={`h-5 w-5 mx-auto ${rankColor}`} />
                ) : (
                  <span className="text-muted-foreground">{index + 1}</span>
                )}
              </div>
              <div className={`w-7 h-7 rounded-full ${getAvatarColor(entry.playerName)} flex items-center justify-center shrink-0 text-[10px] font-bold text-white`}
                data-testid={`avatar-player-${index}`}>
                {getInitials(entry.playerName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${entry.userId}`}>
                    <span className="font-medium truncate hover:underline cursor-pointer" data-testid={`text-player-${index}`}>
                      {entry.playerName}
                    </span>
                  </Link>
                  {isCurrentUser && (
                    <Badge variant="secondary" className="text-xs" data-testid="badge-you">You</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.playedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-lg" data-testid={`text-score-${index}`}>{entry.score.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground ml-1">pts</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      {!user && entries.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center space-y-2" data-testid="banner-signin-leaderboard">
          <p className="text-sm text-muted-foreground">Sign in to track your scores and appear on the leaderboard!</p>
          <Button onClick={onSignIn} variant="outline" size="sm" className="gap-2" data-testid="button-signin-leaderboard-banner">
            <LogIn className="h-4 w-4" /> Sign In
          </Button>
        </div>
      )}
    </>
  );
}

function SurvivalToggle({
  isSurvival,
  onChange,
}: {
  isSurvival: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mx-auto" data-testid="toggle-survival">
      <button
        onClick={() => onChange(false)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
          !isSurvival
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="button-toggle-classic"
      >
        <Timer className="h-3.5 w-3.5" />
        Classic
      </button>
      <button
        onClick={() => onChange(true)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
          isSurvival
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="button-toggle-survival"
      >
        <Flame className="h-3.5 w-3.5" />
        Survival
      </button>
    </div>
  );
}

function ModeTabs({
  modes,
  isSurvival,
  user,
  onSignIn,
}: {
  modes: GameMode[];
  isSurvival: boolean;
  user: ReturnType<typeof useAuth>["user"];
  onSignIn: () => void;
}) {
  const [activeMode, setActiveMode] = useState(modes[0]?.slug ?? "");
  const effectiveSlug = isSurvival ? `${activeMode}-survival` : activeMode;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-muted rounded-lg" data-testid="tabs-mode">
        {modes.map((mode) => (
          <button
            key={mode.slug}
            onClick={() => setActiveMode(mode.slug)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              activeMode === mode.slug
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-mode-${mode.slug}`}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <LeaderboardEntries slug={effectiveSlug} user={user} onSignIn={onSignIn} />
    </div>
  );
}

export default function Leaderboard() {
  const search = useSearch();
  const initialGame = new URLSearchParams(search).get("game") ?? "overall";
  const [selectedGame, setSelectedGame] = useState(initialGame);
  const [isSurvival, setIsSurvival] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const selectedGameObj = games.find(g => g.slug === selectedGame);
  const hasModes = !!(selectedGameObj?.modes && selectedGameObj.modes.length > 0);
  const showSurvivalToggle = !!(selectedGameObj?.hasSurvival);

  const cardTitle = selectedGame === "overall"
    ? "Overall Rankings"
    : selectedGameObj?.name || "Rankings";

  function handleGameChange(slug: string) {
    setSelectedGame(slug);
    setIsSurvival(false);
  }

  const noModeSlug = isSurvival ? `${selectedGame}-survival` : selectedGame;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold" data-testid="text-leaderboard-title">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">Top players across all xtraWordinary games</p>
        </div>

        <div className="flex justify-center">
          <Select value={selectedGame} onValueChange={handleGameChange}>
            <SelectTrigger className="w-64" data-testid="select-game-filter">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall" data-testid="option-overall">Overall</SelectItem>
              {games.map((game) => (
                <SelectItem key={game.slug} value={game.slug} data-testid={`option-${game.slug}`}>
                  {game.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showSurvivalToggle && (
          <SurvivalToggle isSurvival={isSurvival} onChange={setIsSurvival} />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {cardTitle}
              {showSurvivalToggle && (
                <Badge variant={isSurvival ? "destructive" : "secondary"} className="text-xs gap-1">
                  {isSurvival ? <><Flame className="h-3 w-3" /> Survival</> : <><Timer className="h-3 w-3" /> Classic</>}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasModes ? (
              <ModeTabs
                key={selectedGame}
                modes={selectedGameObj!.modes!}
                isSurvival={isSurvival}
                user={user}
                onSignIn={() => setAuthOpen(true)}
              />
            ) : (
              <LeaderboardEntries
                slug={noModeSlug}
                user={user}
                onSignIn={() => setAuthOpen(true)}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
