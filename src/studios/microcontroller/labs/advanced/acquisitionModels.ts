import { base, check, copy, event, hex, metric, milliseconds, num, range, sample, select, toggle, yes, type Model } from "./model";

export const polling: Model = {
  number: 39, subtitle: "One input signal. Two acquisition strategies.", objective: "Measure missed pulses, interrupt latency, and CPU work on the same event stream.",
  defaults: { period: 20, pulse: 2, poll: 10, masked: false }, controls: [range("period", "Event period", 10, 100, 1, "ms"), range("pulse", "Pulse width", 1, 8, 1, "ms"), range("poll", "Polling interval", 1, 20, 1, "ms"), toggle("masked", "Mask interrupts", true)], stepMs: 1,
  plots: [{ label: "Input", min: 0, max: 1 }, { label: "Poll service", min: 0, max: 1 }, { label: "ISR service", min: 0, max: 1 }],
  create: () => base({ generated: 0, polled: 0, interrupts: 0, pending: 0, pollSeen: 0, missed: 0, pollWork: 0, irqWork: 0, latency: 0, coalesced: 0 }),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values, period = num(cfg, "period"), phase = (o.time - 3 + period) % period + 3, high = o.time >= 3 && phase < 3 + num(cfg, "pulse");
    if (phase === 3) { v.generated!++; v.pollSeen = 0; if (v.pending) v.coalesced!++; else { v.pending = 1; v.raised = o.time; } event(o, "Input rising", `Event ${v.generated}`); }
    let polled = 0, irq = 0;
    if (o.time % num(cfg, "poll") === 0) { v.pollWork! += 0.05; if (high && !v.pollSeen) { v.polled!++; v.pollSeen = 1; polled = 1; event(o, "Polling service", `Latency ${phase - 3} ms`); } }
    if (phase === 3 + num(cfg, "pulse") && !v.pollSeen) v.missed!++;
    if (v.pending && !yes(cfg, "masked")) { v.pending = 0; v.interrupts!++; v.irqWork! += 0.2; v.latency = Math.max(v.latency!, o.time - v.raised!); irq = 1; event(o, "ISR entry", `Serviced edge at ${o.time} ms`); }
    o.phase = high ? "Input pulse active" : "Waiting for input"; sample(o, +high, polled, irq);
  }),
  metrics: (s) => [metric("Generated", s.values.generated!), metric("Polling handled", s.values.polled!), metric("ISR handled", s.values.interrupts!), metric("Polling missed", s.values.missed!), metric("Max ISR latency", s.values.latency!, "ms"), metric("Polling / ISR work", `${s.values.pollWork!.toFixed(2)} / ${s.values.irqWork!.toFixed(2)}`, "ms")],
  checks: (s) => [check("Observe five events", s.values.generated! >= 5, "Run for 100 ms."), check("Capture every pulse by polling", s.values.generated! >= 5 && s.values.polled === s.values.generated, "Use a 1 ms polling interval for 2 ms pulses."), check("Service every interrupt", s.values.interrupts === s.values.generated && s.values.generated! > 0, "Masked repeated edges coalesce into one pending bit.")],
  guide: ["Run 100 steps with the default slow poll.", "Compare generated, polled, and ISR counts.", "Reset with polling at 1 ms and repeat.", "Mask interrupts, advance several periods, then unmask."], expected: "Short pulses between polls are missed. An unmasked edge interrupt services each edge; masked edges may coalesce.", equation: "Polling work = polls × 0.05 ms; ISR work = serviced IRQs × 0.2 ms", limitation: "Deterministic single-source acquisition with illustrative service costs. NVIC nesting is covered by earlier labs.", presets: [{ label: "Miss short pulses", params: { poll: 10 } }, { label: "Capture every pulse", params: { poll: 1 } }],
};

