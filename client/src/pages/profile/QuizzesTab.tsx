import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ChevronRight, Copy, CheckCheck, Play, Trash2, Users } from "lucide-react";
import type { Game } from "@shared/schema";
import type { QuizSessionWithCount } from "./types";

interface Props {
  isOwnProfile: boolean;
  quizzesLoading: boolean;
  quizzes: QuizSessionWithCount[];
  gameMap: Map<string, Game>;
  copiedCode: string | null;
  onCopyLink: (shareCode: string) => void;
  onDeleteClick: (shareCode: string) => void;
}

export function QuizzesTab({
  isOwnProfile,
  quizzesLoading,
  quizzes,
  gameMap,
  copiedCode,
  onCopyLink,
  onDeleteClick,
}: Props) {
  return (
    <>
      {isOwnProfile && !quizzesLoading && (
        <div className="flex items-center justify-between mb-3">
          <Link href="/my-quizzes">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs h-7 px-2" data-testid="link-manage-all-quizzes">
              Manage all <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
          <Link href="/create-quiz">
            <Button size="sm" className="gap-2" data-testid="button-create-new-quiz">
              <GraduationCap className="h-4 w-4" />
              Create Quiz
            </Button>
          </Link>
        </div>
      )}
      {quizzesLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No quizzes yet</p>
          {isOwnProfile ? (
            <>
              <p className="text-sm mb-4">Pick a game and set up a shareable quiz — others compete on the same puzzle and scores appear on your leaderboard.</p>
              <Link href="/create-quiz">
                <Button variant="outline" size="sm" data-testid="button-quiz-empty-cta">Browse Quiz Games</Button>
              </Link>
            </>
          ) : (
            <p className="text-sm">This user hasn't created any quiz sessions yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {quizzes.map((quiz) => {
            const game = gameMap.get(quiz.gameSlug);
            const isClosed = quiz.closesAt ? new Date(quiz.closesAt) < new Date() : false;
            return (
              <div
                key={quiz.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                data-testid={`row-quiz-${quiz.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={isOwnProfile ? `/quiz/${quiz.shareCode}/results` : `/quiz/${quiz.shareCode}`}>
                      <span className="font-medium hover:underline cursor-pointer" data-testid={`text-quiz-title-${quiz.id}`}>{quiz.title}</span>
                    </Link>
                    {isClosed && <Badge variant="destructive" className="text-xs">Closed</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span>{game?.name ?? quiz.gameSlug.replace(/-/g, " ")}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {quiz.playerCount} {quiz.playerCount === 1 ? "player" : "players"}
                    </span>
                    {isOwnProfile && <span className="font-mono tracking-widest">{quiz.shareCode}</span>}
                    <span>Created {new Date(quiz.createdAt).toLocaleDateString()}</span>
                    {quiz.closesAt && (
                      <span>{isClosed ? "Closed" : "Closes"}: {new Date(quiz.closesAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isOwnProfile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onCopyLink(quiz.shareCode)}
                      title="Copy play link"
                      data-testid={`button-copy-quiz-${quiz.id}`}
                    >
                      {copiedCode === quiz.shareCode
                        ? <CheckCheck className="h-4 w-4 text-green-500" />
                        : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                  <Link href={`/quiz/${quiz.shareCode}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Play quiz" data-testid={`button-play-quiz-${quiz.id}`}>
                      <Play className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/quiz/${quiz.shareCode}/results`}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" data-testid={`button-results-quiz-${quiz.id}`}>
                      Results
                    </Button>
                  </Link>
                  {isOwnProfile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteClick(quiz.shareCode)}
                      title="Delete quiz"
                      data-testid={`button-delete-quiz-${quiz.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
