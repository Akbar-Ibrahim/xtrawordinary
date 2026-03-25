import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Loader2, Zap, Clock, ChevronRight, Star } from "lucide-react";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";
import type { LadderRushPuzzle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const GAME_DURATION = 90;
const WORD_LENGTHS = [
  { length: 4, label: "Easy", sublabel: "4-letter words", description: "More neighbors, easier to chain" },
  { length: 5, label: "Medium", sublabel: "5-letter words", description: "Balanced challenge" },
  { length: 6, label: "Hard", sublabel: "6-letter words", description: "Trickier, but higher score" },
];

function isOneLetterDiff(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}

function calcScore(wordsChained: number, wordLength: number): number {
  return wordsChained * wordLength * 5;
}

interface LadderRushPlayProps {
  wordLength: number;
  puzzles: LadderRushPuzzle[];
  onExit: () => void;
  onPlayAgain: () => void;
}

function LadderRushPlay({ wordLength, puzzles, onExit, onPlayAgain }: LadderRushPlayProps) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded } = useGameResult({ slug: `ladder-rush-${wordLength}` });

  const [gameStatus, setGameStatus] = useState<"playing" | "ended">("playing");
  const [chain, setChain] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [validating, setValidating] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [completionMessage, setCompletionMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const chainEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedRef = useRef(false);
  const chainRef = useRef<string[]>([]);

  const pickStartWord = useCallback((): string => {
    const filtered = puzzles.filter(p => p.wordLength === wordLength);
    const pool = filtered.length > 0 ? filtered : puzzles;
    if (pool.length === 0) return "";
    return pool[Math.floor(Math.random() * pool.length)].start;
  }, [puzzles, wordLength]);

  const endGame = useCallback((finalChain: string[]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const wordsChained = finalChain.length - 1;
    const score = calcScore(wordsChained, wordLength);
    setFinalScore(score);
    setGameStatus("ended");
    setCompletionMessage(getCompletionMessage(wordsChained > 3));
    playSound(wordsChained > 3 ? "win" : "wrong");
    if (!recordedRef.current) {
      recordedRef.current = true;
      reportResult(score, wordsChained > 0, wordsChained);
    }
  }, [wordLength, playSound, reportResult]);

  useEffect(() => {
    const startWord = pickStartWord();
    if (!startWord) return;
    resetRecorded();
    recordedRef.current = false;
    const initialChain = [startWord];
    chainRef.current = initialChain;
    setChain(initialChain);
    setCurrentInput("");
    setTimeLeft(GAME_DURATION);
    setErrorMsg("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          endGame(chainRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [endGame]);

  useEffect(() => {
    if (chain.length > 1) {
      chainEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chain]);

  const submitWord = useCallback(async () => {
    if (validating || gameStatus !== "playing") return;
    const word = currentInput.toUpperCase().trim();
    if (!word) return;

    if (word.length !== wordLength) {
      setErrorMsg(`Word must be ${wordLength} letters`);
      setShake(true);
      playSound("wrong");
      setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
      return;
    }

    const lastWord = chainRef.current[chainRef.current.length - 1];
    if (!isOneLetterDiff(lastWord, word)) {
      setErrorMsg("Change exactly one letter (same position)");
      setShake(true);
      playSound("wrong");
      setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
      return;
    }

    if (chainRef.current.includes(word)) {
      setErrorMsg("Word already used in this chain");
      setShake(true);
      playSound("wrong");
      setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
      return;
    }

    setValidating(true);
    try {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      const data = await response.json();

      if (!data.valid) {
        flushSync(() => {
          setErrorMsg("Not a valid word");
          setShake(true);
          setValidating(false);
        });
        playSound("wrong");
        setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
        inputRef.current?.focus();
        return;
      }

      const newChain = [...chainRef.current, word];
      chainRef.current = newChain;
      flushSync(() => {
        setValidating(false);
        setChain(newChain);
        setCurrentInput("");
      });
      playSound("correct");
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      flushSync(() => {
        setErrorMsg("Validation failed, try again");
        setValidating(false);
      });
      setTimeout(() => setErrorMsg(""), 2000);
    }
  }, [currentInput, wordLength, validating, gameStatus, playSound]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); submitWord(); }
  }, [submitWord]);

  const wordsChained = chain.length - 1;
  const liveScore = calcScore(wordsChained, wordLength);
  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft > 30 ? "bg-accent" : timeLeft > 10 ? "bg-chart-3" : "bg-destructive";

  if (gameStatus === "ended") {
    const endedWordsChained = chain.length - 1;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <Card className="border-[hsl(38,92%,50%)]">
          <CardContent className="p-6 text-center space-y-4">
            <Trophy className="h-14 w-14 mx-auto text-[hsl(38,92%,50%)]" />
            <div>
              <h3 className="text-2xl font-bold">Time's Up!</h3>
              <p className="text-muted-foreground mt-1">{completionMessage}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold" data-testid="text-words-chained">{endedWordsChained}</div>
                <div className="text-xs text-muted-foreground">words chained</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold text-[hsl(38,92%,50%)]" data-testid="text-score">{finalScore}</div>
                <div className="text-xs text-muted-foreground">total score</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold">{wordLength}L</div>
                <div className="text-xs text-muted-foreground">word length</div>
              </div>
            </div>

            {chain.length > 0 && (
              <div className="text-left space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your chain</p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {chain.map((word, i) => (
                    <Badge
                      key={i}
                      variant={i === 0 ? "default" : "secondary"}
                      className="font-mono"
                      data-testid={`chain-word-${i}`}
                    >
                      {word}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={onExit}
                data-testid="button-change-mode"
              >
                Change Mode
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={onPlayAgain}
                data-testid="button-play-again"
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="badge-length">
            {wordLength}-letter
          </Badge>
          <Badge variant="secondary" data-testid="badge-chain-length">
            Chain: {wordsChained}
          </Badge>
          <Badge className="bg-[hsl(38,92%,50%)] text-white" data-testid="badge-live-score">
            <Star className="h-3 w-3 mr-1" />
            {liveScore} pts
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" data-testid="timer-display">
            <Clock className={`h-4 w-4 ${timeLeft <= 10 ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
            <span className={`font-mono font-bold tabular-nums ${timeLeft <= 10 ? "text-destructive" : timeLeft <= 30 ? "text-chart-3" : ""}`}>
              {timeLeft}s
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              onExit();
            }}
            data-testid="button-quit"
          >
            Quit
          </Button>
        </div>
      </div>

      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-colors ${timerColor}`}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.5 }}
          data-testid="timer-bar"
        />
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="h-[260px] overflow-y-auto space-y-2 flex flex-col">
            {chain.map((word, i) => {
              const isStart = i === 0;
              const isLatest = i === chain.length - 1;
              const prevWord = i > 0 ? chain[i - 1] : null;
              return (
                <motion.div
                  key={`${word}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2"
                  ref={isLatest ? chainEndRef : undefined}
                >
                  <div className="flex gap-1" data-testid={`chain-rung-${i}`}>
                    {word.split("").map((letter, li) => {
                      const changed = prevWord && prevWord[li] !== letter;
                      return (
                        <div
                          key={li}
                          className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-base sm:text-lg font-bold rounded-md border-2 transition-colors ${
                            isStart
                              ? "bg-primary text-primary-foreground border-primary"
                              : changed
                              ? "bg-[hsl(38,92%,50%)] text-white border-[hsl(38,92%,50%)] shadow-sm"
                              : "border-border bg-card"
                          }`}
                          data-testid={`letter-${i}-${li}`}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>
                  {isStart && (
                    <Badge variant="secondary" className="text-xs shrink-0" data-testid="badge-start">
                      START
                    </Badge>
                  )}
                  {isLatest && !isStart && (
                    <Badge className="text-xs bg-[hsl(38,92%,50%)]/20 text-[hsl(38,92%,35%)] border border-[hsl(38,92%,50%)]/30 shrink-0" data-testid="badge-latest">
                      +{wordLength * 5} pts
                    </Badge>
                  )}
                </motion.div>
              );
            })}
          </div>

          <div className={`flex gap-2 justify-center ${shake ? "animate-shake" : ""}`}>
            <Input
              ref={inputRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value.toUpperCase().slice(0, wordLength))}
              onKeyDown={handleKeyDown}
              placeholder={`${wordLength}-letter word…`}
              maxLength={wordLength}
              className="font-mono text-lg tracking-wider uppercase max-w-xs"
              disabled={validating}
              autoFocus
              data-testid="input-word"
            />
            <Button
              onClick={submitWord}
              disabled={validating || currentInput.length !== wordLength}
              data-testid="button-submit"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="text-sm text-destructive text-center font-medium" data-testid="text-error">
              {errorMsg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface LadderRushGameProps {
  groupSeed?: number;
}

export function LadderRushGame({ groupSeed }: LadderRushGameProps) {
  const [selectedLength, setSelectedLength] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const { data: puzzles = [], isLoading } = useQuery<LadderRushPuzzle[]>({
    queryKey: ["/api/games/ladder-rush/puzzles", selectedLength],
    queryFn: async () => {
      if (!selectedLength) return [];
      const r = await fetch(`/api/games/ladder-rush/puzzles?wordLength=${selectedLength}`, {
        credentials: "include",
      });
      return r.json();
    },
    enabled: selectedLength !== null,
  });

  if (playing && selectedLength) {
    return (
      <LadderRushPlay
        key={playKey}
        wordLength={selectedLength}
        puzzles={puzzles}
        onExit={() => {
          setPlaying(false);
          setSelectedLength(null);
        }}
        onPlayAgain={() => setPlayKey(k => k + 1)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-7 w-7 text-[hsl(38,92%,50%)]" />
          <h2 className="text-2xl font-bold">Ladder Rush</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Chain words by changing one letter at a time. You have 90 seconds!
        </p>
        <p className="text-xs text-muted-foreground">
          Score = words chained × word length × 5
        </p>
      </div>

      <div className="grid gap-3">
        {WORD_LENGTHS.map(({ length, label, sublabel, description }) => (
          <motion.button
            key={length}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left"
            onClick={() => setSelectedLength(length)}
            data-testid={`button-mode-${length}`}
          >
            <Card className={`cursor-pointer transition-colors hover:border-[hsl(38,92%,50%)] ${selectedLength === length ? "border-[hsl(38,92%,50%)] bg-[hsl(38,92%,50%)]/5" : ""}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {label}
                    <Badge variant="outline" className="text-xs">{sublabel}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.button>
        ))}
      </div>

      {selectedLength && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => {
              setPlayKey(k => k + 1);
              setPlaying(true);
            }}
            disabled={isLoading || puzzles.length === 0}
            data-testid="button-start"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
            Start Rush!
          </Button>
        </motion.div>
      )}
    </div>
  );
}
