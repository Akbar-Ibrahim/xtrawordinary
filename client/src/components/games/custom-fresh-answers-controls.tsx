import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import type { CustomFreshAnswerSnapshot } from "@/lib/custom-fresh-answers";
import { CustomFreshAnswersList } from "./custom-fresh-answers-list";

interface CustomFreshAnswerControlsProps {
  game: string;
  gameSlug: string;
  answerCount: number;
  snapshot: CustomFreshAnswerSnapshot | null;
  isAvailable: boolean;
  isEnabled: boolean;
  optedOutForCurrentRun: boolean;
  storageError: boolean;
  pendingAppendCount?: number;
  onRetryAppend?: () => void;
  allowOptIn?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onEnable: () => void;
  isCustomPlay?: boolean;
}

export function CustomFreshAnswerControls({
  game,
  gameSlug,
  answerCount,
  snapshot,
  isAvailable,
  isEnabled,
  optedOutForCurrentRun,
  storageError,
  pendingAppendCount = 0,
  onRetryAppend,
  allowOptIn = false,
  onEnabledChange,
  onEnable,
  isCustomPlay = true,
}: CustomFreshAnswerControlsProps) {
  if (!isAvailable) return null;

  if (snapshot) {
    return (
      <FreshAnswerToggle
        game={game}
        gameSlug={gameSlug}
        isCustomPlay={isCustomPlay}
        words={snapshot.words}
        enabled={isEnabled}
        storageError={storageError}
        pendingAppendCount={pendingAppendCount}
        onRetryAppend={onRetryAppend}
        onEnabledChange={onEnabledChange}
      />
    );
  }

  if (!allowOptIn || optedOutForCurrentRun || answerCount === 0) return null;

  return (
    <FreshAnswerOptIn
      game={game}
      gameSlug={gameSlug}
      isCustomPlay={isCustomPlay}
      answerCount={answerCount}
      storageError={storageError}
      onSave={onEnable}
    />
  );
}

interface FreshAnswerToggleProps {
  game: string;
  gameSlug: string;
  words: readonly string[];
  enabled: boolean;
  storageError: boolean;
  pendingAppendCount?: number;
  onRetryAppend?: () => void;
  isCustomPlay?: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export function FreshAnswerToggle({
  game,
  gameSlug,
  words,
  enabled,
  storageError,
  pendingAppendCount = 0,
  onRetryAppend,
  isCustomPlay = true,
  onEnabledChange,
}: FreshAnswerToggleProps) {
  const answerCount = words.length;
  if (answerCount === 0) return null;

  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
      data-testid={`custom-fresh-answers-${gameSlug}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">Fresh Answers</p>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? `Avoiding ${answerCount} saved answer${answerCount === 1 ? "" : "s"}. New answers from this run will be added automatically.`
            : "Previous-round answers are allowed again."}
        </p>
        {storageError && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {pendingAppendCount > 0
              ? "New answers from this run weren’t saved. Your existing saved answers are unchanged."
              : "Couldn’t update the saved answers in this browser."}
          </p>
        )}
        {pendingAppendCount > 0 && onRetryAppend && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 h-8"
            onClick={onRetryAppend}
            data-testid={`button-retry-fresh-answers-${gameSlug}`}
          >
            Retry saving {pendingAppendCount} new answer{pendingAppendCount === 1 ? "" : "s"}
          </Button>
        )}
        <CustomFreshAnswersList game={game} words={words} isCustomPlay={isCustomPlay} />
      </div>
      <Switch
        className="mt-1"
        checked={enabled}
        onCheckedChange={onEnabledChange}
        aria-label={`Fresh Answers for ${isCustomPlay ? "Custom " : ""}${game}`}
        data-testid={`switch-fresh-answers-${gameSlug}`}
      />
    </div>
  );
}

interface FreshAnswerOptInProps {
  game: string;
  gameSlug: string;
  answerCount: number;
  storageError: boolean;
  isCustomPlay?: boolean;
  onSave: () => void;
}

export function FreshAnswerOptIn({
  game,
  gameSlug,
  answerCount,
  storageError,
  isCustomPlay = true,
  onSave,
}: FreshAnswerOptInProps) {
  if (answerCount === 0) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-left space-y-2">
      <p className="text-sm font-medium">
        Enable Fresh Answers for {isCustomPlay ? "Custom " : ""}{game}?
      </p>
      <p className="text-xs text-muted-foreground">
        Save {answerCount === 1 ? "this accepted answer" : `these ${answerCount} accepted answers`} for future runs. Answers from later runs will be added automatically until you turn this off.
      </p>
      <p className="text-xs text-muted-foreground">
        Saved in this browser only. You can turn this off during the next run.
      </p>
      <Button
        type="button"
        size="sm"
        className="h-auto min-h-9 w-full whitespace-normal py-2 text-center leading-tight sm:w-auto"
        onClick={onSave}
        data-testid={`button-save-fresh-answers-${gameSlug}`}
      >
        <Check className="mr-2 h-4 w-4 shrink-0" />
        Enable Fresh Answers
      </Button>
      {storageError && (
        <p className="text-xs text-destructive" role="alert">
          Couldn’t save the answers in this browser. Check its storage settings and try again.
        </p>
      )}
    </div>
  );
}
