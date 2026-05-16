import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  GraduationCap,
  Play,
  Trophy,
  CheckCircle,
  Lock,
  Loader2,
  Users,
} from "lucide-react";
import type { QuizSession, QuizSessionScore, DefinitionWord } from "@shared/schema";
import { UserAvatar } from "@/components/user-avatar";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { getVariantSummary } from "@/lib/variant-summary";

import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { LetterHuntGame } from "@/components/games/letter-hunt";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordRootsGame } from "@/components/games/word-roots";
import { ProgressiveRevealGame } from "@/components/games/progressive-reveal";
import { LetterDodgeGame } from "@/components/games/letter-dodge";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { WordScrambleGame } from "@/components/games/word-scramble";

const LETTER_BALANCE_CATEGORIES = [
  "consonant_count", "vowel_count", "start_end_vowel", "start_end_consonant",
  "start_vowel_end_consonant", "start_consonant_end_vowel", "locked_balance",
] as const;
const LETTER_BALANCE_LEVELS: Record<string, number[]> = {
  consonant_count: [2, 3, 4, 5, 6, 7], vowel_count: [2, 3, 4, 5, 6, 7],
  start_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12], start_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_vowel_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12], start_consonant_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  locked_balance: [4, 5, 6, 7, 8, 9, 10],
};

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function renderQuizGame(slug: string, seed: number, params?: Record<string, any>): React.ReactNode {
  const survival = params?.survival === true;
  switch (slug) {
    case "word-length": {
      const rawLength = toNum(params?.length);
      if (rawLength) {
        const cc = { length: rawLength, startsWith: params?.startsWith as string | undefined, endsWith: params?.endsWith as string | undefined, contains: params?.contains as string | undefined };
        const wc = !survival ? toNum(params?.wordCount) : undefined;
        const tl = !survival ? toNum(params?.timeLimit) : undefined;
        return <WordLengthGame customConstraint={cc} groupSeed={seed} locked quizMode initialSurvival={survival} initialWordCount={wc ?? undefined} initialTimeLimit={tl ?? undefined} />;
      }
      const wlOptions: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      const rawVar = toNum(params?.variation);
      const variation: 1 | 2 | 3 | 4 | 5 = (rawVar && rawVar >= 1 && rawVar <= 5 ? Math.round(rawVar) as 1|2|3|4|5 : null) ?? wlOptions[seed % wlOptions.length];
      const wlWc = !survival ? toNum(params?.wordCount) : undefined;
      const wlTl = !survival ? toNum(params?.timeLimit) : undefined;
      return <WordLengthGame initialChallenge={variation} groupSeed={seed} locked quizMode initialSurvival={survival} initialWordCount={wlWc} initialTimeLimit={wlTl} />;
    }
    case "letter-position": {
      const initialLetter = params?.letter as string | undefined;
      const initialPosition = toNum(params?.position);
      const mode: 1 | 2 = params?.mode !== undefined ? (toNum(params.mode) as 1 | 2 ?? 1) : (initialLetter && initialPosition ? 1 : ((seed % 2) + 1) as 1 | 2);
      const lpWc = !survival ? toNum(params?.wordCount) : undefined;
      const lpTl = !survival ? toNum(params?.timeLimit) : undefined;
      return <LetterPositionGame initialChallenge={mode} groupSeed={seed} locked quizMode initialLetter={initialLetter} initialPosition={initialPosition} initialSurvival={survival} initialWordCount={lpWc} initialTimeLimit={lpTl} />;
    }
    case "letter-hunt": {
      const options: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      const rawChallenge = params?.challenge ?? params?.position;
      const challengeNum = toNum(rawChallenge);
      const challenge: 1 | 2 | 3 | 4 | 5 = (challengeNum && challengeNum >= 1 && challengeNum <= 5 ? Math.round(challengeNum) as 1|2|3|4|5 : null) ?? options[seed % options.length];
      const initialLetters = Array.isArray(params?.letters) ? params.letters as string[] : undefined;
      const lhWc = !survival ? toNum(params?.wordCount) : undefined;
      const lhTl = !survival ? toNum(params?.timeLimit) : undefined;
      return <LetterHuntGame initialChallenge={challenge} initialLetters={initialLetters} initialLetter={initialLetters ? undefined : params?.letter} groupSeed={seed} locked quizMode initialSurvival={survival} initialWordCount={lhWc} initialTimeLimit={lhTl} />;
    }
    case "letter-balance": {
      const lbWc = !survival ? toNum(params?.wordCount) : undefined;
      const lbTl = !survival ? toNum(params?.timeLimit) : undefined;
      if (params?.vowels !== undefined || params?.consonants !== undefined) {
        const cc = { vowels: toNum(params?.vowels), consonants: toNum(params?.consonants), length: toNum(params?.length) };
        return <LetterBalanceGame customConstraint={cc} groupSeed={seed} locked quizMode initialSurvival={survival} initialWordCount={lbWc} initialTimeLimit={lbTl} />;
      }
      // Normalize legacy category slugs from old quiz sessions
      const rawCat = params?.category ?? LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const cat: typeof LETTER_BALANCE_CATEGORIES[number] = (LETTER_BALANCE_CATEGORIES as readonly string[]).includes(rawCat)
        ? (rawCat as typeof LETTER_BALANCE_CATEGORIES[number])
        : LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const levels = LETTER_BALANCE_LEVELS[cat] ?? LETTER_BALANCE_LEVELS[LETTER_BALANCE_CATEGORIES[0]];
      const level = params?.level !== undefined ? (toNum(params.level) ?? levels[(seed >> 4) % levels.length]) : levels[(seed >> 4) % levels.length];
      const consonantCount = cat === "locked_balance" && params?.consonantCount !== undefined ? toNum(params.consonantCount) : undefined;
      return <LetterBalanceGame initialChallenge={{ category: cat, level, consonantCount }} groupSeed={seed} locked quizMode initialSurvival={survival} initialWordCount={lbWc} initialTimeLimit={lbTl} />;
    }
    case "letter-frequency": {
      const options: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
      const rawChallenge = params?.challenge ?? params?.rank;
      const lfWc = !survival ? toNum(params?.wordCount) : undefined;
      const lfTl = !survival ? toNum(params?.timeLimit) : undefined;
      if (rawChallenge === "multi") {
        const lfMultiLetters = Array.isArray(params?.letters) ? params.letters as string[] : undefined;
        const lfMultiCounts = Array.isArray(params?.letterCounts) ? params.letterCounts as number[] : undefined;
        return <LetterFrequencyGame initialChallenge="multi" initialLetters={lfMultiLetters} initialLetterCounts={lfMultiCounts} groupSeed={seed} locked quizMode initialSurvival={survival} initialWordCount={lfWc} initialTimeLimit={lfTl} />;
      }
      const challengeNum = toNum(rawChallenge);
      const rankNum = challengeNum && challengeNum >= 1 && challengeNum <= 4 ? Math.round(challengeNum) : null;
      const rank = (rankNum ?? options[seed % options.length]) as 1 | 2 | 3 | 4;
      return <LetterFrequencyGame initialChallenge={rank} initialLetter={params?.letter} groupSeed={seed} locked quizMode initialSurvival={survival} initialWordCount={lfWc} initialTimeLimit={lfTl} />;
    }
    case "definition-match": {
      const customWords = Array.isArray(params?.words) && params.words.length > 0
        ? (params.words as DefinitionWord[])
        : undefined;
      return <DefinitionMatchGame groupSeed={seed} locked quizMode customWords={customWords} />;
    }
    case "letter-pool": {
      const v: "with-pool" | "without-pool" = params?.variant ?? (seed % 2 === 0 ? "with-pool" : "without-pool");
      const lpCustomWords = Array.isArray(params?.words) ? params!.words as import("@shared/schema").LetterPoolWord[] : undefined;
      return <LetterPoolGame initialChallenge={v} groupSeed={seed} locked quizMode customWords={lpCustomWords} />;
    }
    case "letter-dodge": {
      type DodgeDifficulty = 1 | 2 | 3 | 4 | 5 | "advanced";
      const isDodgeDifficulty = (v: unknown): v is DodgeDifficulty =>
        v === 1 || v === 2 || v === 3 || v === 4 || v === 5 || v === "advanced";
      const dodgeDiff = params?.difficulty;
      const initialDifficulty: DodgeDifficulty = isDodgeDifficulty(dodgeDiff) ? dodgeDiff : "advanced";
      const initialForbiddenLetters = Array.isArray(params?.letters) ? params.letters as string[] : undefined;
      const dodgeWc = !survival ? toNum(params?.wordCount) : undefined;
      const dodgeTl = !survival ? toNum(params?.timeLimit) : undefined;
      return <LetterDodgeGame groupSeed={seed} locked quizMode initialDifficulty={initialDifficulty} initialForbiddenLetters={initialForbiddenLetters} initialSurvival={survival} initialWordCount={dodgeWc} initialTimeLimit={dodgeTl} />;
    }
    case "word-roots": {
      const wrGroupSeed = params?.wrSeed !== undefined ? Number(params.wrSeed) : seed;
      return <WordRootsGame groupSeed={wrGroupSeed} locked quizMode />;
    }
    case "progressive-reveal": {
      const prCustomWords = Array.isArray(params?.words) ? params!.words as import("@shared/schema").ProgressiveRevealWord[] : undefined;
      return <ProgressiveRevealGame groupSeed={seed} locked quizMode customWords={prCustomWords} />;
    }
    case "anagram-solver": {
      const asCustomWords = Array.isArray(params?.words) ? params!.words as import("@shared/schema").AnagramWordSet[] : undefined;
      return <AnagramSolverGame groupSeed={seed} locked quizMode customWords={asCustomWords} />;
    }
    case "word-scramble": {
      const wsCustomWords = Array.isArray(params?.words) ? params!.words as import("@shared/schema").ScrambleWord[] : undefined;
      return <WordScrambleGame groupSeed={seed} locked quizMode customWords={wsCustomWords} />;
    }
    default:
      return null;
  }
}

