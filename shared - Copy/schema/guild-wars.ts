import { z } from "zod";

export const guildWarsTournamentStatusSchema = z.enum(["registration", "active", "completed", "cancelled"]);
export type GuildWarsTournamentStatus = z.infer<typeof guildWarsTournamentStatusSchema>;

export const guildWarsTournamentSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: guildWarsTournamentStatusSchema,
  registrationDeadline: z.string(),
  roundDeadlineHours: z.number(),
  minGroups: z.number(),
  maxGroups: z.number().nullable(),
  createdBy: z.number(),
  createdAt: z.string(),
});
export type GuildWarsTournament = z.infer<typeof guildWarsTournamentSchema>;

export const insertGuildWarsTournamentSchema = guildWarsTournamentSchema.omit({ id: true, createdAt: true, status: true });
export type InsertGuildWarsTournament = z.infer<typeof insertGuildWarsTournamentSchema>;

export const guildWarsRegistrationSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  groupId: z.number(),
  registeredBy: z.number(),
  createdAt: z.string(),
});
export type GuildWarsRegistration = z.infer<typeof guildWarsRegistrationSchema>;
export const insertGuildWarsRegistrationSchema = guildWarsRegistrationSchema.omit({ id: true, createdAt: true });
export type InsertGuildWarsRegistration = z.infer<typeof insertGuildWarsRegistrationSchema>;

export const guildWarsMatchStatusSchema = z.enum(["pending", "active", "completed", "forfeited", "bye"]);
export type GuildWarsMatchStatus = z.infer<typeof guildWarsMatchStatusSchema>;

export const guildWarsMatchSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  round: z.number(),
  group1Id: z.number().nullable(),
  group2Id: z.number().nullable(),
  winnerGroupId: z.number().nullable(),
  status: guildWarsMatchStatusSchema,
  deadline: z.string().nullable(),
  game1Slug: z.string(),
  game2Slug: z.string(),
  game3Slug: z.string(),
  createdAt: z.string(),
});
export type GuildWarsMatch = z.infer<typeof guildWarsMatchSchema>;
export const insertGuildWarsMatchSchema = guildWarsMatchSchema.omit({ id: true, createdAt: true });
export type InsertGuildWarsMatch = z.infer<typeof insertGuildWarsMatchSchema>;

export const guildWarsMatchGameStatusSchema = z.enum(["pending", "active", "completed"]);
export type GuildWarsMatchGameStatus = z.infer<typeof guildWarsMatchGameStatusSchema>;

export const guildWarsMatchGameSchema = z.object({
  id: z.number(),
  matchId: z.number(),
  gameNumber: z.number(),
  gameSlug: z.string(),
  roomCode: z.string().nullable(),
  winnerGroupId: z.number().nullable(),
  status: guildWarsMatchGameStatusSchema,
});
export type GuildWarsMatchGame = z.infer<typeof guildWarsMatchGameSchema>;
export const insertGuildWarsMatchGameSchema = guildWarsMatchGameSchema.omit({ id: true });
export type InsertGuildWarsMatchGame = z.infer<typeof insertGuildWarsMatchGameSchema>;

export const guildWarsChampionSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  groupId: z.number(),
  tournamentName: z.string(),
  createdAt: z.string(),
});
export type GuildWarsChampion = z.infer<typeof guildWarsChampionSchema>;
export const insertGuildWarsChampionSchema = guildWarsChampionSchema.omit({ id: true, createdAt: true });
export type InsertGuildWarsChampion = z.infer<typeof insertGuildWarsChampionSchema>;
