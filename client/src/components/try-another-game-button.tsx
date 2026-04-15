import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";
import type { Game } from "@shared/schema";

interface TryAnotherGameButtonProps {
  currentSlug: string;
}

export function TryAnotherGameButton({ currentSlug }: TryAnotherGameButtonProps) {
  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/games"] });
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (!games?.length) return;
    const others = games.filter(g => g.slug !== currentSlug);
    const pool = others.length > 0 ? others : games;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    navigate(`/game/${pick.slug}`);
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      data-testid="button-try-another-game"
    >
      <Shuffle className="h-4 w-4 mr-2" />
      Try Another Game
    </Button>
  );
}
