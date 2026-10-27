import { createServer } from "vite";
import { writeFile } from "node:fs/promises";

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { MODELS } = await server.ssrLoadModule("/src/studios/microcontroller/labs/advanced/models.ts");
  const { FAMILY_PROFILES, familyOptions, driveFamilyInputs } = await server.ssrLoadModule("/src/studios/microcontroller/labs/advanced/familyProfiles.ts");
  const { Mcu } = await server.ssrLoadModule("/src/studios/microcontroller/labs/core/mcu.ts");
  const { CORE_LAB_ROADMAP, labPath } = await server.ssrLoadModule("/src/studios/microcontroller/labs/registry.ts");
  const flows = {
    39: ["Physical pulse", "Polling sample", "Pending edge / ISR", "Count and latency"],
    40: ["Peripheral request", "DMA channel", "NDTR and destination", "SRAM buffer"],
    41: ["Firmware progress", "Refresh request", "Independent countdown", "System reset"],
    42: ["Wake clock", "Clock-domain gates", "Sleep / resume / reboot", "Integrated charge"],
    43: ["Supply voltage", "Low-voltage filter", "Reset latch", "Hysteretic release"],
    44: ["Backup oscillator", "Prescaler", "Calendar seconds", "Alarm comparison"],
    45: ["External demand", "Firmware state", "Output interlock", "GPIO signals"],
    46: ["Periodic release", "Cooperative selection", "Run to completion", "Deadline check"],
    47: ["Tick / task release", "Ready queue", "Preemption or time slice", "Response and deadline"],
    48: ["Shared read", "Resource acquisition", "Modify and write", "Release resource"],
    49: ["High task blocks", "Priority donation", "Lock owner executes", "Unlock and resume"],
    50: ["Incoming image", "Inactive flash bank", "CRC and vectors", "Atomic boot commit"],
    51: ["C compilation", "PC / instruction fetch", "Register operations", "Stack and return"],
    52: ["Digital UART source", "Sample clock", "Triggered buffer", "8N1 decoder"],
    53: ["Analog source", "RC response", "ADC and trigger", "Sample measurements"],
    54: ["Timed workload", "Shunt and amplifier", "ADC conversion", "Charge and energy"],
    55: ["Arduino firmware", "ADC / GPIO input", "Timer PWM", "Output pin"],
    56: ["Oscillator / 12", "Timer 0 reload", "Interrupt enable / ISR", "P1.0 latch"],
    57: ["RB0 edge", "INTF pending flag", "ISR and flag clear", "LATC output"],
    58: ["Clock / prescaler", "OCR1A comparison", "Timer ISR", "PORTB output"],
    59: ["TIM2 clock", "PSC / ARR divider", "HAL callback", "PA5 GPIO"],
    60: ["GPIO36 ADC", "Firmware loop", "LEDC duty register", "GPIO18 PWM"],
  };
  const duration = { 39: 100, 40: 10, 41: 350, 42: 300, 43: 20, 44: 60000, 45: 4000, 46: 100, 47: 100, 48: 40, 49: 40, 50: 8, 51: 1000, 52: 20, 53: 20, 54: 100 };
  const text = (metrics) => metrics.slice(0, 6).map((m) => m.label + " = " + m.value + (m.unit ? " " + m.unit : "")).join("; ");
  const results = [];
  for (const model of MODELS) {
    const meta = CORE_LAB_ROADMAP.find((lab) => lab.n === model.number);
    const baseline = { ...model.defaults, ...(model.number === 51 ? { breakEnabled: false } : {}) };
    const changed = { ...baseline, ...model.presets.at(-1).params };
    const evaluate = (p) => {
      let s = model.create(p);
      if ([43, 45, 50].includes(model.number)) s = model.action(s, p, model.number === 43 ? "dip" : model.number === 45 ? "pedestrian" : "start");
      s = model.step(s, p, duration[model.number]);
      return { timeMs: s.time, metrics: model.metrics(s, p), phase: s.phase };
    };
    const before = evaluate(baseline), after = evaluate(changed);
    const configuration = Object.entries(baseline).map(([key, value]) => key + "=" + value).join(", ");
    results.push({
      number: model.number, route: labPath(meta), objective: model.objective, guide: model.guide, expected: model.expected, equation: model.equation, limitation: model.limitation, flow: flows[model.number],
      before, after, configuration, baseline, comparison: changed, budgetMs: duration[model.number],
      example: [
        "Reset with " + configuration + ". " + ([43, 45, 50].includes(model.number) ? "Use the lab action to inject the dip, request a crossing, or begin the update before advancing." : model.number === 51 ? "Disable breakpoints for this run to reach program completion." : "Start with the stated configuration and no additional action."),
        "Advance up to " + duration[model.number] + " ms of model time; acquisition or program completion can stop earlier. The baseline reports " + text(before.metrics) + ".",
        "Compare with preset “" + model.presets.at(-1).label + "”: " + Object.entries(changed).map(([key, value]) => key + "=" + value).join(", ") + ".",
        "The same evaluation budget gives " + text(after.metrics) + ". Explain the changed state using this mechanism: " + model.expected,
      ],
      questions: [{ question: "What results should the baseline " + meta.title + " experiment produce?", answer: text(before.metrics) + ". " + model.expected }, { question: "What changes in the comparison experiment?", answer: text(after.metrics) + ". The model assumes: " + model.limitation }],
    });
  }
  for (const profile of FAMILY_PROFILES) {
    const meta = CORE_LAB_ROADMAP.find((lab) => lab.n === profile.number);
    const mcu = new Mcu(familyOptions(profile)); const diagnostics = mcu.load(profile.code);
    if (diagnostics.length) throw new Error(profile.chip + ": " + JSON.stringify(diagnostics));
    driveFamilyInputs(mcu, profile, profile.voltage / 2, false, false); mcu.tick(profile.analog ? 0.03 : 1);
    const result = profile.analog ? "ADC raw = " + mcu.fw.num("raw") + "; PWM duty = " + ((mcu.pwmInfo(profile.pwm)?.duty ?? 0) * 100).toFixed(2) + "%" : "interrupt count = " + mcu.fw.num(profile.number === 57 ? "hits" : "ticks");
    results.push({
      number: profile.number, route: labPath(meta), objective: profile.subtitle, guide: ["Advance the default firmware and inspect register configuration.", profile.observe, "Edit the firmware and Run to rebuild; compare the changed output.", "Hold reset and confirm execution stops."], expected: profile.observe, equation: profile.analog ? "ADC code = round(Vinput / Vref × (2^resolution − 1))" : "Timer rate and interrupt behavior follow the configured family registers.", limitation: profile.limitation, flow: flows[profile.number],
      configuration: "Default firmware; clock " + profile.clock / 1e6 + " MHz; input " + profile.voltage / 2 + " V",
      example: ["Build the default editable firmware for " + profile.chip + ".", "Set analog input to half reference where available; leave external input released.", "Advance " + (profile.analog ? "30 ms" : "one second") + ": " + result + ".", "Change an input or timer reload in firmware, rebuild, and compare the pin traces. " + profile.observe],
      questions: [{ question: "What does the default " + profile.chip + " firmware demonstrate?", answer: profile.observe + " The reference run reports " + result + "." }, { question: "What are the boundaries of this family simulation?", answer: profile.limitation }],
    });
  }
  await writeFile("src/data/microcontrollerLearning.json", JSON.stringify(results, null, 2) + "\n");
  console.log("Generated simulator-derived lessons for " + results.length + " Microcontroller labs.");
} finally { await server.close(); }
