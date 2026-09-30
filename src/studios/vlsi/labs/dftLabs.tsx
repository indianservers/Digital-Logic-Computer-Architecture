import { useState } from "react";
import {
  bistRun,
  faultObserved,
  freshTap,
  generatePattern,
  scanCapture,
  shiftMany,
  shiftScan,
  simulateStuck,
  STUCK_NETS,
  TAP_STATES,
  tapClock,
  tapNext,
  type Bit,
  type StuckFault,
  type TapMachine,
} from "../dftModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, PlayControls, Slider, useTicker } from "../widgets";

function bitsText(bits: Bit[]): string {
  return bits.join(" ");
}

export function ScanChainLab() {
  const [mode, setMode] = useState<"functional" | "shift">("shift");
  const [cells, setCells] = useState<Bit[]>([0, 1, 0, 1]);
  const [inputs, setInputs] = useState<Bit[]>([1, 0, 1, 0]);
  const [scanIn, setScanIn] = useState<Bit>(1);
  const [enabled, setEnabled] = useState(true);
  const [scanOut, setScanOut] = useState<Bit>(0);
  const [playing, setPlaying] = useState(false);
  const pulse = () => {
    if (mode === "shift" && enabled) {
      setCells((current) => {
        const step = shiftScan(current, scanIn);
        setScanOut(step.scanOut);
        return step.cells;
      });
      return;
    }
    setCells([...inputs]);
    setScanOut(0);
  };
  useTicker(playing && mode === "shift", pulse, 550);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Mode" value={mode} options={[{ id: "functional", label: "Functional" }, { id: "shift", label: "Scan shift" }]} onChange={setMode} />
          <Choice label="Scan enable" value={enabled ? "on" : "off"} options={[{ id: "on", label: "SE = 1" }, { id: "off", label: "SE = 0" }]} onChange={(value) => setEnabled(value === "on")} />
          <Choice label="Scan in" value={scanIn === 1 ? "1" : "0"} options={[{ id: "0", label: "0" }, { id: "1", label: "1" }]} onChange={(value) => setScanIn(value === "1" ? 1 : 0)} />
          <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={pulse} />
          <button type="button" onClick={() => { const step = shiftMany(cells, [1, 0, 1, 1]); setCells(step.cells); setScanOut(step.outputs[step.outputs.length - 1] ?? 0); }}>Shift 4</button>
          <button type="button" onClick={() => { setCells([1, 0, 1, 1]); setScanIn(0); setScanOut(0); setPlaying(false); }}>Load example</button>
          <button type="button" onClick={() => { setCells([0, 0, 0, 0]); setScanOut(0); setPlaying(false); }}>Reset</button>
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 360 180" role="img" aria-label="Scan chain of four flip-flops">
          <text x="16" y="28" fill="#94a3b8">Before scan: four plain flip-flops</text>
          {[0, 1, 2, 3].map((index) => <rect key={`plain-${index}`} x={20 + index * 70} y="40" width="48" height="28" fill="#1e293b" stroke="#64748b" />)}
          <text x="16" y="96" fill="#e2e8f0">After scan: mux plus flip-flop, SE selects SI</text>
          {cells.map((bit, index) => (
            <g key={index}>
              <rect x={20 + index * 80} y="108" width="22" height="28" fill={enabled && mode === "shift" ? "#fbbf24" : "#334155"} />
              <rect x={44 + index * 80} y="108" width="36" height="28" fill={bit === 1 ? "#22d3ee" : "#0f172a"} stroke="#e2e8f0" />
              <text x={56 + index * 80} y="126" fill="#f8fafc">{bit}</text>
              {index < 3 ? <line x1={80 + index * 80} y1="122" x2={100 + index * 80} y2="122" stroke="#fde68a" /> : null}
            </g>
          ))}
        </svg>
      }
      readouts={
        <>
          <Measure label="Chain" value={bitsText(cells)} />
          <Measure label="Scan out" value={`${scanOut}`} />
          <Measure label="Functional D" value={bitsText(inputs)} />
          <Badge tone={mode === "shift" && enabled ? "warn" : "on"}>{mode === "shift" && enabled ? "Test mode" : "Functional mode"}</Badge>
          <div className="vlsi-bits">
            {inputs.map((bit, index) => (
              <button key={index} type="button" onClick={() => setInputs((current) => current.map((item, itemIndex) => (itemIndex === index ? (item === 1 ? 0 : 1) : item)))}>D{index}={bit}</button>
            ))}
          </div>
          <Observe change="Turn scan enable on and step the clock." see="Each bit moves one cell toward scan out. Functional mode loads D instead." why="The extra mux is the scan overhead. It costs area and a little delay, and it makes the register state controllable and observable." experiment="Load the example, then shift four times." takeaway="A scan chain is a serial test path beside the functional path." />
        </>
      }
    />
  );
}

