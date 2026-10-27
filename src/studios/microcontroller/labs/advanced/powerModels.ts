import { base, check, copy, event, hex, metric, milliseconds, num, range, sample, select, toggle, yes, type Model } from "./model";

const currents: Record<string, number> = { Run: 8, Sleep: 2, Stop: 0.05, Standby: 0.003 };
export const sleep: Model = {
  number: 42, subtitle: "Wake sources must survive their clock domain.", objective: "Measure integrated charge and compare retained sleep with reset-on-wake standby.",
  defaults: { mode: "Stop", wake: "RTC", period: 100, work: 5, enabled: true }, controls: [select("mode", "Idle power mode", ["Run", "Sleep", "Stop", "Standby"]), select("wake", "Wake source", ["RTC", "APB timer", "None"]), range("period", "Wake interval", 20, 200, 10, "ms"), range("work", "Active work", 1, 15, 1, "ms"), toggle("enabled", "Wake interrupt enabled", true)], stepMs: 5,
  plots: [{ label: "Current", min: 0, max: 8, unit: "mA" }, { label: "Core awake", min: 0, max: 1 }],
  create: (p) => base({ workLeft: num(p, "work"), wakes: 0, reboots: 0, charge: 0, activeMs: 0, blockedWakes: 0 }),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values, mode = String(cfg.mode);
    if (o.time > 0 && o.time % num(cfg, "period") === 0 && cfg.wake !== "None") {
      const survives = cfg.wake === "RTC" || mode === "Run" || mode === "Sleep";
      if (survives && yes(cfg, "enabled")) { v.wakes!++; v.workLeft = num(cfg, "work") + (mode === "Stop" ? 2 : mode === "Standby" ? 5 : 0); if (mode === "Standby") v.reboots!++; event(o, mode === "Standby" ? "Wake reset" : "Wake IRQ", String(cfg.wake) + (mode === "Standby" ? ": context lost; boot again" : ": execution resumes")); }
      else { v.blockedWakes!++; event(o, "Wake unavailable", survives ? "Interrupt masked" : "APB timer clock stopped"); }
    }
    const awake = mode === "Run" || v.workLeft! > 0, current = awake ? 8 : currents[mode]!;
    if (v.workLeft! > 0) v.workLeft!--; if (awake) v.activeMs!++; v.charge! += current;
    o.phase = awake ? "Active work" : mode + ": waiting for wake"; sample(o, current, +awake);
  }),
  metrics: (s) => [metric("Wakes", s.values.wakes!), metric("Standby reboots", s.values.reboots!), metric("Average current", (s.values.charge! / Math.max(1, s.time)).toFixed(3), "mA"), metric("Charge", s.values.charge!.toFixed(2), "µC"), metric("Unavailable wakes", s.values.blockedWakes!)],
  checks: (s, p) => [check("Wake at least twice", s.values.wakes! >= 2, "Use RTC for Stop/Standby and enable the interrupt."), check("Reduce charge below half the always-running baseline", s.time >= 200 && s.values.charge! < s.time * 4, "Compare measured charge against 8 mA × elapsed ms."), check("Use Stop with a surviving wake clock", p.mode === "Stop" && p.wake === "RTC" && s.values.wakes! >= 2, "The APB timer stops with its clock domain.")],
  guide: ["Run Stop + RTC for three wake periods.", "Compare charge against Run mode.", "Select APB timer in Stop and inspect missed wakes.", "Select Standby and inspect reset counts."], expected: "RTC wakes the stopped system; an ordinary APB timer cannot. Standby wakes by rebooting.", equation: "Charge (µC) = Σ current (mA) × Δt (ms)", limitation: "Illustrative current and wake-latency profiles, not chip datasheet measurements. RTC has an independent retained clock.", presets: [{ label: "Stop + RTC", params: { mode: "Stop", wake: "RTC" } }, { label: "Clock-domain fault", params: { mode: "Stop", wake: "APB timer" } }, { label: "Always running", params: { mode: "Run", wake: "RTC" } }],
};