interface SessionResponse extends QuizSession {
  isClosed: boolean;
}

interface ScoresResponse {
  scores: QuizSessionScore[];
  myScore: QuizSessionScore | null;
}

export default function QuizPlay() {
  const { code } = useParams<{ code: string }>();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [myFinalScore, setMyFinalScore] = useState<number | null>(null);
  const hasSubmitted = useRef(false);
  const { ConfirmDialog, confirmExit } = useNavigationGuard(isPlaying && !submitted);

  const { data: session, isLoading: sessionLoading } = useQuery<SessionResponse>({
    queryKey: ["/api/quiz-sessions", code],
    queryFn: async () => {
      const res = await fetch(`/api/quiz-sessions/${code}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!code,
  });

  const { data: scoresData, isLoading: scoresLoading } = useQuery<ScoresResponse>({
    queryKey: ["/api/quiz-sessions", code, "scores"],
    queryFn: async () => {
      const res = await fetch(`/api/quiz-sessions/${code}/scores`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!code && isAuthenticated,
    refetchInterval: submitted ? 5000 : false,
  });

  const submitScoreMutation = useMutation({
    mutationFn: (score: number) => apiRequest("POST", `/api/quiz-sessions/${code}/scores`, { score }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setMyFinalScore(data.score);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-sessions", code, "scores"] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("409")) {
        setSubmitted(true);
      } else {
        toast({ title: "Error", description: "Could not submit score.", variant: "destructive" });
      }
    },
  });

  useEffect(() => {
    if (scoresData?.myScore && !submitted) {
      setSubmitted(true);
      setMyFinalScore(scoresData.myScore.score);
    }
  }, [scoresData]);

  useEffect(() => {
    if (!isPlaying || !isAuthenticated) return;
    const handleResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || hasSubmitted.current) return;
      const score = typeof detail.score === "number" ? detail.score : 0;
      if (!session) return;
      const slugMatches = detail.slug === session.gameSlug ||
        detail.slug?.startsWith(session.gameSlug);
      if (!slugMatches) return;
      hasSubmitted.current = true;
      submitScoreMutation.mutate(score);
    };
    window.addEventListener("wordplay-game-result", handleResult);
    return () => window.removeEventListener("wordplay-game-result", handleResult);
  }, [isPlaying, isAuthenticated, session]);

  if (sessionLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Quiz Not Found</h1>
        <p className="text-muted-foreground mb-6">This quiz session doesn't exist or the link is invalid.</p>
        <Link href="/"><Button>Back to Games</Button></Link>
      </div>
    );
  }

  const seed = session.id * 31 + 7;
  const gameNode = renderQuizGame(session.gameSlug, seed, (session.params as Record<string, any>) ?? undefined);
  const scores = scoresData?.scores ?? [];
  const alreadySubmitted = submitted || !!scoresData?.myScore;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Games
        </Button>
      </Link>

      <AnimatePresence mode="wait">
        {!isPlaying ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-xl mx-auto"
          >
            <Card>
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <GraduationCap className="h-8 w-8 text-primary" />
                  <Badge variant="secondary">Quiz Session</Badge>
                </div>
                <CardTitle className="text-2xl" data-testid="text-quiz-title">{session.title}</CardTitle>
                {session.description && (
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-quiz-description">{session.description}</p>
                )}
                <p className="text-muted-foreground text-sm mt-1 capitalize">{session.gameSlug.replace(/-/g, " ")}</p>
                {(() => {
                  const summary = getVariantSummary(session.gameSlug, seed, (session.params as Record<string, any>) ?? undefined);
                  const displaySummary = summary ?? "Standard rules";
                  return (
                    <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-muted/60 border border-border/50" data-testid="text-quiz-variant-summary">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Game settings:</span>
                      <span className="text-xs font-medium text-foreground">{displaySummary}</span>
                    </div>
                  );
                })()}
                {session.creatorName && (
                  <div className="flex items-center justify-center gap-1.5 mt-2" data-testid="text-quiz-creator">
                    <span className="text-xs text-muted-foreground">Created by</span>
                    <Link href={`/profile/${session.creatorId}`} className="flex items-center gap-1 hover:underline">
                      <UserAvatar name={session.creatorName} avatarUrl={session.creatorAvatarUrl ?? null} className="h-5 w-5" />
                      <span className="text-xs font-medium">{session.creatorName}</span>
                    </Link>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {session.isClosed && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center text-sm text-destructive">
                    This quiz session is closed — no new submissions are being accepted.
                  </div>
                )}

                {alreadySubmitted && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-center">
                    <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
                    <p className="font-semibold text-green-700 dark:text-green-300">
                      Score submitted{myFinalScore !== null ? `: ${myFinalScore} pts` : ""}
                    </p>
                  </div>
                )}

                {!isAuthenticated && (
                  <div className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground flex items-center gap-2 justify-center">
                    <Lock className="h-4 w-4" />
                    Sign in to submit your score to the leaderboard.
                  </div>
                )}

                {!alreadySubmitted && !session.isClosed && (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => setIsPlaying(true)}
                    data-testid="button-play-quiz"
                  >
                    <Play className="h-5 w-5" />
                    Play Now
                  </Button>
                )}

                {alreadySubmitted && (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => setIsPlaying(true)}
                    variant="outline"
                    data-testid="button-play-again-quiz"
                  >
                    <Play className="h-5 w-5" />
                    Play Again (won't overwrite score)
                  </Button>
                )}

                {scores.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Participants ({scores.length})</span>
                    </div>
                    <div className="space-y-2">
                      {scores.map((s, i) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40"
                          data-testid={`row-quiz-score-${s.id}`}
                        >
                          <span className="font-bold text-sm w-6 text-center text-muted-foreground">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                          </span>
                          <Link href={`/profile/${s.userId}`}>
                            <UserAvatar name={s.playerName ?? "?"} avatarUrl={s.playerAvatarUrl ?? null} className="h-7 w-7 cursor-pointer" />
                          </Link>
                          <Link href={`/profile/${s.userId}`} className="flex-1">
                            <span className="text-sm font-medium hover:underline cursor-pointer">{s.playerName ?? "Player"}</span>
                          </Link>
                          <span className="font-bold text-primary" data-testid={`text-score-${s.id}`}>{s.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isAuthenticated && session.creatorId === user?.id && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 mt-2"
                    onClick={() => navigate(`/quiz/${code}/results`)}
                    data-testid="button-quiz-results-dashboard"
                  >
                    <Trophy className="h-4 w-4" />
                    Results Dashboard
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
          >
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                className="gap-2"
                onClick={() => {
                  if (!submitted) {
                    confirmExit(() => setIsPlaying(false));
                  } else {
                    setIsPlaying(false);
                  }
                }}
                data-testid="button-back-to-quiz"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Quiz
              </Button>
              <div className="text-center">
                <p className="font-semibold">{session.title}</p>
                <p className="text-xs text-muted-foreground capitalize">{session.gameSlug.replace(/-/g, " ")}</p>
              </div>
              {submitScoreMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </div>
              )}
              {submitScoreMutation.isSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Score saved!
                </div>
              )}
              {!isAuthenticated && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  Not tracked
                </div>
              )}
            </div>

            {gameNode ?? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  This game is not available for quiz sessions.
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {ConfirmDialog}
    </div>
  );
}
