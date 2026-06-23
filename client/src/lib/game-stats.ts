const STORAGE_KEY = "wordplay_stats";
const STREAK_KEY = "wordplay_streak";
const ACHIEVEMENTS_KEY = "wordplay_achievements";
const FAVORITES_KEY = "wordplay_favorites";
const DAILY_CHALLENGE_KEY = "wordplay_daily_challenge";
const DUEL_STATS_KEY = "wordplay_duel_stats";

export interface DuelStats {
  wins: number;
  losses: number;
  raceWins: number;
  consecutiveWins: number;
}

export function loadDuelStats(): DuelStats {
  try {
    const raw = localStorage.getItem(DUEL_STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { wins: 0, losses: 0, raceWins: 0, consecutiveWins: 0 };
}

function saveDuelStats(ds: DuelStats): void {
  try {
    localStorage.setItem(DUEL_STATS_KEY, JSON.stringify(ds));
  } catch {}
}

export function recordDuelResult(
  outcome: "you_win" | "you_lose" | "draw" | "forfeit",
  isRace: boolean
): Achievement[] {
  const ds = loadDuelStats();
  const won = outcome === "you_win" || outcome === "forfeit";

  if (won) {
    ds.wins++;
    ds.consecutiveWins++;
    if (isRace) ds.raceWins++;
  } else if (outcome === "you_lose") {
    ds.losses++;
    ds.consecutiveWins = 0;
  } else {
    ds.consecutiveWins = 0;
  }

  saveDuelStats(ds);
  return checkDuelAchievements(ds);
}

export interface GameRecord {
  slug: string;
  score: number;
  won: boolean;
  wordsFound?: number;
  timestamp: number;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number;
  totalScore: number;
  totalWordsFound: number;
  lastPlayed: number;
}

export interface AllStats {
  perGame: Record<string, GameStats>;
  totalGamesPlayed: number;
  totalGamesWon: number;
  firstPlayedAt: number;
  history: GameRecord[];
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: number | null;
  tier?: "bronze" | "silver" | "gold";
  groupId?: string;
  points: number;
}

export interface AchievementTierDef {
  tier: "bronze" | "silver" | "gold";
  threshold: number;
  thresholdLabel: string;
}

export interface AchievementGroupDef {
  id: string;
  label: string;
  tiers: AchievementTierDef[];
  getProgress: (stats: AllStats, streak: StreakData, duelStats: DuelStats) => number;
  formatProgress: (value: number) => string;
}

function getDateString(timestamp?: number): string {
  const d = timestamp ? new Date(timestamp) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STREAK_GRACE_HOURS = 2;

function getStreakDateString(): string {
  const now = new Date();
  if (now.getHours() < STREAK_GRACE_HOURS) {
    const adjusted = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return getDateString(adjusted.getTime());
  }
  return getDateString();
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateString(yesterday.getTime()) === dateStr;
}

function isToday(dateStr: string): boolean {
  return getDateString() === dateStr;
}

export function loadStats(): AllStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    perGame: {},
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    firstPlayedAt: 0,
    history: [],
  };
}

function saveStats(stats: AllStats): void {
  try {
    const trimmed = { ...stats, history: stats.history.slice(-200) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { currentStreak: 0, longestStreak: 0, lastPlayedDate: "" };
}

function saveStreak(streak: StreakData): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  } catch {}
}

export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, "unlockedAt">[] = [
  // --- Standalone ---
  { id: "first_game", title: "First Steps", description: "Play your first game", icon: "Footprints", points: 5 },
  { id: "first_win", title: "First Win", description: "Win your first game", icon: "Trophy", points: 5 },
  { id: "perfect_sweep", title: "Clean Sweep", description: "Clear the entire grid in Word Sweep", icon: "Grid3X3", points: 10 },

  // --- Games Played ---
  { id: "games_bronze", groupId: "games_played", tier: "bronze", title: "Dedicated Player", description: "Play 25 games", icon: "Star", points: 10 },
  { id: "games_silver", groupId: "games_played", tier: "silver", title: "Word Veteran", description: "Play 100 games", icon: "Medal", points: 25 },
  { id: "games_gold", groupId: "games_played", tier: "gold", title: "Word Legend", description: "Play 500 games", icon: "Crown", points: 50 },

  // --- Wins ---
  { id: "wins_bronze", groupId: "wins", tier: "bronze", title: "On a Roll", description: "Win 10 games", icon: "Flame", points: 10 },
  { id: "wins_silver", groupId: "wins", tier: "silver", title: "Champion", description: "Win 50 games", icon: "Trophy", points: 25 },
  { id: "wins_gold", groupId: "wins", tier: "gold", title: "Unstoppable", description: "Win 200 games", icon: "Crown", points: 50 },

  // --- Explorer ---
  { id: "explorer_bronze", groupId: "explorer", tier: "bronze", title: "Explorer", description: "Try 5 different games", icon: "Compass", points: 10 },
  { id: "explorer_silver", groupId: "explorer", tier: "silver", title: "Adventurer", description: "Try 15 different games", icon: "Map", points: 25 },
  { id: "explorer_gold", groupId: "explorer", tier: "gold", title: "Completionist", description: "Try all 25 games", icon: "CheckCircle", points: 50 },

  // --- High Scorer ---
  { id: "scorer_bronze", groupId: "scorer", tier: "bronze", title: "Century", description: "Score 100+ in one game", icon: "Zap", points: 10 },
  { id: "scorer_silver", groupId: "scorer", tier: "silver", title: "High Scorer", description: "Score 500+ in one game", icon: "TrendingUp", points: 25 },
  { id: "scorer_gold", groupId: "scorer", tier: "gold", title: "Word Master", description: "Score 1000+ in one game", icon: "Sparkles", points: 50 },

  // --- Wordsmith ---
  { id: "wordsmith_bronze", groupId: "wordsmith", tier: "bronze", title: "Wordsmith", description: "Find 50 total words", icon: "BookOpen", points: 10 },
  { id: "wordsmith_silver", groupId: "wordsmith", tier: "silver", title: "Lexicon", description: "Find 250 total words", icon: "Library", points: 25 },
  { id: "wordsmith_gold", groupId: "wordsmith", tier: "gold", title: "Walking Dictionary", description: "Find 1000 total words", icon: "GraduationCap", points: 50 },

  // --- Streak ---
  { id: "streak_bronze", groupId: "streak", tier: "bronze", title: "Consistent", description: "Play 3 days in a row", icon: "Calendar", points: 10 },
  { id: "streak_silver", groupId: "streak", tier: "silver", title: "Weekly Warrior", description: "Play 7 days in a row", icon: "CalendarCheck", points: 25 },
  { id: "streak_gold", groupId: "streak", tier: "gold", title: "Monthly Master", description: "Play 30 days in a row", icon: "CalendarHeart", points: 50 },

  // --- Duelist ---
  { id: "duelist_bronze", groupId: "duelist", tier: "bronze", title: "First Blood", description: "Win your first duel", icon: "Swords", points: 10 },
  { id: "duelist_silver", groupId: "duelist", tier: "silver", title: "Duel Veteran", description: "Win 10 duels", icon: "Shield", points: 25 },
  { id: "duelist_gold", groupId: "duelist", tier: "gold", title: "Duel Master", description: "Win 50 duels", icon: "Crown", points: 50 },

  // --- Race Driver ---
  { id: "racer_bronze", groupId: "racer", tier: "bronze", title: "Speed Demon", description: "Win your first race duel", icon: "Zap", points: 10 },
  { id: "racer_silver", groupId: "racer", tier: "silver", title: "Racer", description: "Win 10 race duels", icon: "Timer", points: 25 },
  { id: "racer_gold", groupId: "racer", tier: "gold", title: "Speed Master", description: "Win 30 race duels", icon: "Rocket", points: 50 },

  // --- Duel Streak ---
  { id: "duel_streak_bronze", groupId: "duel_streak", tier: "bronze", title: "Hot Streak", description: "Win 3 duels in a row", icon: "Flame", points: 10 },
  { id: "duel_streak_silver", groupId: "duel_streak", tier: "silver", title: "On Fire", description: "Win 5 duels in a row", icon: "Flame", points: 25 },
  { id: "duel_streak_gold", groupId: "duel_streak", tier: "gold", title: "Inferno", description: "Win 10 duels in a row", icon: "Flame", points: 50 },
];

export const ACHIEVEMENT_GROUPS: AchievementGroupDef[] = [
  {
    id: "games_played",
    label: "Games Played",
    tiers: [
      { tier: "bronze", threshold: 25, thresholdLabel: "25 games" },
      { tier: "silver", threshold: 100, thresholdLabel: "100 games" },
      { tier: "gold", threshold: 500, thresholdLabel: "500 games" },
    ],
    getProgress: (stats) => stats.totalGamesPlayed,
    formatProgress: (v) => `${v} games`,
  },
  {
    id: "wins",
    label: "Wins",
    tiers: [
      { tier: "bronze", threshold: 10, thresholdLabel: "10 wins" },
      { tier: "silver", threshold: 50, thresholdLabel: "50 wins" },
      { tier: "gold", threshold: 200, thresholdLabel: "200 wins" },
    ],
    getProgress: (stats) => stats.totalGamesWon,
    formatProgress: (v) => `${v} wins`,
  },
  {
    id: "explorer",
    label: "Explorer",
    tiers: [
      { tier: "bronze", threshold: 5, thresholdLabel: "5 games" },
      { tier: "silver", threshold: 15, thresholdLabel: "15 games" },
      { tier: "gold", threshold: 25, thresholdLabel: "25 games" },
    ],
    getProgress: (stats) => Object.keys(stats.perGame).length,
    formatProgress: (v) => `${v} unique`,
  },
  {
    id: "scorer",
    label: "High Scorer",
    tiers: [
      { tier: "bronze", threshold: 100, thresholdLabel: "100 pts" },
      { tier: "silver", threshold: 500, thresholdLabel: "500 pts" },
      { tier: "gold", threshold: 1000, thresholdLabel: "1000 pts" },
    ],
    getProgress: (stats) => Math.max(0, ...Object.values(stats.perGame).map((g) => g.bestScore)),
    formatProgress: (v) => `${v} pts best`,
  },
  {
    id: "wordsmith",
    label: "Wordsmith",
    tiers: [
      { tier: "bronze", threshold: 50, thresholdLabel: "50 words" },
      { tier: "silver", threshold: 250, thresholdLabel: "250 words" },
      { tier: "gold", threshold: 1000, thresholdLabel: "1000 words" },
    ],
    getProgress: (stats) => Object.values(stats.perGame).reduce((s, g) => s + g.totalWordsFound, 0),
    formatProgress: (v) => `${v} words`,
  },
  {
    id: "streak",
    label: "Daily Streak",
    tiers: [
      { tier: "bronze", threshold: 3, thresholdLabel: "3 days" },
      { tier: "silver", threshold: 7, thresholdLabel: "7 days" },
      { tier: "gold", threshold: 30, thresholdLabel: "30 days" },
    ],
    getProgress: (_stats, streak) => Math.max(streak.currentStreak, streak.longestStreak),
    formatProgress: (v) => `${v} day best`,
  },
  {
    id: "duelist",
    label: "Duelist",
    tiers: [
      { tier: "bronze", threshold: 1, thresholdLabel: "1 win" },
      { tier: "silver", threshold: 10, thresholdLabel: "10 wins" },
      { tier: "gold", threshold: 50, thresholdLabel: "50 wins" },
    ],
    getProgress: (_stats, _streak, duelStats) => duelStats.wins,
    formatProgress: (v) => `${v} wins`,
  },
  {
    id: "racer",
    label: "Race Driver",
    tiers: [
      { tier: "bronze", threshold: 1, thresholdLabel: "1 win" },
      { tier: "silver", threshold: 10, thresholdLabel: "10 wins" },
      { tier: "gold", threshold: 30, thresholdLabel: "30 wins" },
    ],
    getProgress: (_stats, _streak, duelStats) => duelStats.raceWins,
    formatProgress: (v) => `${v} wins`,
  },
  {
    id: "duel_streak",
    label: "Duel Streak",
    tiers: [
      { tier: "bronze", threshold: 3, thresholdLabel: "3 in a row" },
      { tier: "silver", threshold: 5, thresholdLabel: "5 in a row" },
      { tier: "gold", threshold: 10, thresholdLabel: "10 in a row" },
    ],
    getProgress: (_stats, _streak, duelStats) => duelStats.consecutiveWins,
    formatProgress: (v) => `${v} current`,
  },
];

const OLD_TO_NEW: Record<string, string | null> = {
  first_game: "first_game",
  five_games: null,
  twenty_five_games: "games_bronze",
  hundred_games: "games_silver",
  first_win: "first_win",
  ten_wins: "wins_bronze",
  fifty_wins: "wins_silver",
  try_five_games: "explorer_bronze",
  try_all_games: "explorer_silver",
  score_100: "scorer_bronze",
  score_500: "scorer_silver",
  score_1000: "scorer_gold",
  words_50: "wordsmith_bronze",
  words_250: "wordsmith_silver",
  words_1000: "wordsmith_gold",
  streak_3: "streak_bronze",
  streak_7: "streak_silver",
  streak_30: "streak_gold",
  perfect_sweep: "perfect_sweep",
  duel_first_win: "duelist_bronze",
  duel_ten_wins: "duelist_silver",
  duel_fifty_wins: "duelist_gold",
  duel_five_streak: "duel_streak_silver",
  duel_race_win: "racer_bronze",
  duel_ten_race_wins: "racer_silver",
};

const NEW_IDS = new Set(ACHIEVEMENT_DEFINITIONS.map((a) => a.id));

function migrateOldAchievements(old: Achievement[]): Achievement[] {
  const fresh = ACHIEVEMENT_DEFINITIONS.map((a) => ({ ...a, unlockedAt: null as number | null }));
  const freshMap = new Map(fresh.map((a) => [a.id, a]));

  for (const oldAch of old) {
    if (!oldAch.unlockedAt) continue;
    const newId = OLD_TO_NEW[oldAch.id] ?? oldAch.id;
    if (!newId) continue;
    const target = freshMap.get(newId);
    if (target && !target.unlockedAt) target.unlockedAt = oldAch.unlockedAt;
  }

  return fresh;
}

export function loadAchievements(): Achievement[] {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return ACHIEVEMENT_DEFINITIONS.map((a) => ({ ...a, unlockedAt: null }));

    const stored: Achievement[] = JSON.parse(raw);

    const isOldFormat = stored.some((a) => !NEW_IDS.has(a.id));
    if (isOldFormat) {
      const migrated = migrateOldAchievements(stored);
      saveAchievements(migrated);
      return migrated;
    }

    const storedMap = new Map(stored.map((a) => [a.id, a.unlockedAt]));
    return ACHIEVEMENT_DEFINITIONS.map((a) => ({
      ...a,
      unlockedAt: storedMap.get(a.id) ?? null,
    }));
  } catch {
    return ACHIEVEMENT_DEFINITIONS.map((a) => ({ ...a, unlockedAt: null }));
  }
}

