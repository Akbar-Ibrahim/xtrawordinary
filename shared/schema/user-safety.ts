import { z } from "zod";

export const userReportReasonSchema = z.enum([
  "harassment",
  "spam",
  "inappropriate_content",
  "impersonation",
  "other",
]);
export type UserReportReason = z.infer<typeof userReportReasonSchema>;

export const userReportInputSchema = z.object({
  reason: userReportReasonSchema,
  details: z.string().trim().max(1000).optional().default(""),
});
export type UserReportInput = z.infer<typeof userReportInputSchema>;

export const userBlockSchema = z.object({
  id: z.number(),
  blockerId: z.number(),
  blockedUserId: z.number(),
  createdAt: z.string(),
});
export type UserBlock = z.infer<typeof userBlockSchema>;

export const blockedUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  blockedAt: z.string(),
});
export type BlockedUser = z.infer<typeof blockedUserSchema>;

export const userReportSchema = z.object({
  id: z.number(),
  reportingUserId: z.number(),
  reportedUserId: z.number(),
  reason: userReportReasonSchema,
  details: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type UserReport = z.infer<typeof userReportSchema>;

const reportUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
});

export const adminUserReportSchema = userReportSchema.extend({
  reporter: reportUserSchema.nullable(),
  reportedUser: reportUserSchema.nullable(),
});
export type AdminUserReport = z.infer<typeof adminUserReportSchema>;
