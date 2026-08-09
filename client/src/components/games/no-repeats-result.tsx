import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Timer, Zap, Flame, ArrowRight, LogIn } from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import { ShareResults } from "@/components/share-results";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { type Challenge, CHALLENGE_CONFIG } from "./no-repeats-helpers";
import { WordExamplesPanel } from "@/components/word-examples-panel";

interface NoRepeatsResultProps {
  gameStatus: "won" | "lost";
  isSurvival: boolean;
  wordsCompleted: number;
  score: number;
  personalBest: number;
  usedWords: Set<string>;
  completionMessage: string;
  challenge: Challenge;
  nextChallenge: Challenge | null;
  requiredLetters: string[];
  locked?: boolean;
  isSignedIn: boolean;
  onPlayAgain: () => void;
  onMenu: () => void;
  onNextChallenge: () => void;
  onSignIn: () => void;
}

export function NoRepeatsResult({
  gameStatus,
  isSurvival,
  wordsCompleted,
  score,
  personalBest,
  usedWords,
  completionMessage,
  challenge,
  nextChallenge,
  requiredLetters,
  locked,
  isSignedIn,
  onPlayAgain,
  onMenu,
  onNextChallenge,
  onSignIn,
}: NoRepeatsResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <Card>
        <CardContent className="p-8">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              gameStatus === "won" ? "bg-accent/20" : "bg-destructive/20"
            }`}
          >
            {gameStatus === "won" ? (
              <Trophy className="w-10 h-10 text-accent" />
            ) : (
              <Timer className="w-10 h-10 text-destructive" />
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2" data-testid="text-game-result">
            {gameStatus === "won" ? "Challenge Complete!" : "Time's Up!"}
          </h2>

          {isSurvival && (
            <Badge variant="secondary" className="mb-2 gap-1.5">
              <Flame className="h-3 w-3" />
              Survival Mode
            </Badge>
          )}

          {requiredLetters.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 mb-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Required letters were:</span>
              {requiredLetters.map((l, i) => (
                <span
                  key={i}
                  className="w-7 h-7 inline-flex items-center justify-center text-sm font-bold rounded bg-primary text-primary-foreground"
                  data-testid={`badge-required-letter-result-${i}`}
                >
                  {l}
                </span>
              ))}
            </div>
          )}

          <p className="text-muted-foreground mb-2" data-testid="text-result-summary">
            {gameStatus === "won"
              ? `You found ${wordsCompleted} isogram${wordsCompleted !== 1 ? "s" : ""}!`
              : `You found ${wordsCompleted} word${wordsCompleted !== 1 ? "s" : ""} before time ran out.`}
          </p>
          <p className="text-sm italic text-muted-foreground mb-4" data-testid="text-completion-message">
            {completionMessage}
          </p>

          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-3xl font-bold" data-testid="text-final-score">
              <AnimatedNumber value={score} />
            </span>
            <span className="text-muted-foreground">points</span>
          </div>

          {personalBest > 0 && (
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-personal-best">
              Personal Best: {personalBest} pts
            </p>
          )}

          <ShareResults
            gameName="No Repeats: Isogram"
            gameSlug={isSurvival ? "no-repeats-survival" : "no-repeats"}
            score={score}
            wordsCompleted={wordsCompleted}
            challengeName={CHALLENGE_CONFIG[challenge].name}
            isWin={gameStatus === "won"}
          />

          {!isSignedIn && (
            <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2 mt-4">
              <LogIn className="h-4 w-4 shrink-0" />
              <span>
                <button
                  className="underline font-medium"
                  onClick={onSignIn}
                  data-testid="button-sign-in-cta"
                >
                  Sign in
                </button>{" "}
                to save your score to the leaderboard!
              </span>
            </div>
          )}

          {usedWords.size > 0 && (
            <div className="mt-4 mb-4">
              <h3 className="text-sm font-medium mb-2">Words Found:</h3>
              <div className="flex flex-wrap gap-2 justify-center max-h-48 overflow-y-auto">
                {Array.from(usedWords).map((word) => (
                  <Badge key={word} variant="secondary" data-testid={`badge-word-${word}`}>
                    {word}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <WordExamplesPanel
            game="no-repeats"
            letters={requiredLetters}
            challenge={challenge}
            limit={12}
            buttonLabel={`See ${challenge}-letter isogram examples`}
            className="text-left"
          />

          {!locked && (
            <>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={onPlayAgain}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                  data-testid="button-play-again"
                >
                  Play Again
                </Button>
                <Button
                  onClick={onMenu}
                  className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                  data-testid="button-main-menu"
                >
                  Main Menu
                </Button>
                <TryAnotherGameButton currentSlug="no-repeats" />
              </div>
              {nextChallenge && gameStatus === "won" && (
                <div className="flex justify-center mt-2">
                  <Button
                    onClick={onNextChallenge}
                    className="gap-2"
                    variant="outline"
                    data-testid="button-next-challenge"
                  >
                    Next Challenge
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
