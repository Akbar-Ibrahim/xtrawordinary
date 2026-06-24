import type { IStorage, LengthConstraint, PositionConstraint, ContainsConstraint } from "./storage";
import { MemStorage } from "./mem-storage";
import * as schema from "./db-schema";
import type {
  Game, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord,
  WordRootsPuzzle, WordLengthConfig, LetterPositionConfig, LetterHuntConfig, WordChainConfig,
  VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid,
  WordUnpackPuzzle, WordLadderPuzzle, LadderRushPuzzle, User, InsertUser,
  EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats,
  LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement, Friendship,
  InsertFriendship, FriendChallenge, InsertFriendChallenge, Group, InsertGroup, GroupMember,
  GroupRound, InsertGroupRound, GroupRoundScore, InsertGroupRoundScore, Comment, InsertComment,
  CommentReport, CommentTargetType, LikeTargetType, QuizSession, InsertQuizSession,
  QuizSessionScore, DuelChallenge, InsertDuelChallenge, DuelSession, InsertDuelSession,
  DuelRating, Notification, InsertNotification, NotificationType, DailyLeaderboardEntry,
  HuddleChallenge, InsertHuddleChallenge, TeamRaceChallenge, InsertTeamRaceChallenge,
  WordWarsTournament, InsertWordWarsTournament, WordWarsRegistration, WordWarsMatch,
  InsertWordWarsMatch, WordWarsMatchGame, InsertWordWarsMatchGame, WordWarsChampion,
  GuildWarsTournament, InsertGuildWarsTournament, GuildWarsRegistration, GuildWarsMatch,
  InsertGuildWarsMatch, GuildWarsMatchGame, InsertGuildWarsMatchGame, GuildWarsChampion,
} from "@shared/schema";

import * as Games from "./mysql/games";
import * as Words from "./mysql/words";
import * as Users from "./mysql/users";
import * as Stats from "./mysql/stats";
import * as Friends from "./mysql/friends";
import * as Groups from "./mysql/groups";
import * as Comments from "./mysql/comments";
import * as Notifications from "./mysql/notifications";
import * as Quiz from "./mysql/quiz";
import * as Duels from "./mysql/duels";
import * as Huddle from "./mysql/huddle";
import * as TeamRace from "./mysql/team-race";
import * as WordWars from "./mysql/word-wars";
import * as GuildWars from "./mysql/guild-wars";
import * as Admin from "./mysql/admin";

export class MySQLStorage implements IStorage {
  private gameData: MemStorage;
  private dbPromise: Promise<any>;
  private wordSet: Set<string> = new Set();

  static tsToIso(d: Date | string | null | undefined): string | null {
    return Duels.tsToIso(d);
  }

  constructor() {
    this.gameData = new MemStorage();
    if (!process.env.MYSQL_DATABASE_URL) {
      throw new Error("MYSQL_DATABASE_URL is required");
    }
    this.dbPromise = import("./db").then(async (m) => {
      const db = m.db;
      const rows = await db.select({ word: schema.words.word }).from(schema.words);
      for (const row of rows) this.wordSet.add(row.word.toUpperCase());
      console.log(`[MySQLStorage] Loaded ${this.wordSet.size} words into Set from MySQL`);
      return db;
    });
  }

  private async getDb(): Promise<any> {
    return this.dbPromise;
  }

  // ── Games ──────────────────────────────────────────────────────────────────
  async getGames(): Promise<Game[]> { return Games.getGames(await this.getDb()); }
  async getAllGames(): Promise<Game[]> { return Games.getAllGames(await this.getDb()); }
  async setGameActive(slug: string, isActive: boolean): Promise<void> { return Games.setGameActive(await this.getDb(), slug, isActive); }
  async getGameBySlug(slug: string): Promise<Game | undefined> { return Games.getGameBySlug(await this.getDb(), slug); }

