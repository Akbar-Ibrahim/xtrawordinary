import { useCallback, useRef } from "react";
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
  const personalBest = getPersonalBest(slug);
  const { isAuthenticated } = useAuth();
  const challengeId = explicitChallengeId || (() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("challenge");
    return id ? parseInt(id) : undefined;
  })();

  const reportResult = useCallback(
    (score: number, won: boolean, wordsFound?: number) => {
      if (recordedRef.current) return { isNewBest: false, newAchievements: [] as Achievement[] };
      recordedRef.current = true;

      const result = recordGameResult({
        slug,
        score,
        won,
        wordsFound,
        timestamp: Date.now(),
      });

      if (result.isNewBest && score > 0) {
        toast({
          title: "New Personal Best!",
          description: `${score} points - you beat your previous record of ${personalBest}!`,
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

        if (isAuthenticated) {
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

      if (isAuthenticated) {
        syncToBackend(slug, score, won, wordsFound);
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
    [slug, toast, personalBest, isAuthenticated, challengeId]
  );

  const resetRecorded = useCallback(() => {
    recordedRef.current = false;
  }, []);

  return { reportResult, resetRecorded, personalBest };
}
