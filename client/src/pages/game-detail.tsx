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
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Play,
  X,
  CheckCircle,
  Swords,
  Trophy,
  User,
  Loader2,
  GraduationCap,
  Copy,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { PremiumBanner } from "@/components/premium-banner";
import type { Game, FriendChallenge, QuizSession } from "@shared/schema";
import { SEEDED_GAME_SLUGS, QUIZ_MASTER_GAME_SLUGS } from "@shared/schema";
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
import { LetterBalanceGame, VariationCategory } from "@/components/games/letter-balance";
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
};

const CUSTOM_PLAY_SLUGS = new Set([
  "letter-position",
  "letter-hunt",
  "letter-frequency",
  "letter-balance",
  "word-length",
]);

const LETTER_BALANCE_CATEGORIES_DETAIL = [
  { id: "consonant_count", name: "Consonant Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7] },
  { id: "vowel_count", name: "Vowel Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7] },
  { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "consonant_oblivion", name: "Consonant Oblivion", levelType: "count", levels: [2, 3, 4, 5] },
  { id: "vowel_oblivion", name: "Vowel Oblivion", levelType: "count", levels: [2, 3, 4, 5] },
] as const;

interface ChallengeResult {
  myScore: number;
  opponentScore: number;
  won: boolean;
  isSender: boolean;
}

export default function GameDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);
  const [urlCleaned, setUrlCleaned] = useState(false);
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

  const submitChallengeMutation = useMutation({
    mutationFn: (payload: { friendId: number; gameSlug: string; score: number; seed: number; message?: string }) =>
      apiRequest("POST", "/api/challenges", payload),
    onSuccess: () => {
      toast({ title: "Challenge sent!", description: "Your friend will be notified." });
      navigate(`/game/${slug}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
    },
    onError: () => toast({ title: "Error", description: "Could not send challenge.", variant: "destructive" }),
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

  const alreadySubmittedRef = useRef(false);

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
        submitChallengeMutation.mutate({
          friendId: parsedFriendId,
          gameSlug: slug!,
          score,
          seed: parsedSeed,
          message: challengeNewMsg || undefined,
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

  const { data: likeData } = useQuery<{ counts: Record<string, number>; likedByMe: Record<string, boolean> }>({
    queryKey: ["/api/likes", "game", slug],
    queryFn: async () => {
      const res = await fetch(`/api/likes?targetType=game&targetIds=${slug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: friends = [] } = useQuery<Array<{ id: number; friendUser: { id: number; name: string; avatarUrl: string | null } }>>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [challengeMsg, setChallengeMsg] = useState("");
  const [showCustomPlayDialog, setShowCustomPlayDialog] = useState(false);
  const [customPlayParams, setCustomPlayParams] = useState<Record<string, any>>({});
  const [isCustomPlay, setIsCustomPlay] = useState(false);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [createdQuiz, setCreatedQuiz] = useState<QuizSession | null>(null);
  const [quizLinkCopied, setQuizLinkCopied] = useState(false);
  const [quizClosesAt, setQuizClosesAt] = useState("");
  const [quizParams, setQuizParams] = useState<Record<string, any>>({});

  const LP_QUIZ_MIN_WORDS = 10;
  const WL_MIN_WORDS = 10;
  const lpLetter = quizParams.letter as string | undefined;
  const lpPosition = quizParams.position as number | undefined;
  const { data: lpCountData, isFetching: lpCountFetching } = useQuery<{ count: number }>({
    queryKey: ["/api/games/letter-position/validate", lpLetter, lpPosition],
    queryFn: async () => {
      const res = await fetch(`/api/games/letter-position/validate?letter=${lpLetter}&position=${lpPosition}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "letter-position" && !!lpLetter && !!lpPosition,
    staleTime: Infinity,
  });

  const customLpLetter = (customPlayParams.letter as string | undefined)?.toUpperCase() || undefined;
  const customLpPosition = customPlayParams.position ? Number(customPlayParams.position) : undefined;
  const { data: customLpCountData, isFetching: customLpCountFetching } = useQuery<{ count: number }>({
    queryKey: ["/api/games/letter-position/validate", customLpLetter, customLpPosition],
    queryFn: async () => {
      const res = await fetch(`/api/games/letter-position/validate?letter=${customLpLetter}&position=${customLpPosition}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "letter-position" && !!customLpLetter && !!customLpPosition,
    staleTime: Infinity,
  });

  const wlQuizLength = quizParams.length as number | undefined;
  const wlQuizStartsWith = quizParams.startsWith as string | undefined;
  const wlQuizEndsWith = quizParams.endsWith as string | undefined;
  const wlQuizContains = quizParams.contains as string | undefined;
  const wlQuizQs = new URLSearchParams({ ...(wlQuizLength ? { length: String(wlQuizLength) } : {}), ...(wlQuizStartsWith ? { startsWith: wlQuizStartsWith } : {}), ...(wlQuizEndsWith ? { endsWith: wlQuizEndsWith } : {}), ...(wlQuizContains ? { contains: wlQuizContains } : {}) });
  const { data: wlQuizCountData, isFetching: wlQuizCountFetching } = useQuery<{ count: number; ok: boolean }>({
    queryKey: ["/api/games/word-length/validate", wlQuizLength, wlQuizStartsWith, wlQuizEndsWith, wlQuizContains],
    queryFn: async () => {
      const res = await fetch(`/api/games/word-length/validate?${wlQuizQs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "word-length" && !!wlQuizLength,
    staleTime: Infinity,
  });

  const wlCustomLength = customPlayParams.length as number | undefined;
  const wlCustomStartsWith = customPlayParams.startsWith as string | undefined;
  const wlCustomEndsWith = customPlayParams.endsWith as string | undefined;
  const wlCustomContains = customPlayParams.contains as string | undefined;
  const wlCustomQs = new URLSearchParams({ ...(wlCustomLength ? { length: String(wlCustomLength) } : {}), ...(wlCustomStartsWith ? { startsWith: wlCustomStartsWith } : {}), ...(wlCustomEndsWith ? { endsWith: wlCustomEndsWith } : {}), ...(wlCustomContains ? { contains: wlCustomContains } : {}) });
  const { data: wlCustomCountData, isFetching: wlCustomCountFetching } = useQuery<{ count: number; ok: boolean }>({
    queryKey: ["/api/games/word-length/validate", wlCustomLength, wlCustomStartsWith, wlCustomEndsWith, wlCustomContains],
    queryFn: async () => {
      const res = await fetch(`/api/games/word-length/validate?${wlCustomQs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: slug === "word-length" && !!wlCustomLength,
    staleTime: Infinity,
  });

  const createQuizMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/quiz-sessions", {
      gameSlug: slug,
      title: quizTitle.trim(),
      closesAt: quizClosesAt ? new Date(quizClosesAt).toISOString() : null,
      params: slug === "letter-position"
        ? { ...quizParams, mode: 1 }
        : (Object.keys(quizParams).length > 0 ? quizParams : null),
    }),
    onSuccess: async (res: any) => {
      const data: QuizSession = await res.json();
      setCreatedQuiz(data);
      setQuizTitle("");
    },
    onError: () => toast({ title: "Error", description: "Could not create quiz session.", variant: "destructive" }),
  });

  const handleCopyQuizLink = () => {
    if (!createdQuiz) return;
    const link = `${window.location.origin}/quiz/${createdQuiz.shareCode}`;
    navigator.clipboard.writeText(link);
    setQuizLinkCopied(true);
    setTimeout(() => setQuizLinkCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
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

  const handleStartChallenge = () => {
    if (!selectedFriendId) return;
    const seed = Math.floor(Math.random() * 1000000);
    const msgParam = challengeMsg ? `&msg=${encodeURIComponent(challengeMsg)}` : "";
    setShowChallengeDialog(false);
    setSelectedFriendId("");
    setChallengeMsg("");
    navigate(`/game/${slug}?challenge-new=${selectedFriendId}&seed=${seed}${msgParam}`);
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
              <div
                className="h-48 sm:h-64 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: game.color }}
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, type: "spring" }}
                >
                  <IconComponent className="h-24 w-24 sm:h-32 sm:w-32 text-white drop-shadow-lg" />
                </motion.div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl font-bold">{game.name}</h1>
                  <Badge
                    className={`text-sm ${difficultyColors[game.difficulty]}`}
                    data-testid="badge-difficulty"
                  >
                    {game.difficulty}
                  </Badge>
                </div>

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
                  {isAuthenticated && friends.length > 0 && slug && SEEDED_GAME_SLUGS.has(slug) && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowChallengeDialog(true)}
                      data-testid="button-challenge-friend"
                    >
                      <Swords className="h-4 w-4" />
                      Challenge a Friend
                    </Button>
                  )}
                  {isAuthenticated && user?.isPremium && slug && QUIZ_MASTER_GAME_SLUGS.has(slug) && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => { setCreatedQuiz(null); setShowQuizDialog(true); }}
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
                      onClick={() => { setCustomPlayParams({}); setShowCustomPlayDialog(true); }}
                      data-testid="button-custom-play"
                    >
                      <Sparkles className="h-4 w-4" />
                      Custom Play
                    </Button>
                  )}
                </CardContent>
              </Card>
              <PremiumBanner />
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPlaying(false);
                  setIsCustomPlay(false);
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
                    <div className="flex gap-6 text-sm">
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
                initialChallenge={(customPlayParams.letter && customPlayParams.position ? 1 : 2) as 1 | 2}
                initialLetter={customPlayParams.letter as string | undefined}
                initialPosition={customPlayParams.position ? Number(customPlayParams.position) : undefined}
                initialSurvival={customPlayParams.survival === true}
                locked
                quizMode
              />
            ) : isCustomPlay && slug === "letter-hunt" ? (
              <LetterHuntGame
                initialChallenge={(() => {
                  const c = customPlayParams.challenge;
                  if (c === undefined) return (Math.floor(Math.random() * 5) + 1) as 1 | 2 | 3 | 4 | 5;
                  if (c === "advanced") return "advanced" as const;
                  return Math.min(5, Math.max(1, Number(c) || 1)) as 1 | 2 | 3 | 4 | 5;
                })()}
                initialLetters={customPlayParams.letters as string[] | undefined}
                initialSurvival={customPlayParams.survival === true}
                locked
                quizMode
              />
            ) : isCustomPlay && slug === "letter-frequency" ? (
              <LetterFrequencyGame
                initialChallenge={(() => {
                  const c = customPlayParams.challenge ?? 1;
                  if (c === "multi") return "multi" as const;
                  const n = Math.min(4, Math.max(1, Number(c) || 1));
                  return n as 1 | 2 | 3 | 4;
                })()}
                initialLetter={customPlayParams.letter || undefined}
                initialSurvival={customPlayParams.survival === true}
                locked
                quizMode
              />
            ) : isCustomPlay && slug === "letter-balance" ? (
              <LetterBalanceGame
                customConstraint={
                  customPlayParams.vowels !== undefined || customPlayParams.consonants !== undefined
                    ? { vowels: customPlayParams.vowels, consonants: customPlayParams.consonants, length: customPlayParams.length }
                    : undefined
                }
                locked
                quizMode
              />
            ) : isCustomPlay && slug === "word-length" ? (
              <WordLengthGame
                customConstraint={wlCustomLength ? { length: wlCustomLength, startsWith: wlCustomStartsWith, endsWith: wlCustomEndsWith, contains: wlCustomContains } : undefined}
                initialVariation={wlCustomLength ? undefined : (Math.min(5, Math.max(1, Number(customPlayParams.variation) || 1)) as 1 | 2 | 3 | 4 | 5)}
                initialSurvival={customPlayParams.survival === true}
                locked
                quizMode
              />
            ) : GameComponent ? (
              <GameComponent groupSeed={effectiveGroupSeed} />
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

      <Dialog open={showQuizDialog} onOpenChange={(open) => { setShowQuizDialog(open); if (!open) { setCreatedQuiz(null); setQuizParams({}); setQuizClosesAt(""); setQuizTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Create Quiz Session
            </DialogTitle>
          </DialogHeader>
          {!createdQuiz ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a shareable quiz in <strong>{game.name}</strong>. Anyone with the link can play and submit their score.
              </p>
              <div>
                <label className="text-sm font-medium">Session Title</label>
                <Input
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="e.g. Friday Quiz Night"
                  maxLength={200}
                  data-testid="input-quiz-title"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Close Date (optional)</label>
                <Input
                  type="datetime-local"
                  value={quizClosesAt}
                  onChange={(e) => setQuizClosesAt(e.target.value)}
                  data-testid="input-quiz-closes-at"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty to keep accepting submissions indefinitely.</p>
              </div>
              {slug === "letter-pool" && (
                <div>
                  <label className="text-sm font-medium">Pool Mode</label>
                  <div className="flex gap-2 mt-1">
                    {(["with-pool", "without-pool"] as const).map(v => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={quizParams.variant === v ? "default" : "outline"}
                        onClick={() => setQuizParams(p => ({ ...p, variant: v }))}
                        data-testid={`button-quiz-pool-${v}`}
                      >
                        {v === "with-pool" ? "With Pool" : "Without Pool"}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {slug === "letter-position" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Letter</label>
                    <Select
                      value={quizParams.letter ?? ""}
                      onValueChange={(v) => setQuizParams(p => ({ ...p, letter: v || undefined }))}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-quiz-lp-letter">
                        <SelectValue placeholder="Pick a letter (A–Z)" />
                      </SelectTrigger>
                      <SelectContent>
                        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Position (1 = first letter)</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {([1, 2, 3, 4, 5, 6, 7, 8] as const).map(p => (
                        <Button
                          key={p}
                          type="button"
                          size="sm"
                          variant={quizParams.position === p ? "default" : "outline"}
                          onClick={() => setQuizParams(prev => ({ ...prev, position: p }))}
                          data-testid={`button-quiz-lp-pos-${p}`}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {lpLetter && lpPosition && (
                    <p className={`text-xs ${lpCountFetching ? "text-muted-foreground" : (lpCountData?.count ?? LP_QUIZ_MIN_WORDS) < LP_QUIZ_MIN_WORDS ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-lp-word-count">
                      {lpCountFetching
                        ? "Checking…"
                        : lpCountData === undefined
                          ? ""
                          : lpCountData.count < LP_QUIZ_MIN_WORDS
                            ? `Only ${lpCountData.count} word${lpCountData.count !== 1 ? "s" : ""} match — need at least ${LP_QUIZ_MIN_WORDS}. Try a different letter or position.`
                            : `${lpCountData.count} words match`}
                    </p>
                  )}
                </div>
              )}
              {slug === "word-length" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Exact Word Length (3–12)</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {Array.from({ length: 10 }, (_, i) => i + 3).map(n => (
                        <Button
                          key={n}
                          type="button"
                          size="sm"
                          variant={quizParams.length === n ? "default" : "outline"}
                          onClick={() => setQuizParams(p => ({ ...p, length: n }))}
                          data-testid={`button-quiz-wl-length-${n}`}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {quizParams.length && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-medium">Starts with</label>
                          <Select
                            value={quizParams.startsWith ?? "any"}
                            onValueChange={(v) => setQuizParams(p => ({ ...p, startsWith: v === "any" ? undefined : v }))}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-wl-starts"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium">Ends with</label>
                          <Select
                            value={quizParams.endsWith ?? "any"}
                            onValueChange={(v) => setQuizParams(p => ({ ...p, endsWith: v === "any" ? undefined : v }))}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-wl-ends"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium">Contains</label>
                          <Select
                            value={quizParams.contains ?? "any"}
                            onValueChange={(v) => setQuizParams(p => ({ ...p, contains: v === "any" ? undefined : v }))}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-wl-contains"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className={`text-xs ${wlQuizCountFetching ? "text-muted-foreground" : !wlQuizCountData ? "" : !wlQuizCountData.ok ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-wl-quiz-word-count">
                        {wlQuizCountFetching ? "Checking…" : !wlQuizCountData ? "" : !wlQuizCountData.ok ? `Only ${wlQuizCountData.count} matching words — need at least ${WL_MIN_WORDS}. Adjust filters.` : `${wlQuizCountData.count} words match ✓`}
                      </p>
                    </>
                  )}
                </div>
              )}
              {slug === "letter-hunt" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Letter Count</label>
                    <Select
                      value={quizParams.challenge !== undefined ? String(quizParams.challenge) : "auto"}
                      onValueChange={(v) => {
                        if (v === "auto") {
                          setQuizParams(p => { const n = { ...p }; delete n.challenge; delete n.letters; return n; });
                        } else {
                          const c = Number(v);
                          setQuizParams(p => ({ ...p, challenge: c, letters: Array(c + 1).fill("any") }));
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-quiz-hunt-challenge">
                        <SelectValue placeholder="Auto (seed-derived)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (seed-derived)</SelectItem>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)} data-testid={`select-quiz-hunt-challenge-${n}`}>{n + 1} letters</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {typeof quizParams.challenge === "number" && (
                    <div>
                      <label className="text-sm font-medium">Pin Letters (optional)</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Array.from({ length: quizParams.challenge + 1 }).map((_, i) => (
                          <Select
                            key={i}
                            value={(quizParams.letters?.[i]) || "any"}
                            onValueChange={(v) => setQuizParams(p => {
                              const letters = [...(p.letters ?? Array(p.challenge + 1).fill("any"))];
                              letters[i] = v;
                              return { ...p, letters };
                            })}
                          >
                            <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-quiz-hunt-letter-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a specific letter.</p>
                    </div>
                  )}
                </div>
              )}
              {slug === "letter-frequency" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Frequency Challenge</label>
                    <Select
                      value={quizParams.challenge !== undefined ? String(quizParams.challenge) : ""}
                      onValueChange={(v) => {
                        const c = v === "multi" ? "multi" : Number(v);
                        setQuizParams(p => ({ ...p, challenge: c === 0 ? undefined : c, letter: c === "multi" ? undefined : p.letter }));
                      }}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-quiz-freq-challenge">
                        <SelectValue placeholder="Auto (seed-derived)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Challenge 1 (exactly 2×)</SelectItem>
                        <SelectItem value="2">Challenge 2 (exactly 3×)</SelectItem>
                        <SelectItem value="3">Challenge 3 (exactly 4×)</SelectItem>
                        <SelectItem value="4">Challenge 4 (5× or more)</SelectItem>
                        <SelectItem value="multi">Multi-Letter (2+ letters)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {quizParams.challenge && quizParams.challenge !== "multi" && (
                    <div>
                      <label className="text-sm font-medium">Specific Letter (optional)</label>
                      {(() => {
                        const c = quizParams.challenge;
                        const validLetters = (typeof c === "number" && c >= 1 && c <= 4)
                          ? getLettersForCount(LETTER_FREQUENCY_CHALLENGE_COUNTS[c as 1 | 2 | 3 | 4])
                          : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
                        return (
                          <Select
                            value={quizParams.letter ?? "any"}
                            onValueChange={(v) => setQuizParams(p => ({ ...p, letter: v === "any" ? undefined : v }))}
                          >
                            <SelectTrigger className="mt-1" data-testid="select-quiz-freq-letter">
                              <SelectValue placeholder="Any compatible letter" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any compatible letter</SelectItem>
                              {validLetters.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
              {slug === "letter-balance" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Set vowel and/or consonant counts (at least one required). Length is optional.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium">Vowels</label>
                      <Select
                        value={quizParams.vowels !== undefined ? String(quizParams.vowels) : "any"}
                        onValueChange={(v) => setQuizParams(p => ({ ...p, vowels: v === "any" ? undefined : Number(v) }))}
                      >
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-lb-vowels"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {[1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Consonants</label>
                      <Select
                        value={quizParams.consonants !== undefined ? String(quizParams.consonants) : "any"}
                        onValueChange={(v) => setQuizParams(p => ({ ...p, consonants: v === "any" ? undefined : Number(v) }))}
                      >
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-lb-consonants"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {[1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Length</label>
                      <Select
                        value={quizParams.length !== undefined ? String(quizParams.length) : "any"}
                        onValueChange={(v) => setQuizParams(p => ({ ...p, length: v === "any" ? undefined : Number(v) }))}
                      >
                        <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-quiz-lb-length"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          {Array.from({ length: 10 }, (_, i) => i + 3).map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {quizParams.vowels === undefined && quizParams.consonants === undefined && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Set at least vowels or consonants to configure this quiz.</p>
                  )}
                </div>
              )}
              {(slug === "word-length" || slug === "letter-hunt" || slug === "letter-position" || slug === "letter-frequency") && (
                <div>
                  <label className="text-sm font-medium">Mode</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={!quizParams.survival ? "default" : "outline"}
                      onClick={() => setQuizParams(p => { const n = { ...p }; delete n.survival; return n; })}
                      data-testid="button-quiz-mode-classic"
                    >
                      Classic
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={quizParams.survival ? "default" : "outline"}
                      onClick={() => setQuizParams(p => ({ ...p, survival: true }))}
                      data-testid="button-quiz-mode-survival"
                    >
                      Survival (8s/word)
                    </Button>
                  </div>
                </div>
              )}
              <Button
                className="w-full gap-2"
                onClick={() => createQuizMutation.mutate()}
                disabled={
                  !quizTitle.trim() ||
                  createQuizMutation.isPending ||
                  (slug === "letter-position" && (
                    !lpLetter || !lpPosition ||
                    lpCountFetching ||
                    lpCountData === undefined ||
                    lpCountData.count < LP_QUIZ_MIN_WORDS
                  )) ||
                  (slug === "word-length" && (!wlQuizLength || wlQuizCountFetching || !wlQuizCountData || !wlQuizCountData.ok)) ||
                  (slug === "letter-balance" && quizParams.vowels === undefined && quizParams.consonants === undefined)
                }
                data-testid="button-create-quiz-submit"
              >
                {createQuizMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                Create Session
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-green-700 dark:text-green-300">Quiz session created!</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">{createdQuiz.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Share Link</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    readOnly
                    value={`${window.location.origin}/quiz/${createdQuiz.shareCode}`}
                    className="text-sm font-mono"
                    data-testid="text-quiz-link"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyQuizLink}
                    data-testid="button-copy-quiz-link"
                  >
                    {quizLinkCopied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigate(`/quiz/${createdQuiz!.shareCode}/results`)}
                data-testid="button-view-quiz-results"
              >
                <Trophy className="h-4 w-4" />
                View Results Dashboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCustomPlayDialog} onOpenChange={(open) => { setShowCustomPlayDialog(open); if (!open) setCustomPlayParams({}); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Custom Play
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure a custom game variant for <strong>{game.name}</strong>. Scores won't be saved to the leaderboard.
            </p>

            {slug === "letter-position" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Letter</label>
                  <Select
                    value={customPlayParams.letter ?? ""}
                    onValueChange={(v) => setCustomPlayParams(p => ({ ...p, letter: v || undefined }))}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-custom-lp-letter">
                      <SelectValue placeholder="Pick a letter (A–Z)" />
                    </SelectTrigger>
                    <SelectContent>
                      {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Position (1 = first letter)</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {([1, 2, 3, 4, 5, 6, 7, 8] as const).map(pos => (
                      <Button
                        key={pos}
                        type="button"
                        size="sm"
                        variant={customPlayParams.position === pos ? "default" : "outline"}
                        onClick={() => setCustomPlayParams(prev => ({ ...prev, position: pos }))}
                        data-testid={`button-custom-lp-pos-${pos}`}
                      >
                        {pos}
                      </Button>
                    ))}
                  </div>
                </div>
                {customLpLetter && customLpPosition && (
                  <p className={`text-xs ${customLpCountFetching ? "text-muted-foreground" : !customLpCountData ? "" : customLpCountData.count < LP_QUIZ_MIN_WORDS ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-custom-lp-word-count">
                    {customLpCountFetching ? "Checking…" : !customLpCountData ? "" : customLpCountData.count < LP_QUIZ_MIN_WORDS ? `Only ${customLpCountData.count} words match — try different settings.` : `${customLpCountData.count} words match ✓`}
                  </p>
                )}
              </div>
            )}

            {slug === "letter-hunt" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Letter Count</label>
                  <Select
                    value={customPlayParams.challenge !== undefined ? String(customPlayParams.challenge) : "auto"}
                    onValueChange={(v) => {
                      if (v === "auto") {
                        setCustomPlayParams(p => { const n = { ...p }; delete n.challenge; delete n.letters; return n; });
                      } else {
                        const c = Number(v);
                        setCustomPlayParams(p => ({ ...p, challenge: c, letters: Array(c + 1).fill("any") }));
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-custom-challenge">
                      <SelectValue placeholder="Auto (seed-derived)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (seed-derived)</SelectItem>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n + 1} letters</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {typeof customPlayParams.challenge === "number" && (
                  <div>
                    <label className="text-sm font-medium">Pin Letters (optional)</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {Array.from({ length: customPlayParams.challenge + 1 }).map((_, i) => (
                        <Select
                          key={i}
                          value={(customPlayParams.letters?.[i]) || "any"}
                          onValueChange={(v) => setCustomPlayParams(p => {
                            const letters = [...(p.letters ?? Array(p.challenge + 1).fill("any"))];
                            letters[i] = v;
                            return { ...p, letters };
                          })}
                        >
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-custom-hunt-letter-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a specific letter.</p>
                  </div>
                )}
              </div>
            )}

            {slug === "letter-frequency" && (
              <>
                <div>
                  <label className="text-sm font-medium">Frequency Challenge</label>
                  <Select
                    value={customPlayParams.challenge !== undefined ? String(customPlayParams.challenge) : ""}
                    onValueChange={(v) => {
                      const c = v === "multi" ? "multi" : Number(v);
                      setCustomPlayParams(p => {
                        let newLetter = p.letter;
                        if (c === "multi") {
                          newLetter = undefined;
                        } else if (typeof c === "number" && c >= 1 && c <= 4 && p.letter) {
                          const validLetters = getLettersForCount(LETTER_FREQUENCY_CHALLENGE_COUNTS[c as 1 | 2 | 3 | 4]);
                          if (!validLetters.includes(p.letter)) newLetter = undefined;
                        }
                        return { ...p, challenge: c, letter: newLetter };
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-custom-challenge">
                      <SelectValue placeholder="Select challenge" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Challenge 1 (exactly 2×)</SelectItem>
                      <SelectItem value="2">Challenge 2 (exactly 3×)</SelectItem>
                      <SelectItem value="3">Challenge 3 (exactly 4×)</SelectItem>
                      <SelectItem value="4">Challenge 4 (5× or more)</SelectItem>
                      <SelectItem value="multi">Multi-Letter (2+ letters)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {customPlayParams.challenge !== "multi" && customPlayParams.challenge !== undefined && (
                  <div>
                    <label className="text-sm font-medium">Specific Letter (optional)</label>
                    {(() => {
                      const c = customPlayParams.challenge;
                      const validLetters = (typeof c === "number" && c >= 1 && c <= 4)
                        ? getLettersForCount(LETTER_FREQUENCY_CHALLENGE_COUNTS[c as 1 | 2 | 3 | 4])
                        : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
                      return (
                        <Select
                          value={customPlayParams.letter ?? "any"}
                          onValueChange={(v) => setCustomPlayParams(p => ({ ...p, letter: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-custom-lh-letter">
                            <SelectValue placeholder="Any compatible letter" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any compatible letter</SelectItem>
                            {validLetters.map(l => (
                              <SelectItem key={l} value={l}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {slug === "letter-balance" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Set vowel and/or consonant counts (at least one required). Length is optional.</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium">Vowels</label>
                    <Select
                      value={customPlayParams.vowels !== undefined ? String(customPlayParams.vowels) : "any"}
                      onValueChange={(v) => setCustomPlayParams(p => ({ ...p, vowels: v === "any" ? undefined : Number(v) }))}
                    >
                      <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-lb-vowels"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {[1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Consonants</label>
                    <Select
                      value={customPlayParams.consonants !== undefined ? String(customPlayParams.consonants) : "any"}
                      onValueChange={(v) => setCustomPlayParams(p => ({ ...p, consonants: v === "any" ? undefined : Number(v) }))}
                    >
                      <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-lb-consonants"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {[1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Length</label>
                    <Select
                      value={customPlayParams.length !== undefined ? String(customPlayParams.length) : "any"}
                      onValueChange={(v) => setCustomPlayParams(p => ({ ...p, length: v === "any" ? undefined : Number(v) }))}
                    >
                      <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-lb-length"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {Array.from({ length: 10 }, (_, i) => i + 3).map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {customPlayParams.vowels === undefined && customPlayParams.consonants === undefined && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Set at least vowels or consonants to start playing.</p>
                )}
              </div>
            )}

            {slug === "word-length" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Exact Word Length (3–12)</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {Array.from({ length: 10 }, (_, i) => i + 3).map(n => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={customPlayParams.length === n ? "default" : "outline"}
                        onClick={() => setCustomPlayParams(p => ({ ...p, length: n }))}
                        data-testid={`button-custom-wl-length-${n}`}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
                {customPlayParams.length && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium">Starts with</label>
                        <Select
                          value={customPlayParams.startsWith ?? "any"}
                          onValueChange={(v) => setCustomPlayParams(p => ({ ...p, startsWith: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-wl-starts"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Ends with</label>
                        <Select
                          value={customPlayParams.endsWith ?? "any"}
                          onValueChange={(v) => setCustomPlayParams(p => ({ ...p, endsWith: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-wl-ends"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Contains</label>
                        <Select
                          value={customPlayParams.contains ?? "any"}
                          onValueChange={(v) => setCustomPlayParams(p => ({ ...p, contains: v === "any" ? undefined : v }))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm" data-testid="select-custom-wl-contains"><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className={`text-xs ${wlCustomCountFetching ? "text-muted-foreground" : !wlCustomCountData ? "" : !wlCustomCountData.ok ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-wl-custom-word-count">
                      {wlCustomCountFetching ? "Checking…" : !wlCustomCountData ? "" : !wlCustomCountData.ok ? `Only ${wlCustomCountData.count} matching words — need at least ${WL_MIN_WORDS}. Adjust filters.` : `${wlCustomCountData.count} words match ✓`}
                    </p>
                  </>
                )}
              </div>
            )}

            {slug !== "letter-balance" && (
              <div>
                <label className="text-sm font-medium">Mode</label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={!customPlayParams.survival ? "default" : "outline"}
                    onClick={() => setCustomPlayParams(p => { const n = { ...p }; delete n.survival; return n; })}
                    data-testid="button-custom-mode-classic"
                  >
                    Classic
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={customPlayParams.survival ? "default" : "outline"}
                    onClick={() => setCustomPlayParams(p => ({ ...p, survival: true }))}
                    data-testid="button-custom-mode-survival"
                  >
                    Survival (8s/word)
                  </Button>
                </div>
              </div>
            )}

            <Button
              className="w-full gap-2"
              onClick={() => {
                setShowCustomPlayDialog(false);
                setIsCustomPlay(true);
                setIsPlaying(true);
              }}
              disabled={
                (slug === "letter-balance" && customPlayParams.vowels === undefined && customPlayParams.consonants === undefined) ||
                (slug === "word-length" && (!wlCustomLength || wlCustomCountFetching || !wlCustomCountData || !wlCustomCountData.ok)) ||
                (slug === "letter-position" && (!customLpLetter || !customLpPosition || customLpCountFetching || !customLpCountData || customLpCountData.count < LP_QUIZ_MIN_WORDS))
              }
              data-testid="button-start-custom-play"
            >
              <Play className="h-4 w-4" />
              Play Custom Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showChallengeDialog} onOpenChange={setShowChallengeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Challenge a Friend</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pick a friend to challenge in <strong>{game.name}</strong>. You'll play first — your score is automatically sent to them when you finish.
            </p>
            <div>
              <label className="text-sm font-medium">Friend</label>
              <Select value={selectedFriendId} onValueChange={setSelectedFriendId}>
                <SelectTrigger data-testid="select-challenge-friend">
                  <SelectValue placeholder="Select a friend" />
                </SelectTrigger>
                <SelectContent>
                  {friends.map((f) => (
                    <SelectItem key={f.friendUser.id} value={String(f.friendUser.id)}>
                      <span className="flex items-center gap-2">
                        <UserAvatar name={f.friendUser.name} avatarUrl={f.friendUser.avatarUrl} className="h-5 w-5" />
                        {f.friendUser.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Message (optional)</label>
              <Input
                value={challengeMsg}
                onChange={(e) => setChallengeMsg(e.target.value)}
                placeholder="Beat this!"
                maxLength={200}
                data-testid="input-challenge-message"
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleStartChallenge}
              disabled={!selectedFriendId}
              data-testid="button-start-challenge"
            >
              <Play className="h-4 w-4" />
              Play &amp; Send Challenge
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
