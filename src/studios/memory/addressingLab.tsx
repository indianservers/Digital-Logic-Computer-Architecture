import { useState } from "react";
import { addressCount, bitsNeeded, formatHex, isAligned, rangeEnd, rangeSize, regionIssues, toBinary, type MapRegion } from "../../engines/memory/fundamentals";
import { BitButton, Field, LabGuide } from "./guide";

const QUIZ = [
  { prompt: "Highest address of a 4 KiB byte-addressable memory?", answer: "FFF", show: "0x0FFF" },
  { prompt: "How many address bits does 1 KiB need?", answer: "10", show: "10 bits" },
  { prompt: "Which address follows 0x00FF?", answer: "100", show: "0x0100" },
];

export function AddressingLab() {
  const [text, setText] = useState("2D");
  const [bits, setBits] = useState(8);
  const [align, setAlign] = useState(4);
  const [startText, setStartText] = useState("10");
  const [sizeText, setSizeText] = useState("20");
  const [word, setWord] = useState(16);
  const [regions, setRegions] = useState<MapRegion[]>([
    { id: "boot", name: "Boot", start: 0x00, end: 0x0f },
    { id: "code", name: "Code", start: 0x10, end: 0x2f },
    { id: "data", name: "Data", start: 0x30, end: 0x4f },
    { id: "stack", name: "Stack", start: 0x50, end: 0x7f },
  ]);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const parsed = Number.parseInt(text, 16);
  const address = Number.isNaN(parsed) ? 0 : Math.min(addressCount(bits) - 1, parsed);
  const binary = toBinary(address, bits);
  const space = addressCount(bits);
  const start = Number.parseInt(startText, 16) || 0;
  const size = Number.parseInt(sizeText, 16) || 1;
  const end = rangeEnd(start, size);
  const aligned = isAligned(address, align);
  const issues = regionIssues(regions, space);
  const decoderBits = Math.min(6, bits);
  const activeLine = address & ((1 << decoderBits) - 1);

  function toggle(index: number) {
    const next = address ^ (1 << (bits - 1 - index));
    const wrapped = next & (space - 1);
    setText(formatHex(wrapped, Math.ceil(bits / 4)));
  }

  function reset() {
    setText("2D");
    setBits(8);
    setAlign(4);
    setStartText("10");
    setSizeText("20");
    setWord(16);
    setRegions([
      { id: "boot", name: "Boot", start: 0x00, end: 0x0f },
      { id: "code", name: "Code", start: 0x10, end: 0x2f },
      { id: "data", name: "Data", start: 0x30, end: 0x4f },
      { id: "stack", name: "Stack", start: 0x50, end: 0x7f },
    ]);
    setAnswers(["", "", ""]);
  }

  return (
    <div>
      <LabGuide
        aim="Turn a hex address into binary, a decoder line, an aligned word, and a map."
        concept="Address bits select one location out of 2ⁿ. Alignment means address mod unit is 0."
        change={["Hex address", "Address width", "Each address bit", "Alignment", "Map regions"]}
        steps={["Type 2D and read decimal and binary.", "Toggle A0.", "Check alignment at 4 bytes.", "Drag a region boundary or edit its end."]}
        observe={["The decoder lights one line.", "0x2D is misaligned for 4 bytes.", "Overlapping regions produce a warning."]}
        formula="Addresses = 2ⁿ. End = start + size − 1. Aligned when address mod alignment = 0."
      />
      <div className="memx-lab">
        <section className="lgx-card">
          <h3>Address Explorer</h3>
          <Field label="Hex address"><input aria-label="Explorer address" value={text} onChange={(event) => setText(event.target.value.toUpperCase().replace(/^0X/, ""))} /></Field>
          <p><span>Hex</span><b>0x{formatHex(address, Math.ceil(bits / 4))}</b></p>
          <p><span>Decimal</span><b>{address}</b></p>
          <p><span>Binary</span><b className="mono">{binary}</b></p>
          <Field label="Address width">
            <select aria-label="Explorer width" value={bits} onChange={(event) => setBits(Number(event.target.value))}>
              {[6, 8, 10, 12, 16].map((value) => <option key={value} value={value}>{value}-bit · {addressCount(value)} addresses</option>)}
            </select>
          </Field>
          <div className="memx-bits">
            {binary.split("").map((bit, index) => <BitButton key={index} bit={bit} label={`A${bits - 1 - index}`} onClick={() => toggle(index)} />)}
          </div>
          <div className="memx-decoder"><b>{decoderBits}-to-{1 << decoderBits}</b><span>Y{activeLine} selected</span></div>
          <div className="word-lines">
            {Array.from({ length: Math.min(8, 1 << decoderBits) }, (_, line) => (
              <div key={line} className={line === (activeLine & 7) ? "word-line on" : "word-line"}>Y{line}</div>
            ))}
          </div>
        </section>
        <section className="lgx-card">
          <h3>Address Range</h3>
          <Field label="Start"><input aria-label="Range start" value={startText} onChange={(event) => setStartText(event.target.value.toUpperCase())} /></Field>
          <Field label="Size"><input aria-label="Range size" value={sizeText} onChange={(event) => setSizeText(event.target.value.toUpperCase())} /></Field>
          <p><span>End</span><b>0x{formatHex(end, 4)}</b></p>
          <p><span>Size check</span><b>{rangeSize(start, end)} bytes</b></p>
          <h3>Alignment</h3>
          <div className="fsmx-quick">
            {[1, 2, 4, 8].map((unit) => <button key={unit} type="button" className={align === unit ? "on" : ""} onClick={() => setAlign(unit)}>{unit}-byte</button>)}
          </div>
          <p className={aligned ? "memx-ok" : "memx-error"}>{aligned ? "Aligned" : "Misaligned"} · {address} mod {align} = {address % align}</p>
          <h3>Word Addressing</h3>
          <Field label="Word">
            <select aria-label="Word size" value={word} onChange={(event) => setWord(Number(event.target.value))}>
              <option value={8}>8-bit byte</option>
              <option value={16}>16-bit word</option>
              <option value={32}>32-bit word</option>
            </select>
          </Field>
          <p className="tiny">{word === 8 ? "Each address is one byte." : `Address 0x${formatHex(address, 2)} covers bytes through 0x${formatHex(address + word / 8 - 1, 2)}.`}</p>
          <p className="tiny">Row/column split of this address: high {toBinary(address >> Math.ceil(bits / 2), Math.floor(bits / 2))} · low {toBinary(address, Math.ceil(bits / 2))}.</p>
        </section>
        <div className="memx-side">
          <section className="lgx-card">
            <h3>Memory Map</h3>
            <div className="memx-bar" aria-label="Memory map">
              {regions.map((region) => (
                <button key={region.id} type="button" className="memx-span" style={{ flexGrow: Math.max(1, region.end - region.start + 1) }} onClick={() => setText(formatHex(region.start, 2))}>
                  {region.name}
                  <small>0x{formatHex(region.start, 2)}–0x{formatHex(region.end, 2)}</small>
                </button>
              ))}
            </div>
            {regions.map((region) => (
              <div key={region.id} className="memx-controls">
                <span>{region.name}</span>
                <input aria-label={`${region.name} end`} value={formatHex(region.end, 2)} onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 16);
                  if (Number.isNaN(value)) return;
                  setRegions((list) => list.map((item) => item.id === region.id ? { ...item, end: value } : item));
                }} />
              </div>
            ))}
            {issues.length ? issues.map((issue) => <p key={issue} className="memx-error">{issue}</p>) : <p className="memx-ok">No overlap inside this {space}-location space.</p>}
            <p className="tiny">{bitsNeeded(1024)} bits address 1 KiB. {bitsNeeded(space)} bits address this map.</p>
          </section>
          <section className="lgx-card">
            <h3>Try This</h3>
            {QUIZ.map((item, index) => (
              <Field key={item.prompt} label={item.prompt}>
                <input aria-label={item.prompt} value={answers[index] ?? ""} onChange={(event) => setAnswers((list) => list.map((answer, slot) => slot === index ? event.target.value.toUpperCase() : answer))} />
                <small>{(answers[index] ?? "").replace(/^0X/, "") === item.answer ? item.show : "Check the hex or the bit count."}</small>
              </Field>
            ))}
            <button type="button" className="fsmx-icon" onClick={reset}>Reset</button>
          </section>
        </div>
      </div>
    </div>
  );
}