export const dma: Model = {
  number: 40, subtitle: "Peripheral samples travel directly into SRAM.", objective: "Observe DMA requests, destination addressing, half/full flags, and circular operation.",
  defaults: { length: "8", increment: true, circular: false, enabled: true, irq: true, mode: "DMA" }, controls: [select("length", "Buffer length", ["8", "16"]), toggle("increment", "Increment destination"), toggle("circular", "Circular mode"), toggle("enabled", "Channel enabled", true), toggle("irq", "Completion interrupt", true), select("mode", "Transfer engine", ["DMA", "CPU copy"])], stepMs: 1,
  plots: [{ label: "Request", min: 0, max: 1 }, { label: "NDTR", min: 0, max: 16 }],
  create: (p) => base({ NDTR: num(p, "length"), writeIndex: 0, transferred: 0, half: 0, complete: 0, interrupts: 0, cpuFree: 0, cpuCopy: 0 }, new Array(num(p, "length")).fill(0)),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values, length = num(cfg, "length");
    if (!yes(cfg, "enabled")) { o.phase = "Channel disabled: requests not serviced"; sample(o, 1, v.NDTR!); return; }
    if (v.NDTR === 0) { if (!yes(cfg, "circular")) { o.phase = "Transfer complete"; o.finished = true; return; } v.NDTR = length; v.writeIndex = 0; event(o, "Circular reload", `NDTR ← ${length}`); }
    const value = (v.transferred! * 37 + 11) & 255, address = yes(cfg, "increment") ? v.writeIndex! : 0;
    o.memory[address] = value; v.writeIndex!++; v.transferred!++; v.NDTR!--;
    if (cfg.mode === "DMA") v.cpuFree!++; else v.cpuCopy!++;
    if (v.NDTR === length / 2) { v.half = 1; event(o, "Half transfer", `First ${length / 2} samples transferred`); }
    if (v.NDTR === 0) { v.complete!++; if (yes(cfg, "irq")) v.interrupts!++; event(o, "Transfer complete", `${length} bytes; IRQ ${yes(cfg, "irq") ? "pending" : "disabled"}`); }
    o.phase = `SRAM[${address}] ← ${hex(value)}`; event(o, "Peripheral → memory", `${o.phase}; NDTR=${v.NDTR}`); sample(o, 1, v.NDTR!);
  }),
  metrics: (s) => [metric("Remaining NDTR", s.values.NDTR!), metric("Transferred", s.values.transferred!), metric("Half / full flags", `${s.values.half} / ${s.values.complete}`), metric("Completion IRQs", s.values.interrupts!), metric("CPU free / copy slots", `${s.values.cpuFree} / ${s.values.cpuCopy}`)],
  checks: (s, p) => [check("Complete a buffer", s.values.complete! > 0, "Enable the channel and run the buffer length in milliseconds."), check("Preserve each destination sample", yes(p, "increment") && !yes(p, "circular") && s.memory.every((v, i) => v === ((i * 37 + 11) & 255)), "Without increment each transfer overwrites SRAM[0]."), check("Keep CPU slots free", s.values.cpuFree! >= num(p, "length"), "Select DMA instead of CPU copy.")],
  guide: ["Step requests while NDTR counts down.", "Inspect SRAM at half and full completion.", "Disable destination increment and compare.", "Enable circular mode and watch NDTR reload."], expected: "One byte is transferred per request. Destination increment preserves the sequence; circular mode reloads NDTR.", equation: "NDTR = configured count − serviced requests", limitation: "One request per millisecond. Cache maintenance and bus contention are outside this reduced model.", presets: [{ label: "Normal DMA", params: { increment: true, circular: false, mode: "DMA" } }, { label: "Overwrite fault", params: { increment: false } }, { label: "Circular", params: { increment: true, circular: true } }],
};

export const watchdog: Model = {
  number: 41, subtitle: "A clock that keeps counting when firmware hangs.", objective: "Cause a watchdog reset and repair an insufficient refresh budget.",
  defaults: { timeout: 100, refresh: 40, hang: 250, feeding: true }, controls: [range("timeout", "Watchdog timeout", 20, 500, 10, "ms"), range("refresh", "Refresh interval", 10, 200, 10, "ms"), range("hang", "Firmware hangs after", 50, 1000, 10, "ms"), toggle("feeding", "Firmware refresh enabled", true)], stepMs: 5,
  plots: [{ label: "Counter remaining", min: 0, max: 500, unit: "ms" }, { label: "Firmware alive", min: 0, max: 1 }],
  create: (p) => base({ remaining: num(p, "timeout"), uptime: 0, resets: 0, feeds: 0, refreshAt: num(p, "refresh"), lastReset: -1 }),
  step: (s, p, ms) => milliseconds(s, p, ms, (o, cfg) => {
    const v = o.values; v.uptime!++; v.remaining!--;
    if (v.remaining! <= 0) { v.resets!++; v.lastReset = o.time + 1; v.uptime = 0; v.remaining = num(cfg, "timeout"); v.refreshAt = num(cfg, "refresh"); event(o, "IWDG RESET", "Firmware restarts; total simulation time continues"); }
    else if (v.uptime! < num(cfg, "hang") && yes(cfg, "feeding") && v.uptime! >= v.refreshAt!) { v.remaining = num(cfg, "timeout"); v.refreshAt! += num(cfg, "refresh"); v.feeds!++; event(o, "Refresh", `Counter ← ${v.remaining} ms`); }
    o.phase = v.uptime! >= num(cfg, "hang") ? "Firmware hung; watchdog counting" : "Firmware executing"; sample(o, v.remaining!, +(v.uptime! < num(cfg, "hang")));
  }),
  actions: [{ id: "feed", label: "Manual refresh" }], action: (s, p) => { const o = copy(s); o.values.remaining = num(p, "timeout"); o.values.feeds!++; event(o, "Manual refresh", "Watchdog counter reloaded"); return o; },
  metrics: (s) => [metric("Remaining", s.values.remaining!, "ms"), metric("Uptime", s.values.uptime!, "ms"), metric("Resets", s.values.resets!), metric("Refreshes", s.values.feeds!), metric("Last reset", s.values.lastReset! < 0 ? "None" : s.values.lastReset!, "ms")],
  checks: (s) => [check("Observe healthy refreshes", s.values.feeds! > 0, "Refresh before the timeout."), check("Recover from a hang", s.values.resets! > 0, "Run beyond hang time plus timeout."), check("Restart firmware uptime", s.values.resets! > 0 && s.values.uptime! < s.time, "Uptime resets while total time continues.")],
  guide: ["Run with timeout 100 ms and refresh 40 ms.", "Watch refreshes stop at 250 ms uptime.", "Continue until IWDG RESET appears.", "Set refresh longer than timeout to create a reset loop."], expected: "The watchdog resets firmware after refreshes stop. Refresh at expiry is too late in this model.", equation: "Healthy refresh interval < watchdog timeout", limitation: "Configured millisecond timing; oscillator tolerance and window-watchdog early-refresh rules are not included.", presets: [{ label: "Hang recovery", params: { timeout: 100, refresh: 40, hang: 250, feeding: true } }, { label: "Reset loop", params: { timeout: 50, refresh: 100, feeding: true } }],
};
