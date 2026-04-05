import { describe, expect, it } from "vitest";
import { formatDurationMs } from "./format-duration";

describe("formatDurationMs", () => {
  it("test_formatDurationMs_minutes_and_seconds", () => {
    expect(formatDurationMs(91_000)).toBe("1m 31s");
  });

  it("test_formatDurationMs_seconds_only", () => {
    expect(formatDurationMs(8000)).toBe("8s");
  });
});
