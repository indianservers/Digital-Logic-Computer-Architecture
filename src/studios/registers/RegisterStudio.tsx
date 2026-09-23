import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Segmented } from "../../design-system/ui";
import { stepRegister, type RegOp } from "../../engines/digital/sequential";
import { toHex, toUnsigned } from "../../engines/digital/vector";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { BitSwitch, SpeedPicker, useTicker, Waveform, WordEditor } from "../shared/widgets";

const TABS = [
  { id: "parallel", label: "Parallel" },
  { id: "siso", label: "SISO" },
  { id: "sipo", label: "SIPO" },
  { id: "piso", label: "PISO" },
  { id: "pipo", label: "PIPO" },
  { id: "bi", label: "Bidirectional" },
  { id: "universal", label: "Universal" },
  { id: "ring", label: "Ring" },
  { id: "johnson", label: "Johnson" },
];

export function RegisterStudio() {
  const [tab, setTab] = useStudioTab(TABS, "parallel");
  const [resetKey, setResetKey] = useState(0);
  return (
    <StudioFrame icon="project" title="Registers & Shift Registers" description="One clock edge moves every bit, or captures a whole word at once." tabs={TABS} tab={tab} onTab={setTab} onReset={() => setResetKey((n) => n + 1)} guide={["Load a word into the parallel register", "Shift 1011 through SISO", "Switch the universal register between hold, shift, and load", "Watch a single 1 circulate in the ring"]} takeaways={["A register is parallel flip-flops sharing a clock", "Serial modes move one bit per edge", "Johnson feeds back the inverted last bit"]}>
      <div key={resetKey}><RegisterLab mode={tab} /></div>
    </StudioFrame>
  );
}

function RegisterLab({ mode }: { mode: string }) {
  const { prefs } = usePrefs();
  const [width, setWidth] = useState(4);
  const [q, setQ] = useState<Array<0 | 1>>([1, 0, 1, 1]);
  const [parallel, setParallel] = useState<Array<0 | 1>>([1, 0, 1, 1]);
  const [serial, setSerial] = useState(false);
  const [dir, setDir] = useState<"shift-left" | "shift-right">("shift-right");
  const [op, setOp] = useState<RegOp>("hold");
  const [trace, setTrace] = useState<Array<0 | 1>>([1]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const word = fit(q, width);
  const loaded = fit(parallel, width);

  function operation(): RegOp {
    if (mode === "parallel" || mode === "pipo") return "load";
    if (mode === "siso" || mode === "sipo") return "shift-right";
    if (mode === "piso") return op === "load" ? "load" : "shift-right";
    if (mode === "bi") return dir;
    if (mode === "universal") return op;
    if (mode === "ring") return "ring";
    if (mode === "johnson") return "johnson";
    return "hold";
  }

  function tick() {
    const next = stepRegister(word, operation(), serial ? 1 : 0, loaded);
    setQ(next.q);
    setTrace((items) => [...items, next.serialOut].slice(-32));
  }
  useTicker(playing, speed, tick);

  return (
    <Card title={`${width}-bit ${mode}`} action={<Segmented options={["4", "8"]} value={String(width)} onChange={(value) => setWidth(Number(value))} />}>
      <div className="reg-row" aria-label="Register cells">
        {word.map((bit, index) => <div key={index} className={bit ? "ff-cell on" : "ff-cell"}><small>Q{width - 1 - index}</small>{bit}</div>)}
      </div>
      <div className="row">
        <Button variant="primary" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</Button>
        <Button onClick={tick}>Step</Button>
        <Button onClick={() => { setQ(mode === "ring" ? [1, ...Array.from({ length: width - 1 }, () => 0 as 0 | 1)] : Array.from({ length: width }, () => 0)); setPlaying(false); }}>Reset</Button>
        <SpeedPicker speed={speed} onChange={setSpeed} />
      </div>
      {mode === "parallel" || mode === "pipo" || mode === "piso" || mode === "universal" ? <WordEditor bits={loaded} onChange={setParallel} /> : null}
      {mode !== "ring" && mode !== "johnson" && mode !== "parallel" && mode !== "pipo" ? <BitSwitch label="Serial in" on={serial} onChange={setSerial} /> : null}
      {mode === "bi" ? <Segmented options={["shift-left", "shift-right"]} value={dir} onChange={(value) => setDir(value as typeof dir)} /> : null}
      {mode === "universal" ? <Segmented options={["hold", "shift-left", "shift-right", "load"]} value={op} onChange={(value) => setOp(value as RegOp)} /> : null}
      {mode === "piso" ? <Segmented options={["load", "shift-right"]} value={op === "load" ? "load" : "shift-right"} onChange={(value) => setOp(value as RegOp)} /> : null}
      {(mode === "parallel" || mode === "pipo") ? <Button onClick={tick}>Capture on clock</Button> : null}
      <p className="mono">Q {word.join("")} · hex {toHex(word)} · unsigned {toUnsigned(word)}</p>
      <Waveform traces={[{ id: "so", name: mode === "sipo" || mode === "pipo" ? "Q0" : "SO", values: trace, active: true }]} />
      {prefs.explain ? <ExplainBar what={explain(mode, operation())} why="Every cell shares the clock, so the word changes together." notice={mode === "johnson" ? "A 4-bit Johnson cycle visits 8 states, twice the register length." : "Serial out is the bit that leaves the end."} /> : null}
      {mode === "siso" ? <p className="tiny">{word.join("") === "1011" || trace.join("").includes("1011") ? "1011 is in the shift path." : "Load serial bits 1,0,1,1 on successive clocks."}</p> : null}
    </Card>
  );
}

function explain(mode: string, op: RegOp): string {
  if (mode === "ring") return "The last bit re-enters the front. A single 1 circulates.";
  if (mode === "johnson") return "The inverted last bit re-enters the front.";
  if (op === "load") return "Parallel inputs replace every cell on this edge.";
  if (op === "shift-left") return "Bits move toward the MSB. Serial in fills the LSB.";
  if (op === "shift-right") return "Bits move toward the LSB. Serial in fills the MSB.";
  return "Hold keeps the stored word.";
}

function fit(bits: Array<0 | 1>, width: number): Array<0 | 1> {
  const sliced = bits.slice(0, width);
  return [...sliced, ...Array.from({ length: Math.max(0, width - sliced.length) }, () => 0 as 0 | 1)];
}
