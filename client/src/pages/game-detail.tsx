import { PageSEO } from "@/components/page-seo";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { DuelChallengeDialog } from "@/components/duel-challenge-dialog";
import type { Game, FriendChallenge, DuelChallenge } from "@shared/schema";
import { QUIZ_MASTER_GAME_SLUGS, DUEL_GAME_SLUGS } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QuizCreateDialog } from "./game-detail/QuizCreateDialog";
import { CustomPlayDialog } from "./game-detail/CustomPlayDialog";
import { ChallengeDialog } from "./game-detail/ChallengeDialog";
import { GameDetailSidebar } from "./game-detail/GameDetailSidebar";
import { GameDetailInfo } from "./game-detail/GameDetailInfo";
import { GamePlayArea } from "./game-detail/GamePlayArea";
import type { ChallengeResult } from "./game-detail/constants";

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

  const handleExit = () => {
    setIsPlaying(false);
    setIsCustomPlay(false);
    setIsUntimed(false);
    setChallengeResult(null);
    alreadySubmittedRef.current = false;
    if (challengeId || challengeNewFriendId) {
      navigate(`/game/${slug}`, { replace: true });
    }
  };

  const handleCustomPlay = (params: Record<string, any>) => {
    setCustomPlayFrozenParams(params);
    setCustomPlayEnded(false);
    setShowCustomPlayDialog(false);
    setIsCustomPlay(true);
    setIsPlaying(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <PageSEO
        title={game?.name ?? "Word Game"}
        description={game ? `Play ${game.name} — ${game.description ?? "a fun vocabulary challenge on xtraWordinary."}` : "Play word games on xtraWordinary."}
        path={`/game/${slug}`}
      />
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
            <GameDetailInfo
              game={game}
              allGames={allGames}
              isAuthenticated={isAuthenticated}
              myGameStat={myGameStat}
              lastPercentile={lastPercentile}
              likeData={likeData}
            />
            <GameDetailSidebar
              slug={slug}
              game={game}
              isAuthenticated={isAuthenticated}
              isPremium={!!user?.isPremium}
              openDuels={openDuels}
              onPlay={() => setIsPlaying(true)}
              onChallenge={() => setShowChallengeDialog(true)}
              onDuel={() => setShowDuelDialog(true)}
              onQuiz={() => setShowQuizDialog(true)}
              onCustomPlay={() => setShowCustomPlayDialog(true)}
              onUntimed={() => { setIsUntimed(true); setIsPlaying(true); }}
            />
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
            <GamePlayArea
              game={game}
              slug={slug}
              onExit={handleExit}
              isSenderMode={isSenderMode}
              isReceiverMode={isReceiverMode}
              challengeNewFriendId={challengeNewFriendId}
              challengeNewMsg={challengeNewMsg}
              challengeNewLbCategory={challengeNewLbCategory}
              challengeNewLbLevel={challengeNewLbLevel}
              challengeNewLbConsonantCount={challengeNewLbConsonantCount}
              receiverChallenge={receiverChallenge}
              challengeLoading={challengeLoading}
              challengeError={challengeError}
              urlCleaned={urlCleaned}
              effectiveGroupSeed={effectiveGroupSeed}
              friends={friends}
              challengeResult={challengeResult}
              isTied={isTied}
              opponentName={opponentName}
              isSubmitting={completeMutation.isPending || submitChallengeMutation.isPending}
              isCustomPlay={isCustomPlay}
              customPlayFrozenParams={customPlayFrozenParams}
              customPlayKey={customPlayKey}
              onCustomPlayEnd={() => setCustomPlayEnded(true)}
              onCustomPlayAgain={() => { setCustomPlayEnded(false); setCustomPlayKey(k => k + 1); }}
              isUntimed={isUntimed}
            />          </motion.div>
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
