import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";

interface UserActivityStatusProps {
  lastActiveAt: string | null | undefined;
  className?: string;
}

export function UserActivityStatus({ lastActiveAt, className = "" }: UserActivityStatusProps) {
  const [, setRenderTime] = useState(0);

  useEffect(() => {
    if (!lastActiveAt) return;

    const activeAt = new Date(lastActiveAt).getTime();
    if (Number.isNaN(activeAt)) return;

    const timeUntilInactive = activeAt + 5 * 60_000 - Date.now();
    if (timeUntilInactive <= 0) return;

    const timeout = window.setTimeout(
      () => setRenderTime(Date.now()),
      timeUntilInactive + 1,
    );
    return () => window.clearTimeout(timeout);
  }, [lastActiveAt]);

  if (!lastActiveAt) return null;

  const activeAt = new Date(lastActiveAt);
  if (Number.isNaN(activeAt.getTime())) return null;

  const isActiveNow = Date.now() - activeAt.getTime() < 5 * 60_000;
  const label = isActiveNow
    ? "Active now"
    : `Last active ${formatDistanceToNowStrict(activeAt, { addSuffix: true })}`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-normal text-muted-foreground ${className}`.trim()} data-testid="text-user-activity">
      {isActiveNow && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
      {label}
    </span>
  );
}