export const brownout: Model = {
  number: 43, subtitle: "Reset safely when supply voltage falls.", objective: "Observe filtered assertion, hysteretic release, and SRAM initialization.",
  defaults: { supply: 3.3, threshold: 2.7, hysteresis: 0.15, filter: 3, enabled: true, dip: 10 }, controls: [range("supply", "Supply voltage", 1.5, 3.6, 0.05, "V", true), range("threshold", "BOR threshold", 2, 3, 0.05, "V"), range("hysteresis", "Release hysteresis", 0.05, 0.3, 0.05, "V"), range("filter", "Low-voltage filter", 1, 10, 1, "ms"), range("dip", "Injected dip duration", 1, 30, 1, "ms"), toggle("enabled", "Brown-out detector enabled", true)], stepMs: 1,
  plots: [{ label: "VDD", min: 0, max: 3.6, unit: "V" }, { label: "Reset asserted", min: 0, max: 1 }],
  create: () => base({ lowMs: 0, held: 0, resets: 0, bootMs: 0, writes: 0, unsafeWrites: 0, dipLeft: 0, voltage: 3.3 }, new Array(8).fill(0)),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values, voltage = v.dipLeft! > 0 ? 1.8 : num(cfg, "supply"); v.voltage = voltage; if (v.dipLeft! > 0) v.dipLeft!--;
    v.lowMs = voltage < num(cfg, "threshold") ? v.lowMs! + 1 : 0;
    if (yes(cfg, "enabled") && !v.held && v.lowMs! >= num(cfg, "filter")) { v.held = 1; v.resets!++; v.bootMs = 0; o.memory.fill(0); event(o, "BOR asserted", "SRAM initialized; firmware held in reset"); }
    if (v.held && voltage >= num(cfg, "threshold") + num(cfg, "hysteresis")) { v.held = 0; v.bootMs = 5; event(o, "Reset released", "VDD above threshold + hysteresis; 5 ms boot delay"); }
    if (!v.held && v.bootMs === 0) { v.writes!++; o.memory[0] = v.writes! & 255; if (voltage < 2) { v.unsafeWrites!++; o.memory[1] = 0xde; } } else if (v.bootMs! > 0) v.bootMs!--;
    o.phase = v.held ? "Reset held" : v.bootMs ? "Boot delay" : voltage < 2 ? "Unsafe execution" : "Firmware executing"; sample(o, voltage, v.held!);
  }),
  actions: [{ id: "dip", label: "Inject 1.8 V dip" }], action: (s, p) => { const o = copy(s); o.values.dipLeft = num(p, "dip"); event(o, "Supply dip", `${num(p, "dip")} ms disturbance`); return o; },
  metrics: (s) => [metric("VDD", s.values.voltage!.toFixed(2), "V"), metric("BOR resets", s.values.resets!), metric("Reset held", s.values.held ? "Yes" : "No"), metric("Unsafe writes", s.values.unsafeWrites!), metric("SRAM[0]", hex(s.memory[0]!))],
  checks: (s) => [check("Detect a sustained dip", s.values.resets! > 0, "Inject a dip longer than the filter."), check("Release reset after recovery", s.values.resets! > 0 && s.values.held === 0 && s.values.bootMs === 0, "Restore supply above threshold + hysteresis, then wait for boot."), check("Limit undervoltage execution", s.values.resets! > 0 && s.values.unsafeWrites! <= 2, "The 3 ms detector filter permits two low-voltage execution slots before reset.")],
  guide: ["Inject a 10 ms dip with the 3 ms filter.", "Step through assertion, reset hold, and release.", "Hold supply between assertion and release voltages.", "Disable BOR and compare unsafe writes."], expected: "A sustained dip asserts reset once. Hysteresis prevents premature release.", equation: "Release VDD = threshold + hysteresis", limitation: "An illustrative supervisor, with a chosen 2 V execution floor and deterministic corruption marker; not a transistor-level model.", presets: [{ label: "Protected system", params: { enabled: true, filter: 3, supply: 3.3 } }, { label: "Missing supervisor", params: { enabled: false, supply: 3.3 } }],
};

