import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import SandboxStudio from "./SandboxStudio";
import { PAGES } from "./sandboxModel";
describe("Sandbox workbench routes", () => {
  for (const page of PAGES)
    it(`renders ${page.id} with its own controls and canvas`, () => {
      const html = renderToString(
        createElement(
          MemoryRouter,
          { initialEntries: [`/architecture/sandbox/${page.id}`] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/architecture/sandbox/:labId",
              element: createElement(SandboxStudio),
            }),
          ),
        ),
      );
      expect(html).toContain(`sb-page-${page.id}`);
      expect(html).toContain('aria-label="Sandbox labs"');
      expect(html).toContain("sb-canvas-host");
      expect(html).not.toContain("Sandbox context is missing");
    });
});
