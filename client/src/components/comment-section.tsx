import { useState, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, type InfiniteData } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Trash2, Flag, Reply, ChevronDown, ChevronUp, LogIn, Pencil, Search, X, Pin, PinOff } from "lucide-react";
import type { Comment, CommentMention, CommentPage, CommentSortOrder, CommentTargetType } from "@shared/schema";
import { CommentContent } from "@/components/comments/CommentContent";
import { CommentEmojiPicker } from "@/components/comments/CommentEmojiPicker";
import { insertTextAtSelection } from "@/components/comments/comment-text";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const { user, status, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [sortOrder, setSortOrder] = useState<CommentSortOrder>("newest");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [commenterId, setCommenterId] = useState("all");
  const [knownCommenters, setKnownCommenters] = useState<NonNullable<CommentPage["commenters"]>>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setCommenterId("all");
    setKnownCommenters([]);
  }, [targetType, targetId]);

  const queryKey = ["/api/comments", targetType, targetId, sortOrder, searchTerm, commenterId];

  const {
    data: commentPages,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<CommentPage>({
    queryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        targetType,
        targetId,
        page: String(pageParam),
        pageSize: "20",
        sort: sortOrder,
      });
      if (searchTerm) params.set("search", searchTerm);
      if (commenterId !== "all") params.set("commenterId", commenterId);
      const res = await fetch(`/api/comments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  const comments = useMemo(
    () => commentPages?.pages.flatMap(page => page.comments) ?? [],
    [commentPages],
  );
  const totalCount = commentPages?.pages[0]?.totalCount ?? 0;
  const pinnedComment = commentPages?.pages.find(page => page.pinnedComment)?.pinnedComment ?? null;
  const canManagePins = commentPages?.pages[0]?.canManagePins ?? false;
  const commenters = commentPages?.pages[0]?.commenters;
  useEffect(() => {
    if (commenters) setKnownCommenters(commenters);
  }, [commenters]);
  const mentionedUsers = useMemo(
    () => [...new Map(
      commentPages?.pages.flatMap(page => page.mentionedUsers ?? [])
        .map(mentionedUser => [mentionedUser.username.toLowerCase(), mentionedUser] as const) ?? [],
    ).values()],
    [commentPages],
  );

  const createMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: number }) => {
      const res = await apiRequest("POST", "/api/comments", { targetType, targetId, content, parentId });
      return res.json();
    },
    onMutate: async ({ content, parentId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<CommentPage>>(queryKey);
      if (searchTerm || commenterId !== "all") return { previous };
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
      queryClient.setQueryData<InfiniteData<CommentPage>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page, index) => ({
            ...page,
            comments: parentId
              ? page.comments.map(c => c.id === parentId ? { ...c, replies: [...(c.replies ?? []), tempComment] } : c)
              : index === 0 ? [...page.comments, tempComment] : page.comments,
            totalCount: index === 0 ? page.totalCount + 1 : page.totalCount,
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: "Failed to post comment", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/comments", targetType, targetId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/comments/${id}`),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<CommentPage>>(queryKey);
      queryClient.setQueryData<InfiniteData<CommentPage>>(queryKey, (old) => old && ({
        ...old,
        pages: old.pages.map(page => ({
          ...page,
          comments: page.comments.map(c => {
            if (c.id === id) return { ...c, isDeleted: true, content: "" };
            return { ...c, replies: (c.replies ?? []).map(r => r.id === id ? { ...r, isDeleted: true, content: "" } : r) };
          }),
        })),
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: "Failed to delete comment", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/comments", targetType, targetId] }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PATCH", `/api/comments/${id}`, { content });
      return res.json();
    },
    onMutate: async ({ id, content }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<CommentPage>>(queryKey);
      queryClient.setQueryData<InfiniteData<CommentPage>>(queryKey, old => {
        if (!old) return old;
        const matchesFilters = (comment: Comment) =>
          (!searchTerm || comment.content.toLowerCase().includes(searchTerm.toLowerCase()))
          && (commenterId === "all" || comment.userId === Number(commenterId));
        const matchingCommentCount = (pages: CommentPage[]) =>
          pages.reduce((count, page) => count + page.comments.reduce((threadCount, comment) =>
            threadCount
            + Number(matchesFilters(comment))
            + (comment.replies ?? []).filter(matchesFilters).length, 0), 0);
        const previousMatchingCount = matchingCommentCount(old.pages);
        const updatedAt = new Date().toISOString();
        const updatedPages = old.pages.map(page => ({
          ...page,
          comments: page.comments
            .map(comment => {
              if (comment.id === id) return { ...comment, content, updatedAt };
              return {
                ...comment,
                replies: (comment.replies ?? []).map(reply =>
                  reply.id === id ? { ...reply, content, updatedAt } : reply),
              };
            })
            .filter(comment =>
              !searchTerm
              || matchesFilters(comment)
              || (comment.replies ?? []).some(matchesFilters)),
        }));
        const matchingCountDelta = matchingCommentCount(updatedPages) - previousMatchingCount;
        return {
          ...old,
          pages: updatedPages.map((page, index) => index === 0
            ? { ...page, totalCount: Math.max(0, page.totalCount + matchingCountDelta) }
            : page),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: "Failed to edit comment", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/comments", targetType, targetId] }),
  });

  const reportMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      apiRequest("POST", `/api/comments/${id}/report`, { reason }),
    onSuccess: () => toast({ title: "Comment reported", description: "Thanks for helping keep the community safe." }),
    onError: () => toast({ title: "Failed to report comment", variant: "destructive" }),
  });

  const pinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: number; isPinned: boolean }) => {
      const response = await apiRequest("PATCH", `/api/comments/${id}/pin`, {
        targetType,
        targetId,
        isPinned,
      });
      return response.json();
    },
    onError: () => toast({ title: "Failed to update pinned comment", variant: "destructive" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/comments", targetType, targetId] }),
  });

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
    <div id="comments" className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {headingLevel === 2 ? <h2>{commentsToggle}</h2> : headingLevel === 3 ? <h3>{commentsToggle}</h3> : commentsToggle}
        {expanded && totalCount > 1 && (
          <div className="flex items-center gap-1" data-testid="comment-sort-controls">
            {(["newest", "oldest", "most-liked"] as CommentSortOrder[]).map((s) => (
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder="Search comments..."
                aria-label="Search comments"
                maxLength={100}
                className="pl-9 pr-9"
                data-testid="input-search-comments"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear comment search"
                  data-testid="button-clear-comment-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={commenterId} onValueChange={setCommenterId}>
              <SelectTrigger className="sm:w-56" aria-label="Filter comments by commenter" data-testid="select-commenter-filter">
                <SelectValue placeholder="All commenters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All commenters</SelectItem>
                {knownCommenters.map(commenter => (
                  <SelectItem key={commenter.id} value={String(commenter.id)}>
                    {commenter.name} (@{commenter.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === "loading" ? (
            <Skeleton className="h-20 w-full rounded-lg" data-testid="comments-auth-loading" />
          ) : isAuthenticated ? (
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
          ) : isError && !commentPages ? (
            <div
              className="flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-5 text-center"
              role="alert"
              data-testid="comments-load-error"
            >
              <p className="text-sm text-destructive">Comments couldn&apos;t be loaded. Check your connection and try again.</p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-retry-comments"
              >
                {isFetching ? "Loading comments…" : "Retry"}
              </Button>
            </div>
          ) : !comments?.length && !pinnedComment ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-comments">
              {searchTerm || commenterId !== "all"
                ? "No comments match your filters."
                : <>No comments yet. {isAuthenticated ? "Be the first!" : ""}</>}
            </p>
          ) : (
            <div className="space-y-3">
              {pinnedComment && (
                <section
                  className="rounded-lg border border-primary/30 bg-primary/5 p-3"
                  aria-label="Pinned comment"
                  data-testid="pinned-comment"
                >
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                    Pinned comment
                  </div>
                  <CommentItem
                    comment={pinnedComment}
                    mentionedUsers={mentionedUsers}
                    highlightTerm={searchTerm}
                    currentUserId={user?.id}
                    isAdmin={user?.isAdmin}
                    canManagePins={canManagePins}
                    onTogglePin={(id, isPinned) => pinMutation.mutate({ id, isPinned })}
                    isPinPending={pinMutation.isPending}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onEdit={(id, content) => editMutation.mutate({ id, content })}
                    onReport={(id, reason) => reportMutation.mutate({ id, reason })}
                    onReply={(content, parentId) => createMutation.mutate({ content, parentId })}
                    isAuthenticated={isAuthenticated}
                    isDeleting={deleteMutation.isPending}
                    isEditing={editMutation.isPending}
                    isReplying={createMutation.isPending}
                  />
                </section>
              )}
              {comments.length > 0 && (
                <div className="space-y-3" data-testid="comments-list">
                  {sortedComments.map(comment => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      mentionedUsers={mentionedUsers}
                      highlightTerm={searchTerm}
                      currentUserId={user?.id}
                      isAdmin={user?.isAdmin}
                      canManagePins={canManagePins}
                      onTogglePin={(id, isPinned) => pinMutation.mutate({ id, isPinned })}
                      isPinPending={pinMutation.isPending}
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
          {hasNextPage && (
            <div className="flex justify-center">
              {isFetchNextPageError ? (
                <div
                  className="flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-center"
                  role="alert"
                  data-testid="comments-next-page-error"
                >
                  <p className="text-sm text-destructive">
                    More comments couldn&apos;t be loaded. Your existing comments are still available.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    data-testid="button-retry-next-comments"
                  >
                    {isFetchingNextPage ? "Loading comments…" : "Retry loading more comments"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  data-testid="button-load-more-comments"
                >
                  {isFetchingNextPage ? "Loading comments…" : "Load more comments"}
                </Button>
              )}
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
  const [mentionSearch, setMentionSearch] = useState<{ query: string; start: number; end: number } | null>(null);
  const [mentionCursor, setMentionCursor] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const maxLen = 500;
  const { data: mentionSuggestions = [] } = useQuery<Array<{ id: number; username: string; name: string; avatarUrl: string | null }>>({
    queryKey: ["/api/users/search", "comment-mention", mentionSearch?.query],
    queryFn: async () => {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(mentionSearch!.query)}`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not search users");
      return response.json();
    },
    enabled: !!mentionSearch && mentionSearch.query.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (mentionCursor === null || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(mentionCursor, mentionCursor);
    selectionRef.current = { start: mentionCursor, end: mentionCursor };
    setMentionCursor(null);
  }, [mentionCursor]);

  const rememberSelection = (textarea: HTMLTextAreaElement) => {
    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  const updateMentionSearch = (value: string, cursor: number) => {
    const prefix = value.slice(0, cursor);
    const match = prefix.match(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{0,20})$/);
    if (!match) {
      setMentionSearch(null);
      return;
    }
    const start = cursor - match[0].length + match[1].length;
    setMentionSearch({ query: match[2], start, end: cursor });
  };

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > maxLen) return;
    onSubmit(trimmed);
    setContent("");
    setMentionSearch(null);
  };

  const selectMention = (username: string) => {
    if (!mentionSearch) return;
    const nextContent = `${content.slice(0, mentionSearch.start)}@${username} ${content.slice(mentionSearch.end)}`;
    const nextCursor = mentionSearch.start + username.length + 2;
    setContent(nextContent);
    setMentionSearch(null);
    selectionRef.current = { start: nextCursor, end: nextCursor };
    setMentionCursor(nextCursor);
  };

  const insertEmoji = (emoji: string) => {
    const result = insertTextAtSelection(content, emoji, selectionRef.current, maxLen);
    if (!result) return;

    setContent(result.text);
    setMentionSearch(null);
    selectionRef.current = { start: result.cursor, end: result.cursor };
    setMentionCursor(result.cursor);
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={e => {
          setContent(e.target.value);
          rememberSelection(e.currentTarget);
          updateMentionSearch(e.target.value, e.currentTarget.selectionStart);
        }}
        onSelect={e => rememberSelection(e.currentTarget)}
        onBlur={e => rememberSelection(e.currentTarget)}
        onClick={e => {
          rememberSelection(e.currentTarget);
          updateMentionSearch(e.currentTarget.value, e.currentTarget.selectionStart);
        }}
        onKeyUp={e => {
          rememberSelection(e.currentTarget);
          updateMentionSearch(e.currentTarget.value, e.currentTarget.selectionStart);
        }}
        placeholder={placeholder}
        className={compact ? "text-sm min-h-[60px]" : "min-h-[80px]"}
        maxLength={maxLen}
        data-testid="input-comment"
      />
      {!!mentionSearch && mentionSearch.query.length >= 2 && mentionSuggestions.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md" role="listbox" aria-label="Mention suggestions">
          {mentionSuggestions.map(suggestion => (
            <button
              key={suggestion.id}
              type="button"
              role="option"
              aria-selected="false"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectMention(suggestion.username)}
            >
              <UserAvatar name={suggestion.name} avatarUrl={suggestion.avatarUrl} className="h-7 w-7" />
              <span className="min-w-0 truncate">{suggestion.name}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">@{suggestion.username}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Markdown: **bold**, *italic*, `code`, [link](https://example.com), and - bullet lists.
        </p>
        <CommentEmojiPicker onSelect={insertEmoji} />
      </div>
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
  mentionedUsers,
  highlightTerm,
  currentUserId,
  isAdmin,
  canManagePins,
  onTogglePin,
  isPinPending,
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
  mentionedUsers: CommentMention[];
  highlightTerm?: string;
  currentUserId?: number;
  isAdmin?: boolean;
  canManagePins: boolean;
  onTogglePin: (id: number, isPinned: boolean) => void;
  isPinPending: boolean;
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
              {comment.isPinned && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  <Pin className="h-3 w-3" aria-hidden="true" />
                  Pinned
                </span>
              )}
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
                <p className="text-xs text-muted-foreground">
                  Markdown: **bold**, *italic*, `code`, [link](https://example.com), and - bullet lists.
                </p>
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
              <CommentContent
                content={comment.content}
                mentionUsers={mentionedUsers}
                className="text-sm"
                testId={`comment-content-${comment.id}`}
                highlightTerm={highlightTerm}
              />
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
              {canManagePins && !isReply && !comment.isDeleted && (
                <button
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  onClick={() => onTogglePin(comment.id, !comment.isPinned)}
                  disabled={isPinPending}
                  data-testid={`button-${comment.isPinned ? "unpin" : "pin"}-comment-${comment.id}`}
                  aria-label={comment.isPinned ? "Unpin comment" : "Pin comment"}
                >
                  {comment.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  {comment.isPinned ? "Unpin" : "Pin"}
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
                  mentionedUsers={mentionedUsers}
                  highlightTerm={highlightTerm}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  canManagePins={canManagePins}
                  onTogglePin={onTogglePin}
                  isPinPending={isPinPending}
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
