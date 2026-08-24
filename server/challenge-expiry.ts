const DAY_MS = 24 * 60 * 60 * 1000;

/** Open duel challenges remain available for 24 hours. */
export const OPEN_CHALLENGE_TTL_MS = DAY_MS;

export function getOpenChallengeExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + OPEN_CHALLENGE_TTL_MS);
}

export function getOpenChallengeFallbackCutoff(now = new Date()): Date {
  return new Date(now.getTime() - OPEN_CHALLENGE_TTL_MS);
}

export function isOpenChallengeExpired(
  createdAt: Date | string,
  expiresAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  const deadline = expiresAt
    ? new Date(expiresAt)
    : new Date(new Date(createdAt).getTime() + OPEN_CHALLENGE_TTL_MS);
  return deadline.getTime() <= now.getTime();
}