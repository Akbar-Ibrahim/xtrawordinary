---
name: Tiered Achievements
description: New achievement system with Bronze/Silver/Gold tiers, points, and migration from old flat IDs.
---

Achievement IDs now follow `{group}_{tier}` pattern (e.g. `games_bronze`, `wins_gold`).
Standalone IDs kept: `first_game`, `first_win`, `perfect_sweep`.

**ACHIEVEMENT_GROUPS** in game-stats.ts is the source of truth for UI progress display. Each group has a `getProgress()` function that derives current value from AllStats/StreakData/DuelStats.

Max points: 785 (Bronze=10, Silver=25, Gold=50, standalone=5-10).

**Migration:** `loadAchievements()` detects old-format localStorage by checking if any stored ID is not in `NEW_IDS` set, then calls `migrateOldAchievements()` which maps old → new IDs via `OLD_TO_NEW` map. Saves migrated data back to localStorage.

**Why:** Old system had 24 flat badges with no depth — earned once and forgotten. try_all_games incorrectly said "17 games" when there are 25 games.
