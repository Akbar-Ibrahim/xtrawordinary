import { Card, CardContent } from "@/components/ui/card";
import { Gamepad2, Trophy, Award, Target } from "lucide-react";

interface Props {
  totalGames: number;
  winRate: number;
  achievementPoints: number;
  rankingsCount: number;
}

export function ProfileStatCards({ totalGames, winRate, achievementPoints, rankingsCount }: Props) {
  const stats = [
    { label: "Games Played", value: totalGames, icon: Gamepad2 },
    { label: "Win Rate", value: `${winRate}%`, icon: Target },
    { label: "Achiev. Points", value: achievementPoints, icon: Award },
    { label: "Rankings", value: rankingsCount, icon: Trophy },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-4 pb-4 text-center">
            <stat.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
