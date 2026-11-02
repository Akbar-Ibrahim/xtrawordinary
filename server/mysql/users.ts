import { eq, inArray } from "drizzle-orm";
import type { User, InsertUser, EmailVerificationToken, PasswordResetToken } from "@shared/schema";
import * as schema from "../db-schema";

export function toUser(row: any): User {
  const lastActiveAt = row.lastActiveAt ?? null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    username: row.username,
    usernameNormalized: row.usernameNormalized,
    passwordHash: row.passwordHash || null,
    googleId: row.googleId || null,
    emailVerified: !!row.emailVerified,
    avatarUrl: row.avatarUrl || null,
    isAdmin: !!row.isAdmin,
    isBanned: !!row.isBanned,
    isPremium: !!row.isPremium,
    bio: row.bio || null,
    hideActivity: !!row.hideActivity,
    lastActiveAt: lastActiveAt == null
      ? null
      : lastActiveAt instanceof Date
        ? lastActiveAt.toISOString()
        : String(lastActiveAt),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export async function createUser(db: any, user: InsertUser): Promise<User> {
  const result = await db.insert(schema.users).values({
    email: user.email,
    name: user.name,
    username: user.username,
    usernameNormalized: user.usernameNormalized,
    passwordHash: user.passwordHash,
    googleId: user.googleId,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin ?? false,
    isBanned: user.isBanned ?? false,
    isPremium: user.isPremium ?? false,
    hideActivity: user.hideActivity ?? false,
  });
  return (await getUserById(db, result[0].insertId))!;
}

export async function getUserById(db: any, id: number): Promise<User | undefined> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function getUserByEmail(db: any, email: string): Promise<User | undefined> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function getUserByGoogleId(db: any, googleId: string): Promise<User | undefined> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.googleId, googleId)).limit(1);
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function getUserByUsername(db: any, username: string): Promise<User | undefined> {
  const rows = await db.select().from(schema.users)
    .where(eq(schema.users.usernameNormalized, username.trim().toLowerCase()))
    .limit(1);
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function getUsersByUsernames(
  db: any,
  usernames: string[],
): Promise<Array<Pick<User, "id" | "username">>> {
  const normalizedUsernames = [...new Set(usernames.map((username) => username.trim().toLowerCase()))];
  if (normalizedUsernames.length === 0) return [];
  return db.select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.usernameNormalized, normalizedUsernames));
}

export async function updateUser(db: any, id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
  const dbUpdates: any = {};
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.username !== undefined) dbUpdates.username = updates.username;
  if (updates.usernameNormalized !== undefined) dbUpdates.usernameNormalized = updates.usernameNormalized;
  if (updates.passwordHash !== undefined) dbUpdates.passwordHash = updates.passwordHash;
  if (updates.googleId !== undefined) dbUpdates.googleId = updates.googleId;
  if (updates.emailVerified !== undefined) dbUpdates.emailVerified = updates.emailVerified;
  if (updates.avatarUrl !== undefined) dbUpdates.avatarUrl = updates.avatarUrl;
  if (updates.isAdmin !== undefined) dbUpdates.isAdmin = updates.isAdmin;
  if (updates.isBanned !== undefined) dbUpdates.isBanned = updates.isBanned;
  if (updates.isPremium !== undefined) dbUpdates.isPremium = updates.isPremium;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.hideActivity !== undefined) dbUpdates.hideActivity = updates.hideActivity;
  if (updates.lastActiveAt !== undefined) dbUpdates.lastActiveAt = updates.lastActiveAt ? new Date(updates.lastActiveAt) : null;
  await db.update(schema.users).set(dbUpdates).where(eq(schema.users.id, id));
  return getUserById(db, id);
}

export async function recordUserActivity(db: any, userId: number, lastActiveAt: string): Promise<void> {
  await db.update(schema.users)
    .set({ lastActiveAt: new Date(lastActiveAt) })
    .where(eq(schema.users.id, userId));
}

export async function createEmailVerificationToken(db: any, userId: number, token: string, expiresAt: string): Promise<EmailVerificationToken> {
  const result = await db.insert(schema.emailVerificationTokens).values({ userId, token, expiresAt: new Date(expiresAt) });
  return { id: result[0].insertId, userId, token, expiresAt };
}

export async function getEmailVerificationToken(db: any, token: string): Promise<EmailVerificationToken | undefined> {
  const rows = await db.select().from(schema.emailVerificationTokens).where(eq(schema.emailVerificationTokens.token, token)).limit(1);
  if (!rows[0]) return undefined;
  const r = rows[0];
  return { id: r.id, userId: r.userId, token: r.token, expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : String(r.expiresAt) };
}

export async function deleteEmailVerificationToken(db: any, token: string): Promise<void> {
  await db.delete(schema.emailVerificationTokens).where(eq(schema.emailVerificationTokens.token, token));
}

export async function createPasswordResetToken(db: any, userId: number, token: string, expiresAt: string): Promise<PasswordResetToken> {
  const result = await db.insert(schema.passwordResetTokens).values({ userId, token, expiresAt: new Date(expiresAt) });
  return { id: result[0].insertId, userId, token, expiresAt };
}

export async function getPasswordResetToken(db: any, token: string): Promise<PasswordResetToken | undefined> {
  const rows = await db.select().from(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.token, token)).limit(1);
  if (!rows[0]) return undefined;
  const r = rows[0];
  return { id: r.id, userId: r.userId, token: r.token, expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : String(r.expiresAt) };
}

export async function deletePasswordResetToken(db: any, token: string): Promise<void> {
  await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.token, token));
}
