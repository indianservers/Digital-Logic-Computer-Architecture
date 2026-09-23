import { describe, expect, it } from "vitest";
import { resolveTab } from "../layout/useStudioTab";

describe("studio tabs", () => {
  it("falls back when the query tab is missing or unknown", () => {
    expect(resolveTab(null, ["array", "decode"], "array")).toBe("array");
    expect(resolveTab("decode", ["array", "decode"], "array")).toBe("decode");
    expect(resolveTab("nope", ["array", "decode"], "array")).toBe("array");
  });
});
