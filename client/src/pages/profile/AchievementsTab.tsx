import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_GROUPS,
  loadStats as loadLocalStats,
  loadStreak as loadLocalStreak,
  loadDuelStats as loadLocalDuelStats,
} from "@/lib/game-stats";

type LocalStats = ReturnType<typeof loadLocalStats>;
type LocalStreak = ReturnType<typeof loadLocalStreak>;
type LocalDuelStats = ReturnType<typeof loadLocalDuelStats>;

interface Props {
  unlockedIds: Set<string>;
  achievementPoints: number;
  maxPoints: number;
  isOwnProfile: boolean;
  localStats: LocalStats | null;
  localStreak: LocalStreak | null;
  localDuelStats: LocalDuelStats | null;
}

export function AchievementsTab({
  unlockedIds,
  achievementPoints,
  maxPoints,
  isOwnProfile,
  localStats,
  localStreak,
  localDuelStats,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-4">
          <div className="min-w-[80px]">
            <p className="text-xs text-muted-foreground mb-0.5">Points</p>
            <p className="text-2xl font-bold leading-none" data-testid="text-achievement-points">{achievementPoints}</p>
            <p className="text-xs text-muted-foreground">of {maxPoints}</p>
          </div>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.round((achievementPoints / maxPoints) * 100))}%` }}
                data-testid="bar-achievement-progress"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((achievementPoints / maxPoints) * 100)}% complete
            </p>
          </div>
        </div>
      </div>

      {(() => {
        const standalones = ACHIEVEMENT_DEFINITIONS.filter((a) => !a.groupId);
        return (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Milestones</h3>
            <div className="flex flex-wrap gap-2">
              {standalones.map((a) => {
                const unlocked = unlockedIds.has(a.id);
                return (
                  <div
                    key={a.id}
                    data-testid={`achievement-milestone-${a.id}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                      unlocked
                        ? "bg-primary/10 border-primary/30 text-foreground font-medium"
                        : "border-muted text-muted-foreground opacity-40"
                    }`}
                  >
                    <span>{unlocked ? "✓" : "○"}</span>
                    <span>{a.title}</span>
                    {unlocked && <span className="text-xs text-muted-foreground">+{a.points}pts</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</h3>
        {ACHIEVEMENT_GROUPS.map((group) => {
          const defs = ACHIEVEMENT_DEFINITIONS.filter((a) => a.groupId === group.id);
          const progress =
            isOwnProfile && localStats && localStreak && localDuelStats
              ? group.getProgress(localStats, localStreak, localDuelStats)
              : null;

          const nextDef = defs.find((a) => !unlockedIds.has(a.id));
          const nextTierDef = nextDef ? group.tiers.find((t) => t.tier === nextDef.tier) : null;
          const nextTierIdx = nextTierDef ? group.tiers.indexOf(nextTierDef) : -1;
          const prevTierThreshold = nextTierIdx > 0 ? group.tiers[nextTierIdx - 1].threshold : 0;
          const pct =
            progress !== null && nextTierDef
              ? Math.min(
                  99,
                  Math.floor(
                    ((progress - prevTierThreshold) /
                      (nextTierDef.threshold - prevTierThreshold)) *
                      100
                  )
                )
              : null;

          const allUnlocked = defs.every((a) => unlockedIds.has(a.id));

          return (
            <div key={group.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-sm font-medium">{group.label}</h4>
                {progress !== null && (
                  <span className="text-xs text-muted-foreground">{group.formatProgress(progress)}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2.5">
                {defs.map((def) => {
                  const unlocked = unlockedIds.has(def.id);
                  const tierInfo = group.tiers.find((t) => t.tier === def.tier)!;
                  const tierEmoji = def.tier === "bronze" ? "🥉" : def.tier === "silver" ? "🥈" : "🥇";
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
                      className={`rounded-lg border p-2 text-center transition-all ${
                        unlocked ? unlockedClass : "bg-muted/20 border-muted opacity-40"
                      }`}
                    >
                      <div className="text-lg leading-none mb-1">{unlocked ? tierEmoji : "○"}</div>
                      <div className="text-xs font-medium leading-tight">{def.title}</div>
                      <div className="text-xs text-muted-foreground">{tierInfo.thresholdLabel}</div>
                      {unlocked && (
                        <div className="text-xs text-muted-foreground/70 mt-0.5">+{def.points}pts</div>
                      )}
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
  );
}
