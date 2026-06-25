import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Swords, Crown } from "lucide-react";

interface GuildWarsChampionship {
  id: number;
  tournamentId: number;
  groupId: number;
  tournamentName: string;
  groupName: string;
  createdAt: string;
}

interface Props {
  guildWarsChampionships: GuildWarsChampionship[];
}

export function GuildWarsCard({ guildWarsChampionships }: Props) {
  if (guildWarsChampionships.length === 0) return null;

  return (
    <Card className="border-amber-300 dark:border-amber-700" data-testid="card-guild-wars-stats">
      <CardContent className="py-4 px-5">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Guild Wars</p>
            <p className="text-xs text-muted-foreground">
              {guildWarsChampionships.length} {guildWarsChampionships.length === 1 ? "championship" : "championships"}
            </p>
          </div>
          <div className="ml-auto">
            <Link href="/guild-wars">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer" data-testid="link-guild-wars-profile">
                View tournaments
              </span>
            </Link>
          </div>
        </div>
        <div className="space-y-1">
          {guildWarsChampionships.map((c) => (
            <Link key={c.id} href={`/guild-wars/${c.tournamentId}`}>
              <div className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer gap-2" data-testid={`row-gw-championship-${c.id}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Crown className="h-3 w-3 text-amber-500 shrink-0 fill-current" />
                  <span className="font-medium truncate">{c.tournamentName}</span>
                </div>
                <div className="shrink-0 flex items-center gap-1 text-amber-500/70">
                  <span className="text-muted-foreground">({c.groupName})</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
