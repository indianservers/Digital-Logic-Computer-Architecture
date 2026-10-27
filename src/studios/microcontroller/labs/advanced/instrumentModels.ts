import { base, check, copy, event, hex, metric, milliseconds, num, range, sample, select, toggle, yes, type Model, type Params, type Simulation } from "./model";

/** Acquisition clock is independent of the UI's requested advance interval. */
function sampledAdvance(s: Simulation, p: Params, ms: number, acquire: (state: Simulation, params: Params) => void): Simulation {
  const o = copy(s);
  if (o.finished) return o;
  const end = s.time + ms, dt = 1000 / num(p, "rate");
  let next = o.values.nextSample ?? s.time;
  while (next < end - 1e-9 && !o.finished) {
    o.time = next; acquire(o, p); next += dt;
  }
  o.values.nextSample = next;
  if (!o.finished) o.time = end;
  return o;
}

export function uartLevel(tMs: number, baud: number, byte: number, badStop = false): number {
  const bit = Math.floor((tMs - 0.2) * baud / 1000 + 1e-8);
  if (bit < 0 || bit >= 10) return 1;
  if (bit === 0) return 0;
  if (bit === 9) return badStop ? 0 : 1;
  return (byte >>> (bit - 1)) & 1;
}
export function decodeUart(bits: number[], firstMs: number, rate: number, baud: number): { byte: number; framing: boolean } | undefined {
  const at = (bit: number) => Math.round((0.2 + bit * 1000 / baud - firstMs) * rate / 1000);
  if (at(9.5) >= bits.length || at(0.5) < 0) return undefined;
  let byte = 0;
  for (let b = 0; b < 8; b++) byte |= (bits[at(1.5 + b)] ?? 0) << b;
  return { byte, framing: bits[at(0.5)] !== 0 || bits[at(9.5)] !== 1 };
}
export const logicAnalyzer: Model = {
  number: 52, subtitle: "Sample digital edges, trigger an acquisition, and decode UART.", objective: "Capture a complete 8N1 frame and expose aliasing, framing errors, and memory-depth limits.",
  defaults: { baud: 9600, rate: 100000, byte: 85, depth: "256", stop: true }, controls: [range("baud", "UART baud rate", 1200, 115200, 1200, "bit/s"), range("rate", "Sample rate", 2000, 1000000, 2000, "samples/s"), range("byte", "Transmitted byte", 0, 255), select("depth", "Capture depth", ["128", "256", "1024"]), toggle("stop", "Valid stop bit")], stepMs: 0.1,
  plots: [{ label: "TX UART", min: 0, max: 1 }, { label: "Capture gate", min: 0, max: 1 }],
  create: () => base({ triggered: 0, prev: 1, decoded: -1, framing: 0, first: 0 }),
  step: (s, p, ms) => sampledAdvance(s, p, ms, (o, p) => {
      const v = o.values;
      const level = uartLevel(o.time, num(p, "baud"), num(p, "byte"), !yes(p, "stop"));
      if (!v.triggered && v.prev === 1 && level === 0) { v.triggered = 1; v.first = o.time; event(o, "Falling-edge trigger", "UART start captured"); }
      if (v.triggered) { o.memory.push(level); sample(o, level, 1); }
      v.prev = level;
      if (o.memory.length >= num(p, "depth")) {
        const result = decodeUart(o.memory, v.first!, num(p, "rate"), num(p, "baud"));
        if (result) { v.decoded = result.byte; v.framing = +result.framing; event(o, "UART decode", hex(result.byte) + (result.framing ? " framing error" : " valid 8N1")); }
        o.finished = true; o.phase = result ? (result.framing ? "Framing error" : "Frame decoded") : "Buffer ends before a complete frame";
      } else o.phase = v.triggered ? "Capturing digital samples" : "Armed: waiting for start edge";
      if (o.time > 20 && !v.triggered) { o.finished = true; o.phase = "No trigger: samples missed the pulse"; }
  }),
  metrics: (s, p) => [metric("Captured samples", s.memory.length), metric("Sample interval", (1e6 / num(p, "rate")).toFixed(2), "µs"), metric("Samples per bit", (num(p, "rate") / num(p, "baud")).toFixed(2)), metric("Decoded", s.values.decoded! < 0 ? "Incomplete" : hex(s.values.decoded!)), metric("Frame", s.values.framing ? "Invalid stop/start" : s.values.decoded! < 0 ? "Waiting" : "8N1 valid")],
  checks: (s, p) => [check("Trigger an acquisition", s.values.triggered === 1, "Capture starts on a falling edge."), check("Decode the transmitted byte", s.values.decoded === num(p, "byte") && s.values.framing === 0, "Capture enough time for all ten bits."), check("Use adequate sampling", num(p, "rate") >= 8 * num(p, "baud") && s.values.decoded! >= 0, "Aim for at least eight samples per bit; increasing rate also shortens a fixed-depth time window.")],
  guide: ["Run the default 0x55 frame to capture alternating data bits.", "Change the byte and verify the decoder follows.", "Lower sample rate and compare aliasing.", "Increase rate without increasing memory depth; inspect an incomplete frame."], expected: "Sampled edge timing controls decode quality. A finite memory buffer trades time span for time resolution.", equation: "Capture span = sample depth / sample rate; frame time = 10 / baud", limitation: "One deterministic UART source with 8N1 framing and a falling-edge trigger; no vendor instrument driver or external hardware connection.", presets: [{ label: "Clean UART", params: { baud: 9600, rate: 100000, depth: "256", stop: true } }, { label: "Undersampled", params: { baud: 9600, rate: 2000 } }, { label: "Framing fault", params: { stop: false } }],
};

