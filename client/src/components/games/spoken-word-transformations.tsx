import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, Clock3, Headphones, LogIn, Play, RotateCcw, Volume2, X } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ShareResults } from "@/components/share-results";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { useGameResult } from "@/hooks/use-game-result";
import { useAuth } from "@/lib/auth-context";
import { makeSeededRng } from "@/lib/seeded-rng";
import {
  getSpokenWordLeaderboardSlug,
  SPOKEN_WORD_GAME_SLUG,
  SPOKEN_WORD_MODES,
  SPOKEN_WORD_TRANSFORM_MODES,
  isValidSpokenWord,
  transformSpokenWord,
  type SpokenWordModeSlug,
  type SpokenWordTransformMode,
} from "@shared/spoken-word";

const ROUND_COUNT = 10;
const ROUND_SECONDS = 8;
const BASE_POINTS = 100;
const SPEED_POINTS_PER_SECOND = 2;

type Round = {
  word: string;
  mode: SpokenWordTransformMode;
  answer: string;
};

type GameStatus = "ready" | "playing" | "complete";

function supportsSpeech(): boolean {
  return typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined"
    && typeof window.SpeechSynthesisUtterance !== "undefined";
}

function createRounds(mode: SpokenWordModeSlug, wordPool: readonly string[], seed?: number): Round[] {
  const random = seed === undefined ? Math.random : makeSeededRng(seed);
  const words = [...new Set(wordPool.map((word) => word.trim().toLowerCase()).filter(isValidSpokenWord))];
  if (words.length < ROUND_COUNT) {
    throw new Error("Not enough eligible words are available to start this game.");
  }
  for (let i = words.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  return words.slice(0, ROUND_COUNT).map((word) => {
    const transformMode = mode === "mixed"
      ? SPOKEN_WORD_TRANSFORM_MODES[Math.floor(random() * SPOKEN_WORD_TRANSFORM_MODES.length)]
      : mode;
    return {
      word,
      mode: transformMode,
      answer: transformSpokenWord(word, transformMode),
    };
  });
}

function modeLabel(mode: SpokenWordTransformMode): string {
  return SPOKEN_WORD_MODES.find((item) => item.slug === mode)?.label ?? "Spell It";
}

function promptFor(mode: SpokenWordTransformMode): string {
  switch (mode) {
    case "spell-it": return "Type the word exactly as you heard it.";
    case "reverse": return "Spell the word backward.";
    case "vowels-only": return "Type only the vowels, in the order you heard them.";
    case "consonants-only": return "Type only the consonants, in the order you heard them.";
    case "vowel-count": return "How many vowels were in the word?";
    case "consonant-count": return "How many consonants were in the word?";
  }
}

export interface SpokenWordTransformationsGameProps {
  groupSeed?: number;
  locked?: boolean;
  initialMode?: SpokenWordModeSlug;
}

export function SpokenWordTransformationsGame({
  groupSeed,
  locked = false,
  initialMode,
}: SpokenWordTransformationsGameProps) {
  const [selectedMode, setSelectedMode] = useState<SpokenWordModeSlug>(initialMode ?? "reverse");
  const [gameStatus, setGameStatus] = useState<GameStatus>("ready");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [replayUsed, setReplayUsed] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [fallbackWordVisible, setFallbackWordVisible] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const [practiceOnly, setPracticeOnly] = useState(false);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [wordLoadError, setWordLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const answerSubmittedRef = useRef(false);
  const scoreRef = useRef(0);
  const correctCountRef = useRef(0);
  const practiceOnlyRef = useRef(false);
  const submitRef = useRef<(timedOut?: boolean) => void>(() => {});
  const { user } = useAuth();
  const { reportResult, resetRecorded } = useGameResult({
    slug: getSpokenWordLeaderboardSlug(selectedMode),
  });

  useEffect(() => {
    setAudioSupported(supportsSpeech());
    if (initialMode) setSelectedMode(initialMode);
    else if (groupSeed !== undefined) {
      setSelectedMode(SPOKEN_WORD_MODES[Math.abs(groupSeed) % SPOKEN_WORD_MODES.length].slug);
    }
  }, [groupSeed, initialMode]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const deadline = Date.now() + ROUND_SECONDS * 1000;
    setTimeLeft(ROUND_SECONDS);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        stopTimer();
        submitRef.current(true);
      }
    }, 100);
  }, [stopTimer]);

  const playWord = useCallback((round: Round, isReplay = false) => {
    if (!supportsSpeech()) {
      practiceOnlyRef.current = true;
      setPracticeOnly(true);
      setFallbackWordVisible(true);
      setIsSpeaking(false);
      if (!isReplay) startTimer();
      return;
    }

    setFallbackWordVisible(false);
    setIsSpeaking(true);
    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(round.word);
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      utterance.onend = () => {
        setIsSpeaking(false);
        window.setTimeout(() => inputRef.current?.focus(), 0);
        if (!isReplay && !timerRef.current) startTimer();
      };
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        if (event.error === "canceled" || event.error === "interrupted") return;
        practiceOnlyRef.current = true;
        setPracticeOnly(true);
        setFallbackWordVisible(true);
        if (!isReplay && !timerRef.current) startTimer();
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      practiceOnlyRef.current = true;
      setPracticeOnly(true);
      setFallbackWordVisible(true);
      setIsSpeaking(false);
      if (!isReplay) startTimer();
    }
  }, [startTimer]);

  const finishGame = useCallback((finalScore: number, finalCorrectCount: number) => {
    stopTimer();
    setGameStatus("complete");
    reportResult(finalScore, finalCorrectCount > 0, finalCorrectCount, undefined, practiceOnlyRef.current);
  }, [reportResult, stopTimer]);

  const moveToNextRound = useCallback((nextScore: number, nextCorrectCount: number) => {
    if (roundIndex + 1 >= rounds.length) {
      finishGame(nextScore, nextCorrectCount);
      return;
    }
    const nextIndex = roundIndex + 1;
    const nextRound = rounds[nextIndex];
    setRoundIndex(nextIndex);
    setAnswer("");
    setFeedback(null);
    setReplayUsed(false);
    setFallbackWordVisible(false);
    answerSubmittedRef.current = false;
    setTimeLeft(ROUND_SECONDS);
    playWord(nextRound);
  }, [finishGame, playWord, roundIndex, rounds]);

  const handleSubmit = useCallback((timedOut = false) => {
    if (gameStatus !== "playing" || answerSubmittedRef.current) return;
    const currentRound = rounds[roundIndex];
    if (!currentRound) return;
    if (!timedOut && isSpeaking) return;

    answerSubmittedRef.current = true;
    stopTimer();
    const normalizedAnswer = answer.trim().toLowerCase().replace(/\s+/g, "");
    const isCorrect = !timedOut && normalizedAnswer === currentRound.answer;
    const points = isCorrect ? BASE_POINTS + timeLeft * SPEED_POINTS_PER_SECOND : 0;
    const nextScore = scoreRef.current + points;
    const nextCorrectCount = correctCountRef.current + (isCorrect ? 1 : 0);
    scoreRef.current = nextScore;
    correctCountRef.current = nextCorrectCount;
    setScore(nextScore);
    setCorrectCount(nextCorrectCount);
    setFeedback({ correct: isCorrect, answer: currentRound.answer });

    advanceRef.current = setTimeout(() => {
      moveToNextRound(nextScore, nextCorrectCount);
    }, 850);
  }, [answer, gameStatus, isSpeaking, moveToNextRound, roundIndex, rounds, stopTimer, timeLeft]);
  submitRef.current = handleSubmit;

  const startGame = useCallback(async () => {
    setGameStatus("ready");
    setIsLoadingWords(true);
    setWordLoadError(null);

    try {
      const query = groupSeed === undefined ? "" : `?seed=${encodeURIComponent(String(groupSeed))}`;
      const response = await fetch(`/api/games/spoken-word-transformations/words${query}`, {
        credentials: "include",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "message" in payload
          && typeof payload.message === "string"
          ? payload.message
          : "Unable to load words. Please try again.";
        throw new Error(message);
      }
      if (!Array.isArray(payload) || !payload.every((word) => typeof word === "string")) {
        throw new Error("The word service returned an invalid word list. Please try again.");
      }

      const nextRounds = createRounds(selectedMode, payload, groupSeed);
      resetRecorded();
      scoreRef.current = 0;
      correctCountRef.current = 0;
      practiceOnlyRef.current = !supportsSpeech();
      answerSubmittedRef.current = false;
      setPracticeOnly(!supportsSpeech());
      setScore(0);
      setCorrectCount(0);
      setRoundIndex(0);
      setRounds(nextRounds);
      setAnswer("");
      setFeedback(null);
      setReplayUsed(false);
      setTimeLeft(ROUND_SECONDS);
      setGameStatus("playing");
      playWord(nextRounds[0]);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      setWordLoadError(error instanceof Error ? error.message : "Unable to load words. Please try again.");
    } finally {
      setIsLoadingWords(false);
    }
  }, [groupSeed, playWord, resetRecorded, selectedMode]);

  const replayWord = useCallback(() => {
    const currentRound = rounds[roundIndex];
    if (!currentRound || replayUsed || isSpeaking || feedback) return;
    setReplayUsed(true);
    playWord(currentRound, true);
  }, [feedback, isSpeaking, playWord, replayUsed, roundIndex, rounds]);

  const restart = useCallback(() => {
    stopTimer();
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (supportsSpeech()) window.speechSynthesis.cancel();
    answerSubmittedRef.current = false;
    setGameStatus("ready");
    setRounds([]);
    setRoundIndex(0);
    setAnswer("");
    setFeedback(null);
    setFallbackWordVisible(false);
  }, [stopTimer]);

  useEffect(() => () => {
    stopTimer();
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (supportsSpeech()) window.speechSynthesis.cancel();
    utteranceRef.current = null;
  }, [stopTimer]);

  const currentRound = rounds[roundIndex];
  const currentModeLabel = currentRound ? modeLabel(currentRound.mode) : "";
  const selectedModeLabel = SPOKEN_WORD_MODES.find((mode) => mode.slug === selectedMode)?.label ?? "Mixed Challenge";
  const shareMessage = `${practiceOnly ? "I completed a practice run of" : "I completed"} ${selectedModeLabel} in Spoken Word Transformations on xtraWordinary!\n\nScore: ${score.toLocaleString()} points\nCorrect: ${correctCount} of ${ROUND_COUNT}\n\nCan you beat my score? Try it here:`;
  const isCountMode = currentRound?.mode === "vowel-count" || currentRound?.mode === "consonant-count";
  const progressValue = gameStatus === "playing"
    ? ((roundIndex + 1) / ROUND_COUNT) * 100
    : gameStatus === "complete" ? 100 : 0;

  return (
    <Card className="overflow-hidden" data-testid="spoken-word-transformations-game">
      <CardContent className="p-4 sm:p-6">
        {gameStatus === "ready" && (
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Headphones className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Listen closely. Transform the word.</h2>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Hear 10 words and answer each prompt within 8 seconds. You can replay each word once.
                Y is counted as a consonant.
              </p>
            </div>

            {!audioSupported && (
              <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                Speech playback is unavailable in this browser. You can still practice with the word shown, but the score will not be submitted to a leaderboard.
              </div>
            )}

            {wordLoadError && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {wordLoadError}
              </div>
            )}

            {!locked && !initialMode && (
              <div className="flex flex-col gap-2" role="group" aria-label="Choose a game mode">
                {SPOKEN_WORD_MODES.map((mode) => (
                  <button
                    key={mode.slug}
                    type="button"
                    aria-pressed={selectedMode === mode.slug}
                    onClick={() => setSelectedMode(mode.slug)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selectedMode === mode.slug
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card hover:bg-muted/60"
                    }`}
                    data-testid={`spoken-mode-${mode.slug}`}
                  >
                    <span className="block font-semibold">{mode.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {mode.slug === "mixed"
                        ? "A different instruction on each word."
                        : `${promptFor(mode.slug as SpokenWordTransformMode)} Y counts as a consonant.`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {(locked || initialMode) && (
              <Badge variant="secondary" className="px-3 py-1 text-sm">
                {SPOKEN_WORD_MODES.find((mode) => mode.slug === selectedMode)?.label ?? "Mixed Challenge"}
              </Badge>
            )}

            <Button size="lg" onClick={startGame} disabled={isLoadingWords} data-testid="button-start-spoken-word">
              <Play className="mr-2 h-4 w-4" />
              {isLoadingWords ? "Loading words..." : wordLoadError ? "Try again" : "Start listening"}
            </Button>
          </div>
        )}

        {gameStatus === "playing" && currentRound && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary">Round {roundIndex + 1} of {ROUND_COUNT}</Badge>
              <span className="text-sm font-semibold tabular-nums" data-testid="text-spoken-score">
                {score} pts
              </span>
            </div>
            <Progress value={progressValue} aria-label={`Round ${roundIndex + 1} of ${ROUND_COUNT}`} />

            <div className="rounded-2xl border bg-muted/40 p-5 text-center sm:p-8" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {currentModeLabel}
              </p>
              <h2 className="mt-2 text-xl font-bold">{promptFor(currentRound.mode)}</h2>
              <div className="mt-5 flex min-h-12 items-center justify-center">
                {isSpeaking ? (
                  <span className="inline-flex items-center gap-2 text-sm text-primary" role="status">
                    <Volume2 className="h-5 w-5 animate-pulse" />
                    Listening…
                  </span>
                ) : fallbackWordVisible ? (
                  <span className="rounded-lg bg-background px-4 py-2 text-2xl font-bold tracking-[0.18em]" data-testid="text-spoken-fallback">
                    {currentRound.word.toUpperCase()}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Enter your answer</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold tabular-nums ${
                timeLeft <= 3 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
              }`} aria-live="off" data-testid="text-spoken-timer">
                <Clock3 className="h-4 w-4" />
                {timeLeft}s
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={replayWord}
                disabled={replayUsed || isSpeaking || !!feedback}
                data-testid="button-replay-spoken-word"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {replayUsed ? "Replay used" : "Replay once"}
              </Button>
            </div>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <Input
                ref={inputRef}
                value={answer}
                onChange={(event) => setAnswer(isCountMode ? event.target.value : event.target.value.toUpperCase())}
                inputMode={isCountMode ? "numeric" : "text"}
                type={isCountMode ? "number" : "text"}
                min={isCountMode ? 0 : undefined}
                max={isCountMode ? 8 : undefined}
                autoComplete="off"
                aria-label={isCountMode ? "Enter the count" : "Enter the transformed word"}
                placeholder={isCountMode ? "Enter a number" : "Type your answer"}
                disabled={!!feedback}
                data-testid="input-spoken-answer"
              />
              <Button type="submit" disabled={!!feedback || isSpeaking || !answer.trim()} data-testid="button-submit-spoken-answer">
                Submit
              </Button>
            </form>

            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                role="status"
                className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${
                  feedback.correct
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {feedback.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {feedback.correct
                  ? `Correct — +${BASE_POINTS + timeLeft * SPEED_POINTS_PER_SECOND} points`
                  : `Not quite. The answer was ${feedback.answer.toUpperCase()}.`}
              </motion.div>
            )}

            {practiceOnly && (
              <p role="status" className="text-center text-xs text-amber-700 dark:text-amber-300">
                This is a practice run; the score will not be submitted to the leaderboard.
              </p>
            )}
          </div>
        )}

        {gameStatus === "complete" && (
          <div className="mx-auto max-w-lg space-y-5 py-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Check className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Round complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {correctCount} of {ROUND_COUNT} correct
              </p>
            </div>
            <p className="text-4xl font-bold tabular-nums" data-testid="text-spoken-final-score">
              {score.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">pts</span>
            </p>
            {practiceOnly && (
              <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                Practice score only. Audio was unavailable, so this run was not submitted to the leaderboard.
              </p>
            )}
            {!(locked || initialMode) && (
              <ShareResults
                gameName="Spoken Word Transformations"
                gameSlug={SPOKEN_WORD_GAME_SLUG}
                score={score}
                wordsCompleted={correctCount}
                isWin={correctCount > 0}
                customMessage={shareMessage}
              />
            )}
            {!user && (
              <div className="rounded-lg bg-muted/50 p-3 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Sign in to save your score!</p>
                <Button
                  onClick={() => setAuthOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  data-testid="button-signin-result"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={startGame} data-testid="button-play-again-spoken">
                <RotateCcw className="mr-2 h-4 w-4" />
                Play again
              </Button>
              {(locked || initialMode) && (
                <Button variant="outline" onClick={restart} data-testid="button-exit-spoken">
                  Choose another game
                </Button>
              )}
            </div>
            {!(locked || initialMode) && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="ghost" onClick={restart} data-testid="button-change-spoken-mode">
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Change mode
                </Button>
                <TryAnotherGameButton currentSlug={SPOKEN_WORD_GAME_SLUG} />
              </div>
            )}
          </div>
        )}
      </CardContent>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </Card>
  );
}
