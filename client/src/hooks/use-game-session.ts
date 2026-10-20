import { useCallback, useRef, useState } from "react";

export function useGameSession() {
  const currentSessionRef = useRef(0);
  const activeRef = useRef(false);
  const [sessionId, setSessionId] = useState(0);

  const startSession = useCallback(() => {
    const nextSession = currentSessionRef.current + 1;
    currentSessionRef.current = nextSession;
    activeRef.current = true;
    setSessionId(nextSession);
    return nextSession;
  }, []);

  const endSession = useCallback((id = currentSessionRef.current) => {
    if (id !== currentSessionRef.current || !activeRef.current) return false;
    activeRef.current = false;
    return true;
  }, []);

  const invalidateSession = useCallback(() => {
    activeRef.current = false;
    const nextSession = currentSessionRef.current + 1;
    currentSessionRef.current = nextSession;
    setSessionId(nextSession);
  }, []);

  const isCurrentSession = useCallback(
    (id: number) => id === currentSessionRef.current,
    [],
  );

  const isSessionActive = useCallback(
    (id: number) => id === currentSessionRef.current && activeRef.current,
    [],
  );

  return {
    sessionId,
    startSession,
    endSession,
    invalidateSession,
    isCurrentSession,
    isSessionActive,
  };
}
