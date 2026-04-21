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
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { Game, FriendChallenge } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
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

const SEEDED_GAME_SLUGS = new Set([
  "anagram-solver",
  "deep-shell-words",
  "definition-match",
  "ladder-rush",
  "letter-balance",
  "letter-frequency",
  "letter-hunt",
  "letter-pool",
  "letter-position",
  "shell-words",
  "word-bloom",
  "word-ladder",
  "word-length",
  "word-maker",
  "word-roots",
  "word-scramble",
  "word-stretch",
  "word-sweep",
]);

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
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const searchParams = new URLSearchParams(searchString);
  const challengeId = searchParams.get("challenge");
  const challengeNewFriendId = searchParams.get("challenge-new");
  const challengeNewSeed = searchParams.get("seed");
  const challengeNewMsg = searchParams.get("msg");

  const isReceiverMode = !!challengeId;
  const isSenderMode = !!challengeNewFriendId && !!challengeNewSeed;
  const groupSeedForGame = isSenderMode
    ? parseInt(challengeNewSeed!)
    : undefined;

  const { data: receiverChallenge } = useQuery<FriendChallenge>({
    queryKey: ["/api/challenges", challengeId],
    queryFn: async () => {
      const res = await fetch(`/api/challenges/${challengeId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Challenge not found");
      return res.json();
    },
    enabled: !!challengeId && isAuthenticated,
  });

  const receiverGroupSeed = receiverChallenge?.seed ?? undefined;
  const effectiveGroupSeed = isSenderMode ? groupSeedForGame : receiverGroupSeed;

  useEffect(() => {
    if (challengeId || challengeNewFriendId) setIsPlaying(true);
  }, [challengeId, challengeNewFriendId]);

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
        setChallengeResult({ myScore, opponentScore, won: myScore >= opponentScore, isSender: false });
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
        submitChallengeMutation.mutate({
          friendId: parseInt(challengeNewFriendId),
          gameSlug: slug!,
          score,
          seed: parseInt(challengeNewSeed),
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
                </CardContent>
              </Card>
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
                  <Swords className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Challenge Mode</p>
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
                  <Swords className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Friend Challenge</p>
                    <p className="text-xs text-muted-foreground">
                      Score to beat: <strong>{receiverChallenge.senderScore} pts</strong>
                      {receiverChallenge.message && ` — "${receiverChallenge.message}"`}
                      {receiverChallenge.seed != null && " · Same puzzle as your friend"}
                    </p>
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

            {challengeResult && (
              <Card className={`mb-6 border-2 ${challengeResult.won ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-muted bg-muted/30"}`}>
                <CardContent className="py-5 px-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Trophy className={`h-6 w-6 ${challengeResult.won ? "text-yellow-500" : "text-muted-foreground"}`} />
                    <p className="text-lg font-bold">
                      {challengeResult.won ? "You won the challenge!" : "Your friend wins this one!"}
                    </p>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">Your score</p>
                      <p className="text-2xl font-bold">{challengeResult.myScore}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Their score</p>
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
            )}

            {GameComponent ? (
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
                        {f.friendUser.avatarUrl
                          ? <img src={f.friendUser.avatarUrl} className="h-5 w-5 rounded-full" />
                          : <User className="h-4 w-4" />}
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