function saveAchievements(achievements: Achievement[]): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
  } catch {}
}

export function getTotalAchievementPoints(achievements: Achievement[]): number {
  return achievements.filter((a) => a.unlockedAt !== null).reduce((sum, a) => sum + a.points, 0);
}

export function getMaxAchievementPoints(): number {
  return ACHIEVEMENT_DEFINITIONS.reduce((sum, a) => sum + a.points, 0);
}

function checkDuelAchievements(ds: DuelStats): Achievement[] {
  const achievements = loadAchievements();
  const newlyUnlocked: Achievement[] = [];

  const conditions: Record<string, boolean> = {
    duelist_bronze: ds.wins >= 1,
    duelist_silver: ds.wins >= 10,
    duelist_gold: ds.wins >= 50,
    duel_streak_bronze: ds.consecutiveWins >= 3,
    duel_streak_silver: ds.consecutiveWins >= 5,
    duel_streak_gold: ds.consecutiveWins >= 10,
    racer_bronze: ds.raceWins >= 1,
    racer_silver: ds.raceWins >= 10,
    racer_gold: ds.raceWins >= 30,
  };

  for (const achievement of achievements) {
    if (achievement.unlockedAt) continue;
    if (conditions[achievement.id]) {
      achievement.unlockedAt = Date.now();
      newlyUnlocked.push({ ...achievement });
    }
  }

  if (newlyUnlocked.length > 0) {
    saveAchievements(achievements);
  }

  return newlyUnlocked;
}

