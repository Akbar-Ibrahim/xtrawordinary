import { useCallback, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { recordGameResult, getPersonalBest, loadStats, loadStreak } from "@/lib/game-stats";
import type { Achievement } from "@/lib/game-stats";
import { useAuth } from "@/lib/auth-context";

interface GameResultOptions {
  slug: string;
  challengeId?: number;
}

async function syncToBackend(slug: string, score: number, won: boolean, wordsFound?: number) {
  try {
    const stats = loadStats();
    const gameStats = stats.perGame[slug];
    if (gameStats) {
      await fetch("/api/user/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gameSlug: slug,
          bestScore: gameStats.bestScore,
          gamesPlayed: gameStats.gamesPlayed,
          gamesWon: gameStats.gamesWon,
          wordsFound: gameStats.totalWordsFound,
        }),
      });
    }

    const streak = loadStreak();
    await fetch("/api/user/streak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(streak),
    });

    if (score > 0) {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gameSlug: slug, score }),
      });
    }
  } catch {}
}

export function useGameResult({ slug, challengeId: explicitChallengeId }: GameResultOptions) {
  const { toast } = useToast();
  const recordedRef = useRef(false);
  const { isAuthenticated } = useAuth();

  const challengeIdRef = useRef<number | undefined | null>(null);
  if (challengeIdRef.current === null) {
    challengeIdRef.current = explicitChallengeId ?? (() => {
      if (typeof window === "undefined") return undefined;
      const params = new URLSearchParams(window.location.search);
      const id = params.get("challenge");
      return id ? parseInt(id) : undefined;
    })();
  }

  const slugRef = useRef(slug);
  slugRef.current = slug;

  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const personalBest = useMemo(() => getPersonalBest(slug), [slug]);

  const reportResult = useCallback(
    (score: number, won: boolean, wordsFound?: number) => {
      if (recordedRef.current) return { isNewBest: false, newAchievements: [] as Achievement[] };
      recordedRef.current = true;

      const currentSlug = slugRef.current;
      const currentBest = getPersonalBest(currentSlug);

      const result = recordGameResult({
        slug: currentSlug,
        score,
        won,
        wordsFound,
        timestamp: Date.now(),
      });

      if (result.isNewBest && score > 0) {
        toast({
          title: "New Personal Best!",
          description: `${score} points - you beat your previous record of ${currentBest}!`,
        });
      }

      if (result.newAchievements.length > 0) {
        for (const achievement of result.newAchievements) {
          setTimeout(() => {
            toast({
              title: "Achievement Unlocked!",
              description: `${achievement.title} - ${achievement.description}`,
            });
          }, result.isNewBest ? 2000 : 0);
        }

        if (isAuthenticatedRef.current) {
          for (const achievement of result.newAchievements) {
            fetch("/api/user/achievements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ achievementId: achievement.id, unlockedAt: new Date().toISOString() }),
            }).catch(() => {});
          }
        }
      }

      if (isAuthenticatedRef.current) {
        syncToBackend(currentSlug, score, won, wordsFound);
        const challengeId = challengeIdRef.current;
        if (challengeId) {
          fetch(`/api/challenges/${challengeId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ score }),
          }).catch(() => {});
        }
      }

      return result;
    },
    [toast]
  );

  const resetRecorded = useCallback(() => {
    recordedRef.current = false;
  }, []);

  return { reportResult, resetRecorded, personalBest };
}
