import { LABS_01 } from "./labs01";
import { LABS_05 } from "./labs05";
import { LABS_09 } from "./labs09";
import { LABS_13 } from "./labs13";
import { LABS_17 } from "./labs17";
import { LABS_21 } from "./labs21";
import { LABS_25 } from "./labs25";
import { LABS_29 } from "./labs29";
import { LABS_32 } from "./labs32";
import { LABS_33 } from "./labs33";
import { LABS_34 } from "./labs34";
import type { LabGuideContent } from "./types";
import { WALKTHROUGHS } from "./walkthroughs";

export const LAB_GUIDE_LIST: LabGuideContent[] = [
  ...LABS_01,
  ...LABS_05,
  ...LABS_09,
  ...LABS_13,
  ...LABS_17,
  ...LABS_21,
  ...LABS_25,
  ...LABS_29,
  ...LABS_32,
  ...LABS_33,
  ...LABS_34,
].map((guide) => {
  const walkthrough = WALKTHROUGHS[guide.id];
  return walkthrough ? { ...guide, walkthrough } : guide;
});

export const LAB_GUIDES: Record<string, LabGuideContent> = Object.fromEntries(
  LAB_GUIDE_LIST.map((guide) => [guide.id, guide]),
);
