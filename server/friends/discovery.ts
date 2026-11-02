export interface FriendDiscoveryUser {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export interface FriendSearchResult extends FriendDiscoveryUser {
  mutualFriendsCount: number;
}

export interface FriendSuggestion extends FriendDiscoveryUser {
  mutualFriendsCount: number;
  sharedGameSlugs: string[];
}

export interface FriendshipEdge {
  requesterId: number;
  addresseeId: number;
  status: string;
}

export interface FriendSuggestionCandidate extends FriendDiscoveryUser {
  playedGameSlugs: string[];
}

export function getMutualFriendCountsFromEdges(
  viewerId: number,
  candidateIds: number[],
  edges: FriendshipEdge[],
): Record<number, number> {
  const candidateIdSet = new Set(candidateIds.filter((id) => id !== viewerId));
  const friendsByUser = new Map<number, Set<number>>();

  for (const edge of edges) {
    if (edge.status !== "accepted" || edge.requesterId === edge.addresseeId) continue;
    addFriend(friendsByUser, edge.requesterId, edge.addresseeId);
    addFriend(friendsByUser, edge.addresseeId, edge.requesterId);
  }

  const viewerFriends = friendsByUser.get(viewerId) ?? new Set<number>();
  const counts: Record<number, number> = {};

  for (const candidateId of candidateIdSet) {
    const candidateFriends = friendsByUser.get(candidateId) ?? new Set<number>();
    let count = 0;
    for (const friendId of viewerFriends) {
      if (friendId !== candidateId && candidateFriends.has(friendId)) count += 1;
    }
    counts[candidateId] = count;
  }

  return counts;
}

export function rankFriendSuggestions(
  viewerId: number,
  viewerGameSlugs: string[],
  candidates: FriendSuggestionCandidate[],
  excludedUserIds: Set<number>,
  mutualFriendCounts: Record<number, number>,
  limit = 8,
): FriendSuggestion[] {
  const viewerGames = new Set(viewerGameSlugs);
  if (viewerGames.size === 0) return [];

  return candidates
    .filter((candidate) => candidate.id !== viewerId && !excludedUserIds.has(candidate.id))
    .map((candidate) => {
      const sharedGameSlugs = [...new Set(candidate.playedGameSlugs)]
        .filter((slug) => viewerGames.has(slug))
        .sort((a, b) => a.localeCompare(b));
      return {
        id: candidate.id,
        username: candidate.username,
        name: candidate.name,
        avatarUrl: candidate.avatarUrl,
        mutualFriendsCount: mutualFriendCounts[candidate.id] ?? 0,
        sharedGameSlugs,
      };
    })
    .filter((candidate) => candidate.sharedGameSlugs.length > 0)
    .sort((a, b) =>
      b.sharedGameSlugs.length - a.sharedGameSlugs.length ||
      b.mutualFriendsCount - a.mutualFriendsCount ||
      a.username.localeCompare(b.username)
    )
    .slice(0, Math.max(0, limit));
}

function addFriend(map: Map<number, Set<number>>, userId: number, friendId: number): void {
  const friends = map.get(userId) ?? new Set<number>();
  friends.add(friendId);
  map.set(userId, friends);
}
