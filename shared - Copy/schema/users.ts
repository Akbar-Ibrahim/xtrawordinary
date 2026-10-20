import { z } from "zod";

export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  username: z.string(),
  usernameNormalized: z.string(),
  passwordHash: z.string().nullable(),
  googleId: z.string().nullable(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  isAdmin: z.boolean(),
  isBanned: z.boolean(),
  isPremium: z.boolean(),
  bio: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;

export const publicUserSchema = userSchema.pick({
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
  bio: true,
  isPremium: true,
  createdAt: true,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const authenticatedUserSchema = publicUserSchema.extend({
  email: z.string().email(),
  emailVerified: z.boolean(),
  isAdmin: z.boolean(),
});
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const emailVerificationTokenSchema = z.object({
  id: z.number(),
  userId: z.number(),
  token: z.string(),
  expiresAt: z.string(),
});
export type EmailVerificationToken = z.infer<typeof emailVerificationTokenSchema>;

export const passwordResetTokenSchema = z.object({
  id: z.number(),
  userId: z.number(),
  token: z.string(),
  expiresAt: z.string(),
});
export type PasswordResetToken = z.infer<typeof passwordResetTokenSchema>;
