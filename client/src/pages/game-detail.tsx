import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Play,
  X,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Swords,
  Trophy,
  User,
  Loader2,
  GraduationCap,
  Copy,
  CheckCheck,
  Sparkles,
  Pencil,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { PremiumBanner } from "@/components/premium-banner";
import { DuelChallengeDialog } from "@/components/duel-challenge-dialog";
import type { Game, FriendChallenge, QuizSession, DuelChallenge } from "@shared/schema";
import { SEEDED_GAME_SLUGS, QUIZ_MASTER_GAME_SLUGS, DUEL_GAME_SLUGS } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { CommentSection } from "@/components/comment-section";
import { LikeButton } from "@/components/like-button";
import { MiniLeaderboard } from "@/components/mini-leaderboard";
import { WordLadderGame } from "@/components/games/word-ladder";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { WordScrambleGame } from "@/components/games/word-scramble";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordMakerGame } from "@/components/games/word-maker";
import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { LetterHuntGame } from "@/components/games/letter-hunt";
import { WordChainGame } from "@/components/games/word-chain";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame, getLettersForCount, LETTER_FREQUENCY_CHALLENGE_COUNTS } from "@/components/games/letter-frequency";
import { WordStackGame } from "@/components/games/word-stack";
import { NoRepeatsGame } from "@/components/games/no-repeats";
import { WordSplitGame } from "@/components/games/word-split";
import { ProgressiveRevealGame } from "@/components/games/progressive-reveal";
import { WordSweepGame } from "@/components/games/word-sweep";
import { WordRootsGame } from "@/components/games/word-roots";
import { LadderRushGame } from "@/components/games/ladder-rush";
import { ShellWordsGame } from "@/components/games/shell-words";
import { DeepShellWordsGame } from "@/components/games/deep-shell-words";
import { WordStretchGame } from "@/components/games/word-stretch";
import { WordBloomGame } from "@/components/games/word-bloom";
import { LetterDodgeGame } from "@/components/games/letter-dodge";
import { QuizCreateDialog } from "./game-detail/QuizCreateDialog";
import { CustomPlayDialog } from "./game-detail/CustomPlayDialog";
import { ChallengeDialog } from "./game-detail/ChallengeDialog";

const difficultyColors = {
  easy: "bg-accent text-accent-foreground",
  medium: "bg-chart-3 text-white",
  hard: "bg-destructive text-destructive-foreground",
};

const LadderRushDoubleGame = (props: { groupSeed?: number; locked?: boolean }) =>
  <LadderRushGame {...props} doubleSwap />;

const gameComponents: Record<string, React.ComponentType<{ groupSeed?: number; locked?: boolean }>> = {
  "word-ladder": WordLadderGame,
  "anagram-solver": AnagramSolverGame,
  "word-scramble": WordScrambleGame,
  "definition-match": DefinitionMatchGame,
  "letter-pool": LetterPoolGame,
  "word-maker": WordMakerGame,
  "word-length": WordLengthGame,
  "letter-position": LetterPositionGame,
  "letter-hunt": LetterHuntGame,
  "word-chain": WordChainGame,
  "letter-balance": LetterBalanceGame,
  "letter-frequency": LetterFrequencyGame,
  "word-stack": WordStackGame,
  "no-repeats": NoRepeatsGame,
  "word-split": WordSplitGame,
  "progressive-reveal": ProgressiveRevealGame,
  "word-sweep": WordSweepGame,
  "word-roots": WordRootsGame,
  "ladder-rush": LadderRushGame,
  "ladder-rush-double": LadderRushDoubleGame,
  "shell-words": ShellWordsGame,
  "deep-shell-words": DeepShellWordsGame,
  "word-stretch": WordStretchGame,
  "word-bloom": WordBloomGame,
  "letter-dodge": LetterDodgeGame,
};

const CUSTOM_PLAY_SLUGS = new Set([
  "letter-position",
  "letter-hunt",
  "letter-frequency",
  "letter-balance",
  "word-length",
  "letter-dodge",
]);

