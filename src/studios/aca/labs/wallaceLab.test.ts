import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ACA_LABS } from "../../../data/acaLabs";
import { AcaStudio } from "../AcaStudio";

describe("Wallace Tree lab navigation", () => {
  it("places Lab 32 immediately after Lab 31", () => {
    expect(ACA_LABS).toHaveLength(34);
    expect(ACA_LABS[32]?.slug).toBe("combinational-multipliers");
    expect(ACA_LABS[33]?.slug).toBe("booths-multiplier");
    expect(ACA_LABS[30]?.slug).toBe("performance-counters");
    expect(ACA_LABS[31]?.id).toBe("wallace-tree");
    expect(ACA_LABS[31]?.slug).toBe("wallace-tree-adder");
    expect(ACA_LABS[31]?.title).toBe("Wallace Tree Adder");
  });

  it("renders the lab with the example sum and the final-adder control", () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/studios/advanced-computer-architecture/wallace-tree-adder"] },
      createElement(Routes, null, createElement(Route, { path: "/studios/advanced-computer-architecture/:labId", element: createElement(AcaStudio) })),
    ));
    expect(html).toContain("Wallace Tree Adder");
    expect(html).toContain("Lab 32");
    expect(html).toContain("Correct");
    expect(html).toContain("54");
    expect(html).toContain("Carry Look-Ahead Adder");
    expect(html).toContain("Ripple Carry Adder");
    expect(html).toContain("Previous: Lab 31");
    expect(html).toContain("Next: Lab 33");
    expect(html).not.toContain("No results are shown yet");
  });
});
