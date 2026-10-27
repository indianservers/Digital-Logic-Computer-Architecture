import { useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Metric, Panel, Slider, Toggle } from "../ui/Panels";
import { Scope, measureEdges } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import { driveFamilyInputs, familyOptions, familyProfile, familyRead, type FamilyProfile } from "./familyProfiles";
import { hex } from "./model";
import "./advanced.css";

type FamilyParams = { voltage: number; pressed: boolean; heldReset: boolean; clockMHz: number };
function Board({ profile, level, input, duty }: { profile: FamilyProfile; level: number; input: number; duty: number }) {
  return <svg className="mca-family-board" viewBox="0 0 680 260" role="img" aria-label={profile.chip + " simulated GPIO and peripheral connections"}>
    <rect x="15" y="15" width="650" height="230" rx="20" fill="#eaf2ff" stroke="#c9d9ef" />
    <rect x="210" y="65" width="220" height="135" rx="14" fill="#183760" />
    <text x="320" y="105" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="700">{profile.family.toUpperCase()}</text>
    <text x="320" y="135" textAnchor="middle" fill="#afcaff" fontSize="12">CPU · registers · peripherals</text>
    <text x="320" y="165" textAnchor="middle" fill="#d9e8ff" fontSize="12">{profile.clock / 1e6} MHz nominal</text>
    <path d="M110 115H210M430 115H550M430 170H550" stroke="#387ddb" strokeWidth="3" fill="none" />
    <circle cx="90" cy="115" r="23" fill={input ? "#2b72df" : "#d8e3f3"} stroke="#5781b9" /><text x="90" y="120" textAnchor="middle" fill={input ? "#fff" : "#22476e"} fontSize="14">{input}</text>
    <text x="90" y="72" textAnchor="middle" fill="#244f87" fontSize="12">{profile.input}</text>
    <circle cx="575" cy="115" r="24" fill={level ? "#22ba77" : "#ccd8df"} stroke="#398465" strokeWidth="2" /><text x="575" y="72" textAnchor="middle" fill="#244f87" fontSize="12">{profile.output} · LED</text>
    <text x="575" y="175" textAnchor="middle" fill="#244f87" fontSize="12">{profile.pwm ? profile.pwm + " PWM" : "Peripheral events"}</text>
    <text x="575" y="197" textAnchor="middle" fill="#244f87" fontSize="12">{profile.pwm ? (duty * 100).toFixed(1) + "% duty" : "Inspect trace below"}</text>
    <text x="35" y="35" fill="#356392" fontSize="10">TEACHING CONNECTION DIAGRAM · REPRESENTATIVE HARDWARE</text>
  </svg>;
}
export default function FamilyLab({ meta }: { meta: LabMeta }) {
  const profile = familyProfile(meta.n);
  return profile ? <FamilyWorkbench key={meta.slug} meta={meta} profile={profile} /> : <p>Family profile missing.</p>;
}
function FamilyWorkbench({ meta, profile }: { meta: LabMeta; profile: FamilyProfile }) {
  const lab = useLab<FamilyParams>({
    slug: meta.slug, code: profile.code, params: { voltage: profile.voltage / 2, pressed: false, heldReset: false, clockMHz: profile.clock / 1e6 },
    mcu: (p) => familyOptions(profile, p.clockMHz), autoRun: false, rebuildOn: ["clockMHz"],
    setup: (mcu, p) => driveFamilyInputs(mcu, profile, p.voltage, p.pressed, p.heldReset),
    world: (mcu, _dt, p) => driveFamilyInputs(mcu, profile, p.voltage, p.pressed, p.heldReset),
  });
  const [checked, setChecked] = useState(false), mcu = lab.mcu, level = mcu.level(profile.output), input = mcu.level(profile.input), pwm = profile.pwm ? mcu.pwmInfo(profile.pwm) : undefined;
  const edges = mcu.edges.get(profile.output) ?? [], measurement = measureEdges(edges, Math.max(0, mcu.time - 1), mcu.time);
  const pwmDuty = pwm?.duty ?? (profile.pwm ? mcu.level(profile.pwm) : 0);
  const count = mcu.fw?.num(meta.n === 57 ? "hits" : "ticks") ?? 0, raw = mcu.fw?.num("raw") ?? 0;
  const traces = [{ label: profile.output + " output", color: "#2173e1", edges, initial: profile.family === "8051" ? 1 : 0, min: 0, max: 1 }, ...(profile.pwm ? [{ label: profile.pwm + " PWM preview", color: "#16a477", sample: (t: number) => pwm ? +(((t * pwm.freq) % 1) < pwm.duty) : pwmDuty, min: 0, max: 1 }] : [])];
  const outputConfigured = profile.family === "8051" ? mcu.regs.has("P1") : ["out", "af"].includes(mcu.pin(profile.output).mode);
  return <LabShell meta={meta} lab={lab} subtitle={profile.subtitle} components={[profile.chip, "LED and resistor", "External input", ...(profile.analog ? ["Analog voltage source"] : [])]} className="mca-family">
    <div className="mca-family-actions"><button type="button" onClick={() => lab.advance(0.1)} disabled={lab.running}>Advance 100 ms</button><button type="button" onClick={() => lab.advance(1)} disabled={lab.running}>Advance 1 second</button><span>{lab.dirty ? "Source changed: Run builds and restarts firmware" : "Step and advance execute the currently built firmware"}</span></div>
    <div className="mca-metrics"><Metric label="GPIO output" value={profile.output + " = " + level} /><Metric label={profile.analog ? "ADC raw" : "Interrupt count"} value={profile.analog ? raw : count} /><Metric label="Measured LED frequency" value={measurement.freq.toFixed(2)} unit="Hz" /><Metric label={profile.pwm ? "PWM duty" : "Clock"} value={profile.pwm ? (pwmDuty * 100).toFixed(1) : lab.params.clockMHz} unit={profile.pwm ? "%" : "MHz"} /></div>
    <div className="mca-grid"><div className="mca-results">
      <Panel title={profile.chip}><Board profile={profile} level={level} input={input} duty={pwmDuty} /><p className="mca-caption">{profile.observe}</p></Panel>
      <Panel title="GPIO and timer traces"><Scope traces={traces} now={mcu.time} window={Math.max(0.05, Math.min(1, mcu.time || 1))} height={210} lanes theme="light" frame={lab.frame} ariaLabel={profile.chip + " live pin traces"} /></Panel>
      <CodeEditor lab={lab} title="Editable firmware · Run to build" rows={22} />
    </div><aside className="mca-controls">
      <Panel title="Hardware inputs">
        {profile.analog && <Slider label={profile.analog + " analog voltage"} min={0} max={profile.voltage} step={0.05} unit=" V" value={lab.params.voltage} onChange={(v) => lab.setParam("voltage", v)} />}
        <Toggle label={profile.input + " external button"} checked={lab.params.pressed} onChange={(v) => lab.setParam("pressed", v)} />
        <Toggle label="Hold MCU in reset" checked={lab.params.heldReset} onChange={(v) => lab.setParam("heldReset", v)} />
        <Slider label="Oscillator (rebuilds)" min={Math.max(1, profile.clock / 4e6)} max={profile.clock / 1e6} step={profile.clock / 4e6} unit=" MHz" value={lab.params.clockMHz} onChange={(v) => lab.setParam("clockMHz", v)} />
        <p className="mca-caption">External inputs apply on the next simulation step. Clock changes rebuild firmware.</p>
      </Panel>
      <Panel title={profile.analog ? "Registers & decoded peripheral state" : "Peripheral registers"}><div className="mca-table"><table><thead><tr><th>Register / state</th><th>Value</th></tr></thead><tbody>{profile.registers.map((reg) => <tr key={reg}><td>{reg}</td><td>{hex(familyRead(mcu, profile, reg), 8)}</td></tr>)}</tbody></table></div></Panel>
      <Panel title="Verify firmware behavior"><button type="button" className="mca-primary" onClick={() => setChecked(true)}>Check current result</button>{checked && <ul className="mca-checks" role="status">
        {[{ label: "Firmware compiled without diagnostics", done: !lab.diagnostics.length && !!mcu.fw }, { label: profile.family === "8051" ? "Quasi-bidirectional port available" : "Output pin configured", done: outputConfigured }, { label: profile.analog ? "ADC follows the applied voltage" : "Peripheral work observed", done: profile.analog ? Math.abs(raw - Math.round(lab.params.voltage / profile.voltage * (2 ** mcu.adcBits - 1))) <= 2 && mcu.time >= 0.02 : count >= 2 }].map((item) => <li key={item.label} className={item.done ? "pass" : ""}>{item.done ? "✓ " : "○ "}{item.label}</li>)}
      </ul>}</Panel>
      <Panel title="Experiment guide"><ol><li>Advance firmware and inspect register configuration.</li><li>{profile.analog ? "Change analog voltage; compare ADC code and PWM duty." : meta.n === 57 ? "Press and release the input twice; inspect the ISR counter." : "Measure timer IRQ count over one second."}</li><li>Edit firmware, Run to rebuild, and compare the result.</li><li>Hold reset and confirm the CPU stops executing.</li></ol><details><summary>Model limits</summary><p>{profile.limitation}</p></details></Panel>
    </aside></div>
    <Panel title="Firmware and peripheral event log"><div className="mca-table"><table><thead><tr><th>Time (s)</th><th>Event</th><th>Effect</th></tr></thead><tbody>{mcu.events.slice(-40).reverse().map((entry, index) => <tr key={index}><td>{entry.t.toFixed(6)}</td><td>{entry.kind}</td><td>{entry.text}</td></tr>)}</tbody></table></div></Panel>
    <button type="button" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ lab: meta.title, family: profile.family, source: lab.compiledCode, params: lab.params, time: mcu.time, registers: Object.fromEntries(profile.registers.map((reg) => [reg, familyRead(mcu, profile, reg)])), outputEdges: edges, events: mcu.events, limitations: profile.limitation }, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = meta.slug + "-experiment.json"; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Export firmware experiment</button>
  </LabShell>;
}
