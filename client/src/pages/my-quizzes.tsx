import { PageSEO } from "@/components/page-seo";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { AuthLoadingState } from "@/components/auth-loading-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuthModal } from "@/components/auth-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  ArrowLeft,
  Play,
  BarChart2,
  Trash2,
  Users,
  Clock,
  LogIn,
  Plus,
  Pencil,
} from "lucide-react";
import type { QuizSession } from "@shared/schema";
import { useState } from "react";
import { getVariantSummary } from "@/lib/variant-summary";
import { useLockedBalanceAvailability } from "@/hooks/use-locked-balance-availability";

type EnrichedSession = QuizSession & { playerCount: number };

function slugToTitle(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isClosed(closesAt: string | null) {
  if (!closesAt) return false;
  return new Date(closesAt) < new Date();
}

export default function MyQuizzes() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<EnrichedSession | null>(null);
  const [editingLength, setEditingLength] = useState<number | null>(null);
  const [editingConsonantCount, setEditingConsonantCount] = useState<number | null>(null);

  const { data: sessions = [], isLoading } = useQuery<EnrichedSession[]>({
    queryKey: ["/api/quiz-sessions/my"],
    enabled: isAuthenticated,
  });
  const lockedBalanceAvailability = useLockedBalanceAvailability(
    sessions.some((session) =>
      session.gameSlug === "letter-balance" &&
      (session.params as Record<string, unknown> | null)?.category === "locked_balance"
    ),
  );

  const updateLockedBalanceMutation = useMutation({
    mutationFn: async ({ code, length, consonantCount }: { code: string; length: number; consonantCount: number }) => {
      const response = await apiRequest("PATCH", `/api/quiz-sessions/${code}`, { length, consonantCount });
      return response.json();
    },
    onSuccess: async (updatedSession: QuizSession) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/quiz-sessions/my"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/quiz-sessions", updatedSession.shareCode] }),
      ]);
      setEditingSession(null);
      toast({ title: "Quiz rules updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't update quiz rules",
        description: error.message.includes("400")
          ? "Those Locked Balance settings no longer have valid dictionary words. Choose another combination."
          : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest("DELETE", `/api/quiz-sessions/${code}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-sessions/my"] });
      toast({ title: "Quiz deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete quiz", variant: "destructive" });
    },
    onSettled: () => setDeletingCode(null),
  });

  function handleDelete(code: string) {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;
    setDeletingCode(code);
    deleteMutation.mutate(code);
  }

  function openLockedBalanceEditor(session: EnrichedSession) {
    const params = session.params as Record<string, unknown>;
    setEditingSession(session);
    setEditingLength(typeof params.level === "number" ? params.level : null);
    setEditingConsonantCount(typeof params.consonantCount === "number" ? params.consonantCount : null);
  }

  function saveLockedBalanceRules() {
    if (!editingSession || editingLength === null || editingConsonantCount === null) return;
    if (lockedBalanceAvailability.data?.availability[`${editingLength}:${editingConsonantCount}`] !== true) return;
    updateLockedBalanceMutation.mutate({
      code: editingSession.shareCode,
      length: editingLength,
      consonantCount: editingConsonantCount,
    });
  }

  if (authLoading) {
    return <AuthLoadingState />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="container mx-auto px-4 py-16 text-center">
          <GraduationCap className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h2 className="text-xl font-semibold mb-2">Sign in to see your quizzes</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            You need to be signed in to view and manage your created quizzes.
          </p>
          <Button variant="outline" onClick={() => setAuthOpen(true)} data-testid="button-signin-prompt">
            <LogIn className="h-4 w-4 mr-2" />
            Sign In
          </Button>
        </div>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageSEO title="My Quizzes" description="View and manage your created quiz sessions on xtraWordinary." path="/my-quizzes" />
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="heading-my-quizzes">My Quizzes</h1>
        <div className="ml-auto">
          <Link href="/create-quiz">
            <Button size="sm" data-testid="button-create-quiz">
              <Plus className="h-4 w-4 mr-2" />
              Create Quiz
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground mb-4">You haven't created any quizzes yet.</p>
          <Link href="/create-quiz">
            <Button data-testid="button-create-first-quiz">
              <Plus className="h-4 w-4 mr-2" />
              Create your first quiz
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const closed = isClosed(session.closesAt);
            return (
              <Card key={session.id} data-testid={`card-quiz-${session.id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2
                          className="font-semibold text-base truncate"
                          data-testid={`text-quiz-title-${session.id}`}
                        >
                          {session.title}
                        </h2>
                        <Badge variant={closed ? "secondary" : "default"} data-testid={`badge-quiz-status-${session.id}`}>
                          {closed ? "Closed" : "Open"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {slugToTitle(session.gameSlug)}
                      </p>
                      {(() => {
                        const summary = getVariantSummary(session.gameSlug, 0, session.params as Record<string, any>);
                        return summary ? (
                          <p className="text-xs text-muted-foreground mb-2" data-testid={`text-quiz-settings-${session.id}`}>
                            {summary}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-2" data-testid={`text-quiz-settings-${session.id}`}>
                            Standard rules
                          </p>
                        );
                      })()}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1" data-testid={`text-quiz-players-${session.id}`}>
                          <Users className="h-3 w-3" />
                          {session.playerCount} player{session.playerCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Created {formatDate(session.createdAt)}
                        </span>
                        {session.closesAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {closed ? "Closed" : "Closes"} {formatDate(session.closesAt)}
                          </span>
                        )}
                      </div>
                      {session.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {session.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link href={`/quiz/${session.shareCode}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1"
                          data-testid={`button-play-quiz-${session.id}`}
                        >
                          <Play className="h-3 w-3" />
                          Play
                        </Button>
                      </Link>
                      <Link href={`/quiz/${session.shareCode}/results`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1"
                          data-testid={`button-results-quiz-${session.id}`}
                        >
                          <BarChart2 className="h-3 w-3" />
                          Results
                        </Button>
                      </Link>
                      {session.gameSlug === "letter-balance" &&
                        (session.params as Record<string, unknown> | null)?.category === "locked_balance" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1"
                            onClick={() => openLockedBalanceEditor(session)}
                            data-testid={`button-edit-quiz-rules-${session.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit rules
                          </Button>
                        )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full gap-1 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(session.shareCode)}
                        disabled={deletingCode === session.shareCode}
                        data-testid={`button-delete-quiz-${session.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!editingSession}
        onOpenChange={(open) => {
          if (!open && !updateLockedBalanceMutation.isPending) setEditingSession(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Locked Balance rules</DialogTitle>
            <DialogDescription>
              Choose a word length and consonant count that have words in the active dictionary.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Word length</p>
              <div className="flex flex-wrap gap-2">
                {[4, 5, 6, 7, 8, 9, 10].map((length) => (
                  <Button
                    key={length}
                    type="button"
                    size="sm"
                    variant={editingLength === length ? "default" : "outline"}
                    onClick={() => {
                      setEditingLength(length);
                      setEditingConsonantCount(null);
                    }}
                    data-testid={`button-edit-locked-balance-length-${length}`}
                  >
                    {length}
                  </Button>
                ))}
              </div>
            </div>
            {editingLength !== null && (
              <div>
                <p className="text-sm font-medium mb-2">Consonant count</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: editingLength - 1 }, (_, index) => index + 1).map((count) => {
                    const available = lockedBalanceAvailability.data?.availability[`${editingLength}:${count}`] === true;
                    return (
                      <Button
                        key={count}
                        type="button"
                        size="sm"
                        variant={editingConsonantCount === count ? "default" : "outline"}
                        disabled={lockedBalanceAvailability.isLoading || lockedBalanceAvailability.isError || !available}
                        onClick={() => setEditingConsonantCount(count)}
                        data-testid={`button-edit-locked-balance-consonants-${count}`}
                        title={available ? `${count} consonants, ${editingLength - count} vowels` : "No matching dictionary words"}
                      >
                        {count}C/{editingLength - count}V
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            {lockedBalanceAvailability.isLoading && (
              <p className="text-sm text-muted-foreground" role="status">Checking the active dictionary…</p>
            )}
            {lockedBalanceAvailability.isError && (
              <div className="space-y-2" role="alert">
                <p className="text-sm text-destructive">Couldn't check the active dictionary. Try again before saving.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => lockedBalanceAvailability.refetch()}>
                  Check again
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingSession(null)}
              disabled={updateLockedBalanceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={saveLockedBalanceRules}
              disabled={
                editingLength === null ||
                editingConsonantCount === null ||
                lockedBalanceAvailability.isLoading ||
                lockedBalanceAvailability.isError ||
                lockedBalanceAvailability.data?.availability[`${editingLength}:${editingConsonantCount}`] !== true ||
                updateLockedBalanceMutation.isPending
              }
              data-testid="button-save-locked-balance-rules"
            >
              {updateLockedBalanceMutation.isPending ? "Saving…" : "Save rules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
