const countFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});
const exactCountFormatter = new Intl.NumberFormat("en-US");

/** Display counts compactly without changing their underlying values. */
export function formatAnalyticsCount(value: number): string {
  return countFormatter.format(value);
}

/** Display the underlying count with grouping separators and no compact notation. */
export function formatExactAnalyticsCount(value: number): string {
  return exactCountFormatter.format(value);
}