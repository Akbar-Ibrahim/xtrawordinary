const countFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

/** Display counts compactly without changing their underlying values. */
export function formatAnalyticsCount(value: number): string {
  return countFormatter.format(value);
}