export function ScanTestLab() {
  const [cells, setCells] = useState<Bit[]>([0, 0, 0]);
  const [fault, setFault] = useState(false);
  const [seen, setSeen] = useState<Bit[]>([]);
  const [expected, setExpected] = useState<Bit[]>([]);
  const vector: Bit[] = [0, 1, 1];
  const shiftIn = () => {
    const step = shiftMany([0, 0, 0], vector);
    setCells(step.cells);
    setSeen([]);
  };
  const capture = () => {
    const good = scanCapture(cells, null);
    const next = scanCapture(cells, fault ? { index: 2, stuck: 0 } : null);
    setCells(next);
    setExpected([good[2] ?? 0, good[1] ?? 0, good[0] ?? 0]);
  };
  const shiftOut = () => {
    const step = shiftMany(cells, [0, 0, 0]);
    setCells(step.cells);
    setSeen(step.outputs);
  };
  const pass = seen.length === 3 && expected.length === 3 && seen.every((bit, index) => bit === expected[index]);
  return (
    <VlsiGrid
      controls={
        <>
          <button type="button" onClick={shiftIn}>1. Shift in</button>
          <button type="button" onClick={capture}>2. Capture</button>
          <button type="button" onClick={shiftOut}>3. Shift out</button>
          <Choice label="Cloud" value={fault ? "fault" : "good"} options={[{ id: "good", label: "Good AND" }, { id: "fault", label: "Y stuck-at 0" }]} onChange={(value) => setFault(value === "fault")} />
          <button type="button" onClick={() => { setCells([0, 0, 0]); setSeen([]); setExpected([]); }}>Reset</button>
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 340 150" role="img" aria-label="Scan test around an AND cloud">
          {cells.map((bit, index) => (
            <g key={index}>
              <rect x={24 + index * 100} y="48" width="48" height="36" fill={bit ? "#22d3ee" : "#0f172a"} stroke="#e2e8f0" />
              <text x={40 + index * 100} y="70" fill="#f8fafc">{bit}</text>
              <text x={24 + index * 100} y="40" fill="#94a3b8">{index === 2 ? "Y" : index === 0 ? "A" : "B"}</text>
            </g>
          ))}
          <text x="120" y="28" fill="#e2e8f0">AND between A and B, captured into Y</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Vector" value={bitsText(vector)} />
          <Measure label="State" value={bitsText(cells)} />
          <Measure label="Shifted out" value={seen.length ? bitsText(seen) : "—"} />
          <Measure label="Expected" value={expected.length ? bitsText(expected) : "—"} />
          <Badge tone={seen.length < 3 ? "info" : pass ? "on" : "bad"}>{seen.length < 3 ? "Compare after shift out" : pass ? "Pass" : "Fail"}</Badge>
          <Observe change="Shift in 0 1 1, capture, then shift out. Repeat with Y stuck-at 0." see="The good capture stores 1 in Y. The fault stores 0, so the shifted response fails the compare." why="Scan makes the internal capture observable at scan out." experiment="Capture before shifting in. The empty chain captures 0." takeaway="Shift in, capture, shift out, compare." />
        </>
      }
    />
  );
}

