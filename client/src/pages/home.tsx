import { useQuery } from "@tanstack/react-query";
import { GameCard } from "@/components/game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Gamepad2, Sparkles } from "lucide-react";
import type { Game } from "@shared/schema";

const PRIORITY_GAMES = ["word-stack", "letter-hunt", "position-master", "length-challenge"];

export default function Home() {
  const { data: games, isLoading, error } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const sortedGames = games ? (() => {
    const prioritySet = new Set(PRIORITY_GAMES);
    const priorityGames = PRIORITY_GAMES
      .map(slug => games.find(g => g.slug === slug))
      .filter((g): g is Game => g !== undefined);
    const rest = games.filter(g => !prioritySet.has(g.slug));
    return [...priorityGames, ...rest];
  })() : undefined;

  return (
    <div className="min-h-screen">
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Challenge Your Vocabulary</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              Welcome to{" "}
              <span className="text-primary">WordPlay</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Discover a collection of engaging word games designed to test your
              vocabulary, improve your spelling, and have fun along the way.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 mb-8"
          >
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Available Games</h2>
          </motion.div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-muted-foreground">
                Unable to load games. Please try again later.
              </p>
            </motion.div>
          ) : sortedGames && sortedGames.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedGames.map((game, index) => (
                <GameCard key={game.id} game={game} index={index} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Gamepad2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No games available at the moment.
              </p>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
