import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Medal, Award, Crown, LogIn, Timer, Flame, Search, TrendingUp, Users, Globe, CalendarDays, Calendar, Infinity } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { PremiumBanner } from "@/components/premium-banner";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { AuthModal } from "@/components/auth-modal";
import { motion } from "framer-motion";
import type { LeaderboardEntry, Game, GameMode } from "@shared/schema";

type TimeFilter = "all" | "today" | "week";
type LeaderboardView = "global" | "friends";

type StreakEntry = { userId: number; name: string; avatarUrl: string | null; currentStreak: number; longestStreak: number };

function StreakLeaderboard({ user, onSignIn }: { user: ReturnType<typeof useAuth>["user"]; onSignIn: () => void }) {
  const { data: entries = [], isLoading } = useQuery<StreakEntry[]>({
    queryKey: ["/api/leaderboard/streaks"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard/streaks");
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
      <div className="text-center py-12 text-muted-foreground space-y-4" data-testid="text-no-streaks">
        <Flame className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>No active streaks yet. Start playing daily to build yours!</p>
        {!user && (
          <Button onClick={onSignIn} variant="outline" size="sm" className="gap-2" data-testid="button-signin-streaks">
            <LogIn className="h-4 w-4" /> Sign In
          </Button>
        )}
      </div>
    );
  }

  const userInList = user ? entries.some(e => e.userId === user.id) : false;
  const myEntry = user ? entries.find(e => e.userId === user.id) : undefined;

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const isCurrentUser = user && entry.userId === user.id;
        const RankIcon = index < 3 ? RANK_ICONS[index] : null;
        const rankColor = index < 3 ? RANK_COLORS[index] : "";
        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              isCurrentUser ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
            }`}
            data-testid={`row-streak-${index}`}
          >
            <div className="w-8 text-center font-bold">
              {RankIcon ? (
                <RankIcon className={`h-5 w-5 mx-auto ${rankColor}`} />
              ) : (
                <span className="text-muted-foreground">{index + 1}</span>
              )}
            </div>
            <Link href={`/profile/${entry.userId}`}>
              <UserAvatar name={entry.name} avatarUrl={entry.avatarUrl} className="w-7 h-7 text-[10px] cursor-pointer" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/profile/${entry.userId}`}>
                  <span className="font-medium truncate hover:underline cursor-pointer" data-testid={`text-streak-player-${index}`}>
                    {entry.name}
                  </span>
                </Link>
                {isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">Best: {entry.longestStreak}d</span>
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <Flame className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="font-bold text-lg text-orange-600 dark:text-orange-400" data-testid={`text-streak-days-${index}`}>
                {entry.currentStreak}
              </span>
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </motion.div>
        );
      })}

      {user && !userInList && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 border-dashed mt-2"
          data-testid="banner-my-streak"
        >
          <div className="w-8" />
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl ?? null} className="w-7 h-7 text-[10px]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{user.name}</span>
              <Badge variant="secondary" className="text-xs">You</Badge>
            </div>
            <span className="text-xs text-muted-foreground">No active streak yet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-muted-foreground" />
            <span className="font-bold text-lg text-muted-foreground">0</span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </motion.div>
      )}

      {!user && (
        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center space-y-2" data-testid="banner-signin-streak-board">
          <p className="text-sm text-muted-foreground">Sign in to track your streak and appear here!</p>
          <Button onClick={onSignIn} variant="outline" size="sm" className="gap-2" data-testid="button-signin-streak-banner">
            <LogIn className="h-4 w-4" /> Sign In
          </Button>
        </div>
      )}
    </div>
  );
}

const RANK_ICONS = [Crown, Medal, Award];
const RANK_COLORS = ["text-yellow-500", "text-gray-400", "text-amber-600"];

const TIME_FILTER_OPTIONS: { value: TimeFilter; label: string; icon: typeof CalendarDays }[] = [
  { value: "today", label: "Today", icon: CalendarDays },
  { value: "week", label: "This Week", icon: Calendar },
  { value: "all", label: "All Time", icon: Infinity },
];

