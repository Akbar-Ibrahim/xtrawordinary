import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Lightbulb, Trophy, X, Loader2, ArrowDown, Minus } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";
import type { WordLadderPuzzle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface WordLadderGameProps {
  initialChallenge?: boolean;
}

function isOneLetterDiff(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}

function getChangedIndex(a: string, b: string): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return i;
  }
  return -1;
}

export function WordLadderGame({ initialChallenge }: WordLadderGameProps) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded, personalBest } = useGameResult({ slug: "word-ladder" });
  const { data: allPuzzles = [], isLoading, error, refetch } = useQuery<WordLadderPuzzle[]>({
    queryKey: ["/api/games/word-ladder/puzzles"],
    refetchOnMount: "always",
  });

  const [gameStatus, setGameStatus] = useState<"playing" | "won">("playing");
  const [puzzle, setPuzzle] = useState<WordLadderPuzzle | null>(null);
  const [ladder, setLadder] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [validating, setValidating] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [completionMessage, setCompletionMessage] = useState("");
  const [showPaths, setShowPaths] = useState(false);
  const [highlightedLetterIdx, setHighlightedLetterIdx] = useState<{ rung: number; idx: number } | null>(null);
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectPuzzle = useCallback((puzzles: WordLadderPuzzle[]) => {
    if (puzzles.length === 0) return null;
    return puzzles[Math.floor(Math.random() * puzzles.length)];
  }, []);

  const initGame = useCallback(() => {
    resetRecorded();
    const selected = selectPuzzle(allPuzzles);
    if (!selected) return;
    setPuzzle(selected);
    setLadder([selected.start]);
    setCurrentInput("");
    setGameStatus("playing");
    setErrorMsg("");
    setHintsUsed(0);
    setShowPaths(false);
    setScore(0);
    setHighlightedLetterIdx(null);
    setCompletionMessage("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [allPuzzles, selectPuzzle, resetRecorded]);

  useEffect(() => {
    if (allPuzzles.length > 0 && !puzzle) {
      initGame();
    }
  }, [allPuzzles, puzzle, initGame]);

  const lastWord = ladder[ladder.length - 1];

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

    console.log("[Word Ladder Debug]", { lastWord, word, lastWordType: typeof lastWord, wordType: typeof word, lastWordLength: lastWord?.length, wordLength: word.length, result: isOneLetterDiff(lastWord, word), lastWordChars: lastWord?.split("").map(c => c.charCodeAt(0)), wordChars: word.split("").map(c => c.charCodeAt(0)) });
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
        setErrorMsg("Not a valid word");
        setShake(true);
        playSound("wrong");
        setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
        setValidating(false);
        return;
      }

      const changedIdx = getChangedIndex(lastWord, word);
      setHighlightedLetterIdx({ rung: ladder.length, idx: changedIdx });

      const newLadder = [...ladder, word];
      setLadder(newLadder);
      setCurrentInput("");
      playSound("correct");

      if (word === puzzle.target) {
        const steps = newLadder.length - 2;
        const finalScore = calculateScore(steps, puzzle.par, hintsUsed);
        setScore(finalScore);
        setGameStatus("won");
        setCompletionMessage(getCompletionMessage(true));
        playSound("win");
        reportResult(finalScore, true);
      }

      setTimeout(() => setHighlightedLetterIdx(null), 800);
    } catch {
      setErrorMsg("Validation failed, try again");
      setTimeout(() => setErrorMsg(""), 2000);
    }
    setValidating(false);
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

  const getProgressPercent = useCallback(() => {
    if (!puzzle) return 0;
    const totalSteps = puzzle.par + 1;
    const currentSteps = ladder.length - 1;
    return Math.min(100, (currentSteps / totalSteps) * 100);
  }, [puzzle, ladder]);

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
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex">
            <div className="relative w-3 mr-4 flex-shrink-0">
              <div className="absolute inset-0 bg-muted rounded-full" />
              <motion.div
                className="absolute top-0 left-0 w-full rounded-full"
                style={{ backgroundColor: "hsl(262, 83%, 58%)" }}
                initial={{ height: "0%" }}
                animate={{ height: `${getProgressPercent()}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            <div className="flex-1 space-y-2">
              {(() => {
                const allRungs: React.ReactNode[] = [];

                ladder.forEach((word, rungIndex) => {
                  const isStart = rungIndex === 0;
                  const isTarget = word === puzzle.target;
                  const changedIdx = rungIndex > 0 ? getChangedIndex(ladder[rungIndex - 1], word) : -1;
                  const isHighlighted = highlightedLetterIdx?.rung === rungIndex;

                  allRungs.push(
                    <motion.div
                      key={`word-${rungIndex}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-2"
                    >
                      <div className="flex gap-1" data-testid={`rung-${rungIndex}`}>
                        {word.split("").map((letter, letterIdx) => {
                          const isChanged = letterIdx === changedIdx && rungIndex > 0;
                          const letterHighlight = isHighlighted && letterIdx === highlightedLetterIdx?.idx;

                          return (
                            <motion.div
                              key={letterIdx}
                              initial={isChanged ? { scale: 1.3, rotateY: 180 } : false}
                              animate={{ scale: 1, rotateY: 0 }}
                              transition={{ duration: 0.4, type: "spring" }}
                              className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 transition-colors ${
                                isStart
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : isTarget
                                  ? "bg-accent text-accent-foreground border-accent"
                                  : isChanged
                                  ? "border-chart-3"
                                  : "border-border"
                              } ${letterHighlight ? "ring-2 ring-chart-3 ring-offset-1" : ""}`}
                              style={
                                !isStart && !isTarget
                                  ? { backgroundColor: getGradientColor(rungIndex, totalRungs) + "20", borderColor: getGradientColor(rungIndex, totalRungs) }
                                  : undefined
                              }
                              data-testid={`letter-${rungIndex}-${letterIdx}`}
                            >
                              {letter}
                            </motion.div>
                          );
                        })}
                      </div>
                      {isStart && (
                        <Badge variant="secondary" className="text-xs ml-2" data-testid="badge-start">START</Badge>
                      )}
                      {isTarget && (
                        <Badge className="bg-accent text-accent-foreground text-xs ml-2" data-testid="badge-target-reached">TARGET</Badge>
                      )}
                    </motion.div>
                  );

                  if (rungIndex < ladder.length - 1 || (gameStatus === "playing" && !isTarget)) {
                    allRungs.push(
                      <div key={`arrow-${rungIndex}`} className="flex items-center pl-3 sm:pl-4">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    );
                  }
                });

                if (gameStatus === "playing") {
                  allRungs.push(
                    <motion.div
                      key="input-rung"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`flex items-center gap-2 ${shake ? "animate-shake" : ""}`}
                    >
                      <div className="flex gap-1">
                        {puzzle.start.split("").map((_, letterIdx) => {
                          const inputLetter = (currentInput[letterIdx] || "").toUpperCase();
                          const prevLetter = lastWord[letterIdx];
                          const isChanged = inputLetter && inputLetter !== prevLetter;
                          return (
                            <div
                              key={letterIdx}
                              className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 border-dashed ${
                                isChanged ? "border-chart-3 bg-chart-3/10" : "border-muted-foreground/30 bg-card"
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

                  const remainingSteps = puzzle.par - (ladder.length - 1);
                  if (remainingSteps > 0) {
                    for (let i = 0; i < Math.min(remainingSteps, 3); i++) {
                      allRungs.push(
                        <div key={`empty-${i}`} className="flex items-center gap-2">
                          <div className="flex items-center pl-3 sm:pl-4 mb-1">
                            <Minus className="h-3 w-3 text-muted-foreground/30" />
                          </div>
                        </div>
                      );
                    }
                  }

                  allRungs.push(
                    <div key="target-preview" className="flex items-center gap-2">
                      <div className="flex items-center pl-3 sm:pl-4 mb-1">
                        <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    </div>
                  );

                  allRungs.push(
                    <div key="target" className="flex items-center gap-2 opacity-60">
                      <div className="flex gap-1" data-testid="rung-target">
                        {puzzle.target.split("").map((letter, letterIdx) => (
                          <div
                            key={letterIdx}
                            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 border-accent bg-accent/10"
                            data-testid={`target-letter-${letterIdx}`}
                          >
                            {letter}
                          </div>
                        ))}
                      </div>
                      <Badge variant="outline" className="text-xs ml-2 border-accent text-accent" data-testid="badge-target">TARGET</Badge>
                    </div>
                  );
                }

                return allRungs;
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {gameStatus === "playing" && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value.toUpperCase().slice(0, puzzle.start.length))}
            onKeyDown={handleKeyDown}
            placeholder={`Type a ${puzzle.start.length}-letter word...`}
            maxLength={puzzle.start.length}
            className="font-mono text-lg tracking-wider uppercase"
            disabled={validating}
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
                <Button onClick={() => initGame()} className="mt-2" data-testid="button-play-again">
                  Play Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {gameStatus === "playing" && (
        <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          <span>Tip: Change exactly one letter at a time to climb the ladder</span>
        </div>
      )}
    </div>
  );
}
