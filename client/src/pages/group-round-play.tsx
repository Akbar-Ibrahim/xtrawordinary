import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Trophy, CheckCircle, Users, X, Clock, Lock } from "lucide-react";
import type { GroupRound, GroupRoundScore } from "@shared/schema";

import { WordLadderGame } from "@/components/games/word-ladder";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { WordScrambleGame } from "@/components/games/word-scramble";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordMakerGame } from "@/components/games/word-maker";
import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { LetterHuntGame } from "@/components/games/letter-hunt";
import { LetterDodgeGame } from "@/components/games/letter-dodge";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { NoRepeatsGame } from "@/components/games/no-repeats";
import { WordSweepGame } from "@/components/games/word-sweep";
import { WordRootsGame } from "@/components/games/word-roots";
import { ShellWordsGame } from "@/components/games/shell-words";
import { DeepShellWordsGame } from "@/components/games/deep-shell-words";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { CommentSection } from "@/components/comment-section";

const SLUG_TO_PRIMARY: Record<string, string> = {
  "shell-words-guided": "shell-words",
  "shell-words-blitz-survival": "shell-words",
  "shell-words-wrapper-survival": "shell-words",
  "shell-words-crack": "shell-words",
  "shell-words-crack-survival": "shell-words",
  "deep-shell-words-guided": "deep-shell-words",
  "deep-shell-words-blitz-survival": "deep-shell-words",
  "deep-shell-words-wrapper-survival": "deep-shell-words",
  "deep-shell-words-crack": "deep-shell-words",
  "deep-shell-words-crack-survival": "deep-shell-words",
};
function primarySlug(slug: string): string { return SLUG_TO_PRIMARY[slug] ?? slug; }

const GAME_NAMES: Record<string, string> = {
  "word-ladder": "Word Ladder", "anagram-solver": "Anagram Solver",
  "word-scramble": "Word Scramble", "definition-match": "Definition Match",
  "letter-pool": "Letter Pool", "word-maker": "Word Maker",
  "word-length": "Length Challenge", "letter-position": "Position Master",
  "letter-hunt": "Letter Hunt", "letter-dodge": "Letter Dodge", "letter-balance": "Letter Balance",
  "letter-frequency": "Letter Frequency", "no-repeats": "No Repeats",
  "word-sweep": "Word Sweep", "word-roots": "Word Roots",
  "shell-words": "Shell Words",
  "deep-shell-words": "Deep Shell Words",
};

const LETTER_BALANCE_CATEGORIES = [
  "consonant_count", "vowel_count", "start_end_vowel", "start_end_consonant",
  "start_vowel_end_consonant", "start_consonant_end_vowel", "consonant_oblivion", "vowel_oblivion",
] as const;
const LETTER_BALANCE_LEVELS: Record<string, number[]> = {
  consonant_count: [2, 3, 4, 5, 6, 7], vowel_count: [2, 3, 4, 5, 6, 7],
  start_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12], start_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_vowel_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12], start_consonant_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  consonant_oblivion: [2, 3, 4, 5], vowel_oblivion: [2, 3, 4, 5],
};

type GroupGameConfig = { initialLetters?: string[]; category?: string; level?: number; consonantCount?: number };

function renderGroupGame(slug: string, seed: number, gameConfig?: GroupGameConfig | null): React.ReactNode {
  switch (slug) {
    case "word-length": {
      const wlOptions: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      return <WordLengthGame initialChallenge={wlOptions[seed % wlOptions.length]} groupSeed={seed} locked />;
    }
    case "letter-position": return <LetterPositionGame initialChallenge={((seed % 2) + 1) as 1 | 2} groupSeed={seed} locked />;
    case "letter-hunt": {
      const options: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      return <LetterHuntGame initialChallenge={options[seed % options.length]} groupSeed={seed} locked />;
    }
    case "letter-dodge": {
      const dodgeOptions: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      return <LetterDodgeGame initialDifficulty={dodgeOptions[seed % dodgeOptions.length]} groupSeed={seed} locked />;
    }
    case "letter-balance": {
      if (gameConfig?.category === "locked_balance" && gameConfig.level && gameConfig.consonantCount) {
        return <LetterBalanceGame initialChallenge={{ category: "locked_balance", level: gameConfig.level, consonantCount: gameConfig.consonantCount }} groupSeed={seed} locked />;
      }
      const cat = LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const levels = LETTER_BALANCE_LEVELS[cat];
      const level = levels[(seed >> 4) % levels.length];
      return <LetterBalanceGame initialChallenge={{ category: cat, level }} groupSeed={seed} locked />;
    }
    case "letter-frequency": {
      const lfLetters = gameConfig?.initialLetters ?? gameConfig?.letters;
      if (lfLetters && lfLetters.length >= 2) {
        return <LetterFrequencyGame initialChallenge="multi" initialLetters={lfLetters} groupSeed={seed} locked />;
      }
      const options: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
      return <LetterFrequencyGame initialChallenge={options[seed % options.length]} groupSeed={seed} locked />;
    }
    case "no-repeats": {
      const options: Array<3 | 4 | 5 | 6 | 7> = [3, 4, 5, 6, 7];
      return <NoRepeatsGame initialChallenge={options[seed % options.length]} locked />;
    }
    case "word-ladder": return <WordLadderGame initialChallenge groupSeed={seed} locked />;
    case "anagram-solver": return <AnagramSolverGame groupSeed={seed} locked />;
    case "word-scramble": return <WordScrambleGame groupSeed={seed} locked />;
    case "definition-match": return <DefinitionMatchGame groupSeed={seed} locked />;
    case "letter-pool": {
      const v = seed % 2 === 0 ? "with-pool" : "without-pool";
      return <LetterPoolGame initialChallenge={v as "with-pool" | "without-pool"} groupSeed={seed} locked />;
    }
    case "word-maker": return <WordMakerGame groupSeed={seed} locked />;
    case "word-sweep": {
      const sweepMode = seed % 2 === 0 ? "classic" : "guided";
      return <WordSweepGame mode={sweepMode} groupSeed={seed} locked />;
    }
    case "word-roots": return <WordRootsGame groupSeed={seed} locked />;
    case "shell-words": {
      const shellMode = seed % 2 === 0 ? "blitz" : "wrapper";
      return <ShellWordsGame initialMode={shellMode} groupSeed={seed} locked />;
    }
    case "deep-shell-words": {
      const deepShellMode = seed % 2 === 0 ? "blitz" : "wrapper";
      return <DeepShellWordsGame initialMode={deepShellMode} groupSeed={seed} locked />;
    }
    default: return null;
  }
}

