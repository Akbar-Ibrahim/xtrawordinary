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
    setCreatedQuiz(null);
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
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [challengeMsg, setChallengeMsg] = useState("");
  const [challengeLbMode, setChallengeLbMode] = useState<"random" | "locked">("random");
  const [challengeLbLevel, setChallengeLbLevel] = useState<number | undefined>(undefined);
  const [challengeLbConsonantCount, setChallengeLbConsonantCount] = useState<number | undefined>(undefined);
  const [showCustomPlayDialog, setShowCustomPlayDialog] = useState(false);
  const [customPlayParams, setCustomPlayParams] = useState<Record<string, any>>({});
  const [customPlayFrozenParams, setCustomPlayFrozenParams] = useState<Record<string, any>>({});
  const [customPlayKey, setCustomPlayKey] = useState(0);
  const [customPlayEnded, setCustomPlayEnded] = useState(false);
  const [isCustomPlay, setIsCustomPlay] = useState(false);
  const [isUntimed, setIsUntimed] = useState(false);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [createdQuiz, setCreatedQuiz] = useState<QuizSession | null>(null);
  const [quizLinkCopied, setQuizLinkCopied] = useState(false);
  const [quizClosesAt, setQuizClosesAt] = useState("");
  const [quizParams, setQuizParams] = useState<Record<string, any>>({});
  const [lbMode, setLbMode] = useState<"count" | "structural">("count");
  const [lbCustomMode, setLbCustomMode] = useState<"count" | "structural">("count");
  const [dmWord, setDmWord] = useState("");
  const [dmPos, setDmPos] = useState("noun");
  const [dmDefs, setDmDefs] = useState(["", "", ""]);
  const [dmEditIndex, setDmEditIndex] = useState<number | null>(null);
  const [dmReview, setDmReview] = useState(false);
  const [prWord, setPrWord] = useState("");
  const [lpWord, setLpWord] = useState("");
  const [lpHint, setLpHint] = useState("");
  const [lpCategory, setLpCategory] = useState("");
  const [asWord, setAsWord] = useState("");
  const [wsWord, setWsWord] = useState("");
  const [wsCategory, setWsCategory] = useState("");
  const [wrSeed, setWrSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));

  const [showDuelDialog, setShowDuelDialog] = useState(false);

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

  const prWordKey = (showQuizDialog && slug === "progressive-reveal" && prWord.trim().length >= 2) ? prWord.trim().toUpperCase() : "";
  const { data: prWordValid, isFetching: prWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", prWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(prWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!prWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const lpWordKey = (showQuizDialog && slug === "letter-pool" && lpWord.trim().length >= 2) ? lpWord.trim().toUpperCase() : "";
  const { data: lpWordValid, isFetching: lpWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", lpWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(lpWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!lpWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const asWordKey = (showQuizDialog && slug === "anagram-solver" && asWord.trim().length >= 2) ? asWord.trim().toUpperCase() : "";
  const { data: asWordValid, isFetching: asWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", asWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(asWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!asWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const wsWordKey = (showQuizDialog && slug === "word-scramble" && wsWord.trim().length >= 2) ? wsWord.trim().toUpperCase() : "";
  const { data: wsWordValid, isFetching: wsWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", wsWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(wsWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!wsWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const wrPreviewEnabled = showQuizDialog && slug === "word-roots";
  const { data: wrPreviewPuzzles, isFetching: wrPreviewFetching } = useQuery<Array<{ canonicalWord: string; derivatives: string[] }>>({
    queryKey: ["/api/games/word-roots/puzzles", wrSeed],
    queryFn: async () => {
      const r = await fetch(`/api/games/word-roots/puzzles?seed=${wrSeed}`, { credentials: "include" });
      return r.json();
    },
    enabled: wrPreviewEnabled,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  const dmWordKey = (showQuizDialog && slug === "definition-match" && dmWord.trim().length >= 2) ? dmWord.trim().toUpperCase() : "";
  const { data: dmWordValid, isFetching: dmWordValidating } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/games/validate-word", dmWordKey],
    queryFn: async () => { const r = await fetch(`/api/games/validate-word?word=${encodeURIComponent(dmWordKey)}`, { credentials: "include" }); return r.json(); },
    enabled: !!dmWordKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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
      description: quizDescription.trim() || null,
      closesAt: quizClosesAt ? new Date(quizClosesAt).toISOString() : null,
      params: slug === "letter-position"
        ? { ...quizParams, mode: 1 }
        : slug === "word-roots"
        ? { wrSeed }
        : (Object.keys(quizParams).length > 0 ? quizParams : null),
    }),
    onSuccess: async (res: any) => {
      const data: QuizSession = await res.json();
      setCreatedQuiz(data);
      setQuizTitle("");
      setQuizDescription("");
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

  const handleStartChallenge = () => {
    if (!selectedFriendId) return;
    const seed = Math.floor(Math.random() * 1000000);
    const msgParam = challengeMsg ? `&msg=${encodeURIComponent(challengeMsg)}` : "";
    let lbParams = "";
    if (slug === "letter-balance" && challengeLbMode === "locked" && challengeLbLevel !== undefined && challengeLbConsonantCount !== undefined) {
      lbParams = `&lbCategory=locked_balance&lbLevel=${challengeLbLevel}&lbConsonantCount=${challengeLbConsonantCount}`;
    }
    setShowChallengeDialog(false);
    setSelectedFriendId("");
    setChallengeMsg("");
    setChallengeLbMode("random");
    setChallengeLbLevel(undefined);
    setChallengeLbConsonantCount(undefined);
    navigate(`/game/${slug}?challenge-new=${selectedFriendId}&seed=${seed}${msgParam}${lbParams}`);
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
                              user={{ name: challenge.challengerName ?? "Player", avatarUrl: challenge.challengerAvatarUrl ?? null }}
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

      <Dialog open={showQuizDialog} onOpenChange={(open) => { setShowQuizDialog(open); if (!open) { setCreatedQuiz(null); setQuizParams({}); setQuizClosesAt(""); setQuizTitle(""); setQuizDescription(""); setDmWord(""); setDmPos("noun"); setDmDefs(["", "", ""]); setDmEditIndex(null); setDmReview(false); setPrWord(""); setLpWord(""); setLpHint(""); setLpCategory(""); setAsWord(""); setWsWord(""); setWsCategory(""); setLbMode("count"); setWrSeed(Math.floor(Math.random() * 1_000_000)); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Create Quiz Session
            </DialogTitle>
          </DialogHeader>
          {!createdQuiz ? (
            <div className="space-y-4 overflow-y-auto max-h-[65vh] pr-1">
              {dmReview && slug === "definition-match" ? (() => {
                const dmReviewEntries: Array<{ word: string; partOfSpeech: string; definitions: [string, string, string] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setDmReview(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0" data-testid="button-dm-review-back">
                        ← Back
                      </button>
                      <span className="text-sm font-semibold mx-auto">Review your quiz</span>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
                      <p className="font-semibold text-sm">{quizTitle || "Untitled Quiz"}</p>
                      {quizDescription && <p className="text-xs text-muted-foreground">{quizDescription}</p>}
                      <p className="text-xs text-muted-foreground">{dmReviewEntries.length} word{dmReviewEntries.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {dmReviewEntries.map((entry, idx) => (
                        <div key={idx} className="rounded-lg border p-3 space-y-1.5" data-testid={`dm-review-entry-${idx}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold uppercase tracking-wide">{entry.word}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.partOfSpeech}</span>
                          </div>
                          <div className="space-y-1">
                            {entry.definitions.map((def: string, di: number) => (
                              <div key={di} className={`text-xs px-2 py-1 rounded ${di === 0 ? "bg-primary/5 text-primary" : di === 1 ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"}`}>
                                <span className="font-semibold mr-1">C{di + 1}:</span>{def}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full gap-2" onClick={() => createQuizMutation.mutate()} disabled={createQuizMutation.isPending} data-testid="button-dm-confirm-create">
                      {createQuizMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                      Create Session
                    </Button>
                  </div>
                );
              })() : (
              <>
              <p className="text-sm text-muted-foreground">
                Create a shareable quiz in <strong>{game.name}</strong>. Anyone with the link can play and submit their score.
              </p>
              <div>
                <label className="text-sm font-medium">Quiz title or name</label>
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
                <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  placeholder="Add any instructions or context for players…"
                  maxLength={500}
                  rows={3}
                  data-testid="input-quiz-description"
                  className="mt-1 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">{quizDescription.length}/500</p>
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
              {slug === "letter-pool" && (() => {
                const lpEntries: Array<{ word: string; hint: string; category: string; letterPool: string[] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
                const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
                const addLpWord = () => {
                  const w = lpWord.trim().toUpperCase();
                  if (!w || !lpHint.trim() || lpEntries.some(e => e.word === w)) return;
                  const wordLetters = new Set(w.split(""));
                  const letterPool = ALPHABET.filter(l => !wordLetters.has(l));
                  setQuizParams(p => ({ ...p, words: [...lpEntries, { word: w, hint: lpHint.trim(), category: lpCategory.trim() || "Custom", letterPool }] }));
                  setLpWord(""); setLpHint(""); setLpCategory("");
                };
                return (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Pool Mode</label>
                      <div className="flex gap-2 mt-1">
                        {(["with-pool", "without-pool"] as const).map(v => (
                          <Button key={v} type="button" size="sm" variant={quizParams.variant === v ? "default" : "outline"} onClick={() => setQuizParams(p => ({ ...p, variant: v }))} data-testid={`button-quiz-pool-${v}`}>
                            {v === "with-pool" ? "With Pool" : "Without Pool"}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Words to Guess <span className="text-muted-foreground font-normal">(optional)</span></label>
                        <span className="text-xs text-muted-foreground">{lpEntries.length}/20</span>
                      </div>
                      {lpEntries.length > 0 && (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {lpEntries.map((entry, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5" data-testid={`lp-entry-${i}`}>
                              <span className="text-sm font-mono font-bold tracking-wider flex-1">{entry.word}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">{entry.hint}</span>
                              <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: lpEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive shrink-0" data-testid={`button-lp-remove-${i}`}>
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {lpEntries.length < 20 && (
                        <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1 w-32 shrink-0">
                            <Input placeholder="WORD" value={lpWord} onChange={e => setLpWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())} className="flex-1 font-mono uppercase tracking-wider" maxLength={20} data-testid="input-lp-word" />
                            <span className="w-5 shrink-0 flex items-center justify-center">
                              {lpWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                              {!lpWordValidating && lpWordValid !== undefined && lpWord.trim().length >= 2 && (
                                lpWordValid.exists
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </span>
                          </div>
                            <Input placeholder="Hint / clue for players" value={lpHint} onChange={e => setLpHint(e.target.value)} className="flex-1" maxLength={100} data-testid="input-lp-hint" />
                          </div>
                          <div className="flex gap-2">
                            <Input placeholder="Category (optional, e.g. Animals)" value={lpCategory} onChange={e => setLpCategory(e.target.value)} className="flex-1" maxLength={50} data-testid="input-lp-category" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLpWord(); } }} />
                            <Button type="button" size="sm" disabled={!lpWord.trim() || !lpHint.trim() || lpEntries.some(e => e.word === lpWord.trim().toUpperCase())} onClick={addLpWord} data-testid="button-lp-add">Add</Button>
                          </div>
                        </div>
                      )}
                      {lpEntries.length === 0 && (
                        <p className="text-xs text-muted-foreground">Leave empty to use random words, or add specific words for your quiz.</p>
                      )}
                    </div>
                  </div>
                );
              })()}
              {slug === "letter-dodge" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Difficulty (forbidden letters)</label>
                    <Select
                      value={quizParams.difficulty !== undefined ? String(quizParams.difficulty) : "auto"}
                      onValueChange={(v) => {
                        if (v === "auto") {
                          setQuizParams(p => { const n = { ...p }; delete n.difficulty; delete n.letters; return n; });
                        } else if (v === "advanced") {
                          setQuizParams(p => ({ ...p, difficulty: "advanced" as const, letters: undefined }));
                        } else if (v === "savant") {
                          setQuizParams(p => ({ ...p, difficulty: "savant" as const, letters: undefined }));
                        } else {
                          const c = Number(v) as 1 | 2 | 3 | 4 | 5;
                          setQuizParams(p => ({ ...p, difficulty: c, letters: Array(c).fill("any") }));
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-quiz-dodge-difficulty">
                        <SelectValue placeholder="Auto (seed-based)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (seed-based)</SelectItem>
                        <SelectItem value="1">Easy — 1 forbidden letter</SelectItem>
                        <SelectItem value="2">Medium — 2 forbidden letters</SelectItem>
                        <SelectItem value="3">Hard — 3 forbidden letters</SelectItem>
                        <SelectItem value="4">Expert — 4 forbidden letters</SelectItem>
                        <SelectItem value="5">Master — 5 forbidden letters</SelectItem>
                        <SelectItem value="savant">Savant — 6–12 forbidden letters</SelectItem>
                        <SelectItem value="advanced">Advanced — random count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {typeof quizParams.difficulty === "number" && (
                    <div>
                      <label className="text-sm font-medium">Pin Forbidden Letters (optional)</label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {Array.from({ length: quizParams.difficulty }).map((_, i) => (
                          <div key={i} className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                            <Select
                              value={(quizParams.letters?.[i]) || "any"}
                              onValueChange={(v) => setQuizParams(p => {
                                const letters = [...(p.letters ?? Array(p.difficulty as number).fill("any"))];
                                letters[i] = v;
                                return { ...p, letters };
                              })}
                            >
                              <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-quiz-dodge-letter-${i}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Any</SelectItem>
                                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a letter all players must avoid.</p>
                    </div>
                  )}
                  {!quizParams.survival && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Words to submit</label>
                        <Input
                          type="number" min={1} max={50} placeholder="20"
                          className="mt-1 h-8 text-sm w-24"
                          data-testid="input-quiz-dodge-word-count"
                          value={quizParams.wordCount ?? ""}
                          onChange={(e) => setQuizParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Time limit</label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {[60, 90, 120, 180, 300].map(t => (
                            <Button key={t} type="button" size="sm"
                              variant={(quizParams.timeLimit ?? 90) === t ? "default" : "outline"}
                              onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                              data-testid={`button-quiz-dodge-time-${t}`}
                            >
                              {t < 60 ? `${t}s` : `${t / 60}min`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
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
                  {!quizParams.survival && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Words to find</label>
                        <Input
                          type="number" min={1} max={50} placeholder="20"
                          className="mt-1 h-8 text-sm w-24"
                          data-testid="input-quiz-lp-word-count"
                          value={quizParams.wordCount ?? ""}
                          onChange={(e) => setQuizParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Time limit</label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {[60, 90, 120, 180, 300].map(t => (
                            <Button key={t} type="button" size="sm"
                              variant={(quizParams.timeLimit ?? 120) === t ? "default" : "outline"}
                              onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                              data-testid={`button-quiz-lp-time-${t}`}
                            >
                              {t < 60 ? `${t}s` : `${t / 60}min`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
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
                  {!quizParams.survival && (
                    <>
                      <div>
                        <label className="text-xs font-medium">Words to find (Classic)</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="number"
                            min={1}
                            max={wlQuizCountData?.count ?? undefined}
                            value={quizParams.wordCount ?? 20}
                            onChange={(e) => {
                              const v = Math.max(1, parseInt(e.target.value) || 1);
                              setQuizParams(p => ({ ...p, wordCount: v }));
                            }}
                            className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm"
                            data-testid="input-quiz-wl-word-count"
                          />
                          {wlQuizCountData?.ok && (quizParams.wordCount ?? 20) > wlQuizCountData.count && (
                            <p className="text-xs text-destructive" data-testid="text-wl-word-count-error">
                              Max {wlQuizCountData.count} for this filter
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Time limit (Classic)</label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {[60, 90, 120, 180, 300].map(t => (
                            <Button
                              key={t}
                              type="button"
                              size="sm"
                              variant={(quizParams.timeLimit ?? 120) === t ? "default" : "outline"}
                              onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                              data-testid={`button-quiz-wl-time-${t}`}
                            >
                              {t < 60 ? `${t}s` : `${t / 60}min`}
                            </Button>
                          ))}
                        </div>
                      </div>
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
                        <SelectValue placeholder="Auto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)} data-testid={`select-quiz-hunt-challenge-${n}`}>{n + 1} letters</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {typeof quizParams.challenge === "number" && (
                    <div>
                      <label className="text-sm font-medium">Pin Letters (optional)</label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {Array.from({ length: quizParams.challenge + 1 }).map((_, i) => (
                          <div key={i} className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                            <Select
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
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a specific letter.</p>
                    </div>
                  )}
                  {!quizParams.survival && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Words to find</label>
                        <Input
                          type="number" min={1} max={50} placeholder="20"
                          className="mt-1 h-8 text-sm w-24"
                          data-testid="input-quiz-hunt-word-count"
                          value={quizParams.wordCount ?? ""}
                          onChange={(e) => setQuizParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Time limit</label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {[60, 90, 120, 180, 300].map(t => (
                            <Button key={t} type="button" size="sm"
                              variant={(quizParams.timeLimit ?? 120) === t ? "default" : "outline"}
                              onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                              data-testid={`button-quiz-hunt-time-${t}`}
                            >
                              {t < 60 ? `${t}s` : `${t / 60}min`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {slug === "letter-frequency" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Frequency Challenge</label>
                    <Select
                      value={quizParams.challenge !== undefined ? String(quizParams.challenge) : "0"}
                      onValueChange={(v) => {
                        const c = v === "multi" ? "multi" : Number(v);
                        setQuizParams(p => ({
                          ...p,
                          challenge: c === 0 ? undefined : c,
                          letter: c === "multi" ? undefined : p.letter,
                          letters: c !== "multi" ? undefined : (p.letters ?? ["any", "any"]),
                          letterCounts: c !== "multi" ? undefined : (p.letterCounts ?? [2, 2]),
                        }));
                      }}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-quiz-freq-challenge">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Auto</SelectItem>
                        <SelectItem value="1">Challenge 1 (exactly 2×)</SelectItem>
                        <SelectItem value="2">Challenge 2 (exactly 3×)</SelectItem>
                        <SelectItem value="3">Challenge 3 (exactly 4×)</SelectItem>
                        <SelectItem value="4">Challenge 4 (5× or more)</SelectItem>
                        <SelectItem value="multi">Multi-Letter (2+ letters)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {quizParams.challenge === "multi" && (
                    <div>
                      <label className="text-sm font-medium">Pin Letters (optional)</label>
                      <div className="flex gap-1 mt-1 mb-2">
                        {[2, 3].map(n => (
                          <Button
                            key={n}
                            type="button"
                            size="sm"
                            variant={(quizParams.letters?.length ?? 2) === n ? "default" : "outline"}
                            onClick={() => setQuizParams(p => {
                              const cur: string[] = p.letters ?? Array(2).fill("any");
                              const curCounts: number[] = p.letterCounts ?? Array(2).fill(2);
                              const next = n > cur.length
                                ? [...cur, ...Array(n - cur.length).fill("any")]
                                : cur.slice(0, n);
                              const nextCounts = n > curCounts.length
                                ? [...curCounts, ...Array(n - curCounts.length).fill(2)]
                                : curCounts.slice(0, n);
                              return { ...p, letters: next, letterCounts: nextCounts };
                            })}
                            data-testid={`button-quiz-freq-multi-count-${n}`}
                          >
                            {n} letters
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {Array.from({ length: quizParams.letters?.length ?? 2 }).map((_, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                            <Select
                              value={(quizParams.letters?.[i]) || "any"}
                              onValueChange={(v) => setQuizParams(p => {
                                const letters = [...(p.letters ?? Array(2).fill("any"))];
                                letters[i] = v;
                                return { ...p, letters };
                              })}
                            >
                              <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-quiz-freq-multi-${i}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Any</SelectItem>
                                {"ABCDEFGHILMNOPRSTUWY".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-0.5">
                              {[1, 2, 3].map(cnt => (
                                <Button
                                  key={cnt}
                                  type="button"
                                  size="sm"
                                  variant={(quizParams.letterCounts?.[i] ?? 2) === cnt ? "default" : "outline"}
                                  className="h-6 w-6 p-0 text-xs"
                                  onClick={() => setQuizParams(p => {
                                    const counts = [...(p.letterCounts ?? Array(p.letters?.length ?? 2).fill(2))];
                                    counts[i] = cnt;
                                    return { ...p, letterCounts: counts };
                                  })}
                                  data-testid={`button-quiz-freq-multi-lcount-${i}-${cnt}`}
                                >
                                  {cnt}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Each slot: pick a letter (or Any) and its required count.</p>
                    </div>
                  )}
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
                  {!quizParams.survival && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Words to find</label>
                        <Input
                          type="number" min={1} max={50} placeholder="20"
                          className="mt-1 h-8 text-sm w-24"
                          data-testid="input-quiz-freq-word-count"
                          value={quizParams.wordCount ?? ""}
                          onChange={(e) => setQuizParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Time limit</label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {[60, 90, 120, 180, 300].map(t => (
                            <Button key={t} type="button" size="sm"
                              variant={(quizParams.timeLimit ?? 120) === t ? "default" : "outline"}
                              onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                              data-testid={`button-quiz-freq-time-${t}`}
                            >
                              {t < 60 ? `${t}s` : `${t / 60}min`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {slug === "letter-balance" && (() => {
                const isStructural = lbMode === "structural";
                const structuralCats = [
                  { id: "consonant_count", name: "Consonant Count", levelType: "count", levels: [2,3,4,5,6,7,"advanced"] as (number | "advanced")[] },
                  { id: "vowel_count", name: "Vowel Count", levelType: "count", levels: [2,3,4,5,6,7,"advanced"] as (number | "advanced")[] },
                  { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                  { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                  { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                  { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                  { id: "locked_balance", name: "Locked Balance", levelType: "length", levels: [] as number[] },
                ];
                const selectedCat = structuralCats.find(c => c.id === quizParams.category);
                return (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Challenge type</label>
                      <div className="flex gap-2 mt-1">
                        <Button type="button" size="sm"
                          variant={!isStructural ? "default" : "outline"}
                          onClick={() => { setLbMode("count"); setQuizParams(({ category: _c, level: _l, consonantCount: _cc, ...rest }) => rest); }}
                          data-testid="button-lb-mode-count"
                        >
                          Count-based
                        </Button>
                        <Button type="button" size="sm"
                          variant={isStructural ? "default" : "outline"}
                          onClick={() => { setLbMode("structural"); setQuizParams(({ vowels: _v, consonants: _co, length: _l, ...rest }) => rest); }}
                          data-testid="button-lb-mode-structural"
                        >
                          Structural
                        </Button>
                      </div>
                    </div>
                    {!isStructural ? (
                      <>
                        <p className="text-xs text-muted-foreground">Set vowel and/or consonant counts (at least one required). Length is optional.</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs font-medium">Vowels</label>
                            <Input
                              type="number" min={1} max={7} placeholder="Any"
                              className="mt-1 h-8 text-sm"
                              data-testid="input-quiz-lb-vowels"
                              value={quizParams.vowels ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                                setQuizParams(p => {
                                  const consonants = p.consonants;
                                  if (v !== undefined && consonants !== undefined) return { ...p, vowels: v, length: v + consonants };
                                  if (v === undefined) return { ...p, vowels: v, length: undefined };
                                  return { ...p, vowels: v };
                                });
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium">Consonants</label>
                            <Input
                              type="number" min={1} max={7} placeholder="Any"
                              className="mt-1 h-8 text-sm"
                              data-testid="input-quiz-lb-consonants"
                              value={quizParams.consonants ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                                setQuizParams(p => {
                                  const vowels = p.vowels;
                                  if (v !== undefined && vowels !== undefined) return { ...p, consonants: v, length: vowels + v };
                                  if (v === undefined) return { ...p, consonants: v, length: undefined };
                                  return { ...p, consonants: v };
                                });
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium">
                              {quizParams.vowels !== undefined && quizParams.consonants !== undefined ? "Length (auto)" : "Length (opt.)"}
                            </label>
                            <Input
                              type="number" min={3} max={15} placeholder="Any"
                              className="mt-1 h-8 text-sm"
                              data-testid="input-quiz-lb-length"
                              disabled={quizParams.vowels !== undefined && quizParams.consonants !== undefined}
                              value={quizParams.length ?? ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? undefined : Math.min(15, Math.max(3, parseInt(e.target.value) || 3));
                                setQuizParams(p => ({ ...p, length: v }));
                              }}
                            />
                          </div>
                        </div>
                        {quizParams.vowels === undefined && quizParams.consonants === undefined && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">Set at least vowels or consonants to configure this quiz.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-sm font-medium">Category</label>
                          <div className="grid grid-cols-2 gap-1.5 mt-1">
                            {structuralCats.map(cat => (
                              <Button
                                key={cat.id}
                                type="button"
                                size="sm"
                                variant={quizParams.category === cat.id ? "default" : "outline"}
                                className="justify-start text-left h-auto py-1.5 px-2.5 text-xs"
                                onClick={() => cat.id === "locked_balance"
                                  ? setQuizParams(p => ({ ...p, category: cat.id, level: undefined, consonantCount: undefined }))
                                  : setQuizParams(p => ({ ...p, category: cat.id, level: cat.levels[0], consonantCount: undefined }))
                                }
                                data-testid={`button-lb-cat-${cat.id}`}
                              >
                                {cat.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                        {quizParams.category === "locked_balance" ? (
                          <>
                            <div>
                              <label className="text-sm font-medium">Word length</label>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {[4,5,6,7,8,9,10].map(lv => (
                                  <Button key={lv} type="button" size="sm"
                                    variant={quizParams.level === lv ? "default" : "outline"}
                                    onClick={() => setQuizParams(p => ({ ...p, level: lv, consonantCount: undefined }))}
                                    data-testid={`button-lb-level-${lv}`}
                                  >
                                    {lv}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            {quizParams.level !== undefined && (
                              <div>
                                <label className="text-sm font-medium">Consonant count <span className="text-xs font-normal text-muted-foreground">(vowels = {quizParams.level} − count)</span></label>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {Array.from({ length: quizParams.level - 1 }, (_, i) => i + 1).map(c => {
                                    const v = quizParams.level - c;
                                    return (
                                      <Button key={c} type="button" size="sm"
                                        variant={quizParams.consonantCount === c ? "default" : "outline"}
                                        onClick={() => setQuizParams(p => ({ ...p, consonantCount: c }))}
                                        data-testid={`button-lb-consonant-${c}`}
                                        title={`${c}C / ${v}V`}
                                      >
                                        {c}C/{v}V
                                      </Button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {(!quizParams.level || !quizParams.consonantCount) && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                {!quizParams.level ? "Pick a word length." : "Pick a consonant count."}
                              </p>
                            )}
                          </>
                        ) : selectedCat ? (
                          <div>
                            <label className="text-sm font-medium">
                              Level <span className="text-xs font-normal text-muted-foreground">({selectedCat.levelType === "length" ? "word length" : "count"})</span>
                            </label>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {selectedCat.levels.map(lv => (
                                <Button
                                  key={String(lv)}
                                  type="button"
                                  size="sm"
                                  variant={quizParams.level === lv ? "default" : "outline"}
                                  className={lv === "advanced" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-0" : ""}
                                  onClick={() => setQuizParams(p => ({ ...p, level: lv }))}
                                  data-testid={`button-lb-level-${lv}`}
                                >
                                  {lv === "advanced" ? "Advanced" : lv}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {!quizParams.category && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">Pick a category to configure this quiz.</p>
                        )}
                      </>
                    )}
                    {!quizParams.survival && (
                      <>
                        <div>
                          <label className="text-sm font-medium">Words to find</label>
                          <Input
                            type="number" min={1} max={50} placeholder="20"
                            className="mt-1 h-8 text-sm w-24"
                            data-testid="input-quiz-lb-word-count"
                            value={quizParams.wordCount ?? ""}
                            onChange={(e) => setQuizParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Time limit</label>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {[60, 90, 120, 180, 300].map(t => (
                              <Button key={t} type="button" size="sm"
                                variant={(quizParams.timeLimit ?? 120) === t ? "default" : "outline"}
                                onClick={() => setQuizParams(p => ({ ...p, timeLimit: t }))}
                                data-testid={`button-quiz-lb-time-${t}`}
                              >
                                {t < 60 ? `${t}s` : `${t / 60}min`}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              {slug === "progressive-reveal" && (() => {
                const prEntries: Array<{ word: string; subcategory: string }> = Array.isArray(quizParams.words) ? quizParams.words : [];
                const addPrWord = () => {
                  const w = prWord.trim().toUpperCase();
                  if (!w || prEntries.some(e => e.word === w)) return;
                  setQuizParams(p => ({ ...p, words: [...prEntries, { word: w, subcategory: "Custom" }] }));
                  setPrWord("");
                };
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Words to Guess</label>
                      <span className="text-xs text-muted-foreground">{prEntries.length}/20</span>
                    </div>
                    {prEntries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {prEntries.map((entry, i) => (
                          <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`pr-entry-${i}`}>
                            <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
                            <button
                              type="button"
                              onClick={() => setQuizParams(p => ({ ...p, words: prEntries.filter((_, j) => j !== i) }))}
                              className="text-muted-foreground hover:text-destructive ml-1"
                              data-testid={`button-pr-remove-${i}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {prEntries.length < 20 && (
                      <div className="flex gap-2">
                        <div className="flex flex-1 items-center gap-1">
                          <Input
                            placeholder="Enter a word (e.g. ELOQUENT)"
                            value={prWord}
                            onChange={e => setPrWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPrWord(); } }}
                            className="flex-1 font-mono uppercase tracking-wider"
                            maxLength={20}
                            data-testid="input-pr-word"
                          />
                          <span className="w-5 shrink-0 flex items-center justify-center">
                            {prWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            {!prWordValidating && prWordValid !== undefined && prWord.trim().length >= 2 && (
                              prWordValid.exists
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>
                        </div>
                        <Button type="button" size="sm" disabled={!prWord.trim() || prEntries.some(e => e.word === prWord.trim().toUpperCase())} onClick={addPrWord} data-testid="button-pr-add">
                          Add
                        </Button>
                      </div>
                    )}
                    {prEntries.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word so players know what to guess.</p>
                    )}
                  </div>
                );
              })()}
              {slug === "anagram-solver" && (() => {
                const asEntries: Array<{ original: string; anagrams: string[] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
                const addAsWord = () => {
                  const w = asWord.trim().toUpperCase();
                  if (!w || asEntries.some(e => e.original === w)) return;
                  setQuizParams(p => ({ ...p, words: [...asEntries, { original: w, anagrams: [w] }] }));
                  setAsWord("");
                };
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Words to Unscramble</label>
                      <span className="text-xs text-muted-foreground">{asEntries.length}/20</span>
                    </div>
                    {asEntries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {asEntries.map((entry, i) => (
                          <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`as-entry-${i}`}>
                            <span className="text-sm font-mono font-bold tracking-wider">{entry.original}</span>
                            <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: asEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-as-remove-${i}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {asEntries.length < 20 && (
                      <div className="flex gap-2 items-center">
                        <div className="flex flex-1 items-center gap-1">
                          <Input
                            placeholder="Enter a word (e.g. PLANET)"
                            value={asWord}
                            onChange={e => setAsWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAsWord(); } }}
                            className="flex-1 font-mono uppercase tracking-wider"
                            maxLength={20}
                            data-testid="input-as-word"
                          />
                          <span className="w-5 shrink-0 flex items-center justify-center">
                            {asWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            {!asWordValidating && asWordValid !== undefined && asWord.trim().length >= 2 && (
                              asWordValid.exists
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>
                        </div>
                        <Button type="button" size="sm" disabled={!asWord.trim() || asEntries.some(e => e.original === asWord.trim().toUpperCase())} onClick={addAsWord} data-testid="button-as-add">Add</Button>
                      </div>
                    )}
                    {asEntries.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word. Players will see the letters scrambled and must type the answer.</p>
                    )}
                  </div>
                );
              })()}
              {slug === "word-scramble" && (() => {
                const wsEntries: Array<{ word: string; category: string }> = Array.isArray(quizParams.words) ? quizParams.words : [];
                const addWsWord = () => {
                  const w = wsWord.trim().toUpperCase();
                  if (!w || wsEntries.some(e => e.word === w)) return;
                  setQuizParams(p => ({ ...p, words: [...wsEntries, { word: w, category: wsCategory.trim() || "Custom" }] }));
                  setWsWord("");
                  setWsCategory("");
                };
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Words to Unscramble</label>
                      <span className="text-xs text-muted-foreground">{wsEntries.length}/20</span>
                    </div>
                    {wsEntries.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {wsEntries.map((entry, i) => (
                          <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1" data-testid={`ws-entry-${i}`}>
                            <span className="text-sm font-mono font-bold tracking-wider">{entry.word}</span>
                            {entry.category !== "Custom" && <span className="text-xs text-muted-foreground">({entry.category})</span>}
                            <button type="button" onClick={() => setQuizParams(p => ({ ...p, words: wsEntries.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-destructive" data-testid={`button-ws-remove-${i}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {wsEntries.length < 20 && (
                      <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                        <div className="flex gap-2 items-center">
                          <div className="flex flex-1 items-center gap-1">
                            <Input
                              placeholder="WORD"
                              value={wsWord}
                              onChange={e => setWsWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWsWord(); } }}
                              className="w-32 shrink-0 font-mono uppercase tracking-wider"
                              maxLength={20}
                              data-testid="input-ws-word"
                            />
                            <span className="w-5 shrink-0 flex items-center justify-center">
                              {wsWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                              {!wsWordValidating && wsWordValid !== undefined && wsWord.trim().length >= 2 && (
                                wsWordValid.exists
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </span>
                          </div>
                          <Input placeholder="Category (optional, e.g. Animals)" value={wsCategory} onChange={e => setWsCategory(e.target.value)} className="flex-1" maxLength={50} data-testid="input-ws-category" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWsWord(); } }} />
                          <Button type="button" size="sm" disabled={!wsWord.trim() || wsEntries.some(e => e.word === wsWord.trim().toUpperCase())} onClick={addWsWord} data-testid="button-ws-add">Add</Button>
                        </div>
                      </div>
                    )}
                    {wsEntries.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word. Players will see the letters scrambled and must type the answer.</p>
                    )}
                  </div>
                );
              })()}
              {slug === "definition-match" && (() => {
                const dmEntries: Array<{ word: string; partOfSpeech: string; definitions: [string, string, string] }> = Array.isArray(quizParams.words) ? quizParams.words : [];
                const isEditing = dmEditIndex !== null;
                const canSave = dmWord.trim().length > 0 && dmDefs[0].trim().length > 0 && dmDefs[1].trim().length > 0 && dmDefs[2].trim().length > 0;
                const saveEntry = () => {
                  if (!canSave) return;
                  const entry = { word: dmWord.trim().toUpperCase(), partOfSpeech: dmPos, definitions: [dmDefs[0].trim(), dmDefs[1].trim(), dmDefs[2].trim()] as [string, string, string] };
                  if (isEditing) {
                    setQuizParams(p => {
                      const words = [...(Array.isArray(p.words) ? p.words : [])];
                      words[dmEditIndex!] = entry;
                      return { ...p, words };
                    });
                    setDmEditIndex(null);
                  } else {
                    setQuizParams(p => ({ ...p, words: [...dmEntries, entry] }));
                  }
                  setDmWord("");
                  setDmDefs(["", "", ""]);
                };
                const startEdit = (i: number) => {
                  const e = dmEntries[i];
                  setDmWord(e.word);
                  setDmPos(e.partOfSpeech);
                  setDmDefs([e.definitions[0], e.definitions[1], e.definitions[2]]);
                  setDmEditIndex(i);
                };
                const cancelEdit = () => { setDmEditIndex(null); setDmWord(""); setDmDefs(["", "", ""]); };
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Word Entries</label>
                      <span className="text-xs text-muted-foreground">{dmEntries.length}/20</span>
                    </div>
                    {dmEntries.length > 0 && (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {dmEntries.map((entry, i) => (
                          <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 transition-colors ${dmEditIndex === i ? "border-primary bg-primary/5" : "bg-muted/30"}`} data-testid={`dm-entry-${i}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold uppercase tracking-wide">{entry.word}</p>
                              <p className="text-xs text-muted-foreground">{entry.partOfSpeech} · 3 clues</p>
                            </div>
                            {dmEditIndex === i ? (
                              <span className="text-xs text-primary font-medium self-center px-1">editing…</span>
                            ) : (
                              <>
                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-primary" onClick={() => startEdit(i)} data-testid={`button-dm-edit-${i}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setQuizParams(p => ({ ...p, words: dmEntries.filter((_, j) => j !== i) }))} data-testid={`button-dm-remove-${i}`}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {(dmEntries.length < 20 || isEditing) && (
                      <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {isEditing ? `Editing: ${dmEntries[dmEditIndex!]?.word ?? ""}` : "Add a word entry"}
                        </p>
                        <div className="flex gap-2">
                          <div className="flex flex-1 items-center gap-1">
                            <Input
                              placeholder="WORD"
                              value={dmWord}
                              onChange={e => setDmWord(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
                              className="flex-1 font-mono uppercase tracking-wider"
                              data-testid="input-dm-word"
                            />
                            <span className="w-5 shrink-0 flex items-center justify-center">
                              {dmWordValidating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                              {!dmWordValidating && dmWordValid !== undefined && dmWord.trim().length >= 2 && (
                                dmWordValid.exists
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              )}
                            </span>
                          </div>
                          <Select value={dmPos} onValueChange={setDmPos}>
                            <SelectTrigger className="w-32 shrink-0" data-testid="select-dm-pos">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["noun", "verb", "adjective", "adverb", "phrase"].map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {[0, 1, 2].map(i => (
                          <div key={i} className="relative">
                            <input
                              placeholder={i === 0 ? "Clue 1 — cryptic / abstract" : i === 1 ? "Clue 2 — more specific" : "Clue 3 — most obvious"}
                              value={dmDefs[i]}
                              onChange={e => setDmDefs(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                              className={`w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${i === 0 ? "" : i === 1 ? "border-amber-200 dark:border-amber-800" : "border-emerald-200 dark:border-emerald-800"}`}
                              data-testid={`input-dm-def-${i}`}
                            />
                            <span className={`absolute right-2 top-2 text-[10px] font-semibold px-1 rounded ${i === 0 ? "text-primary/60" : i === 1 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {i === 0 ? "C1" : i === 1 ? "C2" : "C3"}
                            </span>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" className="flex-1" disabled={!canSave} onClick={saveEntry} data-testid="button-dm-add-entry">
                            {isEditing ? "Save Changes" : "Add Entry"}
                          </Button>
                          {isEditing && (
                            <Button type="button" size="sm" variant="outline" onClick={cancelEdit} data-testid="button-dm-cancel-edit">
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {dmEntries.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Add at least 1 word entry to create this quiz.</p>
                    )}
                  </div>
                );
              })()}
              {slug === "word-roots" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Puzzle Set Preview</label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setWrSeed(Math.floor(Math.random() * 1_000_000))}
                      disabled={wrPreviewFetching}
                      className="gap-1.5 h-7 text-xs"
                      data-testid="button-wr-reroll"
                    >
                      {wrPreviewFetching
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                      Re-roll
                    </Button>
                  </div>
                  <div className="rounded-lg border bg-muted/10 p-3 space-y-2 min-h-[120px]">
                    {wrPreviewFetching ? (
                      <div className="flex items-center justify-center h-20">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : wrPreviewPuzzles ? (
                      wrPreviewPuzzles.map((p, i) => (
                        <div key={i} className="flex flex-col gap-0.5" data-testid={`wr-preview-${i}`}>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                            <span className="font-mono font-bold tracking-wider text-sm">{p.canonicalWord}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 pl-6">
                            {p.derivatives.map((d, j) => (
                              <span key={j} className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono text-muted-foreground">{d}</span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center pt-6">Loading preview…</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Players see the derivative clues (badges), not the canonical word. Re-roll to get a different set of 5 puzzles.</p>
                </div>
              )}
              {(slug === "word-length" || slug === "letter-hunt" || slug === "letter-position" || slug === "letter-frequency" || slug === "letter-dodge" || slug === "letter-balance") && (
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
                      onClick={() => setQuizParams(({ wordCount: _wc, timeLimit: _tl, ...rest }) => ({ ...rest, survival: true }))}
                      data-testid="button-quiz-mode-survival"
                    >
                      Survival (8s/word)
                    </Button>
                  </div>
                </div>
              )}
              <Button
                className="w-full gap-2"
                onClick={() => slug === "definition-match" ? setDmReview(true) : createQuizMutation.mutate()}
                disabled={
                  !quizTitle.trim() ||
                  (slug !== "definition-match" && createQuizMutation.isPending) ||
                  (slug === "letter-position" && (
                    !lpLetter || !lpPosition ||
                    lpCountFetching ||
                    lpCountData === undefined ||
                    lpCountData.count < LP_QUIZ_MIN_WORDS
                  )) ||
                  (slug === "word-length" && (!wlQuizLength || wlQuizCountFetching || !wlQuizCountData || !wlQuizCountData.ok)) ||
                  (slug === "word-length" && !quizParams.survival && wlQuizCountData?.ok && (quizParams.wordCount ?? 20) > wlQuizCountData.count) ||
                  (["letter-hunt", "letter-position", "letter-frequency"].includes(slug) && !quizParams.survival && quizParams.wordCount !== undefined && quizParams.wordCount < 1) ||
                  (slug === "letter-balance" && quizParams.category === undefined && quizParams.vowels === undefined && quizParams.consonants === undefined) ||
                  (slug === "letter-balance" && quizParams.category === "locked_balance" && (!quizParams.level || !quizParams.consonantCount)) ||
                  (slug === "definition-match" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0)) ||
                  (slug === "progressive-reveal" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0)) ||
                  (slug === "anagram-solver" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0)) ||
                  (slug === "word-scramble" && (!Array.isArray(quizParams.words) || quizParams.words.length === 0))
                }
                data-testid="button-create-quiz-submit"
              >
                {createQuizMutation.isPending && slug !== "definition-match" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                {slug === "definition-match" ? "Review & Create →" : "Create Session"}
              </Button>
              </>
              )}
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
                className="w-full gap-2"
                onClick={() => { setShowQuizDialog(false); navigate(`/quiz/${createdQuiz!.shareCode}`); }}
                data-testid="button-play-quiz"
              >
                <Play className="h-4 w-4" />
                Play Quiz
              </Button>
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

      <Dialog open={showCustomPlayDialog} onOpenChange={(open) => { setShowCustomPlayDialog(open); if (!open) { setCustomPlayParams({}); setLbCustomMode("count"); } }}>
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
                {!customPlayParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-custom-lp-word-count"
                        value={customPlayParams.wordCount ?? ""}
                        onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                            onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-custom-lp-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {slug === "letter-hunt" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Letter Count</label>
                  <Select
                    value={customPlayParams.challenge !== undefined ? String(customPlayParams.challenge) : "random"}
                    onValueChange={(v) => {
                      if (v === "random") {
                        setCustomPlayParams(p => { const n = { ...p }; delete n.challenge; delete n.letters; return n; });
                      } else {
                        const c = Number(v);
                        setCustomPlayParams(p => ({ ...p, challenge: c, letters: Array(c + 1).fill("any") }));
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-custom-challenge">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Auto</SelectItem>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n + 1} letters</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {typeof customPlayParams.challenge === "number" && (
                  <div>
                    <label className="text-sm font-medium">Pin Letters (optional)</label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {Array.from({ length: customPlayParams.challenge + 1 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                          <Select
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
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a specific letter.</p>
                  </div>
                )}
                {!customPlayParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-custom-hunt-word-count"
                        value={customPlayParams.wordCount ?? ""}
                        onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                            onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-custom-hunt-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {slug === "letter-dodge" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Difficulty (forbidden letters)</label>
                  <Select
                    value={customPlayParams.difficulty !== undefined ? String(customPlayParams.difficulty) : "auto"}
                    onValueChange={(v) => {
                      if (v === "auto") {
                        setCustomPlayParams(p => { const n = { ...p }; delete n.difficulty; delete n.letters; return n; });
                      } else if (v === "advanced") {
                        setCustomPlayParams(p => ({ ...p, difficulty: "advanced" as const, letters: undefined }));
                      } else if (v === "savant") {
                        setCustomPlayParams(p => ({ ...p, difficulty: "savant" as const, letters: undefined }));
                      } else {
                        const c = Number(v) as 1 | 2 | 3 | 4 | 5;
                        setCustomPlayParams(p => ({ ...p, difficulty: c, letters: Array(c).fill("any") }));
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-custom-dodge-difficulty">
                      <SelectValue placeholder="Auto (random)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (random)</SelectItem>
                      <SelectItem value="1">Easy — 1 forbidden letter</SelectItem>
                      <SelectItem value="2">Medium — 2 forbidden letters</SelectItem>
                      <SelectItem value="3">Hard — 3 forbidden letters</SelectItem>
                      <SelectItem value="4">Expert — 4 forbidden letters</SelectItem>
                      <SelectItem value="5">Master — 5 forbidden letters</SelectItem>
                      <SelectItem value="savant">Savant — 6–12 forbidden letters</SelectItem>
                      <SelectItem value="advanced">Advanced — random count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {typeof customPlayParams.difficulty === "number" && (
                  <div>
                    <label className="text-sm font-medium">Pin Forbidden Letters (optional)</label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {Array.from({ length: customPlayParams.difficulty }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                          <Select
                            value={(customPlayParams.letters?.[i]) || "any"}
                            onValueChange={(v) => setCustomPlayParams(p => {
                              const letters = [...(p.letters ?? Array(p.difficulty as number).fill("any"))];
                              letters[i] = v;
                              return { ...p, letters };
                            })}
                          >
                            <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-custom-dodge-letter-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Each slot can be "Any" or a specific letter to always avoid.</p>
                  </div>
                )}
                {!customPlayParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to submit</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-custom-dodge-word-count"
                        value={customPlayParams.wordCount ?? ""}
                        onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(customPlayParams.timeLimit ?? 90) === t ? "default" : "outline"}
                            onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-custom-dodge-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {slug === "letter-frequency" && (
              <>
                <div>
                  <label className="text-sm font-medium">Frequency Challenge</label>
                  <Select
                    value={customPlayParams.challenge !== undefined ? String(customPlayParams.challenge) : "0"}
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
                        return { ...p, challenge: c === 0 ? undefined : c, letter: newLetter, letters: c !== "multi" ? undefined : (p.letters ?? ["any", "any"]), letterCounts: c !== "multi" ? undefined : (p.letterCounts ?? [2, 2]) };
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-custom-challenge">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Auto</SelectItem>
                      <SelectItem value="1">Challenge 1 (exactly 2×)</SelectItem>
                      <SelectItem value="2">Challenge 2 (exactly 3×)</SelectItem>
                      <SelectItem value="3">Challenge 3 (exactly 4×)</SelectItem>
                      <SelectItem value="4">Challenge 4 (5× or more)</SelectItem>
                      <SelectItem value="multi">Multi-Letter (2+ letters)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {customPlayParams.challenge === "multi" && (
                  <div>
                    <label className="text-sm font-medium">Pin Letters (optional)</label>
                    <div className="flex gap-1 mt-1 mb-2">
                      {[2, 3].map(n => (
                        <Button
                          key={n}
                          type="button"
                          size="sm"
                          variant={(customPlayParams.letters?.length ?? 2) === n ? "default" : "outline"}
                          onClick={() => setCustomPlayParams(p => {
                            const cur: string[] = p.letters ?? Array(2).fill("any");
                            const curCounts: number[] = p.letterCounts ?? Array(2).fill(2);
                            const next = n > cur.length
                              ? [...cur, ...Array(n - cur.length).fill("any")]
                              : cur.slice(0, n);
                            const nextCounts = n > curCounts.length
                              ? [...curCounts, ...Array(n - curCounts.length).fill(2)]
                              : curCounts.slice(0, n);
                            return { ...p, letters: next, letterCounts: nextCounts };
                          })}
                          data-testid={`button-custom-freq-multi-count-${n}`}
                        >
                          {n} letters
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {Array.from({ length: customPlayParams.letters?.length ?? 2 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                          <Select
                            value={(customPlayParams.letters?.[i]) || "any"}
                            onValueChange={(v) => setCustomPlayParams(p => {
                              const letters = [...(p.letters ?? Array(2).fill("any"))];
                              letters[i] = v;
                              return { ...p, letters };
                            })}
                          >
                            <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-custom-freq-multi-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {"ABCDEFGHILMNOPRSTUWY".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map(cnt => (
                              <Button
                                key={cnt}
                                type="button"
                                size="sm"
                                variant={(customPlayParams.letterCounts?.[i] ?? 2) === cnt ? "default" : "outline"}
                                className="h-6 w-6 p-0 text-xs"
                                onClick={() => setCustomPlayParams(p => {
                                  const counts = [...(p.letterCounts ?? Array(p.letters?.length ?? 2).fill(2))];
                                  counts[i] = cnt;
                                  return { ...p, letterCounts: counts };
                                })}
                                data-testid={`button-custom-freq-multi-lcount-${i}-${cnt}`}
                              >
                                {cnt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Each slot: pick a letter (or Any) and its required count.</p>
                  </div>
                )}
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
                {!customPlayParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-custom-freq-word-count"
                        value={customPlayParams.wordCount ?? ""}
                        onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                            onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-custom-freq-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {slug === "letter-balance" && (() => {
              const isStructural = lbCustomMode === "structural";
              const structuralCats = [
                { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4,5,6,7,8,9,10,11,12] as number[] },
                { id: "locked_balance", name: "Locked Balance", levelType: "length", levels: [] as number[] },
              ];
              const selectedCat = structuralCats.find(c => c.id === customPlayParams.category);
              return (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Challenge type</label>
                    <div className="flex gap-2 mt-1">
                      <Button type="button" size="sm"
                        variant={!isStructural ? "default" : "outline"}
                        onClick={() => { setLbCustomMode("count"); setCustomPlayParams(({ category: _c, level: _l, consonantCount: _cc, ...rest }) => rest); }}
                        data-testid="button-custom-lb-mode-count"
                      >
                        Count-based
                      </Button>
                      <Button type="button" size="sm"
                        variant={isStructural ? "default" : "outline"}
                        onClick={() => { setLbCustomMode("structural"); setCustomPlayParams(({ vowels: _v, consonants: _co, length: _l, ...rest }) => rest); }}
                        data-testid="button-custom-lb-mode-structural"
                      >
                        Structural
                      </Button>
                    </div>
                  </div>
                  {!isStructural ? (
                    <>
                      <p className="text-xs text-muted-foreground">Set vowel and/or consonant counts (at least one required). Length is optional.</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-medium">Vowels</label>
                          <Input
                            type="number" min={1} max={7} placeholder="Any"
                            className="mt-1 h-8 text-sm"
                            data-testid="input-custom-lb-vowels"
                            value={customPlayParams.vowels ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                              setCustomPlayParams(p => {
                                const consonants = p.consonants;
                                if (v !== undefined && consonants !== undefined) return { ...p, vowels: v, length: v + consonants };
                                if (v === undefined) return { ...p, vowels: v, length: undefined };
                                return { ...p, vowels: v };
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Consonants</label>
                          <Input
                            type="number" min={1} max={7} placeholder="Any"
                            className="mt-1 h-8 text-sm"
                            data-testid="input-custom-lb-consonants"
                            value={customPlayParams.consonants ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Math.min(7, Math.max(1, parseInt(e.target.value) || 1));
                              setCustomPlayParams(p => {
                                const vowels = p.vowels;
                                if (v !== undefined && vowels !== undefined) return { ...p, consonants: v, length: vowels + v };
                                if (v === undefined) return { ...p, consonants: v, length: undefined };
                                return { ...p, consonants: v };
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">
                            {customPlayParams.vowels !== undefined && customPlayParams.consonants !== undefined ? "Length (auto)" : "Length (opt.)"}
                          </label>
                          <Input
                            type="number" min={3} max={15} placeholder="Any"
                            className="mt-1 h-8 text-sm"
                            data-testid="input-custom-lb-length"
                            disabled={customPlayParams.vowels !== undefined && customPlayParams.consonants !== undefined}
                            value={customPlayParams.length ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Math.min(15, Math.max(3, parseInt(e.target.value) || 3));
                              setCustomPlayParams(p => ({ ...p, length: v }));
                            }}
                          />
                        </div>
                      </div>
                      {customPlayParams.vowels === undefined && customPlayParams.consonants === undefined && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Set at least vowels or consonants to start playing.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium">Category</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {structuralCats.map(cat => (
                            <Button
                              key={cat.id}
                              type="button"
                              size="sm"
                              variant={customPlayParams.category === cat.id ? "default" : "outline"}
                              className="justify-start text-left h-auto py-1.5 px-2.5 text-xs"
                              onClick={() => cat.id === "locked_balance"
                                ? setCustomPlayParams(p => ({ ...p, category: cat.id, level: undefined, consonantCount: undefined }))
                                : setCustomPlayParams(p => ({ ...p, category: cat.id, level: cat.levels[0], consonantCount: undefined }))
                              }
                              data-testid={`button-custom-lb-cat-${cat.id}`}
                            >
                              {cat.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {customPlayParams.category === "locked_balance" ? (
                        <>
                          <div>
                            <label className="text-sm font-medium">Word length</label>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {[4,5,6,7,8,9,10].map(lv => (
                                <Button key={lv} type="button" size="sm"
                                  variant={customPlayParams.level === lv ? "default" : "outline"}
                                  onClick={() => setCustomPlayParams(p => ({ ...p, level: lv, consonantCount: undefined }))}
                                  data-testid={`button-custom-lb-level-${lv}`}
                                >
                                  {lv}
                                </Button>
                              ))}
                            </div>
                          </div>
                          {customPlayParams.level !== undefined && (
                            <div>
                              <label className="text-sm font-medium">Consonant count <span className="text-xs font-normal text-muted-foreground">(vowels = {customPlayParams.level} − count)</span></label>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {Array.from({ length: customPlayParams.level - 1 }, (_, i) => i + 1).map(c => {
                                  const v = customPlayParams.level - c;
                                  return (
                                    <Button key={c} type="button" size="sm"
                                      variant={customPlayParams.consonantCount === c ? "default" : "outline"}
                                      onClick={() => setCustomPlayParams(p => ({ ...p, consonantCount: c }))}
                                      data-testid={`button-custom-lb-consonant-${c}`}
                                      title={`${c}C / ${v}V`}
                                    >
                                      {c}C/{v}V
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {(!customPlayParams.level || !customPlayParams.consonantCount) && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              {!customPlayParams.level ? "Pick a word length." : "Pick a consonant count."}
                            </p>
                          )}
                        </>
                      ) : selectedCat ? (
                        <div>
                          <label className="text-sm font-medium">
                            Level <span className="text-xs font-normal text-muted-foreground">({selectedCat.levelType === "length" ? "word length" : "count"})</span>
                          </label>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {selectedCat.levels.map(lv => (
                              <Button
                                key={lv}
                                type="button"
                                size="sm"
                                variant={customPlayParams.level === lv ? "default" : "outline"}
                                onClick={() => setCustomPlayParams(p => ({ ...p, level: lv }))}
                                data-testid={`button-custom-lb-level-${lv}`}
                              >
                                {lv}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {!customPlayParams.category && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Pick a category to start playing.</p>
                      )}
                    </>
                  )}
                  {!customPlayParams.survival && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Words to find</label>
                        <Input
                          type="number" min={1} max={50} placeholder="20"
                          className="mt-1 h-8 text-sm w-24"
                          data-testid="input-custom-lb-word-count"
                          value={customPlayParams.wordCount ?? ""}
                          onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Time limit</label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {[60, 90, 120, 180, 300].map(t => (
                            <Button key={t} type="button" size="sm"
                              variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                              onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                              data-testid={`button-custom-lb-time-${t}`}
                            >
                              {t < 60 ? `${t}s` : `${t / 60}min`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

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
                {!customPlayParams.survival && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Words to find</label>
                      <Input
                        type="number" min={1} max={wlCustomCountData?.count ?? 50} placeholder="20"
                        className="mt-1 h-8 text-sm w-24"
                        data-testid="input-custom-wl-word-count"
                        value={customPlayParams.wordCount ?? ""}
                        onChange={(e) => setCustomPlayParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(wlCustomCountData?.count ?? 50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time limit</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[60, 90, 120, 180, 300].map(t => (
                          <Button key={t} type="button" size="sm"
                            variant={(customPlayParams.timeLimit ?? 120) === t ? "default" : "outline"}
                            onClick={() => setCustomPlayParams(p => ({ ...p, timeLimit: t }))}
                            data-testid={`button-custom-wl-time-${t}`}
                          >
                            {t < 60 ? `${t}s` : `${t / 60}min`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {(
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
                    onClick={() => setCustomPlayParams(({ wordCount: _wc, timeLimit: _tl, ...rest }) => ({ ...rest, survival: true }))}
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
                setCustomPlayFrozenParams(customPlayParams);
                setCustomPlayEnded(false);
                setShowCustomPlayDialog(false);
                setIsCustomPlay(true);
                setIsPlaying(true);
              }}
              disabled={
                (slug === "letter-balance" && customPlayParams.vowels === undefined && customPlayParams.consonants === undefined && !customPlayParams.category) ||
                (slug === "letter-balance" && customPlayParams.category === "locked_balance" && (!customPlayParams.level || !customPlayParams.consonantCount)) ||
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
            {slug === "letter-balance" && (
              <div className="space-y-3 rounded-md border border-border p-3">
                <label className="text-sm font-medium">Challenge type</label>
                <div className="flex gap-2">
                  <Button type="button" size="sm"
                    variant={challengeLbMode === "random" ? "default" : "outline"}
                    onClick={() => { setChallengeLbMode("random"); setChallengeLbLevel(undefined); setChallengeLbConsonantCount(undefined); }}
                    data-testid="button-challenge-lb-random"
                  >
                    Random
                  </Button>
                  <Button type="button" size="sm"
                    variant={challengeLbMode === "locked" ? "default" : "outline"}
                    onClick={() => setChallengeLbMode("locked")}
                    data-testid="button-challenge-lb-locked"
                  >
                    Locked Balance
                  </Button>
                </div>
                {challengeLbMode === "locked" && (
                  <>
                    <div>
                      <label className="text-xs font-medium">Word length</label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {[4,5,6,7,8,9,10].map(lv => (
                          <Button key={lv} type="button" size="sm"
                            variant={challengeLbLevel === lv ? "default" : "outline"}
                            onClick={() => { setChallengeLbLevel(lv); setChallengeLbConsonantCount(undefined); }}
                            data-testid={`button-challenge-lb-level-${lv}`}
                          >
                            {lv}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {challengeLbLevel !== undefined && (
                      <div>
                        <label className="text-xs font-medium">Consonant count <span className="text-muted-foreground font-normal">(vowels = {challengeLbLevel} − count)</span></label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Array.from({ length: challengeLbLevel - 1 }, (_, i) => i + 1).map(c => {
                            const v = challengeLbLevel - c;
                            return (
                              <Button key={c} type="button" size="sm"
                                variant={challengeLbConsonantCount === c ? "default" : "outline"}
                                onClick={() => setChallengeLbConsonantCount(c)}
                                data-testid={`button-challenge-lb-consonant-${c}`}
                                title={`${c}C / ${v}V`}
                              >
                                {c}C/{v}V
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {challengeLbMode === "locked" && (!challengeLbLevel || !challengeLbConsonantCount) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {!challengeLbLevel ? "Pick a word length." : "Pick a consonant count."}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
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
              disabled={!selectedFriendId || (slug === "letter-balance" && challengeLbMode === "locked" && (!challengeLbLevel || !challengeLbConsonantCount))}
              data-testid="button-start-challenge"
            >
              <Play className="h-4 w-4" />
              Play &amp; Send Challenge
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DuelChallengeDialog gameSlug={slug} open={showDuelDialog} onOpenChange={setShowDuelDialog} />
    </div>
  );
}
