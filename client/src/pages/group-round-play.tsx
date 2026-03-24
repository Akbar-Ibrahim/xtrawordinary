import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Trophy, CheckCircle, Users, X } from "lucide-react";
import type { GroupRound } from "@shared/schema";

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
import { WordRootsGame } from "@/components/games/word-roots";

const GAME_NAMES: Record<string, string> = {
  "word-ladder": "Word Ladder", "anagram-solver": "Anagram Solver",
  "word-scramble": "Word Scramble", "definition-match": "Definition Match",
  "letter-pool": "Letter Pool", "word-maker": "Word Maker",
  "word-length": "Length Challenge", "letter-position": "Position Master",
  "letter-hunt": "Letter Hunt", "letter-balance": "Letter Balance",
  "letter-frequency": "Letter Frequency", "no-repeats": "No Repeats",
  "word-sweep": "Word Sweep", "word-roots": "Word Roots",
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

function renderGroupGame(slug: string, seed: number): React.ReactNode {
  switch (slug) {
    case "word-length": return <WordLengthGame initialChallenge={(seed % 5) + 1 as any} />;
    case "letter-position": return <LetterPositionGame initialChallenge={((seed % 2) + 1) as 1 | 2} />;
    case "letter-hunt": {
      const options: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      return <LetterHuntGame initialChallenge={options[seed % options.length]} />;
    }
    case "letter-balance": {
      const cat = LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const levels = LETTER_BALANCE_LEVELS[cat];
      const level = levels[(seed >> 4) % levels.length];
      return <LetterBalanceGame initialChallenge={{ category: cat, level }} />;
    }
    case "letter-frequency": {
      const options: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
      return <LetterFrequencyGame initialChallenge={options[seed % options.length]} />;
    }
    case "no-repeats": {
      const options: Array<3 | 4 | 5 | 6 | 7> = [3, 4, 5, 6, 7];
      return <NoRepeatsGame initialChallenge={options[seed % options.length]} />;
    }
    case "word-ladder": return <WordLadderGame initialChallenge />;
    case "anagram-solver": return <AnagramSolverGame />;
    case "word-scramble": return <WordScrambleGame />;
    case "definition-match": return <DefinitionMatchGame />;
    case "letter-pool": {
      const v = seed % 2 === 0 ? "with-pool" : "without-pool";
      return <LetterPoolGame initialChallenge={v as "with-pool" | "without-pool"} />;
    }
    case "word-maker": return <WordMakerGame />;
    case "word-sweep": return <WordSweepGame />;
    case "word-roots": return <WordRootsGame />;
    default: return null;
  }
}

interface RoundResponse {
  round: GroupRound;
  myScore: { id: number; score: number; completedAt: string } | null;
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

  const { data, isLoading, error } = useQuery<RoundResponse>({
    queryKey: ["/api/groups", groupId, "rounds", roundIdNum],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundIdNum}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !isNaN(groupId) && !isNaN(roundIdNum),
  });

  const submitMutation = useMutation({
    mutationFn: async (score: number) =>
      apiRequest("POST", `/api/groups/${groupId}/rounds/${roundIdNum}/score`, { score }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundIdNum] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "leaderboard"] });
    },
    onError: () => toast({ title: "Failed to save score", variant: "destructive" }),
  });

  useEffect(() => {
    if (!isPlaying || !data) return;
    const handleResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.slug !== data.round.gameSlug) return;
      const score = detail.score ?? 0;
      setFinalScore(score);
      setSubmitted(true);
      setIsPlaying(false);
      submitMutation.mutate(score);
    };
    window.addEventListener("wordplay-game-result", handleResult);
    return () => window.removeEventListener("wordplay-game-result", handleResult);
  }, [isPlaying, data]);

  if (isLoading) {
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
  const alreadyPlayed = !!myScore || submitted;
  const gameName = GAME_NAMES[round.gameSlug] || round.gameSlug;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
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

                {(alreadyPlayed) ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="inline-flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-6 w-6" />
                      <span className="font-semibold text-lg">Score Submitted!</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <span className="text-lg font-medium">
                        {submitted ? finalScore : myScore?.score ?? 0} pts
                      </span>
                    </div>
                    <Link href={`/groups/${groupId}`}>
                      <Button variant="outline" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Group
                      </Button>
                    </Link>
                  </div>
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
                    onClick={() => setIsPlaying(true)}
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
              <Button variant="outline" size="sm" onClick={() => setIsPlaying(false)} className="gap-1.5" data-testid="button-exit-round">
                <X className="h-4 w-4" />
                Exit
              </Button>
            </div>
            {renderGroupGame(round.gameSlug, round.seed) || (
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
