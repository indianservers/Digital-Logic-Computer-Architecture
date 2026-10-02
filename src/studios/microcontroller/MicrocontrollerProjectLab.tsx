import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PROJECT_LABS, projectBySlug, type Control, type ProjectDef, type ProjectId } from "./projectData";
import { advanceRuntime, compileProjectCode, createRuntime, updateInput, type Runtime, type Value } from "./projectEngine";
import { PhotorealScene } from "./PhotorealScene";
import { ProjectReadout } from "./ProjectReadout";
import { PROJECT_ENHANCEMENTS } from "./projectEnhancements";
import "./projectLab.css";

const storageKey = (slug: string) => `digital-electronics.mcu.project.${slug}`;
const show = (value: unknown) => typeof value === "boolean" ? value ? "ON" : "OFF" : String(value ?? "—");
const num = (value: unknown) => typeof value === "number" ? value : 0;
const codeKeys: Record<string, string[]> = {
  traffic: ["greenTime", "yellowTime"], street: ["threshold"], thermometer: ["alarm"], ultrasonic: ["alert"], irrigation: ["onThreshold", "offThreshold"], robot: ["kp", "ki", "kd"], motor: ["duty"], arm: ["base", "shoulder", "elbow", "wrist", "gripper"], weather: [], home: [], iot: ["sample", "transmit"], builder: [],
};
const metricKeys: Record<string, Array<[string, string, string]>> = {
  traffic: [["State", "state", ""], ["Remaining", "remaining", "s"], ["Next", "next", ""], ["Pedestrian", "pedestrianWalk", ""]],
  street: [["Ambient", "ldr", "ADC"], ["Lamp", "lamp", ""], ["Power", "power", "W"], ["Daypart", "daypart", ""]],
  thermometer: [["Temperature", "temperature", ""], ["Sensor voltage", "voltage", "V"], ["ADC", "adc", ""], ["Alarm", "alarm", ""]],
  ultrasonic: [["Distance", "distance", "cm"], ["Echo width", "echoUs", "µs"], ["Trigger", "triggerUs", "µs"], ["Buzzer", "buzzer", ""]],
  irrigation: [["Selected moisture", "moisture", "%"], ["Pump", "pump", ""], ["Flow", "flow", "L/min"], ["Water used", "water", "L"]],
  robot: [["Line error", "error", ""], ["Left PWM", "leftPWM", ""], ["Right PWM", "rightPWM", ""], ["Laps", "lap", ""]],
  motor: [["Actual RPM", "rpm", ""], ["Target RPM", "target", ""], ["PWM frequency", "frequency", "Hz"], ["Fault", "fault", ""]],
  arm: [["End X", "endX", "cm"], ["End Y", "endY", "cm"], ["Sequence", "sequence", "poses"], ["Holding object", "holding", ""]],
  weather: [["Temperature", "temperature", "°C"], ["Humidity", "humidity", "%"], ["Wind", "wind", "km/h"], ["Pressure", "pressure", "hPa"]],
  home: [["Power", "power", "W"], ["Active devices", "active", ""], ["Door locked", "lock", ""], ["Motion", "motion", ""]],
  iot: [["Battery", "battery", "V"], ["RSSI", "rssi", "dBm"], ["Packets sent", "packets", ""], ["Buffered", "buffered", ""]],
  builder: [["Green LED", "green", ""], ["Red LED", "red", ""], ["Relay", "relay", ""], ["Modules", "activeModules", ""]],
};
const chartKeys: Record<string, string> = { traffic: "remaining", street: "power", thermometer: "temperature", ultrasonic: "distance", irrigation: "moisture", robot: "error", motor: "rpm", arm: "endX", weather: "temperature", home: "power", iot: "battery", builder: "temperature" };
const firmwareApi: Record<ProjectId, string> = {
  traffic: "trafficCycle(greenSeconds, yellowSeconds); millis()",
  street: "analogRead(LDR); setLamp(on); readLight()",
  thermometer: "readTemperature(); displayTemperature(celsius)",
  ultrasonic: "readDistance(); measureDistance(triggerMicroseconds)",
  irrigation: "readMoisture(); controlIrrigation(onThreshold, offThreshold)",
  robot: "setMotorSpeed(leftPWM, rightPWM)",
  motor: "analogWrite(MOTOR_PIN, dutyPercent); millis()",
  arm: "servo_write(BASE | SHOULDER | ELBOW | WRIST | GRIPPER, angle)",
  weather: "sampleWeather(seconds); readTemperature(); readHumidity(); readLight()",
  home: "digitalRead(MOTION); analogRead(LDR); automateHome(darkThreshold, useMotion)",
  iot: "publishMQTT(sampleSeconds, transmitSeconds); readTemperature(); readMoisture()",
  builder: "digitalRead(BUTTON); readTemperature(); readDistance(); digitalWrite(pin, value); relayWrite(pin, value); Serial.println(value)",
};

