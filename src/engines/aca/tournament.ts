import { gshareIndex, shiftHistory, tally, type BranchEvent } from "./correlate";
import { stepTwo, type Two } from "./predictor";

export type Chooser = 0 | 1 | 2 | 3;

export interface TourConfig {
  localBits: number;
  ghrBits: number;
  phtBits: number;
  bimodalBits: number;
  initial: Two;
  chooser: Chooser;
  update: boolean;
}

export interface TourStep {
  pc: number;
  text: string;
  taken: boolean;
  localHist: number;
  localBefore: Two;
  localPred: boolean;
  localCorrect: boolean;
  ghrBefore: number;
  gshareIndex: number;
  globalBefore: Two;
  globalPred: boolean;
  globalCorrect: boolean;
  bimodalIndex: number;
  bimodalBefore: Two;
  bimodalPred: boolean;
  bimodalCorrect: boolean;
  chooserBefore: Chooser;
  selected: "local" | "global";
  finalPred: boolean;
  finalCorrect: boolean;
  chooserAfter: Chooser;
  disagree: boolean;
  localPht: Two[];
  globalPht: Two[];
  bimodalPht: Two[];
  locals: Array<{ pc: number; hist: number }>;
}

export interface TourResult {
  steps: TourStep[];
  local: ReturnType<typeof tally>;
  global: ReturnType<typeof tally>;
  bimodal: ReturnType<typeof tally>;
  tournament: ReturnType<typeof tally>;
  localPicks: number;
  globalPicks: number;
  switches: number;
}

export function prefer(state: Chooser): "local" | "global" {
  return state < 2 ? "local" : "global";
}

export function trainChooser(state: Chooser, localCorrect: boolean, globalCorrect: boolean): Chooser {
  if (localCorrect === globalCorrect) return state;
  if (localCorrect) return Math.max(0, state - 1) as Chooser;
  return Math.min(3, state + 1) as Chooser;
}

function fill(size: number, initial: Two): Two[] {
  return Array.from({ length: size }, () => initial);
}

export function runTournament(events: BranchEvent[], config: TourConfig): TourResult {
  const localPht = fill(1 << config.localBits, config.initial);
  const globalPht = fill(1 << config.phtBits, config.initial);
  const bimodalPht = fill(1 << config.bimodalBits, config.initial);
  const locals = new Map<number, number>();
  let ghr = 0;
  let chooser = config.chooser;
  let switches = 0;
  const steps: TourStep[] = [];
  events.forEach((event) => {
    const localHist = locals.get(event.pc) ?? 0;
    const localIndex = localHist & ((1 << config.localBits) - 1);
    const localBefore = localPht[localIndex] ?? config.initial;
    const localPred = localBefore >= 2;
    const ghrBefore = ghr;
    const index = gshareIndex(event.pc, ghrBefore, config.phtBits);
    const globalBefore = globalPht[index] ?? config.initial;
    const globalPred = globalBefore >= 2;
    const bimodalIndex = event.pc & ((1 << config.bimodalBits) - 1);
    const bimodalBefore = bimodalPht[bimodalIndex] ?? config.initial;
    const bimodalPred = bimodalBefore >= 2;
    const selected = prefer(chooser);
    const finalPred = selected === "local" ? localPred : globalPred;
    const localCorrect = localPred === event.taken;
    const globalCorrect = globalPred === event.taken;
    const chooserBefore = chooser;
    if (config.update) {
      localPht[localIndex] = stepTwo(localBefore, event.taken).next;
      globalPht[index] = stepTwo(globalBefore, event.taken).next;
      bimodalPht[bimodalIndex] = stepTwo(bimodalBefore, event.taken).next;
      locals.set(event.pc, shiftHistory(localHist, config.localBits, event.taken));
      ghr = shiftHistory(ghrBefore, config.ghrBits, event.taken);
      const next = trainChooser(chooser, localCorrect, globalCorrect);
      if (next !== chooser) switches += 1;
      chooser = next;
    }
    steps.push({
      pc: event.pc,
      text: event.text,
      taken: event.taken,
      localHist,
      localBefore,
      localPred,
      localCorrect,
      ghrBefore,
      gshareIndex: index,
      globalBefore,
      globalPred,
      globalCorrect,
      bimodalIndex,
      bimodalBefore,
      bimodalPred,
      bimodalCorrect: bimodalPred === event.taken,
      chooserBefore,
      selected,
      finalPred,
      finalCorrect: finalPred === event.taken,
      chooserAfter: chooser,
      disagree: localPred !== globalPred,
      localPht: localPht.slice(),
      globalPht: globalPht.slice(),
      bimodalPht: bimodalPht.slice(),
      locals: [...locals.entries()].map(([pc, hist]) => ({ pc, hist })).sort((a, b) => a.pc - b.pc),
    });
  });
  return {
    steps,
    local: tally(steps.map((step) => step.localCorrect)),
    global: tally(steps.map((step) => step.globalCorrect)),
    bimodal: tally(steps.map((step) => step.bimodalCorrect)),
    tournament: tally(steps.map((step) => step.finalCorrect)),
    localPicks: steps.filter((step) => step.selected === "local").length,
    globalPicks: steps.filter((step) => step.selected === "global").length,
    switches,
  };
}

function branch(pc: number, taken: boolean, text = "BEQ"): BranchEvent {
  return { pc, text, taken, comment: "" };
}

function repeat(events: BranchEvent[], times: number): BranchEvent[] {
  return Array.from({ length: times }, () => events).flat();
}

export const TOUR_PRESETS: Array<{ id: string; label: string; events: BranchEvent[] }> = [
  {
    id: "local",
    label: "Locally predictable",
    events: repeat([
      branch(0x100, true), branch(0x180, false),
      branch(0x100, true), branch(0x180, false),
      branch(0x100, false), branch(0x180, true),
    ], 6),
  },
  {
    id: "global",
    label: "Globally correlated",
    events: repeat([
      branch(0x10, true, "A"), branch(0x14, true, "B follows A"),
      branch(0x10, false, "A"), branch(0x14, false, "B follows A"),
    ], 8),
  },
  {
    id: "mixed",
    label: "Mixed workload",
    events: [
      ...repeat([branch(0x100, true), branch(0x100, true), branch(0x100, true), branch(0x100, false)], 4),
      ...repeat([branch(0x20, true, "A"), branch(0x24, true, "B"), branch(0x20, false, "A"), branch(0x24, false, "B")], 4),
    ],
  },
  {
    id: "loop",
    label: "Loop behavior",
    events: repeat([true, true, true, true, false].map((taken) => branch(0x08, taken, "BNE")), 6),
  },
  {
    id: "phase",
    label: "Phase change",
    events: [
      ...repeat([branch(0x100, true), branch(0x140, false), branch(0x100, true), branch(0x140, true)], 4),
      ...repeat([branch(0x30, true, "A"), branch(0x34, true, "B"), branch(0x30, false, "A"), branch(0x34, false, "B")], 6),
    ],
  },
  {
    id: "alias",
    label: "Aliasing-heavy",
    events: repeat([branch(0x00, true), branch(0x10, false), branch(0x20, true), branch(0x30, false)], 6),
  },
];

export function chooserName(state: Chooser): string {
  return ["Strongly local", "Weakly local", "Weakly global", "Strongly global"][state] ?? "Weakly local";
}
