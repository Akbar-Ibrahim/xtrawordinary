import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordRootsPuzzle, WordLengthConfig, LetterPositionConfig, LetterHuntConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordUnpackPuzzle, WordLadderPuzzle, LadderRushPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement, Friendship, InsertFriendship, FriendChallenge, InsertFriendChallenge, Group, InsertGroup, GroupMember, GroupRound, InsertGroupRound, GroupRoundScore, GroupScoreReaction, GroupActivityEntry, GroupRoundAttempt, DailyChallengeAttempt, Comment, InsertComment, CommentReport, CommentTargetType, LikeTargetType, QuizSession, InsertQuizSession, QuizSessionScore, DuelChallenge, InsertDuelChallenge, DuelChallengeStatus, DuelSession, InsertDuelSession, DuelRating, HuddleChallenge, InsertHuddleChallenge, TeamRaceChallenge, InsertTeamRaceChallenge, Notification, InsertNotification, NotificationType, WordWarsTournament, InsertWordWarsTournament, WordWarsRegistration, WordWarsMatch, WordWarsMatchGame, WordWarsTournamentStatus, WordWarsMatchStatus, WordWarsMatchGameStatus, WordWarsChampion, GuildWarsTournament, InsertGuildWarsTournament, GuildWarsRegistration, GuildWarsMatch, GuildWarsMatchGame, GuildWarsChampion } from "@shared/schema";

