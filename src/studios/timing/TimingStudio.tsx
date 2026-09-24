import { useMemo, useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Card, ExplainBar } from "../../design-system/ui";
import { capture, clockSamples, delayedTransition, edges, frequencyMHz, holdViolated, metastableNote, periodNs, setupViolated } from "../../engines/digital/timing";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { Waveform } from "../shared/widgets";

const TABS = [
  { id: "clock", label: "Clock" },
  { id: "edge", label: "Edges" },
  { id: "setup", label: "Setup" },
  { id: "hold", label: "Hold" },
  { id: "delay", label: "Propagation" },
  { id: "meta", label: "Metastability" },
];

const LESSONS: Record<string, { guide: string[]; takeaways: string[]; theory: { title: string; body: string } }> = {
  clock: {
    theory: { title: "Clock frequency and duty", body: "Period is 1 / frequency. Duty cycle is high time over period. This waveform is simulated time so you can mark edges; it is not a lab oscillator." },
    guide: ["Set frequency and read the period.", "Change duty and see the high pulse width.", "Move the cursor along the samples.", "Open Edges to name rise versus fall."],
    takeaways: ["Period is the reciprocal of frequency.", "Duty cycle is high time over period.", "Simulated nanoseconds, not a wall-clock wait."],
  },
  edge: {
    theory: { title: "Clock edges", body: "A rising edge is 0→1. A falling edge is 1→0. Flip-flops in this curriculum sample on an edge you choose. The event is the transition, not the level that follows." },
    guide: ["Mark a rising edge on the waveform.", "Compare rise and fall lists.", "Move phase and see edges slide.", "Remember: capture happens at the edge, not during the high pulse."],
    takeaways: ["Rise is 0→1; fall is 1→0.", "Edge-triggered storage ignores the level between edges.", "Phase slides the whole pattern."],
  },
  setup: {
    theory: { title: "Setup time", body: "Setup is how long D must be stable before the capturing edge. If D arrives too late, the sampled value is uncertain (X in this lab). Setup is a before-the-edge window." },
    guide: ["Place D so it settles before the edge.", "Move D later until the capture is X.", "Read the setup window on the waveform.", "Compare with the hold tab: that window is after the edge."],
    takeaways: ["Setup is before the capturing edge.", "A late D makes the capture uncertain.", "X here means uncertain, not a transistor waveform."],
  },
  hold: {
    theory: { title: "Hold time", body: "Hold is how long D must remain stable after the capturing edge. Changing D too soon can corrupt the new state. Hold is an after-the-edge window." },
    guide: ["Keep D stable past the edge.", "Pull D back too early and read X.", "Contrast with setup on the previous tab.", "Think of hold as 'don't let go yet'."],
    takeaways: ["Hold is after the capturing edge.", "An early D change makes the capture uncertain.", "Setup and hold together are the aperture around the edge."],
  },
  delay: {
    theory: { title: "Propagation through combinational logic", body: "The next flip-flop must not sample until the combinational path from the previous edge has settled. That path delay plus setup must fit in one period." },
    guide: ["Change the delay and watch when Y becomes valid.", "See the next edge arrive before Y settles — a teaching setup fail.", "Relate period ≥ delay + setup.", "This is the same delay idea as the gate studio, now next to a clock."],
    takeaways: ["Period must cover logic delay plus setup.", "A too-fast clock samples stale or uncertain data.", "Delay here is a teaching number, not a cell library."],
  },
  meta: {
    theory: { title: "Metastability", body: "If D is changing inside the aperture, the flip-flop can sit between 0 and 1 for a while. This lab shows that as X and a note — it is not a SPICE tail. Synchronizers are extra stages to make that rare." },
    guide: ["Aim D at the edge and read the metastable note.", "Move D clearly before or after to get a clean 0 or 1.", "Treat X as 'do not trust this sample'.", "Two stages (a synchronizer) are the usual teaching fix."],
    takeaways: ["Sampling a moving D can be metastable.", "X means the value is not a legal 0 or 1 yet.", "This is a concept demo, not a MTBF calculator."],
  },
};

export function TimingStudio() {
  const [tab, setTab] = useStudioTab(TABS, "clock");
  const [resetKey, setResetKey] = useState(0);
  const lesson = LESSONS[tab] ?? LESSONS.clock!;
  return (
    <StudioFrame icon="bolt" title="Digital Timing & Clocking" description="Frequency, duty, and the windows around a clock edge. Simulated time, not a wall-clock wait." tabs={TABS} tab={tab} onTab={setTab} onReset={() => setResetKey((n) => n + 1)} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      <div key={`${tab}-${resetKey}`}>{tab === "clock" || tab === "edge" ? <ClockLab edgesOnly={tab === "edge"} /> : null}{tab === "setup" ? <WindowLab kind="setup" /> : null}{tab === "hold" ? <WindowLab kind="hold" /> : null}{tab === "delay" ? <DelayLab /> : null}{tab === "meta" ? <MetaLab /> : null}</div>
    </StudioFrame>
  );
}

