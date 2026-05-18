import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Award, Lock } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { loadAchievements, ACHIEVEMENT_DEFINITIONS } from "@/lib/game-stats";
import type { Achievement } from "@/lib/game-stats";

export default function Achievements() {
  const achievements = useMemo(() => {
    const saved = loadAchievements();
    return ACHIEVEMENT_DEFINITIONS.map((def) => {
      const existing = saved.find((a) => a.id === def.id);
      return { ...def, unlockedAt: existing?.unlockedAt || null } as Achievement;
    });
  }, []);

  const { data: rarities = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/achievements/rarity"],
  });

  const unlocked = achievements.filter((a) => a.unlockedAt !== null);
  const locked = achievements.filter((a) => a.unlockedAt === null);

  function rarityLabel(id: string): string | null {
    const pct = rarities[id];
    if (pct == null) return null;
    if (pct < 1) return "< 1% of players";
    return `${pct}% of players`;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Games
        </Button>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Award className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-achievements-title">Achievements</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          {unlocked.length} of {achievements.length} unlocked
        </p>

        {unlocked.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Unlocked</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {unlocked.map((achievement, idx) => {
                const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[achievement.icon] || Award;
                const rarity = rarityLabel(achievement.id);
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="border-accent/30" data-testid={`card-achievement-${achievement.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                            <IconComponent className="h-5 w-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{achievement.title}</h3>
                              <Badge variant="secondary" className="text-xs">
                                Unlocked
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {achievement.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {achievement.unlockedAt && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(achievement.unlockedAt).toLocaleDateString()}
                                </p>
                              )}
                              {rarity && (
                                <span className="text-xs text-primary/70 font-medium" data-testid={`text-rarity-${achievement.id}`}>
                                  {rarity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {locked.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Locked</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {locked.map((achievement) => {
                const rarity = rarityLabel(achievement.id);
                return (
                  <Card
                    key={achievement.id}
                    className="opacity-60"
                    data-testid={`card-achievement-locked-${achievement.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold">{achievement.title}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {achievement.description}
                          </p>
                          {rarity && (
                            <span className="text-xs text-muted-foreground mt-1 block" data-testid={`text-rarity-locked-${achievement.id}`}>
                              {rarity}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
