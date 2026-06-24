import { z } from "zod";

export const commentTargetTypeSchema = z.enum(["game", "group_round"]);
export type CommentTargetType = z.infer<typeof commentTargetTypeSchema>;

export type Comment = {
  id: number;
  targetType: CommentTargetType;
  targetId: string;
  userId: number;
  parentId: number | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string | null;
  user?: { id: number; name: string; avatarUrl: string | null };
  replies?: Comment[];
  likeCount?: number;
  likedByMe?: boolean;
};

export const commentSchema: z.ZodType<Comment> = z.object({
  id: z.number(),
  targetType: commentTargetTypeSchema,
  targetId: z.string(),
  userId: z.number(),
  parentId: z.number().nullable(),
  content: z.string(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
  user: z.object({ id: z.number(), name: z.string(), avatarUrl: z.string().nullable() }).optional(),
  replies: z.array(z.lazy(() => commentSchema)).optional(),
  likeCount: z.number().optional(),
  likedByMe: z.boolean().optional(),
});
export const insertCommentSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string(),
  userId: z.number(),
  parentId: z.number().nullable(),
  content: z.string(),
});
export type InsertComment = z.infer<typeof insertCommentSchema>;

export const commentReportSchema = z.object({
  id: z.number(),
  commentId: z.number(),
  reportingUserId: z.number(),
  reason: z.string(),
  createdAt: z.string(),
  comment: commentSchema.optional(),
  reporter: z.object({ id: z.number(), name: z.string() }).optional(),
});
export type CommentReport = z.infer<typeof commentReportSchema>;

export const likeTargetTypeSchema = z.enum(["game", "comment"]);
export type LikeTargetType = z.infer<typeof likeTargetTypeSchema>;
