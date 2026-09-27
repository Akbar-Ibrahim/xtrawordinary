import type { AuthenticatedUser } from "@shared/schema";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export function resolveAuthStatus(
  user: AuthenticatedUser | null,
  isLoading: boolean,
): AuthStatus {
  if (isLoading) return "loading";
  return user ? "authenticated" : "unauthenticated";
}