function load(def: ProjectDef): { code: string; runtime: Runtime } {
  let code = def.code;
  let saved: { code?: string; inputs?: Record<string, Value>; memory?: Record<string, unknown>; modules?: string; pins?: string; ground?: boolean; supply?: boolean } | undefined;
  try { saved = JSON.parse(localStorage.getItem(storageKey(def.slug)) ?? "null") ?? undefined; } catch { /* use defaults */ }
  code = saved?.code ?? code;
  const result = compileProjectCode(code);
  const compiled = result.program ?? compileProjectCode(def.code).program!;
  let runtime = createRuntime(def, compiled);
  if (saved?.inputs) for (const [key, value] of Object.entries(saved.inputs)) runtime = updateInput(def, runtime, key, value);
  if ((def.id === "builder" || def.id === "arm") && saved) {
    runtime = { ...runtime, memory: { ...runtime.memory, ...(saved.memory ?? {}), modules: saved.modules ?? saved.memory?.modules ?? runtime.memory.modules, pins: saved.pins ?? saved.memory?.pins ?? runtime.memory.pins, ground: saved.ground ?? saved.memory?.ground ?? runtime.memory.ground, supply: saved.supply ?? saved.memory?.supply ?? runtime.memory.supply } };
    runtime = advanceRuntime(def, runtime, 0);
  }
  runtime.diagnostics = result.diagnostics;
  return { code, runtime };
}

