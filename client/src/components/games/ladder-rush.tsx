import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Loader2, Zap, Clock, ChevronRight } from "lucide-react";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";
import type { LadderRushPuzzle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const GAME_DURATION = 90;
const WORD_LENGTHS = [
  { length: 4, label: "Easy", sublabel: "4-letter words" },
  { length: 5, label: "Medium", sublabel: "5-letter words" },
  { length: 6, label: "Hard", sublabel: "6-letter words" },
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

interface LadderRushGameProps {
  groupSeed?: number;
}

export function LadderRushGame({ groupSeed }: LadderRushGameProps) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded } = useGameResult({ slug: "ladder-rush" });

  const [selectedLength, setSelectedLength] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<"idle" | "playing" | "ended">("idle");
  const [chain, setChain] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [validating, setValidating] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const chainEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedRef = useRef(false);

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

  const pickStartWord = useCallback((wordLength: number): string => {
    if (puzzles.length === 0) return "";
    const filtered = puzzles.filter(p => p.wordLength === wordLength);
    if (filtered.length === 0) return puzzles[0].start;
    return filtered[Math.floor(Math.random() * filtered.length)].start;
  }, [puzzles]);

  const startGame = useCallback((wordLength: number) => {
    const startWord = pickStartWord(wordLength);
    if (!startWord) return;
    resetRecorded();
    recordedRef.current = false;
    setChain([startWord]);
    setCurrentInput("");
    setTimeLeft(GAME_DURATION);
    setGameStatus("playing");
    setErrorMsg("");
    setScore(0);
    setCompletionMessage("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [pickStartWord, resetRecorded]);

  const endGame = useCallback((finalChain: string[], wordLength: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const wordsChained = finalChain.length - 1;
    const finalScore = wordsChained * wordLength * 5;
    setScore(finalScore);
    setGameStatus("ended");
    setCompletionMessage(getCompletionMessage(wordsChained > 3));
    playSound(wordsChained > 3 ? "win" : "wrong");
    if (!recordedRef.current) {
      recordedRef.current = true;
      reportResult(finalScore, wordsChained > 0, wordsChained);
    }
  }, [playSound, reportResult]);

  useEffect(() => {
    if (gameStatus !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setChain(c => {
            endGame(c, selectedLength!);
            return c;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStatus, endGame, selectedLength]);

  useEffect(() => {
    if (chain.length > 1) {
      chainEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chain]);

  const submitWord = useCallback(async () => {
    if (!selectedLength || validating || gameStatus !== "playing") return;
    const word = currentInput.toUpperCase().trim();
    if (!word) return;

    if (word.length !== selectedLength) {
      setErrorMsg(`Word must be ${selectedLength} letters`);
      setShake(true);
      playSound("wrong");
      setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
      return;
    }

    const lastWord = chain[chain.length - 1];
    if (!isOneLetterDiff(lastWord, word)) {
      setErrorMsg("Change exactly one letter (same position)");
      setShake(true);
      playSound("wrong");
      setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
      return;
    }

    if (chain.includes(word)) {
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

      flushSync(() => {
        setValidating(false);
        setChain(prev => [...prev, word]);
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
  }, [selectedLength, currentInput, chain, validating, gameStatus, playSound]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWord();
    }
  }, [submitWord]);

  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft > 30 ? "bg-accent" : timeLeft > 10 ? "bg-chart-3" : "bg-destructive";

  if (gameStatus === "idle") {
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
        </div>

        <div className="grid gap-3">
          {WORD_LENGTHS.map(({ length, label, sublabel }) => (
            <motion.button
              key={length}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full text-left"
              onClick={() => {
                setSelectedLength(length);
              }}
              data-testid={`button-mode-${length}`}
            >
              <Card className={`cursor-pointer transition-colors hover:border-[hsl(38,92%,50%)] ${selectedLength === length ? "border-[hsl(38,92%,50%)] bg-[hsl(38,92%,50%)]/5" : ""}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {label}
                      <Badge variant="outline" className="text-xs">{sublabel}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {length === 4 ? "More neighbors, easier to chain" : length === 5 ? "Balanced challenge" : "Harder to chain, higher score multiplier"}
                    </div>
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
              onClick={() => startGame(selectedLength)}
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

  if (gameStatus === "ended") {
    const wordsChained = chain.length - 1;
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
                <div className="text-2xl font-bold" data-testid="text-words-chained">{wordsChained}</div>
                <div className="text-xs text-muted-foreground">words chained</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold" data-testid="text-score">{score}</div>
                <div className="text-xs text-muted-foreground">total score</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold">{selectedLength}L</div>
                <div className="text-xs text-muted-foreground">word length</div>
              </div>
            </div>

            {chain.length > 0 && (
              <div className="text-left space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your chain</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
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
                onClick={() => {
                  setGameStatus("idle");
                  setSelectedLength(null);
                }}
                data-testid="button-change-mode"
              >
                Change Mode
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => selectedLength && startGame(selectedLength)}
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

  const lastWord = chain[chain.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="badge-length">
            {selectedLength}-letter
          </Badge>
          <Badge variant="secondary" data-testid="badge-chain-length">
            Chain: {chain.length - 1}
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
              setGameStatus("idle");
              setSelectedLength(null);
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
          <div className="h-[280px] overflow-y-auto space-y-2 flex flex-col">
            {chain.map((word, i) => {
              const isStart = i === 0;
              const isLatest = i === chain.length - 1;
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
                      const prevWord = i > 0 ? chain[i - 1] : null;
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
                    <Badge className="text-xs bg-[hsl(38,92%,50%)] text-white shrink-0" data-testid="badge-latest">
                      +{selectedLength! * 5} pts
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
              onChange={(e) => setCurrentInput(e.target.value.toUpperCase().slice(0, selectedLength!))}
              onKeyDown={handleKeyDown}
              placeholder={`${selectedLength}-letter word…`}
              maxLength={selectedLength!}
              className="font-mono text-lg tracking-wider uppercase max-w-xs"
              disabled={validating}
              autoFocus
              data-testid="input-word"
            />
            <Button
              onClick={submitWord}
              disabled={validating || currentInput.length !== selectedLength}
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
