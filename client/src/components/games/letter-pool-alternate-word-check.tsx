import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canFormWordFromLetters } from "@shared/letter-pool";

interface LetterPoolAlternateWordCheckProps {
  targetWord: string;
  poolLetters: string[];
  disabled?: boolean;
}

export function LetterPoolAlternateWordCheck({
  targetWord,
  poolLetters,
  disabled = false,
}: LetterPoolAlternateWordCheckProps) {
  const [candidate, setCandidate] = useState("");
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const checkWord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const word = candidate.trim().toUpperCase();
    if (!word || isChecking) return;

    setMessage("");
    if (word === targetWord.toUpperCase()) {
      setMessage("That is the target word. Spell it with the pool letters to solve the round.");
      return;
    }
    if (
      word.length !== targetWord.length ||
      !canFormWordFromLetters(word, poolLetters)
    ) {
      setMessage("That word does not fit the letters in this pool.");
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch(
        `/api/games/validate-word?word=${encodeURIComponent(word)}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        throw new Error(`Word validation failed (${response.status})`);
      }

      const result = (await response.json()) as { exists?: boolean };
      setMessage(
        result.exists
          ? `Good find! ${word} is a valid word from this pool, but it is not this round's target.`
          : "That letter combination is not in the dictionary.",
      );
    } catch {
      setMessage("Could not check that word right now. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={checkWord}
      aria-label="Check another word from the letter pool"
    >
      <Input
        value={candidate}
        onChange={(event) => {
          setCandidate(event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase());
          setMessage("");
        }}
        onKeyDown={(event) => event.stopPropagation()}
        placeholder={`${targetWord.length}-letter word from the pool`}
        maxLength={targetWord.length}
        aria-label="Try another word from this pool"
        className="font-mono uppercase tracking-wider"
        disabled={isChecking || disabled}
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!candidate.trim() || isChecking || disabled}
      >
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Check word"
        )}
      </Button>
      {message && (
        <p className="text-xs text-muted-foreground sm:basis-full" aria-live="polite">
          {message}
        </p>
      )}
    </form>
  );
}
