import { and, desc, eq, inArray, or } from "drizzle-orm";
import type { AdminUserReport, BlockedUser, UserReportInput } from "@shared/schema";
import * as schema from "../db-schema";

function asIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function usersPairCondition(table: typeof schema.friendships, userId1: number, userId2: number) {
  return or(
    and(eq(table.requesterId, userId1), eq(table.addresseeId, userId2)),
    and(eq(table.requesterId, userId2), eq(table.addresseeId, userId1)),
  );
}

export async function isBlockedBetween(db: any, userId1: number, userId2: number): Promise<boolean> {
  const [row] = await db.select({ id: schema.userBlocks.id })
    .from(schema.userBlocks)
    .where(or(
      and(eq(schema.userBlocks.blockerId, userId1), eq(schema.userBlocks.blockedUserId, userId2)),
      and(eq(schema.userBlocks.blockerId, userId2), eq(schema.userBlocks.blockedUserId, userId1)),
    ))
    .limit(1);
  return Boolean(row);
}

export async function getBlockedUserIds(db: any, userId: number, candidateUserIds: number[]): Promise<number[]> {
  const candidates = [...new Set(candidateUserIds.filter((id) => id !== userId))];
  if (candidates.length === 0) return [];

  const rows = await db.select({
    blockerId: schema.userBlocks.blockerId,
    blockedUserId: schema.userBlocks.blockedUserId,
  })
    .from(schema.userBlocks)
    .where(or(
      and(eq(schema.userBlocks.blockerId, userId), inArray(schema.userBlocks.blockedUserId, candidates)),
      and(eq(schema.userBlocks.blockedUserId, userId), inArray(schema.userBlocks.blockerId, candidates)),
    ));
  const blockedIds = rows.map((row: any) => Number(row.blockerId === userId ? row.blockedUserId : row.blockerId));
  return [...new Set<number>(blockedIds)];
}

export async function getBlockedUsers(db: any, userId: number): Promise<BlockedUser[]> {
  const rows = await db.select({
    id: schema.users.id,
    username: schema.users.username,
    name: schema.users.name,
    avatarUrl: schema.users.avatarUrl,
    blockedAt: schema.userBlocks.createdAt,
  })
    .from(schema.userBlocks)
    .innerJoin(schema.users, eq(schema.users.id, schema.userBlocks.blockedUserId))
    .where(eq(schema.userBlocks.blockerId, userId))
    .orderBy(desc(schema.userBlocks.createdAt));
  return rows.map((row: any) => ({
    id: Number(row.id),
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarUrl ?? null,
    blockedAt: asIso(row.blockedAt)!,
  }));
}

export async function blockUser(db: any, blockerId: number, blockedUserId: number): Promise<void> {
  await db.transaction(async (tx: any) => {
    await tx.insert(schema.userBlocks)
      .values({ blockerId, blockedUserId })
      .onDuplicateKeyUpdate({ set: { blockedUserId } });

    await tx.delete(schema.friendships).where(usersPairCondition(schema.friendships, blockerId, blockedUserId));

    await tx.update(schema.friendChallenges)
      .set({ status: "cancelled" })
      .where(and(
        eq(schema.friendChallenges.status, "pending"),
        or(
          and(eq(schema.friendChallenges.senderId, blockerId), eq(schema.friendChallenges.receiverId, blockedUserId)),
          and(eq(schema.friendChallenges.senderId, blockedUserId), eq(schema.friendChallenges.receiverId, blockerId)),
        ),
      ));

    await tx.update(schema.duelChallenges)
      .set({ status: "cancelled" })
      .where(and(
        eq(schema.duelChallenges.status, "pending"),
        or(
          and(eq(schema.duelChallenges.challengerId, blockerId), eq(schema.duelChallenges.challengeeId, blockedUserId)),
          and(eq(schema.duelChallenges.challengerId, blockedUserId), eq(schema.duelChallenges.challengeeId, blockerId)),
        ),
      ));
  });
}

export async function unblockUser(db: any, blockerId: number, blockedUserId: number): Promise<void> {
  await db.delete(schema.userBlocks).where(and(
    eq(schema.userBlocks.blockerId, blockerId),
    eq(schema.userBlocks.blockedUserId, blockedUserId),
  ));
}

export async function createUserReport(
  db: any,
  reportingUserId: number,
  reportedUserId: number,
  input: UserReportInput,
): Promise<void> {
  await db.insert(schema.userReports).values({
    reportingUserId,
    reportedUserId,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
}

export async function getUserReports(db: any): Promise<AdminUserReport[]> {
  const reports = await db.select().from(schema.userReports).orderBy(desc(schema.userReports.createdAt));
  const userIds = [...new Set<number>(reports.flatMap((report: any) => [
    Number(report.reportingUserId),
    Number(report.reportedUserId),
  ]))];
  const users = userIds.length
    ? await db.select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
    }).from(schema.users).where(inArray(schema.users.id, userIds))
    : [];
  const usersById = new Map(users.map((user: any) => [Number(user.id), {
    id: Number(user.id),
    username: user.username,
    name: user.name,
  }]));

  return reports.map((report: any) => ({
    id: Number(report.id),
    reportingUserId: Number(report.reportingUserId),
    reportedUserId: Number(report.reportedUserId),
    reason: report.reason,
    details: report.details ?? null,
    readAt: asIso(report.readAt),
    createdAt: asIso(report.createdAt)!,
    reporter: usersById.get(Number(report.reportingUserId)) ?? null,
    reportedUser: usersById.get(Number(report.reportedUserId)) ?? null,
  }));
}

export async function markUserReportRead(db: any, id: number): Promise<boolean> {
  const [report] = await db.select({ id: schema.userReports.id })
    .from(schema.userReports)
    .where(eq(schema.userReports.id, id))
    .limit(1);
  if (!report) return false;
  await db.update(schema.userReports)
    .set({ readAt: new Date() })
    .where(eq(schema.userReports.id, id));
  return true;
}
