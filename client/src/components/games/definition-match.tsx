import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, BookOpen, Loader2, LogIn, Eye, Lock } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { DefinitionWord } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";
import { TryAnotherGameButton } from "@/components/try-another-game-button";

const POINTS_BY_HINTS = [100, 75, 50] as const;

export function DefinitionMatchGame({ groupSeed, locked, quizMode }: { groupSeed?: number; locked?: boolean; quizMode?: boolean } = {}) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded } = useGameResult({ slug: "definition-match", quizMode });
  const personalBest = usePersonalBest("definition-match");
  const seeded = groupSeed !== undefined;
  const seedRngRef = useRef<(() => number) | undefined>(
    seeded ? makeSeededRng(groupSeed!) : undefined
  );
  const { data: words = [], isLoading, error } = useQuery<DefinitionWord[]>({
    queryKey: seeded ? ["/api/games/definition-match/words", groupSeed] : ["/api/games/definition-match/words"],
    ...(seeded ? { queryFn: async () => { const r = await fetch(`/api/games/definition-match/words?seed=${groupSeed}`, { credentials: "include" }); return r.json(); } } : {}),
    refetchOnMount: seeded ? false : "always",
    gcTime: 0,
  });

  const [activeWords, setActiveWords] = useState<DefinitionWord[]>([]);
  const [currentWord, setCurrentWord] = useState<DefinitionWord | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectNewWord = useCallback(() => {
    const availableWords = activeWords.filter((w) => !usedWords.has(w.word));
    if (availableWords.length === 0) {
      playSound("win");
      setGameStatus("won");
      setCompletionMessage(getCompletionMessage(true));
      return;
    }
    const rng = seedRngRef.current ?? Math.random;
    const randomWord = availableWords[Math.floor(rng() * availableWords.length)];
    setCurrentWord(randomWord);
    setUserInput("");
    setHintsUsed(0);
    setAnswerRevealed(false);
    setFeedback(null);
    setUsedWords((prev) => new Set(Array.from(prev).concat(randomWord.word)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedWords, activeWords, playSound]);

  const initGame = useCallback(() => {
    if (words.length === 0) return;
    resetRecorded();
    setActiveWords(words);
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setGameStatus("playing");
    setUsedWords(new Set());
    setHintsUsed(0);
    setAnswerRevealed(false);
    setFeedback(null);
    const rng = seedRngRef.current ?? Math.random;
    const randomWord = words[Math.floor(rng() * words.length)];
    setCurrentWord(randomWord);
    setUserInput("");
    setUsedWords(new Set([randomWord.word]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [words, resetRecorded]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  useEffect(() => {
    if (gameStatus === "won") {
      reportResult(score, true);
    } else if (gameStatus === "lost") {
      reportResult(score, false);
    }
  }, [gameStatus, score, reportResult]);

  const checkAnswer = () => {
    if (!currentWord || answerRevealed) return;
    if (userInput.toUpperCase().trim() === currentWord.word.toUpperCase()) {
      playSound("correct");
      setFeedback("correct");
      const points = POINTS_BY_HINTS[hintsUsed as 0 | 1 | 2] + streak * 10;
      setScore((prev) => prev + points);
      setStreak((prev) => prev + 1);
      setWordsCompleted((prev) => prev + 1);
      setTimeout(() => {
        setFeedback(null);
        selectNewWord();
      }, 900);
    } else {
      playSound("wrong");
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => setFeedback(null), 900);
    }
  };

  const revealNextHint = () => {
    if (hintsUsed >= 2) return;
    setHintsUsed((prev) => prev + 1);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const revealAnswer = () => {
    setAnswerRevealed(true);
    setStreak(0);
    setTimeout(() => selectNewWord(), 2200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !answerRevealed) {
      checkAnswer();
    }
  };

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
          <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!currentWord) return null;

  const visibleCount = hintsUsed + 1;
  const pointsAvailable = POINTS_BY_HINTS[Math.min(hintsUsed, 2) as 0 | 1 | 2];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            <AnimatedNumber value={score} /> pts
          </Badge>
          <StreakIndicator streak={streak} />
        </div>
        <div className="flex items-center gap-2">
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={initGame}
              className="gap-1.5"
              data-testid="button-restart"
            >
              <RotateCcw className="h-4 w-4" />
              Restart
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

      <AnimatePresence mode="wait">
        {gameStatus === "playing" ? (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardContent className="p-6 space-y-5">

                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="gap-1.5" data-testid="badge-pos">
                    <BookOpen className="h-3.5 w-3.5" />
                    {currentWord.partOfSpeech}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {wordsCompleted} / {activeWords.length} words
                  </span>
                </div>

                <div
                  className="h-12 rounded-md border bg-muted/30 flex items-center justify-center px-4"
                  aria-live="polite"
                  data-testid="answer-reveal-container"
                >
                  <AnimatePresence mode="wait">
                    {answerRevealed ? (
                      <motion.span
                        key="answer"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xl font-bold tracking-widest text-primary uppercase"
                        data-testid="text-revealed-answer"
                      >
                        {currentWord.word}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="tracking-[0.4em] text-muted-foreground/30 text-lg font-bold select-none"
                      >
                        {"— — —"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="max-w-sm mx-auto space-y-3">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Type the word…"
                      aria-label="Type the word"
                      className={`text-center text-lg font-semibold tracking-wider uppercase pr-10 ${
                        feedback === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback === "wrong"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      disabled={answerRevealed || feedback === "correct"}
                      data-testid="input-answer"
                    />
                    <div aria-live="polite">
                      {feedback && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {feedback === "correct" ? (
                            <CheckCircle className="h-5 w-5 text-accent" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
                    {feedback === "wrong" && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-destructive text-center"
                      >
                        Not quite — try again
                      </motion.p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={checkAnswer}
                      disabled={userInput.length === 0 || answerRevealed || feedback === "correct"}
                      className="flex-1"
                      data-testid="button-submit"
                    >
                      Submit
                    </Button>
                    {hintsUsed < 2 ? (
                      <Button
                        variant="outline"
                        onClick={revealNextHint}
                        disabled={answerRevealed || feedback === "correct"}
                        className="gap-1.5 shrink-0"
                        data-testid="button-reveal-hint"
                      >
                        <Eye className="h-4 w-4" />
                        Reveal clue
                        <span className="text-xs text-muted-foreground">
                          −25 pts
                        </span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={revealAnswer}
                        disabled={answerRevealed || feedback === "correct"}
                        className="gap-1.5 shrink-0 text-muted-foreground"
                        data-testid="button-show-answer"
                      >
                        Show answer
                      </Button>
                    )}
                  </div>

                  {!answerRevealed && (
                    <p className="text-center text-xs text-muted-foreground">
                      Worth <span className="font-semibold text-foreground">{pointsAvailable} pts</span> if you guess now
                    </p>
                  )}
                </div>

                <div className="space-y-2" data-testid="definitions-container">
                  {currentWord.definitions.map((def, index) => {
                    const isVisible = index < visibleCount;
                    return (
                      <motion.div
                        key={`${currentWord.word}-${index}`}
                        initial={index === 0 ? { opacity: 0, y: 10 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index === 0 ? 0.1 : 0 }}
                      >
                        <AnimatePresence mode="wait">
                          {isVisible ? (
                            <motion.div
                              key="visible"
                              initial={index > 0 ? { opacity: 0, height: 0 } : false}
                              animate={{ opacity: 1, height: "auto" }}
                              transition={{ duration: 0.3 }}
                              className={`rounded-lg border p-4 ${
                                index === 0
                                  ? "bg-card"
                                  : index === 1
                                  ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                                  : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                              }`}
                              data-testid={`definition-card-${index}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`text-xs font-semibold shrink-0 mt-0.5 px-1.5 py-0.5 rounded ${
                                  index === 0
                                    ? "bg-primary/10 text-primary"
                                    : index === 1
                                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                                }`}>
                                  {index === 0 ? "Clue 1" : index === 1 ? "Clue 2" : "Clue 3"}
                                </span>
                                <p className="text-sm sm:text-base italic text-muted-foreground leading-snug">
                                  "{def}"
                                </p>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="locked"
                              className="rounded-lg border border-dashed p-4 flex items-center gap-3 text-muted-foreground/40"
                              data-testid={`definition-locked-${index}`}
                            >
                              <Lock className="h-4 w-4 shrink-0" />
                              <span className="text-sm">
                                {index === 1 ? "Second clue — costs 25 pts to reveal" : "Third clue — costs 25 pts to reveal"}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

              </CardContent>
            </Card>
          </motion.div>
        ) : gameStatus === "won" ? (
          <motion.div
            key="won"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="border-accent">
              <CardContent className="p-6 text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                  <Trophy className="h-16 w-16 mx-auto text-accent" />
                </motion.div>
                <h3 className="text-2xl font-bold">Vocabulary Master!</h3>
                <p className="text-muted-foreground">You matched all the definitions!</p>
                <p className="text-sm italic text-muted-foreground" data-testid="text-completion-message">{completionMessage}</p>
                <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Definition Match"
                  gameSlug="definition-match"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  isWin={true}
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
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button onClick={initGame} data-testid="button-play-again">Play Again</Button>
                    <TryAnotherGameButton currentSlug="definition-match" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="lost"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                  <XCircle className="h-16 w-16 mx-auto text-destructive" />
                </motion.div>
                <h3 className="text-2xl font-bold">Game Over</h3>
                <p className="text-muted-foreground">You ended the game early.</p>
                <p className="text-sm italic text-muted-foreground" data-testid="text-completion-message">{completionMessage}</p>
                <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Definition Match"
                  gameSlug="definition-match"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  isWin={false}
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
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button onClick={initGame} data-testid="button-play-again">Play Again</Button>
                    <TryAnotherGameButton currentSlug="definition-match" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
