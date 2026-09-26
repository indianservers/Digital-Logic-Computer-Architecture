import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ACA_LABS } from "../../../data/acaLabs";
import { AcaStudio } from "../AcaStudio";

function renderLab(): string {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/studios/advanced-computer-architecture/combinational-multipliers"] },
    createElement(Routes, null, createElement(Route, { path: "/studios/advanced-computer-architecture/:labId", element: createElement(AcaStudio) })),
  ));
}

describe("Combinational multiplier lab", () => {
  it("places Lab 33 immediately after the Wallace Tree lab", () => {
    expect(ACA_LABS).toHaveLength(34);
    expect(ACA_LABS[31]?.slug).toBe("wallace-tree-adder");
    expect(ACA_LABS[32]?.id).toBe("array-multiplier");
    expect(ACA_LABS[32]?.slug).toBe("combinational-multipliers");
    expect(ACA_LABS[32]?.title).toBe("Combinational Multipliers");
  });

  it("renders the 4×4 example product, the array, and the previous lab link", () => {
    const html = renderLab();
    expect(html).toContain("Combinational Multipliers");
    expect(html).toContain("Lab 33");
    expect(html).toContain("66");
    expect(html).toContain("Correct");
    expect(html).toContain("4 × 4 array");
    expect(html).toContain("AND gate");
    expect(html).toContain("and-0-0");
    expect(html).toContain("ha-1-0");
    expect(html).toContain("Previous: Lab 32");
    expect(html).toContain("Next: Lab 34");
    expect(html).toContain("Visualization step");
    expect(html).toContain("Unsigned");
    expect(html).not.toContain("No results are shown yet");
  });
});
