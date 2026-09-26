import { describe, expect, it } from "vitest";
import { searchStudios, studioMatchesQuery, STUDIOS } from "./curriculum";

describe("smart studio search", () => {
  it("finds labs by alternate names", () => {
    expect(searchStudios("karnaugh")[0]?.id).toBe("kmap");
    expect(searchStudios("cla")[0]?.id).toBe("adders");
    expect(searchStudios("booth")[0]?.path).toBe("/studios/advanced-computer-architecture/booths-multiplier");
    expect(searchStudios("wallace tree")[0]?.id).toBe("aca-wallace-tree");
    expect(searchStudios("virtual labs")[0]?.id).toBe("aca");
    expect(searchStudios("qm")[0]?.id).toBe("kmap");
  });

  it("keeps the combinational multiplier distinct from shift-and-add", () => {
    const titles = searchStudios("combinational multiplier").map((item) => item.title);
    expect(titles[0]).toBe("Combinational Multipliers");
  });

  it("filters catalog cards with the same aliases", () => {
    const kmap = STUDIOS.find((studio) => studio.id === "kmap");
    expect(kmap && studioMatchesQuery(kmap, "karnaugh map")).toBe(true);
    expect(kmap && studioMatchesQuery(kmap, "zzzz-no-lab")).toBe(false);
  });
});
