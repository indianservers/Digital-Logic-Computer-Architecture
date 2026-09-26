import { stepTwo, type Two } from "./predictor";

export interface BranchEvent {
  pc: number;
  text: string;
  taken: boolean;
  comment: string;
}

export interface CorrConfig {
  ghrBits: number;
  phtBits: number;
  localBits: number;
  initial: Two;
  update: boolean;
}

export interface CorrStep {
  pc: number;
  text: string;
  taken: boolean;
  comment: string;
  ghrBefore: number;
  ghrAfter: number;
  pcBits: number;
  ghrBitsUsed: number;
  gshareIndex: number;
  gshareBefore: Two;
  gsharePred: boolean;
  gshareCorrect: boolean;
  gshareAfter: Two;
  localHistBefore: number;
  localHistAfter: number;
  localIndex: number;
  localBefore: Two;
  localPred: boolean;
  localCorrect: boolean;
  localAfter: Two;
  bimodalIndex: number;
  bimodalBefore: Two;
  bimodalPred: boolean;
  bimodalCorrect: boolean;
  bimodalAfter: Two;
  aliasPc: number | null;
  gshare: Two[];
  localPht: Two[];
  bimodal: Two[];
  locals: Array<{ pc: number; hist: number }>;
}

export interface CorrResult {
  initialGhr: number;
  initialGshare: Two[];
  initialLocal: Two[];
  initialBimodal: Two[];
  steps: CorrStep[];
}

export function gshareIndex(pc: number, ghr: number, phtBits: number): number {
  const mask = (1 << phtBits) - 1;
  return (pc ^ ghr) & mask;
}

export function shiftHistory(history: number, width: number, taken: boolean): number {
  if (width <= 0) return 0;
  return ((history << 1) | (taken ? 1 : 0)) & ((1 << width) - 1);
}

export function bitList(value: number, width: number): number[] {
  return Array.from({ length: width }, (_, index) => (value >>> (width - 1 - index)) & 1);
}

export function tally(flags: boolean[]): { correct: number; total: number; percent: number } {
  const correct = flags.filter(Boolean).length;
  const total = flags.length;
  const percent = total ? Math.round((correct / total) * 1000) / 10 : 0;
  return { correct, total, percent };
}

function fill(size: number, initial: Two): Two[] {
  return Array.from({ length: size }, () => initial);
}

export function runCorrelate(events: BranchEvent[], config: CorrConfig): CorrResult {
  const gshare = fill(1 << config.phtBits, config.initial);
  const localPht = fill(1 << config.localBits, config.initial);
  const bimodal = fill(1 << config.phtBits, config.initial);
  const locals = new Map<number, number>();
  const seenIndex = new Map<number, number>();
  let ghr = 0;
  const steps: CorrStep[] = [];
  const mask = (1 << config.phtBits) - 1;
  events.forEach((event) => {
    const ghrBefore = ghr;
    const gshareIndexNow = gshareIndex(event.pc, ghrBefore, config.phtBits);
    const gshareBefore = gshare[gshareIndexNow] ?? config.initial;
    const gsharePred = gshareBefore >= 2;
    const localHistBefore = locals.get(event.pc) ?? 0;
    const localIndex = localHistBefore & ((1 << config.localBits) - 1);
    const localBefore = localPht[localIndex] ?? config.initial;
    const localPred = localBefore >= 2;
    const bimodalIndex = event.pc & mask;
    const bimodalBefore = bimodal[bimodalIndex] ?? config.initial;
    const bimodalPred = bimodalBefore >= 2;
    const previous = seenIndex.get(gshareIndexNow);
    const aliasPc = previous != null && previous !== event.pc ? previous : null;
    seenIndex.set(gshareIndexNow, event.pc);
    if (config.update) {
      gshare[gshareIndexNow] = stepTwo(gshareBefore, event.taken).next;
      localPht[localIndex] = stepTwo(localBefore, event.taken).next;
      bimodal[bimodalIndex] = stepTwo(bimodalBefore, event.taken).next;
      locals.set(event.pc, shiftHistory(localHistBefore, config.localBits, event.taken));
      ghr = shiftHistory(ghrBefore, config.ghrBits, event.taken);
    }
    steps.push({
      pc: event.pc,
      text: event.text,
      taken: event.taken,
      comment: event.comment,
      ghrBefore,
      ghrAfter: ghr,
      pcBits: event.pc & mask,
      ghrBitsUsed: ghrBefore & mask,
      gshareIndex: gshareIndexNow,
      gshareBefore,
      gsharePred,
      gshareCorrect: gsharePred === event.taken,
      gshareAfter: gshare[gshareIndexNow] ?? gshareBefore,
      localHistBefore,
      localHistAfter: locals.get(event.pc) ?? localHistBefore,
      localIndex,
      localBefore,
      localPred,
      localCorrect: localPred === event.taken,
      localAfter: localPht[localIndex] ?? localBefore,
      bimodalIndex,
      bimodalBefore,
      bimodalPred,
      bimodalCorrect: bimodalPred === event.taken,
      bimodalAfter: bimodal[bimodalIndex] ?? bimodalBefore,
      aliasPc,
      gshare: gshare.slice(),
      localPht: localPht.slice(),
      bimodal: bimodal.slice(),
      locals: [...locals.entries()].map(([pc, hist]) => ({ pc, hist })).sort((a, b) => a.pc - b.pc),
    });
  });
  return { initialGhr: 0, initialGshare: fill(1 << config.phtBits, config.initial), initialLocal: fill(1 << config.localBits, config.initial), initialBimodal: fill(1 << config.phtBits, config.initial), steps };
}

function branch(pc: number, taken: boolean, text: string, comment = ""): BranchEvent {
  return { pc, text, taken, comment };
}

function repeat(events: BranchEvent[], times: number): BranchEvent[] {
  return Array.from({ length: times }, () => events).flat();
}

export const CORR_PRESETS: Array<{ id: string; label: string; events: BranchEvent[] }> = [
  {
    id: "pair",
    label: "Correlated pair",
    events: repeat([
      branch(0x100, true, "BEQ x1, x0, A", "A taken"),
      branch(0x120, true, "BNE x2, x0, B", "B follows A"),
      branch(0x100, false, "BEQ x1, x0, A", "A not taken"),
      branch(0x120, false, "BNE x2, x0, B", "B follows A"),
    ], 6),
  },
  {
    id: "alt",
    label: "Alternating branches",
    events: Array.from({ length: 16 }, (_, index) => branch(index % 2 === 0 ? 0x200 : 0x204, index % 2 === 0, index % 2 === 0 ? "BEQ" : "BNE")),
  },
  {
    id: "taken",
    label: "Mostly taken",
    events: Array.from({ length: 16 }, (_, index) => branch(0x300, index % 5 !== 4, "BEQ x1, x0, loop", index % 5 === 4 ? "exit" : "loop")),
  },
  {
    id: "loop",
    label: "Loop-like",
    events: repeat([true, true, true, true, false].map((taken, index) => branch(0x08, taken, "BNE x3, x0, body", index === 4 ? "exit" : "iterate")), 4),
  },
  {
    id: "alias",
    label: "Aliasing",
    events: repeat([
      branch(0x01, true, "BEQ", "index 1 while history is 0"),
      branch(0x00, false, "BNE", "0 xor history 1 lands on the same entry"),
    ], 8),
  },
];
