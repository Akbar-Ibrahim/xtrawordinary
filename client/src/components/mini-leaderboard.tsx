import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Crown, Medal, Award, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { UserAvatar } from "@/components/user-avatar";
import type { Game, LeaderboardEntry } from "@shared/schema";
import { buildLeaderboardUrl } from "@/lib/leaderboard-url";

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
      aria-pressed={active}
      className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
      data-testid={`mini-tab-${label.toLowerCase().replace(/\s+/g, "-")}`}
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
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-2 py-1.5"
      data-testid={`mini-leaderboard-row-${index}`}
    >
      <div className="w-5 flex items-center justify-center shrink-0">
        <span className="sr-only">Rank {index + 1}</span>
        <span aria-hidden="true">
          <RankBadge index={index} />
        </span>
      </div>
      <div aria-hidden="true">
        <UserAvatar
          name={entry.playerName}
          avatarUrl={entry.playerAvatarUrl}
          className="w-6 h-6 text-[10px]"
          data-testid={`mini-avatar-${index}`}
        />
      </div>
      <Link href={`/u/${entry.username}`}>
        <span
          className="flex-1 text-xs font-medium truncate hover:underline cursor-pointer max-w-[100px]"
          data-testid={`mini-player-${index}`}
        >
          {entry.playerName}
        </span>
      </Link>
      <span className="text-xs font-bold tabular-nums" data-testid={`mini-score-${index}`}>
        <span className="sr-only">Score: </span>
        {entry.score.toLocaleString()}
      </span>
    </motion.li>
  );
}

function LeaderboardList({
  slug,
  label,
}: {
  slug: string;
  label: string;
}) {
  const {
    data: entries = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard/${slug}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div
        className="space-y-2 py-1"
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-testid="mini-leaderboard-loading"
      >
        <span className="sr-only">Loading leaderboard results</span>
        <div aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-5 rounded-full" />
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="py-5 text-center text-muted-foreground space-y-3"
        role="alert"
        data-testid="mini-leaderboard-error"
      >
        <p className="text-xs">
          Leaderboard results couldn&apos;t be loaded. Please check your connection and try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          data-testid="mini-leaderboard-retry"
        >
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  const top10 = entries.slice(0, 10);

  if (top10.length === 0) {
    return (
      <div
        className="py-6 text-center text-muted-foreground space-y-1"
        role="status"
        aria-live="polite"
        data-testid="mini-leaderboard-empty"
      >
        <Trophy className="h-8 w-8 mx-auto opacity-25 mb-2" />
        <p className="text-xs">Be the first on the board!</p>
      </div>
    );
  }

  return (
    <>
      <p
        role="status"
        aria-live="polite"
        data-testid="mini-leaderboard-loaded"
        className="sr-only"
      >
        Loaded {top10.length} leaderboard {top10.length === 1 ? "score" : "scores"} for {label}.
      </p>
      <ol
        aria-label="Leaderboard rankings"
        className="list-none m-0 p-0 divide-y divide-border/50"
      >
        {top10.map((entry, i) => (
          <EntryRow key={entry.id} entry={entry} index={i} />
        ))}
      </ol>
    </>
  );
}

interface MiniLeaderboardProps {
  game: Game;
  preferredModeSlug?: string;
}

export function MiniLeaderboard({ game, preferredModeSlug }: MiniLeaderboardProps) {
  return <MiniLeaderboardForGame key={game.slug} game={game} preferredModeSlug={preferredModeSlug} />;
}

function MiniLeaderboardForGame({ game, preferredModeSlug }: MiniLeaderboardProps) {
  const hasModes = !!(game.modes && game.modes.length > 0);
  const hasSurvival = !!game.hasSurvival;
  const initialModeSlug = game.modes?.some((mode) => mode.slug === preferredModeSlug)
    ? preferredModeSlug!
    : hasModes
      ? game.modes![0].slug
      : game.slug;
  const [activeModeSlug, setActiveModeSlug] = useState(
    initialModeSlug
  );
  const [isSurvival, setIsSurvival] = useState(false);
  useEffect(() => {
    if (preferredModeSlug && game.modes?.some((mode) => mode.slug === preferredModeSlug)) {
      setActiveModeSlug(preferredModeSlug);
    }
  }, [preferredModeSlug, game.modes]);

  const selectedSlug = hasModes ? activeModeSlug : game.slug;
  const activeSlug = isSurvival && hasSurvival ? `${selectedSlug}-survival` : selectedSlug;
  const selectedModeLabel = hasModes
    ? game.modes!.find((mode) => mode.slug === activeModeSlug)?.label ?? game.name
    : game.name;
  const leaderboardLabel = hasSurvival
    ? `${selectedModeLabel} ${isSurvival ? "Survival" : "Classic"}`
    : selectedModeLabel;
  const fullLeaderboardUrl = buildLeaderboardUrl(
    game.slug,
    hasModes ? activeModeSlug : undefined,
    isSurvival && hasSurvival,
  );

  return (
    <Card data-testid="mini-leaderboard-card">
      <CardHeader className="pb-2 pt-4 px-4">
          <h2 className="text-sm font-semibold leading-none tracking-tight flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Top Players
          </h2>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {hasModes && (
          <div
            className="overflow-x-auto bg-muted rounded-md p-0.5 scrollbar-none"
            role="group"
            aria-label="Game mode"
            data-testid="mini-leaderboard-tabs"
          >
            <div className="flex gap-1 min-w-max">
              {game.modes!.map((mode) => (
                <ModeTab
                  key={mode.slug}
                  label={mode.label}
                  active={activeModeSlug === mode.slug}
                  onClick={() => setActiveModeSlug(mode.slug)}
                />
              ))}
            </div>
          </div>
        )}

        {hasSurvival && (
          <div
            className="flex gap-1 p-0.5 bg-muted rounded-md w-fit"
            role="group"
            aria-label="Leaderboard type"
            data-testid="mini-leaderboard-survival-tabs"
          >
            <ModeTab
              label="Classic"
              active={!isSurvival}
              onClick={() => setIsSurvival(false)}
            />
            <ModeTab
              label="Survival"
              active={isSurvival}
              onClick={() => setIsSurvival(true)}
            />
          </div>
        )}

        <LeaderboardList slug={activeSlug} label={leaderboardLabel} />

        <Link href={fullLeaderboardUrl}>
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