export function recordGameResult(record: GameRecord): {
  stats: AllStats;
  streak: StreakData;
  isNewBest: boolean;
  newAchievements: Achievement[];
} {
  const stats = loadStats();
  const streak = loadStreak();

  if (!stats.perGame[record.slug]) {
    stats.perGame[record.slug] = {
      gamesPlayed: 0,
      gamesWon: 0,
      bestScore: 0,
      totalScore: 0,
      totalWordsFound: 0,
      lastPlayed: 0,
    };
  }

  const gs = stats.perGame[record.slug];
  gs.gamesPlayed++;
  gs.totalScore += record.score;
  gs.totalWordsFound += record.wordsFound || 0;
  gs.lastPlayed = record.timestamp;
  if (record.won) gs.gamesWon++;

  const isNewBest = record.score > gs.bestScore;
  if (isNewBest) gs.bestScore = record.score;

  stats.totalGamesPlayed++;
  if (record.won) stats.totalGamesWon++;
  if (!stats.firstPlayedAt) stats.firstPlayedAt = record.timestamp;
  stats.history.push(record);

  saveStats(stats);

  const today = getStreakDateString();
  if (streak.lastPlayedDate !== today) {
    const todayDate = new Date(today + "T12:00:00");
    const prevDate = new Date(todayDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const yesterday = getDateString(prevDate.getTime());
    if (streak.lastPlayedDate === yesterday) {
      streak.currentStreak++;
    } else {
      streak.currentStreak = 1;
    }
    streak.lastPlayedDate = today;
    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }
  }
  saveStreak(streak);

  const newAchievements = checkAchievements(stats, streak);

  try {
    window.dispatchEvent(
      new CustomEvent("wordplay-game-result", {
        detail: { slug: record.slug, score: record.score, won: record.won },
      })
    );
  } catch {}

  return { stats, streak, isNewBest, newAchievements };
}

