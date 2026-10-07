import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from './test-course-render';
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CATEGORIES, DEVICES, FEATURES, devicePath, findDevice, relatedDevices, searchDevices } from "./catalogue";
import { DevicePage } from "./HowDevicesWorkStudio";
import { findLab } from "./labs/data";
import { findAdvancedLab } from "./advanced/data";
const assets = import.meta.glob<string>("/public/devices/*.svg", { query: "?raw", import: "default", eager: true });

describe("How Devices Work catalogue", () => {
  it("covers every requested category entry with unique canonical pages", () => {
    expect(CATEGORIES.map(category => DEVICES.filter(device => device.categories.includes(category.id)).length)).toEqual([49, 21, 21, 14, 14, 21]);
    expect(DEVICES).toHaveLength(140);
    expect(new Set(DEVICES.map(device => device.name)).size).toBe(136);
    expect(new Set(DEVICES.map(devicePath)).size).toBe(140);
  });
  it.each(DEVICES.map(device => [device.name, device] as const))("resolves %s and validates its assets and preview content", (_name, device) => {
    const path = devicePath(device);
    expect(path).toMatch(/^\/studios\/how-devices-work\/[a-z]+\/[a-z0-9-]+$/);
    const [, , , category, slug] = path.split("/");
    expect(findDevice(category, slug)).toBe(device);
    expect(device.categories).toContain(device.category);
    expect(device.status).toBe(findLab(device.id) ? "available" : "upcoming");
    expect(device.shortDescription.length).toBeGreaterThan(40);
    expect(device.longDescription).toContain(device.name);
    expect(device.signalFlow.length).toBeGreaterThanOrEqual(5);
    expect(device.futureFeatures.every(feature => FEATURES[feature])).toBe(true);
    expect(assets[`/public${device.thumbnail}`]).toContain("<svg");
    expect(relatedDevices(device)).toHaveLength(4);
    expect(relatedDevices(device).every(item => item.id !== device.id)).toBe(true);
  });
  it("keeps the four requested contextual labs on distinct category routes", () => {
    for (const name of ["Satellite Communication Terminal", "Inertial Navigation System", "Electronic Compass", "GPS Receiver"]) {
      const contexts = DEVICES.filter(item => item.name === name);
      expect(contexts).toHaveLength(2);
      expect(new Set(contexts.map(devicePath)).size).toBe(2);
      for (const device of contexts) {
        expect(device.categories).toEqual([device.category]);
        expect(searchDevices(name, device.category).filter(item=>item.name===name)).toEqual([device]);
      }
      expect(searchDevices(name).filter(item=>item.name===name)).toHaveLength(2);
    }
  });
  it.each(DEVICES.filter(device=>!findLab(device.id)&&!findAdvancedLab(device.id)).map(device => [devicePath(device), device] as const))("renders the correct Upcoming page at %s", (path, device) => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null, createElement(Route, { path: "/studios/how-devices-work/:category/:slug", element: createElement(DevicePage) }))));
    expect(html).toContain(`<h1>${device.name.replace(/&/g, "&amp;")}</h1>`);
    expect(html).toContain("How This Device Works");
    expect(html).toContain("Device Guide Coming Soon");
    expect(html).toContain(device.thumbnail);
    expect(html).toContain("Related devices");
    expect(html).toContain('aria-label="Studio breadcrumb"');
    expect(html).not.toContain("Device not found");
  });
  it("searches names, every associated category, keywords and multiple terms", () => {
    expect(searchDevices("MRI").map(device => device.name)).toEqual(["MRI Scanner"]);
    expect(searchDevices("medical")).toHaveLength(49);
    expect(searchDevices(" RADAR ").some(device => device.name === "Weather Radar")).toBe(true);
    expect(searchDevices("radar").some(device => device.name === "Marine Radar")).toBe(true);
    expect(searchDevices("radar").some(device => device.name === "Surveillance Radar")).toBe(true);
    expect(searchDevices("marine compass").map(device => device.name)).toContain("Electronic Compass");
    expect(searchDevices("marine compass").every(device => device.categories.includes("marine"))).toBe(true);
    expect(searchDevices("thermistor").some(device => device.name === "Digital Thermometer")).toBe(true);
    expect(searchDevices("nonexistent-xyz")).toEqual([]);
  });
  it("has distinct flows for the core study devices and valid unknown-route handling", () => {
    const names = ["Digital Thermometer", "ECG Machine", "MRI Scanner", "TV Remote Control", "SONAR", "Aircraft Autopilot", "Robotic Arm", "NFC Payment System"];
    const flows = names.map(name => DEVICES.find(device => device.name === name)!.signalFlow.join("|"));
    expect(new Set(flows).size).toBe(names.length);
    expect(findDevice("medical", "no-such-device")).toBeUndefined();
    expect(findDevice("marine", "mri-scanner")).toBeUndefined();
  });
});
