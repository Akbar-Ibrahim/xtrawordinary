import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";
import { createNotificationIfEnabled } from "./helpers";

const COMMENT_PAGE_SIZE_DEFAULT = 20;
const COMMENT_PAGE_SIZE_MAX = 50;
const COMMENT_SEARCH_MAX_LENGTH = 100;
const COMMENT_SORT_ORDERS = new Set(["newest", "oldest", "most-liked"]);
const COMMENT_MENTION_REGEX = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,20})(?![a-zA-Z0-9_])/g;

function extractMentionUsernames(content: string): string[] {
  return [...new Set(Array.from(content.matchAll(COMMENT_MENTION_REGEX), match => match[2].toLowerCase()))];
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isCommentRequestBody(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const checkGroupRoundAccess = async (roundId: number, userId: number | null): Promise<boolean> => {
  const round = await storage.getGroupRound(roundId);
  if (!round) return false;
  const group = await storage.getGroup(round.groupId);
  if (!group) return false;
  if (group.isPublic) return true;
  if (!userId) return false;
  const membership = await storage.getGroupMember(round.groupId, userId);
  return !!membership;
};

async function canManageCommentPins(targetType: "game" | "group_round", targetId: string, user: Express.User | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (targetType === "game") {
    const game = await storage.getGameBySlug(targetId);
    return game?.creatorId === user.id;
  }
  const roundId = parsePositiveInteger(targetId);
  if (roundId === null) return false;
  const round = await storage.getGroupRound(roundId);
  return round?.createdById === user.id;
}

const fetchComments = async (req: any, res: any) => {
  try {
    const targetType = req.params.targetType ?? req.query.targetType;
    const targetId = req.params.targetId ?? req.query.targetId;
    if (!targetType || !targetId || typeof targetType !== "string" || typeof targetId !== "string") {
      return res.status(400).json({ error: "targetType and targetId are required" });
    }
    if (targetType !== "game" && targetType !== "group_round") {
      return res.status(400).json({ error: "Invalid targetType" });
    }
    if (targetType === "group_round") {
      const roundId = parseInt(targetId);
      if (isNaN(roundId)) return res.status(400).json({ error: "Invalid round ID" });
      const userId = req.user?.id ?? null;
      const hasAccess = await checkGroupRoundAccess(roundId, userId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    }
    const isPaginated = req.query.page !== undefined
      || req.query.pageSize !== undefined
      || req.query.sort !== undefined
      || req.query.search !== undefined
      || req.query.commenterId !== undefined;
    if (!isPaginated) {
      const comments = await storage.getComments(targetType, targetId, req.user?.id);
      return res.json(comments);
    }

    const page = req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page);
    const requestedPageSize = req.query.pageSize === undefined
      ? COMMENT_PAGE_SIZE_DEFAULT
      : parsePositiveInteger(req.query.pageSize);
    if (page === null || requestedPageSize === null) {
      return res.status(400).json({ error: "page and pageSize must be positive integers" });
    }
    const sortOrder = req.query.sort === undefined ? "newest" : req.query.sort;
    if (typeof sortOrder !== "string" || !COMMENT_SORT_ORDERS.has(sortOrder)) {
      return res.status(400).json({ error: "Invalid comment sort order" });
    }
    const searchTerm = req.query.search === undefined ? undefined : req.query.search;
    if (searchTerm !== undefined
      && (typeof searchTerm !== "string" || searchTerm.length > COMMENT_SEARCH_MAX_LENGTH)) {
      return res.status(400).json({ error: `search must be a string no longer than ${COMMENT_SEARCH_MAX_LENGTH} characters` });
    }
    const commenterId = req.query.commenterId === undefined
      ? undefined
      : parsePositiveInteger(req.query.commenterId);
    if (req.query.commenterId !== undefined && commenterId === null) {
      return res.status(400).json({ error: "commenterId must be a positive integer" });
    }

    const comments = await storage.getCommentsPage(
      targetType,
      targetId,
      req.user?.id,
      page,
      Math.min(requestedPageSize, COMMENT_PAGE_SIZE_MAX),
      sortOrder as import("@shared/schema").CommentSortOrder,
      typeof searchTerm === "string" ? searchTerm.trim() || undefined : undefined,
      commenterId ?? undefined,
    );
    const visibleComments = [
      ...comments.comments,
      ...(comments.pinnedComment ? [comments.pinnedComment] : []),
    ];
    const mentionedUsernames = new Set<string>();
    const collectMentionUsernames = (comment: import("@shared/schema").Comment) => {
      if (!comment.isDeleted) {
        for (const username of extractMentionUsernames(comment.content)) {
          mentionedUsernames.add(username);
        }
      }
      comment.replies?.forEach(collectMentionUsernames);
    };
    visibleComments.forEach(collectMentionUsernames);
    const mentionedUsers = await storage.getUsersByUsernames([...mentionedUsernames]);
    res.json({
      ...comments,
      mentionedUsers,
      canManagePins: await canManageCommentPins(targetType, targetId, req.user),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

export function registerCommentsRoutes(app: Express): void {
  app.get("/api/achievements/rarity", async (_req, res) => {
    try {
      const rarities = await storage.getAchievementRarities();
      res.json(rarities);
    } catch {
      res.status(500).json({ error: "Failed to fetch achievement rarities" });
    }
  });

  app.get("/api/comments", fetchComments);
  app.get("/api/comments/:targetType/:targetId", fetchComments);

  app.post("/api/comments", requireAuth, async (req, res) => {
    try {
      if (!isCommentRequestBody(req.body)) {
        return res.status(400).json({ error: "Request body must be a JSON object" });
      }
      const userId = req.user!.id;
      const { targetType, targetId, content, parentId } = req.body;
      if (!targetType || !targetId || !content || typeof content !== "string") {
        return res.status(400).json({ error: "targetType, targetId, and content are required" });
      }
      if (targetType !== "game" && targetType !== "group_round") {
        return res.status(400).json({ error: "Invalid targetType" });
      }
      if (targetType === "group_round") {
        const roundId = parseInt(String(targetId));
        if (isNaN(roundId)) return res.status(400).json({ error: "Invalid round ID" });
        const hasAccess = await checkGroupRoundAccess(roundId, userId);
        if (!hasAccess) return res.status(403).json({ error: "Access denied — must be a group member" });
      }
      const trimmed = content.trim();
      if (!trimmed) return res.status(400).json({ error: "Content cannot be empty" });
      if (trimmed.length > 500) return res.status(400).json({ error: "Comment cannot exceed 500 characters" });

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await storage.getRecentCommentCount(userId, oneHourAgo);
      if (recentCount >= 10) {
        return res.status(429).json({ error: "You've posted too many comments recently. Please wait a bit before posting again." });
      }

      let resolvedParentId: number | null = null;
      if (parentId) {
        const pid = parseInt(parentId);
        if (isNaN(pid)) return res.status(400).json({ error: "Invalid parentId" });
        const existingComments = await storage.getComments(targetType, String(targetId));
        const allComments = [...existingComments, ...existingComments.flatMap(c => c.replies ?? [])];
        const parent = allComments.find(c => c.id === pid);
        if (!parent) return res.status(400).json({ error: "Parent comment not found" });
        if (parent.targetType !== targetType || parent.targetId !== String(targetId)) {
          return res.status(400).json({ error: "Parent comment belongs to a different target" });
        }
        if (parent.parentId !== null) {
          return res.status(400).json({ error: "Replies can only be one level deep" });
        }
        resolvedParentId = pid;
      }

      const comment = await storage.createComment({
        targetType,
        targetId: String(targetId),
        userId,
        parentId: resolvedParentId,
        content: trimmed,
      });

      if (resolvedParentId !== null) {
        try {
          const allComments = await storage.getComments(targetType, String(targetId));
          const flat = [...allComments, ...allComments.flatMap(c => c.replies ?? [])];
          const parent = flat.find(c => c.id === resolvedParentId);
          if (parent && parent.userId !== userId) {
            const commenterName = `@${(req.user as any).username as string}`;
            let replyLinkUrl: string | null = null;
            if (targetType === "game") {
              replyLinkUrl = `/game/${targetId}`;
            } else if (targetType === "group_round") {
              const roundId = parseInt(String(targetId));
              const round = await storage.getGroupRound(roundId).catch(() => null);
              if (round) replyLinkUrl = `/groups/${round.groupId}`;
            }
            createNotificationIfEnabled({
              userId: parent.userId,
              type: "comment_reply",
              title: "Someone replied to your comment",
              body: `${commenterName}: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}"`,
              linkUrl: replyLinkUrl,
            });
          }
        } catch {}
      }

      try {
        let discussionLink: string | null = null;
        let roundId: number | null = null;
        if (targetType === "game") {
          discussionLink = `/game/${encodeURIComponent(String(targetId))}#comments`;
        } else {
          roundId = parsePositiveInteger(String(targetId));
          const round = roundId ? await storage.getGroupRound(roundId) : undefined;
          if (round) {
            discussionLink = `/groups/${round.groupId}/rounds/${round.id}/play#comments`;
          }
        }

        if (discussionLink) {
          const usernames = extractMentionUsernames(trimmed);
          const recipients = await Promise.all(usernames.map(username => storage.getUserByUsername(username)));
          const mentionedUsers = recipients.filter((user): user is NonNullable<typeof user> => !!user && user.id !== userId && !user.isBanned);
          const blockedIds = new Set(await storage.getBlockedUserIds(userId, mentionedUsers.map(user => user.id)));
          await Promise.all(mentionedUsers
            .filter(user => !blockedIds.has(user.id))
            .map(async user => {
              if (targetType === "group_round" && roundId !== null
                && !await checkGroupRoundAccess(roundId, user.id)) return;
              await createNotificationIfEnabled({
                userId: user.id,
                type: "comment_mention",
                title: "Someone mentioned you in a comment",
                body: `@${(req.user as any).username}: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}"`,
                linkUrl: discussionLink,
              });
            }));
        }
      } catch (error) {
        console.error("[comment mention]", error);
      }
      res.status(201).json(comment);
    } catch {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.patch("/api/comments/:id", requireAuth, async (req, res) => {
    try {
      if (!isCommentRequestBody(req.body)) {
        return res.status(400).json({ error: "Request body must be a JSON object" });
      }
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid comment ID" });
      const { content } = req.body;
      if (!content || typeof content !== "string" || !content.trim() || content.length > 500) {
        return res.status(400).json({ error: "Content must be 1–500 characters" });
      }
      const existing = await storage.getCommentById(id);
      if (existing?.targetType === "group_round") {
        const roundId = parseInt(existing.targetId);
        if (isNaN(roundId) || !await checkGroupRoundAccess(roundId, userId)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      const updated = await storage.updateComment(id, userId, content.trim());
      if (!updated) return res.status(403).json({ error: "Cannot edit this comment" });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  app.patch("/api/comments/:id/pin", requireAuth, async (req, res) => {
    try {
      if (!isCommentRequestBody(req.body)) {
        return res.status(400).json({ error: "Request body must be a JSON object" });
      }
      const id = parsePositiveInteger(req.params.id);
      if (id === null) return res.status(400).json({ error: "Invalid comment ID" });
      const { targetType, targetId, isPinned } = req.body;
      if ((targetType !== "game" && targetType !== "group_round")
        || typeof targetId !== "string"
        || !targetId
        || typeof isPinned !== "boolean") {
        return res.status(400).json({ error: "targetType, targetId, and isPinned are required" });
      }
      if (targetType === "group_round") {
        const roundId = parseInt(targetId);
        if (isNaN(roundId) || !await checkGroupRoundAccess(roundId, req.user!.id)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      if (!await canManageCommentPins(targetType, targetId, req.user)) {
        return res.status(403).json({ error: "Only an authorized discussion creator or an admin can pin comments" });
      }
      const comment = await storage.getCommentById(id);
      if (!comment || comment.targetType !== targetType || comment.targetId !== targetId) {
        return res.status(404).json({ error: "Comment not found in this discussion" });
      }
      if (comment.parentId !== null) {
        return res.status(400).json({ error: "Only top-level comments can be pinned" });
      }
      const updated = await storage.setCommentPinned(id, targetType, targetId, isPinned);
      if (!updated) return res.status(404).json({ error: "Comment cannot be pinned" });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update pinned comment" });
    }
  });

  app.delete("/api/comments/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid comment ID" });
      const isAdmin = req.user!.isAdmin;
      const comment = await storage.getCommentById(id);
      if (comment?.targetType === "group_round") {
        const roundId = parseInt(comment.targetId);
        if (isNaN(roundId) || !await checkGroupRoundAccess(roundId, req.user!.id)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      const deleted = await storage.deleteComment(id, userId, isAdmin);
      if (!deleted) return res.status(403).json({ error: "Cannot delete this comment" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  app.post("/api/comments/:id/report", requireAuth, async (req, res) => {
    try {
      if (!isCommentRequestBody(req.body)) {
        return res.status(400).json({ error: "Request body must be a JSON object" });
      }
      const reportingUserId = req.user!.id;
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
      const { reason } = req.body;
      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "Reason is required" });
      }
      if (reason.length > 500) return res.status(400).json({ error: "Reason cannot exceed 500 characters" });
      const comment = await storage.getCommentById(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      if (comment.targetType === "group_round") {
        const roundId = parseInt(comment.targetId);
        const hasAccess = !isNaN(roundId) && await checkGroupRoundAccess(roundId, reportingUserId);
        if (!hasAccess) return res.status(403).json({ error: "Access denied" });
      }
      const report = await storage.reportComment(commentId, reportingUserId, reason.trim());
      res.status(201).json(report);
    } catch {
      res.status(500).json({ error: "Failed to report comment" });
    }
  });

  app.post("/api/likes", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be a JSON object" });
      }
      const { targetType, targetId } = req.body;
      if (!targetType || !targetId) {
        return res.status(400).json({ error: "targetType and targetId are required" });
      }
      if (targetType !== "game" && targetType !== "comment") {
        return res.status(400).json({ error: "Invalid targetType" });
      }
      let commentAuthorId: number | null = null;
      if (targetType === "comment") {
        const commentId = parseInt(String(targetId));
        if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
        const comment = await storage.getCommentById(commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });
        if (comment.targetType === "group_round") {
          const roundId = parseInt(comment.targetId);
          const hasAccess = !isNaN(roundId) && await checkGroupRoundAccess(roundId, userId);
          if (!hasAccess) return res.status(403).json({ error: "Access denied" });
        }
        commentAuthorId = comment.userId;
      }
      const result = await storage.toggleLike(userId, targetType, String(targetId));
      if (result.liked && commentAuthorId !== null && commentAuthorId !== userId) {
        await createNotificationIfEnabled({
          userId: commentAuthorId,
          type: "comment_liked",
          title: "Someone liked your comment",
          body: `@${req.user!.username} liked your comment`,
          linkUrl: null,
        });
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  app.get("/api/likes", async (req, res) => {
    try {
      const { targetType, targetIds } = req.query;
      if (!targetType || !targetIds) {
        return res.status(400).json({ error: "targetType and targetIds are required" });
      }
      if (targetType !== "game") {
        return res.status(400).json({ error: "Only targetType=game is supported on this endpoint; comment likes are returned via /api/comments" });
      }
      const ids = Array.isArray(targetIds) ? targetIds.map(String) : String(targetIds).split(",");
      const counts = await storage.getLikeCounts("game", ids);
      const userId = req.user?.id;
      const likedByMe: Record<string, boolean> = {};
      if (userId) {
        const likedSet = await storage.getUserLikes(userId, "game", ids);
        for (const id of ids) likedByMe[id] = likedSet.has(id);
      } else {
        for (const id of ids) likedByMe[id] = false;
      }
      res.json({ counts, likedByMe });
    } catch {
      res.status(500).json({ error: "Failed to fetch likes" });
    }
  });

  const fetchCommentReports = async (_req: any, res: any) => {
    try {
      const reports = await storage.getCommentReports();
      const mentionedUsernames = new Set<string>();
      for (const report of reports) {
        if (report.comment && !report.comment.isDeleted) {
          for (const username of extractMentionUsernames(report.comment.content)) {
            mentionedUsernames.add(username);
          }
        }
      }
      const mentionedUsers = await storage.getUsersByUsernames([...mentionedUsernames]);
      const usersByUsername = new Map(mentionedUsers.map((user) => [user.username.toLowerCase(), user]));
      res.json(reports.map((report) => {
        if (!report.comment) return report;
        if (report.comment.isDeleted) {
          return {
            ...report,
            comment: {
              ...report.comment,
              content: "",
              mentionedUsers: [],
            },
          };
        }
        return {
          ...report,
          comment: {
            ...report.comment,
            mentionedUsers: extractMentionUsernames(report.comment.content)
              .flatMap((username) => {
                const user = usersByUsername.get(username);
                return user ? [user] : [];
              }),
          },
        };
      }));
    } catch {
      res.status(500).json({ error: "Failed to fetch comment reports" });
    }
  };

  app.get("/api/admin/comment-reports", requireAuth, requireAdmin, fetchCommentReports);
  app.get("/api/admin/comments/reported", requireAuth, requireAdmin, fetchCommentReports);

  app.delete("/api/admin/comments/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid comment ID" });
      await storage.deleteCommentAdmin(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });
}
