import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Search, UserPlus, Users, X } from "lucide-react";
import type { Game } from "@shared/schema";
import { UserAvatar } from "@/components/user-avatar";
import { UserActivityStatus } from "@/components/user-activity-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DiscoveryUser {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  lastActiveAt?: string | null;
}

interface FriendSearchResult extends DiscoveryUser {
  mutualFriendsCount: number;
}

interface FriendSuggestion extends DiscoveryUser {
  mutualFriendsCount: number;
  sharedGameSlugs: string[];
}

interface Props {
  games: Game[];
}

export function FriendDiscoveryPanel({ games }: Props) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const searchIsSettled = trimmedQuery === debouncedQuery;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmedQuery), 300);
    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  const { data: searchResults = [], isPending: searchPending, isSuccess: searchSucceeded, isError: searchFailed } = useQuery<FriendSearchResult[]>({
    queryKey: ["/api/friends/search", debouncedQuery],
    queryFn: async () => {
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(debouncedQuery)}`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not search users");
      return response.json();
    },
    enabled: isAuthenticated && debouncedQuery.length >= 2,
  });

  const { data: suggestions = [], isPending: suggestionsPending } = useQuery<FriendSuggestion[]>({
    queryKey: ["/api/friends/suggestions"],
    enabled: isAuthenticated,
  });

  const addFriendMutation = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", "/api/friends/request", { userId, note: requestNote.trim() || null }),
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      setSearchQuery("");
      setRequestNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/search"] });
    },
    onError: (error: Error) => toast({
      title: "Could not send friend request",
      description: error.message,
      variant: "destructive",
    }),
  });

  const gameNames = new Map(games.map((game) => [game.slug, game.name]));
  const showSearchResults = trimmedQuery.length >= 2 && searchIsSettled;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Add Friend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by username or display name..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9 pr-9"
              data-testid="input-search-friends"
            />
            <div className="absolute right-3">
              {trimmedQuery.length >= 2 && (!searchIsSettled || searchPending) ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" data-testid="icon-search-loading" />
              ) : searchQuery.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear friend search"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <label htmlFor="discovery-friend-request-note" className="text-sm font-medium">Note with your request (optional)</label>
            <Textarea
              id="discovery-friend-request-note"
              value={requestNote}
              onChange={(event) => setRequestNote(event.target.value)}
              placeholder="Add a short personal note..."
              maxLength={200}
              rows={2}
              data-testid="input-discovery-friend-request-note"
            />
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((candidate) => (
                <DiscoveryUserRow
                  key={candidate.id}
                  user={candidate}
                  supportingText={<MutualFriendsCount count={candidate.mutualFriendsCount} />}
                  addLabel="Add"
                  onAdd={() => addFriendMutation.mutate(candidate.id)}
                  disabled={addFriendMutation.isPending}
                  testId={`row-search-result-${candidate.id}`}
                  buttonTestId={`button-add-${candidate.id}`}
                />
              ))}
            </div>
          )}
          {showSearchResults && searchFailed && (
            <p className="mt-3 text-sm text-destructive text-center" role="alert">
              Search failed. Please try again.
            </p>
          )}
          {showSearchResults && searchSucceeded && !searchPending && searchResults.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground text-center" data-testid="text-no-search-results">
              No users found for “{trimmedQuery}”
            </p>
          )}
        </CardContent>
      </Card>

      {trimmedQuery.length === 0 && (
        <Card data-testid="card-friend-suggestions">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> People you may know
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggestionsPending ? (
              <div className="space-y-3" aria-label="Loading friend suggestions">
                {[0, 1, 2].map((item) => <div key={item} className="h-14 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((candidate) => (
                  <DiscoveryUserRow
                    key={candidate.id}
                    user={candidate}
                    supportingText={(
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          Plays {candidate.sharedGameSlugs.length} game{candidate.sharedGameSlugs.length !== 1 ? "s" : ""} you play
                        </span>
                        {candidate.mutualFriendsCount > 0 && (
                          <MutualFriendsCount count={candidate.mutualFriendsCount} />
                        )}
                        <span className="flex flex-wrap gap-1">
                          {candidate.sharedGameSlugs.slice(0, 2).map((slug) => (
                            <Badge key={slug} variant="secondary" className="font-normal">
                              {gameNames.get(slug) ?? formatGameSlug(slug)}
                            </Badge>
                          ))}
                          {candidate.sharedGameSlugs.length > 2 && (
                            <Badge variant="outline" className="font-normal">
                              +{candidate.sharedGameSlugs.length - 2}
                            </Badge>
                          )}
                        </span>
                      </div>
                    )}
                    addLabel="Add"
                    onAdd={() => addFriendMutation.mutate(candidate.id)}
                    disabled={addFriendMutation.isPending}
                    testId={`row-friend-suggestion-${candidate.id}`}
                    buttonTestId={`button-suggested-add-${candidate.id}`}
                  />
                ))}
              </div>
            ) : (
              <p className="py-3 text-sm text-center text-muted-foreground" data-testid="text-no-friend-suggestions">
                Play a few games to get suggestions for players with similar game tastes.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DiscoveryUserRow({
  user,
  supportingText,
  addLabel,
  onAdd,
  disabled,
  testId,
  buttonTestId,
}: {
  user: DiscoveryUser;
  supportingText: React.ReactNode;
  addLabel: string;
  onAdd: () => void;
  disabled: boolean;
  testId: string;
  buttonTestId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50" data-testid={testId}>
      <div className="min-w-0">
        <Link href={`/u/${user.username}`}>
          <span className="font-medium hover:underline cursor-pointer flex items-center gap-2">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="h-8 w-8 text-xs shrink-0" />
            <span className="min-w-0 truncate">
              {user.name}
              <span className="block text-xs font-normal text-muted-foreground">@{user.username}</span>
              <UserActivityStatus lastActiveAt={user.lastActiveAt} className="mt-0.5" />
            </span>
          </span>
        </Link>
        <div className="ml-10 mt-1 text-xs text-muted-foreground">{supportingText}</div>
      </div>
      <Button size="sm" onClick={onAdd} disabled={disabled} data-testid={buttonTestId}>
        <UserPlus className="h-4 w-4 mr-1" /> {addLabel}
      </Button>
    </div>
  );
}

function MutualFriendsCount({ count }: { count: number }) {
  if (count === 0) return null;
  return <span>{count} mutual friend{count !== 1 ? "s" : ""}</span>;
}

function formatGameSlug(slug: string): string {
  return slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
