import assert from "node:assert/strict";
import test from "node:test";
import { formatAnalyticsCount } from "./format";

test("analytics counts use uppercase compact units and keep small counts readable", () => {
  for (const [value, expected] of [
    [0, "0"], [37, "37"], [999, "999"],
    [1_000, "1K"], [1_500, "1.5K"], [10_000, "10K"],
    [125_000, "125K"], [1_000_000, "1M"], [1_250_000, "1.3M"],
    [1_000_000_000, "1B"], [1_000_000_000_000, "1T"],
    [999_950, "1M"],
  ] as const) {
    assert.equal(formatAnalyticsCount(value), expected);
  }
});