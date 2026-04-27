import { describe, expect, it } from "vitest";
import { terminalFontFamilyForPreset } from "./appearance";

describe("appearance", () => {
  it("test_terminalFontFamilyForPreset_each_preset_non_empty", () => {
    expect(terminalFontFamilyForPreset("system-mono").length).toBeGreaterThan(
      8,
    );
    expect(terminalFontFamilyForPreset("jetbrains")).toContain("JetBrains");
    expect(terminalFontFamilyForPreset("fira")).toContain("Fira");
  });
});
