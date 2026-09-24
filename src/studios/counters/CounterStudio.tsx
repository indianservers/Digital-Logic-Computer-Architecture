import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Segmented, Toggle, parseNumberInput } from "../../design-system/ui";
import { bcdToSeven } from "../../engines/digital/routing";
import { counterWidth, designCounter, nextCount, rippleDelays, stepRegister, wordOf } from "../../engines/digital/sequential";
import { fromUnsigned } from "../../engines/digital/vector";
import { StudioFrame } from "../../layout/StudioFrame";
import { COUNTER_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";
import { SevenSeg, SpeedPicker, useTicker, Waveform } from "../shared/widgets";

const TABS = [
  { id: "ripple", label: "Ripple" },
  { id: "sync", label: "Synchronous" },
  { id: "updown", label: "Up / Down" },
  { id: "mod", label: "MOD-N" },
  { id: "decade", label: "Decade / BCD" },
  { id: "ring", label: "Ring / Johnson" },
  { id: "design", label: "Designer" },
];

export function CounterStudio() {
  const [tab, setTab] = useStudioTab(TABS, "ripple");
  const [resetKey, setResetKey] = useState(0);
  const lesson = lessonOf(COUNTER_LESSONS, tab, "ripple");
  return (
    <StudioFrame icon="step" title="Counters" description="Step the clock and watch which flip-flops change, and when." tabs={TABS} tab={tab} onTab={setTab} onReset={() => setResetKey((n) => n + 1)} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      <div key={resetKey}>
        {tab === "ring" ? <RingLab /> : tab === "design" ? <DesignLab /> : <CountLab kind={tab} />}
      </div>
    </StudioFrame>
  );
}

function CountLab({ kind }: { kind: string }) {
  const { prefs } = usePrefs();
  const [width, setWidth] = useState(4);
  const [value, setValue] = useState(0);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [modulus, setModulus] = useState(kind === "decade" ? 10 : 16);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [waves, setWaves] = useState<Array<Array<0 | 1>>>([[0], [0], [0], [0], [0]]);
  const mod = kind === "decade" ? 10 : kind === "mod" ? Math.max(2, modulus) : 2 ** width;
  const bits = wordOf(value % mod, width).split("").map((bit) => (bit === "1" ? 1 : 0));

  function tick() {
    const next = nextCount(value, mod, kind === "updown" ? dir : "up");
    const delays = kind === "ripple" ? rippleDelays(value, next, width) : bits.map((_, index) => ({ bit: index, delay: 1 }));
    setValue(next);
    setHighlight(delays[0]?.bit ?? null);
    setWaves((rows) => {
      const clk = rows[0] ?? [];
      const nextClk = [...clk, (clk[clk.length - 1] === 1 ? 0 : 1) as 0 | 1].slice(-24);
      const bitRows = Array.from({ length: width }, (_, index) => {
        const previous = rows[index + 1] ?? [];
        const bit = ((next >> index) & 1) === 1 ? 1 : 0;
        return [...previous, bit as 0 | 1].slice(-24);
      });
      return [nextClk, ...bitRows];
    });
  }
  useTicker(playing, speed, tick);
  const shown = bcdToSeven(fromUnsigned(value % 10, 4));

  return (
    <div className="grid">
      <Card title={kind === "ripple" ? "Ripple counter" : kind === "sync" ? "Synchronous counter" : kind === "decade" ? "Decade counter" : "Counter"} action={<Segmented options={["2", "3", "4", "8"]} value={String(width)} onChange={(valueText) => { setWidth(Number(valueText)); setValue(0); }} />}>
        <div className="row">
          <Toggle on={playing} onChange={setPlaying} label="Run" tone="ok" />
          <Button onClick={tick}>Step clock</Button>
          <Button onClick={() => { setValue(0); setPlaying(false); }}>Reset</Button>
          <SpeedPicker speed={speed} onChange={setSpeed} />
          {kind === "updown" ? <Segmented options={["up", "down"]} value={dir} onChange={(valueText) => setDir(valueText as "up" | "down")} /> : null}
          {kind === "mod" ? <label className="tiny">N <input aria-label="Modulus" className="text-input" style={{ width: 80 }} type="number" min={2} max={16} value={modulus} onChange={(event) => setModulus(Math.max(2, parseNumberInput(event.target.value, modulus)))} /></label> : null}
        </div>
        <div className="reg-row">
          {bits.map((bit, index) => <div key={index} className={bit ? "ff-cell on" : "ff-cell"} style={{ outline: highlight === width - 1 - index ? "2px solid #2F6FED" : undefined }}><small>Q{width - 1 - index}</small>{bit}</div>)}
        </div>
        <p className="expr">{value % mod} · {wordOf(value % mod, width)}</p>
        {kind === "decade" ? <div className="row"><SevenSeg segments={shown.segments} valid={shown.valid} /><span className="tiny">Returns to 0000 after 1001.</span></div> : null}
        <Waveform traces={(waves.slice(0, width + 1)).map((values, index) => ({ id: index === 0 ? "clk" : `q${index - 1}`, name: index === 0 ? "CLK" : `Q${index - 1}`, values, active: highlight === index - 1 }))} />
        {prefs.explain ? <ExplainBar what={kind === "ripple" ? "The clock ripples from Q0 toward the MSB." : "Every flip-flop sees the same clock."} why={kind === "ripple" ? `Bit changes are staggered. The farthest bit waits about ${width} delays.` : "Control logic, not a rippling clock, decides which stage toggles."} notice={`Next count is ${nextCount(value % mod, mod, kind === "updown" ? dir : "up")}.`} /> : null}
        {kind === "sync" ? <p className="muted">Side by side: ripple waits for each output. Synchronous stages change on one edge, so the word is valid after a single delay.</p> : null}
        {kind === "mod" ? <p className="tiny">Width needed: {counterWidth(mod)}. States {mod}…{2 ** counterWidth(mod) - 1 || 0} are unused when N is not a power of two.</p> : null}
      </Card>
    </div>
  );
}

function RingLab() {
  const [kind, setKind] = useState<"ring" | "johnson">("ring");
  const [q, setQ] = useState<Array<0 | 1>>([1, 0, 0, 0]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  function tick() {
    setQ((current) => stepRegister(current, kind, 0).q);
  }
  useTicker(playing, speed, tick);
  return (
    <Card title="Ring and Johnson" action={<Segmented options={["ring", "johnson"]} value={kind} onChange={(value) => { setKind(value as "ring" | "johnson"); setQ(value === "ring" ? [1, 0, 0, 0] : [0, 0, 0, 0]); }} />}>
      <div className="row"><Toggle on={playing} onChange={setPlaying} label="Run" tone="ok" /><Button onClick={tick}>Step</Button><SpeedPicker speed={speed} onChange={setSpeed} /></div>
      <div className="reg-row">{q.map((bit, index) => <div key={index} className={bit ? "ff-cell on" : "ff-cell"}>{bit}</div>)}</div>
      <p className="muted">{kind === "ring" ? "One hot bit circulates: 1000 → 0100 → 0010 → 0001." : "Feedback is the inverted final bit. Four flip-flops visit eight states."}</p>
    </Card>
  );
}

function DesignLab() {
  const [text, setText] = useState("0,1,2,3,4,5");
  const [kind, setKind] = useState<"D" | "JK">("D");
  const [edge, setEdge] = useState("rise");
  const sequence = text.split(",").map((part) => Number(part.trim())).filter((value) => Number.isInteger(value) && value >= 0);
  const width = Math.max(1, Math.ceil(Math.log2(Math.max(2, ...sequence, 1))));
  const design = sequence.length > 1 ? designCounter(sequence, width, kind) : null;
  return (
    <Card title="Guided counter design">
      <label className="field">Sequence<input aria-label="Count sequence" className="text-input" value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="row">
        <Segmented options={["D", "JK"]} value={kind} onChange={(value) => setKind(value as "D" | "JK")} />
        <Segmented options={["rise", "fall"]} value={edge} onChange={setEdge} />
      </div>
      {design ? (
        <div>
          <p className="tiny">{width} flip-flops, {edge === "rise" ? "rising" : "falling"} edge. Unused states {design.unused.join(", ") || "none"} are don't-cares.</p>
          <table className="data"><thead><tr><th>State</th><th>Next</th></tr></thead><tbody>{design.rows.map((row) => <tr key={row.state}><td>{wordOf(row.state, width)}</td><td>{wordOf(row.next, width)}</td></tr>)}</tbody></table>
          {design.bits.map((bit) => <p key={bit.name + bit.input} className="mono">{bit.input}{bit.name.slice(1)} = {bit.expression}</p>)}
          <p className="muted">Each equation is the input of that flip-flop. D copies the next bit. JK uses the excitation table, with unused counts left as don't-cares.</p>
        </div>
      ) : <p>Enter at least two states, such as 0,1,2,3,4,5 for MOD-6.</p>}
    </Card>
  );
}
