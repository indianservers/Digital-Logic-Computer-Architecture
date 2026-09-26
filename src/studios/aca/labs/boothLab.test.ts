import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ACA_LABS } from "../../../data/acaLabs";
import { AcaStudio } from "../AcaStudio";

function renderLab(): string {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/studios/advanced-computer-architecture/booths-multiplier"] },
    createElement(Routes, null, createElement(Route, { path: "/studios/advanced-computer-architecture/:labId", element: createElement(AcaStudio) })),
  ));
}

describe("Booth multiplier lab", () => {
  it("places Lab 34 immediately after the combinational multiplier", () => {
    expect(ACA_LABS).toHaveLength(34);
    const ids = ACA_LABS.map((lab) => lab.id);
    const slugs = ACA_LABS.map((lab) => lab.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(ACA_LABS[32]?.slug).toBe("combinational-multipliers");
    expect(ACA_LABS[33]?.id).toBe("booth-multiplier");
    expect(ACA_LABS[33]?.slug).toBe("booths-multiplier");
    expect(ACA_LABS[33]?.title).toBe("Booth's Multiplier");
  });

  it("renders the signed example, the decision rule, and the previous lab", () => {
    const html = renderLab();
    expect(html).toContain("Booth");
    expect(html).toContain("Lab 34");
    expect(html).toContain("-15");
    expect(html).toContain("Correct");
    expect(html).toContain("No operation");
    expect(html).toContain("Previous: Lab 33");
    expect(html).toContain("Q0");
    expect(html).toContain("Cycle 0 of 4");
    expect(html).not.toContain("No results are shown yet");
  });
});
