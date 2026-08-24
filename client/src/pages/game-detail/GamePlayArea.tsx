import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Swords, Sparkles, Loader2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { LetterPositionGame } from "@/components/games/letter-position";
import { LetterHuntGame } from "@/components/games/letter-hunt";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { WordLengthGame } from "@/components/games/word-length";
import { LetterDodgeGame } from "@/components/games/letter-dodge";
import { WordChainGame } from "@/components/games/word-chain";
import { WordLadderGame } from "@/components/games/word-ladder";
import { WordScrambleGame } from "@/components/games/word-scramble";
import { NoRepeatsGame } from "@/components/games/no-repeats";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { LadderRushGame } from "@/components/games/ladder-rush";
import { ShellWordsGame } from "@/components/games/shell-words";
import { DeepShellWordsGame } from "@/components/games/deep-shell-words";
import { WordRootsGame } from "@/components/games/word-roots";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { ProgressiveRevealGame } from "@/components/games/progressive-reveal";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { WordSweepGame } from "@/components/games/word-sweep";
import { WordBloomGame } from "@/components/games/word-bloom";
import { WordExtensionGame } from "@/components/games/word-extension";
import { WordStretchGame } from "@/components/games/word-stretch";
import { FriendChallengeCard } from "./FriendChallengeCard";
import { gameComponents } from "./constants";
import type { Game, FriendChallenge } from "@shared/schema";
import type { ChallengeResult } from "./constants";

interface Friend {
  id: number;
  friendUser: { id: number; name: string; avatarUrl: string | null };
}

interface Props {
  game: Game;
  slug: string;
  onExit: () => void;
  isSenderMode: boolean;
  isReceiverMode: boolean;
  challengeNewFriendId: string | null;
  challengeNewMsg: string | null;
  challengeNewLbCategory: string | null;
  challengeNewLbLevel: string | null;
  challengeNewLbConsonantCount: string | null;
  receiverChallenge: FriendChallenge | undefined;
  challengeLoading: boolean;
  challengeError: boolean;
  urlCleaned: boolean;
  effectiveGroupSeed: number | undefined;
  friends: Friend[];
  challengeResult: ChallengeResult | null;
  isTied: boolean;
  opponentName: string | undefined;
  isSubmitting: boolean;
  isCustomPlay: boolean;
  customPlayFrozenParams: Record<string, any>;
  customPlayKey: number;
  onCustomPlayEnd: () => void;
  onCustomPlayAgain: () => void;
  isUntimed: boolean;
}

