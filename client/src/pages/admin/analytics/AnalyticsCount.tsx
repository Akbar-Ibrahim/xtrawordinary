import { useContext } from "react";
import { cn } from "@/lib/utils";
import { AnalyticsExactValueContext } from "./AnalyticsExactValueProvider";
import { formatAnalyticsCount, formatExactAnalyticsCount } from "./format";

type AnalyticsCountProps = {
  value: number;
  label?: string;
  className?: string;
};

export function AnalyticsCount({
  value,
  label = "Analytics count",
  className,
}: AnalyticsCountProps) {
  const compactValue = formatAnalyticsCount(value);
  const exactValue = formatExactAnalyticsCount(value);
  const showExactValue = useContext(AnalyticsExactValueContext);

  if (compactValue === exactValue) {
    return <span className={className}>{compactValue}</span>;
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Show exact ${label.toLowerCase()}: ${compactValue}`}
        aria-haspopup="dialog"
        onClick={() => showExactValue?.({ value: exactValue, label })}
        className={cn(
          "cursor-zoom-in rounded-sm underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        {compactValue}
      </button>
    </>
  );
}
