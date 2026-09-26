import { LABS_01 } from "./labs01";
import { LABS_05 } from "./labs05";
import { LABS_09 } from "./labs09";
import { LABS_13 } from "./labs13";
import { LABS_17 } from "./labs17";
import { LABS_21 } from "./labs21";
import { LABS_25 } from "./labs25";
import { LABS_29 } from "./labs29";
import type { LabGuideContent } from "./types";

export const LAB_GUIDE_LIST: LabGuideContent[] = [
  ...LABS_01,
  ...LABS_05,
  ...LABS_09,
  ...LABS_13,
  ...LABS_17,
  ...LABS_21,
  ...LABS_25,
  ...LABS_29,
];

export const LAB_GUIDES: Record<string, LabGuideContent> = Object.fromEntries(
  LAB_GUIDE_LIST.map((guide) => [guide.id, guide]),
);
