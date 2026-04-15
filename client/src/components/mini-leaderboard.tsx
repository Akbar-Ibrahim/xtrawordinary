import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Crown, Medal, Award, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { Game, LeaderboardEntry } from "@shared/schema";

const RANK_ICONS = [Crown, Medal, Award];
const RANK_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-600"];

function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
      data-testid={`mini-tab-${label.toLowerCase()}`}
    >
      {label}
    </button>
  );
}

function RankBadge({ index }: { index: number }) {
  if (index < 3) {
    const Icon = RANK_ICONS[index];
    return <Icon className={`h-4 w-4 ${RANK_COLORS[index]}`} />;
  }
  return (
    <span className="text-xs font-bold text-muted-foreground w-4 text-center">
      {index + 1}
    </span>
  );
}

function EntryRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const initials = entry.playerName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-2 py-1.5"
      data-testid={`mini-leaderboard-row-${index}`}
    >
      <div className="w-5 flex items-center justify-center shrink-0">
        <RankBadge index={index} />
      </div>
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold text-muted-foreground">
        {initials || "?"}
      </div>
      <Link href={`/profile/${entry.userId}`}>
        <span
          className="flex-1 text-xs font-medium truncate hover:underline cursor-pointer max-w-[100px]"
          data-testid={`mini-player-${index}`}
        >
          {entry.playerName}
        </span>
      </Link>
      <span className="text-xs font-bold tabular-nums" data-testid={`mini-score-${index}`}>
        {entry.score.toLocaleString()}
      </span>
    </motion.div>
  );
}

function LeaderboardList({ slug }: { slug: string }) {
  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard/${slug}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2 py-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-5 rounded-full" />
            <Skeleton className="h-3 flex-1 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const top10 = entries.slice(0, 10);

  if (top10.length === 0) {
    return (
      <div
        className="py-6 text-center text-muted-foreground space-y-1"
        data-testid="mini-leaderboard-empty"
      >
        <Trophy className="h-8 w-8 mx-auto opacity-25 mb-2" />
        <p className="text-xs">Be the first on the board!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {top10.map((entry, i) => (
        <EntryRow key={entry.id} entry={entry} index={i} />
      ))}
    </div>
  );
}

interface MiniLeaderboardProps {
  game: Game;
}

export function MiniLeaderboard({ game }: MiniLeaderboardProps) {
  const hasModes = !!(game.modes && game.modes.length > 0);
  const [activeModeSlug, setActiveModeSlug] = useState(
    hasModes ? game.modes![0].slug : game.slug
  );

  const activeSlug = hasModes ? activeModeSlug : game.slug;

  return (
    <Card data-testid="mini-leaderboard-card">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Top Players
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {hasModes && (
          <div
            className="flex gap-1 p-0.5 bg-muted rounded-md"
            data-testid="mini-leaderboard-tabs"
          >
            {game.modes!.map((mode) => (
              <ModeTab
                key={mode.slug}
                label={mode.label}
                active={activeModeSlug === mode.slug}
                onClick={() => setActiveModeSlug(mode.slug)}
              />
            ))}
          </div>
        )}

        <LeaderboardList slug={activeSlug} />

        <Link href={`/leaderboard?game=${game.slug}`}>
          <div
            className="flex items-center justify-end gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 cursor-pointer"
            data-testid="link-full-leaderboard"
          >
            View Full Leaderboard
            <ArrowRight className="h-3 w-3" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
