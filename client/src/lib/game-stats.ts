const STORAGE_KEY = "wordplay_stats";
const STREAK_KEY = "wordplay_streak";
const ACHIEVEMENTS_KEY = "wordplay_achievements";
const FAVORITES_KEY = "wordplay_favorites";

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
}

function getDateString(timestamp?: number): string {
  const d = timestamp ? new Date(timestamp) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export function loadAchievements(): Achievement[] {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return ACHIEVEMENT_DEFINITIONS.map((a) => ({ ...a, unlockedAt: null }));
}

function saveAchievements(achievements: Achievement[]): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
  } catch {}
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

  const today = getDateString();
  if (!isToday(streak.lastPlayedDate)) {
    if (isYesterday(streak.lastPlayedDate)) {
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

export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, "unlockedAt">[] = [
  {
    id: "first_game",
    title: "First Steps",
    description: "Play your first game",
    icon: "Footprints",
  },
  {
    id: "five_games",
    title: "Getting Started",
    description: "Play 5 games",
    icon: "Rocket",
  },
  {
    id: "twenty_five_games",
    title: "Dedicated Player",
    description: "Play 25 games",
    icon: "Star",
  },
  {
    id: "hundred_games",
    title: "Word Veteran",
    description: "Play 100 games",
    icon: "Medal",
  },
  {
    id: "first_win",
    title: "Winner",
    description: "Win your first game",
    icon: "Trophy",
  },
  {
    id: "ten_wins",
    title: "On a Roll",
    description: "Win 10 games",
    icon: "Flame",
  },
  {
    id: "fifty_wins",
    title: "Champion",
    description: "Win 50 games",
    icon: "Crown",
  },
  {
    id: "try_five_games",
    title: "Explorer",
    description: "Try 5 different games",
    icon: "Compass",
  },
  {
    id: "try_all_games",
    title: "Completionist",
    description: "Try all 17 games",
    icon: "CheckCircle",
  },
  {
    id: "score_100",
    title: "Century",
    description: "Score 100+ points in a single game",
    icon: "Zap",
  },
  {
    id: "score_500",
    title: "High Scorer",
    description: "Score 500+ points in a single game",
    icon: "TrendingUp",
  },
  {
    id: "score_1000",
    title: "Word Master",
    description: "Score 1000+ points in a single game",
    icon: "Sparkles",
  },
  {
    id: "words_50",
    title: "Wordsmith",
    description: "Find 50 total words across all games",
    icon: "BookOpen",
  },
  {
    id: "words_250",
    title: "Lexicon",
    description: "Find 250 total words across all games",
    icon: "Library",
  },
  {
    id: "words_1000",
    title: "Walking Dictionary",
    description: "Find 1000 total words across all games",
    icon: "GraduationCap",
  },
  {
    id: "streak_3",
    title: "Consistent",
    description: "Play 3 days in a row",
    icon: "Calendar",
  },
  {
    id: "streak_7",
    title: "Weekly Warrior",
    description: "Play 7 days in a row",
    icon: "CalendarCheck",
  },
  {
    id: "streak_30",
    title: "Monthly Master",
    description: "Play 30 days in a row",
    icon: "CalendarHeart",
  },
  {
    id: "perfect_sweep",
    title: "Clean Sweep",
    description: "Clear the entire grid in Word Sweep",
    icon: "Grid3X3",
  },
];

function checkAchievements(stats: AllStats, streak: StreakData): Achievement[] {
  const achievements = loadAchievements();
  const newlyUnlocked: Achievement[] = [];
  const totalWords = Object.values(stats.perGame).reduce((sum, gs) => sum + gs.totalWordsFound, 0);
  const uniqueGames = Object.keys(stats.perGame).length;
  const maxScore = Math.max(0, ...Object.values(stats.perGame).map((gs) => gs.bestScore));
  const lastRecord = stats.history[stats.history.length - 1];

  const conditions: Record<string, boolean> = {
    first_game: stats.totalGamesPlayed >= 1,
    five_games: stats.totalGamesPlayed >= 5,
    twenty_five_games: stats.totalGamesPlayed >= 25,
    hundred_games: stats.totalGamesPlayed >= 100,
    first_win: stats.totalGamesWon >= 1,
    ten_wins: stats.totalGamesWon >= 10,
    fifty_wins: stats.totalGamesWon >= 50,
    try_five_games: uniqueGames >= 5,
    try_all_games: uniqueGames >= 17,
    score_100: maxScore >= 100,
    score_500: maxScore >= 500,
    score_1000: maxScore >= 1000,
    words_50: totalWords >= 50,
    words_250: totalWords >= 250,
    words_1000: totalWords >= 1000,
    streak_3: streak.currentStreak >= 3 || streak.longestStreak >= 3,
    streak_7: streak.currentStreak >= 7 || streak.longestStreak >= 7,
    streak_30: streak.currentStreak >= 30 || streak.longestStreak >= 30,
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
