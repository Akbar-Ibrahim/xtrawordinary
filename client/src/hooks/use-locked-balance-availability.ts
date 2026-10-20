import { useQuery } from "@tanstack/react-query";

export interface LockedBalancePair {
  length: number;
  consonantCount: number;
}

export interface LockedBalanceAvailabilityResponse {
  availability: Record<string, boolean>;
}

export function isLockedBalanceConfig(config: unknown): boolean {
  return typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    (config as Record<string, unknown>).category === "locked_balance";
}

export function getLockedBalancePair(config: unknown): LockedBalancePair | null {
  if (!isLockedBalanceConfig(config)) return null;
  const settings = config as Record<string, unknown>;
  const length = settings.level;
  const consonantCount = settings.consonantCount;
  if (
    typeof length !== "number" || typeof consonantCount !== "number" ||
    !Number.isInteger(length) || length < 4 || length > 10 ||
    !Number.isInteger(consonantCount) || consonantCount < 1 || consonantCount >= length
  ) {
    return null;
  }
  return { length, consonantCount };
}

export function useLockedBalanceAvailability(enabled = true) {
  return useQuery<LockedBalanceAvailabilityResponse>({
    queryKey: ["/api/games/letter-balance/locked-balance-availability"],
    queryFn: async () => {
      const response = await fetch("/api/games/letter-balance/locked-balance-availability", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to check Locked Balance word availability");
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
