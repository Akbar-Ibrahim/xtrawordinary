import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { Swords, Shield } from "lucide-react";

export function GuildWarsGroupTab({ groupId }: { groupId: number }) {
  const { data: entries = [], isLoading } = useQuery<Array<{
    registration: { id: number; tournamentId: number; groupId: number; createdAt: string };
    tournament: { id: number; name: string; status: string; registrationDeadline: string; roundDeadlineHours: number };
  }>>({
    queryKey: ["/api/groups", groupId, "guild-wars"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/guild-wars`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const statusColor = (s: string) => ({
    registration: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    active: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    completed: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    cancelled: "",
  }[s] ?? "");

  const statusLabel = (s: string) => ({
    registration: "Registration Open",
    active: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }[s] ?? s);

  return (
    <TabsContent value="guild-wars">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5" />
            Guild Wars Tournaments
          </h3>
          <Link href="/guild-wars">
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" data-testid="button-browse-gw">
              Browse Tournaments
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : entries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">This guild hasn't entered any Guild Wars tournaments yet.</p>
              <Link href="/guild-wars">
                <Button className="mt-4" variant="outline" size="sm" data-testid="button-join-gw">
                  Find a Tournament
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="list-group-gw-tournaments">
            {entries.map(({ registration, tournament }) => (
              <Card key={registration.id} className="hover:shadow-sm transition-shadow" data-testid={`card-group-gw-${tournament.id}`}>
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
                      <Swords className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" data-testid={`text-group-gw-name-${tournament.id}`}>
                        {tournament.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Registered {new Date(registration.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${statusColor(tournament.status)}`} data-testid={`badge-group-gw-status-${tournament.id}`}>
                      {statusLabel(tournament.status)}
                    </Badge>
                    <Link href={`/guild-wars/${tournament.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" data-testid={`link-group-gw-bracket-${tournament.id}`}>
                        Bracket
                        <Shield className="h-3 w-3 ml-0.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TabsContent>
  );
}