function ClockLab({ edgesOnly }: { edgesOnly: boolean }) {
  const [mhz, setMhz] = useState(10);
  const [duty, setDuty] = useState(50);
  const [phase, setPhase] = useState(0);
  const [cursor, setCursor] = useState<number | null>(4);
  const period = periodNs(mhz);
  const samples = useMemo(() => clockSamples(Math.max(4, Math.round(period)), duty, phase, 40), [period, duty, phase]);
  const rises = edges(samples, "rise");
  const falls = edges(samples, "fall");
  return (
    <Card title="Clock generator">
      <label className="field">Frequency {mhz} MHz<input aria-label="Frequency" type="range" min={1} max={100} value={mhz} onChange={(event) => setMhz(Number(event.target.value))} /></label>
      <label className="field">Duty {duty}%<input aria-label="Duty cycle" type="range" min={10} max={90} value={duty} onChange={(event) => setDuty(Number(event.target.value))} /></label>
      <label className="field">Phase {phase}°<input aria-label="Phase" type="range" min={0} max={360} value={phase} onChange={(event) => setPhase(Number(event.target.value))} /></label>
      <p className="mono">T = {period.toFixed(2)} ns · f = {frequencyMHz(period).toFixed(2)} MHz · duty {duty}%</p>
      <Waveform traces={[{ id: "clk", name: "CLK", values: samples, active: true }]} cursor={cursor} onCursor={setCursor} />
      {edgesOnly ? <p>Rising edges at samples {rises.join(", ") || "—"}. Falling edges at {falls.join(", ") || "—"}. {cursor !== null && rises.includes(cursor) ? "Cursor is on a rising edge." : "Move the cursor onto a transition."}</p> : null}
    </Card>
  );
}

function WindowLab({ kind }: { kind: "setup" | "hold" }) {
  const { prefs } = usePrefs();
  const edge = 20;
  const limit = kind === "setup" ? 5 : 4;
  const [change, setChange] = useState(kind === "setup" ? 12 : 22);
  const violated = kind === "setup" ? setupViolated(change, edge, limit) : holdViolated(change, edge, limit);
  const captured = capture(1, change, edge, kind === "setup" ? limit : 5, kind === "hold" ? limit : 3);
  const clk = Array.from({ length: 40 }, (_, index) => (index % 20 < 10 ? 1 : 0));
  const data = Array.from({ length: 40 }, (_, index) => (index < change ? 0 : 1));
  return (
    <Card title={kind === "setup" ? "Setup time" : "Hold time"}>
      <label className="field">D changes at {change} ns<input aria-label="Data transition" type="range" min={0} max={39} value={change} onChange={(event) => setChange(Number(event.target.value))} /></label>
      <p>Active edge at {edge} ns. {kind === "setup" ? `Setup window is ${edge - limit}–${edge} ns.` : `Hold window is ${edge}–${edge + limit} ns.`}</p>
      <Waveform traces={[{ id: "clk", name: "CLK", values: clk }, { id: "d", name: "D", values: data, active: true }, { id: "q", name: "Q", values: Array.from({ length: 40 }, (_, index) => index < edge ? 0 : captured.value) }]} cursor={change} />
      <p className={violated ? "expr" : "muted"}>{violated ? "Violation. Q is uncertain." : "Safe. Q captures 1."}</p>
      {prefs.explain ? <ExplainBar what={captured.reason} why={kind === "setup" ? "The input must already be still when the edge arrives." : "The input must stay still just after the edge."} notice="The shaded window is the requirement. The slider moves only D." /> : null}
    </Card>
  );
}

function DelayLab() {
  const [delay, setDelay] = useState(8);
  const [inputAt, setInputAt] = useState(6);
  const moved = delayedTransition(inputAt, delay);
  const a = Array.from({ length: 40 }, (_, index) => (index >= inputAt ? 1 : 0));
  const y = Array.from({ length: 40 }, (_, index) => (index >= moved.outputTime ? 1 : 0));
  return (
    <Card title="Propagation delay">
      <label className="field">Gate delay {delay} ns<input aria-label="Delay" type="range" min={1} max={15} value={delay} onChange={(event) => setDelay(Number(event.target.value))} /></label>
      <label className="field">Input changes at {inputAt} ns<input aria-label="Input time" type="range" min={0} max={24} value={inputAt} onChange={(event) => setInputAt(Number(event.target.value))} /></label>
      <Waveform traces={[{ id: "a", name: "A", values: a }, { id: "y", name: "Y", values: y, active: true }]} />
      <p>{moved.note} Output time {moved.outputTime} ns.</p>
    </Card>
  );
}

function MetaLab() {
  const [change, setChange] = useState(19);
  const violated = setupViolated(change, 20, 3) || holdViolated(change, 20, 2);
  const note = metastableNote(violated);
  return (
    <Card title="Metastability, as a concept">
      <label className="field">D transition {change}<input aria-label="Transition near the edge" type="range" min={10} max={28} value={change} onChange={(event) => setChange(Number(event.target.value))} /></label>
      <ExplainBar what={note.what} why={note.why} notice={note.notice} />
    </Card>
  );
}
