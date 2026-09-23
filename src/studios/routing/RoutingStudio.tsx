import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Card, Segmented, parseNumberInput } from "../../design-system/ui";
import { bcdToSeven, binaryToGrayCircuit, cascadedMux, decoder, demux, encoder, excess3Circuit, mux, muxImplements, priorityEncoder, SEGMENT_NAMES } from "../../engines/digital/routing";
import { fromUnsigned, toBinary, toUnsigned } from "../../engines/digital/vector";
import { grayBits } from "../../engines/numbers/codes";
import { StudioFrame } from "../../layout/StudioFrame";
import { BitSwitch, SevenSeg, WordEditor } from "../shared/widgets";

const TABS = [
  { id: "mux", label: "Multiplexer" },
  { id: "cascade", label: "Cascaded MUX" },
  { id: "demux", label: "Demultiplexer" },
  { id: "enc", label: "Encoder" },
  { id: "priority", label: "Priority encoder" },
  { id: "dec", label: "Decoder" },
  { id: "seg", label: "7-segment" },
  { id: "code", label: "Code converter" },
];

export function RoutingStudio() {
  const [tab, setTab] = useStudioTab(TABS, "mux");
  const [resetKey, setResetKey] = useState(0);
  return (
    <StudioFrame icon="grid" title="MUX, DEMUX, Encoder & Decoder" description="Select a path, or turn a one-hot line into a binary code, and the diagram follows." tabs={TABS} tab={tab} onTab={setTab} onReset={() => setResetKey((n) => n + 1)} guide={["Choose a multiplexer size", "Toggle a data input and the select lines", "Watch only the chosen path stay bright", "Try an invalid BCD code on the display"]} takeaways={["A mux picks one input", "A demux copies one input onto one output", "A priority encoder ignores lower requests", "Codes 10–15 are not digits"]}>
      <div key={resetKey}>
        {tab === "mux" ? <MuxLab /> : null}
        {tab === "cascade" ? <CascadeLab /> : null}
        {tab === "demux" ? <DemuxLab /> : null}
        {tab === "enc" ? <EncLab /> : null}
        {tab === "priority" ? <PriorityLab /> : null}
        {tab === "dec" ? <DecLab /> : null}
        {tab === "seg" ? <SegLab /> : null}
        {tab === "code" ? <CodeLab /> : null}
      </div>
    </StudioFrame>
  );
}

function MuxLab() {
  const [size, setSize] = useState(4);
  const [inputs, setInputs] = useState<Array<0 | 1>>([0, 1, 0, 1, 1, 0, 1, 0]);
  const [select, setSelect] = useState<Array<0 | 1>>([0, 1]);
  const width = Math.log2(size);
  const sel = fit(select, width);
  const data = inputs.slice(0, size);
  const result = mux(data, sel);
  const fn = muxImplements([0, 1, "C", "C'"]);
  return (
    <div className="grid cards-2">
      <Card title="Multiplexer" action={<Segmented options={["2", "4", "8"]} value={String(size)} onChange={(value) => setSize(Number(value))} />}>
        <div className="bits">{data.map((bit, index) => <BitSwitch key={index} label={`I${index}`} on={bit === 1} onChange={(on) => setInputs((prev) => prev.map((item, i) => i === index ? (on ? 1 : 0) : item))} />)}</div>
        <WordEditor bits={sel} labels={sel.map((_, index) => `S${sel.length - 1 - index}`)} onChange={setSelect} />
        <p className="expr">Y = {result.y} from I{result.index ?? "?"}</p>
        <svg viewBox="0 0 360 180" className="diagram" aria-label="Multiplexer paths">
          {data.map((bit, index) => (
            <g key={index}>
              <path className={index === result.index ? "wire high" : "wire low"} d={`M 20 ${16 + index * 18} H 140`} opacity={index === result.index ? 1 : 0.35} />
              <text x="24" y={20 + index * 18} fontSize="11">I{index}={bit}</text>
            </g>
          ))}
          <rect x="140" y="12" width="80" height={Math.max(40, data.length * 18)} rx="12" fill="white" stroke="#2F6FED" />
          <text x="180" y={36} textAnchor="middle" fontSize="12">{size}:1</text>
          <path className={result.y === 1 ? "wire high" : "wire low"} d="M220 40 H320" />
          <text x="300" y="64" fontSize="14">Y {result.y}</text>
        </svg>
      </Card>
      <Card title="MUX as a function">
        <p className="muted">A 4:1 mux implements any function of S1 and S0 by tying each data input to 0, 1, or another variable.</p>
        {fn.map((line) => <p key={line} className="mono">{line}</p>)}
        <p className="tiny">Challenge: set select to 11 and I3 to 1. Y should follow I3.</p>
        <p>{result.index === 3 && result.y === 1 ? "D3 is routed to Y." : "Select 3 and raise I3 to complete the route."}</p>
      </Card>
    </div>
  );
}

function CascadeLab() {
  const [inputs, setInputs] = useState<Array<0 | 1>>([0, 0, 0, 1, 0, 0, 0, 0]);
  const [select, setSelect] = useState<Array<0 | 1>>([0, 1, 1]);
  const result = cascadedMux(inputs, select);
  return (
    <Card title="8:1 from two 4:1 blocks and one 2:1">
      <div className="bits">{inputs.map((bit, index) => <BitSwitch key={index} label={`D${index}`} on={bit === 1} onChange={(on) => setInputs((prev) => prev.map((item, i) => i === index ? (on ? 1 : 0) : item))} />)}</div>
      <WordEditor bits={select} labels={["S2", "S1", "S0"]} onChange={setSelect} />
      {result.stages.map((stage) => <p key={stage.name}>{stage.name}: chooses input {stage.chosen}</p>)}
      <p className="expr">Y = {result.y}</p>
    </Card>
  );
}