type RoundScoreEntry = GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } };

interface RoundResponse {
  round: GroupRound;
  myScore: { id: number; score: number; durationMs: number | null; completedAt: string } | null;
}

interface AttemptResponse {
  attempt: { id: number; roundId: number; userId: number; startedAt: string } | null;
}

export default function GroupRoundPlay() {
  const { id, roundId } = useParams<{ id: string; roundId: string }>();
  const groupId = parseInt(id);
  const roundIdNum = parseInt(roundId);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [attemptStarted, setAttemptStarted] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const { ConfirmDialog, confirmExit } = useNavigationGuard(isPlaying && !submitted);

  const { data, isLoading, error } = useQuery<RoundResponse>({
    queryKey: ["/api/groups", groupId, "rounds", roundIdNum],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundIdNum}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !isNaN(groupId) && !isNaN(roundIdNum),
  });

  const { data: attemptData, isLoading: attemptLoading } = useQuery<AttemptResponse>({
    queryKey: ["/api/groups", groupId, "rounds", roundIdNum, "attempt"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundIdNum}/attempt`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !isNaN(groupId) && !isNaN(roundIdNum),
  });

  const { data: roundScores, isLoading: scoresLoading } = useQuery<RoundScoreEntry[]>({
    queryKey: ["/api/groups", groupId, "rounds", roundIdNum, "scores"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundIdNum}/scores`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !isNaN(groupId) && !isNaN(roundIdNum) && (submitted || !!data?.myScore || !!attemptData?.attempt),
    refetchInterval: submitted ? 10000 : false,
  });

  const recordAttemptMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/groups/${groupId}/rounds/${roundIdNum}/attempt`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundIdNum, "attempt"] });
    },
    onError: () => toast({ title: "Failed to start game", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async ({ score, durationMs }: { score: number; durationMs?: number }) =>
      apiRequest("POST", `/api/groups/${groupId}/rounds/${roundIdNum}/score`, { score, durationMs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundIdNum, "scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "leaderboard"] });
    },
    onError: () => toast({ title: "Failed to save score", variant: "destructive" }),
  });

  useEffect(() => {
    if (!isPlaying || !data) return;
    startTimeRef.current = Date.now();
    const handleResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (primarySlug(detail.slug) !== data.round.gameSlug) return;
      const score = detail.score ?? 0;
      const durationMs = startTimeRef.current ? Date.now() - startTimeRef.current : undefined;
      setFinalScore(score);
      setSubmitted(true);
      setIsPlaying(false);
      submitMutation.mutate({ score, durationMs });
    };
    window.addEventListener("wordplay-game-result", handleResult);
    return () => window.removeEventListener("wordplay-game-result", handleResult);
  }, [isPlaying, data]);

  const handlePlayClick = async () => {
    try {
      await recordAttemptMutation.mutateAsync();
      setAttemptStarted(true);
      setIsPlaying(true);
    } catch {
    }
  };

  if (isLoading || attemptLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href={`/groups/${groupId}`}>
          <Button variant="ghost" className="gap-2 mb-6"><ArrowLeft className="h-4 w-4" />Group</Button>
        </Link>
        <p className="text-muted-foreground text-center py-12">Round not found.</p>
      </div>
    );
  }

  const { round, myScore } = data;
  const hasAttempt = attemptStarted || !!attemptData?.attempt;
  const alreadyPlayed = !!myScore || submitted;
  const gameName = GAME_NAMES[round.gameSlug] || round.gameSlug;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {ConfirmDialog}
      <Link href={`/groups/${groupId}`}>
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back-group">
          <ArrowLeft className="h-4 w-4" />
          Back to Group
        </Button>
      </Link>

      <AnimatePresence mode="wait">
        {!isPlaying ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{gameName}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">Group Round</Badge>
                      <Badge variant={round.status === "active" ? "default" : "secondary"} className="text-xs capitalize">
                        {round.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {alreadyPlayed ? (
                  <>
                  <div className="space-y-5">
                    <div className="text-center py-2">
                      <div className="inline-flex items-center gap-2 text-green-600 mb-2">
                        <CheckCircle className="h-6 w-6" />
                        <span className="font-semibold text-lg">Score Submitted!</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        <span className="text-xl font-bold">
                          {submitted ? finalScore : myScore?.score ?? 0} pts
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Round Leaderboard
                      </p>
                      {scoresLoading ? (
                        <div className="space-y-1">
                          {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                        </div>
                      ) : roundScores && roundScores.length > 0 ? (
                        <div className="space-y-1" data-testid="round-leaderboard">
                          {roundScores.map((entry, i) => (
                            <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40" data-testid={`round-score-${entry.userId}`}>
                              <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                                {i + 1}
                              </span>
                              <Link href={`/profile/${entry.user.id}`}>
                                <UserAvatar name={entry.user.name} avatarUrl={entry.user.avatarUrl} className="h-7 w-7 cursor-pointer" />
                              </Link>
                              <Link href={`/profile/${entry.user.id}`} className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate hover:underline cursor-pointer">{entry.user.name}</span>
                              </Link>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {entry.durationMs != null
                                  ? `${Math.floor(entry.durationMs / 60000)}:${String(Math.floor((entry.durationMs % 60000) / 1000)).padStart(2, "0")}`
                                  : new Date(entry.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="font-bold text-sm">{entry.score.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">No scores yet.</p>
                      )}
                    </div>

                    <Link href={`/groups/${groupId}`}>
                      <Button variant="outline" className="w-full gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Group
                      </Button>
                    </Link>
                  </div>
                  <CommentSection targetType="group_round" targetId={String(roundIdNum)} />
                  </>
                ) : hasAttempt ? (
                  <>
                  <div className="space-y-5">
                    <div className="text-center py-4">
                      <div className="inline-flex items-center gap-2 text-orange-500 mb-2">
                        <Lock className="h-6 w-6" />
                        <span className="font-semibold text-lg">Game Already Started</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You already started this round. Your score was not submitted — the game is locked to prevent replays.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Round Leaderboard
                      </p>
                      {scoresLoading ? (
                        <div className="space-y-1">
                          {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                        </div>
                      ) : roundScores && roundScores.length > 0 ? (
                        <div className="space-y-1" data-testid="round-leaderboard">
                          {roundScores.map((entry, i) => (
                            <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40" data-testid={`round-score-${entry.userId}`}>
                              <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                                {i + 1}
                              </span>
                              <Link href={`/profile/${entry.user.id}`}>
                                <UserAvatar name={entry.user.name} avatarUrl={entry.user.avatarUrl} className="h-7 w-7 cursor-pointer" />
                              </Link>
                              <Link href={`/profile/${entry.user.id}`} className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate hover:underline cursor-pointer">{entry.user.name}</span>
                              </Link>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {entry.durationMs != null
                                  ? `${Math.floor(entry.durationMs / 60000)}:${String(Math.floor((entry.durationMs % 60000) / 1000)).padStart(2, "0")}`
                                  : new Date(entry.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="font-bold text-sm">{entry.score.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">No scores yet.</p>
                      )}
                    </div>
                    <Link href={`/groups/${groupId}`}>
                      <Button variant="outline" className="w-full gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Group
                      </Button>
                    </Link>
                  </div>
                  <CommentSection targetType="group_round" targetId={String(roundIdNum)} />
                  </>
                ) : round.status !== "active" ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">This round is closed.</p>
                    <Link href={`/groups/${groupId}`}>
                      <Button variant="outline">Back to Group</Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handlePlayClick}
                    disabled={recordAttemptMutation.isPending}
                    data-testid="button-play-group-round"
                  >
                    <Play className="h-5 w-5" />
                    Play {gameName}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">{gameName}</h2>
                <Badge variant="outline" className="text-xs mt-1"><Users className="h-3 w-3 mr-1" />Group Round</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => confirmExit(() => setIsPlaying(false))} className="gap-1.5" data-testid="button-exit-round">
                <X className="h-4 w-4" />
                Exit
              </Button>
            </div>
            {renderGroupGame(round.gameSlug, round.seed, round.gameConfig ? JSON.parse(round.gameConfig) : null) || (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">This game type is not available for group rounds.</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