export function AtpgLab() {
  const [net, setNet] = useState<StuckFault["net"]>("n1");
  const [stuck, setStuck] = useState<Bit>(0);
  const [vector, setVector] = useState<Record<string, Bit> | null>(null);
  const fault = { net, stuck };
  const found = vector ? faultObserved(vector, fault) : false;
  const good = vector ? simulateStuck(vector, null) : null;
  const bad = vector ? simulateStuck(vector, fault) : null;
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Fault net" value={net} options={STUCK_NETS.map((id) => ({ id, label: id }))} onChange={setNet} />
          <Choice label="Stuck-at" value={stuck === 0 ? "0" : "1"} options={[{ id: "0", label: "SA0" }, { id: "1", label: "SA1" }]} onChange={(value) => setStuck(value === "1" ? 1 : 0)} />
          <button type="button" onClick={() => setVector(generatePattern(fault).vector)}>Generate pattern</button>
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 340 150" role="img" aria-label="AND-OR network used for ATPG">
          <rect x="30" y="40" width="70" height="36" fill="#1e293b" stroke="#38bdf8" />
          <text x="48" y="62" fill="#e2e8f0">AND</text>
          <rect x="160" y="40" width="70" height="36" fill="#1e293b" stroke="#fb7185" />
          <text x="182" y="62" fill="#e2e8f0">OR</text>
          <text x="30" y="110" fill="#94a3b8">a, b → n1 → y, with c into the OR. dead is unobserved.</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Vector" value={vector ? `a ${vector.a}  b ${vector.b}  c ${vector.c}` : "Not generated"} />
          <Measure label="Good y" value={good ? `${good.output}` : "—"} />
          <Measure label="Faulty y" value={bad ? `${bad.output}` : "—"} />
          <Badge tone={!vector ? "info" : found ? "on" : "warn"}>{!vector ? "Idle" : found ? "Detects the fault" : "Undetectable here"}</Badge>
          <Observe change="Select n1 stuck-at 0 and generate a pattern." see="The vector makes the good output differ from the faulty output." why="ATPG searches the eight input combinations and keeps the first one that observes the fault. The unused dead net has no such vector." experiment="Generate a pattern for dead stuck-at 0." takeaway="A pattern is reported only when this search actually detects the fault." />
        </>
      }
    />
  );
}

export function StuckLab() {
  const [net, setNet] = useState<StuckFault["net"]>("n1");
  const [stuck, setStuck] = useState<Bit>(0);
  const [mask, setMask] = useState(0b011);
  const pins = { a: ((mask & 1) === 0 ? 0 : 1) as Bit, b: ((mask & 2) === 0 ? 0 : 1) as Bit, c: ((mask & 4) === 0 ? 0 : 1) as Bit };
  const fault = { net, stuck };
  const good = simulateStuck(pins, null);
  const bad = simulateStuck(pins, fault);
  const detected = good.output !== bad.output;
  const searchable = generatePattern(fault).detects;
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Stuck-at" value={stuck === 0 ? "0" : "1"} options={[{ id: "0", label: "SA0" }, { id: "1", label: "SA1" }]} onChange={(value) => setStuck(value === "1" ? 1 : 0)} />
          <Slider label="Vector number" value={mask} min={0} max={7} step={1} text={`${mask}`} onChange={setMask} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 360 160" role="img" aria-label="Good and faulty copies of the same network">
          {STUCK_NETS.map((id, index) => (
            <g key={id} onClick={() => setNet(id)}>
              <rect x={16 + (index % 3) * 110} y={index < 3 ? 28 : 88} width="90" height="32" fill={id === net ? "#fbbf24" : "#0f172a"} stroke="#e2e8f0" />
              <text x={24 + (index % 3) * 110} y={index < 3 ? 48 : 108} fill="#f8fafc">{id} {id === net ? `SA${stuck}` : good.values[id]}</text>
            </g>
          ))}
        </svg>
      }
      readouts={
        <>
          <Measure label="Good y" value={`${good.output}`} />
          <Measure label="Faulty y" value={`${bad.output}`} />
          <Measure label="Pins" value={`a ${pins.a} b ${pins.b} c ${pins.c}`} />
          <Badge tone={detected ? "on" : "warn"}>{detected ? "Detected" : searchable ? "Not detected by this vector" : "Undetectable"}</Badge>
          <Observe change="Click a net, force SA0 or SA1, then change the vector." see="The faulty copy differs only where the stuck value blocks the good value, and only if that difference reaches y." why="Detection means the output of the good circuit and the faulty circuit disagree." experiment="Click dead. No vector detects it, because nothing reads that net." takeaway="An undetectable fault on this example is the unused dead net." />
        </>
      }
    />
  );
}

