import { usePersonalBest } from "@/hooks/use-game-result";

interface PersonalBestPairProps {
  classicSlug: string;
  survivalSlug: string;
  className?: string;
  testId?: string;
}

export function PersonalBestPair({
  classicSlug,
  survivalSlug,
  className = "",
  testId,
}: PersonalBestPairProps) {
  const classicBest = usePersonalBest(classicSlug);
  const survivalBest = usePersonalBest(survivalSlug);

  return (
    <div
      className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground ${className}`}
      data-testid={testId}
      aria-label={`Classic personal best: ${classicBest || "none"} points. Survival personal best: ${survivalBest || "none"} points.`}
    >
      <span>
        Classic PB:{" "}
        <strong className="font-semibold text-foreground">
          {classicBest > 0 ? classicBest.toLocaleString() : "—"}
        </strong>
      </span>
      <span>
        Survival PB:{" "}
        <strong className="font-semibold text-foreground">
          {survivalBest > 0 ? survivalBest.toLocaleString() : "—"}
        </strong>
      </span>
    </div>
  );
}