export function GamePlayArea({
  game,
  slug,
  onExit,
  isSenderMode,
  isReceiverMode,
  challengeNewFriendId,
  challengeNewMsg,
  challengeNewLbCategory,
  challengeNewLbLevel,
  challengeNewLbConsonantCount,
  receiverChallenge,
  challengeLoading,
  challengeError,
  urlCleaned,
  effectiveGroupSeed,
  friends,
  challengeResult,
  isTied,
  opponentName,
  isSubmitting,
  isCustomPlay,
  customPlayFrozenParams,
  customPlayKey,
  onCustomPlayEnd,
  onCustomPlayAgain,
  isUntimed,
}: Props) {
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;
  const GameComponent = gameComponents[slug];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: game.color }}
          >
            <IconComponent className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-semibold">{game.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExit}
            className="gap-1.5"
            data-testid="button-close-game"
          >
            <X className="h-4 w-4" />
            Exit Game
          </Button>
        </div>
      </div>

      {isSenderMode && !challengeResult && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Swords className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm flex items-center gap-1.5" data-testid="text-challenge-mode-title">
                {(() => {
                  const friend = friends.find(f => String(f.friendUser.id) === challengeNewFriendId);
                  if (!friend) return "Challenge Mode";
                  return (
                    <>
                      Challenging{" "}
                      <UserAvatar name={friend.friendUser.name} avatarUrl={friend.friendUser.avatarUrl} className="h-5 w-5 inline-block align-middle" />
                      {friend.friendUser.name}
                    </>
                  );
                })()}
              </p>
              <p className="text-xs text-muted-foreground">
                Play your best — your score will be sent as a challenge when you finish!
                {challengeNewMsg && ` "${challengeNewMsg}"`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isReceiverMode && receiverChallenge && receiverChallenge.status === "pending" && !challengeResult && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Swords className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm flex items-center gap-1.5" data-testid="text-challenge-banner-title">
                Challenged by{" "}
                <UserAvatar name={receiverChallenge.senderName ?? "Challenger"} avatarUrl={receiverChallenge.senderAvatarUrl} className="h-5 w-5 inline-block align-middle" />
                {receiverChallenge.senderName ?? "a friend"}
              </p>
              <p className="text-xs text-muted-foreground">
                Score to beat: <strong>{receiverChallenge.senderScore} pts</strong>
                {receiverChallenge.message && ` — "${receiverChallenge.message}"`}
                {receiverChallenge.seed != null && " · Same puzzle as your friend"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isCustomPlay && (
        <Card className="mb-4 border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium text-sm text-amber-700 dark:text-amber-400">Custom Play Mode</p>
              <p className="text-xs text-muted-foreground">Scores are not saved to the leaderboard in custom play.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isUntimed && (
        <Card className="mb-4 border-blue-400/50 bg-blue-50/50 dark:bg-blue-950/10">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <span className="text-xl text-blue-500 shrink-0 font-bold leading-none">∞</span>
            <div>
              <p className="font-medium text-sm text-blue-700 dark:text-blue-400">Untimed Mode</p>
              <p className="text-xs text-muted-foreground">No timer — play at your own pace. Scores are tracked but not submitted to the global leaderboard.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isSubmitting && (
        <Card className="mb-4 border-muted">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Submitting your score...</p>
          </CardContent>
        </Card>
      )}

      {challengeResult && (
        <FriendChallengeCard
          challengeResult={challengeResult}
          isTied={isTied}
          opponentName={opponentName}
          receiverChallenge={receiverChallenge}
          challengeNewFriendId={challengeNewFriendId}
          friends={friends}
          slug={slug}
          challengeNewLbCategory={challengeNewLbCategory}
          challengeNewLbLevel={challengeNewLbLevel}
          challengeNewLbConsonantCount={challengeNewLbConsonantCount}
          isReceiverMode={isReceiverMode}
        />
      )}

      {isReceiverMode && challengeError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium mb-2">Challenge not found</p>
            <p className="text-sm text-muted-foreground mb-4">This challenge may have expired or you may not have permission to view it.</p>
          </CardContent>
        </Card>
      ) : isReceiverMode && (challengeLoading || !urlCleaned) ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading challenge...</p>
          </CardContent>
        </Card>
      ) : isCustomPlay && slug === "letter-position" ? (
        <LetterPositionGame
          key={customPlayKey}
          initialChallenge={(customPlayFrozenParams.letter && customPlayFrozenParams.position ? 1 : 2) as 1 | 2}
          initialLetter={customPlayFrozenParams.letter as string | undefined}
          initialPosition={customPlayFrozenParams.position ? Number(customPlayFrozenParams.position) : undefined}
          initialSurvival={customPlayFrozenParams.survival === true}
          initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
          initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
          onGameEnd={onCustomPlayEnd}
          onPlayAgain={onCustomPlayAgain}
          locked
          quizMode
          customPlay
        />
      ) : isCustomPlay && slug === "letter-hunt" ? (
        <LetterHuntGame
          key={customPlayKey}
          initialChallenge={(() => {
            const c = customPlayFrozenParams.challenge;
            if (c === undefined) return (Math.floor(Math.random() * 5) + 1) as 1 | 2 | 3 | 4 | 5;
            if (c === "advanced") return "advanced" as const;
            return Math.min(5, Math.max(1, Number(c) || 1)) as 1 | 2 | 3 | 4 | 5;
          })()}
          initialLetters={customPlayFrozenParams.letters as string[] | undefined}
          initialSurvival={customPlayFrozenParams.survival === true}
          initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
          initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
          onGameEnd={onCustomPlayEnd}
          onPlayAgain={onCustomPlayAgain}
          locked
          quizMode
          customPlay
        />
      ) : isCustomPlay && slug === "letter-frequency" ? (
        <LetterFrequencyGame
          key={customPlayKey}
          initialChallenge={(() => {
            const c = customPlayFrozenParams.challenge;
            if (c === undefined) {
              const auto = ([1, 2, 3, 4] as const)[Math.floor(Math.random() * 4)];
              return auto;
            }
            if (c === "multi") return "multi" as const;
            const n = Math.min(4, Math.max(1, Number(c) || 1));
            return n as 1 | 2 | 3 | 4;
          })()}
          initialLetter={customPlayFrozenParams.letter || undefined}
          initialLetters={Array.isArray(customPlayFrozenParams.letters) ? customPlayFrozenParams.letters : undefined}
          initialLetterCounts={Array.isArray(customPlayFrozenParams.letterCounts) ? customPlayFrozenParams.letterCounts as number[] : undefined}
          initialSurvival={customPlayFrozenParams.survival === true}
          initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
          initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
          onGameEnd={onCustomPlayEnd}
          onPlayAgain={onCustomPlayAgain}
          locked
          quizMode
          customPlay
        />
      ) : isCustomPlay && slug === "letter-balance" ? (
        <LetterBalanceGame
          key={customPlayKey}
          customConstraint={
            customPlayFrozenParams.vowels !== undefined || customPlayFrozenParams.consonants !== undefined
              ? { vowels: customPlayFrozenParams.vowels, consonants: customPlayFrozenParams.consonants, length: customPlayFrozenParams.length }
              : undefined
          }
          initialChallenge={
            customPlayFrozenParams.category !== undefined
              ? { category: customPlayFrozenParams.category, level: customPlayFrozenParams.level ?? 4, consonantCount: customPlayFrozenParams.consonantCount }
              : undefined
          }
          initialSurvival={customPlayFrozenParams.survival === true}
          initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
          initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
          onGameEnd={onCustomPlayEnd}
          onPlayAgain={onCustomPlayAgain}
          locked
          quizMode
          customPlay
        />
      ) : isCustomPlay && slug === "word-length" ? (
        <WordLengthGame
          key={customPlayKey}
          customConstraint={(customPlayFrozenParams.length as number | undefined) ? { length: customPlayFrozenParams.length as number, startsWith: customPlayFrozenParams.startsWith as string | undefined, endsWith: customPlayFrozenParams.endsWith as string | undefined, contains: customPlayFrozenParams.contains as string | undefined } : undefined}
          initialVariation={(customPlayFrozenParams.length as number | undefined) ? undefined : (Math.min(5, Math.max(1, Number(customPlayFrozenParams.variation) || 1)) as 1 | 2 | 3 | 4 | 5)}
          initialSurvival={customPlayFrozenParams.survival === true}
          initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
          initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
          onGameEnd={onCustomPlayEnd}
          onPlayAgain={onCustomPlayAgain}
          locked
          quizMode
          customPlay
        />
      ) : isCustomPlay && slug === "letter-dodge" ? (
        <LetterDodgeGame
          key={customPlayKey}
          initialDifficulty={(() => {
            const d = customPlayFrozenParams.difficulty;
            if (d === "advanced") return "advanced" as const;
            if (d !== undefined) return Math.min(5, Math.max(1, Number(d) || 1)) as 1 | 2 | 3 | 4 | 5;
            return undefined;
          })()}
          initialForbiddenLetters={customPlayFrozenParams.letters as string[] | undefined}
          initialSurvival={customPlayFrozenParams.survival === true}
          initialWordCount={!customPlayFrozenParams.survival ? customPlayFrozenParams.wordCount : undefined}
          initialTimeLimit={!customPlayFrozenParams.survival ? customPlayFrozenParams.timeLimit : undefined}
          onGameEnd={onCustomPlayEnd}
          onPlayAgain={onCustomPlayAgain}
          locked
          quizMode
          customPlay
        />
      ) : isCustomPlay && slug === "no-repeats" ? (
        <NoRepeatsGame
          key={customPlayKey}
          initialChallenge={(() => {
            const c = Number(customPlayFrozenParams.challenge);
            return (c >= 3 && c <= 9 ? c : undefined) as 3 | 4 | 5 | 6 | 7 | 8 | 9 | undefined;
          })()}
          initialRequiredLetters={Array.isArray(customPlayFrozenParams.requiredLetters) ? customPlayFrozenParams.requiredLetters as string[] : undefined}
          initialTimeLimit={!customPlayFrozenParams.survival ? (customPlayFrozenParams.timeLimit as number | undefined) : undefined}
          initialSurvival={customPlayFrozenParams.survival === true}
          onGameEnd={onCustomPlayEnd}
          onPlayAgain={onCustomPlayAgain}
          locked
          customPlay
        />
      ) : (isSenderMode || isReceiverMode) && slug === "letter-balance" ? (() => {
        const senderLbConfig = (challengeNewLbCategory === "locked_balance" && challengeNewLbLevel && challengeNewLbConsonantCount)
          ? { category: "locked_balance" as const, level: parseInt(challengeNewLbLevel), consonantCount: parseInt(challengeNewLbConsonantCount) }
          : undefined;
        const receiverLbConfig = (() => {
          if (!receiverChallenge?.gameConfig) return undefined;
          try {
            const cfg = JSON.parse(receiverChallenge.gameConfig);
            if (cfg?.category === "locked_balance" && cfg.level && cfg.consonantCount) {
              return { category: "locked_balance" as const, level: cfg.level as number, consonantCount: cfg.consonantCount as number };
            }
          } catch {}
          return undefined;
        })();
        const lbConfig = isSenderMode ? senderLbConfig : receiverLbConfig;
        return (
          <LetterBalanceGame
            initialChallenge={lbConfig}
            groupSeed={effectiveGroupSeed}
            locked
          />
        );
      })() : isUntimed && slug === "word-chain" ? (
        <WordChainGame isUntimed locked={isSenderMode || isReceiverMode} wordTarget={game.wordTarget ?? undefined} />
      ) : isUntimed && slug === "word-ladder" ? (
        <WordLadderGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "letter-hunt" ? (
        <LetterHuntGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "word-scramble" ? (
        <WordScrambleGame isUntimed locked={isSenderMode || isReceiverMode} livesCount={game.livesCount ?? undefined} />
      ) : isUntimed && slug === "no-repeats" ? (
        <NoRepeatsGame isUntimed groupSeed={receiverChallenge?.seed ?? undefined} locked={isSenderMode || isReceiverMode} wordTarget={game.wordTarget ?? undefined} />
      ) : isUntimed && slug === "ladder-rush" ? (
        <LadderRushGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "ladder-rush-double" ? (
        <LadderRushGame isUntimed doubleSwap locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "letter-dodge" ? (
        <LetterDodgeGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "shell-words" ? (
        <ShellWordsGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "deep-shell-words" ? (
        <DeepShellWordsGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "word-length" ? (
        <WordLengthGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "letter-position" ? (
        <LetterPositionGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "word-roots" ? (
        <WordRootsGame isUntimed locked={isSenderMode || isReceiverMode} wordTarget={game.wordTarget ?? undefined} />
      ) : isUntimed && slug === "letter-balance" ? (
        <LetterBalanceGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : isUntimed && slug === "letter-frequency" ? (
        <LetterFrequencyGame isUntimed locked={isSenderMode || isReceiverMode} />
      ) : slug === "anagram-solver" ? (
        <AnagramSolverGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          timeLimitSeconds={game.timeLimitSeconds ?? undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "no-repeats" ? (
        <NoRepeatsGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          initialTimeLimit={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          wordTarget={game.wordTarget ?? undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "word-roots" ? (
        <WordRootsGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          timeLimitSeconds={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
          wordTarget={game.wordTarget ?? undefined}
        />
      ) : slug === "word-scramble" ? (
        <WordScrambleGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          livesCount={game.livesCount ?? undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "ladder-rush" ? (
        <LadderRushGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          timeLimitSeconds={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "ladder-rush-double" ? (
        <LadderRushGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          doubleSwap
          timeLimitSeconds={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "letter-pool" ? (
        <LetterPoolGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          livesCount={game.livesCount ?? undefined}
        />
      ) : slug === "progressive-reveal" ? (
        <ProgressiveRevealGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          livesCount={game.livesCount ?? undefined}
        />
      ) : slug === "word-length" ? (
        <WordLengthGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          initialTimeLimit={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "letter-position" ? (
        <LetterPositionGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          initialTimeLimit={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "letter-hunt" ? (
        <LetterHuntGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          initialTimeLimit={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "letter-balance" ? (
        <LetterBalanceGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          initialTimeLimit={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "letter-frequency" ? (
        <LetterFrequencyGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          initialTimeLimit={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "letter-dodge" ? (
        <LetterDodgeGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          initialTimeLimit={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "shell-words" ? (
        <ShellWordsGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          timeLimitSeconds={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "deep-shell-words" ? (
        <DeepShellWordsGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          timeLimitSeconds={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "definition-match" ? (
        <DefinitionMatchGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          wordTarget={game.wordTarget ?? undefined}
          timeLimitSeconds={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "word-sweep" ? (
        <WordSweepGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          isUntimed={isUntimed}
        />
      ) : slug === "word-bloom" ? (
        <WordBloomGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          isUntimed={isUntimed}
        />
      ) : slug === "word-extension" ? (
        <WordExtensionGame
          locked={isSenderMode || isReceiverMode}
          timeLimitSeconds={!isUntimed ? (game.timeLimitSeconds ?? undefined) : undefined}
          isUntimed={isUntimed}
        />
      ) : slug === "word-stretch" ? (
        <WordStretchGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          isUntimed={isUntimed}
        />
      ) : slug === "word-chain" ? (
        <WordChainGame
          groupSeed={effectiveGroupSeed}
          locked={isSenderMode || isReceiverMode}
          wordTarget={game.wordTarget ?? undefined}
          isUntimed={isUntimed}
        />
      ) : GameComponent ? (
        <GameComponent groupSeed={effectiveGroupSeed} locked={isSenderMode || isReceiverMode} />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              This game is coming soon!
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