function TimeFilterBar({
  value,
  onChange,
}: {
  value: TimeFilter;
  onChange: (v: TimeFilter) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" data-testid="filter-time">
      {TIME_FILTER_OPTIONS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          data-testid={`filter-time-${v}`}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            value === v
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: LeaderboardView;
  onChange: (v: LeaderboardView) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" data-testid="toggle-view">
      <button
        onClick={() => onChange("global")}
        data-testid="toggle-view-global"
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
          view === "global"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Globe className="h-3.5 w-3.5" />
        Global
      </button>
      <button
        onClick={() => onChange("friends")}
        data-testid="toggle-view-friends"
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
          view === "friends"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Users className="h-3.5 w-3.5" />
        Friends
      </button>
    </div>
  );
}

function MyRankBanner({
  slug,
  timeFilter,
  visibleUserIds,
}: {
  slug: string;
  timeFilter: TimeFilter;
  visibleUserIds: Set<number>;
}) {
  const { user } = useAuth();
  const params = new URLSearchParams();
  if (timeFilter !== "all") params.set("timeFilter", timeFilter);
  const queryString = params.toString();
  const apiSlug = slug === "overall" ? "overall" : slug;
  const url = `/api/leaderboard/${apiSlug}/my-rank${queryString ? `?${queryString}` : ""}`;

  const { data: rankData } = useQuery<{ rank: number; score: number } | null>({
    queryKey: ["/api/leaderboard", apiSlug, "my-rank", timeFilter],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && !visibleUserIds.has(user.id),
  });

  if (!user || visibleUserIds.has(user.id) || !rankData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 border-dashed mt-2"
      data-testid="banner-my-rank"
    >
      <div className="w-8 text-center font-bold text-muted-foreground text-sm">
        #{rankData.rank}
      </div>
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl ?? null} className="w-7 h-7 text-[10px]" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{user.name}</span>
          <Badge variant="secondary" className="text-xs" data-testid="badge-you-rank">You</Badge>
        </div>
        <span className="text-xs text-muted-foreground">Your current rank</span>
      </div>
      <div className="text-right">
        <span className="font-bold text-lg" data-testid="text-my-score">{rankData.score.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground ml-1">pts</span>
      </div>
    </motion.div>
  );
}

function LeaderboardEntries({
  slug,
  user,
  onSignIn,
  timeFilter,
  view,
}: {
  slug: string;
  user: ReturnType<typeof useAuth>["user"];
  onSignIn: () => void;
  timeFilter: TimeFilter;
  view: LeaderboardView;
}) {
  const params = new URLSearchParams();
  if (timeFilter !== "all") params.set("timeFilter", timeFilter);
  const queryString = params.toString();

  const isOverall = slug === "overall";
  const baseUrl = isOverall ? "/api/leaderboard" : `/api/leaderboard/${slug}`;
  const globalUrl = `${baseUrl}${queryString ? `?${queryString}` : ""}`;
  const friendsUrl = isOverall ? `/api/leaderboard/overall/friends` : `/api/leaderboard/${slug}/friends`;

  const { data: globalEntries = [], isLoading: globalLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug, timeFilter],
    queryFn: async () => {
      const res = await fetch(globalUrl);
      return res.json();
    },
    enabled: view === "global",
  });

  const { data: friendEntries = [], isLoading: friendsLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug, "friends"],
    queryFn: async () => {
      const res = await fetch(friendsUrl);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: view === "friends" && !!user,
  });

  const isLoading = view === "global" ? globalLoading : friendsLoading;
  const entries = view === "friends" ? friendEntries : globalEntries;

  const batchKey = [...entries.map(e => e.userId)].sort((a, b) => a - b).join(",");
  const { data: streakMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/streaks/batch", batchKey],
    queryFn: async () => {
      if (!batchKey) return {};
      const res = await fetch(`/api/streaks/batch?userIds=${batchKey}`);
      return res.json();
    },
    enabled: entries.length > 0,
    staleTime: 60_000,
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

  if (view === "friends" && !user) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-4" data-testid="text-friends-signin">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>Sign in to see how you rank against your friends!</p>
        <Button onClick={onSignIn} variant="outline" size="sm" className="gap-2" data-testid="button-signin-friends">
          <LogIn className="h-4 w-4" /> Sign In
        </Button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-4" data-testid="text-no-entries">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
        {view === "friends" ? (
          <p>None of your friends have played this yet. Challenge them!</p>
        ) : (
          <p>No scores yet. Be the first to play!</p>
        )}
        {!user && view === "global" && (
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

  const visibleUserIds = new Set(entries.map(e => e.userId));

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
              <Link href={`/profile/${entry.userId}`}>
                <UserAvatar
                  name={entry.playerName}
                  avatarUrl={entry.playerAvatarUrl}
                  className="w-7 h-7 text-[10px] cursor-pointer"
                  data-testid={`avatar-player-${index}`}
                />
              </Link>
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
                  {(streakMap[String(entry.userId)] ?? 0) > 0 && (
                    <span title={`${streakMap[String(entry.userId)]}-day streak`} className="flex items-center">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.playedAt).toLocaleDateString()}
                  </span>
                  {entry.gamesPlayed != null && entry.gamesPlayed > 0 && (
                    <span className="text-xs text-muted-foreground" data-testid={`text-games-played-${index}`}>
                      · {entry.gamesPlayed} {entry.gamesPlayed === 1 ? "play" : "plays"}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-lg" data-testid={`text-score-${index}`}>{entry.score.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground ml-1">pts</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {view === "global" && user && (
        <MyRankBanner slug={slug} timeFilter={timeFilter} visibleUserIds={visibleUserIds} />
      )}

      {!user && entries.length > 0 && view === "global" && (
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
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" data-testid="toggle-survival">
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
  timeFilter,
  view,
}: {
  modes: GameMode[];
  isSurvival: boolean;
  user: ReturnType<typeof useAuth>["user"];
  onSignIn: () => void;
  timeFilter: TimeFilter;
  view: LeaderboardView;
}) {
  const [activeMode, setActiveMode] = useState(modes[0]?.slug ?? "");
  const effectiveSlug = isSurvival ? `${activeMode}-survival` : activeMode;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto" data-testid="tabs-mode">
        {modes.map((mode) => (
          <button
            key={mode.slug}
            onClick={() => setActiveMode(mode.slug)}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
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
      <LeaderboardEntries slug={effectiveSlug} user={user} onSignIn={onSignIn} timeFilter={timeFilter} view={view} />
    </div>
  );
}

function GameSidebarItem({
  slug,
  label,
  icon,
  color,
  isActive,
  onClick,
}: {
  slug: string;
  label: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = icon
    ? ((LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? LucideIcons.Gamepad2)
    : LucideIcons.Trophy;

  return (
    <button
      onClick={onClick}
      data-testid={`sidebar-game-${slug}`}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
        isActive
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: isActive ? "rgba(255,255,255,0.2)" : (color ?? "hsl(var(--muted))") }}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="truncate">{label}</span>
    </button>
  );
}

function MobileGameStrip({
  games,
  selectedGame,
  onSelect,
}: {
  games: Game[];
  selectedGame: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1" data-testid="mobile-game-strip">
      <button
        onClick={() => onSelect("streaks")}
        data-testid="strip-game-streaks"
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
          selectedGame === "streaks"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:text-foreground"
        }`}
      >
        <Flame className="h-3 w-3" />
        Streaks
      </button>
      <button
        onClick={() => onSelect("overall")}
        data-testid="strip-game-overall"
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
          selectedGame === "overall"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:text-foreground"
        }`}
      >
        <Trophy className="h-3 w-3" />
        Overall
      </button>
      {games.map((game) => {
        const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] ?? LucideIcons.Gamepad2;
        const isActive = selectedGame === game.slug;
        return (
          <button
            key={game.slug}
            onClick={() => onSelect(game.slug)}
            data-testid={`strip-game-${game.slug}`}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            {game.name}
          </button>
        );
      })}
    </div>
  );
}

export default function Leaderboard() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const initialGame = new URLSearchParams(search).get("game") ?? "overall";
  const [selectedGame, setSelectedGame] = useState(initialGame);
  const [isSurvival, setIsSurvival] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [gameFilter, setGameFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [view, setView] = useState<LeaderboardView>("global");
  const { user } = useAuth();

  const { data: friends = [] } = useQuery<Array<{ id: number }>>({
    queryKey: ["/api/friends"],
    enabled: !!user,
  });
  const hasFriends = friends.length > 0;

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const filteredGames = gameFilter.trim()
    ? games.filter(g => g.name.toLowerCase().includes(gameFilter.trim().toLowerCase()))
    : games;

  const selectedGameObj = games.find(g => g.slug === selectedGame);
  const hasModes = !!(selectedGameObj?.modes && selectedGameObj.modes.length > 0);
  const showSurvivalToggle = !!(selectedGameObj?.hasSurvival);

  const isStreaks = selectedGame === "streaks";
  const cardTitle = selectedGame === "overall"
    ? "Overall Rankings"
    : isStreaks
    ? "Streak Rankings"
    : selectedGameObj?.name || "Rankings";

  function handleGameChange(slug: string) {
    setSelectedGame(slug);
    setIsSurvival(false);
    const params = new URLSearchParams();
    if (slug !== "overall") params.set("game", slug);
    setLocation(`/leaderboard${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
  }

  const noModeSlug = isSurvival ? `${selectedGame}-survival` : selectedGame;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
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

        <PremiumBanner />

        {/* Mobile: search + horizontal pill strip */}
        <div className="md:hidden space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
              placeholder="Search games…"
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-mobile-game-filter"
            />
          </div>
          <MobileGameStrip
            games={filteredGames}
            selectedGame={selectedGame}
            onSelect={handleGameChange}
          />
        </div>

        {/* Desktop: two-column layout */}
        <div className="flex gap-6 items-start">

          {/* Sidebar — desktop only */}
          <aside className="hidden md:flex flex-col w-52 shrink-0 sticky top-4">
            <div className="bg-card border rounded-xl p-2 space-y-0.5 max-h-[calc(100vh-12rem)] overflow-y-auto">
              <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Games
              </p>
              <div className="px-1 pb-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={gameFilter}
                    onChange={(e) => setGameFilter(e.target.value)}
                    placeholder="Filter games…"
                    className="h-7 pl-8 text-xs"
                    data-testid="input-game-filter"
                  />
                </div>
              </div>
              <GameSidebarItem
                slug="streaks"
                label="Streaks"
                icon="Flame"
                color="hsl(24, 95%, 53%)"
                isActive={selectedGame === "streaks"}
                onClick={() => handleGameChange("streaks")}
              />
              <GameSidebarItem
                slug="overall"
                label="Overall"
                isActive={selectedGame === "overall"}
                onClick={() => handleGameChange("overall")}
              />
              <div className="h-px bg-border mx-2 my-1" />
              {filteredGames.map((game) => (
                <GameSidebarItem
                  key={game.slug}
                  slug={game.slug}
                  label={game.name}
                  icon={game.icon}
                  color={game.color}
                  isActive={selectedGame === game.slug}
                  onClick={() => handleGameChange(game.slug)}
                />
              ))}
              {filteredGames.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground text-center">No games match</p>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            {showSurvivalToggle && !isStreaks && (
              <SurvivalToggle isSurvival={isSurvival} onChange={setIsSurvival} />
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {selectedGameObj ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: selectedGameObj.color }}
                        >
                          {(() => {
                            const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[selectedGameObj.icon] ?? LucideIcons.Gamepad2;
                            return <Icon className="h-4 w-4 text-white" />;
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{selectedGameObj.name}</span>
                          {showSurvivalToggle && (
                            <Badge variant={isSurvival ? "destructive" : "secondary"} className="text-xs gap-1">
                              {isSurvival ? <><Flame className="h-3 w-3" /> Survival</> : <><Timer className="h-3 w-3" /> Classic</>}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground" data-testid="text-total-plays">
                        <TrendingUp className="h-4 w-4" />
                        {selectedGameObj.playCount.toLocaleString()} total {selectedGameObj.playCount === 1 ? "play" : "plays"}
                      </span>
                    </div>
                  ) : isStreaks ? (
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <span>{cardTitle}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <span>{cardTitle}</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isStreaks && (
                  <div className="flex flex-wrap items-center gap-3">
                    {view === "global" && (
                      <TimeFilterBar value={timeFilter} onChange={setTimeFilter} />
                    )}
                    {user && hasFriends && (
                      <ViewToggle view={view} onChange={setView} />
                    )}
                  </div>
                )}

                {isStreaks ? (
                  <StreakLeaderboard user={user} onSignIn={() => setAuthOpen(true)} />
                ) : hasModes ? (
                  <ModeTabs
                    key={selectedGame}
                    modes={selectedGameObj!.modes!}
                    isSurvival={isSurvival}
                    user={user}
                    onSignIn={() => setAuthOpen(true)}
                    timeFilter={timeFilter}
                    view={view}
                  />
                ) : (
                  <LeaderboardEntries
                    slug={noModeSlug}
                    user={user}
                    onSignIn={() => setAuthOpen(true)}
                    timeFilter={timeFilter}
                    view={view}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
