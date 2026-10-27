import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { StudioNavigation } from "./StudioNavigation";

describe("shared studio navigation contract", () => {
  it.each([
    ["/architecture/mobile/power-thermal", "/architecture/mobile"],
    ["/studios/microcontroller/lab/microcontroller-fundamentals", "/studios/microcontroller"],
    ["/studios/how-devices-work/remote-control", "/studios/how-devices-work"],
  ])("keeps a stable directory, home and guide on %s", (route, home) => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] }, createElement(StudioNavigation)));
    expect(html).toContain('aria-label="Lab navigation"');
    expect(html).toContain('href="/studios"');
    expect(html).toContain(`href="${home}"`);
    expect(html).toContain('aria-label="Switch studio"');
    expect(html).toContain("Lab guide");
  });
});
