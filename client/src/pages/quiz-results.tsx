import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft,
  GraduationCap,
  Trophy,
  Copy,
  CheckCheck,
  Users,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import type { QuizSession, QuizSessionScore } from "@shared/schema";
import { UserAvatar } from "@/components/user-avatar";

interface SessionResponse extends QuizSession {
  isClosed: boolean;
}

interface ScoresResponse {
  scores: QuizSessionScore[];
  myScore: QuizSessionScore | null;
}

export default function QuizResults() {
  const { code } = useParams<{ code: string }>();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery<SessionResponse>({
    queryKey: ["/api/quiz-sessions", code],
    queryFn: async () => {
      const res = await fetch(`/api/quiz-sessions/${code}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!code,
  });

  const { data: scoresData, isLoading: scoresLoading } = useQuery<ScoresResponse>({
    queryKey: ["/api/quiz-sessions", code, "scores"],
    queryFn: async () => {
      const res = await fetch(`/api/quiz-sessions/${code}/scores`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!code,
    refetchInterval: 10000,
  });

  const handleCopyLink = () => {
    const link = `${window.location.origin}/quiz/${code}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (sessionLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Quiz Not Found</h1>
        <p className="text-muted-foreground mb-6">This quiz session doesn't exist.</p>
        <Link href="/"><Button>Back to Games</Button></Link>
      </div>
    );
  }

  if (!isAuthenticated || user?.id !== session.creatorId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Results Dashboard</h1>
        <p className="text-muted-foreground mb-6">Only the quiz creator can view this dashboard.</p>
        <Button onClick={() => navigate(`/quiz/${code}`)}>Go to Quiz</Button>
      </div>
    );
  }

  const scores = scoresData?.scores ?? [];
  const playLink = `${window.location.origin}/quiz/${code}`;
  const createdDate = new Date(session.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" });

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href={`/quiz/${code}`}>
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Quiz
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="h-5 w-5 text-primary" />
                <Badge variant="outline">Results Dashboard</Badge>
              </div>
              <CardTitle className="text-xl" data-testid="text-quiz-title">{session.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {session.gameSlug.replace(/-/g, " ")} · Created {createdDate}
              </p>
            </div>
            {session.isClosed && (
              <Badge variant="destructive">Closed</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 font-mono text-sm bg-muted rounded px-3 py-2 truncate" data-testid="text-share-link">
              {playLink}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              data-testid="button-copy-link"
            >
              {linkCopied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(playLink, "_blank")}
              data-testid="button-open-link"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Leaderboard
            <Badge variant="secondary" className="ml-auto">{scores.length} participant{scores.length !== 1 ? "s" : ""}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scoresLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No submissions yet. Share the link so people can play!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scores.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 py-3 px-4 rounded-lg ${
                    i === 0 ? "bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800" :
                    i === 1 ? "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700" :
                    i === 2 ? "bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800" :
                    "bg-muted/40"
                  }`}
                  data-testid={`row-result-${s.id}`}
                >
                  <span className="font-bold text-base w-8 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                  <UserAvatar name={s.playerName ?? "?"} avatarUrl={s.playerAvatarUrl ?? null} className="h-8 w-8" />
                  <div className="flex-1">
                    <p className="font-medium" data-testid={`text-player-${s.id}`}>{s.playerName ?? "Player"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.completedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className="font-bold text-lg text-primary" data-testid={`text-score-result-${s.id}`}>
                    {s.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