function CodeEditor({ code, setCode, diagnostics, onRun, onResetCode, def, state }: { code: string; setCode: (code: string) => void; diagnostics: Runtime["diagnostics"]; onRun: () => void; onResetCode: () => void; def: ProjectDef; state: Runtime }) {
  const lines = code.split("\n");
  const highlight = useRef<HTMLPreElement>(null);
  const lineNumbers = useRef<HTMLDivElement>(null);
  const colored = code.split(/(#[^\n]*|\/\/[^\n]*|\b(?:void|true|false|int)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\())/g).map((part, index) => {
    const tone = part.startsWith("//") ? "comment" : part.startsWith("#") ? "directive" : /^\d/.test(part) ? "number" : /^(void|true|false|int)$/.test(part) ? "keyword" : /^[A-Za-z_]\w*$/.test(part) ? "function" : "plain";
    return <span className={`mcu-code-${tone}`} key={index}>{part}</span>;
  });
  return <section className="mcu-panel mcu-code-panel"><div className="mcu-panel-head"><h2>Code editor</h2><span>Educational C-like API</span></div>
    <div className="mcu-editor"><div className="mcu-line-numbers" ref={lineNumbers} aria-hidden="true">{lines.map((_, index) => <div key={index}>{index + 1}</div>)}</div><div className="mcu-editor-surface"><pre ref={highlight} aria-hidden="true">{colored}</pre><textarea spellCheck={false} aria-label={`${def.title} source code`} value={code} onScroll={(event) => { if (highlight.current) { highlight.current.scrollTop = event.currentTarget.scrollTop; highlight.current.scrollLeft = event.currentTarget.scrollLeft; } if (lineNumbers.current) lineNumbers.current.scrollTop = event.currentTarget.scrollTop; }} onChange={(event) => setCode(event.target.value)} /></div></div>
    <div className="mcu-code-actions"><button type="button" className="mcu-primary" onClick={onRun}>Compile & run</button><button type="button" onClick={onResetCode}>Reset code</button><span>Virtual firmware runs once per 100 ms simulation tick</span></div>
    <details className="mcu-code-help"><summary>Firmware syntax and available APIs</summary><p>Use optional setup(), required loop(), #define, numeric variables, if/else, arithmetic, comparisons, and millis(). Variables declared in setup() persist between ticks.</p><code>{firmwareApi[def.id]}</code></details>
    {diagnostics.length ? <div className="mcu-diagnostics" role="alert">{diagnostics.map((diagnostic, index) => <div key={index}>{diagnostic.line > 0 ? `Line ${diagnostic.line}` : "Runtime"}: {diagnostic.message}</div>)}</div> : <p className="mcu-compiled">✓ Code ready. Edit the firmware and run it against live simulated inputs.</p>}
    <div className="mcu-execution"><strong>Last executed loop · #{show(state.memory.firmwareTicks)}</strong><span>{(state.memory.firmwareTrace as string[] | undefined)?.join("  ·  ") || "No output commands executed"}</span><small>Variables: {Object.entries((state.memory.firmwareVars as Record<string, number> | undefined) ?? {}).map(([name, value]) => `${name}=${Number(value.toFixed(3))}`).join(", ") || "none"}</small></div>
  </section>;
}

