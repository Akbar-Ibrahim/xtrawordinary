import { useState, useRef, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { readExploreJson } from "./api";
import type { CheckResponse } from "../types";

interface Props {
  baseWord: string;
}

export function HostAnswerDesk({ baseWord }: Props) {
  const [answer, setAnswer] = useState("");
  const [lastCheck, setLastCheck] = useState<{ word: string; result: CheckResponse } | null>(null);
  const [checkedWords, setCheckedWords] = useState<string[]>([]);
  const answerRef = useRef<HTMLInputElement>(null);
  const checkMutation = useMutation({
    mutationFn: (word: string) => readExploreJson<CheckResponse>("/api/explore/anagrams/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseWord, answer: word }),
    }),
    onSuccess: (result, word) => {
      setLastCheck({ word, result });
      if (result.valid) setCheckedWords((previous) => previous.includes(word) ? previous : [...previous, word]);
      setAnswer("");
      answerRef.current?.focus();
    },
  });
  const duplicate = checkedWords.includes(answer.trim().toUpperCase());

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = answer.trim().toUpperCase();
    if (!candidate || checkMutation.isPending || duplicate) return;
    setLastCheck(null);
    checkMutation.mutate(candidate);
  }

  return (
    <div className="wmx-host-card">
      <div className="wmx-host-top">
        <div>
          <h3>Host’s answer desk</h3>
          <p>Players say answers aloud. Check each one against the exact-letter word list shown here. Players do not need to use the app.</p>
        </div>
        <span className="wmx-host-tag">HOST ONLY</span>
      </div>
      <form className="wmx-answer-form" onSubmit={submitAnswer}>
        <input
          ref={answerRef}
          value={answer}
          onChange={(event) => setAnswer(event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
          placeholder="Type a spoken answer"
          aria-label="Check a spoken anagram answer"
          autoComplete="off"
          style={{ textTransform: "uppercase" }}
        />
        <button type="submit" disabled={!answer.trim() || checkMutation.isPending || duplicate}>
          {checkMutation.isPending ? "Checking…" : "Check answer"}
        </button>
      </form>
      <div
        className={`wmx-check-result${lastCheck ? (lastCheck.result.valid ? " good" : " bad") : checkMutation.isError ? " bad" : ""}`}
        role="status"
        aria-live="polite"
      >
        {duplicate
          ? "Already checked as a valid answer in this session."
          : checkMutation.isPending
            ? "Checking the anagram list…"
            : lastCheck
              ? lastCheck.result.valid
                ? `${lastCheck.word} is a listed anagram of ${baseWord}.`
                : `${lastCheck.word} is not listed as an anagram of ${baseWord}.`
              : checkMutation.isError
                ? "The check could not be completed. Try again."
                : "Answers use exactly the same letters as the base word."}
      </div>
      {checkedWords.length > 0 && (
        <div className="wmx-session">
          <h3>Valid answers checked · {checkedWords.length}</h3>
          <div className="wmx-session-list">
            {checkedWords.map((word) => (
              <span className="wmx-session-word" key={word}>{word} <small>VALID</small></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