function DemuxLab() {
  const [size, setSize] = useState(4);
  const [data, setData] = useState(true);
  const [select, setSelect] = useState<Array<0 | 1>>([1, 0]);
  const outs = demux(data ? 1 : 0, fit(select, Math.log2(size)), size);
  return (
    <Card title="Demultiplexer" action={<Segmented options={["2", "4", "8"]} value={String(size)} onChange={(value) => setSize(Number(value))} />}>
      <BitSwitch label="Data" on={data} onChange={setData} />
      <WordEditor bits={fit(select, Math.log2(size))} onChange={setSelect} />
      <div className="bits">{outs.map((bit, index) => <span key={index} className={bit === 1 ? "bit on" : "bit"}>Y{index} {bit}</span>)}</div>
    </Card>
  );
}

function EncLab() {
  const [inputs, setInputs] = useState<Array<0 | 1>>([0, 0, 1, 0]);
  const result = encoder(inputs);
  return (
    <Card title="4-to-2 encoder">
      <div className="bits">{inputs.map((bit, index) => <BitSwitch key={index} label={`D${index}`} on={bit === 1} onChange={(on) => setInputs((prev) => prev.map((item, i) => i === index ? (on ? 1 : 0) : (on ? 0 : item)))} />)}</div>
      <p>{result.invalid ? "Invalid: exactly one input must be high." : `Y = ${toBinary(result.y)}  valid ${result.valid}`}</p>
    </Card>
  );
}

function PriorityLab() {
  const [inputs, setInputs] = useState<Array<0 | 1>>([1, 0, 1, 1]);
  const result = priorityEncoder(inputs);
  return (
    <Card title="Priority D3 > D2 > D1 > D0">
      <div className="bits">{inputs.map((bit, index) => <BitSwitch key={index} label={`D${index}`} on={bit === 1} onChange={(on) => setInputs((prev) => prev.map((item, i) => i === index ? (on ? 1 : 0) : item))} />)}</div>
      <p className="expr">Winner D{result.winner ?? "—"} → {toBinary(result.y)} · valid {result.valid}</p>
      <p className="muted">Ignored lower requests: {result.ignored.map((index) => `D${index}`).join(", ") || "none"}</p>
    </Card>
  );
}

function DecLab() {
  const [width, setWidth] = useState(2);
  const [select, setSelect] = useState<Array<0 | 1>>([1, 0]);
  const bits = fit(select, width);
  const outs = decoder(bits);
  return (
    <Card title="Decoder" action={<Segmented options={["2", "3"]} value={String(width)} onChange={(value) => setWidth(Number(value))} />}>
      <WordEditor bits={bits} onChange={setSelect} />
      <div className="bits">{outs.map((bit, index) => <span key={index} className={bit === 1 ? "bit on" : "bit"}>Y{index}</span>)}</div>
      <p className="tiny">Exactly one output is high. Memory addressing uses this idea to pick one word.</p>
    </Card>
  );
}

function SegLab() {
  const [bits, setBits] = useState<Array<0 | 1>>([0, 1, 0, 1]);
  const shown = bcdToSeven(bits);
  return (
    <Card title="BCD to seven segment">
      <WordEditor bits={bits} labels={["8", "4", "2", "1"]} onChange={setBits} />
      <div className="row">
        <SevenSeg segments={shown.segments} valid={shown.valid} />
        <div>{SEGMENT_NAMES.map((name, index) => <div key={name}>{name} {shown.segments[index] === 1 ? "on" : "off"}</div>)}</div>
      </div>
      <p>{shown.valid ? `Digit ${shown.digit}` : `Code ${toUnsigned(bits)} is not a decimal digit. The display stays blank rather than inventing a glyph.`}</p>
    </Card>
  );
}

function CodeLab() {
  const [bits, setBits] = useState<Array<0 | 1>>([1, 0, 1, 0]);
  const [digit, setDigit] = useState(5);
  const gray = binaryToGrayCircuit(bits);
  const excess = excess3Circuit(digit);
  return (
    <div className="grid cards-2">
      <Card title="Binary to Gray">
        <WordEditor bits={bits} onChange={setBits} />
        <p className="expr">{gray.gray.join("")}</p>
        {gray.gates.map((gate) => <p key={gate} className="mono">{gate}</p>)}
        <p className="tiny">Check: {grayBits(bits).join("")}</p>
      </Card>
      <Card title="BCD plus 0011 = Excess-3">
        <input aria-label="Decimal digit" className="text-input" type="number" min={0} max={9} value={digit} onChange={(event) => setDigit(Math.max(0, Math.min(9, parseNumberInput(event.target.value, digit))))} />
        {excess ? <p className="mono">{toBinary(excess.bcd)} + {toBinary(excess.plus3)} = {toBinary(excess.result)}</p> : <p>Digits 0–9 only.</p>}
        <p className="tiny">Value {fromUnsigned(digit, 4).join("")} is the BCD nibble.</p>
      </Card>
    </div>
  );
}

function fit(bits: Array<0 | 1>, width: number): Array<0 | 1> {
  const safe = Number.isFinite(width) ? width : 1;
  const sliced = bits.slice(-safe);
  return [...Array.from({ length: Math.max(0, safe - sliced.length) }, () => 0 as 0 | 1), ...sliced];
}