  // ── Words / Game-data (in-memory fallbacks) ────────────────────────────────
  async getWordLadderPuzzles(): Promise<WordLadderPuzzle[]> { return this.gameData.getWordLadderPuzzles(); }
  async getLadderRushPuzzles(wordLength: number): Promise<LadderRushPuzzle[]> { return this.gameData.getLadderRushPuzzles(wordLength); }
  async getAnagramWordSets(): Promise<AnagramWordSet[]> { return this.gameData.getAnagramWordSets(); }
  async getScrambleWords(): Promise<ScrambleWord[]> { return this.gameData.getScrambleWords(); }
  async getDefinitionWords(): Promise<DefinitionWord[]> { return Words.getDefinitionWords(await this.getDb(), this.gameData); }
  async getLetterPoolWords(): Promise<LetterPoolWord[]> { return Words.getLetterPoolWords(await this.getDb(), this.gameData); }
  async getMakerWords(): Promise<MakerWord[]> { return Words.getMakerWords(await this.getDb(), this.gameData); }
  async getWordRootsPuzzles(): Promise<WordRootsPuzzle[]> { return Words.getWordRootsPuzzles(await this.getDb(), this.gameData); }
  async getWordStackPuzzles(): Promise<WordStackPuzzle[]> { return Words.getWordStackPuzzles(await this.getDb(), this.gameData); }
  async getWordSplitPuzzles(): Promise<WordSplitPuzzle[]> { return Words.getWordSplitPuzzles(await this.getDb(), this.gameData); }
  async getWordLengthConfig(): Promise<WordLengthConfig> { return this.gameData.getWordLengthConfig(); }
  async getLetterPositionConfig(): Promise<LetterPositionConfig> { return this.gameData.getLetterPositionConfig(); }
  async getLetterHuntConfig(): Promise<LetterHuntConfig> { return this.gameData.getLetterHuntConfig(); }
  async getWordChainConfig(): Promise<WordChainConfig> { return this.gameData.getWordChainConfig(); }
  async getVowelConsonantConfig(): Promise<VowelConsonantConfig> { return this.gameData.getVowelConsonantConfig(); }
  async getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]> { return this.gameData.getProgressiveRevealWords(); }
  async getWordSweepGrid(seed?: number): Promise<WordSweepGrid> { return this.gameData.getWordSweepGrid(seed); }
  async getWordUnpackPuzzles(): Promise<WordUnpackPuzzle[]> { return this.gameData.getWordUnpackPuzzles(); }
  async getWordBloomPuzzles(): Promise<any[]> { return this.gameData.getWordBloomPuzzles(); }
  async getWordStretchPuzzles(): Promise<any[]> { return this.gameData.getWordStretchPuzzles(); }
  async getWordChainStartWord(variation: number, level: number, seed?: number): Promise<string | null> { return Words.getWordChainStartWord(await this.getDb(), this.gameData, variation, level, seed); }
  async getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null> { return Words.getWordChainComputerWord(await this.getDb(), this.gameData, playerWord, variation, level, usedWords); }
  validateShellWord(word: string): { valid: boolean; innerWord: string | null } { return Words.validateShellWord(this.wordSet, word); }
  validateDeepShellWord(word: string): { valid: boolean; innerWord: string | null } { return Words.validateDeepShellWord(this.wordSet, word); }
  async getShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null> { return Words.getShellWordPuzzle(await this.getDb(), this.gameData, seed); }
  async getCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null> { return Words.getCrackPuzzle(await this.getDb(), this.gameData, seed); }
  async getDeepShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null> { return Words.getDeepShellWordPuzzle(await this.getDb(), this.gameData, seed); }
  async getDeepCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null> { return Words.getDeepCrackPuzzle(await this.getDb(), this.gameData, seed); }
  async getDeepCrackAnswer(seed: number): Promise<string | null> { return Words.getDeepCrackAnswer(await this.getDb(), this.gameData, seed); }
  async isValidWord(word: string): Promise<boolean> { return this.wordSet.has(word.toUpperCase()); }
  async searchWords(prefix: string, constraints?: { length?: LengthConstraint; position?: PositionConstraint; contains?: ContainsConstraint }): Promise<string[]> { return this.gameData.searchWords(prefix, constraints); }

  // ── Users ──────────────────────────────────────────────────────────────────
  async createUser(user: InsertUser): Promise<User> { return Users.createUser(await this.getDb(), user); }
  async getUserById(id: number): Promise<User | undefined> { return Users.getUserById(await this.getDb(), id); }
  async getUserByEmail(email: string): Promise<User | undefined> { return Users.getUserByEmail(await this.getDb(), email); }
  async getUserByGoogleId(googleId: string): Promise<User | undefined> { return Users.getUserByGoogleId(await this.getDb(), googleId); }
  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> { return Users.updateUser(await this.getDb(), id, updates); }
  async createEmailVerificationToken(userId: number, token: string, expiresAt: string): Promise<EmailVerificationToken> { return Users.createEmailVerificationToken(await this.getDb(), userId, token, expiresAt); }
  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> { return Users.getEmailVerificationToken(await this.getDb(), token); }
  async deleteEmailVerificationToken(token: string): Promise<void> { return Users.deleteEmailVerificationToken(await this.getDb(), token); }
  async createPasswordResetToken(userId: number, token: string, expiresAt: string): Promise<PasswordResetToken> { return Users.createPasswordResetToken(await this.getDb(), userId, token, expiresAt); }
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> { return Users.getPasswordResetToken(await this.getDb(), token); }
  async deletePasswordResetToken(token: string): Promise<void> { return Users.deletePasswordResetToken(await this.getDb(), token); }

  // ── Stats & Leaderboard ────────────────────────────────────────────────────
  async saveUserGameStats(stats: InsertUserGameStats): Promise<UserGameStats> { return Stats.saveUserGameStats(await this.getDb(), stats); }
  async getUserGameStats(userId: number, gameSlug: string): Promise<UserGameStats | undefined> { return Stats.getUserGameStats(await this.getDb(), userId, gameSlug); }
  async getAllUserGameStats(userId: number): Promise<UserGameStats[]> { return Stats.getAllUserGameStats(await this.getDb(), userId); }
  async saveLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> { return Stats.saveLeaderboardEntry(await this.getDb(), entry); }
  async getLeaderboard(gameSlug: string, limit?: number, timeFilter?: string): Promise<LeaderboardEntry[]> { return Stats.getLeaderboard(await this.getDb(), gameSlug, limit, timeFilter); }
  async getOverallLeaderboard(limit?: number, timeFilter?: string): Promise<LeaderboardEntry[]> { return Stats.getOverallLeaderboard(await this.getDb(), limit, timeFilter); }
  async getPlayerRank(gameSlug: string, userId: number, timeFilter?: string): Promise<{ rank: number; score: number; totalPlayers: number } | null> { return Stats.getPlayerRank(await this.getDb(), gameSlug, userId, timeFilter); }
  async getFriendsLeaderboard(gameSlug: string, userId: number): Promise<LeaderboardEntry[]> { return Stats.getFriendsLeaderboard(await this.getDb(), gameSlug, userId); }
  async incrementGamePlayCount(gameSlug: string): Promise<void> { return Stats.incrementGamePlayCount(await this.getDb(), gameSlug); }
  async getGamePlayCount(gameSlug: string): Promise<number> { return Stats.getGamePlayCount(await this.getDb(), gameSlug); }
  async getAllGamePlayCounts(): Promise<Record<string, number>> { return Stats.getAllGamePlayCounts(await this.getDb()); }
  async getUserStreak(userId: number): Promise<UserStreak | undefined> { return Stats.getUserStreak(await this.getDb(), userId); }
  async saveUserStreak(userId: number, currentStreak: number, longestStreak: number, lastPlayedDate: string): Promise<UserStreak> { return Stats.saveUserStreak(await this.getDb(), userId, currentStreak, longestStreak, lastPlayedDate); }
  async getTopStreaks(limit: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; currentStreak: number; longestStreak: number }>> { return Stats.getTopStreaks(await this.getDb(), limit); }
  async getStreakBatch(userIds: number[]): Promise<Record<number, number>> { return Stats.getStreakBatch(await this.getDb(), userIds); }
  async updateDailyChallengeStreak(userId: number, date: string): Promise<{ streak: number; longest: number; alreadyDone: boolean }> { return Stats.updateDailyChallengeStreak(await this.getDb(), userId, date); }
  async getLeaderboardPercentile(gameSlug: string, score: number): Promise<{ percentile: number; totalPlayers: number }> { return Stats.getLeaderboardPercentile(await this.getDb(), gameSlug, score); }
  async getUserAchievements(userId: number): Promise<UserAchievement[]> { return Stats.getUserAchievements(await this.getDb(), userId); }
  async saveUserAchievement(userId: number, achievementId: string, unlockedAt: string): Promise<UserAchievement> { return Stats.saveUserAchievement(await this.getDb(), userId, achievementId, unlockedAt); }
  async getAchievementRarities(): Promise<Record<string, number>> { return Stats.getAchievementRarities(await this.getDb()); }
  async getUsersWithStreakAtRisk(): Promise<Array<{ userId: number; currentStreak: number }>> { return Stats.getUsersWithStreakAtRisk(await this.getDb()); }
  async getFriendsWhoPlayGame(gameSlug: string, userId: number): Promise<Array<{ id: number; name: string; avatarUrl: string | null; gamesPlayed: number }>> { return Stats.getFriendsWhoPlayGame(await this.getDb(), gameSlug, userId); }
  async saveDailyChallengeScore(userId: number, challengeDate: string, gameSlug: string, score: number): Promise<void> { return Stats.saveDailyChallengeScore(await this.getDb(), userId, challengeDate, gameSlug, score); }
  async getDailyLeaderboard(challengeDate: string, gameSlug: string, requestingUserId?: number): Promise<{ entries: DailyLeaderboardEntry[]; myRank?: number; myScore?: number }> { return Stats.getDailyLeaderboard(await this.getDb(), challengeDate, gameSlug, requestingUserId); }

  // ── Friends ────────────────────────────────────────────────────────────────
  async getFriendshipById(id: number): Promise<Friendship | undefined> { return Friends.getFriendshipById(await this.getDb(), id); }
  async sendFriendRequest(requesterId: number, addresseeId: number): Promise<Friendship> { return Friends.sendFriendRequest(await this.getDb(), requesterId, addresseeId); }
  async acceptFriendRequest(id: number): Promise<Friendship | undefined> { return Friends.acceptFriendRequest(await this.getDb(), id); }
  async declineFriendRequest(id: number): Promise<Friendship | undefined> { return Friends.declineFriendRequest(await this.getDb(), id); }
  async removeFriend(id: number): Promise<void> { return Friends.removeFriend(await this.getDb(), id); }
  async getFriends(userId: number): Promise<any[]> { return Friends.getFriends(await this.getDb(), userId); }
  async getPendingFriendRequests(userId: number): Promise<any[]> { return Friends.getPendingFriendRequests(await this.getDb(), userId); }
  async getFriendship(userId1: number, userId2: number): Promise<Friendship | undefined> { return Friends.getFriendship(await this.getDb(), userId1, userId2); }
  async createFriendChallenge(challenge: InsertFriendChallenge): Promise<FriendChallenge> { return Friends.createFriendChallenge(await this.getDb(), challenge); }
  async getFriendChallenges(userId: number): Promise<FriendChallenge[]> { return Friends.getFriendChallenges(await this.getDb(), userId); }
  async getFriendChallenge(id: number): Promise<FriendChallenge | undefined> { return Friends.getFriendChallenge(await this.getDb(), id); }
  async getPendingFriendChallenge(senderId: number, receiverId: number, gameSlug: string): Promise<FriendChallenge | undefined> { return Friends.getPendingFriendChallenge(await this.getDb(), senderId, receiverId, gameSlug); }
  async completeFriendChallenge(id: number, score: number): Promise<FriendChallenge | undefined> { return Friends.completeFriendChallenge(await this.getDb(), id, score); }
  async cancelFriendChallenge(id: number): Promise<FriendChallenge | undefined> { return Friends.cancelFriendChallenge(await this.getDb(), id); }
  async declineFriendChallenge(id: number): Promise<FriendChallenge | undefined> { return Friends.declineFriendChallenge(await this.getDb(), id); }
  async markChallengeViewed(id: number): Promise<void> { return Friends.markChallengeViewed(await this.getDb(), id); }
  async markChallengeReceiverViewed(id: number): Promise<void> { return Friends.markChallengeReceiverViewed(await this.getDb(), id); }
  async expireFriendChallenges(): Promise<number> { return Friends.expireFriendChallenges(await this.getDb()); }

  // ── Groups ─────────────────────────────────────────────────────────────────
  async createGroup(group: InsertGroup): Promise<Group> { return Groups.createGroup(await this.getDb(), group); }
  async getGroup(id: number): Promise<Group | undefined> { return Groups.getGroup(await this.getDb(), id); }
  async getGroupByInviteCode(code: string): Promise<Group | undefined> { return Groups.getGroupByInviteCode(await this.getDb(), code); }
  async updateGroup(id: number, updates: Partial<InsertGroup>): Promise<Group | undefined> { return Groups.updateGroup(await this.getDb(), id, updates); }
  async deleteGroup(id: number): Promise<void> { return Groups.deleteGroup(await this.getDb(), id); }
  async getUserGroups(userId: number): Promise<Group[]> { return Groups.getUserGroups(await this.getDb(), userId); }
  async getPublicGroups(limit?: number): Promise<Group[]> { return Groups.getPublicGroups(await this.getDb(), limit); }
  async getAllGroups(): Promise<Group[]> { return Groups.getAllGroups(await this.getDb()); }
  async addGroupMember(groupId: number, userId: number, role: GroupMember["role"]): Promise<GroupMember> { return Groups.addGroupMember(await this.getDb(), groupId, userId, role); }
  async removeGroupMember(groupId: number, userId: number): Promise<void> { return Groups.removeGroupMember(await this.getDb(), groupId, userId); }
  async getGroupMembers(groupId: number): Promise<any[]> { return Groups.getGroupMembers(await this.getDb(), groupId); }
  async getGroupMember(groupId: number, userId: number): Promise<GroupMember | undefined> { return Groups.getGroupMember(await this.getDb(), groupId, userId); }
  async updateGroupMemberRole(groupId: number, userId: number, role: GroupMember["role"]): Promise<GroupMember | undefined> { return Groups.updateGroupMemberRole(await this.getDb(), groupId, userId, role); }
  async createGroupRound(round: InsertGroupRound): Promise<GroupRound> { return Groups.createGroupRound(await this.getDb(), round); }
  async getGroupRound(id: number): Promise<GroupRound | undefined> { return Groups.getGroupRound(await this.getDb(), id); }
  async getGroupRounds(groupId: number, limit?: number): Promise<GroupRound[]> { return Groups.getGroupRounds(await this.getDb(), groupId, limit); }
  async closeGroupRound(id: number): Promise<GroupRound | undefined> { return Groups.closeGroupRound(await this.getDb(), id); }
  async submitGroupRoundScore(score: InsertGroupRoundScore): Promise<GroupRoundScore> { return Groups.submitGroupRoundScore(await this.getDb(), score); }
  async getGroupRoundScores(roundId: number): Promise<any[]> { return Groups.getGroupRoundScores(await this.getDb(), roundId); }
  async getUserGroupRoundScore(roundId: number, userId: number): Promise<GroupRoundScore | undefined> { return Groups.getUserGroupRoundScore(await this.getDb(), roundId, userId); }
  async getGroupLeaderboard(groupId: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; gamesPlayed: number }>> { return Groups.getGroupLeaderboard(await this.getDb(), groupId); }
  async setGroupFeatured(id: number, isFeatured: boolean): Promise<void> { return Groups.setGroupFeatured(await this.getDb(), id, isFeatured); }
  async addGroupReaction(roundId: number, userId: number, emoji: string): Promise<void> { return Groups.addGroupReaction(await this.getDb(), roundId, userId, emoji); }
  async removeGroupReaction(roundId: number, userId: number, emoji: string): Promise<void> { return Groups.removeGroupReaction(await this.getDb(), roundId, userId, emoji); }
  async getGroupRoundReactions(roundId: number): Promise<Record<string, number[]>> { return Groups.getGroupRoundReactions(await this.getDb(), roundId); }
  async logGroupActivity(groupId: number, userId: number, type: string, data?: Record<string, unknown>): Promise<void> { return Groups.logGroupActivity(await this.getDb(), groupId, userId, type, data); }
  async getGroupActivity(groupId: number, limit?: number): Promise<any[]> { return Groups.getGroupActivity(await this.getDb(), groupId, limit); }
  async createGroupRoundAttempt(roundId: number, userId: number): Promise<void> { return Groups.createGroupRoundAttempt(await this.getDb(), roundId, userId); }
  async getGroupRoundAttempt(roundId: number, userId: number): Promise<boolean> { return Groups.getGroupRoundAttempt(await this.getDb(), roundId, userId); }
  async createDailyChallengeAttempt(userId: number, challengeDate: string, gameSlug: string): Promise<void> { return Groups.createDailyChallengeAttempt(await this.getDb(), userId, challengeDate, gameSlug); }
  async getDailyChallengeAttempt(userId: number, challengeDate: string, gameSlug: string): Promise<boolean> { return Groups.getDailyChallengeAttempt(await this.getDb(), userId, challengeDate, gameSlug); }

  // ── Comments & Likes ───────────────────────────────────────────────────────
  async createComment(comment: InsertComment): Promise<Comment> { return Comments.createComment(await this.getDb(), comment); }
  async getComments(targetType: CommentTargetType, targetId: string, userId?: number): Promise<Comment[]> { return Comments.getComments(await this.getDb(), targetType, targetId, userId); }
  async getCommentById(id: number): Promise<Comment | null> { return Comments.getCommentById(await this.getDb(), id); }
  async deleteComment(id: number, userId: number, isAdmin?: boolean): Promise<boolean> { return Comments.deleteComment(await this.getDb(), id, userId, isAdmin); }
  async updateComment(id: number, userId: number, content: string): Promise<Comment | null> { return Comments.updateComment(await this.getDb(), id, userId, content); }
  async deleteCommentAdmin(id: number): Promise<void> { return Comments.deleteCommentAdmin(await this.getDb(), id); }
  async reportComment(commentId: number, reportingUserId: number, reason: string): Promise<CommentReport> { return Comments.reportComment(await this.getDb(), commentId, reportingUserId, reason); }
  async getCommentReports(): Promise<CommentReport[]> { return Comments.getCommentReports(await this.getDb()); }
  async getRecentCommentCount(userId: number, since: Date): Promise<number> { return Comments.getRecentCommentCount(await this.getDb(), userId, since); }
  async toggleLike(userId: number, targetType: LikeTargetType, targetId: string): Promise<{ liked: boolean; count: number }> { return Comments.toggleLike(await this.getDb(), userId, targetType, targetId); }
  async getLikeCounts(targetType: LikeTargetType, targetIds: string[]): Promise<Record<string, number>> { return Comments.getLikeCounts(await this.getDb(), targetType, targetIds); }
  async getUserLikes(userId: number, targetType: LikeTargetType, targetIds: string[]): Promise<Set<string>> { return Comments.getUserLikes(await this.getDb(), userId, targetType, targetIds); }

  // ── Notifications ──────────────────────────────────────────────────────────
  async createNotification(data: InsertNotification): Promise<Notification> { return Notifications.createNotification(await this.getDb(), data); }
  async getNotifications(userId: number, limit?: number): Promise<Notification[]> { return Notifications.getNotifications(await this.getDb(), userId, limit); }
  async getUnreadNotificationCount(userId: number): Promise<number> { return Notifications.getUnreadNotificationCount(await this.getDb(), userId); }
  async markNotificationRead(id: number, userId: number): Promise<void> { return Notifications.markNotificationRead(await this.getDb(), id, userId); }
  async markAllNotificationsRead(userId: number): Promise<void> { return Notifications.markAllNotificationsRead(await this.getDb(), userId); }
  async pruneNotifications(): Promise<number> { return Notifications.pruneNotifications(await this.getDb()); }
  async getNotificationPreferences(userId: number): Promise<Record<NotificationType, boolean>> { return Notifications.getNotificationPreferences(await this.getDb(), userId); }
  async setNotificationPreference(userId: number, type: NotificationType, enabled: boolean): Promise<void> { return Notifications.setNotificationPreference(await this.getDb(), userId, type, enabled); }
  async setAllNotificationPreferences(userId: number, enabled: boolean): Promise<void> { return Notifications.setAllNotificationPreferences(await this.getDb(), userId, enabled); }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  async createQuizSession(session: InsertQuizSession): Promise<QuizSession> { return Quiz.createQuizSession(await this.getDb(), session); }
  async getQuizSessionByCode(shareCode: string): Promise<QuizSession | undefined> { return Quiz.getQuizSessionByCode(await this.getDb(), shareCode); }
  async getQuizSessionsByCreator(creatorId: number): Promise<QuizSession[]> { return Quiz.getQuizSessionsByCreator(await this.getDb(), creatorId); }
  async addQuizSessionScore(sessionId: number, userId: number, score: number, guestName?: string | null): Promise<QuizSessionScore> { return Quiz.addQuizSessionScore(await this.getDb(), sessionId, userId, score, guestName); }
  async getQuizSessionScores(sessionId: number): Promise<QuizSessionScore[]> { return Quiz.getQuizSessionScores(await this.getDb(), sessionId); }
  async getQuizSessionScore(sessionId: number, userId: number): Promise<QuizSessionScore | undefined> { return Quiz.getQuizSessionScore(await this.getDb(), sessionId, userId); }
  async deleteQuizSession(id: number): Promise<void> { return Quiz.deleteQuizSession(await this.getDb(), id); }

  // ── Duels ──────────────────────────────────────────────────────────────────
  async createDuelChallenge(c: InsertDuelChallenge): Promise<DuelChallenge> { return Duels.createDuelChallenge(await this.getDb(), c); }
  async getDuelChallenge(id: number): Promise<DuelChallenge | undefined> { return Duels.getDuelChallenge(await this.getDb(), id); }
  async getDuelChallengeByRoom(roomCode: string): Promise<DuelChallenge | undefined> { return Duels.getDuelChallengeByRoom(await this.getDb(), roomCode); }
  async updateDuelChallengeStatus(id: number, status: DuelChallenge["status"], roomCode?: string): Promise<DuelChallenge | undefined> { return Duels.updateDuelChallengeStatus(await this.getDb(), id, status, roomCode); }
  async getDuelChallengesForUser(userId: number): Promise<DuelChallenge[]> { return Duels.getDuelChallengesForUser(await this.getDb(), userId); }
  async updateDuelChallengeChallengee(id: number, challengeeId: number): Promise<DuelChallenge | undefined> { return Duels.updateDuelChallengeChallengee(await this.getDb(), id, challengeeId); }
  async acceptOpenDuelChallenge(id: number, challengeeId: number, roomCode: string): Promise<DuelChallenge | undefined> { return Duels.acceptOpenDuelChallenge(await this.getDb(), id, challengeeId, roomCode); }
  async getOpenDuelChallenges(gameSlug?: string): Promise<DuelChallenge[]> { return Duels.getOpenDuelChallenges(await this.getDb(), gameSlug); }
  async expireOpenChallenges(): Promise<number> { return Duels.expireOpenChallenges(await this.getDb()); }
  async createDuelSession(session: InsertDuelSession): Promise<DuelSession> { return Duels.createDuelSession(await this.getDb(), session); }
  async getDuelSession(id: number): Promise<DuelSession | undefined> { return Duels.getDuelSession(await this.getDb(), id); }
  async getDuelSessionByRoom(roomCode: string): Promise<DuelSession | undefined> { return Duels.getDuelSessionByRoom(await this.getDb(), roomCode); }
  async updateDuelSession(id: number, updates: any): Promise<DuelSession | undefined> { return Duels.updateDuelSession(await this.getDb(), id, updates); }
  async getDuelSessionsForUser(userId: number, limit?: number): Promise<DuelSession[]> { return Duels.getDuelSessionsForUser(await this.getDb(), userId, limit); }
  async getDuelRating(userId: number, gameSlug: string): Promise<DuelRating | undefined> { return Duels.getDuelRating(await this.getDb(), userId, gameSlug); }
  async getDuelLeaderboard(gameSlug: string, limit?: number): Promise<LeaderboardEntry[]> { return Duels.getDuelLeaderboard(await this.getDb(), gameSlug, limit); }
  async upsertDuelRating(userId: number, gameSlug: string, rating: number, outcome: "win" | "loss" | "draw"): Promise<DuelRating> { return Duels.upsertDuelRating(await this.getDb(), userId, gameSlug, rating, outcome); }
  async getDuelRankContext(userId: number, gameSlug: string): Promise<{ rank: number; totalPlayers: number; rating: number } | null> { return Duels.getDuelRankContext(await this.getDb(), userId, gameSlug); }

  // ── Huddle ─────────────────────────────────────────────────────────────────
  async createHuddleChallenge(data: InsertHuddleChallenge): Promise<HuddleChallenge> { return Huddle.createHuddleChallenge(await this.getDb(), data); }
  async getHuddleChallenge(id: number): Promise<HuddleChallenge | undefined> { return Huddle.getHuddleChallenge(await this.getDb(), id); }
  async getHuddleChallengesForGroup(groupId: number): Promise<HuddleChallenge[]> { return Huddle.getHuddleChallengesForGroup(await this.getDb(), groupId); }
  async updateHuddleChallenge(id: number, updates: Partial<InsertHuddleChallenge>): Promise<HuddleChallenge | undefined> { return Huddle.updateHuddleChallenge(await this.getDb(), id, updates); }
  async getHuddleChallengeByRoom(roomCode: string): Promise<HuddleChallenge | undefined> { return Huddle.getHuddleChallengeByRoom(await this.getDb(), roomCode); }

  // ── Team Race ──────────────────────────────────────────────────────────────
  async createTeamRaceChallenge(data: InsertTeamRaceChallenge): Promise<TeamRaceChallenge> { return TeamRace.createTeamRaceChallenge(await this.getDb(), data); }
  async getTeamRaceChallenge(id: number): Promise<TeamRaceChallenge | undefined> { return TeamRace.getTeamRaceChallenge(await this.getDb(), id); }
  async getTeamRaceChallengesForGroup(groupId: number): Promise<TeamRaceChallenge[]> { return TeamRace.getTeamRaceChallengesForGroup(await this.getDb(), groupId); }
  async updateTeamRaceChallenge(id: number, updates: Partial<InsertTeamRaceChallenge>): Promise<TeamRaceChallenge | undefined> { return TeamRace.updateTeamRaceChallenge(await this.getDb(), id, updates); }
  async getTeamRaceChallengeByRoom(roomCode: string): Promise<TeamRaceChallenge | undefined> { return TeamRace.getTeamRaceChallengeByRoom(await this.getDb(), roomCode); }

  // ── Word Wars ──────────────────────────────────────────────────────────────
  async createWordWarsTournament(data: InsertWordWarsTournament): Promise<WordWarsTournament> { return WordWars.createWordWarsTournament(await this.getDb(), data); }
  async getWordWarsTournament(id: number): Promise<WordWarsTournament | undefined> { return WordWars.getWordWarsTournament(await this.getDb(), id); }
  async listWordWarsTournaments(): Promise<WordWarsTournament[]> { return WordWars.listWordWarsTournaments(await this.getDb()); }
  async updateWordWarsTournament(id: number, updates: any): Promise<WordWarsTournament | undefined> { return WordWars.updateWordWarsTournament(await this.getDb(), id, updates); }
  async createWordWarsRegistration(tournamentId: number, userId: number, seed?: number): Promise<WordWarsRegistration> { return WordWars.createWordWarsRegistration(await this.getDb(), tournamentId, userId, seed); }
  async getWordWarsRegistration(id: number): Promise<WordWarsRegistration | undefined> { return WordWars.getWordWarsRegistration(await this.getDb(), id); }
  async deleteWordWarsRegistration(tournamentId: number, userId: number): Promise<void> { return WordWars.deleteWordWarsRegistration(await this.getDb(), tournamentId, userId); }
  async getWordWarsRegistrationsForTournament(tournamentId: number): Promise<any[]> { return WordWars.getWordWarsRegistrationsForTournament(await this.getDb(), tournamentId); }
  async createWordWarsMatch(data: InsertWordWarsMatch): Promise<WordWarsMatch> { return WordWars.createWordWarsMatch(await this.getDb(), data); }
  async getWordWarsMatch(id: number): Promise<WordWarsMatch | undefined> { return WordWars.getWordWarsMatch(await this.getDb(), id); }
  async listWordWarsMatchesForTournament(tournamentId: number): Promise<WordWarsMatch[]> { return WordWars.listWordWarsMatchesForTournament(await this.getDb(), tournamentId); }
  async updateWordWarsMatch(id: number, updates: any): Promise<WordWarsMatch | undefined> { return WordWars.updateWordWarsMatch(await this.getDb(), id, updates); }
  async createWordWarsMatchGame(data: InsertWordWarsMatchGame): Promise<WordWarsMatchGame> { return WordWars.createWordWarsMatchGame(await this.getDb(), data); }
  async getWordWarsMatchGame(id: number): Promise<WordWarsMatchGame | undefined> { return WordWars.getWordWarsMatchGame(await this.getDb(), id); }
  async getWordWarsMatchGames(matchId: number): Promise<WordWarsMatchGame[]> { return WordWars.getWordWarsMatchGames(await this.getDb(), matchId); }
  async updateWordWarsMatchGame(id: number, updates: any): Promise<WordWarsMatchGame | undefined> { return WordWars.updateWordWarsMatchGame(await this.getDb(), id, updates); }
  async getMatchGameByRoomCode(roomCode: string): Promise<WordWarsMatchGame | undefined> { return WordWars.getMatchGameByRoomCode(await this.getDb(), roomCode); }
  async createWordWarsChampion(tournamentId: number, userId: number): Promise<WordWarsChampion> { return WordWars.createWordWarsChampion(await this.getDb(), tournamentId, userId); }
  async getChampionsForTournament(tournamentId: number): Promise<WordWarsChampion[]> { return WordWars.getChampionsForTournament(await this.getDb(), tournamentId); }
  async getChampionshipsForUser(userId: number): Promise<WordWarsChampion[]> { return WordWars.getChampionshipsForUser(await this.getDb(), userId); }
  async listAllWordWarsChampions(): Promise<any[]> { return WordWars.listAllWordWarsChampions(await this.getDb()); }
  async getWordWarsStatsForUser(userId: number): Promise<any> { return WordWars.getWordWarsStatsForUser(await this.getDb(), userId); }
  async getWordWarsStatsForGroup(groupId: number): Promise<any[]> { return WordWars.getWordWarsStatsForGroup(await this.getDb(), groupId); }

  // ── Guild Wars ─────────────────────────────────────────────────────────────
  async createGuildWarsTournament(data: InsertGuildWarsTournament): Promise<GuildWarsTournament> { return GuildWars.createGuildWarsTournament(await this.getDb(), data); }
  async getGuildWarsTournament(id: number): Promise<GuildWarsTournament | undefined> { return GuildWars.getGuildWarsTournament(await this.getDb(), id); }
  async listGuildWarsTournaments(): Promise<GuildWarsTournament[]> { return GuildWars.listGuildWarsTournaments(await this.getDb()); }
  async updateGuildWarsTournament(id: number, updates: any): Promise<GuildWarsTournament | undefined> { return GuildWars.updateGuildWarsTournament(await this.getDb(), id, updates); }
  async createGuildWarsRegistration(tournamentId: number, groupId: number, adminId: number, seed?: number): Promise<GuildWarsRegistration> { return GuildWars.createGuildWarsRegistration(await this.getDb(), tournamentId, groupId, adminId, seed); }
  async getGuildWarsRegistration(id: number): Promise<GuildWarsRegistration | undefined> { return GuildWars.getGuildWarsRegistration(await this.getDb(), id); }
  async deleteGuildWarsRegistration(tournamentId: number, groupId: number): Promise<void> { return GuildWars.deleteGuildWarsRegistration(await this.getDb(), tournamentId, groupId); }
  async getGuildWarsRegistrationsForTournament(tournamentId: number): Promise<any[]> { return GuildWars.getGuildWarsRegistrationsForTournament(await this.getDb(), tournamentId); }
  async getGuildWarsRegistrationsForGroup(groupId: number): Promise<GuildWarsRegistration[]> { return GuildWars.getGuildWarsRegistrationsForGroup(await this.getDb(), groupId); }
  async createGuildWarsMatch(data: InsertGuildWarsMatch): Promise<GuildWarsMatch> { return GuildWars.createGuildWarsMatch(await this.getDb(), data); }
  async getGuildWarsMatch(id: number): Promise<GuildWarsMatch | undefined> { return GuildWars.getGuildWarsMatch(await this.getDb(), id); }
  async listGuildWarsMatchesForTournament(tournamentId: number): Promise<GuildWarsMatch[]> { return GuildWars.listGuildWarsMatchesForTournament(await this.getDb(), tournamentId); }
  async updateGuildWarsMatch(id: number, updates: any): Promise<GuildWarsMatch | undefined> { return GuildWars.updateGuildWarsMatch(await this.getDb(), id, updates); }
  async createGuildWarsMatchGame(data: InsertGuildWarsMatchGame): Promise<GuildWarsMatchGame> { return GuildWars.createGuildWarsMatchGame(await this.getDb(), data); }
  async getGuildWarsMatchGame(id: number): Promise<GuildWarsMatchGame | undefined> { return GuildWars.getGuildWarsMatchGame(await this.getDb(), id); }
  async getGuildWarsMatchGames(matchId: number): Promise<GuildWarsMatchGame[]> { return GuildWars.getGuildWarsMatchGames(await this.getDb(), matchId); }
  async updateGuildWarsMatchGame(id: number, updates: any): Promise<GuildWarsMatchGame | undefined> { return GuildWars.updateGuildWarsMatchGame(await this.getDb(), id, updates); }
  async getGuildWarsMatchGameByRoomCode(roomCode: string): Promise<GuildWarsMatchGame | undefined> { return GuildWars.getGuildWarsMatchGameByRoomCode(await this.getDb(), roomCode); }
  async createGuildWarsChampion(tournamentId: number, groupId: number): Promise<GuildWarsChampion> { return GuildWars.createGuildWarsChampion(await this.getDb(), tournamentId, groupId); }
  async getGuildWarsChampionsForTournament(tournamentId: number): Promise<GuildWarsChampion[]> { return GuildWars.getGuildWarsChampionsForTournament(await this.getDb(), tournamentId); }
  async getGuildWarsChampionshipsForGroup(groupId: number): Promise<GuildWarsChampion[]> { return GuildWars.getGuildWarsChampionshipsForGroup(await this.getDb(), groupId); }
  async listAllGuildWarsChampions(): Promise<any[]> { return GuildWars.listAllGuildWarsChampions(await this.getDb()); }
  async getGuildWarsStatsForGroup(groupId: number): Promise<any> { return GuildWars.getGuildWarsStatsForGroup(await this.getDb(), groupId); }

  // ── Admin ──────────────────────────────────────────────────────────────────
  async getAllUsers(limit?: number, offset?: number): Promise<User[]> { return Admin.getAllUsers(await this.getDb(), limit, offset); }
  async deleteUser(id: number): Promise<void> { return Admin.deleteUser(await this.getDb(), id); }
  async searchUsers(query: string, limit?: number): Promise<User[]> { return Admin.searchUsers(await this.getDb(), query, limit); }
  async getPublicProfile(userId: number): Promise<any> { return Admin.getPublicProfile(await this.getDb(), userId); }
  async getAdminStats(): Promise<any> { return Admin.getAdminStats(await this.getDb()); }
  async getAllLeaderboardEntries(gameSlug?: string): Promise<LeaderboardEntry[]> { return Admin.getAllLeaderboardEntries(await this.getDb(), gameSlug); }
  async deleteLeaderboardEntry(id: number): Promise<void> { return Admin.deleteLeaderboardEntry(await this.getDb(), id); }
  async getSiteSetting(key: string): Promise<string | null> { return Admin.getSiteSetting(await this.getDb(), key); }
  async setSiteSetting(key: string, value: string): Promise<void> { return Admin.setSiteSetting(await this.getDb(), key, value); }
}