export function analogMeasurement(s: Simulation, offset: number) {
  const points = s.samples.map((p) => p.channels[1]!), min = points.length ? Math.min(...points) : 0, max = points.length ? Math.max(...points) : 0;
  const mean = points.reduce((sum, x) => sum + x, 0) / Math.max(1, points.length);
  const rms = Math.sqrt(points.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(1, points.length));
  const rises = s.samples.filter((p, i, all) => i > 0 && all[i - 1]!.channels[1]! < offset && p.channels[1]! >= offset);
  const frequency = rises.length >= 2 ? 1000 * (rises.length - 1) / (rises.at(-1)!.t - rises[0]!.t) : 0;
  return { min, max, mean, rms, frequency, peakToPeak: max - min };
}
export const oscilloscope: Model = {
  number: 53, subtitle: "Probe a sampled RC response with a trigger and measurement cursors.", objective: "Measure amplitude, RMS, frequency, clipping, and cursor deltas from acquired samples.",
  defaults: { frequency: 1000, amplitude: 1, offset: 1.65, rate: 100000, tau: 0.1, wave: "Sine", cursorA: 20, cursorB: 120 }, controls: [range("frequency", "Signal frequency", 100, 10000, 100, "Hz"), range("amplitude", "Signal amplitude", 0.2, 3, 0.1, "V"), range("offset", "DC offset", 0, 3.3, 0.05, "V"), range("rate", "Sample rate", 5000, 200000, 5000, "samples/s"), range("tau", "RC time constant", 0.01, 1, 0.01, "ms"), select("wave", "Source waveform", ["Sine", "Square"]), range("cursorA", "Cursor A sample", 0, 255, 1, "", true), range("cursorB", "Cursor B sample", 0, 255, 1, "", true)], stepMs: 0.1,
  plots: [{ label: "Source", min: -1, max: 5, unit: "V" }, { label: "RC / ADC", min: 0, max: 3.3, unit: "V" }],
  create: (p) => base({ filtered: num(p, "offset"), clipped: 0, triggered: 0, prev: num(p, "offset"), sampleCount: 0 }),
  step: (s, p, ms) => sampledAdvance(s, p, ms, (o, p) => {
      const v = o.values, dt = 1000 / num(p, "rate");
      const angle = o.time / 1000 * num(p, "frequency") * Math.PI * 2, source = num(p, "offset") + num(p, "amplitude") * (p.wave === "Sine" ? Math.sin(angle) : Math.sin(angle) >= 0 ? 1 : -1);
      v.filtered! += (source - v.filtered!) * (1 - Math.exp(-dt / num(p, "tau")));
      if (!v.triggered && v.prev! < num(p, "offset") && v.filtered! >= num(p, "offset")) { v.triggered = 1; event(o, "Rising-edge trigger", "RC signal crossed the DC offset"); }
      if (v.triggered) { const clipped = Math.max(0, Math.min(3.3, v.filtered!)); if (clipped !== v.filtered) v.clipped!++; const adc = Math.round(clipped / 3.3 * 4095); o.memory.push(adc); sample(o, source, adc / 4095 * 3.3); v.sampleCount!++; }
      v.prev = v.filtered!;
      if (v.sampleCount! >= 256) { o.finished = true; o.phase = "256-sample acquisition complete"; event(o, "Capture complete", "Measurements computed from captured samples"); }
      else o.phase = v.triggered ? "Acquiring" : "Armed: rising trigger";
      if (o.time > 100 && !v.triggered) { o.finished = true; o.phase = "Trigger timeout"; }
  }),
  metrics: (s, p) => {
    const m = analogMeasurement(s, num(p, "offset")), a = s.samples[num(p, "cursorA")], b = s.samples[num(p, "cursorB")];
    return [metric("Peak-to-peak", m.peakToPeak.toFixed(3), "V"), metric("AC RMS", m.rms.toFixed(3), "V"), metric("Measured frequency", m.frequency ? m.frequency.toFixed(1) : "Need two crossings", "Hz"), metric("Clipped samples", s.values.clipped!), metric("Cursor Δt", a && b ? ((b.t - a.t) * 1000).toFixed(2) : "Capture first", "µs"), metric("Cursor ΔV", a && b ? (b.channels[1]! - a.channels[1]!).toFixed(3) : "Capture first", "V")];
  },
  checks: (s, p) => [check("Acquire a triggered record", s.samples.length === 256, "Run until acquisition completes."), check("Avoid ADC clipping", s.samples.length === 256 && s.values.clipped === 0, "Keep the filtered signal within the 0–3.3 V input range."), check("Measure the configured frequency", Math.abs(analogMeasurement(s, num(p, "offset")).frequency - num(p, "frequency")) < num(p, "frequency") * 0.05, "Capture multiple periods with enough samples per period.")],
  guide: ["Acquire the default sine wave and inspect RC attenuation.", "Compare AC RMS with peak-to-peak amplitude.", "Move both measurement cursors across the trace.", "Increase amplitude to clip, then lower sample rate to demonstrate aliasing."], expected: "RC filtering attenuates fast signals. The ADC clips outside its range; sampled crossings determine measured frequency.", equation: "y[n] = y[n−1] + (x[n]−y[n−1]) × (1−exp(−Δt/RC))", limitation: "First-order zero-order-held RC integration and an ideal 12-bit ADC; no probe loading, analog noise, or bandwidth beyond this RC model.", presets: [{ label: "Clean sine", params: { amplitude: 1, offset: 1.65, rate: 100000, frequency: 1000 } }, { label: "Clipping", params: { amplitude: 3, offset: 1.65, tau: 0.01 } }, { label: "Aliasing", params: { frequency: 9000, rate: 5000 } }],
};

