import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

export type UnseenChallenge = {
  id: number;
  challengeeId: number | null;
  challengeeName: string | null;
  challengeeAvatarUrl?: string | null;
  gameSlug: string;
  startWord: string | null;
  roomCode: string;
};

type DuelNotificationsContextValue = {
  unseenChallenges: UnseenChallenge[];
  unseenCount: number;
  newlyAccepted: UnseenChallenge[];
  dismiss: (id: number) => void;
  dismissAll: () => void;
};

const DuelNotificationsContext = createContext<DuelNotificationsContextValue>({
  unseenChallenges: [],
  unseenCount: 0,
  newlyAccepted: [],
  dismiss: () => {},
  dismissAll: () => {},
});

type OutgoingChallenge = {
  id: number;
  challengeeId: number | null;
  challengeeName: string | null;
  challengeeAvatarUrl?: string | null;
  status: string;
  gameSlug: string;
  startWord: string | null;
  roomCode: string | null;
};

const VISITED_KEY_PREFIX = "duel_visited_rooms";

function visitedKey(userId: number | undefined): string {
  return userId != null ? `${VISITED_KEY_PREFIX}:${userId}` : VISITED_KEY_PREFIX;
}

function getVisitedRooms(userId: number | undefined): Set<string> {
  try {
    const raw = sessionStorage.getItem(visitedKey(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveVisitedRooms(rooms: Set<string>, userId: number | undefined) {
  try {
    sessionStorage.setItem(visitedKey(userId), JSON.stringify(Array.from(rooms)));
  } catch {
    // ignore
  }
}

export function DuelNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const visitedRoomsRef = useRef<Set<string>>(getVisitedRooms(userId));

  const prevStatusMapRef = useRef<Map<number, { status: string; challengeeId: number | null }>>(new Map());
  const [newlyAccepted, setNewlyAccepted] = useState<UnseenChallenge[]>([]);
  const [extraDismissed, setExtraDismissed] = useState<Set<number>>(new Set());

  const { data: outgoingChallenges = [] } = useQuery<OutgoingChallenge[]>({
    queryKey: ["/api/duels/challenges/outgoing"],
    queryFn: async () => {
      const res = await fetch("/api/duels/challenges?type=outgoing", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<OutgoingChallenge[]>;
    },
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      prevStatusMapRef.current.clear();
      setNewlyAccepted([]);
      setExtraDismissed(new Set());
      visitedRoomsRef.current = new Set();
    } else {
      visitedRoomsRef.current = getVisitedRooms(userId);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    const prevMap = prevStatusMapRef.current;
    const toasts: UnseenChallenge[] = [];

    for (const c of outgoingChallenges) {
      const prev = prevMap.get(c.id);
      const wasOpen = prev?.challengeeId === null;
      if (
        prev?.status === "pending" &&
        c.status === "accepted" &&
        wasOpen &&
        c.roomCode !== null &&
        !visitedRoomsRef.current.has(c.roomCode)
      ) {
        toasts.push({
          id: c.id,
          challengeeId: c.challengeeId,
          challengeeName: c.challengeeName,
          challengeeAvatarUrl: c.challengeeAvatarUrl,
          gameSlug: c.gameSlug,
          startWord: c.startWord,
          roomCode: c.roomCode,
        });
      }
    }

    prevStatusMapRef.current = new Map(
      outgoingChallenges.map((c) => [c.id, { status: c.status, challengeeId: c.challengeeId }])
    );

    if (toasts.length > 0) {
      setNewlyAccepted((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const fresh = toasts.filter((c) => !existingIds.has(c.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    }
  }, [outgoingChallenges]);

  useEffect(() => {
    const match = /^\/duel\/(.+)$/.exec(location);
    if (!match) return;
    const roomCode = match[1];
    visitedRoomsRef.current.add(roomCode);
    saveVisitedRooms(visitedRoomsRef.current, userId);
    setNewlyAccepted((prev) => prev.filter((c) => c.roomCode !== roomCode));
  }, [location, userId]);

  const unseenChallenges: UnseenChallenge[] = outgoingChallenges
    .filter(
      (c) =>
        c.status === "accepted" &&
        c.roomCode !== null &&
        !visitedRoomsRef.current.has(c.roomCode) &&
        !extraDismissed.has(c.id)
    )
    .map((c) => ({
      id: c.id,
      challengeeId: c.challengeeId,
      challengeeName: c.challengeeName,
      challengeeAvatarUrl: c.challengeeAvatarUrl,
      gameSlug: c.gameSlug,
      startWord: c.startWord,
      roomCode: c.roomCode as string,
    }));

  function dismiss(id: number) {
    const challenge = unseenChallenges.find((c) => c.id === id);
    if (challenge) {
      visitedRoomsRef.current.add(challenge.roomCode);
      saveVisitedRooms(visitedRoomsRef.current, userId);
    }
    setNewlyAccepted((prev) => prev.filter((c) => c.id !== id));
    setExtraDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function dismissAll() {
    unseenChallenges.forEach((c) => {
      visitedRoomsRef.current.add(c.roomCode);
    });
    saveVisitedRooms(visitedRoomsRef.current, userId);
    setNewlyAccepted([]);
    setExtraDismissed((prev) => {
      const next = new Set(prev);
      unseenChallenges.forEach((c) => next.add(c.id));
      return next;
    });
  }

  return (
    <DuelNotificationsContext.Provider
      value={{
        unseenChallenges,
        unseenCount: unseenChallenges.length,
        newlyAccepted,
        dismiss,
        dismissAll,
      }}
    >
      {children}
    </DuelNotificationsContext.Provider>
  );
}

export function useDuelNotifications() {
  return useContext(DuelNotificationsContext);
}
