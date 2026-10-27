import { describe, expect, it } from "vitest";
import { theoryForRoute } from "../theory/catalogue";
import { focusedArticle } from "../theory/focus";
import { experimentSearch } from "./experimentContext";

describe("experiment route identity", () => {
  it("uses the same record when the default tab is explicitly selected", () => {
    for (const [path, tab] of [["/studios/bus", "address"], ["/studios/multicore", "mesi"], ["/studios/memory", "array"], ["/studios/io", "mapped"]]) {
      const bare = theoryForRoute(path!, experimentSearch(path!, ""));
      const explicit = theoryForRoute(path!, `?tab=${tab}`);
      expect(bare).toBeDefined();
      expect(explicit).toBeDefined();
      expect(focusedArticle(bare!).route).toBe(focusedArticle(explicit!).route);
    }
  });
  it("preserves a selected tab or flip-flop device and unrelated simulator settings", () => {
    expect(new URLSearchParams(experimentSearch("/studios/memory", "?tab=dram&speed=2")).get("tab")).toBe("dram");
    const params = new URLSearchParams(experimentSearch("/studios/flip-flops", "?device=jk&view=theory"));
    expect(params.has("tab")).toBe(false);
    expect(params.get("device")).toBe("jk");
    expect(params.get("view")).toBe("theory");
  });
});
