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
import type { QuizSession, QuizSessionScore } from "@shared/schema";
import { UserAvatar } from "@/components/user-avatar";

import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { LetterHuntGame } from "@/components/games/letter-hunt";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordRootsGame } from "@/components/games/word-roots";
import { ProgressiveRevealGame } from "@/components/games/progressive-reveal";

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

function renderQuizGame(slug: string, seed: number, params?: Record<string, any>): React.ReactNode {
  const survival = params?.survival === true;
  switch (slug) {
    case "word-length": {
      const wlOptions: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      const variation: 1 | 2 | 3 | 4 | 5 = params?.variation ?? wlOptions[seed % wlOptions.length];
      return <WordLengthGame initialChallenge={variation} groupSeed={seed} locked quizMode initialSurvival={survival} />;
    }
    case "letter-position": {
      const initialLetter = params?.letter as string | undefined;
      const initialPosition = params?.position as number | undefined;
      const mode: 1 | 2 = params?.mode ?? (initialLetter && initialPosition ? 1 : ((seed % 2) + 1) as 1 | 2);
      return <LetterPositionGame initialChallenge={mode} groupSeed={seed} locked quizMode initialLetter={initialLetter} initialPosition={initialPosition} initialSurvival={survival} />;
    }
    case "letter-hunt": {
      const options: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      const position: 1 | 2 | 3 | 4 | 5 = params?.position ?? options[seed % options.length];
      return <LetterHuntGame initialChallenge={position} groupSeed={seed} locked quizMode initialSurvival={survival} />;
    }
    case "letter-balance": {
      const cat = params?.category ?? LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const levels = LETTER_BALANCE_LEVELS[cat] ?? LETTER_BALANCE_LEVELS[LETTER_BALANCE_CATEGORIES[0]];
      const level = params?.level ?? levels[(seed >> 4) % levels.length];
      return <LetterBalanceGame initialChallenge={{ category: cat, level }} groupSeed={seed} locked quizMode />;
    }
    case "letter-frequency": {
      const options: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
      const rank: 1 | 2 | 3 | 4 = params?.rank ?? options[seed % options.length];
      return <LetterFrequencyGame initialChallenge={rank} groupSeed={seed} locked quizMode initialSurvival={survival} />;
    }
    case "definition-match":
      return <DefinitionMatchGame groupSeed={seed} locked quizMode />;
    case "letter-pool": {
      const v: "with-pool" | "without-pool" = params?.variant ?? (seed % 2 === 0 ? "with-pool" : "without-pool");
      return <LetterPoolGame initialChallenge={v} groupSeed={seed} locked quizMode />;
    }
    case "word-roots":
      return <WordRootsGame groupSeed={seed} locked quizMode />;
    case "progressive-reveal":
      return <ProgressiveRevealGame groupSeed={seed} locked quizMode />;
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
                <p className="text-muted-foreground text-sm mt-1 capitalize">{session.gameSlug.replace(/-/g, " ")}</p>
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
                          <UserAvatar name={s.playerName ?? "?"} avatarUrl={s.playerAvatarUrl ?? null} className="h-7 w-7" />
                          <span className="flex-1 text-sm font-medium">{s.playerName ?? "Player"}</span>
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
                onClick={() => setIsPlaying(false)}
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
    </div>
  );
}
