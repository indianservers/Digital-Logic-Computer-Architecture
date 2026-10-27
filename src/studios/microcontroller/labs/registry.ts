import { MICROCONTROLLER_LABS } from "../../../data/microcontrollerLabs";
import { lazy } from "react";

export type ShellVariant = "pro" | "bench";

export interface LabMeta {
  n: number;
  title: string;
  slug: string;
  section: string;
  group: number;
  variant: ShellVariant;
}

const slugify = (title: string) => title.toLowerCase().replace(/²/g, "2").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Shell style per lab, taken from the matching mockup in UI Target/Microcontroller. */
const BENCH = new Set<number>([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

/** Availability and route loading share these component-backed ranges. */
export const CORE_LAB_GROUPS = [
  { id: 1, first: 1, last: 10, component: lazy(() => import("./groups/Group1")) },
  { id: 2, first: 11, last: 20, component: lazy(() => import("./groups/Group2")) },
  { id: 3, first: 21, last: 30, component: lazy(() => import("./groups/Group3")) },
  { id: 4, first: 31, last: 40, component: lazy(() => import("./groups/Group4")) },
  { id: 5, first: 41, last: 50, component: lazy(() => import("./groups/Group5")) },
  { id: 6, first: 51, last: 60, component: lazy(() => import("./groups/Group6")) },
] as const;

export const CORE_LAB_ROADMAP: LabMeta[] = MICROCONTROLLER_LABS.filter((lab) => lab.number <= 60).map((lab) => ({
  n: lab.number,
  title: lab.title,
  slug: slugify(lab.title),
  section: lab.section,
  group: Math.ceil(lab.number / 10),
  variant: BENCH.has(lab.number) ? "bench" : "pro",
}));

export const LAB_META = CORE_LAB_ROADMAP.filter((lab) => CORE_LAB_GROUPS.some((group) => lab.n >= group.first && lab.n <= group.last));
export const PLANNED_LAB_META = CORE_LAB_ROADMAP.filter((lab) => !LAB_META.some((available) => available.n === lab.n));
export const plannedLabBySlug = (slug: string) => PLANNED_LAB_META.find((lab) => lab.slug === slug);
export const labBySlug = (slug: string) => LAB_META.find((lab) => lab.slug === slug);
export const labByNumber = (n: number) => LAB_META.find((lab) => lab.n === n);
export const labPath = (lab: LabMeta) => `/studios/microcontroller/lab/${lab.slug}`;
export const groupLabel = (group: number) => {
  const range = CORE_LAB_GROUPS.find((item) => item.id === group);
  return range ? `Core Labs ${range.first}–${range.last}` : "Planned core labs";
};
