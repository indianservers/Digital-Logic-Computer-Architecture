import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { labByNumber, labPath, type LabMeta } from "../registry";

const modules = import.meta.glob<{ default: ComponentType<{ meta: LabMeta }> }>(["../g4/L39.tsx", "../g4/L40.tsx", "../g5/L*.tsx", "../g6/L*.tsx"], { eager: true });
describe("all 22 newly opened Microcontroller routes", () => {
  for (let n = 39; n <= 60; n++) it("renders lab " + n + " with a simulator and no placeholder", () => {
    const meta = labByNumber(n)!;
    const Component = modules["../g" + Math.ceil(n / 10) + "/L" + n + ".tsx"]!.default;
    const html = renderToString(createElement(MemoryRouter, { initialEntries: [labPath(meta)] }, createElement(Component, { meta })));
    expect(html).toContain("<h1");
    expect(html).toContain(n <= 54 ? "Experiment workbench" : "Editable firmware");
    expect(html).toContain(n <= 54 ? "Operation trace" : "Firmware and peripheral event log");
    expect(html).not.toMatch(/Lab configuration missing|Lab not found|not available yet/);
    expect(html).toContain("Check current result");
  });
});
