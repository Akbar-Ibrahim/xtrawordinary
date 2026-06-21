import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Lightbulb, Trophy, X, XCircle, Loader2, ArrowUp, Minus, LogIn } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import type { WordLadderPuzzle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { makeSeededRng } from "@/lib/seeded-rng";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { useLocation } from "wouter";

interface WordLadderGameProps {
  initialChallenge?: boolean;
  groupSeed?: number;
  locked?: boolean;
  isUntimed?: boolean;
}

function isOneLetterDiff(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const freqA: Record<string, number> = {};
  const freqB: Record<string, number> = {};
  for (const c of a) freqA[c] = (freqA[c] || 0) + 1;
  for (const c of b) freqB[c] = (freqB[c] || 0) + 1;
  let added = 0, removed = 0;
  const allLetters = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  for (const c of allLetters) {
    const diff = (freqB[c] || 0) - (freqA[c] || 0);
    if (diff > 0) added += diff;
    else removed -= diff;
  }
  return added === 1 && removed === 1;
}

export function WordLadderGame({ initialChallenge, groupSeed, locked, isUntimed }: WordLadderGameProps) {
  const { playSound } = useSound();
  const [, navigate] = useLocation();
  const { reportResult, resetRecorded } = useGameResult({ slug: "word-ladder", isUntimed });
  const personalBest = usePersonalBest("word-ladder");
  const seeded = groupSeed !== undefined;
  const seedRngRef = useRef<(() => number) | undefined>(
    seeded ? makeSeededRng(groupSeed!) : undefined
  );
  const { data: allPuzzles = [], isLoading, error, refetch } = useQuery<WordLadderPuzzle[]>({
    queryKey: seeded ? ["/api/games/word-ladder/puzzles", groupSeed] : ["/api/games/word-ladder/puzzles"],
    ...(seeded ? { queryFn: async () => { const r = await fetch(`/api/games/word-ladder/puzzles?seed=${groupSeed}`, { credentials: "include" }); return r.json(); } } : {}),
    refetchOnMount: seeded ? false : "always",
  });

  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [puzzle, setPuzzle] = useState<WordLadderPuzzle | null>(null);
  const [ladder, setLadder] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [validating, setValidating] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const ladderScrollRef = useRef<HTMLDivElement>(null);
  const newestRungRef = useRef<HTMLDivElement>(null);

  const selectPuzzle = useCallback((puzzles: WordLadderPuzzle[]) => {
    if (puzzles.length === 0) return null;
    const rng = seedRngRef.current ?? Math.random;
    return puzzles[Math.floor(rng() * puzzles.length)];
  }, []);

  const lastPuzzleRef = useRef<WordLadderPuzzle | null>(null);

  const initGame = useCallback((overridePuzzle?: WordLadderPuzzle) => {
    resetRecorded();
    const selected = overridePuzzle ?? selectPuzzle(allPuzzles);
    if (!selected) return;
    lastPuzzleRef.current = selected;
    setPuzzle(selected);
    setLadder([selected.start]);
    setCurrentInput("");
    setGameStatus("playing");
    setErrorMsg("");
    setHintsUsed(0);
    setShowPaths(false);
    setScore(0);
    setCompletionMessage("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [allPuzzles, selectPuzzle, resetRecorded]);

  useEffect(() => {
    if (allPuzzles.length > 0 && !puzzle) {
      initGame();
    }
  }, [allPuzzles, puzzle, initGame]);

  useEffect(() => {
    if (gameStatus === "lost") {
      reportResult(score, false);
    }
  }, [gameStatus, score, reportResult]);

  const lastWord = ladder[ladder.length - 1];
  const isOneStepAway = gameStatus === "playing" && ladder.length > 1 && lastWord && puzzle ? isOneLetterDiff(lastWord, puzzle.target) : false;

  const calculateScore = useCallback((stepsUsed: number, par: number, hints: number) => {
    const baseScore = 200;
    const parDiff = stepsUsed - par;
    let parBonus = 0;
    if (parDiff <= 0) {
      parBonus = Math.abs(parDiff) * 50 + 100;
    } else if (parDiff <= 2) {
      parBonus = 50 - parDiff * 15;
    }
    const hintPenalty = hints * 30;
    return Math.max(10, baseScore + parBonus - hintPenalty);
  }, []);

  const submitWord = useCallback(async () => {
    if (!puzzle || validating || gameStatus !== "playing") return;
    const word = currentInput.toUpperCase().trim();
    if (!word) return;

    if (word.length !== puzzle.start.length) {
      setErrorMsg(`Word must be ${puzzle.start.length} letters`);
      setShake(true);
      playSound("wrong");
      setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
      return;
    }

    if (!isOneLetterDiff(lastWord, word)) {
      setErrorMsg("Change exactly one letter");
      setShake(true);
      playSound("wrong");
      setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
      return;
    }

    if (ladder.includes(word)) {
      setErrorMsg("Word already used in ladder");
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

      const newLadder = [...ladder, word];
      flushSync(() => {
        setValidating(false);
        setLadder(newLadder);
        setCurrentInput("");
      });
      playSound("correct");
      setTimeout(() => {
        inputRef.current?.focus();
        newestRungRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);

      if (word === puzzle.target) {
        const steps = newLadder.length - 2;
        const finalScore = calculateScore(steps, puzzle.par, hintsUsed);
        setScore(finalScore);
        setGameStatus("won");
        setCompletionMessage(getCompletionMessage(true));
        playSound("win");
        reportResult(finalScore, true);
      }
    } catch {
      flushSync(() => {
        setErrorMsg("Validation failed, try again");
        setValidating(false);
      });
      setTimeout(() => setErrorMsg(""), 2000);
    }
  }, [puzzle, currentInput, lastWord, ladder, validating, gameStatus, playSound, calculateScore, hintsUsed, reportResult]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWord();
    }
  }, [submitWord]);

  const useHint = useCallback(() => {
    if (!puzzle || gameStatus !== "playing") return;
    const shortestPath = puzzle.optimalPaths.reduce((a, b) => a.length <= b.length ? a : b);
    const currentStep = ladder.length;
    if (currentStep < shortestPath.length) {
      const hintWord = shortestPath[currentStep];
      setCurrentInput(hintWord);
      setHintsUsed(prev => prev + 1);
      playSound("click");
    }
  }, [puzzle, ladder, gameStatus, playSound]);

  const getGradientColor = useCallback((index: number, total: number) => {
    const startHue = 262;
    const endHue = 142;
    const ratio = total <= 1 ? 0 : index / (total - 1);
    const hue = startHue + (endHue - startHue) * ratio;
    return `hsl(${hue}, 70%, 55%)`;
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-destructive">Failed to load game data</p>
          <Button onClick={() => refetch()} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!puzzle) return null;

  const totalRungs = puzzle.par + 2;
  const steps = ladder.length - 2;
  const parDiff = steps - puzzle.par;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="badge-par">
            Par: {puzzle.par} steps
          </Badge>
          <Badge variant="outline" data-testid="badge-steps">
            Steps: {Math.max(0, ladder.length - 1)}
          </Badge>
          {hintsUsed > 0 && (
            <Badge variant="secondary" data-testid="badge-hints">
              Hints: {hintsUsed}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {gameStatus === "playing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={useHint}
              className="gap-1.5"
              data-testid="button-hint"
            >
              <Lightbulb className="h-4 w-4" />
              Hint
            </Button>
          )}
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => initGame()}
              className="gap-1.5"
              data-testid="button-restart"
            >
              <RotateCcw className="h-4 w-4" />
              New Puzzle
            </Button>
          )}
          {!locked && gameStatus === "playing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCompletionMessage(getCompletionMessage(false)); setGameStatus("lost"); }}
              className="gap-1.5"
              data-testid="button-end-game"
            >
              End Game
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="relative">
            <div ref={ladderScrollRef} className="h-[400px] overflow-y-auto space-y-2 flex flex-col items-center">
              {(() => {
                const allRungs: React.ReactNode[] = [];

                if (gameStatus === "playing") {
                  allRungs.push(
                    <motion.div
                      key="target"
                      className={`relative ${isOneStepAway ? "" : "opacity-60"}`}
                      animate={isOneStepAway ? {
                        scale: [1, 1.03, 1],
                      } : {}}
                      transition={isOneStepAway ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      } : {}}
                    >
                      <div className="flex gap-1" data-testid="rung-target">
                        {puzzle.target.split("").map((letter, letterIdx) => (
                          <div
                            key={letterIdx}
                            className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 ${
                              isOneStepAway
                                ? "border-accent bg-accent/20 shadow-[0_0_12px_rgba(var(--accent),0.4)]"
                                : "border-accent bg-accent/10"
                            }`}
                            data-testid={`target-letter-${letterIdx}`}
                          >
                            {letter}
                          </div>
                        ))}
                      </div>
                      <Badge variant="outline" className="absolute -right-20 top-1/2 -translate-y-1/2 text-xs border-accent text-accent whitespace-nowrap" data-testid="badge-target">
                        {isOneStepAway ? "Almost there!" : "TARGET"}
                      </Badge>
                    </motion.div>
                  );

                  allRungs.push(
                    <div key="target-arrow">
                      <ArrowUp className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                    </div>
                  );

                  const remainingSteps = puzzle.par - (ladder.length - 1);
                  if (remainingSteps > 0) {
                    for (let i = 0; i < Math.min(remainingSteps, 3); i++) {
                      allRungs.push(
                        <div key={`empty-${i}`}>
                          <Minus className="h-3 w-3 text-muted-foreground/30 mx-auto" />
                        </div>
                      );
                    }
                  }

                  allRungs.push(
                    <div key="arrow-to-input">
                      <ArrowUp className="h-4 w-4 text-muted-foreground mx-auto" />
                    </div>
                  );

                  allRungs.push(
                    <motion.div
                      key="input-rung"
                      ref={newestRungRef}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`flex items-center gap-2 ${shake ? "animate-shake" : ""}`}
                    >
                      <div className="flex gap-1">
                        {puzzle.start.split("").map((_, letterIdx) => {
                          const inputLetter = (currentInput[letterIdx] || "").toUpperCase();
                          return (
                            <div
                              key={letterIdx}
                              className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 border-dashed ${
                                inputLetter ? "border-chart-3 bg-chart-3/10" : "border-muted-foreground/30 bg-card"
                              }`}
                              data-testid={`input-letter-${letterIdx}`}
                            >
                              {inputLetter}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );

                  allRungs.push(
                    <div key="arrow-above-ladder">
                      <ArrowUp className="h-4 w-4 text-muted-foreground mx-auto" />
                    </div>
                  );
                }

                [...ladder].reverse().forEach((word, revIdx) => {
                  const rungIndex = ladder.length - 1 - revIdx;
                  const isStart = rungIndex === 0;
                  const isTarget = word === puzzle.target;

                  allRungs.push(
                    <motion.div
                      key={`word-${rungIndex}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="relative"
                    >
                      <div className="flex gap-1" data-testid={`rung-${rungIndex}`}>
                        {word.split("").map((letter, letterIdx) => (
                          <motion.div
                            key={letterIdx}
                            className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 transition-colors ${
                              isStart
                                ? "bg-primary text-primary-foreground border-primary"
                                : isTarget
                                ? "bg-accent text-accent-foreground border-accent"
                                : "border-border"
                            }`}
                            style={
                              !isStart && !isTarget
                                ? { backgroundColor: getGradientColor(rungIndex, totalRungs) + "20", borderColor: getGradientColor(rungIndex, totalRungs) }
                                : undefined
                            }
                            data-testid={`letter-${rungIndex}-${letterIdx}`}
                          >
                            {letter}
                          </motion.div>
                        ))}
                      </div>
                      {isStart && (
                        <Badge variant="secondary" className="absolute -right-20 top-1/2 -translate-y-1/2 text-xs" data-testid="badge-start">START</Badge>
                      )}
                      {isTarget && (
                        <Badge className="absolute -right-20 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground text-xs" data-testid="badge-target-reached">TARGET</Badge>
                      )}
                    </motion.div>
                  );

                  if (rungIndex > 0) {
                    allRungs.push(
                      <div key={`arrow-${rungIndex}`}>
                        <ArrowUp className="h-4 w-4 text-muted-foreground mx-auto" />
                      </div>
                    );
                  }
                });

                return allRungs;
              })()}
            </div>

            {gameStatus === "playing" && (
              <div className="flex gap-2 mt-4 justify-center">
                <Input
                  ref={inputRef}
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, puzzle.start.length))}
                  onKeyDown={handleKeyDown}
                  placeholder={`Type a ${puzzle.start.length}-letter word...`}
                  maxLength={puzzle.start.length}
                  className="font-mono text-lg tracking-wider uppercase max-w-xs"
                  autoFocus
                  data-testid="input-word"
                />
                <Button
                  onClick={submitWord}
                  disabled={validating || currentInput.length !== puzzle.start.length}
                  data-testid="button-submit"
                >
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </Button>
              </div>
            )}
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

      <AnimatePresence>
        {gameStatus === "won" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="border-accent">
              <CardContent className="p-6 text-center space-y-3">
                <Trophy className="h-12 w-12 mx-auto text-accent" />
                <h3 className="text-xl font-bold">Ladder Complete!</h3>

                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    You climbed from <span className="font-bold">{puzzle.start}</span> to{" "}
                    <span className="font-bold">{puzzle.target}</span> in{" "}
                    <span className="font-bold">{steps}</span> steps
                  </p>
                  <p className="text-lg font-semibold" data-testid="text-score">
                    Score: {score} pts
                  </p>
                  {parDiff <= 0 ? (
                    <Badge className="bg-accent text-accent-foreground" data-testid="badge-par-result">
                      {parDiff === 0 ? "Par!" : `${Math.abs(parDiff)} under par!`}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" data-testid="badge-par-result">
                      {parDiff} over par
                    </Badge>
                  )}
                  {hintsUsed > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Hint penalty: -{hintsUsed * 30} pts
                    </p>
                  )}
                </div>

                <p className="text-sm italic text-muted-foreground" data-testid="text-completion-message">
                  {completionMessage}
                </p>

                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}

                {ladder.length > 1 && (
                  <div className="text-left">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Your path ({steps} steps):</p>
                    <div className="flex flex-wrap gap-1 justify-center max-h-32 overflow-y-auto">
                      {ladder.map((word, wordIdx) => (
                        <span key={wordIdx} className="flex items-center gap-1">
                          <Badge variant={wordIdx === 0 || wordIdx === ladder.length - 1 ? "default" : "secondary"} className="text-sm">{word}</Badge>
                          {wordIdx < ladder.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaths(!showPaths)}
                  className="gap-1.5"
                  data-testid="button-show-paths"
                >
                  {showPaths ? "Hide" : "Show"} Optimal Paths
                </Button>

                <AnimatePresence>
                  {showPaths && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 pt-2"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        Optimal paths ({puzzle.optimalPaths.length} found):
                      </p>
                      {puzzle.optimalPaths.map((path, pathIdx) => (
                        <div key={pathIdx} className="flex flex-wrap gap-1 justify-center" data-testid={`path-${pathIdx}`}>
                          {path.map((word, wordIdx) => (
                            <span key={wordIdx} className="flex items-center gap-1">
                              <Badge
                                variant={wordIdx === 0 ? "default" : wordIdx === path.length - 1 ? "default" : "outline"}
                                className={
                                  wordIdx === 0
                                    ? "bg-primary text-primary-foreground"
                                    : wordIdx === path.length - 1
                                    ? "bg-accent text-accent-foreground"
                                    : ""
                                }
                              >
                                {word}
                              </Badge>
                              {wordIdx < path.length - 1 && (
                                <span className="text-muted-foreground text-xs">→</span>
                              )}
                            </span>
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({path.length - 2} steps)
                          </span>
                        </div>
                      ))}

                      <div className="pt-2">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Your path:</p>
                        <div className="flex flex-wrap gap-1 justify-center" data-testid="player-path">
                          {ladder.map((word, wordIdx) => (
                            <span key={wordIdx} className="flex items-center gap-1">
                              <Badge
                                variant={wordIdx === 0 ? "default" : wordIdx === ladder.length - 1 ? "default" : "secondary"}
                                className={
                                  wordIdx === 0
                                    ? "bg-primary text-primary-foreground"
                                    : wordIdx === ladder.length - 1
                                    ? "bg-accent text-accent-foreground"
                                    : ""
                                }
                              >
                                {word}
                              </Badge>
                              {wordIdx < ladder.length - 1 && (
                                <span className="text-muted-foreground text-xs">→</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <ShareResults
                  gameName="Word Ladder"
                  gameSlug="word-ladder"
                  score={score}
                  isWin={true}
                  customMessage={`Climbed from ${puzzle.start} to ${puzzle.target} in ${steps} steps (par ${puzzle.par})`}
                />
                {!user && (
                  <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span>
                      <button className="underline font-medium" onClick={() => setAuthOpen(true)} data-testid="button-sign-in-cta">Sign in</button>{" "}
                      to save your score to the leaderboard!
                    </span>
                  </div>
                )}
                {!locked && (
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    <Button onClick={() => initGame(lastPuzzleRef.current ?? undefined)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Replay
                    </Button>
                    <Button onClick={() => initGame()} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      Play Again
                    </Button>
                    <Button onClick={() => navigate("/games/word-ladder")} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                      Main Menu
                    </Button>
                    <TryAnotherGameButton currentSlug="word-ladder" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameStatus === "lost" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <XCircle className="h-12 w-12 mx-auto text-destructive" />
                <h3 className="text-xl font-bold">Game Over</h3>
                <p className="text-muted-foreground">You ended the game early.</p>
                <p className="text-sm italic text-muted-foreground" data-testid="text-completion-message">{completionMessage}</p>
                <p className="text-lg font-semibold" data-testid="text-score">Score: {score} pts</p>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Word Ladder"
                  gameSlug="word-ladder"
                  score={score}
                  isWin={false}
                />
                {ladder.length > 1 && (
                  <div className="text-left">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Steps taken ({ladder.length - 1}):</p>
                    <div className="flex flex-wrap gap-1 justify-center max-h-32 overflow-y-auto">
                      {ladder.map((word, wordIdx) => (
                        <span key={wordIdx} className="flex items-center gap-1">
                          <Badge variant={wordIdx === 0 ? "default" : "secondary"} className="text-sm">{word}</Badge>
                          {wordIdx < ladder.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!user && (
                  <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span>
                      <button className="underline font-medium" onClick={() => setAuthOpen(true)} data-testid="button-sign-in-cta">Sign in</button>{" "}
                      to save your score to the leaderboard!
                    </span>
                  </div>
                )}
                {!locked && (
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    <Button onClick={() => initGame(lastPuzzleRef.current ?? undefined)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Replay
                    </Button>
                    <Button onClick={() => initGame()} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      Play Again
                    </Button>
                    <Button onClick={() => navigate("/games/word-ladder")} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                      Main Menu
                    </Button>
                    <TryAnotherGameButton currentSlug="word-ladder" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {gameStatus === "playing" && (
        <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          <span>Tip: Change one letter and rearrange to climb the ladder</span>
        </div>
      )}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
