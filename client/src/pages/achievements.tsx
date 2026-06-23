import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Award } from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
  loadAchievements,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_GROUPS,
  getTotalAchievementPoints,
  getMaxAchievementPoints,
  loadStats as loadLocalStats,
  loadStreak as loadLocalStreak,
  loadDuelStats as loadLocalDuelStats,
} from "@/lib/game-stats";

export default function Achievements() {
  const achievements = useMemo(() => loadAchievements(), []);
  const unlockedMap = useMemo(
    () => new Map(achievements.filter((a) => a.unlockedAt).map((a) => [a.id, a.unlockedAt!])),
    [achievements]
  );

  const totalPoints = getTotalAchievementPoints(achievements);
  const maxPoints = getMaxAchievementPoints();

  const localStats = useMemo(() => loadLocalStats(), []);
  const localStreak = useMemo(() => loadLocalStreak(), []);
  const localDuelStats = useMemo(() => loadLocalDuelStats(), []);

  const { data: rarities = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/achievements/rarity"],
  });

  function rarityLabel(id: string): string | null {
    const pct = rarities[id];
    if (pct == null) return null;
    if (pct < 1) return "< 1%";
    return `${pct}%`;
  }

  const standalones = ACHIEVEMENT_DEFINITIONS.filter((a) => !a.groupId);
  const unlockedCount = achievements.filter((a) => a.unlockedAt !== null).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Games
        </Button>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header + points summary */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Award className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-achievements-title">Achievements</h1>
          </div>
          <p className="text-muted-foreground mb-4">
            {unlockedCount} of {achievements.length} unlocked
          </p>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <div className="min-w-[80px]">
                <p className="text-xs text-muted-foreground mb-0.5">Points</p>
                <p className="text-2xl font-bold leading-none" data-testid="text-total-points">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">of {maxPoints}</p>
              </div>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.round((totalPoints / maxPoints) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((totalPoints / maxPoints) * 100)}% complete
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone achievements */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Milestones</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {standalones.map((def) => {
              const unlockedAt = unlockedMap.get(def.id) ?? null;
              const IconComponent =
                (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[def.icon] || Award;
              const rarity = rarityLabel(def.id);
              return (
                <Card
                  key={def.id}
                  className={unlockedAt ? "border-accent/40" : "opacity-50"}
                  data-testid={`card-achievement-${def.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${unlockedAt ? "bg-primary/10" : "bg-muted"}`}>
                        {unlockedAt ? (
                          <IconComponent className="h-4 w-4 text-primary" />
                        ) : (
                          <LucideIcons.Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-semibold">{def.title}</h3>
                          <span className="text-xs text-muted-foreground">+{def.points}pts</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                        {unlockedAt && (
                          <p className="text-xs text-primary/70 mt-1">
                            {new Date(unlockedAt).toLocaleDateString()}
                            {rarity && ` · ${rarity} of players`}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Tiered categories */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Categories</h2>
          <div className="space-y-3">
            {ACHIEVEMENT_GROUPS.map((group) => {
              const defs = ACHIEVEMENT_DEFINITIONS.filter((a) => a.groupId === group.id);
              const progress = group.getProgress(localStats, localStreak, localDuelStats);

              const nextDef = defs.find((a) => !unlockedMap.has(a.id));
              const nextTierDef = nextDef ? group.tiers.find((t) => t.tier === nextDef.tier) : null;
              const nextTierIdx = nextTierDef ? group.tiers.indexOf(nextTierDef) : -1;
              const prevTierThreshold = nextTierIdx > 0 ? group.tiers[nextTierIdx - 1].threshold : 0;
              const pct =
                nextTierDef
                  ? Math.min(
                      99,
                      Math.floor(
                        ((progress - prevTierThreshold) /
                          (nextTierDef.threshold - prevTierThreshold)) *
                          100
                      )
                    )
                  : null;

              const allUnlocked = defs.every((a) => unlockedMap.has(a.id));

              return (
                <div key={group.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <span className="text-xs text-muted-foreground">{group.formatProgress(progress)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {defs.map((def) => {
                      const unlockedAt = unlockedMap.get(def.id) ?? null;
                      const tierInfo = group.tiers.find((t) => t.tier === def.tier)!;
                      const tierEmoji = def.tier === "bronze" ? "🥉" : def.tier === "silver" ? "🥈" : "🥇";
                      const rarity = rarityLabel(def.id);
                      const unlockedClass =
                        def.tier === "bronze"
                          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                          : def.tier === "silver"
                          ? "bg-slate-50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-600"
                          : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700";

                      return (
                        <div
                          key={def.id}
                          data-testid={`achievement-tier-${def.id}`}
                          className={`rounded-lg border p-2.5 text-center transition-all ${
                            unlockedAt ? unlockedClass : "bg-muted/20 border-muted opacity-40"
                          }`}
                          title={unlockedAt ? `Unlocked ${new Date(unlockedAt).toLocaleDateString()}${rarity ? ` · ${rarity} of players` : ""}` : `Locked — ${tierInfo.thresholdLabel}`}
                        >
                          <div className="text-xl leading-none mb-1">{unlockedAt ? tierEmoji : "○"}</div>
                          <div className="text-xs font-medium leading-tight">{def.title}</div>
                          <div className="text-xs text-muted-foreground">{tierInfo.thresholdLabel}</div>
                          <div className="text-xs text-muted-foreground/60 mt-0.5">+{def.points}pts</div>
                        </div>
                      );
                    })}
                  </div>

                  {pct !== null && nextTierDef && !allUnlocked && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Next: {nextTierDef.thresholdLabel}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              nextTierDef.tier === "bronze"
                                ? "#cd7f32"
                                : nextTierDef.tier === "silver"
                                ? "#94a3b8"
                                : "#f59e0b",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {allUnlocked && (
                    <p className="text-xs text-center text-primary/70 font-medium">✓ All tiers complete</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
