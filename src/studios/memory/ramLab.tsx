import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { reducedMotion } from "../aca/animation/acaMotion";
import {
  MAP_REGIONS,
  READ_STEPS,
  WRITE_STEPS,
  addressCount,
  combineWord,
  formatHex,
  hexDigits,
  preloadCells,
  regionFor,
  toBinary,
  validateAddress,
  validateData,
  type Endian,
  type PreloadKind,
} from "../../engines/memory/fundamentals";
import { BitButton, Field, LabGuide } from "./guide";

gsap.registerPlugin(useGSAP);

interface LogRow {
  id: number;
  op: "READ" | "WRITE";
  address: number;
  input: string;
  output: string;
  status: string;
}

const PROMPTS = [
  "Toggle A0 and watch the selected cell move by one location.",
  "Changing A5 jumps the selection by 32 locations.",
  "Six address bits name 64 unique locations, 0x00 through 0x3F.",
  "An 8-bit data bus moves exactly one byte in one cycle.",
];

export function RamLab() {
  const [addressBits, setAddressBits] = useState(6);
  const [dataBits, setDataBits] = useState(8);
  const [latency, setLatency] = useState(1);
  const [preload, setPreload] = useState<PreloadKind>("program");
  const [custom, setCustom] = useState("A5");
  const [cells, setCells] = useState(() => preloadCells("program", 64, 8));
  const [address, setAddress] = useState(0x12);
  const [addressText, setAddressText] = useState("12");
  const [dataText, setDataText] = useState("A5");
  const [addrError, setAddrError] = useState("");
  const [dataError, setDataError] = useState("");
  const [view, setView] = useState<"byte" | "word">("byte");
  const [endian, setEndian] = useState<Endian>("little");
  const [op, setOp] = useState<"read" | "write">("read");
  const [stage, setStage] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [regionId, setRegionId] = useState("vars");
  const [log, setLog] = useState<LogRow[]>([]);
  const [tick, setTick] = useState(1);
  const [runId, setRunId] = useState(0);
  const finished = useRef(0);
  const scope = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const words = addressCount(addressBits);
  const steps = op === "read" ? READ_STEPS : WRITE_STEPS;
  const stored = cells[address] ?? 0;
  const pending = validateData(dataText, dataBits);
  const writeValue = pending.ok ? pending.value : stored;
  const shown = stage >= steps.length - 1 && op === "write" ? writeValue : stored;
  const addrBinary = toBinary(address, addressBits);
  const dataBinary = toBinary(shown, dataBits);
  const region = regionFor(address);
  const activeRegion = MAP_REGIONS.find((item) => item.id === regionId) ?? null;

  useGSAP(() => {
    const node = scope.current?.querySelector<HTMLElement>(`[data-flow="${steps[stage]?.part ?? "mar"}"]`);
    if (!node) return;
    gsap.fromTo(node, { scale: reducedMotion() ? 1 : 0.98 }, { scale: 1, duration: reducedMotion() ? 0 : 0.35, ease: "power2.out" });
  }, { scope, dependencies: [stage, op], revertOnUpdate: true });

  useEffect(() => {
    if (!playing || stage < 0 || stage >= steps.length - 1) return;
    const delay = (stage >= 4 ? 900 : 750) * latency / speed;
    const timer = window.setTimeout(() => setStage((current) => Math.min(steps.length - 1, current + 1)), reducedMotion() ? 40 : delay);
    return () => window.clearTimeout(timer);
  }, [playing, stage, speed, latency, steps.length]);

  useEffect(() => {
    if (stage !== steps.length - 1 || finished.current === runId) return;
    finished.current = runId;
    setPlaying(false);
    commit(op);
    // The finished ref records this run so a re-render does not log it twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, runId]);

  function load(kind: PreloadKind, bits = addressBits, width = dataBits, pattern = custom) {
    const parsed = validateData(pattern, width);
    const next = preloadCells(kind, addressCount(bits), width, parsed.ok ? parsed.value : 0);
    setCells(next);
    setPreload(kind);
    const nextAddress = Math.min(address, next.length - 1);
    setAddress(nextAddress);
    setAddressText(formatHex(nextAddress, hexDigits(bits)));
    setStage(-1);
    setPlaying(false);
  }

  function commit(nextOp: "read" | "write") {
    const value = nextOp === "write" ? writeValue : (cells[address] ?? 0);
    if (nextOp === "write" && pending.ok) {
      setCells((current) => current.map((cell, index) => index === address ? value : cell));
    }
    const row: LogRow = {
      id: tick,
      op: nextOp === "write" ? "WRITE" : "READ",
      address,
      input: nextOp === "write" ? `0x${formatHex(value, hexDigits(dataBits))}` : "—",
      output: `0x${formatHex(value, hexDigits(dataBits))}`,
      status: "Complete",
    };
    setLog((rows) => [row, ...rows].slice(0, 8));
    setTick((valueId) => valueId + 1);
    setDataText(formatHex(value, hexDigits(dataBits)));
    setDataError("");
  }

  function advance() {
    setStage((current) => Math.min(steps.length - 1, current < 0 ? 0 : current + 1));
  }

  function begin(nextOp: "read" | "write") {
    const addressCheck = validateAddress(addressText, addressBits);
    const dataCheck = validateData(dataText, dataBits);
    setAddrError(addressCheck.ok ? "" : addressCheck.error);
    setDataError(nextOp === "write" && !dataCheck.ok ? dataCheck.error : "");
    if (!addressCheck.ok || (nextOp === "write" && !dataCheck.ok)) return;
    setAddress(addressCheck.value);
    setOp(nextOp);
    setRunId((value) => value + 1);
    setStage(0);
    setPlaying(false);
  }

  function reset() {
    setAddressBits(6);
    setDataBits(8);
    setLatency(1);
    setCustom("A5");
    setCells(preloadCells("program", 64, 8));
    setPreload("program");
    setAddress(0x12);
    setAddressText("12");
    setDataText("A5");
    setAddrError("");
    setDataError("");
    setView("byte");
    setEndian("little");
    setOp("read");
    setStage(-1);
    setPlaying(false);
    setSpeed(1);
    setRegionId("vars");
    setLog([]);
    setTick(1);
  }

  function selectAddress(index: number) {
    setAddress(index);
    setAddressText(formatHex(index, hexDigits(addressBits)));
    setAddrError("");
    setStage(-1);
    setPlaying(false);
    const hit = regionFor(index);
    if (hit) setRegionId(hit.id);
  }

  const wordPairs = view === "word" && dataBits === 8;
  const columns = words >= 8 ? 8 : words;

  return (
    <div ref={scope}>
      <LabGuide
        aim="See one address select one cell, then watch a byte move on the data bus."
        concept="An n-bit address names 2ⁿ locations. CE, OE, and WE decide whether that location is read or written."
        change={["Address and data", "Read or write", "Byte or word view", "Endianness", "Address width", "Preload"]}
        steps={["Set address 0x12.", "Press Read and Step through the six stages.", "Change the data byte and Write.", "Click a memory-map region."]}
        observe={PROMPTS}
        formula="Addresses = 2^(address bits). Capacity = locations × bits per location."
      />
      <div className="memx-lab">
        <section className="lgx-card memx-cpu" data-flow="mar">
          <h3>CPU</h3>
          <p className="tiny">MAR · address bus ({addressBits} bits)</p>
          <div className="memx-bits">
            {addrBinary.split("").map((bit, index) => (
              <BitButton key={`a${index}`} bit={bit} label={`A${addressBits - 1 - index}`} title={`Address bit A${addressBits - 1 - index}`} onClick={() => {
                const next = address ^ (1 << (addressBits - 1 - index));
                selectAddress(next);
              }} />
            ))}
          </div>
          <p className="memx-hex">0x{formatHex(address, hexDigits(addressBits))} · {addrBinary}</p>
          <div className={stage >= 0 && steps[stage]?.part === "decoder" ? "memx-decoder on" : "memx-decoder"} data-flow="decoder">
            {addressBits}-to-{words}<b>decoder</b><span>{stage >= 1 ? `Y${address}` : "idle"}</span>
          </div>
          <p className="tiny">MDR · data bus ({dataBits} bits)</p>
          <div className="memx-bits" data-flow="mdr">
            {dataBinary.split("").map((bit, index) => (
              <BitButton key={`d${index}`} bit={bit} label={`D${dataBits - 1 - index}`} title={`Data bit D${dataBits - 1 - index}`} onClick={() => {
                const next = shown ^ (1 << (dataBits - 1 - index));
                setDataText(formatHex(next, hexDigits(dataBits)));
                setDataError("");
              }} />
            ))}
          </div>
          <p className="memx-hex" data-flow="dbus">0x{formatHex(shown, hexDigits(dataBits))} · {dataBinary}</p>
          <div className="memx-controls">
            <Field label="Address">
              <input aria-label="Address hex" value={addressText} onChange={(event) => {
                const text = event.target.value.toUpperCase();
                setAddressText(text);
                const check = validateAddress(text, addressBits);
                setAddrError(check.ok ? "" : check.error);
                if (check.ok) setAddress(check.value);
              }} />
            </Field>
            <Field label="Data">
              <input aria-label="Data hex" value={dataText} onChange={(event) => {
                const text = event.target.value.toUpperCase();
                setDataText(text);
                const check = validateData(text, dataBits);
                setDataError(check.ok ? "" : check.error);
              }} />
            </Field>
          </div>
          {addrError ? <p className="memx-error">{addrError}</p> : null}
          {dataError ? <p className="memx-error">{dataError}</p> : null}
          <div className="memx-controls">
            <button className="memx-read" type="button" onClick={() => begin("read")}>Read</button>
            <button className="memx-write" type="button" onClick={() => begin("write")}>Write</button>
            <button className="fsmx-icon" type="button" onClick={() => { if (stage < 0) begin(op); else advance(); }}>Step</button>
            <button className="fsmx-icon" type="button" onClick={() => { if (stage < 0) begin(op); setPlaying((value) => !value); }}>{playing ? "Pause" : "Auto"}</button>
            <button className="fsmx-icon" type="button" onClick={reset}>Reset</button>
          </div>
          <div className="memx-controls">
            <Field label="Preload">
              <select aria-label="Preload pattern" value={preload} onChange={(event) => load(event.target.value as PreloadKind)}>
                <option value="zero">Zero Filled</option>
                <option value="increment">Incrementing</option>
                <option value="random">Random</option>
                <option value="alternate">Alternating AA/55</option>
                <option value="ascii">ASCII Sample</option>
                <option value="program">Program/Data Example</option>
                <option value="custom">Custom Pattern</option>
              </select>
            </Field>
            <Field label="Speed">
              <select aria-label="Animation speed" value={String(speed)} onChange={(event) => setSpeed(Number(event.target.value))}>
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
            </Field>
          </div>
          {preload === "custom" ? (
            <Field label="Custom byte">
              <input aria-label="Custom pattern" value={custom} onChange={(event) => { setCustom(event.target.value.toUpperCase()); load("custom", addressBits, dataBits, event.target.value.toUpperCase()); }} />
            </Field>
          ) : null}
        </section>

        <section className="lgx-card memx-array">
          <div className="lgx-card-bar">
            <h3>Memory Array ({columns === 8 ? `${Math.ceil(words / 8)} × 8` : `${words} × 1`})</h3>
            <div className="fsmx-quick">
              <button type="button" className={view === "byte" ? "on" : ""} onClick={() => setView("byte")}>Byte View</button>
              <button type="button" className={view === "word" ? "on" : ""} onClick={() => setView("word")}>Word View</button>
            </div>
          </div>
          {wordPairs ? (
            <div className="fsmx-quick">
              <button type="button" className={endian === "little" ? "on" : ""} onClick={() => setEndian("little")}>Little Endian</button>
              <button type="button" className={endian === "big" ? "on" : ""} onClick={() => setEndian("big")}>Big Endian</button>
            </div>
          ) : null}
          <div className="memx-cells" style={{ gridTemplateColumns: `repeat(${wordPairs ? Math.max(1, columns / 2) : columns}, minmax(0, 1fr))` }} data-flow="cell">
            {wordPairs ? cells.reduce<number[]>((pairs, _cell, index) => (index % 2 === 0 ? [...pairs, index] : pairs), []).map((index) => {
              const low = cells[index] ?? 0;
              const high = cells[index + 1] ?? 0;
              const word = combineWord(low, high, endian);
              const on = address === index || address === index + 1;
              return (
                <button key={index} type="button" className={on ? "mem-cell on" : "mem-cell"} ref={(node) => { cellsRef.current[index] = node; }} onClick={() => selectAddress(index)}>
                  <small>0x{formatHex(index, 2)}</small>{formatHex(word, 4)}
                </button>
              );
            }) : cells.map((cell, index) => {
              const inRegion = activeRegion && addressBits === 6 && index >= activeRegion.start && index <= activeRegion.end;
              return (
                <button key={index} type="button" ref={(node) => { cellsRef.current[index] = node; }} className={index === address ? "mem-cell on" : inRegion ? "mem-cell region" : "mem-cell"} aria-current={index === address ? "true" : undefined} onClick={() => selectAddress(index)}>
                  {formatHex(cell, hexDigits(dataBits))}
                </button>
              );
            })}
          </div>
          {wordPairs ? (
            <p className="tiny">Byte 0x{formatHex(address & ~1, 2)} and byte 0x{formatHex((address & ~1) + 1, 2)} form 0x{formatHex(combineWord(cells[address & ~1] ?? 0, cells[(address & ~1) + 1] ?? 0, endian), 4)}. A word address steps by 2.</p>
          ) : <p className="tiny">Each location is one {dataBits}-bit value. The next address is +1.</p>}
          <p className="tiny">{PROMPTS[addressBits === 6 ? (address & 1) : 0]}</p>
        </section>

        <div className="memx-side">
          <section className="lgx-card">
            <h3>Memory Details</h3>
            <p><span>Selected Address</span><b>0x{formatHex(address, hexDigits(addressBits))}</b></p>
            <p><span>Address Binary</span><b className="mono">{addrBinary}</b></p>
            <p><span>Stored Value</span><b>0x{formatHex(stored, hexDigits(dataBits))}</b></p>
            <p><span>Data Binary</span><b className="mono">{dataBinary}</b></p>
            <p><span>Decimal</span><b>{shown}</b></p>
            <p><span>Region</span><b>{region?.name ?? "Outside the 64-byte map"}</b></p>
            <p><span>Operation</span><b>{stage < 0 ? "Idle" : op === "read" ? "Read" : "Write"}</b></p>
          </section>
          <section className="lgx-card">
            <h3>Memory Map</h3>
            {MAP_REGIONS.map((item) => (
              <button key={item.id} type="button" className={regionId === item.id ? "memx-map on" : "memx-map"} onClick={() => {
                setRegionId(item.id);
                if (addressBits === 6) selectAddress(item.start);
                cellsRef.current[item.start]?.scrollIntoView({ block: "nearest" });
              }}>
                <b>0x{formatHex(item.start, 2)}–0x{formatHex(item.end, 2)}</b>
                <span>{item.name}</span>
                <small>{item.end - item.start + 1} bytes · {item.note}</small>
              </button>
            ))}
          </section>
          <section className="lgx-card memx-cycle">
            <div className="lgx-card-bar">
              <h3>{op === "read" ? "Read" : "Write"} Cycle</h3>
              <div className="fsmx-quick">
                <button type="button" className={op === "read" ? "on" : ""} onClick={() => { setOp("read"); setStage(-1); setPlaying(false); }}>Read</button>
                <button type="button" className={op === "write" ? "on" : ""} onClick={() => { setOp("write"); setStage(-1); setPlaying(false); }}>Write</button>
              </div>
            </div>
            <ol className="memx-steps">
              {steps.map((step, index) => (
                <li key={step.id} className={index === stage ? "on" : ""}>
                  <button type="button" onClick={() => setStage(index)}>{step.title}</button>
                </li>
              ))}
            </ol>
            <Wave steps={steps} cursor={Math.max(0, stage)} onCursor={(index) => setStage(index)} />
            <p className="tiny">{steps[stage]?.explain ?? "Press Read or Write, then Step."}</p>
          </section>
        </div>
      </div>
      <div className="memx-lower">
        <details className="lgx-card" open={false}>
          <summary>Memory Configuration</summary>
          <div className="memx-controls">
            <Field label="Address width">
              <select aria-label="Address width" value={addressBits} onChange={(event) => { const bits = Number(event.target.value); setAddressBits(bits); load(preload, bits, dataBits); }}>
                {[4, 5, 6, 8].map((bits) => <option key={bits} value={bits}>{bits}-bit · {addressCount(bits)} addresses</option>)}
              </select>
            </Field>
            <Field label="Data width">
              <select aria-label="Data width" value={dataBits} onChange={(event) => { const bits = Number(event.target.value); setDataBits(bits); load(preload, addressBits, bits); }}>
                {[4, 8, 16].map((bits) => <option key={bits} value={bits}>{bits}-bit</option>)}
              </select>
            </Field>
            <Field label="Access latency">
              <select aria-label="Access latency" value={latency} onChange={(event) => setLatency(Number(event.target.value))}>
                {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}× step</option>)}
              </select>
            </Field>
          </div>
          <p className="tiny">{words} locations × {dataBits} bits = {words * dataBits} bits ({(words * dataBits) / 8} bytes).</p>
        </details>
        <section className="lgx-card">
          <div className="lgx-card-bar"><h3>Operation Log</h3><button type="button" className="fsmx-icon" onClick={() => setLog([])}>Clear</button></div>
          <table className="data memx-log">
            <thead><tr><th>Cycle</th><th>Op</th><th>Address</th><th>Input</th><th>Output</th><th>Status</th></tr></thead>
            <tbody>
              {log.length === 0 ? <tr><td colSpan={6}>No cycle yet.</td></tr> : log.map((row) => (
                <tr key={row.id}><td colSpan={6}><button type="button" onClick={() => selectAddress(row.address)}>#{row.id} · {row.op} · 0x{formatHex(row.address, hexDigits(addressBits))} · {row.input} · {row.output} · {row.status}</button></td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Wave({ steps, cursor, onCursor }: { steps: Array<{ signal: string }>; cursor: number; onCursor: (index: number) => void }) {
  const names = [...new Set(steps.map((step) => step.signal))];
  return (
    <svg className="memx-wave" viewBox="0 0 320 110" role="img" aria-label="Timing diagram">
      {names.map((name, row) => {
        const first = steps.findIndex((step) => step.signal === name);
        const y = 18 + row * 24;
        const x = 78 + Math.max(0, first) * 36;
        return (
          <g key={name}>
            <text x="4" y={y} fontSize="10">{name}</text>
            <path d={`M 70 ${y} H ${x} V ${y - 10} H 300`} fill="none" stroke="#2563eb" strokeWidth="2" />
            {steps.map((step, index) => step.signal === name ? (
              <rect key={step.signal + index} x={78 + index * 36} y={y - 16} width="34" height="20" fill="transparent" onClick={() => onCursor(index)} />
            ) : null)}
          </g>
        );
      })}
      <line x1={86 + cursor * 36} y1="4" x2={86 + cursor * 36} y2="104" stroke="#d97706" strokeWidth="2" />
    </svg>
  );
}
