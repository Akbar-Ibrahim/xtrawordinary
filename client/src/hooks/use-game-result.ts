import { useCallback, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { recordGameResult, getPersonalBest, loadStats, loadStreak } from "@/lib/game-stats";
import type { Achievement } from "@/lib/game-stats";
import { useAuth } from "@/lib/auth-context";

const GUEST_NUDGE_KEY = "xw_guest_nudge_shown";

interface GameResultOptions {
  slug: string;
  challengeId?: number;
  quizMode?: boolean;
  isUntimed?: boolean;
}

async function syncToBackend(slug: string, score: number, won: boolean, wordsFound?: number, skipLeaderboard?: boolean) {
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
          lastScore: score,
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

    if (score > 0 && !skipLeaderboard) {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gameSlug: slug, score }),
      });
    }
  } catch {}
}

export function useGameResult({ slug, challengeId: explicitChallengeId, quizMode, isUntimed }: GameResultOptions) {
  const { toast } = useToast();
  const recordedRef = useRef(false);
  const { isAuthenticated, openAuthModal } = useAuth();
  const quizModeRef = useRef(quizMode);
  const isUntimedRef = useRef(isUntimed);

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

  const reportResult = useCallback(
    (score: number, won: boolean, wordsFound?: number) => {
      if (recordedRef.current) return { isNewBest: false, newAchievements: [] as Achievement[] };
      recordedRef.current = true;

      const currentSlug = slugRef.current;
      const currentBest = getPersonalBest(currentSlug);

      const streakBefore = loadStreak().currentStreak;

      const result = recordGameResult({
        slug: currentSlug,
        score,
        won,
        wordsFound,
        timestamp: Date.now(),
      });

      const streakAfter = loadStreak().currentStreak;
      const STREAK_MILESTONES: Record<number, { title: string; description: string }> = {
        7:   { title: "7-Day Streak!", description: "One whole week of word games. You're on a roll!" },
        30:  { title: "30-Day Streak!", description: "A full month of daily play. Incredible dedication!" },
        100: { title: "100-Day Streak!", description: "Triple digits! You're a true word master." },
        365: { title: "365-Day Streak!", description: "A full year! Legendary status achieved." },
      };
      if (streakAfter > streakBefore && STREAK_MILESTONES[streakAfter]) {
        const milestone = STREAK_MILESTONES[streakAfter];
        setTimeout(() => {
          toast({ title: `🔥 ${milestone.title}`, description: milestone.description, duration: 6000 });
        }, 1800);
      }

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

        if (isAuthenticatedRef.current && !quizModeRef.current) {
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

      if (isAuthenticatedRef.current && !quizModeRef.current) {
        syncToBackend(currentSlug, score, won, wordsFound, isUntimedRef.current);
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

      if (!isAuthenticatedRef.current && !quizModeRef.current) {
        try {
          const alreadyShown = sessionStorage.getItem(GUEST_NUDGE_KEY);
          if (!alreadyShown) {
            sessionStorage.setItem(GUEST_NUDGE_KEY, "1");
            setTimeout(() => {
              toast({
                title: "Your progress is saved locally",
                description: "Sign in to keep your stats and scores across all your devices.",
                action: ToastAction({ altText: "Sign in", onClick: openAuthModal, children: "Sign in" }) as ToastActionElement,
                duration: 8000,
              });
            }, 1200);
          }
        } catch {}
      }

      return result;
    },
    [toast]
  );

  const resetRecorded = useCallback(() => {
    recordedRef.current = false;
  }, []);

  return { reportResult, resetRecorded };
}

export function usePersonalBest(slug: string): number {
  return useMemo(() => getPersonalBest(slug), [slug]);
}
