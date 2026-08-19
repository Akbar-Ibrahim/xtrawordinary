import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Trash2, Flag, Reply, ChevronDown, ChevronUp, LogIn, Pencil } from "lucide-react";
import type { Comment, CommentTargetType } from "@shared/schema";

type SortOrder = "newest" | "oldest" | "most-liked";
import { LikeButton } from "@/components/like-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "wouter";

interface CommentSectionProps {
  targetType: CommentTargetType;
  targetId: string;
  headingLevel?: 2 | 3;
}

export function CommentSection({ targetType, targetId, headingLevel }: CommentSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const queryKey = ["/api/comments", targetType, targetId];

  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/comments?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: number }) => {
      const res = await apiRequest("POST", "/api/comments", { targetType, targetId, content, parentId });
      return res.json();
    },
    onMutate: async ({ content, parentId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Comment[]>(queryKey);
      const tempComment: Comment = {
        id: -Date.now(),
        targetType,
        targetId,
        userId: user?.id ?? 0,
        parentId: parentId ?? null,
        content,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        user: user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl ?? null } : undefined,
        replies: [],
      };
      queryClient.setQueryData<Comment[]>(queryKey, (old = []) => {
        if (parentId) {
          return old.map(c => c.id === parentId ? { ...c, replies: [...(c.replies ?? []), tempComment] } : c);
        }
        return [...old, tempComment];
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: "Failed to post comment", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/comments/${id}`),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Comment[]>(queryKey);
      queryClient.setQueryData<Comment[]>(queryKey, (old = []) =>
        old.map(c => {
          if (c.id === id) return { ...c, isDeleted: true, content: "" };
          return { ...c, replies: (c.replies ?? []).map(r => r.id === id ? { ...r, isDeleted: true, content: "" } : r) };
        })
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: "Failed to delete comment", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PATCH", `/api/comments/${id}`, { content });
      return res.json();
    },
    onMutate: async ({ id, content }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Comment[]>(queryKey);
      queryClient.setQueryData<Comment[]>(queryKey, (old = []) =>
        old.map(c => {
          if (c.id === id) return { ...c, content, updatedAt: new Date().toISOString() };
          return { ...c, replies: (c.replies ?? []).map(r => r.id === id ? { ...r, content, updatedAt: new Date().toISOString() } : r) };
        })
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: "Failed to edit comment", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const reportMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      apiRequest("POST", `/api/comments/${id}/report`, { reason }),
    onSuccess: () => toast({ title: "Comment reported", description: "Thanks for helping keep the community safe." }),
    onError: () => toast({ title: "Failed to report comment", variant: "destructive" }),
  });

  const totalCount = (comments ?? []).reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  const sortedComments = useMemo(() => {
    if (!comments) return [];
    const copy = [...comments];
    if (sortOrder === "newest") copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortOrder === "oldest") copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortOrder === "most-liked") copy.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
    return copy;
  }, [comments, sortOrder]);

  const commentsToggle = (
    <button
      className="flex items-center gap-2 font-semibold text-base hover:text-primary transition-colors"
      onClick={() => setExpanded(v => !v)}
      data-testid="button-toggle-comments"
    >
      <MessageSquare className="h-5 w-5" />
      Comments {totalCount > 0 && `(${totalCount})`}
      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {headingLevel === 2 ? <h2>{commentsToggle}</h2> : headingLevel === 3 ? <h3>{commentsToggle}</h3> : commentsToggle}
        {expanded && totalCount > 1 && (
          <div className="flex items-center gap-1" data-testid="comment-sort-controls">
            {(["newest", "oldest", "most-liked"] as SortOrder[]).map((s) => (
              <button
                key={s}
                onClick={() => setSortOrder(s)}
                className={`text-xs px-2 py-1 rounded transition-colors ${sortOrder === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`button-sort-comments-${s}`}
              >
                {s === "newest" ? "Newest" : s === "oldest" ? "Oldest" : "Most liked"}
              </button>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="space-y-4">
          {isAuthenticated ? (
            <CommentForm
              onSubmit={(content) => createMutation.mutate({ content })}
              isPending={createMutation.isPending}
              placeholder="Share your thoughts..."
            />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground" data-testid="comments-sign-in-cta">
              <span className="flex items-center gap-2">
                <LogIn className="h-4 w-4 shrink-0" />
                Sign in to join the conversation
              </span>
              <Link href="/auth">
                <Button size="sm" variant="outline" data-testid="button-sign-in-to-comment">Sign In</Button>
              </Link>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : !comments?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-comments">
              No comments yet. {isAuthenticated ? "Be the first!" : ""}
            </p>
          ) : (
            <div className="space-y-3" data-testid="comments-list">
              {sortedComments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  isAdmin={user?.isAdmin}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onEdit={(id, content) => editMutation.mutate({ id, content })}
                  onReport={(id, reason) => reportMutation.mutate({ id, reason })}
                  onReply={(content, parentId) => createMutation.mutate({ content, parentId })}
                  isAuthenticated={isAuthenticated}
                  isDeleting={deleteMutation.isPending}
                  isEditing={editMutation.isPending}
                  isReplying={createMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentForm({
  onSubmit,
  isPending,
  placeholder = "Write a comment...",
  compact = false,
  onCancel,
}: {
  onSubmit: (content: string) => void;
  isPending: boolean;
  placeholder?: string;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState("");
  const maxLen = 500;

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > maxLen) return;
    onSubmit(trimmed);
    setContent("");
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={placeholder}
        className={compact ? "text-sm min-h-[60px]" : "min-h-[80px]"}
        maxLength={maxLen}
        data-testid="input-comment"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs text-muted-foreground ${content.length > maxLen * 0.9 ? "text-orange-500" : ""}`}>
          {content.length}/{maxLen}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel} data-testid="button-cancel-reply">
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || !content.trim() || content.length > maxLen}
            data-testid="button-submit-comment"
          >
            {isPending ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  onDelete,
  onEdit,
  onReport,
  onReply,
  isAuthenticated,
  isDeleting,
  isEditing,
  isReplying,
  isReply = false,
}: {
  comment: Comment;
  currentUserId?: number;
  isAdmin?: boolean;
  onDelete: (id: number) => void;
  onEdit: (id: number, content: string) => void;
  onReport: (id: number, reason: string) => void;
  onReply: (content: string, parentId: number) => void;
  isAuthenticated: boolean;
  isDeleting: boolean;
  isEditing: boolean;
  isReplying: boolean;
  isReply?: boolean;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const canDelete = !!currentUserId && (currentUserId === comment.userId || isAdmin);
  const canEdit = !!currentUserId && currentUserId === comment.userId && !comment.isDeleted;
  const canReport = !!currentUserId && currentUserId !== comment.userId && isAuthenticated;

  function openEdit() {
    setEditContent(comment.content);
    setShowEditForm(true);
    setShowReplyForm(false);
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className={`${isReply ? "ml-8 mt-2" : ""}`} data-testid={`comment-${comment.id}`}>
      <div className="flex gap-3">
        <UserAvatar
          name={comment.user?.name ?? "?"}
          avatarUrl={comment.user?.avatarUrl}
          className="h-8 w-8 mt-0.5"
        />

        <div className="flex-1 min-w-0">
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-medium" data-testid={`comment-author-${comment.id}`}>
                {comment.user?.name ?? "Unknown"}
              </span>
              <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
              {comment.updatedAt && !comment.isDeleted && (
                <span className="text-xs text-muted-foreground italic" data-testid={`comment-edited-${comment.id}`}>(edited)</span>
              )}
              {comment.isDeleted && (
                <span className="text-xs text-muted-foreground italic">(deleted)</span>
              )}
            </div>
            {comment.isDeleted ? (
              <p className="text-sm text-muted-foreground italic">[deleted]</p>
            ) : showEditForm ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="text-sm min-h-[60px]"
                  maxLength={500}
                  data-testid={`input-edit-comment-${comment.id}`}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs text-muted-foreground ${editContent.length > 450 ? "text-orange-500" : ""}`}>
                    {editContent.length}/500
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowEditForm(false)} data-testid={`button-cancel-edit-${comment.id}`}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={isEditing || !editContent.trim() || editContent.length > 500 || editContent.trim() === comment.content}
                      onClick={() => {
                        onEdit(comment.id, editContent.trim());
                        setShowEditForm(false);
                      }}
                      data-testid={`button-save-edit-${comment.id}`}
                    >
                      {isEditing ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words" data-testid={`comment-content-${comment.id}`}>
                {comment.content}
              </p>
            )}
          </div>

          {!comment.isDeleted && (
            <div className="flex items-center gap-3 mt-1 pl-1">
              <LikeButton
                targetType="comment"
                targetId={String(comment.id)}
                initialCount={comment.likeCount ?? 0}
                initialLikedByMe={comment.likedByMe ?? false}
                size="sm"
              />
              {canEdit && (
                <button
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  onClick={openEdit}
                  data-testid={`button-edit-comment-${comment.id}`}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
              {isAuthenticated && !isReply && (
                <button
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  onClick={() => setShowReplyForm(v => !v)}
                  data-testid={`button-reply-${comment.id}`}
                >
                  <Reply className="h-3 w-3" />
                  Reply
                </button>
              )}
              {canReport && (
                <button
                  className="text-xs text-muted-foreground hover:text-orange-500 flex items-center gap-1 transition-colors"
                  onClick={() => setShowReportDialog(true)}
                  data-testid={`button-report-${comment.id}`}
                >
                  <Flag className="h-3 w-3" />
                  Report
                </button>
              )}
              {canDelete && (
                <button
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                  onClick={() => onDelete(comment.id)}
                  disabled={isDeleting}
                  data-testid={`button-delete-comment-${comment.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              )}
            </div>
          )}

          {showReplyForm && (
            <div className="mt-2 ml-1">
              <CommentForm
                onSubmit={(content) => {
                  onReply(content, comment.id);
                  setShowReplyForm(false);
                }}
                isPending={isReplying}
                placeholder={`Reply to ${comment.user?.name ?? "comment"}...`}
                compact
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 space-y-2">
              {comment.replies.map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onReport={onReport}
                  onReply={onReply}
                  isAuthenticated={isAuthenticated}
                  isDeleting={isDeleting}
                  isEditing={isEditing}
                  isReplying={isReplying}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Comment</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="Why are you reporting this comment?"
            className="min-h-[80px]"
            maxLength={500}
            data-testid="input-report-reason"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReportDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reportReason.trim()}
              onClick={() => {
                onReport(comment.id, reportReason.trim());
                setShowReportDialog(false);
                setReportReason("");
              }}
              data-testid="button-submit-report"
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