export type LengthConstraint = {
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

export type PositionConstraint = {
  position: number;
  letter: string;
};

export type ContainsConstraint = {
  letters: string[];
};

export interface IStorage {
  getGames(): Promise<Game[]>;
  getAllGames(): Promise<Game[]>;
  setGameActive(slug: string, isActive: boolean): Promise<void>;
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getWordLadderPuzzles(): Promise<WordLadderPuzzle[]>;
  getLadderRushPuzzles(wordLength: number): Promise<LadderRushPuzzle[]>;
  getAnagramWordSets(): Promise<AnagramWordSet[]>;
  getScrambleWords(): Promise<ScrambleWord[]>;
  getDefinitionWords(): Promise<DefinitionWord[]>;
  getLetterPoolWords(): Promise<LetterPoolWord[]>;
  getMakerWords(): Promise<MakerWord[]>;
  getWordRootsPuzzles(): Promise<WordRootsPuzzle[]>;
  getWordStackPuzzles(): Promise<WordStackPuzzle[]>;
  getWordSplitPuzzles(): Promise<WordSplitPuzzle[]>;
  getWordDictionary(): Promise<string[]>;
  validateWord(word: string): Promise<boolean>;
  countLetterPositionWords(letter: string, position: number): Promise<number>;
  countWordLengthWords(length: number, startsWith?: string, endsWith?: string, contains?: string): Promise<number>;
  getWordLengthConfig(): Promise<WordLengthConfig>;
  getLetterPositionConfig(): Promise<LetterPositionConfig>;
  getLetterHuntConfig(): Promise<LetterHuntConfig>;
  getWordChainConfig(): Promise<WordChainConfig>;
  getVowelConsonantConfig(): Promise<VowelConsonantConfig>;
  generateLengthConstraint(level: number): Promise<LengthConstraint>;
  generatePositionConstraint(): Promise<PositionConstraint>;
  generateContainsConstraint(): Promise<ContainsConstraint>;
  getWordChainStartWord(variation: number, level: number, seed?: number): Promise<string | null>;
  getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null>;
  getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]>;
  generateWordSweepGrid(seed?: number): Promise<WordSweepGrid>;
  generateWordUnpackPuzzle(seed?: number): Promise<WordUnpackPuzzle>;
  validateShellWord(word: string): Promise<{ valid: boolean; innerWord: string | null }>;
  getShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null>;
  getCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null>;
  validateDeepShellWord(word: string): Promise<{ valid: boolean; innerWord: string | null }>;
  getDeepShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null>;
  getDeepCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null>;
  getDeepCrackAnswer(seed: number): Promise<string | null>;
  getWordStretchPuzzle(seed: number): Promise<{ word: string; totalSolutions: number }>;
  validateWordStretch(stretched: string, seedWord: string): Promise<{ valid: boolean; isMiddle: boolean }>;
  getWordStretchSolutions(seed: number): Promise<string[]>;
  getWordBloomPuzzle(seed: number): Promise<{ seed: string; maxDepth: number }>;
  validateWordBloom(currentWord: string, nextWord: string): Promise<{ valid: boolean; isMiddle: boolean }>;

  createUser(user: InsertUser): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;

  createEmailVerificationToken(userId: number, token: string, expiresAt: string): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(token: string): Promise<void>;

  createPasswordResetToken(userId: number, token: string, expiresAt: string): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;

  saveUserGameStats(stats: InsertUserGameStats): Promise<UserGameStats>;
  getUserGameStats(userId: number, gameSlug: string): Promise<UserGameStats | undefined>;
  getAllUserGameStats(userId: number): Promise<UserGameStats[]>;

  saveLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;
  getLeaderboard(gameSlug: string, limit?: number, timeFilter?: string): Promise<LeaderboardEntry[]>;
  getOverallLeaderboard(limit?: number, timeFilter?: string): Promise<LeaderboardEntry[]>;
  getPlayerRank(gameSlug: string, userId: number, timeFilter?: string): Promise<{ rank: number; score: number; totalPlayers: number } | null>;
  getFriendsLeaderboard(gameSlug: string, userId: number): Promise<LeaderboardEntry[]>;
  incrementGamePlayCount(gameSlug: string): Promise<void>;
  getGamePlayCount(gameSlug: string): Promise<number>;
  getAllGamePlayCounts(): Promise<Record<string, number>>;

  getUserStreak(userId: number): Promise<UserStreak | undefined>;
  saveUserStreak(userId: number, currentStreak: number, longestStreak: number, lastPlayedDate: string): Promise<UserStreak>;
  getTopStreaks(limit: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; currentStreak: number; longestStreak: number }>>;
  getStreakBatch(userIds: number[]): Promise<Record<number, number>>;
  updateDailyChallengeStreak(userId: number, date: string): Promise<{ streak: number; longest: number; alreadyDone: boolean }>;

  getLeaderboardPercentile(gameSlug: string, score: number): Promise<{ percentile: number; totalPlayers: number }>;

  getUserAchievements(userId: number): Promise<UserAchievement[]>;
  saveUserAchievement(userId: number, achievementId: string, unlockedAt: string): Promise<UserAchievement>;

  deleteUser(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deleteLeaderboardEntry(id: number): Promise<void>;
  getAdminStats(): Promise<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }>;
  getAllLeaderboardEntries(): Promise<LeaderboardEntry[]>;

  getFriendsWhoPlayGame(gameSlug: string, userId: number): Promise<Array<{ id: number; name: string; avatarUrl: string | null; gamesPlayed: number }>>;
  searchUsers(query: string): Promise<Array<{ id: number; name: string; avatarUrl: string | null }>>;
  getPublicProfile(userId: number): Promise<{ user: { id: number; name: string; avatarUrl: string | null; createdAt: string; isPremium: boolean; bio: string | null }; stats: UserGameStats[]; achievements: UserAchievement[]; leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> } | null>;

  getFriendshipById(id: number): Promise<Friendship | undefined>;
  sendFriendRequest(requesterId: number, addresseeId: number): Promise<Friendship>;
  acceptFriendRequest(id: number): Promise<Friendship | undefined>;
  declineFriendRequest(id: number): Promise<Friendship | undefined>;
  removeFriend(id: number): Promise<void>;
  getFriends(userId: number): Promise<Array<Friendship & { friendUser: { id: number; name: string; avatarUrl: string | null } }>>;
  getPendingFriendRequests(userId: number): Promise<Array<Friendship & { requesterUser: { id: number; name: string; avatarUrl: string | null } }>>;
  getFriendship(userId1: number, userId2: number): Promise<Friendship | undefined>;

  expireFriendChallenges(): Promise<number>;
  createFriendChallenge(challenge: InsertFriendChallenge): Promise<FriendChallenge>;
  getFriendChallenges(userId: number): Promise<FriendChallenge[]>;
  getFriendChallenge(id: number): Promise<FriendChallenge | undefined>;
  getPendingFriendChallenge(senderId: number, receiverId: number, gameSlug: string): Promise<FriendChallenge | undefined>;
  completeFriendChallenge(id: number, score: number): Promise<FriendChallenge | undefined>;
  cancelFriendChallenge(id: number): Promise<FriendChallenge | undefined>;
  declineFriendChallenge(id: number): Promise<FriendChallenge | undefined>;
  markChallengeViewed(id: number): Promise<void>;
  markChallengeReceiverViewed(id: number): Promise<void>;

  // Groups
  createGroup(group: InsertGroup): Promise<Group>;
  getGroup(id: number): Promise<Group | undefined>;
  getGroupByInviteCode(code: string): Promise<Group | undefined>;
  updateGroup(id: number, updates: Partial<Pick<Group, "name" | "description" | "isPublic" | "tags" | "pinnedAnnouncement" | "isFeatured">>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<void>;
  getUserGroups(userId: number): Promise<Group[]>;
  getPublicGroups(): Promise<Group[]>;
  getAllGroups(): Promise<Group[]>;
  setGroupFeatured(groupId: number, isFeatured: boolean): Promise<Group | undefined>;

  addGroupMember(groupId: number, userId: number, role: string): Promise<GroupMember>;
  removeGroupMember(groupId: number, userId: number): Promise<void>;
  getGroupMembers(groupId: number): Promise<Array<GroupMember & { user: { id: number; name: string; avatarUrl: string | null } }>>;
  getGroupMember(groupId: number, userId: number): Promise<GroupMember | undefined>;
  updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<GroupMember | undefined>;

  createGroupRound(round: InsertGroupRound): Promise<GroupRound>;
  getGroupRound(id: number): Promise<GroupRound | undefined>;
  getGroupRounds(groupId: number): Promise<GroupRound[]>;
  closeGroupRound(id: number): Promise<GroupRound | undefined>;

  submitGroupRoundScore(roundId: number, userId: number, score: number, durationMs?: number): Promise<GroupRoundScore>;
  getGroupRoundScores(roundId: number): Promise<Array<GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } }>>;
  getUserGroupRoundScore(roundId: number, userId: number): Promise<GroupRoundScore | undefined>;
  getGroupLeaderboard(groupId: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>>;

  addGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<GroupScoreReaction>;
  removeGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<void>;
  getGroupRoundReactions(roundId: number): Promise<GroupScoreReaction[]>;

  logGroupActivity(groupId: number, userId: number | null, type: string, metadata?: Record<string, any>): Promise<void>;
  getGroupActivity(groupId: number, limit?: number): Promise<GroupActivityEntry[]>;

  // Attempt tracking
  createGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt>;
  getGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt | undefined>;
  createDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt>;
  getDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt | undefined>;
  saveDailyChallengeScore(userId: number, challengeDate: string, gameSlug: string, score: number): Promise<void>;
  getDailyLeaderboard(challengeDate: string, gameSlug: string, requestingUserId?: number): Promise<{ entries: import("@shared/schema").DailyLeaderboardEntry[]; myRank?: number; myScore?: number }>;

  getRecentCommentCount(userId: number, since: Date): Promise<number>;
  // Comments
  createComment(comment: InsertComment): Promise<Comment>;
  getComments(targetType: CommentTargetType, targetId: string, userId?: number): Promise<Comment[]>;
  getCommentById(id: number): Promise<Comment | null>;
  updateComment(id: number, userId: number, content: string): Promise<Comment | null>;
  deleteComment(id: number, userId: number, isAdmin?: boolean): Promise<boolean>;
  reportComment(commentId: number, reportingUserId: number, reason: string): Promise<CommentReport>;
  getCommentReports(): Promise<CommentReport[]>;
  deleteCommentAdmin(id: number): Promise<void>;

  getAchievementRarities(): Promise<Record<string, number>>;

  // Likes
  toggleLike(userId: number, targetType: LikeTargetType, targetId: string): Promise<{ liked: boolean; count: number }>;
  getLikeCounts(targetType: LikeTargetType, targetIds: string[]): Promise<Record<string, number>>;
  getUserLikes(userId: number, targetType: LikeTargetType, targetIds: string[]): Promise<Set<string>>;

  // Quiz Master
  createQuizSession(session: InsertQuizSession): Promise<QuizSession>;
  getQuizSessionByCode(shareCode: string): Promise<QuizSession | undefined>;
  getQuizSessionsByCreator(creatorId: number): Promise<QuizSession[]>;
  deleteQuizSession(id: number): Promise<void>;
  addQuizSessionScore(sessionId: number, userId: number, score: number, guestName?: string | null): Promise<QuizSessionScore>;
  getQuizSessionScores(sessionId: number): Promise<QuizSessionScore[]>;
  getQuizSessionScore(sessionId: number, userId: number): Promise<QuizSessionScore | undefined>;

  // Duels
  createDuelChallenge(data: InsertDuelChallenge): Promise<DuelChallenge>;
  getDuelChallenge(id: number): Promise<DuelChallenge | undefined>;
  getDuelChallengeByRoom(roomCode: string): Promise<DuelChallenge | undefined>;
  updateDuelChallengeStatus(id: number, status: DuelChallengeStatus, roomCode?: string, seed?: number | null, startWord?: string | null): Promise<DuelChallenge | undefined>;
  updateDuelChallengeChallengee(id: number, challengeeId: number): Promise<DuelChallenge | undefined>;
  /** Atomically assign challengeeId + accept an open challenge. Returns null if already taken by someone else. */
  acceptOpenDuelChallenge(id: number, challengeeId: number): Promise<DuelChallenge | null>;
  getDuelChallengesForUser(userId: number): Promise<DuelChallenge[]>;
  getOpenDuelChallenges(excludeUserId: number, gameSlug?: string): Promise<DuelChallenge[]>;
  /** Marks all pending open challenges whose expiresAt has passed as 'expired'. Returns count expired. */
  expireOpenChallenges(): Promise<number>;

  createDuelSession(data: InsertDuelSession): Promise<DuelSession>;
  getDuelSession(id: number): Promise<DuelSession | undefined>;
  getDuelSessionByRoom(roomCode: string): Promise<DuelSession | undefined>;
  updateDuelSession(id: number, updates: Partial<Pick<DuelSession, "outcome" | "eloDeltaPlayer1" | "eloDeltaPlayer2" | "endedAt">>): Promise<DuelSession | undefined>;

  getDuelRating(userId: number): Promise<DuelRating | undefined>;
  upsertDuelRating(userId: number, updates: Partial<Pick<DuelRating, "elo" | "wins" | "losses" | "draws">>): Promise<DuelRating>;
  getDuelLeaderboard(limit?: number, format?: "turn" | "race"): Promise<Array<{ rank: number; userId: number; displayName: string; avatarUrl: string | null; elo: number; wins: number; losses: number; draws: number; winRate: number }>>;
  getDuelRankContext(userId: number): Promise<{ rank: number; totalPlayers: number } | null>;

  getDuelSessionsForUser(userId: number): Promise<DuelSession[]>;

  // Huddle (Group vs Group)
  createHuddleChallenge(data: InsertHuddleChallenge): Promise<HuddleChallenge>;
  getHuddleChallenge(id: number): Promise<HuddleChallenge | undefined>;
  getHuddleChallengesForGroup(groupId: number): Promise<HuddleChallenge[]>;
  updateHuddleChallenge(id: number, updates: Partial<Pick<HuddleChallenge, "status" | "challengeeAdminId" | "roomCode" | "seed" | "startWord">>): Promise<HuddleChallenge | undefined>;
  getHuddleChallengeByRoom(roomCode: string): Promise<HuddleChallenge | undefined>;

  // Team Race (Group vs Group — all members play)
  createTeamRaceChallenge(data: InsertTeamRaceChallenge): Promise<TeamRaceChallenge>;
  getTeamRaceChallenge(id: number): Promise<TeamRaceChallenge | undefined>;
  getTeamRaceChallengesForGroup(groupId: number): Promise<TeamRaceChallenge[]>;
  updateTeamRaceChallenge(id: number, updates: Partial<Pick<TeamRaceChallenge, "status" | "challengeeAdminId" | "roomCode" | "seed" | "startWord" | "winnerGroupId">>): Promise<TeamRaceChallenge | undefined>;
  getTeamRaceChallengeByRoom(roomCode: string): Promise<TeamRaceChallenge | undefined>;

  getUsersWithStreakAtRisk(): Promise<Array<{ userId: number; currentStreak: number }>>;
  getSiteSetting(key: string): Promise<string | null>;
  setSiteSetting(key: string, value: string | null): Promise<void>;

  // Notifications
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(userId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationRead(id: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
  pruneNotifications(): Promise<number>;

  // Notification Preferences
  getNotificationPreferences(userId: number): Promise<Record<NotificationType, boolean>>;
  setNotificationPreference(userId: number, type: NotificationType, enabled: boolean): Promise<void>;
  setAllNotificationPreferences(userId: number, enabled: boolean): Promise<void>;

  // Word Wars
  createWordWarsTournament(data: InsertWordWarsTournament): Promise<WordWarsTournament>;
  getWordWarsTournament(id: number): Promise<WordWarsTournament | undefined>;
  listWordWarsTournaments(): Promise<WordWarsTournament[]>;
  updateWordWarsTournament(id: number, updates: Partial<Pick<WordWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minPlayers" | "maxPlayers" | "recurringCron">>): Promise<WordWarsTournament | undefined>;

  createWordWarsRegistration(tournamentId: number, userId: number): Promise<WordWarsRegistration>;
  getWordWarsRegistration(tournamentId: number, userId: number): Promise<WordWarsRegistration | undefined>;
  deleteWordWarsRegistration(tournamentId: number, userId: number): Promise<void>;
  getWordWarsRegistrationsForTournament(tournamentId: number): Promise<WordWarsRegistration[]>;

  createWordWarsMatch(data: Omit<WordWarsMatch, "id" | "createdAt">): Promise<WordWarsMatch>;
  getWordWarsMatch(id: number): Promise<WordWarsMatch | undefined>;
  listWordWarsMatchesForTournament(tournamentId: number): Promise<WordWarsMatch[]>;
  updateWordWarsMatch(id: number, updates: Partial<Pick<WordWarsMatch, "status" | "winnerId" | "deadline">>): Promise<WordWarsMatch | undefined>;

  createWordWarsMatchGame(data: Omit<WordWarsMatchGame, "id">): Promise<WordWarsMatchGame>;
  getWordWarsMatchGame(matchId: number, gameNumber: number): Promise<WordWarsMatchGame | undefined>;
  getWordWarsMatchGames(matchId: number): Promise<WordWarsMatchGame[]>;
  updateWordWarsMatchGame(id: number, updates: Partial<Pick<WordWarsMatchGame, "status" | "winnerId" | "roomCode">>): Promise<WordWarsMatchGame | undefined>;
  getMatchGameByRoomCode(roomCode: string): Promise<WordWarsMatchGame | undefined>;

  createWordWarsChampion(tournamentId: number, userId: number): Promise<WordWarsChampion>;
  getChampionsForTournament(tournamentId: number): Promise<WordWarsChampion[]>;
  getChampionshipsForUser(userId: number): Promise<WordWarsChampion[]>;
  listAllWordWarsChampions(): Promise<WordWarsChampion[]>;
  getWordWarsStatsForUser(userId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }>;

  // Guild Wars
  createGuildWarsTournament(data: InsertGuildWarsTournament): Promise<GuildWarsTournament>;
  getGuildWarsTournament(id: number): Promise<GuildWarsTournament | undefined>;
  listGuildWarsTournaments(): Promise<GuildWarsTournament[]>;
  updateGuildWarsTournament(id: number, updates: Partial<Pick<GuildWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minGroups" | "maxGroups">>): Promise<GuildWarsTournament | undefined>;

  createGuildWarsRegistration(tournamentId: number, groupId: number, registeredBy: number): Promise<GuildWarsRegistration>;
  getGuildWarsRegistration(tournamentId: number, groupId: number): Promise<GuildWarsRegistration | undefined>;
  deleteGuildWarsRegistration(tournamentId: number, groupId: number): Promise<void>;
  getGuildWarsRegistrationsForTournament(tournamentId: number): Promise<GuildWarsRegistration[]>;
  getGuildWarsRegistrationsForGroup(groupId: number): Promise<GuildWarsRegistration[]>;

  createGuildWarsMatch(data: Omit<GuildWarsMatch, "id" | "createdAt">): Promise<GuildWarsMatch>;
  getGuildWarsMatch(id: number): Promise<GuildWarsMatch | undefined>;
  listGuildWarsMatchesForTournament(tournamentId: number): Promise<GuildWarsMatch[]>;
  updateGuildWarsMatch(id: number, updates: Partial<Pick<GuildWarsMatch, "status" | "winnerGroupId" | "deadline">>): Promise<GuildWarsMatch | undefined>;

  createGuildWarsMatchGame(data: Omit<GuildWarsMatchGame, "id">): Promise<GuildWarsMatchGame>;
  getGuildWarsMatchGame(matchId: number, gameNumber: number): Promise<GuildWarsMatchGame | undefined>;
  getGuildWarsMatchGames(matchId: number): Promise<GuildWarsMatchGame[]>;
  updateGuildWarsMatchGame(id: number, updates: Partial<Pick<GuildWarsMatchGame, "status" | "winnerGroupId" | "roomCode">>): Promise<GuildWarsMatchGame | undefined>;
  getGuildWarsMatchGameByRoomCode(roomCode: string): Promise<GuildWarsMatchGame | undefined>;

  createGuildWarsChampion(tournamentId: number, groupId: number, tournamentName: string): Promise<GuildWarsChampion>;
  getGuildWarsChampionsForTournament(tournamentId: number): Promise<GuildWarsChampion[]>;
  getGuildWarsChampionshipsForGroup(groupId: number): Promise<GuildWarsChampion[]>;
  listAllGuildWarsChampions(): Promise<GuildWarsChampion[]>;
  getGuildWarsStatsForGroup(groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }>;
  getWordWarsStatsForGroup(groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }>;

  // Group Seasons
  createGroupSeason(data: import("@shared/schema").InsertGroupSeason): Promise<import("@shared/schema").GroupSeason>;
  getGroupSeasons(groupId: number): Promise<import("@shared/schema").GroupSeason[]>;
  getGroupSeason(id: number): Promise<import("@shared/schema").GroupSeason | undefined>;
  endGroupSeason(id: number, winnerId: number | null, winnerName: string | null): Promise<import("@shared/schema").GroupSeason | undefined>;
  getGroupSeasonLeaderboard(season: import("@shared/schema").GroupSeason): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>>;
}

export { MemStorage } from "./mem-storage";

let _storage: IStorage | null = null;

export function getStorage(): IStorage {
  if (!_storage) {
    throw new Error("Storage not initialized. Call initStorage() first.");
  }
  return _storage!;
}

export async function initStorage(): Promise<IStorage> {
  if (_storage) return _storage;
  
  if (process.env.MYSQL_DATABASE_URL) {
    console.log("[Storage] Using MySQL storage");
    const { MySQLStorage } = await import("./mysql-storage");
    _storage = new MySQLStorage();
  } else {
    console.log("[Storage] Using in-memory storage");
    const { MemStorage } = await import("./mem-storage");
    _storage = new MemStorage();
  }
  return _storage!;
}

export const storage: IStorage = new Proxy({} as IStorage, {
  get(_target, prop) {
    const s = _storage;
    if (!s) {
      throw new Error(`Storage not initialized when accessing '${String(prop)}'. Call initStorage() first.`);
    }
    const val = (s as any)[prop];
    if (typeof val === "function") {
      return val.bind(s);
    }
    return val;
  }
});
