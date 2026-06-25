import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, CheckCircle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { motion } from "framer-motion";
import { LikeButton } from "@/components/like-button";
import { CommentSection } from "@/components/comment-section";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import type { Game } from "@shared/schema";
import { difficultyColors } from "./constants";

interface MyGameStat {
  gameSlug: string;
  gamesPlayed: number;
  bestScore: number;
  lastScore?: number | null;
}

interface Props {
  game: Game;
  allGames: Game[];
  isAuthenticated: boolean;
  myGameStat: MyGameStat | undefined;
  lastPercentile: { percentile: number; totalPlayers: number } | null;
  likeData: { counts: Record<string, number>; likedByMe: Record<string, boolean> } | undefined;
}

function FriendsWhoPlay({ slug }: { slug: string }) {
  const { user } = useAuth();
  const { data: friends = [], isLoading } = useQuery<Array<{ id: number; name: string; avatarUrl: string | null; gamesPlayed: number }>>({
    queryKey: ["/api/games", slug, "friends-who-play"],
    queryFn: async () => {
      const res = await fetch(`/api/games/${slug}/friends-who-play`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  if (!user || isLoading || friends.length === 0) return null;

  return (
    <div className="mb-6" data-testid="section-friends-who-play">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <LucideIcons.Users className="h-3.5 w-3.5" /> Friends playing this game
      </h3>
      <div className="flex flex-wrap gap-2">
        {friends.map(f => (
          <Link key={f.id} href={`/profile/${f.id}`}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors cursor-pointer" data-testid={`chip-friend-${f.id}`}>
              <UserAvatar name={f.name} avatarUrl={f.avatarUrl} className="h-5 w-5 text-[8px]" />
              <span className="text-xs font-medium">{f.name}</span>
              <span className="text-xs text-muted-foreground">{f.gamesPlayed} play{f.gamesPlayed !== 1 ? "s" : ""}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GameDetailInfo({ game, allGames, isAuthenticated, myGameStat, lastPercentile, likeData }: Props) {
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;

  return (
    <div className="lg:col-span-2 space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: game.color }}
        >
          <IconComponent className="h-7 w-7 text-white drop-shadow" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-bold">{game.name}</h1>
            <Badge
              className={`text-sm ${difficultyColors[game.difficulty]}`}
              data-testid="badge-difficulty"
            >
              {game.difficulty}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-lg text-muted-foreground">{game.longDescription}</p>

        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5" />
            {game.estimatedTime}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-5 w-5" />
            {game.playCount.toLocaleString()} plays
          </span>
          {isAuthenticated && myGameStat && myGameStat.gamesPlayed > 0 && (
            <span className="flex items-center gap-2 text-primary font-medium" data-testid="text-my-plays">
              You've played {myGameStat.gamesPlayed.toLocaleString()} {myGameStat.gamesPlayed === 1 ? "time" : "times"}
            </span>
          )}
          {isAuthenticated && myGameStat && myGameStat.bestScore > 0 && (
            <span className="flex items-center gap-2 text-muted-foreground" data-testid="text-my-best">
              Personal best: <span className="font-semibold text-foreground">{myGameStat.bestScore.toLocaleString()}</span>
            </span>
          )}
          {isAuthenticated && myGameStat && myGameStat.lastScore != null && myGameStat.lastScore > 0 && (
            <span className="flex items-center gap-2 text-muted-foreground" data-testid="text-my-last-score">
              Last score: <span className="font-semibold text-foreground">{myGameStat.lastScore.toLocaleString()}</span>
            </span>
          )}
          {lastPercentile && lastPercentile.totalPlayers >= 3 && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-primary" data-testid="text-percentile">
              <LucideIcons.BarChart2 className="h-4 w-4" />
              Better than {lastPercentile.percentile}% of players
            </span>
          )}
          {(
            <LikeButton
              targetType="game"
              targetId={game.slug}
              initialCount={likeData?.counts[game.slug] ?? 0}
              initialLikedByMe={likeData?.likedByMe[game.slug] ?? false}
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Play</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {game.rules.map((rule, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3"
              >
                <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <span>{rule}</span>
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {allGames.length > 1 && (() => {
        const otherGames = allGames.filter(g => g.slug !== game.slug);
        return (
          <div>
            <h3 className="text-lg font-semibold mb-3">More Games</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
              {otherGames.map(g => {
                const GIcon = ((LucideIcons as any)[g.icon] ?? LucideIcons.Gamepad2) as React.ElementType;
                return (
                  <Link key={g.slug} href={`/game/${g.slug}`} className="snap-start shrink-0 w-56">
                    <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-more-game-${g.slug}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: g.color }}
                        >
                          <GIcon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate mb-0.5">{g.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{g.description}</p>
                        </div>
                        <LucideIcons.ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      <FriendsWhoPlay slug={game.slug} />
      <CommentSection targetType="game" targetId={game.slug} />
    </div>
  );
}
