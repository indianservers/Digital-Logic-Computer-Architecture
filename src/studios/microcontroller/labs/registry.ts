import { MICROCONTROLLER_LABS } from "../../../data/microcontrollerLabs";

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

export const LAB_META: LabMeta[] = MICROCONTROLLER_LABS.filter((lab) => lab.number <= 60).map((lab) => ({
  n: lab.number,
  title: lab.title,
  slug: slugify(lab.title),
  section: lab.section,
  group: Math.ceil(lab.number / 10),
  variant: BENCH.has(lab.number) ? "bench" : "pro",
}));

export const labBySlug = (slug: string) => LAB_META.find((lab) => lab.slug === slug);
export const labByNumber = (n: number) => LAB_META.find((lab) => lab.n === n);
export const labPath = (lab: LabMeta) => `/studios/microcontroller/lab/${lab.slug}`;
export const groupLabel = (group: number) => `Core Labs ${group * 10 - 9}–${group * 10}`;
