import { useCallback, useMemo, useRef, useState } from "react";
import {
  appendCustomFreshAnswerSnapshot,
  clearCustomFreshAnswerSnapshot,
  enableCustomFreshAnswerSnapshot,
  normalizeFreshAnswerWords,
  readCustomFreshAnswerSnapshot,
  saveCustomFreshAnswerSnapshot,
  type CustomFreshAnswerGame,
  type CustomFreshAnswerSnapshot,
} from "@/lib/custom-fresh-answers";

interface UseCustomFreshAnswersOptions {
  game: CustomFreshAnswerGame;
  userId?: number | string;
  eligible: boolean;
}

export function useCustomFreshAnswers({
  game,
  userId,
  eligible,
}: UseCustomFreshAnswersOptions) {
  const isAvailable = eligible && userId !== undefined && userId !== null;
  const [scope, setScope] = useState({ game, userId, eligible });
  const [storedSnapshot, setSnapshot] = useState<CustomFreshAnswerSnapshot | null>(() =>
    isAvailable ? readCustomFreshAnswerSnapshot(userId!, game) : null,
  );
  const [currentRunAnswers, setCurrentRunAnswers] = useState<Set<string>>(new Set());
  const pendingAppendWords = useRef<string[]>([]);
  const [pendingAppendCount, setPendingAppendCount] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [optedOutForCurrentRun, setOptedOutForCurrentRun] = useState(false);
  const scopeMatches = scope.game === game && scope.userId === userId && scope.eligible === eligible;
  // Never expose a previous account/game's words, even during a scope-change render.
  const snapshot = isAvailable && scopeMatches ? storedSnapshot : null;
  const savedWordSet = useMemo(() => new Set(snapshot?.words ?? []), [snapshot]);

  // Reset before React commits children rather than waiting for an effect.
  if (!scopeMatches) {
    setScope({ game, userId, eligible });
    setSnapshot(isAvailable ? readCustomFreshAnswerSnapshot(userId!, game) : null);
    setCurrentRunAnswers(new Set());
    pendingAppendWords.current = [];
    setPendingAppendCount(0);
    setStorageError(false);
    setOptedOutForCurrentRun(false);
  }

  const isBlocked = useCallback((word: string) => {
    return isAvailable && snapshot?.enabled === true && savedWordSet.has(word.trim().toUpperCase());
  }, [isAvailable, savedWordSet, snapshot?.enabled]);

  const setEnabled = useCallback((enabled: boolean) => {
    if (!isAvailable || userId === undefined || userId === null || !snapshot) return false;

    if (!enabled) {
      if (!clearCustomFreshAnswerSnapshot(userId, game)) {
        setStorageError(true);
        return false;
      }

      setSnapshot(null);
      pendingAppendWords.current = [];
      setPendingAppendCount(0);
      setOptedOutForCurrentRun(true);
      setStorageError(false);
      return true;
    }

    const updated = enableCustomFreshAnswerSnapshot(userId, game);
    if (!updated) {
      setStorageError(true);
      return false;
    }
    setSnapshot(updated);
    setStorageError(false);
    return true;
  }, [game, isAvailable, snapshot, userId]);

  const optInWithAnswers = useCallback((words: Iterable<string>) => {
    if (!isAvailable || userId === undefined || userId === null || optedOutForCurrentRun) return false;

    const saved = saveCustomFreshAnswerSnapshot(userId, game, words);
    if (!saved) {
      setStorageError(true);
      return false;
    }

    setSnapshot(saved);
    setOptedOutForCurrentRun(false);
    setStorageError(false);
    return true;
  }, [game, isAvailable, optedOutForCurrentRun, userId]);

  const retryPendingAppend = useCallback(() => {
    const wordsToAppend = pendingAppendWords.current;
    if (!isAvailable || userId === undefined || userId === null || !snapshot?.enabled || wordsToAppend.length === 0) {
      return false;
    }

    const updated = appendCustomFreshAnswerSnapshot(userId, game, wordsToAppend);
    if (!updated) {
      setStorageError(true);
      return false;
    }

    setSnapshot(updated);
    pendingAppendWords.current = [];
    setPendingAppendCount(0);
    setStorageError(false);
    return true;
  }, [game, isAvailable, snapshot?.enabled, userId]);

  const appendAnswersFromRun = useCallback((words: Iterable<string>) => {
    if (!isAvailable || userId === undefined || userId === null || !snapshot?.enabled) return false;

    const wordsToAppend = normalizeFreshAnswerWords([...pendingAppendWords.current, ...words]);
    const updated = appendCustomFreshAnswerSnapshot(userId, game, wordsToAppend);
    if (!updated) {
      pendingAppendWords.current = normalizeFreshAnswerWords([...pendingAppendWords.current, ...wordsToAppend]);
      setPendingAppendCount(pendingAppendWords.current.length);
      setStorageError(true);
      return false;
    }

    setSnapshot(updated);
    pendingAppendWords.current = [];
    setPendingAppendCount(0);
    setStorageError(false);
    return true;
  }, [game, isAvailable, snapshot?.enabled, userId]);

  const recordAcceptedAnswer = useCallback((word: string) => {
    if (!isAvailable) return;
    const normalized = word.trim().toUpperCase();
    if (!normalized) return;
    setCurrentRunAnswers((previous) => new Set(previous).add(normalized));
  }, [isAvailable]);

  const resetCurrentRun = useCallback(() => {
    setCurrentRunAnswers(new Set());
    setOptedOutForCurrentRun(false);
  }, []);

  const optInWithCurrentRunAnswers = useCallback(() => {
    if (pendingAppendWords.current.length > 0) return retryPendingAppend();
    return optInWithAnswers(currentRunAnswers);
  }, [currentRunAnswers, optInWithAnswers, retryPendingAppend]);

  const appendCurrentRunAnswers = useCallback(() => {
    return appendAnswersFromRun(currentRunAnswers);
  }, [appendAnswersFromRun, currentRunAnswers]);

  const setEnabledWithRetry = useCallback((enabled: boolean) => {
    if (enabled && snapshot?.enabled && pendingAppendWords.current.length > 0) {
      return retryPendingAppend();
    }
    return setEnabled(enabled);
  }, [retryPendingAppend, setEnabled, snapshot?.enabled]);

  return {
    snapshot,
    currentRunAnswers,
    isAvailable,
    isEnabled: isAvailable && snapshot?.enabled === true,
    optedOutForCurrentRun,
    isBlocked,
    setEnabled: setEnabledWithRetry,
    optInWithAnswers,
    appendAnswersFromRun,
    recordAcceptedAnswer,
    resetCurrentRun,
    optInWithCurrentRunAnswers,
    appendCurrentRunAnswers,
    retryPendingAppend,
    pendingAppendCount,
    storageError,
  };
}
