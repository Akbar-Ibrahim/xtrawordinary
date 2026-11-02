import { ArrowLeft, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVariantSummary } from "@/lib/variant-summary";
import { getWordStackQuizLengthLabel, normalizeWordStackQuizLength } from "@/lib/word-stack-quiz";

interface DefinitionReviewEntry {
  word: string;
  partOfSpeech: string;
  definitions: [string, string, string];
}

interface QuizReviewStepProps {
  gameName: string;
  gameSlug: string;
  title: string;
  description: string;
  closesAt: string;
  params: Record<string, any>;
  definitionEntries?: DefinitionReviewEntry[];
  isCreating: boolean;
  onBack: () => void;
  onCreate: () => void;
}

function hasPinnedChallenge(slug: string, params: Record<string, any>): boolean {
  switch (slug) {
    case "word-length":
      return Boolean(params.length || params.variation);
    case "letter-position":
      return Boolean(params.letter && params.position);
    case "letter-hunt":
      return Boolean(params.challenge || params.position || params.letter ||
        (Array.isArray(params.letters) && params.letters.some((letter: string) => letter && letter !== "any")));
    case "letter-frequency":
      return Boolean(params.challenge || params.rank || params.letter ||
        (Array.isArray(params.letters) && params.letters.some((letter: string) => letter && letter !== "any")));
    case "letter-balance":
      return params.vowels !== undefined || params.consonants !== undefined || params.category !== undefined;
    case "letter-pool":
      return params.decoyCount !== undefined || Array.isArray(params.words);
    case "letter-dodge":
      return params.difficulty !== undefined ||
        (Array.isArray(params.letters) && params.letters.some((letter: string) => letter && letter !== "any"));
    case "definition-match":
    case "progressive-reveal":
    case "anagram-solver":
    case "word-scramble":
      return Array.isArray(params.words);
    case "word-roots":
      return params.wrSeed !== undefined;
    case "word-stack":
      return params.challenge === "build-up" || params.challenge === "break-down";
    case "no-repeats":
      return params.challenge !== undefined || Array.isArray(params.requiredLetters);
    default:
      return false;
  }
}

function getSettingsSummary(slug: string, params: Record<string, any>): string {
  if (slug === "word-stack") {
    const length = getWordStackQuizLengthLabel(normalizeWordStackQuizLength(params.puzzleCount));
    if (params.challenge === "build-up" || params.challenge === "break-down") {
      return getVariantSummary(slug, 0, params) ?? length;
    }
    return `${length} · A shared challenge and puzzle order will be selected.`;
  }

  if (slug === "no-repeats") {
    const settings = ["No Repeats"];
    if (params.challenge !== undefined) settings.push(`${params.challenge}-letter challenge`);
    const requiredLetters = Array.isArray(params.requiredLetters) ? params.requiredLetters.join(", ") : "";
    if (requiredLetters) settings.push(`Required: ${requiredLetters}`);
    if (settings.length > 1) return settings.join(" · ");
  }

  if (hasPinnedChallenge(slug, params)) {
    const summary = getVariantSummary(slug, 0, params);
    if (summary) return summary;
  }

  const details = ["A shared challenge will be selected using this game's standard rules."];
  if (params.wordCount !== undefined) {
    details.push(`${params.wordCount} words`);
  }
  const timeLimit = params.timeLimit ?? params.timeLimitSeconds;
  if (typeof timeLimit === "number") {
    details.push(timeLimit >= 60 ? `${Math.round(timeLimit / 60)} min per round` : `${timeLimit}s per round`);
  }
  if (params.survival === true) details.push("Survival");
  return details.join(" · ");
}

function formatCloseDate(value: string): string {
  if (!value) return "No closing date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString();
}

export function QuizReviewStep({
  gameName,
  gameSlug,
  title,
  description,
  closesAt,
  params,
  definitionEntries = [],
  isCreating,
  onBack,
  onCreate,
}: QuizReviewStepProps) {
  return (
    <div className="space-y-4" data-testid="quiz-review-step">
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" variant="ghost" onClick={onBack} className="gap-1.5" data-testid="button-quiz-review-back">
          <ArrowLeft className="h-4 w-4" />
          Edit
        </Button>
        <h3 className="text-sm font-semibold mx-auto">Review your quiz</h3>
        <span className="w-14" aria-hidden="true" />
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Quiz title</p>
          <p className="font-semibold text-sm">{title || "Untitled Quiz"}</p>
        </div>
        {description && (
          <div>
            <p className="text-xs text-muted-foreground">Instructions</p>
            <p className="text-sm whitespace-pre-wrap">{description}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Game</p>
          <p className="text-sm font-medium">{gameName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Game settings</p>
          <p className="text-sm">{getSettingsSummary(gameSlug, params)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Submissions close</p>
          <p className="text-sm">{formatCloseDate(closesAt)}</p>
        </div>
      </div>

      {definitionEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Words and clues</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {definitionEntries.map((entry, index) => (
              <div key={`${entry.word}-${index}`} className="rounded-lg border p-3 space-y-1.5" data-testid={`quiz-review-entry-${index}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase tracking-wide">{entry.word}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.partOfSpeech}</span>
                </div>
                <div className="space-y-1">
                  {entry.definitions.map((definition, clueIndex) => (
                    <div
                      key={clueIndex}
                      className={`text-xs px-2 py-1 rounded ${
                        clueIndex === 0
                          ? "bg-primary/5 text-primary"
                          : clueIndex === 1
                            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      <span className="font-semibold mr-1">C{clueIndex + 1}:</span>{definition}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        Players need to sign in to submit a score. Each player’s first submitted score is kept; replaying won’t replace it.
      </div>

      <Button className="w-full gap-2" onClick={onCreate} disabled={isCreating} data-testid="button-quiz-review-create">
        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
        Create Session
      </Button>
    </div>
  );
}
