export type Bit = 0 | 1;
export type Two = 0 | 1 | 2 | 3;

export interface PredStep {
  actual: boolean;
  bitBefore: Bit;
  bitPred: boolean;
  bitCorrect: boolean;
  bitAfter: Bit;
  twoBefore: Two;
  twoPred: boolean;
  twoCorrect: boolean;
  twoAfter: Two;
}

const TWO_NAME = ["Strongly Not Taken", "Weakly Not Taken", "Weakly Taken", "Strongly Taken"] as const;

export function twoName(state: Two): string {
  return TWO_NAME[state];
}

export function stepOne(state: Bit, taken: boolean): { pred: boolean; correct: boolean; next: Bit } {
  const pred = state === 1;
  return { pred, correct: pred === taken, next: taken ? 1 : 0 };
}

export function stepTwo(state: Two, taken: boolean): { pred: boolean; correct: boolean; next: Two } {
  const pred = state >= 2;
  const next = (taken ? Math.min(3, state + 1) : Math.max(0, state - 1)) as Two;
  return { pred, correct: pred === taken, next };
}

export function runTrace(trace: boolean[], bit0: Bit = 1, two0: Two = 3): PredStep[] {
  let bit = bit0;
  let two = two0;
  return trace.map((actual) => {
    const one = stepOne(bit, actual);
    const saturating = stepTwo(two, actual);
    const row: PredStep = {
      actual,
      bitBefore: bit,
      bitPred: one.pred,
      bitCorrect: one.correct,
      bitAfter: one.next,
      twoBefore: two,
      twoPred: saturating.pred,
      twoCorrect: saturating.correct,
      twoAfter: saturating.next,
    };
    bit = one.next;
    two = saturating.next;
    return row;
  });
}

export function accuracy(rows: PredStep[], kind: "bit" | "two"): { correct: number; total: number; percent: number } {
  const correct = rows.filter((row) => (kind === "bit" ? row.bitCorrect : row.twoCorrect)).length;
  const total = rows.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0 };
}

export const LOOP_TRACE: boolean[] = Array.from({ length: 4 }, () => [true, true, true, true, false]).flat();

export const PREDICT_PRESETS: Array<{ id: string; label: string; trace: boolean[] }> = [
  { id: "loop", label: "Simple Loop", trace: LOOP_TRACE },
  { id: "alt", label: "Alternating", trace: Array.from({ length: 20 }, (_, index) => index % 2 === 0) },
  { id: "taken", label: "Mostly Taken", trace: Array.from({ length: 20 }, (_, index) => index % 5 !== 4) },
  { id: "not", label: "Mostly Not Taken", trace: Array.from({ length: 20 }, (_, index) => index % 5 === 0) },
];

export function parseTrace(text: string): boolean[] {
  return text.toUpperCase().split(/\s+/).filter((token) => token === "T" || token === "N").map((token) => token === "T");
}