const UNTIMED_GAME_SLUGS = new Set([
  "word-chain",
  "word-ladder",
  "letter-hunt",
  "word-scramble",
  "no-repeats",
]);

const LETTER_BALANCE_CATEGORIES_DETAIL = [
  { id: "consonant_count", name: "Consonant Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7] },
  { id: "vowel_count", name: "Vowel Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7] },
  { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "locked_balance", name: "Locked Balance", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10] },
] as const;

interface ChallengeResult {
  myScore: number;
  opponentScore: number;
  won: boolean;
  isSender: boolean;
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

export default function GameDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);
  const [urlCleaned, setUrlCleaned] = useState(false);
  const [lastPercentile, setLastPercentile] = useState<{ percentile: number; totalPlayers: number } | null>(null);
  const isTied = challengeResult ? challengeResult.myScore === challengeResult.opponentScore : false;
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const searchParams = new URLSearchParams(searchString);
  const [challengeId] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("challenge");
  });
  const challengeNewFriendId = searchParams.get("challenge-new");
  const challengeNewSeed = searchParams.get("seed");
  const challengeNewMsg = searchParams.get("msg");
  const challengeNewLbCategory = searchParams.get("lbCategory");
  const challengeNewLbLevel = searchParams.get("lbLevel");
  const challengeNewLbConsonantCount = searchParams.get("lbConsonantCount");

  const isReceiverMode = !!challengeId;
  const isSenderMode = !!challengeNewFriendId && !!challengeNewSeed;
  const groupSeedForGame = isSenderMode
    ? parseInt(challengeNewSeed!)
    : undefined;

  const { data: receiverChallenge, isLoading: challengeLoading, isError: challengeError } = useQuery<FriendChallenge>({
    queryKey: ["/api/challenges", challengeId],
    queryFn: async () => {
      const res = await fetch(`/api/challenges/${challengeId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Challenge not found");
      return res.json();
    },
    enabled: !!challengeId && isAuthenticated,
  });

  const opponentId = isReceiverMode ? receiverChallenge?.senderId : undefined;
  const { data: opponentProfile } = useQuery<{ user: { name: string } }>({
    queryKey: ["/api/users", opponentId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${opponentId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!opponentId,
  });
  const opponentName = opponentProfile?.user?.name;

  const receiverGroupSeed = receiverChallenge?.seed ?? undefined;
  const effectiveGroupSeed = isSenderMode ? groupSeedForGame : receiverGroupSeed;

  useEffect(() => {
    if (challengeId || challengeNewFriendId) setIsPlaying(true);
  }, [challengeId, challengeNewFriendId]);

  const createQuizHandledRef = useRef(false);
  useEffect(() => {
    if (createQuizHandledRef.current) return;
    if (searchParams.get("create-quiz") !== "1") return;
    if (!isAuthenticated || !slug || !QUIZ_MASTER_GAME_SLUGS.has(slug)) return;
    createQuizHandledRef.current = true;
    setShowQuizDialog(true);
    navigate(`/game/${slug}`, { replace: true });
  }, [isAuthenticated, slug, searchString]);

  useEffect(() => {
    if (!isReceiverMode) {
      setUrlCleaned(true);
      return;
    }
    if (!challengeLoading && receiverChallenge) {
      const url = new URL(window.location.href);
      url.searchParams.delete("challenge");
      window.history.replaceState(null, "", url.toString());
      setUrlCleaned(true);
    }
  }, [isReceiverMode, challengeLoading, receiverChallenge]);

  type LbGameConfig = { category: "locked_balance"; level: number; consonantCount: number };
  const submitChallengeMutation = useMutation({
    mutationFn: (payload: { friendId: number; gameSlug: string; score: number; seed: number; message?: string; gameConfig?: LbGameConfig }) =>
      apiRequest("POST", "/api/challenges", payload),
    onSuccess: () => {
      toast({ title: "Challenge sent!", description: "Your friend will be notified." });
      navigate(`/game/${slug}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/unread-count"] });
    },
    onError: (err: Error) => {
      let description = "Could not send challenge.";
      try {
        const body = JSON.parse(err.message.replace(/^\d+: /, ""));
        if (body?.error) description = body.error;
      } catch {}
      toast({ title: "Error", description, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, score }: { id: number; score: number }) => {
      const res = await apiRequest("POST", `/api/challenges/${id}/complete`, { score });
      return res.json() as Promise<{ receiverScore: number; senderScore: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      if (data) {
        const myScore = data.receiverScore ?? 0;
        const opponentScore = data.senderScore ?? 0;
        setChallengeResult({ myScore, opponentScore, won: myScore > opponentScore, isSender: false });
      }
    },
    onError: () => toast({ title: "Error", description: "Could not submit your score.", variant: "destructive" }),
  });

  const [isCustomPlay, setIsCustomPlay] = useState(false);
  const alreadySubmittedRef = useRef(false);

  useEffect(() => {
    if (!isPlaying || isCustomPlay) return;
    const handlePercentile = (e: Event) => {
      const { score } = (e as CustomEvent).detail;
      if (!score || score <= 0 || !slug) return;
      fetch(`/api/leaderboard/${encodeURIComponent(slug)}/percentile?score=${score}`)
        .then(r => r.json())
        .then(p => { if (p && typeof p.percentile === "number") setLastPercentile(p); })
        .catch(() => {});
    };
    window.addEventListener("wordplay-game-result", handlePercentile);
    return () => window.removeEventListener("wordplay-game-result", handlePercentile);
  }, [isPlaying, isCustomPlay, slug]);

  useEffect(() => {
    if (!isPlaying) return;
    if (!isSenderMode && !isReceiverMode) return;

    const handleResult = (e: Event) => {
      const { score } = (e as CustomEvent).detail;
      if (alreadySubmittedRef.current) return;
      alreadySubmittedRef.current = true;

      if (isSenderMode && challengeNewFriendId && challengeNewSeed) {
        const parsedFriendId = parseInt(challengeNewFriendId);
        const parsedSeed = parseInt(challengeNewSeed);
        if (isNaN(parsedFriendId) || isNaN(parsedSeed)) return;
        const lbGameConfig: LbGameConfig | undefined = (slug === "letter-balance" && challengeNewLbCategory === "locked_balance" && challengeNewLbLevel && challengeNewLbConsonantCount)
          ? { category: "locked_balance" as const, level: parseInt(challengeNewLbLevel), consonantCount: parseInt(challengeNewLbConsonantCount) }
          : undefined;
        submitChallengeMutation.mutate({
          friendId: parsedFriendId,
          gameSlug: slug!,
          score,
          seed: parsedSeed,
          message: challengeNewMsg || undefined,
          gameConfig: lbGameConfig,
        });
      } else if (isReceiverMode && challengeId && receiverChallenge) {
        if (receiverChallenge.status === "pending") {
          completeMutation.mutate({ id: parseInt(challengeId), score });
        }
      }
    };

    window.addEventListener("wordplay-game-result", handleResult);
    return () => window.removeEventListener("wordplay-game-result", handleResult);
  }, [isPlaying, isSenderMode, isReceiverMode, receiverChallenge, challengeId, challengeNewFriendId, challengeNewSeed, challengeNewMsg, slug]);

  const { data: game, isLoading, error } = useQuery<Game>({
    queryKey: ["/api/games", slug],
  });

  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: likeData } = useQuery<{ counts: Record<string, number>; likedByMe: Record<string, boolean> }>({
    queryKey: ["/api/likes", "game", slug],
    queryFn: async () => {
      const res = await fetch(`/api/likes?targetType=game&targetIds=${slug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: userStats = [] } = useQuery<Array<{ gameSlug: string; gamesPlayed: number; bestScore: number; lastScore?: number | null }>>({
    queryKey: ["/api/user/stats"],
    enabled: isAuthenticated,
  });

  const myGameStat = slug ? userStats.find(s => s.gameSlug === slug) : undefined;

  const { data: friends = [] } = useQuery<Array<{ id: number; friendUser: { id: number; name: string; avatarUrl: string | null } }>>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: openDuels = [] } = useQuery<Array<DuelChallenge & { challengerName: string | null; challengerAvatarUrl: string | null }>>({
    queryKey: ["/api/duels/open", slug],
    queryFn: async () => {
      const res = await fetch(`/api/duels/open?gameSlug=${slug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isAuthenticated && DUEL_GAME_SLUGS.has(slug ?? ""),
    refetchInterval: 15_000,
  });

  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [showCustomPlayDialog, setShowCustomPlayDialog] = useState(false);
  const [customPlayFrozenParams, setCustomPlayFrozenParams] = useState<Record<string, any>>({});
  const [customPlayKey, setCustomPlayKey] = useState(0);
  const [customPlayEnded, setCustomPlayEnded] = useState(false);
  const [isUntimed, setIsUntimed] = useState(false);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [showDuelDialog, setShowDuelDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Game not found.</p>
        </div>
      </div>
    );
  }

  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;
  const GameComponent = gameComponents[game.slug];

  const handleCustomPlay = (params: Record<string, any>) => {
    setCustomPlayFrozenParams(params);
    setCustomPlayEnded(false);
    setShowCustomPlayDialog(false);
    setIsCustomPlay(true);
    setIsPlaying(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href={challengeResult ? "/friends" : "/"}>
        <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          {challengeResult ? "Back to Friends" : "Back to Games"}
        </Button>
      </Link>

      <AnimatePresence mode="wait">
        {!isPlaying ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid lg:grid-cols-3 gap-8"
          >
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
                  {slug && (
                    <LikeButton
                      targetType="game"
                      targetId={slug}
                      initialCount={likeData?.counts[slug] ?? 0}
                      initialLikedByMe={likeData?.likedByMe[slug] ?? false}
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

              {/* More Games compact grid */}
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
                    onClick={() => setIsPlaying(true)}
                    data-testid="button-play"
                  >
                    <Play className="h-5 w-5" />
                    Play Now
                  </Button>
                  {isAuthenticated && slug && SEEDED_GAME_SLUGS.has(slug) && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowChallengeDialog(true)}
                      data-testid="button-challenge-friend"
                    >
                      <Swords className="h-4 w-4" />
                      Challenge a Player
                    </Button>
                  )}
                  {isAuthenticated && user?.isPremium && slug && (DUEL_GAME_SLUGS.has(slug) || slug === "ladder-rush" || slug === "ladder-rush-double") && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-violet-400 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                      onClick={() => setShowDuelDialog(true)}
                      data-testid="button-duel-friend"
                    >
                      <Swords className="h-4 w-4" />
                      Duel a Player
                    </Button>
                  )}
                  {isAuthenticated && slug && DUEL_GAME_SLUGS.has(slug) && openDuels.length > 0 && (
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
                  {isAuthenticated && slug && QUIZ_MASTER_GAME_SLUGS.has(slug) && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowQuizDialog(true)}
                      data-testid="button-create-quiz"
                    >
                      <GraduationCap className="h-4 w-4" />
                      Create Quiz Session
                    </Button>
                  )}
                  {isAuthenticated && user?.isPremium && slug && CUSTOM_PLAY_SLUGS.has(slug) && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                      onClick={() => setShowCustomPlayDialog(true)}
                      data-testid="button-custom-play"
                    >
                      <Sparkles className="h-4 w-4" />
                      Custom Play
                    </Button>
                  )}
                  {isAuthenticated && user?.isPremium && slug && UNTIMED_GAME_SLUGS.has(slug) && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                      onClick={() => { setIsUntimed(true); setIsPlaying(true); }}
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
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: game.color }}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold">{game.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsPlaying(false);
                    setIsCustomPlay(false);
                    setIsUntimed(false);
                    setChallengeResult(null);
                    alreadySubmittedRef.current = false;
                    if (challengeId || challengeNewFriendId) {
                      navigate(`/game/${slug}`, { replace: true });
                    }
                  }}
                  className="gap-1.5"
                  data-testid="button-close-game"
                >
                  <X className="h-4 w-4" />
                  Exit Game
                </Button>
              </div>
            </div>

            {isSenderMode && !challengeResult && (
              <Card className="mb-4 border-primary/30 bg-primary/5">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <Swords className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5" data-testid="text-challenge-mode-title">
                      {(() => {
                        const friend = friends.find(f => String(f.friendUser.id) === challengeNewFriendId);
                        if (!friend) return "Challenge Mode";
                        return (
                          <>
                            Challenging{" "}
                            <UserAvatar name={friend.friendUser.name} avatarUrl={friend.friendUser.avatarUrl} className="h-5 w-5 inline-block align-middle" />
                            {friend.friendUser.name}
                          </>
                        );
                      })()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Play your best — your score will be sent as a challenge when you finish!
                      {challengeNewMsg && ` "${challengeNewMsg}"`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isReceiverMode && receiverChallenge && receiverChallenge.status === "pending" && !challengeResult && (
              <Card className="mb-4 border-primary/30 bg-primary/5">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <Swords className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5" data-testid="text-challenge-banner-title">
                      Challenged by{" "}
                      <UserAvatar name={receiverChallenge.senderName ?? "Challenger"} avatarUrl={receiverChallenge.senderAvatarUrl} className="h-5 w-5 inline-block align-middle" />
                      {receiverChallenge.senderName ?? "a friend"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Score to beat: <strong>{receiverChallenge.senderScore} pts</strong>
                      {receiverChallenge.message && ` — "${receiverChallenge.message}"`}
                      {receiverChallenge.seed != null && " · Same puzzle as your friend"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isCustomPlay && (
              <Card className="mb-4 border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/10">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-amber-700 dark:text-amber-400">Custom Play Mode</p>
                    <p className="text-xs text-muted-foreground">Scores are not saved to the leaderboard in custom play.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isUntimed && (
              <Card className="mb-4 border-blue-400/50 bg-blue-50/50 dark:bg-blue-950/10">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <span className="text-xl text-blue-500 shrink-0 font-bold leading-none">∞</span>
                  <div>
                    <p className="font-medium text-sm text-blue-700 dark:text-blue-400">Untimed Mode</p>
                    <p className="text-xs text-muted-foreground">No timer — play at your own pace. Scores are tracked but not submitted to the global leaderboard.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {(completeMutation.isPending || submitChallengeMutation.isPending) && (
              <Card className="mb-4 border-muted">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Submitting your score...</p>
                </CardContent>
              </Card>
            )}

            {challengeResult && (() => {
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
            })()}

            {isReceiverMode && challengeError ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="font-medium mb-2">Challenge not found</p>
                  <p className="text-sm text-muted-foreground mb-4">This challenge may have expired or you may not have permission to view it.</p>
                  <Link href="/friends">
                    <Button size="sm" variant="outline">Back to Friends</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : isReceiverMode && (challengeLoading || !urlCleaned) ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading challenge...</p>
                </CardContent>
              </Card>
            ) : isCustomPlay && slug === "letter-position" ? (
              <LetterPositionGame
                key={customPlayKey}
                initialChallenge={(customPlayFrozenParams.letter && customPlayFrozenParams.position ? 1 : 2) as 1 | 2}
                initialLetter={customPlayFrozenParams.letter as string | undefined}
                initialPosition={customPlayFrozenParams.position ? Number(customPlayFrozenParams.position) : undefined}
                initialSurvival={customPlayFrozenParams.survival === true}
                initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
                initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
                onGameEnd={() => setCustomPlayEnded(true)}
                onPlayAgain={() => { setCustomPlayEnded(false); setCustomPlayKey(k => k + 1); }}
                locked
                quizMode
                customPlay
              />
            ) : isCustomPlay && slug === "letter-hunt" ? (
              <LetterHuntGame
                key={customPlayKey}
                initialChallenge={(() => {
                  const c = customPlayFrozenParams.challenge;
                  if (c === undefined) return (Math.floor(Math.random() * 5) + 1) as 1 | 2 | 3 | 4 | 5;
                  if (c === "advanced") return "advanced" as const;
                  return Math.min(5, Math.max(1, Number(c) || 1)) as 1 | 2 | 3 | 4 | 5;
                })()}
                initialLetters={customPlayFrozenParams.letters as string[] | undefined}
                initialSurvival={customPlayFrozenParams.survival === true}
                initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
                initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
                onGameEnd={() => setCustomPlayEnded(true)}
                onPlayAgain={() => { setCustomPlayEnded(false); setCustomPlayKey(k => k + 1); }}
                locked
                quizMode
                customPlay
              />
            ) : isCustomPlay && slug === "letter-frequency" ? (
              <LetterFrequencyGame
                key={customPlayKey}
                initialChallenge={(() => {
                  const c = customPlayFrozenParams.challenge;
                  if (c === undefined) {
                    const auto = ([1, 2, 3, 4] as const)[Math.floor(Math.random() * 4)];
                    return auto;
                  }
                  if (c === "multi") return "multi" as const;
                  const n = Math.min(4, Math.max(1, Number(c) || 1));
                  return n as 1 | 2 | 3 | 4;
                })()}
                initialLetter={customPlayFrozenParams.letter || undefined}
                initialLetters={Array.isArray(customPlayFrozenParams.letters) ? customPlayFrozenParams.letters : undefined}
                initialLetterCounts={Array.isArray(customPlayFrozenParams.letterCounts) ? customPlayFrozenParams.letterCounts as number[] : undefined}
                initialSurvival={customPlayFrozenParams.survival === true}
                initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
                initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
                onGameEnd={() => setCustomPlayEnded(true)}
                onPlayAgain={() => { setCustomPlayEnded(false); setCustomPlayKey(k => k + 1); }}
                locked
                quizMode
                customPlay
              />
            ) : isCustomPlay && slug === "letter-balance" ? (
              <LetterBalanceGame
                key={customPlayKey}
                customConstraint={
                  customPlayFrozenParams.vowels !== undefined || customPlayFrozenParams.consonants !== undefined
                    ? { vowels: customPlayFrozenParams.vowels, consonants: customPlayFrozenParams.consonants, length: customPlayFrozenParams.length }
                    : undefined
                }
                initialChallenge={
                  customPlayFrozenParams.category !== undefined
                    ? { category: customPlayFrozenParams.category, level: customPlayFrozenParams.level ?? 4, consonantCount: customPlayFrozenParams.consonantCount }
                    : undefined
                }
                initialSurvival={customPlayFrozenParams.survival === true}
                initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
                initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
                onGameEnd={() => setCustomPlayEnded(true)}
                onPlayAgain={() => { setCustomPlayEnded(false); setCustomPlayKey(k => k + 1); }}
                locked
                quizMode
                customPlay
              />
            ) : isCustomPlay && slug === "word-length" ? (
              <WordLengthGame
                key={customPlayKey}
                customConstraint={(customPlayFrozenParams.length as number | undefined) ? { length: customPlayFrozenParams.length as number, startsWith: customPlayFrozenParams.startsWith as string | undefined, endsWith: customPlayFrozenParams.endsWith as string | undefined, contains: customPlayFrozenParams.contains as string | undefined } : undefined}
                initialVariation={(customPlayFrozenParams.length as number | undefined) ? undefined : (Math.min(5, Math.max(1, Number(customPlayFrozenParams.variation) || 1)) as 1 | 2 | 3 | 4 | 5)}
                initialSurvival={customPlayFrozenParams.survival === true}
                initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
                initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
                onGameEnd={() => setCustomPlayEnded(true)}
                onPlayAgain={() => { setCustomPlayEnded(false); setCustomPlayKey(k => k + 1); }}
                locked
                quizMode
                customPlay
              />
            ) : isCustomPlay && slug === "letter-dodge" ? (
              <LetterDodgeGame
                key={customPlayKey}
                initialDifficulty={(() => {
                  const d = customPlayFrozenParams.difficulty;
                  if (d === "advanced") return "advanced" as const;
                  if (d !== undefined) return Math.min(5, Math.max(1, Number(d) || 1)) as 1 | 2 | 3 | 4 | 5;
                  return undefined;
                })()}
                initialForbiddenLetters={customPlayFrozenParams.letters as string[] | undefined}
                initialSurvival={customPlayFrozenParams.survival === true}
                initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
                initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
                onGameEnd={() => setCustomPlayEnded(true)}
                onPlayAgain={() => { setCustomPlayEnded(false); setCustomPlayKey(k => k + 1); }}
                locked
                quizMode
                customPlay
              />
            ) : (isSenderMode || isReceiverMode) && slug === "letter-balance" ? (() => {
              const senderLbConfig = (challengeNewLbCategory === "locked_balance" && challengeNewLbLevel && challengeNewLbConsonantCount)
                ? { category: "locked_balance" as const, level: parseInt(challengeNewLbLevel), consonantCount: parseInt(challengeNewLbConsonantCount) }
                : undefined;
              const receiverLbConfig = (() => {
                if (!receiverChallenge?.gameConfig) return undefined;
                try {
                  const cfg = JSON.parse(receiverChallenge.gameConfig);
                  if (cfg?.category === "locked_balance" && cfg.level && cfg.consonantCount) {
                    return { category: "locked_balance" as const, level: cfg.level as number, consonantCount: cfg.consonantCount as number };
                  }
                } catch {}
                return undefined;
              })();
              const lbConfig = isSenderMode ? senderLbConfig : receiverLbConfig;
              return (
                <LetterBalanceGame
                  initialChallenge={lbConfig}
                  groupSeed={effectiveGroupSeed}
                  locked
                />
              );
            })() : isUntimed && slug === "word-chain" ? (
              <WordChainGame isUntimed locked={isSenderMode || isReceiverMode} />
            ) : isUntimed && slug === "word-ladder" ? (
              <WordLadderGame isUntimed locked={isSenderMode || isReceiverMode} />
            ) : isUntimed && slug === "letter-hunt" ? (
              <LetterHuntGame isUntimed locked={isSenderMode || isReceiverMode} />
            ) : isUntimed && slug === "word-scramble" ? (
              <WordScrambleGame isUntimed locked={isSenderMode || isReceiverMode} />
            ) : isUntimed && slug === "no-repeats" ? (
              <NoRepeatsGame isUntimed locked={isSenderMode || isReceiverMode} />
            ) : GameComponent ? (
              <GameComponent groupSeed={effectiveGroupSeed} locked={isSenderMode || isReceiverMode} />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    This game is coming soon!
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <QuizCreateDialog
        open={showQuizDialog}
        onOpenChange={setShowQuizDialog}
        slug={slug}
        game={game}
        navigate={navigate}
      />
      <CustomPlayDialog
        open={showCustomPlayDialog}
        onOpenChange={setShowCustomPlayDialog}
        slug={slug}
        game={game}
        onPlay={handleCustomPlay}
      />
      <ChallengeDialog
        open={showChallengeDialog}
        onOpenChange={setShowChallengeDialog}
        slug={slug}
        game={game}
        friends={friends}
        navigate={navigate}
      />
            <DuelChallengeDialog gameSlug={slug} open={showDuelDialog} onOpenChange={setShowDuelDialog} />
    </div>
  );
}
