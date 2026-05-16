import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Trophy, X, Play, CheckCircle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { Game } from "@shared/schema";
import { getDailyChallengeRecord, saveDailyChallengeRecord } from "@/lib/game-stats";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WordLadderGame } from "@/components/games/word-ladder";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { WordScrambleGame } from "@/components/games/word-scramble";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordMakerGame } from "@/components/games/word-maker";
import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { LetterHuntGame } from "@/components/games/letter-hunt";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { NoRepeatsGame } from "@/components/games/no-repeats";
import { WordSweepGame } from "@/components/games/word-sweep";
import { WordChainGame } from "@/components/games/word-chain";
import { WordSplitGame } from "@/components/games/word-split";
import { WordStackGame } from "@/components/games/word-stack";
import { ProgressiveRevealGame } from "@/components/games/progressive-reveal";
import { WordRootsGame } from "@/components/games/word-roots";
import { ShellWordsGame } from "@/components/games/shell-words";
import { DeepShellWordsGame } from "@/components/games/deep-shell-words";
import { LetterDodgeGame } from "@/components/games/letter-dodge";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";

interface DailyChallengeResponse {
  date: string;
  slug: string;
  game: Game;
  seed: number;
}

interface AttemptResponse {
  attempt: { id: number; userId: number; challengeDate: string; startedAt: string } | null;
}

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

const LETTER_BALANCE_CATEGORIES = [
  "consonant_count", "vowel_count", "start_end_vowel", "start_end_consonant",
  "start_vowel_end_consonant", "start_consonant_end_vowel", "consonant_oblivion", "vowel_oblivion",
] as const;

const LETTER_BALANCE_LEVELS: Record<string, number[]> = {
  consonant_count: [2, 3, 4, 5, 6, 7],
  vowel_count: [2, 3, 4, 5, 6, 7],
  start_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_vowel_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_consonant_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  consonant_oblivion: [2, 3, 4, 5],
  vowel_oblivion: [2, 3, 4, 5],
};

function renderDailyGame(slug: string, seed: number): React.ReactNode {
  switch (slug) {
    case "word-length": {
      const variation = (seed % 5) + 1;
      return <WordLengthGame initialChallenge={variation} locked />;
    }
    case "letter-position": {
      const challenge = ((seed % 2) + 1) as 1 | 2;
      return <LetterPositionGame initialChallenge={challenge} locked />;
    }
    case "letter-hunt": {
      const options: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      const challenge = options[seed % options.length];
      return <LetterHuntGame initialChallenge={challenge} locked />;
    }
    case "letter-balance": {
      const cat = LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const levels = LETTER_BALANCE_LEVELS[cat];
      const level = levels[(seed >> 4) % levels.length];
      return <LetterBalanceGame initialChallenge={{ category: cat, level }} locked />;
    }
    case "letter-frequency": {
      const options: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
      const challenge = options[seed % options.length];
      return <LetterFrequencyGame initialChallenge={challenge} locked />;
    }
    case "no-repeats": {
      const options: Array<3 | 4 | 5 | 6 | 7> = [3, 4, 5, 6, 7];
      const challenge = options[seed % options.length];
      return <NoRepeatsGame initialChallenge={challenge} locked />;
    }
    case "word-ladder":
      return <WordLadderGame initialChallenge locked />;
    case "anagram-solver":
      return <AnagramSolverGame locked />;
    case "word-scramble":
      return <WordScrambleGame locked />;
    case "definition-match":
      return <DefinitionMatchGame locked />;
    case "letter-pool": {
      const poolVariation = seed % 2 === 0 ? "with-pool" : "without-pool";
      return <LetterPoolGame initialChallenge={poolVariation as "with-pool" | "without-pool"} locked />;
    }
    case "word-maker":
      return <WordMakerGame locked />;
    case "word-sweep": {
      const sweepMode = seed % 2 === 0 ? "classic" : "guided";
      return <WordSweepGame mode={sweepMode} groupSeed={seed} locked />;
    }
    case "word-chain": {
      const variation = ((seed % 2) + 1) as 1 | 2;
      const level = ((seed >> 2) % 2 + 1) as 1 | 2;
      return <WordChainGame initialChallenge={{ variation, level }} locked />;
    }
    case "word-split": {
      const difficulties = ["short", "medium", "long"] as const;
      const diff = difficulties[seed % difficulties.length];
      return <WordSplitGame initialChallenge={diff} locked />;
    }
    case "word-stack":
      return <WordStackGame locked />;
    case "progressive-reveal":
      return <ProgressiveRevealGame locked />;
    case "word-roots":
      return <WordRootsGame locked />;
    case "shell-words": {
      const shellMode = seed % 2 === 0 ? "blitz" : "wrapper";
      return <ShellWordsGame initialMode={shellMode} groupSeed={seed} locked />;
    }
    case "deep-shell-words": {
      const deepShellMode = seed % 2 === 0 ? "blitz" : "wrapper";
      return <DeepShellWordsGame initialMode={deepShellMode} groupSeed={seed} locked />;
    }
    case "letter-dodge":
      return <LetterDodgeGame groupSeed={seed} locked />;
    default:
      return null;
  }
}

