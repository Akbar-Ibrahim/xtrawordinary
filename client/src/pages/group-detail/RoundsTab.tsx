import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TabsContent } from "@/components/ui/tabs";
import { Play, Plus, Swords, Users, Zap, ChevronDown, ChevronUp } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { GroupRound } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DUEL_GAME_NAMES, TEAM_RACE_GAME_NAMES, GAME_NAMES } from "./constants";
import { getLfLettersSummary } from "./utils";
import { RoundScoresPanel } from "./RoundScoresPanel";
import type { EnrichedHuddleChallenge, EnrichedTeamRaceChallenge } from "./types";

export function RoundsTab({
  groupId,
  isAdmin,
  currentUserId,
  currentUserName,
  huddles,
  teamRaces,
  activeRound,
  pastRounds,
  expandedRoundId,
  setExpandedRoundId,
  onStartRound,
  hasActiveSeason,
  acceptHuddleMutation,
  declineHuddleMutation,
  cancelHuddleMutation,
  acceptTRMutation,
  declineTRMutation,
  cancelTRMutation,
}: {
  groupId: number;
  isAdmin: boolean;
  currentUserId: number | undefined;
  currentUserName: string | undefined;
  huddles: EnrichedHuddleChallenge[] | undefined;
  teamRaces: EnrichedTeamRaceChallenge[] | undefined;
  activeRound: GroupRound | undefined;
  pastRounds: GroupRound[];
  expandedRoundId: number | null;
  setExpandedRoundId: (id: number | null) => void;
  onStartRound: () => void;
  hasActiveSeason?: boolean;
  acceptHuddleMutation: UseMutationResult<any, any, number>;
  declineHuddleMutation: UseMutationResult<any, any, number>;
  cancelHuddleMutation: UseMutationResult<any, any, number>;
  acceptTRMutation: UseMutationResult<any, any, number>;
  declineTRMutation: UseMutationResult<any, any, number>;
  cancelTRMutation: UseMutationResult<any, any, number>;
}) {
  return (
    <TabsContent value="rounds">
      <div className="space-y-4">
        {/* Huddle Battles Section */}
        {(() => {
          const pendingIncoming = (huddles || []).filter(h => h.status === "pending" && h.challengeeGroupId === groupId);
          const pendingOutgoing = (huddles || []).filter(h => h.status === "pending" && h.challengerGroupId === groupId);
          const pastBattles = (huddles || []).filter(h => h.status !== "pending");
          if (!isAdmin && pendingIncoming.length === 0 && pendingOutgoing.length === 0 && pastBattles.length === 0) return null;
          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />Group Battles
                </h3>
              </div>
              <div className="space-y-2">
                {pendingIncoming.map(h => (
                  <Card key={h.id} className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20" data-testid={`card-huddle-incoming-${h.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-1.5">
                            <Swords className="h-4 w-4 text-amber-600" />
                            Challenge from <span className="text-foreground">{h.challengerGroupName}</span>
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {DUEL_GAME_NAMES[h.gameSlug] || h.gameSlug} · {h.format === "race" ? "Race" : "Turn-Based"}
                            {h.format === "race" && ` · ${h.raceTarget} words`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Typist will be: <strong>{currentUserName}</strong></p>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => acceptHuddleMutation.mutate(h.id)}
                              disabled={acceptHuddleMutation.isPending}
                              data-testid={`button-huddle-accept-${h.id}`}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => declineHuddleMutation.mutate(h.id)}
                              disabled={declineHuddleMutation.isPending}
                              data-testid={`button-huddle-decline-${h.id}`}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {pendingOutgoing.map(h => (
                  <Card key={h.id} className="border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10" data-testid={`card-huddle-outgoing-${h.id}`}>
                    <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-sm flex items-center gap-1.5">
                          <Swords className="h-4 w-4 text-blue-500" />
                          Battle sent to <span className="text-foreground">{h.challengeeGroupName}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {DUEL_GAME_NAMES[h.gameSlug] || h.gameSlug} · {h.format === "race" ? "Race" : "Turn-Based"}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">Awaiting response</Badge>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 items-start">
                          {h.roomCode && (
                            <Link href={`/duel/${h.roomCode}`}>
                              <Button size="sm" variant="outline" data-testid={`button-huddle-enter-${h.id}`}>
                                Enter Room
                              </Button>
                            </Link>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => cancelHuddleMutation.mutate(h.id)}
                            disabled={cancelHuddleMutation.isPending}
                            data-testid={`button-huddle-cancel-${h.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {pastBattles.slice(0, 5).map(h => {
                  const isChallengerGroup = h.challengerGroupId === groupId;
                  const opponent = isChallengerGroup ? h.challengeeGroupName : h.challengerGroupName;
                  return (
                    <Card key={h.id} className="opacity-80" data-testid={`card-huddle-past-${h.id}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Swords className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">vs {opponent}</p>
                          <p className="text-xs text-muted-foreground">{DUEL_GAME_NAMES[h.gameSlug] || h.gameSlug}</p>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">{h.status}</Badge>
                        {h.roomCode && h.status === "completed" && (
                          <Link href={`/duel/${h.roomCode}`}>
                            <Button size="sm" variant="ghost" className="text-xs h-7">View</Button>
                          </Link>
                        )}
                        {h.status === "accepted" && h.roomCode && (
                          <Link href={`/duel/${h.roomCode}`}>
                            <Button size="sm" className="text-xs h-7">Join</Button>
                          </Link>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Team Race Section */}
        {(() => {
          const trList = teamRaces || [];
          const pendingTRIncoming = trList.filter(tr => tr.status === "pending" && tr.challengeeGroupId === groupId);
          const pendingTROutgoing = trList.filter(tr => tr.status === "pending" && tr.challengerGroupId === groupId);
          const pastTRs = trList.filter(tr => tr.status !== "pending");
          if (!isAdmin && pendingTRIncoming.length === 0 && pendingTROutgoing.length === 0 && pastTRs.length === 0) return null;
          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />Team Races
                </h3>
              </div>
              <div className="space-y-2">
                {pendingTRIncoming.map(tr => (
                  <Card key={tr.id} className="border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10" data-testid={`card-tr-incoming-${tr.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-emerald-600" />
                            Team Race from <span className="text-foreground">{tr.challengerGroupName}</span>
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {TEAM_RACE_GAME_NAMES[tr.gameSlug] || tr.gameSlug} · First to {tr.raceTarget} words · {Math.floor(tr.raceTimeLimit / 60)} min
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">All members of your group can join and contribute!</p>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => acceptTRMutation.mutate(tr.id)}
                              disabled={acceptTRMutation.isPending}
                              data-testid={`button-tr-accept-${tr.id}`}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => declineTRMutation.mutate(tr.id)}
                              disabled={declineTRMutation.isPending}
                              data-testid={`button-tr-decline-${tr.id}`}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {pendingTROutgoing.map(tr => (
                  <Card key={tr.id} className="border-violet-500/30 bg-violet-50/10 dark:bg-violet-950/10" data-testid={`card-tr-outgoing-${tr.id}`}>
                    <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-sm flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-violet-500" />
                          Team Race sent to <span className="text-foreground">{tr.challengeeGroupName}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {TEAM_RACE_GAME_NAMES[tr.gameSlug] || tr.gameSlug} · First to {tr.raceTarget} words
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">Awaiting response</Badge>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 items-start">
                          {tr.roomCode && (
                            <Link href={`/team-race/${tr.roomCode}`}>
                              <Button size="sm" variant="outline" data-testid={`button-tr-enter-${tr.id}`}>
                                Enter Room
                              </Button>
                            </Link>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => cancelTRMutation.mutate(tr.id)}
                            disabled={cancelTRMutation.isPending}
                            data-testid={`button-tr-cancel-${tr.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {pastTRs.slice(0, 5).map(tr => {
                  const isChallengerGroup = tr.challengerGroupId === groupId;
                  const opponent = isChallengerGroup ? tr.challengeeGroupName : tr.challengerGroupName;
                  const weWon = tr.winnerGroupId === groupId;
                  return (
                    <Card key={tr.id} className="opacity-80" data-testid={`card-tr-past-${tr.id}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">vs {opponent}</p>
                          <p className="text-xs text-muted-foreground">{TEAM_RACE_GAME_NAMES[tr.gameSlug] || tr.gameSlug} · Team Race</p>
                        </div>
                        <Badge variant="outline" className={`text-xs shrink-0 ${tr.status === "completed" && weWon ? "border-emerald-500/50 text-emerald-600" : ""}`}>
                          {tr.status === "completed" ? (tr.winnerGroupId ? (weWon ? "Won" : "Lost") : "Tie") : tr.status}
                        </Badge>
                        {tr.roomCode && (tr.status === "accepted" || tr.status === "completed") && (
                          <Link href={`/team-race/${tr.roomCode}`}>
                            <Button size="sm" variant="ghost" className="text-xs h-7">
                              {tr.status === "accepted" ? "Join" : "View"}
                            </Button>
                          </Link>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {activeRound ? (
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" />
                  Active Round
                </CardTitle>
                <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Live</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{GAME_NAMES[activeRound.gameSlug] || activeRound.gameSlug}</p>
              {(() => { const s = getLfLettersSummary(activeRound); return s ? <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-round-letters-active">Letters: {s}</p> : null; })()}
              <div className="mb-3" />
              {activeRound.closesAt && (
                <p className="text-sm text-muted-foreground mb-3">
                  Closes: {new Date(activeRound.closesAt).toLocaleDateString()}
                </p>
              )}
              <Link href={`/groups/${groupId}/rounds/${activeRound.id}/play`}>
                <Button className="w-full gap-2" data-testid="button-play-round">
                  <Play className="h-4 w-4" />
                  Play Round
                </Button>
              </Link>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={async () => {
                    await apiRequest("PATCH", `/api/groups/${groupId}/rounds/${activeRound.id}/close`);
                    queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds"] });
                  }}
                  data-testid="button-close-round"
                >
                  Close Round
                </Button>
              )}
            </CardContent>
          </Card>
        ) : isAdmin && !hasActiveSeason ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">No active round. Start one!</p>
              <Button onClick={onStartRound} data-testid="button-start-round">
                <Plus className="h-4 w-4 mr-2" />
                Start New Round
              </Button>
            </CardContent>
          </Card>
        ) : isAdmin && hasActiveSeason ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Ad-hoc rounds are paused while a season is active. Check the Season tab for today's round.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No active round. Ask an admin to start one!</p>
            </CardContent>
          </Card>
        )}

        {pastRounds.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Past Rounds</h3>
            <div className="space-y-2">
              {pastRounds.map(round => {
                const isExpanded = expandedRoundId === round.id;
                return (
                  <Collapsible
                    key={round.id}
                    open={isExpanded}
                    onOpenChange={() => setExpandedRoundId(isExpanded ? null : round.id)}
                  >
                    <Card data-testid={`card-round-${round.id}`}>
                      <CollapsibleTrigger asChild>
                        <CardContent className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-xl">
                          <div>
                            <p className="font-medium">{GAME_NAMES[round.gameSlug] || round.gameSlug}</p>
                            {(() => { const s = getLfLettersSummary(round); return s ? <p className="text-xs text-primary/70" data-testid={`text-round-letters-${round.id}`}>Letters: {s}</p> : null; })()}
                            <p className="text-xs text-muted-foreground">
                              {new Date(round.createdAt).toLocaleDateString()}
                              {round.closesAt && <> · Closed {new Date(round.closesAt).toLocaleDateString()}</>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Closed</Badge>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 border-t pt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Round Results</p>
                          <RoundScoresPanel groupId={groupId} roundId={round.id} currentUserId={currentUserId} />
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </TabsContent>
  );
}
