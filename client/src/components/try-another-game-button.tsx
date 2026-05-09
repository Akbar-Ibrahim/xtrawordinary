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

  const others = games?.filter(g => g.slug !== currentSlug) ?? [];

  if (others.length === 0) return null;

  const handleClick = () => {
    const pick = others[Math.floor(Math.random() * others.length)];
    navigate(`/game/${pick.slug}`);
  };

  return (
    <Button
      onClick={handleClick}
      className="bg-violet-500 hover:bg-violet-600 text-white border-0"
      data-testid="button-try-another-game"
    >
      <Shuffle className="h-4 w-4 mr-2" />
      Try Another Game
    </Button>
  );
}
