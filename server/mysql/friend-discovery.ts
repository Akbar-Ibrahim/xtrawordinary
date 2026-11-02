import { and, eq, gt, inArray, ne, or } from "drizzle-orm";
import * as schema from "../db-schema";
import {
  getMutualFriendCountsFromEdges,
  rankFriendSuggestions,
  type FriendSuggestion,
  type FriendshipEdge,
} from "../friends/discovery";

export async function getMutualFriendCounts(
  db: any,
  userId: number,
  candidateUserIds: number[],
): Promise<Record<number, number>> {
  const uniqueCandidateIds = [...new Set(candidateUserIds)].filter((id) => id !== userId);
  const counts = Object.fromEntries(uniqueCandidateIds.map((id) => [id, 0])) as Record<number, number>;
  if (uniqueCandidateIds.length === 0) return counts;

  const viewerEdges: FriendshipEdge[] = await db
    .select({
      requesterId: schema.friendships.requesterId,
      addresseeId: schema.friendships.addresseeId,
      status: schema.friendships.status,
    })
    .from(schema.friendships)
    .where(and(
      eq(schema.friendships.status, "accepted"),
      or(
        eq(schema.friendships.requesterId, userId),
        eq(schema.friendships.addresseeId, userId),
      ),
    ));
  const viewerFriendIds = viewerEdges.map((edge) =>
    edge.requesterId === userId ? edge.addresseeId : edge.requesterId
  );
  if (viewerFriendIds.length === 0) return counts;

  const candidateEdges: FriendshipEdge[] = await db
    .select({
      requesterId: schema.friendships.requesterId,
      addresseeId: schema.friendships.addresseeId,
      status: schema.friendships.status,
    })
    .from(schema.friendships)
    .where(and(
      eq(schema.friendships.status, "accepted"),
      or(
        and(
          inArray(schema.friendships.requesterId, viewerFriendIds),
          inArray(schema.friendships.addresseeId, uniqueCandidateIds),
        ),
        and(
          inArray(schema.friendships.addresseeId, viewerFriendIds),
          inArray(schema.friendships.requesterId, uniqueCandidateIds),
        ),
      ),
    ));

  return getMutualFriendCountsFromEdges(userId, uniqueCandidateIds, [...viewerEdges, ...candidateEdges]);
}

export async function getFriendSuggestions(
  db: any,
  userId: number,
  limit = 8,
): Promise<FriendSuggestion[]> {
  const viewerGameRows = await db
    .select({ gameSlug: schema.userGameStats.gameSlug })
    .from(schema.userGameStats)
    .where(and(
      eq(schema.userGameStats.userId, userId),
      gt(schema.userGameStats.gamesPlayed, 0),
    ));
  const viewerGameSlugs: string[] = [...new Set<string>(
    (viewerGameRows as Array<{ gameSlug: string }>).map((row) => row.gameSlug),
  )];
  if (viewerGameSlugs.length === 0) return [];

  const [viewerFriendships, sharedGameRows] = await Promise.all([
    db
      .select({
        requesterId: schema.friendships.requesterId,
        addresseeId: schema.friendships.addresseeId,
      })
      .from(schema.friendships)
      .where(or(
        eq(schema.friendships.requesterId, userId),
        eq(schema.friendships.addresseeId, userId),
      )),
    db
      .select({
        userId: schema.userGameStats.userId,
        gameSlug: schema.userGameStats.gameSlug,
      })
      .from(schema.userGameStats)
      .where(and(
        ne(schema.userGameStats.userId, userId),
        gt(schema.userGameStats.gamesPlayed, 0),
        inArray(schema.userGameStats.gameSlug, viewerGameSlugs),
      )),
  ]);

  const excludedUserIds = new Set<number>([userId]);
  for (const friendship of viewerFriendships) {
    excludedUserIds.add(friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId);
  }

  const sharedGamesByUser = new Map<number, Set<string>>();
  for (const row of sharedGameRows as Array<{ userId: number; gameSlug: string }>) {
    if (excludedUserIds.has(row.userId)) continue;
    const games = sharedGamesByUser.get(row.userId) ?? new Set<string>();
    games.add(row.gameSlug);
    sharedGamesByUser.set(row.userId, games);
  }
  const candidateIds = [...sharedGamesByUser.keys()];
  if (candidateIds.length === 0) return [];

  const candidateUsers = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, candidateIds));
  const mutualFriendCounts = await getMutualFriendCounts(db, userId, candidateIds);

  return rankFriendSuggestions(
    userId,
    viewerGameSlugs,
    candidateUsers.map((candidate: { id: number; username: string; name: string; avatarUrl: string | null }) => ({
      ...candidate,
      avatarUrl: candidate.avatarUrl ?? null,
      playedGameSlugs: [...(sharedGamesByUser.get(candidate.id) ?? [])],
    })),
    excludedUserIds,
    mutualFriendCounts,
    limit,
  );
}