export default function DailyChallenge() {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);

  const { data, isLoading, error } = useQuery<DailyChallengeResponse>({
    queryKey: ["/api/daily-challenge"],
  });

  const { data: attemptData, isLoading: attemptLoading } = useQuery<AttemptResponse & { authenticated?: boolean }>({
    queryKey: ["/api/daily-challenge/attempt", data?.date],
    queryFn: async () => {
      const res = await fetch(`/api/daily-challenge/attempt?date=${data!.date}`, { credentials: "include" });
      if (res.status === 401) return { attempt: null, authenticated: false };
      if (!res.ok) throw new Error("Failed");
      return { ...(await res.json()), authenticated: true };
    },
    enabled: !!data?.date,
  });

  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [attemptStarted, setAttemptStarted] = useState(false);
  const [countdown, setCountdown] = useState("");

  const { ConfirmDialog, confirmExit } = useNavigationGuard(isPlaying && !completed);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const localRecord = data ? getDailyChallengeRecord(data.date) : null;
  const serverAttemptLoaded = !attemptLoading && attemptData !== undefined;
  const serverAuthenticated = serverAttemptLoaded && attemptData?.authenticated === true;
  const serverAttempted = serverAuthenticated && !!attemptData?.attempt;
  const localCompleted = !!localRecord;

  const showCompleted = completed || attemptStarted || (serverAuthenticated ? serverAttempted : localCompleted);

  const recordAttemptMutation = useMutation({
    mutationFn: async (date: string) =>
      apiRequest("POST", "/api/daily-challenge/attempt", { date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-challenge/attempt", data?.date] });
    },
  });

  useEffect(() => {
    if (!data || !isPlaying || completed) return;
    const handleGameResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (primarySlug(detail.slug) !== data.slug) return;
      saveDailyChallengeRecord({
        date: data.date,
        slug: data.slug,
        score: detail.score ?? 0,
        completedAt: Date.now(),
      });
      setFinalScore(detail.score ?? 0);
      setCompleted(true);
      setAttemptStarted(false);
      setIsPlaying(false);
    };
    window.addEventListener("wordplay-game-result", handleGameResult);
    return () => window.removeEventListener("wordplay-game-result", handleGameResult);
  }, [data, isPlaying, completed]);

  const handleStartChallenge = async () => {
    if (data?.date) {
      try {
        await recordAttemptMutation.mutateAsync(data.date);
        setAttemptStarted(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        const isUnauthorized = msg.startsWith("401");
        if (!isUnauthorized) {
          toast({ title: "Unable to start challenge. Please try again.", variant: "destructive" });
          return;
        }
      }
    }
    setIsPlaying(true);
  };

  if (isLoading || (!!data && attemptLoading)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full max-w-2xl mx-auto rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load today's challenge.</p>
        </div>
      </div>
    );
  }

  const { game, date, seed } = data;
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {ConfirmDialog}
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back-daily">
          <ArrowLeft className="h-4 w-4" />
          Back to Games
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
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{formattedDate}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">Daily Challenge</h1>
              <p className="text-muted-foreground">
                A new challenge every day. Same game for everyone.
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: game.color }}
                  >
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{game.name}</h2>
                    <p className="text-sm text-muted-foreground">{game.description}</p>
                  </div>
                </div>

                {showCompleted ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="inline-flex items-center gap-2 text-accent">
                      <CheckCircle className="h-6 w-6" />
                      <span className="font-semibold text-lg">
                        {localRecord || completed ? "Challenge Complete" : "Already Attempted"}
                      </span>
                    </div>
                    {(localRecord || completed) ? (
                      <div className="flex items-center justify-center gap-2">
                        <Trophy className="h-5 w-5 text-chart-2" />
                        <span className="text-lg font-medium">
                          Score: {completed ? finalScore : localRecord?.score ?? 0}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        You already started today's challenge. Each challenge can only be played once.
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Come back tomorrow for a new challenge!
                    </p>
                    {countdown && (
                      <p className="text-sm font-medium tabular-nums" data-testid="text-daily-countdown">
                        Next challenge in: <span className="text-primary">{countdown}</span>
                      </p>
                    )}
                    <Link href="/">
                      <Button variant="outline" className="gap-2" data-testid="button-back-home">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Games
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handleStartChallenge}
                    disabled={recordAttemptMutation.isPending}
                    data-testid="button-play-daily"
                  >
                    <Play className="h-5 w-5" />
                    Start Challenge
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
            className="max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: game.color }}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{game.name}</h2>
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    Daily Challenge
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => confirmExit(() => setIsPlaying(false))}
                className="gap-1.5"
                data-testid="button-exit-daily"
              >
                <X className="h-4 w-4" />
                Exit
              </Button>
            </div>

            {renderDailyGame(data.slug, seed) || (
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
    </div>
  );
}
