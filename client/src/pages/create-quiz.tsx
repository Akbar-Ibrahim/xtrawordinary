import { PageSEO } from "@/components/page-seo";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ArrowLeft, LogIn } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { QUIZ_MASTER_GAME_SLUGS } from "@shared/schema";
import type { Game } from "@shared/schema";

const QUIZ_GAME_DESCRIPTIONS: Record<string, string> = {
  "letter-hunt": "Find all words containing the target letters.",
  "letter-frequency": "Guess words by how common their letters are.",
  "letter-position": "Find words with a specific letter at a set position.",
  "letter-balance": "Balance vowels and consonants to form valid words.",
  "letter-pool": "Build words from a fixed pool of letters.",
  "letter-dodge": "Type valid words while avoiding forbidden letters — everyone faces the same constraint.",
  "word-length": "Find words of an exact length, with optional filters.",
  "definition-match": "Match words to their definitions across three clue tiers.",
  "word-roots": "Guess words from their Latin or Greek root.",
  "progressive-reveal": "Uncover hidden letters one by one to guess the word.",
};

function QuizGameCard({ game }: { game: Game }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] ?? LucideIcons.Gamepad2;
  const description = QUIZ_GAME_DESCRIPTIONS[game.slug] ?? game.description;
  return (
    <Card className="h-full" data-testid={`card-quiz-game-${game.slug}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: game.color }}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate mb-0.5">{game.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        </div>
        <Link href={`/game/${game.slug}?create-quiz=1`}>
          <Button size="sm" variant="secondary" className="shrink-0 gap-1.5" data-testid={`button-create-quiz-${game.slug}`}>
            <GraduationCap className="h-3.5 w-3.5" />
            Create Quiz
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function CreateQuiz() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const backHref = user ? `/profile/${user.id}` : "/";

  const { data: allGames = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    enabled: isAuthenticated,
  });

  const quizGames = allGames.filter((g) => QUIZ_MASTER_GAME_SLUGS.has(g.slug));

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <GraduationCap className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="text-xl font-semibold mb-2">Sign in to create quizzes</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Quiz sessions are available to registered users. Sign in or create a free account to get started.
        </p>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <LogIn className="h-4 w-4" />
            Go to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageSEO title="Create a Quiz" description="Set up a shareable quiz session for friends — pick a game, configure the rules, and send the link." path="/create-quiz" />
      <Link href={backHref}>
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back-create-quiz">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Create a Quiz Session</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Choose a game below to set up a shareable quiz. Players compete on the same puzzle and scores appear on your quiz leaderboard.
        </p>
      </div>

      {gamesLoading ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {quizGames.map((game) => (
            <QuizGameCard key={game.slug} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
