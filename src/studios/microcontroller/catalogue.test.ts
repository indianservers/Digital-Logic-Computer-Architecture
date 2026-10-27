import { describe, expect, it } from "vitest";
import { MCU_CATALOGUE, MCU_OPEN_LABS } from "./catalogue";
import { CORE_LAB_GROUPS, LAB_META, PLANNED_LAB_META, groupLabel, labByNumber, labBySlug, labPath, plannedLabBySlug } from "./labs/registry";

const components = import.meta.glob("./labs/g*/L[0-9][0-9].tsx");
const groups = import.meta.glob<string>("./labs/groups/Group*.tsx", { query: "?raw", import: "default", eager: true });

describe("Microcontroller availability and route coverage", () => {
  it("advertises only core routes with real components and a group dispatch entry", () => {
    expect(LAB_META).toHaveLength(60);
    for (const lab of LAB_META) {
      const component = `L${String(lab.n).padStart(2, "0")}`;
      expect(components, lab.title).toHaveProperty(`./labs/g${lab.group}/${component}.tsx`);
      const source = groups[`./labs/groups/Group${lab.group}.tsx`];
      expect(source, lab.title).toMatch(new RegExp(`\\b${lab.n}:\\s*${component}\\b`));
      expect(labBySlug(lab.slug)).toEqual(lab);
    }
    expect(Object.keys(components)).toHaveLength(LAB_META.length);
  });

  it("has exactly 72 unique open routes and no remaining planned entries", () => {
    expect(MCU_CATALOGUE).toHaveLength(72);
    expect(MCU_OPEN_LABS).toHaveLength(72);
    expect(new Set(MCU_OPEN_LABS.map((lab) => lab.path)).size).toBe(72);
    expect(MCU_CATALOGUE.filter((lab) => lab.status === "planned")).toHaveLength(0);
    for (const lab of MCU_CATALOGUE) {
      expect(Boolean(lab.path)).toBe(lab.status === "open");
      if (lab.path?.includes("/lab/")) expect(labByNumber(lab.number) && labPath(labByNumber(lab.number)!)).toBe(lab.path);
    }
  });

  it("does not send next-lab navigation or group links into unimplemented labs", () => {
    expect(labByNumber(38)).toBeDefined();
    expect(labByNumber(39)).toBeDefined();
    expect(labByNumber(60)).toBeDefined();
    expect(labByNumber(61)).toBeUndefined();
    expect(PLANNED_LAB_META).toHaveLength(0);
    expect(plannedLabBySlug("not-a-lab")).toBeUndefined();
    expect(groupLabel(4)).toBe("Core Labs 31–40");
    for (const group of CORE_LAB_GROUPS) {
      expect(group.component).toBeDefined();
      expect(labByNumber(group.first)).toBeDefined();
      expect(groups[`./labs/groups/Group${group.id}.tsx`]).toBeDefined();
    }
  });
});