function ControlField({ control, value, onChange }: { control: Control; value: Value | undefined; onChange: (value: Value) => void }) {
  if (control.kind === "toggle") return <label className="mcu-control mcu-toggle"><span>{control.label}</span><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /><span className="mcu-switch" aria-hidden="true" /></label>;
  if (control.kind === "select") return <label className="mcu-control"><span>{control.label}</span><select value={String(value)} onChange={(event) => onChange(event.target.value)}>{control.options?.map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <label className="mcu-control"><span>{control.label} <strong>{show(value)} {control.unit}</strong></span><input type="range" min={control.min} max={control.max} step={control.step ?? 1} value={num(value)} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Chart({ state, metric, title }: { state: Runtime; metric: string; title: string }) {
  const entries = state.history.filter((sample) => Number.isFinite(sample.values[metric]));
  const values = entries.map((sample) => sample.values[metric] ?? 0);
  const low = values.length ? Math.min(...values) : 0, high = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, high - low);
  const path = entries.map((sample, index) => `${index ? "L" : "M"} ${24 + index / Math.max(1, entries.length - 1) * 512} ${158 - ((sample.values[metric] ?? 0) - low) / span * 125}`).join(" ");
  return <section className="mcu-panel"><div className="mcu-panel-head"><h2>Live history</h2><span>{title}</span></div><svg className="mcu-chart" viewBox="0 0 560 190" role="img" aria-label={`${title} over simulation time`}>
    {[33, 64, 95, 126, 158].map((y) => <line key={y} x1="24" x2="538" y1={y} y2={y} stroke="#e3ebf4" />)}<path d={path} fill="none" stroke="#1769e0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {entries.length ? <circle cx={536} cy={158 - ((values.at(-1) ?? 0) - low) / span * 125} r="5" fill="#1769e0" /> : null}
    <text x="25" y="180" fontSize="12" fill="#6d7f96">{entries.length ? `${entries[0]?.time.toFixed(1)} s` : "Run to collect samples"}</text><text x="484" y="180" fontSize="12" fill="#6d7f96">{state.time.toFixed(1)} s</text>
  </svg><div className="mcu-chart-foot"><span>Min {values.length ? low.toFixed(1) : "—"}</span><span>Latest {values.length ? (values.at(-1) ?? 0).toFixed(1) : "—"}</span><span>Max {values.length ? high.toFixed(1) : "—"}</span></div></section>;
}

function Signal({ def, state }: { def: ProjectDef; state: Runtime }) {
  const duty = def.id === "motor" ? num(state.inputs.duty) / 100 : def.id === "arm" ? num(state.outputs.pulseMs) / 20 : .5;
  const width = Math.max(2, Math.min(58, duty * 60));
  const waveform = Array.from({ length: 8 }, (_, index) => { const x = 26 + index * 64; return `M${x} 105 V55 H${x + width} V105 H${x + 64}`; }).join(" ");
  const triggerWidth = Math.max(2, Math.min(50, num(state.outputs.triggerUs) / 10 * 8));
  const echoWidth = Math.max(2, Math.min(430, num(state.outputs.echoUs) / 12000 * 430));
  const trigger = `M26 68 V37 H${26 + triggerWidth} V68 H530`;
  const echo = `M26 116 H${38 + triggerWidth} V84 H${38 + triggerWidth + echoWidth} V116 H530`;
  return <section className="mcu-panel"><div className="mcu-panel-head"><h2>{def.id === "ultrasonic" ? "Trigger / echo" : def.id === "motor" ? "PWM waveform" : def.id === "arm" ? "Servo pulse" : "GPIO signals"}</h2><span>Live</span></div><svg className="mcu-signal" viewBox="0 0 560 150" role="img" aria-label="Signal waveform derived from runtime state"><rect x="0" y="0" width="560" height="150" rx="8" fill="#13243a" />{Array.from({ length: 10 }, (_, j) => <line key={j} x1={j * 56} x2={j * 56} y1="0" y2="150" stroke="#28415d" />)}{def.id === "ultrasonic" ? <><path d={trigger} fill="none" stroke="#4ade80" strokeWidth="3" /><path d={echo} fill="none" stroke="#60a5fa" strokeWidth="3" /><text x="25" y="135" fill="#cce3ed" fontSize="12">Trigger {show(state.outputs.triggerUs)} µs · Echo {show(state.outputs.echoUs)} µs</text></> : def.id === "traffic" ? <><path d={`M26 ${state.gpio.NS_GREEN ? 39 : 69} H530`} stroke="#4ade80" strokeWidth="3" /><path d={`M26 ${state.gpio.EW_GREEN ? 83 : 113} H530`} stroke="#60a5fa" strokeWidth="3" /><text x="25" y="135" fill="#cce3ed" fontSize="12">NS green {state.gpio.NS_GREEN ? "HIGH" : "LOW"} · EW green {state.gpio.EW_GREEN ? "HIGH" : "LOW"}</text></> : <><path d={waveform} fill="none" stroke="#4ade80" strokeWidth="3" /><text x="25" y="135" fill="#cce3ed" fontSize="12">{def.id === "motor" ? `${show(state.inputs.duty)}% duty · ${show(state.outputs.frequency)} Hz` : `${show(state.outputs.pulseMs)} ms pulse · 20 ms period`}</text></>}</svg></section>;
}

const builderModules = ["LED_GREEN", "LED_RED", "BUTTON", "RELAY", "BUZZER", "OLED", "TEMP_SENSOR", "DISTANCE_SENSOR", "LIGHT_SENSOR", "POTENTIOMETER", "SERVO", "DC_MOTOR", "LCD"];
const pinChoices = ["PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PB0", "PB1", "PB6", "PB7", "PC13", "GPIO2", "GPIO4", "GPIO21", "GPIO22", "GPIO25", "GPIO26"];

function BuilderPanel({ state, changeMemory }: { state: Runtime; changeMemory: (patch: Record<string, string | boolean>) => void }) {
  const modules = JSON.parse(String(state.memory.modules)) as string[];
  const pins = JSON.parse(String(state.memory.pins)) as Record<string, string>;
  return <section className="mcu-panel mcu-builder-panel"><div className="mcu-panel-head"><h2>Project components & wiring</h2><span>{modules.length} selected</span></div>
    <div className="mcu-builder-modules">{builderModules.map((module) => <label key={module}><input type="checkbox" checked={modules.includes(module)} onChange={(event) => changeMemory({ modules: JSON.stringify(event.target.checked ? [...modules, module] : modules.filter((item) => item !== module)) })} />{module.replaceAll("_", " ")}</label>)}</div>
    <div className="mcu-wiring-flags"><label><input type="checkbox" checked={state.memory.supply === true} onChange={(event) => changeMemory({ supply: event.target.checked })} /> 5V / 3V3 connected</label><label><input type="checkbox" checked={state.memory.ground === true} onChange={(event) => changeMemory({ ground: event.target.checked })} /> Ground connected</label></div>
    <div className="mcu-pin-assignments">{modules.map((module) => <label key={module}><span>{module.replaceAll("_", " ")}</span><select value={pins[module] ?? ""} onChange={(event) => changeMemory({ pins: JSON.stringify({ ...pins, [module]: event.target.value }) })}><option value="">Unwired</option>{pinChoices.map((pin) => <option key={pin}>{pin}</option>)}</select></label>)}</div>
    {state.outputs.warning ? <p className="mcu-warning" role="alert">{show(state.outputs.warning)}</p> : <p className="mcu-compiled">✓ Wiring valid. Try assigning two modules to the same pin.</p>}
  </section>;
}

function Hardware({ def, state }: { def: ProjectDef; state: Runtime }) {
  const builderPins = def.id === "builder" ? JSON.parse(String(state.memory.pins)) as Record<string, string> : {};
  const builderModules = def.id === "builder" ? JSON.parse(String(state.memory.modules)) as string[] : [];
  const rows: Array<[string, string]> = def.id === "builder" ? builderModules.map((module) => [builderPins[module] ?? "—", module.replaceAll("_", " ")]) : def.pins;
  const values = def.id === "traffic" ? [state.gpio.NS_RED, state.gpio.NS_YELLOW, state.gpio.NS_GREEN, state.gpio.EW_RED, state.gpio.EW_YELLOW, state.gpio.EW_GREEN] :
    def.id === "irrigation" ? show(state.outputs.zones).split(",").map((value) => `${Math.round(Number(value))}%`).concat(show(state.outputs.pump)) :
    def.id === "robot" ? show(state.outputs.sensors).split(" ").map((value) => value === "1").concat(Boolean(state.gpio.PB0), Boolean(state.gpio.PB1)) :
    def.id === "street" ? [state.outputs.ldr, state.gpio.PB5, "3.3V", "GND"] :
    def.id === "thermometer" ? [state.outputs.adc, true, true, state.outputs.alarm] :
    def.id === "weather" ? [state.outputs.temperature, state.outputs.pressure, state.outputs.wind, state.outputs.rain] :
    def.id === "iot" ? [state.outputs.temperature, state.outputs.moisture, state.outputs.light, state.outputs.battery] :
    def.id === "arm" ? [state.outputs.base, state.outputs.shoulder, state.outputs.elbow, state.outputs.wrist, state.outputs.gripper] :
    def.id === "builder" ? rows.map(([pin]) => state.gpio[pin]) :
    rows.map(([pin]) => state.gpio[pin]);
  return <section className="mcu-panel mcu-hardware-panel"><div className="mcu-panel-head"><h2>Hardware & GPIO mapping</h2><span>MCU → peripherals</span></div><div className="mcu-hardware"><div className={`mcu-board ${def.id === "iot" || def.id === "builder" && String(state.inputs.board).includes("ESP32") ? "esp32" : ""}`}><div className="mcu-board-chip">{def.id === "iot" ? "ESP32" : def.id === "builder" ? show(state.inputs.board) : "STM32"}<small>Microcontroller</small></div></div><div className="mcu-hardware-wires">{rows.map(([pin, component], index) => { const value = values[index]; const text = typeof value === "boolean" ? value ? "HIGH" : "LOW" : show(value); return <div key={`${pin}-${component}`}><span className={value === true || typeof value === "number" && value > 0 ? "on" : ""} /><b>{pin}</b><em>{component}</em><strong>{text}</strong></div>; })}</div></div></section>;
}

function Enhancements({ def, state, change }: { def: ProjectDef; state: Runtime; change: (key: string, value: Value) => void }) {
  const features = PROJECT_ENHANCEMENTS[def.id];
  return <section className="mcu-panel mcu-enhancements"><div className="mcu-panel-head"><h2>Advanced experiments</h2><span>10 working enhancements</span></div>
    <p>Adjust a condition, run or step the firmware, and inspect the measurements.</p>
    <div className="mcu-enhancement-controls">{features.filter((feature) => feature.control).map((feature) => <div className="mcu-enhancement-item" key={feature.key}><ControlField control={feature.control!} value={state.inputs[feature.key]} onChange={(value) => change(feature.key, value)} /><small>{feature.description}</small></div>)}</div>
    <div className="mcu-enhancement-metrics">{features.filter((feature) => !feature.control).map((feature) => <div key={feature.key} title={feature.description}><span>{feature.title}</span><strong>{show(state.outputs[feature.key])} {feature.unit}</strong><small>{feature.description}</small></div>)}</div>
  </section>;
}

function LabActions({ def, state, change, changeMemory }: { def: ProjectDef; state: Runtime; change: (key: string, value: Value) => void; changeMemory: (patch: Record<string, string | boolean | number>) => void }) {
  if (def.id === "traffic") return <div className="mcu-extra-actions"><button type="button" onClick={() => { const order = ["NS_GREEN", "NS_YELLOW", "ALL_RED_NS", "EW_GREEN", "EW_YELLOW", "ALL_RED_EW"]; const next = order[(order.indexOf(String(state.memory.trafficState)) + 1) % order.length] ?? "NS_GREEN"; changeMemory({ trafficState: next }); }} disabled={state.inputs.mode !== "Manual"}>Next manual state</button></div>;
  if (def.id === "arm") return <div className="mcu-extra-actions"><h3>Preset positions</h3>{(["Home", "Pick", "Place", "Wave"] as const).map((preset) => <button key={preset} type="button" onClick={() => { const poses: Record<string, number[]> = { Home: [90, 45, 60, 20, 80], Pick: [45, 115, 95, 30, 15], Place: [135, 80, 55, 40, 80], Wave: [90, 35, 130, 80, 80] }; ["base", "shoulder", "elbow", "wrist", "gripper"].forEach((key, j) => change(key, poses[preset]?.[j] ?? 90)); }}>{preset}</button>)}<button type="button" onClick={() => { const poses = JSON.parse(String(state.memory.recordedPoses)) as number[][]; changeMemory({ recordedPoses: JSON.stringify([...poses, ["base", "shoulder", "elbow", "wrist", "gripper"].map((key) => num(state.inputs[key]))]), placed: false }); }}>Record pose</button><button type="button" disabled={state.memory.recordedPoses === "[]"} onClick={() => changeMemory({ playing: true, playIndex: 0, playElapsed: 0, placed: false, holding: false })}>Play sequence</button><button type="button" disabled={state.memory.recordedPoses === "[]"} onClick={() => changeMemory({ recordedPoses: "[]", playing: false, playIndex: 0, playElapsed: 0 })}>Clear</button></div>;
  if (def.id === "iot") return <div className="mcu-extra-actions"><button type="button" onClick={() => changeMemory({ forceTransmit: true })}>Send now</button><span>{state.outputs.connected ? "Connected to simulated broker" : "Offline — packets buffered"}</span></div>;
  return null;
}

function ProjectLab({ def }: { def: ProjectDef }) {
  const saved = useRef<{ code: string; runtime: Runtime } | null>(null);
  if (!saved.current) saved.current = load(def);
  const [code, setCode] = useState(saved.current.code);
  const [state, setState] = useState(saved.current.runtime);
  const [notice, setNotice] = useState("");
  useEffect(() => { const id = window.setInterval(() => setState((previous) => previous.running ? advanceRuntime(def, previous, .1) : previous), 100); return () => window.clearInterval(id); }, [def]);
  const change = (key: string, value: Value) => setState((previous) => updateInput(def, previous, key, value));
  const changeMemory = (patch: Record<string, string | boolean | number>) => setState((previous) => advanceRuntime(def, { ...previous, running: patch.playing === true ? true : previous.running, memory: { ...previous.memory, ...patch } }, 0));
  const run = () => {
    const result = compileProjectCode(code);
    if (!result.program) { setState((previous) => ({ ...previous, diagnostics: result.diagnostics })); setNotice("Fix the code error and rerun. The last valid simulation is preserved."); return; }
    const fresh = createRuntime(def, result.program);
    if (fresh.diagnostics.length) { setState((previous) => ({ ...previous, diagnostics: fresh.diagnostics })); setNotice("Firmware stopped on a runtime error. Fix the code and rerun."); return; }
    const preserved = { ...state.inputs };
    for (const key of codeKeys[def.id] ?? []) delete preserved[key];
    const retainedMemory = def.id === "builder" ? { modules: state.memory.modules, pins: state.memory.pins, ground: state.memory.ground, supply: state.memory.supply } : def.id === "arm" ? { recordedPoses: state.memory.recordedPoses } : {};
    const next = advanceRuntime(def, { ...fresh, inputs: { ...fresh.inputs, ...preserved }, memory: { ...fresh.memory, ...retainedMemory }, running: true }, 0);
    if (next.diagnostics.length) { setState((previous) => ({ ...previous, diagnostics: next.diagnostics })); setNotice("Firmware stopped on a runtime error. Fix the code and rerun."); return; }
    setState(next); setNotice("Code compiled. Simulation restarted with the new program.");
  };
  const reset = () => { setState(createRuntime(def, state.program)); setNotice("Simulation reset. Your code is unchanged."); };
  const save = () => { localStorage.setItem(storageKey(def.slug), JSON.stringify({ code, inputs: state.inputs, memory: def.id === "builder" || def.id === "arm" ? state.memory : undefined })); setNotice("Project saved in this browser."); };
  const resetCode = () => { setCode(def.code); setState((previous) => ({ ...previous, diagnostics: [] })); setNotice("Sample code restored. Select Compile & run to apply it."); };
  const chartKey = chartKeys[def.id] ?? "temperature";
  return <div className={`mcu-project-shell mcu-lab-${def.id}`}><aside className="mcu-project-nav"><Link className="mcu-project-brand" to="/studios/microcontroller">▣ <span>Microcontroller Studio</span></Link><Link to="/studios/microcontroller">← Studio map</Link><h2>Project Labs 61–72</h2>{PROJECT_LABS.map((lab) => <Link key={lab.id} className={def.id === lab.id ? "active" : ""} to={`/studios/microcontroller/project/${lab.slug}`}><span>{lab.number}</span>{lab.title}</Link>)}</aside>
    <div className="mcu-project-content"><header className="mcu-project-head"><div><nav aria-label="Breadcrumb"><Link to="/studios/microcontroller">Microcontroller Studio</Link> › Project Labs › {def.number}. {def.title}</nav><h1>{def.number}. {def.title}</h1><p>{def.objective}</p></div><div className="mcu-main-actions"><button type="button" className="mcu-primary" onClick={run}>▶ Run code</button><button type="button" onClick={() => setState((previous) => ({ ...previous, running: !previous.running }))}>{state.running ? "Ⅱ Pause" : "▶ Resume"}</button><button type="button" onClick={() => setState((previous) => { let next = previous; for (let tick = 0; tick < 5; tick++) { next = advanceRuntime(def, next, .1); if (def.id === "builder" && next.inputs.debugBreak) break; } return next; })}>Step</button><button type="button" onClick={reset}>↺ Reset</button><button type="button" onClick={save}>▣ Save</button></div></header>
      {notice ? <div className="mcu-notice" role="status">{notice}</div> : null}
      <div className="mcu-project-grid"><section className="mcu-panel mcu-simulation"><div className="mcu-panel-head"><h2>{def.id === "builder" ? "Project builder" : "Simulation"}</h2><span className={state.running ? "mcu-live" : ""}>{state.running ? "● Real-time" : "● Paused"}</span></div><PhotorealScene id={def.id} state={state} /><div className="mcu-scene-footer"><span>Simulation time {state.time.toFixed(1)} s</span><span>{show(state.outputs.warning || (state.outputs.fault ? "Fault" : state.outputs.lost ? "Line lost" : "System ready"))}</span></div></section>
        {def.id === "builder" ? <BuilderPanel state={state} changeMemory={changeMemory} /> : null}
        <section className="mcu-panel mcu-status"><div className="mcu-panel-head"><h2>{def.id === "motor" ? "Motor dashboard" : def.id === "weather" || def.id === "iot" ? "Live sensor readings" : def.id === "traffic" ? "State machine" : def.id === "thermometer" ? "Temperature display" : def.id === "irrigation" ? "Soil moisture & zones" : def.id === "robot" ? "Sensor states & motors" : "Live status"}</h2><span>{state.running ? "Updating" : "Ready"}</span></div><ProjectReadout id={def.id} state={state} /></section>
        <section className="mcu-panel mcu-controls"><div className="mcu-panel-head"><h2>Experiment controls</h2><span>Change inputs</span></div>{def.controls.map((control) => <ControlField key={control.key} control={control} value={state.inputs[control.key]} onChange={(value) => change(control.key, value)} />)}<LabActions def={def} state={state} change={change} changeMemory={changeMemory} /></section>
        <CodeEditor code={code} setCode={setCode} diagnostics={state.diagnostics} onRun={run} onResetCode={resetCode} def={def} state={state} />
        <Hardware def={def} state={state} />
        <div className="mcu-inspect-stack"><Chart state={state} metric={chartKey} title={(metricKeys[def.id] ?? []).find(([, key]) => key === chartKey)?.[0] ?? chartKey} />{["traffic", "ultrasonic", "motor", "arm"].includes(def.id) ? <Signal def={def} state={state} /> : null}<section className="mcu-panel"><div className="mcu-panel-head"><h2>{def.id === "builder" ? "Serial monitor" : "Event log"}</h2><span>{state.logs.length} events</span></div><div className="mcu-log">{state.logs.length ? state.logs.map((entry, index) => <div key={`${index}-${entry}`}>{entry}</div>) : <div>Run the simulation to record events.</div>}</div></section></div>
        <Enhancements def={def} state={state} change={change} />
        <section className="mcu-panel mcu-notes"><div className="mcu-panel-head"><h2>Learning notes</h2></div>{def.notes.map((note) => <p key={note}><span>✓</span>{note}</p>)}</section>
      </div>
    </div></div>;
}

export function MicrocontrollerProjectLab() {
  const { slug = "" } = useParams();
  const def = projectBySlug(slug);
  if (!def) return <div className="mcu-missing"><h1>Project lab not found</h1><Link to="/studios/microcontroller">Return to Microcontroller Studio</Link></div>;
  return <ProjectLab key={def.slug} def={def} />;
}