function powerTick(o: Simulation, p: Params) {
  const v = o.values, phase = o.time % num(p, "period"), active = phase < num(p, "work"), tx = yes(p, "radio") && (phase < num(p, "burst") || v.forced! > 0);
  if (v.forced! > 0) v.forced!--;
  const current = (active ? 8 : 0.02) + (tx ? 40 : 0) + 0.03;
  const adcV = current / 1000 * num(p, "shunt") * num(p, "gain"), clipped = Math.max(0, Math.min(3.3, adcV)), code = yes(p, "bypass") ? 0 : Math.round(clipped / 3.3 * 4095);
  const measured = code / 4095 * 3.3 / (num(p, "shunt") * num(p, "gain")) * 1000;
  v.actualCharge! += current; v.measuredCharge! += measured; v.energy! += measured * num(p, "voltage"); v.current = current; v.measured = measured; v.adc = code; if (adcV > 3.3) v.clipped!++;
  o.phase = tx ? "Radio transmit burst" : active ? "Active CPU work" : "Low-power idle"; sample(o, current, measured); o.memory = [code & 255, code >>> 8];
}
export const powerAnalyzer: Model = {
  number: 54, subtitle: "Measure current through a shunt and integrate energy over a workload.", objective: "Capture active and radio bursts, detect front-end clipping, and measure charge rather than averaging display snapshots.",
  defaults: { period: 100, work: 10, burst: 5, radio: true, shunt: 1, gain: 20, voltage: 3.3, capacity: 220, bypass: false }, controls: [range("period", "Workload period", 20, 200, 10, "ms"), range("work", "Active CPU duration", 1, 15, 1, "ms"), range("burst", "Radio burst duration", 1, 10, 1, "ms"), toggle("radio", "Radio bursts enabled", true), range("shunt", "Shunt resistance", 0.1, 10, 0.1, "Ω"), range("gain", "Amplifier gain", 5, 100, 5), range("voltage", "Supply", 2, 5, 0.1, "V"), range("capacity", "Battery nominal capacity", 100, 1000, 20, "mAh"), toggle("bypass", "Fault: shunt bypassed")], stepMs: 1,
  plots: [{ label: "Actual current", min: 0, max: 60, unit: "mA" }, { label: "Measured current", min: 0, max: 60, unit: "mA" }],
  create: () => base({ actualCharge: 0, measuredCharge: 0, energy: 0, current: 0, measured: 0, adc: 0, clipped: 0, forced: 0 }, [0, 0]),
  step: (s, p, ms) => milliseconds(s, p, ms, powerTick),
  actions: [{ id: "burst", label: "Force radio burst" }], action: (s, p) => { const o = copy(s); o.values.forced = num(p, "burst"); event(o, "Transmit requested", "A timed radio-current burst was queued"); return o; },
  metrics: (s, p) => { const average = s.values.measuredCharge! / Math.max(1, s.time); return [metric("Average measured", average.toFixed(3), "mA"), metric("Actual / measured", s.values.current!.toFixed(2) + " / " + s.values.measured!.toFixed(2), "mA"), metric("Charge", s.values.measuredCharge!.toFixed(2), "µC"), metric("Energy", s.values.energy!.toFixed(2), "µJ"), metric("Ideal battery estimate", average > 0 ? (num(p, "capacity") / average).toFixed(1) : "Unavailable", "h"), metric("Clipped samples", s.values.clipped!)]; },
  checks: (s, p) => [check("Measure a complete workload period", s.time >= num(p, "period"), "Include both bursts and idle current."), check("Avoid front-end clipping", s.time > 0 && s.values.clipped === 0, "Reduce shunt resistance or gain if the amplifier exceeds 3.3 V."), check("Keep integrated charge error below 5%", s.time >= num(p, "period") && Math.abs(s.values.measuredCharge! - s.values.actualCharge!) / Math.max(1, s.values.actualCharge!) < 0.05, "Correct clipping or a bypassed shunt before trusting the charge estimate.")],
  guide: ["Run a full workload period and inspect transmit bursts.", "Compare actual and quantized shunt measurements.", "Raise shunt resistance to clip the amplifier.", "Repair gain and compare integrated charge."], expected: "Brief high-current bursts contribute to total charge. Clipping or bypassed shunts under-report consumption.", equation: "I = ADCvolts / (Rshunt × gain); Q = Σ IΔt; E = VQ", limitation: "Illustrative component currents and ideal battery-capacity arithmetic; no discharge curve, converter efficiency, or temperature model.", presets: [{ label: "Valid measurement", params: { shunt: 1, gain: 20, bypass: false } }, { label: "Amplifier clipping", params: { shunt: 10, gain: 100 } }, { label: "Bypassed shunt", params: { bypass: true } }],
};
