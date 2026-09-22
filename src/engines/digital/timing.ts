import type { LogicBit } from "../../types/logic";

/** Frequency in MHz, period in nanoseconds. */
export function periodNs(frequencyMHz: number): number {
  if (frequencyMHz <= 0) return 0;
  return 1000 / frequencyMHz;
}

export function frequencyMHz(periodNsValue: number): number {
  if (periodNsValue <= 0) return 0;
  return 1000 / periodNsValue;
}

export function clockSamples(period: number, duty: number, phaseDeg: number, count: number): Array<0 | 1> {
  const high = Math.min(100, Math.max(1, duty)) / 100;
  const phase = ((phaseDeg % 360) + 360) % 360 / 360;
  return Array.from({ length: count }, (_, index) => {
    const place = (index / Math.max(1, period) + phase) % 1;
    return place < high ? 1 : 0;
  });
}

export function edges(samples: Array<0 | 1>, kind: "rise" | "fall"): number[] {
  const found: number[] = [];
  for (let index = 1; index < samples.length; index += 1) {
    const prev = samples[index - 1];
    const next = samples[index];
    if (kind === "rise" && prev === 0 && next === 1) found.push(index);
    if (kind === "fall" && prev === 1 && next === 0) found.push(index);
  }
  return found;
}

export function setupViolated(changeTime: number, edgeTime: number, setup: number): boolean {
  return changeTime > edgeTime - setup && changeTime <= edgeTime;
}

export function holdViolated(changeTime: number, edgeTime: number, hold: number): boolean {
  return changeTime > edgeTime && changeTime < edgeTime + hold;
}

export function capture(dBefore: 0 | 1, changeTime: number, edgeTime: number, setup: number, hold: number): { value: LogicBit; reason: string } {
  if (setupViolated(changeTime, edgeTime, setup)) {
    return { value: "X", reason: "D changed inside the setup window, so the captured value is uncertain." };
  }
  if (holdViolated(changeTime, edgeTime, hold)) {
    return { value: "X", reason: "D changed inside the hold window, so the captured value is uncertain." };
  }
  return { value: dBefore, reason: "D was stable through setup and hold, so Q captures that level." };
}

export function metastableNote(violated: boolean): { what: string; why: string; notice: string } {
  if (!violated) {
    return {
      what: "The data input stayed still around the active edge.",
      why: "The latch inside the flip-flop had a clear 0 or 1 to resolve.",
      notice: "This view is educational. It does not simulate analog transistor recovery.",
    };
  }
  return {
    what: "Setup or hold was missed.",
    why: "The internal nodes can sit between legal levels for an uncertain interval.",
    notice: "The output is marked X until a later clock, not as a measured analog waveform.",
  };
}

export function delayedTransition(inputTime: number, delay: number): { outputTime: number; note: string } {
  return { outputTime: inputTime + delay, note: `The output moves ${delay} ns of simulated time after the input.` };
}
