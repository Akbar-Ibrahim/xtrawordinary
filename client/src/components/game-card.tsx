import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Game } from "@shared/schema";
import { Clock, TrendingUp, Star } from "lucide-react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/game-stats";

interface GameCardProps {
  game: Game;
  index: number;
  onFavoriteChange?: () => void;
}

const difficultyColors = {
  easy: "bg-accent text-accent-foreground",
  medium: "bg-chart-3 text-white",
  hard: "bg-destructive text-destructive-foreground",
};

export function GameCard({ game, index, onFavoriteChange }: GameCardProps) {
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;
  const [favorited, setFavorited] = useState(() => isFavorite(game.slug));

  function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(game.slug);
    setFavorited(!favorited);
    onFavoriteChange?.();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative"
    >
      <div
        role="button"
        tabIndex={0}
        className="absolute top-2 right-2 z-10 p-2 rounded-md cursor-pointer text-white/70"
        onClick={handleToggleFavorite}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggleFavorite(e as unknown as React.MouseEvent);
          }
        }}
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        data-testid={`button-favorite-${game.slug}`}
      >
        <Star
          className={`h-5 w-5 transition-all ${favorited ? "fill-yellow-400 text-yellow-400" : ""}`}
        />
      </div>
      <Link href={`/game/${game.slug}`}>
        <Card
          className="group cursor-pointer overflow-visible hover-elevate active-elevate-2 transition-all duration-300"
          data-testid={`card-game-${game.id}`}
        >
          <CardContent className="p-0">
            <div
              className="flex h-32 items-center justify-center rounded-t-lg"
              style={{ backgroundColor: game.color }}
            >
              <IconComponent className="h-16 w-16 text-white drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg leading-tight">{game.name}</h3>
                <Badge
                  className={`text-xs shrink-0 ${difficultyColors[game.difficulty]}`}
                  data-testid={`badge-difficulty-${game.id}`}
                >
                  {game.difficulty}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {game.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {game.estimatedTime}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {game.playCount.toLocaleString()} plays
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