export function getPersonalBest(slug: string): number {
  const stats = loadStats();
  return stats.perGame[slug]?.bestScore || 0;
}

export function getGameStats(slug: string): GameStats | null {
  const stats = loadStats();
  return stats.perGame[slug] || null;
}

export function getUniqueGamesPlayed(): number {
  const stats = loadStats();
  return Object.keys(stats.perGame).length;
}

export function getFavoriteGame(): string | null {
  const stats = loadStats();
  let maxPlayed = 0;
  let favorite: string | null = null;
  for (const [slug, gs] of Object.entries(stats.perGame)) {
    if (gs.gamesPlayed > maxPlayed) {
      maxPlayed = gs.gamesPlayed;
      favorite = slug;
    }
  }
  return favorite;
}

export function getTotalWordsFound(): number {
  const stats = loadStats();
  let total = 0;
  for (const gs of Object.values(stats.perGame)) {
    total += gs.totalWordsFound;
  }
  return total;
}

function checkAchievements(stats: AllStats, streak: StreakData): Achievement[] {
  const achievements = loadAchievements();
  const newlyUnlocked: Achievement[] = [];
  const totalWords = Object.values(stats.perGame).reduce((sum, gs) => sum + gs.totalWordsFound, 0);
  const uniqueGames = Object.keys(stats.perGame).length;
  const maxScore = Math.max(0, ...Object.values(stats.perGame).map((gs) => gs.bestScore));
  const lastRecord = stats.history[stats.history.length - 1];

  const conditions: Record<string, boolean> = {
    first_game: stats.totalGamesPlayed >= 1,
    games_bronze: stats.totalGamesPlayed >= 25,
    games_silver: stats.totalGamesPlayed >= 100,
    games_gold: stats.totalGamesPlayed >= 500,
    first_win: stats.totalGamesWon >= 1,
    wins_bronze: stats.totalGamesWon >= 10,
    wins_silver: stats.totalGamesWon >= 50,
    wins_gold: stats.totalGamesWon >= 200,
    explorer_bronze: uniqueGames >= 5,
    explorer_silver: uniqueGames >= 15,
    explorer_gold: uniqueGames >= 25,
    scorer_bronze: maxScore >= 100,
    scorer_silver: maxScore >= 500,
    scorer_gold: maxScore >= 1000,
    wordsmith_bronze: totalWords >= 50,
    wordsmith_silver: totalWords >= 250,
    wordsmith_gold: totalWords >= 1000,
    streak_bronze: streak.currentStreak >= 3 || streak.longestStreak >= 3,
    streak_silver: streak.currentStreak >= 7 || streak.longestStreak >= 7,
    streak_gold: streak.currentStreak >= 30 || streak.longestStreak >= 30,
    perfect_sweep: lastRecord?.slug === "word-sweep" && lastRecord?.won === true,
  };

  for (const achievement of achievements) {
    if (achievement.unlockedAt) continue;
    if (conditions[achievement.id]) {
      achievement.unlockedAt = Date.now();
      newlyUnlocked.push({ ...achievement });
    }
  }

  if (newlyUnlocked.length > 0) {
    saveAchievements(achievements);
  }

  return newlyUnlocked;
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(slug: string): string[] {
  const favs = loadFavorites();
  const idx = favs.indexOf(slug);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(slug);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return favs;
}

export function isFavorite(slug: string): boolean {
  return loadFavorites().includes(slug);
}

export interface DailyChallengeRecord {
  date: string;
  slug: string;
  score: number;
  completedAt: number;
}

export function getDailyChallengeRecord(date: string): DailyChallengeRecord | null {
  try {
    const raw = localStorage.getItem(DAILY_CHALLENGE_KEY);
    if (!raw) return null;
    const records: DailyChallengeRecord[] = JSON.parse(raw);
    return records.find((r) => r.date === date) || null;
  } catch {
    return null;
  }
}

export function saveDailyChallengeRecord(record: DailyChallengeRecord): void {
  try {
    const raw = localStorage.getItem(DAILY_CHALLENGE_KEY);
    const records: DailyChallengeRecord[] = raw ? JSON.parse(raw) : [];
    const existing = records.findIndex((r) => r.date === record.date);
    if (existing >= 0) return;
    records.push(record);
    if (records.length > 30) records.splice(0, records.length - 30);
    localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(records));
  } catch {}
}

const DAILY_STREAK_KEY = "xw_daily_challenge_streak";

export interface LocalDailyStreak {
  streak: number;
  longest: number;
  lastDate: string | null;
}

export function getLocalDailyChallengeStreak(): LocalDailyStreak {
  try {
    const raw = localStorage.getItem(DAILY_STREAK_KEY);
    if (!raw) return { streak: 0, longest: 0, lastDate: null };
    return JSON.parse(raw) as LocalDailyStreak;
  } catch {
    return { streak: 0, longest: 0, lastDate: null };
  }
}

export function updateLocalDailyChallengeStreak(date: string): LocalDailyStreak {
  try {
    const current = getLocalDailyChallengeStreak();
    if (current.lastDate === date) return current;
    let newStreak = 1;
    if (current.lastDate) {
      const prev = new Date(current.lastDate + "T00:00:00");
      const cur = new Date(date + "T00:00:00");
      const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) newStreak = current.streak + 1;
    }
    const updated: LocalDailyStreak = { streak: newStreak, longest: Math.max(current.longest, newStreak), lastDate: date };
    localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return { streak: 1, longest: 1, lastDate: date };
  }
}