export function JtagLab() {
  const [machine, setMachine] = useState<TapMachine>(freshTap());
  const [tms, setTms] = useState<Bit>(0);
  const [tdi, setTdi] = useState<Bit>(1);
  const clock = () => setMachine((current) => tapClock(current, tms, tdi));
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="TMS" value={tms === 1 ? "1" : "0"} options={[{ id: "0", label: "TMS 0" }, { id: "1", label: "TMS 1" }]} onChange={(value) => setTms(value === "1" ? 1 : 0)} />
          <Choice label="TDI" value={tdi === 1 ? "1" : "0"} options={[{ id: "0", label: "TDI 0" }, { id: "1", label: "TDI 1" }]} onChange={(value) => setTdi(value === "1" ? 1 : 0)} />
          <button type="button" onClick={clock}>TCK rising edge</button>
          <button type="button" onClick={() => setMachine(freshTap())}>TRST</button>
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 380 210" role="img" aria-label="JTAG TAP controller state">
          {TAP_STATES.map((name, index) => (
            <g key={name}>
              <rect x={8 + (index % 4) * 88} y={12 + Math.floor(index / 4) * 36} width="82" height="28" rx="6" fill={machine.state === name ? "#22d3ee" : "#1e293b"} />
              <text x={12 + (index % 4) * 88} y={30 + Math.floor(index / 4) * 36} fill={machine.state === name ? "#082f49" : "#e2e8f0"} fontSize="7">{name}</text>
            </g>
          ))}
          <rect x="16" y="164" width="320" height="28" fill="#111827" />
          <text x="24" y="182" fill="#e2e8f0">Boundary {machine.dr.toString(2).padStart(4, "0")} · IR {machine.ir.toString(2).padStart(4, "0")}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="TAP state" value={machine.state} />
          <Measure label="Next if TCK" value={tapNext(machine.state, tms)} />
          <Measure label="TDO" value={`${machine.tdo}`} />
          <Measure label="Instruction" value={machine.instruction} />
          <Badge tone="info">{machine.instruction === "BYPASS" ? "1-bit bypass" : machine.instruction === "EXTEST" ? "External test" : "Sample / preload"}</Badge>
          <Observe change="Hold TMS at 0 for one clock from reset." see="The controller enters Run-Test/Idle. TMS 1 walks toward Select-DR, then Select-IR." why="Each rising TCK samples TMS and TDI and takes exactly one edge in the TAP diagram. Update-IR loads BYPASS, SAMPLE, or EXTEST." experiment="Shift IR with TDI held at 0, then update. EXTEST is instruction 0000." takeaway="Educational TAP only: BYPASS, SAMPLE/PRELOAD, and EXTEST." />
        </>
      }
    />
  );
}

export function BistLab() {
  const [seed, setSeed] = useState(9);
  const [cycles, setCycles] = useState(8);
  const [fault, setFault] = useState(false);
  const [step, setStep] = useState(8);
  const golden = bistRun(seed, cycles, false);
  const live = bistRun(seed, Math.min(step, cycles), fault);
  const full = bistRun(seed, cycles, fault);
  const pass = full.signature === golden.signature;
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Seed" value={seed} min={1} max={15} step={1} text={`${seed}`} onChange={setSeed} />
          <Slider label="Cycles" value={cycles} min={4} max={16} step={1} text={`${cycles}`} onChange={setCycles} />
          <Slider label="Step" value={step} min={1} max={16} step={1} text={`${Math.min(step, cycles)}`} onChange={setStep} />
          <Choice label="CUT" value={fault ? "fault" : "good"} options={[{ id: "good", label: "Good CUT" }, { id: "fault", label: "Invert response" }]} onChange={(value) => setFault(value === "fault")} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 340 140" role="img" aria-label="LFSR, circuit under test, and MISR">
          {(live.vectors[live.vectors.length - 1] ?? seed).toString(2).padStart(4, "0").split("").map((bit, index) => (
            <rect key={index} x={20 + index * 28} y="36" width="22" height="28" fill={bit === "1" ? "#22d3ee" : "#0f172a"} stroke="#e2e8f0" />
          ))}
          <text x="20" y="28" fill="#94a3b8">LFSR</text>
          <rect x="150" y="36" width="50" height="28" fill="#1e293b" stroke="#fbbf24" />
          <text x="162" y="54" fill="#e2e8f0">CUT</text>
          <text x="220" y="54" fill="#e2e8f0">MISR {live.signature.toString(16)}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Vector" value={(live.vectors[live.vectors.length - 1] ?? 0).toString(2).padStart(4, "0")} />
          <Measure label="Signature" value={full.signature.toString(16)} />
          <Measure label="Golden" value={golden.signature.toString(16)} />
          <Badge tone={pass ? "on" : "bad"}>{pass ? "Pass" : "Fail"}</Badge>
          <Observe change="Step the cycle count, then invert the CUT response." see="The same seed rebuilds the same LFSR sequence and the same golden signature. A fault moves the MISR off that signature." why="The LFSR is a deterministic 4-bit register with feedback from bits 3 and 0. The MISR folds each response bit into an 8-bit signature." experiment="Change the seed and watch both signatures move together until a fault is injected." takeaway="Pass means the final signature matches the fault-free run." />
        </>
      }
    />
  );
}