export const rtc: Model = {
  number: 44, subtitle: "An independent oscillator keeps backup time.", objective: "Prescale a clock, latch an alarm, and quantify drift against an ideal reference.",
  defaults: { frequency: 32768, prescaler: 32767, ppm: 20, alarm: 5, main: true, battery: true }, controls: [range("frequency", "Oscillator", 32000, 33000, 1, "Hz"), range("prescaler", "Divider reload", 31999, 32999), range("ppm", "Oscillator drift", -200, 200, 5, "ppm"), range("alarm", "Alarm after", 1, 30, 1, "s"), toggle("main", "Main supply present", true), toggle("battery", "Backup battery present", true)], stepMs: 100,
  plots: [{ label: "Second phase", min: 0, max: 1 }, { label: "Alarm flag", min: 0, max: 1 }],
  create: () => base({ seconds: 43200, reference: 0, fraction: 0, alarm: 0, lost: 0, powerLost: 0, elapsedRtc: 0 }),
  step: (s, p, ms) => {
    const o = copy(s), v = o.values; o.time += ms; v.reference! += ms / 1000;
    if (!yes(p, "main") && !yes(p, "battery")) { if (!v.powerLost) { v.lost!++; v.seconds = 0; v.fraction = 0; v.elapsedRtc = 0; event(o, "Backup domain lost", "Clock stops and calendar resets"); } v.powerLost = 1; o.phase = "RTC unpowered"; return o; }
    v.powerLost = 0; const elapsed = ms / 1000 * num(p, "frequency") / (num(p, "prescaler") + 1) * (1 + num(p, "ppm") / 1e6);
    v.elapsedRtc! += elapsed; v.fraction! += elapsed; const whole = Math.floor(v.fraction!); v.seconds! += whole; v.fraction! -= whole;
    if (!v.alarm && v.elapsedRtc! >= num(p, "alarm")) { v.alarm = 1; event(o, "RTC alarm", `Matched after ${num(p, "alarm")} RTC seconds`); }
    o.phase = yes(p, "main") ? "Calendar running" : "Backup running; main CPU off"; sample(o, v.fraction!, v.alarm!); return o;
  },
  actions: [{ id: "minute", label: "Advance 60 seconds" }], action: (s, p) => rtc.step(s, p, 60000),
  metrics: (s) => [metric("Calendar", new Date(s.values.seconds! * 1000).toISOString().slice(11, 19)), metric("RTC elapsed", s.values.elapsedRtc!.toFixed(6), "s"), metric("Drift", ((s.values.elapsedRtc! - s.values.reference!) * 1000).toFixed(3), "ms"), metric("Alarm", s.values.alarm ? "Latched" : "Waiting"), metric("Backup losses", s.values.lost!)],
  checks: (s, p) => [check("Divide to one nominal second", Math.abs(num(p, "frequency") / (num(p, "prescaler") + 1) - 1) < 1e-8, "Use 32768 Hz and a reload of 32767."), check("Latch the alarm", s.values.alarm === 1, "Advance beyond the alarm delay."), check("Retain time without main supply", !yes(p, "main") && yes(p, "battery") && s.values.elapsedRtc! > 0, "Disconnect main power but retain the backup battery.")],
  guide: ["Advance until the 5 second alarm latches.", "Advance a minute and inspect drift.", "Disconnect main power and verify retention.", "Remove backup power and observe domain loss."], expected: "A divider of 32768 yields one nominal second from a 32768 Hz source. Backup power preserves RTC operation.", equation: "RTC rate = oscillator / (reload + 1) × (1 + ppm / 10⁶)", limitation: "Time-of-day counter rather than a Gregorian calendar; no temperature model or battery chemistry.", presets: [{ label: "Crystal clock", params: { frequency: 32768, prescaler: 32767, ppm: 20 } }, { label: "Wrong divider", params: { prescaler: 31999 } }],
};
