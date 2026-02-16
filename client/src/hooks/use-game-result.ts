import { useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { recordGameResult, getPersonalBest } from "@/lib/game-stats";
import type { Achievement } from "@/lib/game-stats";

interface GameResultOptions {
  slug: string;
}

export function useGameResult({ slug }: GameResultOptions) {
  const { toast } = useToast();
  const recordedRef = useRef(false);
  const personalBest = getPersonalBest(slug);

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
      }

      return result;
    },
    [slug, toast, personalBest]
  );

  const resetRecorded = useCallback(() => {
    recordedRef.current = false;
  }, []);

  return { reportResult, resetRecorded, personalBest };
}
