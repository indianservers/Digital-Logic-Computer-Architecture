import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { VM_LESSONS } from "../../data/studioLessons";
import { reducedMotion } from "../aca/animation/acaMotion";
import {
  blankPte,
  calculatePageSize,
  combinePhysicalAddress,
  demoPageTable,
  demoTwoLevel,
  emptyTlb,
  formatBinary,
  formatHex,
  handleFault,
  insertTLBEntry,
  pageTableBytes,
  parseHexAddress,
  protectionCheck,
  randomPageTable,
  REGIONS,
  regionAt,
  splitTwoLevelFields,
  splitVirtualAddress,
  tlbGeometry,
  translateAddress,
  walkTwoLevelPageTable,
  type AccessKind,
  type LabPte,
  type LabTlbEntry,
  type LabTranslation,
  type Privilege,
  type TlbAssoc,
  type TlbPolicy,
  type TwoLevelMachine,
} from "../../engines/arch/vmLab";
import { saveRecord } from "../../store/projects";

const QUOTES: Record<string, string> = {
  translate: "“Memory gives a program the illusion of a large, private address space.” — Andrew S. Tanenbaum",
  table: "“Memory gives a program the illusion of a large, private address space.” — Andrew S. Tanenbaum",
  tlb: "“Make it work, make it right, make it fast.” — Kent Beck",
  levels: "“Simplicity is the ultimate sophistication.” — Leonardo da Vinci",
  protect: "“Security is not a product, but a process.” — Bruce Schneier",
};

function Guide({ id }: { id: keyof typeof VM_LESSONS }) {
  const lesson = VM_LESSONS[id];
  if (!lesson) return null;
  return (
    <aside className="vmx-side">
      <section>
        <h2>Studio Guide</h2>
        <ol>
          {lesson.guide.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>
      <section>
        <h2>Key Takeaways</h2>
        <ul>
          {lesson.takeaways.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <p className="vmx-quote">{QUOTES[id]}</p>
    </aside>
  );
}

function ExplainNote({ on, text }: { on: boolean; text: string }) {
  if (!on) return null;
  return <p className="vmx-explain">{text}</p>;
}

function Bits({ address, addressBits, offsetBits }: { address: number; addressBits: number; offsetBits: number }) {
  const text = formatBinary(address, addressBits);
  const vpnWidth = Math.max(0, addressBits - offsetBits);
  return (
    <div className="vmx-bits" key={`${address}-${offsetBits}`}>
      {text.split("").map((bit, index) => (
        <span key={`${bit}-${index}`} className={index < vpnWidth ? "vpn" : "off"}>{bit}</span>
      ))}
    </div>
  );
}

function clock(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const TRANSLATE_PRESETS = ["0x0042", "0x1F3A", "0x6783", "0xABCD"];

function translatePte(vpn: number): LabPte {
  const known: Record<number, { frame: number; write: boolean }> = {
    0x00: { frame: 0x01, write: true },
    0x1f: { frame: 0x0a, write: false },
    0x67: { frame: 0x03, write: true },
  };
  const hit = known[vpn];
  if (!hit) return blankPte(vpn);
  return { ...blankPte(vpn), valid: true, frame: hit.frame, read: true, write: hit.write, referenced: true, user: true };
}

function freshTranslateTlb(): LabTlbEntry[] {
  const geometry = tlbGeometry(4, "full");
  return insertTLBEntry(emptyTlb(geometry), 0x67, 0x03, 1, geometry, "lru", 1, false, { read: true, write: true, execute: false, user: true }).tlb;
}

export function TranslatePanel({ explain }: { explain: boolean }) {
  const [text, setText] = useState("0x6783");
  const [offsetBits, setOffsetBits] = useState(8);
  const [access, setAccess] = useState<AccessKind>("read");
  const [tlb, setTlb] = useState(freshTranslateTlb);
  const [result, setResult] = useState<LabTranslation | null>(null);
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [log, setLog] = useState<Array<{ time: string; text: string; va: string; access: string; vpn: string; tlb: string; pfn: string; pa: string; result: string }>>([]);
  const [pickedFrame, setPickedFrame] = useState<number | null>(0x03);
  const pathRef = useRef<HTMLDivElement>(null);
  const parsed = parseHexAddress(text, 16);
  const address = parsed.ok ? parsed.value : 0;
  const parts = splitVirtualAddress(address, offsetBits, 16);
  const page = calculatePageSize(offsetBits);
  const geometry = tlbGeometry(4, "full");

  useGSAP(() => {
    if (!pathRef.current || reducedMotion()) return;
    gsap.fromTo(pathRef.current.querySelectorAll(".on"), { y: 4, opacity: 0.6 }, { y: 0, opacity: 1, duration: 0.28, stagger: 0.06 });
  }, { dependencies: [stage, result?.status], scope: pathRef });

  useEffect(() => {
    if (running && stage >= 5) setRunning(false);
  }, [running, stage]);

  useEffect(() => {
    if (!running || !result || stage >= 5) return undefined;
    const timer = window.setInterval(() => setStage((value) => (value >= 5 ? 5 : value + 1)), Math.round(420 / speed));
    return () => window.clearInterval(timer);
  }, [running, result, speed, stage]);

  function translate() {
    if (!parsed.ok) return;
    const table = [translatePte(parts.vpn)];
    const next = translateAddress({
      virtualAddress: parsed.value, offsetBits, addressBits: 16, table, tlb, geometry, policy: "lru", asid: 1, access, seed: 1,
    });
    setTlb(next.tlb);
    setResult(next);
    setStage(0);
    setRunning(true);
    if (next.pfn !== null) setPickedFrame(next.pfn);
    setLog((rows) => [{
      time: clock(),
      text: `${access === "write" ? "Write" : "Read"} ${formatHex(parsed.value, 4)}`,
      va: formatHex(parsed.value, 4),
      access: access === "write" ? "Write" : "Read",
      vpn: formatHex(next.vpn),
      tlb: next.tlbHit ? "Hit" : "Miss",
      pfn: next.pfn === null ? "—" : formatHex(next.pfn),
      pa: next.physical === null ? "—" : formatHex(next.physical),
      result: next.pageFault ? "Page fault" : next.protectionFault ? "Protection fault" : next.status === "tlb-hit" ? "TLB hit" : "Translated",
    }, ...rows].slice(0, 8));
  }

  const frames = Array.from({ length: 32 }, (_, frame) => frame);
  const mapped = new Set([0x01, 0x03, 0x0a]);
  const stages = [
    { title: "CPU", text: parsed.ok ? formatHex(address, 4) : "—" },
    { title: "TLB Lookup", text: `VPN ${formatHex(parts.vpn)}` },
    { title: "Page Table", text: result?.tlbHit ? "Skipped" : "Lookup" },
    { title: "Frame", text: result?.pfn === null || result?.pfn === undefined ? "—" : formatHex(result.pfn) },
    { title: "Physical Address", text: result?.physical === null || result?.physical === undefined ? "—" : formatHex(result.physical) },
    { title: "RAM", text: result?.pageFault ? "Fault" : "Access" },
  ];

  return (
    <div className="vmx-grid">
      <div className="vmx-main">
        <section className="vmx-intro">
          <h1>Virtual Address Translation</h1>
          <p>A virtual address is split into a virtual page number (VPN) and an offset. The VPN is translated, through the TLB and page table, to a physical frame number (PFN). The offset is copied into the physical address.</p>
          <ExplainNote on={explain} text="What changed is the VPN-to-frame lookup. Why: the offset selects a byte inside the page and is not translated. Notice which stage stops on a miss or a fault." />
        </section>
        <section className="vmx-card">
          <header><h2>Virtual Address</h2><label>Offset bits <select aria-label="Offset bits" value={offsetBits} onChange={(event) => setOffsetBits(Number(event.target.value))}>{[4, 6, 8, 10, 12].map((bits) => <option key={bits} value={bits}>{bits} (page size {calculatePageSize(bits)} B)</option>)}</select></label></header>
          <div className="vmx-va">
            <label>Virtual address (hex)<input aria-label="Virtual address hex" value={text} onChange={(event) => setText(event.target.value)} /></label>
            <div className="vmx-presets">
              <span>Presets</span>
              {TRANSLATE_PRESETS.map((preset) => <button key={preset} type="button" className={text.toLowerCase() === preset.toLowerCase() ? "on" : ""} onClick={() => setText(preset)}>{preset}</button>)}
            </div>
          </div>
          <p className="vmx-hint">{`Page size = 2^${offsetBits} = ${page} bytes. Decimal ${parsed.ok ? address : "—"}. ${parsed.ok ? "" : parsed.error}`}</p>
          <p className="vmx-kicker">Binary representation ({16} bits)</p>
          <Bits address={parsed.ok ? address : 0} addressBits={16} offsetBits={offsetBits} />
          <p className="vmx-split"><span>VPN ({parts.vpnBits} bits) {formatHex(parts.vpn)} ({parts.vpn})</span><span>Offset ({offsetBits} bits) {formatHex(parts.offset)} ({parts.offset})</span></p>
          <div className="vmx-actions">
            <button type="button" className={access === "read" ? "on" : ""} onClick={() => setAccess("read")}>Read</button>
            <button type="button" className={access === "write" ? "on" : ""} onClick={() => setAccess("write")}>Write</button>
            <button type="button" className="primary" onClick={translate}>Translate</button>
            <button type="button" onClick={() => { setTlb(freshTranslateTlb()); setResult(null); setStage(0); setRunning(false); setLog([]); setText("0x6783"); setOffsetBits(8); setAccess("read"); }}>Reset</button>
            <button type="button" onClick={() => void saveRecord({ id: "vm-translate", kind: "arch", name: "Virtual memory translate", data: JSON.stringify({ text, offsetBits, access }), updated: Date.now() })}>Save</button>
          </div>
        </section>
        <section className="vmx-card" ref={pathRef}>
          <header><h2>Translation Path</h2><div className="vmx-transport"><button type="button" onClick={() => setStage((value) => Math.min(5, value + 1))}>Step</button><button type="button" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Run"}</button><label>Speed <select aria-label="Animation speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label></div></header>
          <div className="vmx-path">
            {stages.map((item, index) => <article key={item.title} className={result && index <= stage ? "on" : ""} data-tone={result?.pageFault && index >= 3 ? "fault" : result?.tlbHit && index === 2 ? "miss" : "ok"}><b>{index + 1}. {item.title}</b><span>{item.text}</span></article>)}
          </div>
        </section>
        <div className="vmx-three">
          <section className="vmx-card">
            <h2>Translation Result</h2>
            <dl>
              <div><dt>VPN</dt><dd>{formatHex(parts.vpn)} ({parts.vpn})</dd></div>
              <div><dt>Offset</dt><dd>{formatHex(parts.offset)} ({parts.offset})</dd></div>
              <div><dt>TLB result</dt><dd>{result ? (result.tlbHit ? "Hit" : "Miss") : "—"}</dd></div>
              <div><dt>Page table</dt><dd>{result ? (result.pageFault ? "Invalid" : result.tlbHit ? "Not walked" : "Valid") : "—"}</dd></div>
              <div><dt>Frame (PFN)</dt><dd>{result?.pfn === null || result?.pfn === undefined ? "—" : `${formatHex(result.pfn)} (${result.pfn})`}</dd></div>
              <div><dt>Access</dt><dd>{access === "write" ? "Write" : "Read"}</dd></div>
              <div><dt>Physical address</dt><dd>{result?.physical === null || result?.physical === undefined ? "—" : formatHex(result.physical)}</dd></div>
              <div><dt>Status</dt><dd>{result ? result.note : "Waiting"}</dd></div>
            </dl>
            <p className="vmx-live" role="status">{result ? result.note : "Translate an address to fill this card."}</p>
          </section>
          <section className="vmx-card">
            <h2>Physical Memory (Frames)</h2>
            <p className="vmx-legend"><i className="mapped" /> Mapped <i className="selected" /> Selected <i /> Free</p>
            <div className="vmx-frames">
              {frames.map((frame) => (
                <button key={frame} type="button" className={`${mapped.has(frame) ? "mapped" : ""} ${pickedFrame === frame ? "selected" : ""}`} aria-label={`Frame ${formatHex(frame)}`} onClick={() => setPickedFrame(frame)}>
                  {formatHex(frame).slice(2)}
                </button>
              ))}
            </div>
            <p className="vmx-hint">{pickedFrame === null ? "Click a frame." : `Frame ${formatHex(pickedFrame)} · ${mapped.has(pickedFrame) ? "mapped in this lab" : "free"}`}</p>
          </section>
          <section className="vmx-card">
            <header><h2>Access Log</h2><button type="button" onClick={() => setLog([])}>Clear</button></header>
            <div className="vmx-scroll">
              <table className="vmx-table">
                <thead><tr><th>Time</th><th>VA</th><th>Access</th><th>VPN</th><th>TLB</th><th>PFN</th><th>PA</th><th>Result</th></tr></thead>
                <tbody>
                  {log.length === 0 ? <tr><td colSpan={8}>No accesses yet.</td></tr> : log.map((row, index) => (
                    <tr key={`${row.time}-${index}`} onClick={() => setText(row.va)} className={row.result.includes("fault") ? "bad" : "good"}><td>{row.time}</td><td>{row.va}</td><td>{row.access}</td><td>{row.vpn}</td><td>{row.tlb}</td><td>{row.pfn}</td><td>{row.pa}</td><td>{row.result}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      <Guide id="translate" />
    </div>
  );
}

export function PageTablePanel({ explain }: { explain: boolean }) {
  const [address, setAddress] = useState(103);
  const [pages, setPages] = useState(8);
  const [frames, setFrames] = useState(4);
  const [pageBytes, setPageBytes] = useState(16);
  const [seed, setSeed] = useState(1);
  const [table, setTable] = useState<LabPte[]>(demoPageTable);
  const [selected, setSelected] = useState(6);
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [faultNote, setFaultNote] = useState("");
  const focus = Math.floor(address / pageBytes);
  const inRange = focus >= 0 && focus < pages;
  const entry = inRange ? table.find((row) => row.vpn === focus) ?? null : null;

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setStage((value) => (value >= 2 ? 2 : value + 1)), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  function rebuild(nextPages: number, nextFrames: number, nextBytes: number, nextSeed: number, useDemo: boolean) {
    setPages(nextPages);
    setFrames(nextFrames);
    setPageBytes(nextBytes);
    setSeed(nextSeed);
    setTable(useDemo && nextPages === 8 && nextFrames === 4 && nextBytes === 16 ? demoPageTable() : randomPageTable(nextPages, nextFrames, nextSeed).table);
    setFaultNote("");
  }

  function lookup() {
    const nextVpn = Math.floor(address / pageBytes);
    setSelected(nextVpn);
    setStage(0);
    setRunning(true);
    const row = table.find((item) => item.vpn === nextVpn);
    setFaultNote(!row || nextVpn >= pages ? "This VPN is outside the configured table." : row.valid ? "" : "PAGE FAULT. The virtual page exists in the table, but it is not resident.");
  }

  const physical = entry?.valid ? combinePhysicalAddress(entry.frame, address % pageBytes, Math.round(Math.log2(pageBytes))) : null;
  const steps = [
    `Split ${address} into VPN ${Math.floor(address / pageBytes)} and offset ${address % pageBytes} with page size ${pageBytes}.`,
    `Index PTE[${Math.floor(address / pageBytes)}].`,
    entry?.valid ? `Valid. Frame ${entry.frame} + offset ${address % pageBytes} = ${physical} (${formatHex(physical ?? 0)}).` : "The valid bit is 0, so translation stops with a page fault.",
  ];

  return (
    <div className="vmx-grid">
      <div className="vmx-main">
        <section className="vmx-intro">
          <h1>Page Table Mapping</h1>
          <p>A page table maps each virtual page number to a physical frame. The valid bit says whether that page is resident. Dirty, referenced, and protection bits travel with the entry.</p>
          <ExplainNote on={explain} text="What changed is the selected PTE. Why: the VPN is the index. Notice a shared frame can be named by more than one valid VPN; the selected VPN is the one this lookup uses." />
        </section>
        <section className="vmx-card vmx-config">
          <label>Virtual address (decimal)<input aria-label="Virtual address decimal" type="number" min={0} value={address} onChange={(event) => setAddress(Number(event.target.value) || 0)} /></label>
          <label>Virtual pages<select aria-label="Virtual pages" value={pages} onChange={(event) => rebuild(Number(event.target.value), frames, pageBytes, seed, false)}>{[4, 8, 16].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          <label>Physical frames<select aria-label="Physical frames" value={frames} onChange={(event) => rebuild(pages, Number(event.target.value), pageBytes, seed, false)}>{[2, 4, 8].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          <label>Page size (bytes)<select aria-label="Page size" value={pageBytes} onChange={(event) => rebuild(pages, frames, Number(event.target.value), seed, false)}>{[16, 32, 64, 256, 4096].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          <div className="vmx-actions">
            <button type="button" className="primary" onClick={lookup}>Lookup</button>
            <button type="button" onClick={() => rebuild(8, 4, 16, 1, true)}>Clear</button>
            <button type="button" onClick={() => rebuild(pages, frames, pageBytes, seed + 1, false)}>Random</button>
            <button type="button" onClick={() => setStage((value) => Math.min(2, value + 1))}>Step</button>
            <button type="button" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Run"}</button>
          </div>
        </section>
        <div className="vmx-maps">
          <section className="vmx-card">
            <h2>Virtual Memory Pages</h2>
            <ul className="vmx-vpns">
              {table.map((row) => (
                <li key={row.vpn}>
                  <button type="button" className={row.vpn === (inRange ? focus : selected) ? "on" : ""} onClick={() => { setSelected(row.vpn); setAddress(row.vpn * pageBytes); }}>
                    <b>VPN {row.vpn}</b>
                    <span>{row.vpn * pageBytes}–{row.vpn * pageBytes + pageBytes - 1}</span>
                    <em>{row.valid ? "present" : "not present"}</em>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="vmx-card">
            <h2>Page Table</h2>
            <div className="vmx-scroll">
              <table className="vmx-table">
                <thead><tr><th>VPN</th><th>Valid</th><th>Frame</th><th>Dirty</th><th>Referenced</th><th>Protection</th></tr></thead>
                <tbody>
                  {table.map((row) => (
                    <tr key={row.vpn} className={row.vpn === (inRange ? focus : selected) ? "on" : ""} onClick={() => { setSelected(row.vpn); setAddress(row.vpn * pageBytes); }}>
                      <td>{row.vpn}</td>
                      <td>{row.valid ? "Yes" : "No"}</td>
                      <td>{row.valid ? row.frame : "—"}</td>
                      <td>{row.valid ? (row.dirty ? "D" : "—") : "—"}</td>
                      <td>{row.valid ? (row.referenced ? "R" : "—") : "—"}</td>
                      <td>{row.valid ? `${row.read ? "R" : "—"}${row.write ? " W" : ""}${row.execute ? " X" : ""}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {entry ? (
              <div className="vmx-actions">
                <button type="button" onClick={() => setTable(table.map((row) => row.vpn === entry.vpn ? { ...row, dirty: !row.dirty } : row))}>Toggle dirty</button>
                <button type="button" onClick={() => setTable(table.map((row) => row.vpn === entry.vpn ? { ...row, referenced: !row.referenced } : row))}>Toggle referenced</button>
                <button type="button" onClick={() => setTable(table.map((row) => row.vpn === entry.vpn ? { ...row, write: !row.write } : row))}>Toggle write</button>
              </div>
            ) : null}
          </section>
          <section className="vmx-card">
            <h2>Physical Memory Frames</h2>
            <ul className="vmx-vpns">
              {Array.from({ length: frames }, (_, frame) => {
                const owners = table.filter((row) => row.valid && row.frame === frame);
                const shown = owners.find((row) => row.vpn === selected) ?? owners[0];
                return (
                  <li key={frame}>
                    <button type="button" className={shown?.vpn === selected ? "on" : ""} onClick={() => { if (shown) { setSelected(shown.vpn); setAddress(shown.vpn * pageBytes); } }}>
                      <b>Frame {frame}</b>
                      <span>{frame * pageBytes}–{frame * pageBytes + pageBytes - 1}</span>
                      <em>{shown ? `VPN ${shown.vpn}` : "free"}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        <div className="vmx-three">
          <section className="vmx-card">
            <h2>Address Translation Breakdown</h2>
            <p>{address} = VPN {Math.floor(address / pageBytes)} × {pageBytes} + {address % pageBytes}</p>
            <p>{entry?.valid ? `${entry.frame} × ${pageBytes} + ${address % pageBytes} = ${physical} (${formatHex(physical ?? 0)})` : "No physical address while the page is invalid."}</p>
          </section>
          <section className={`vmx-card ${entry?.valid ? "good-card" : "bad-card"}`}>
            <h2>{entry?.valid ? "Lookup Result" : "Page Fault"}</h2>
            <p>{entry?.valid ? `PTE[${entry.vpn}] → frame ${entry.frame}. Physical address ${physical} (${formatHex(physical ?? 0)}).` : faultNote || "Select a VPN and click Lookup."}</p>
            {!entry?.valid && entry ? <button type="button" className="primary" onClick={() => { const fixed = handleFault(table, entry.vpn, frames); setTable(fixed.table); setFaultNote(fixed.replaced === null ? `Loaded VPN ${entry.vpn} into free frame ${fixed.frame}.` : `Replaced frame ${fixed.replaced} and loaded VPN ${entry.vpn}.`); }}>Handle Fault</button> : null}
          </section>
          <section className="vmx-card">
            <h2>Page-Table Lookup Steps</h2>
            <ol className="vmx-steps">
              {steps.map((step, index) => <li key={step} className={index <= stage ? "on" : ""}>{step}</li>)}
            </ol>
          </section>
        </div>
      </div>
      <Guide id="table" />
    </div>
  );
}

const TLB_FRAMES: Record<number, number> = { 0x40a: 0x1f3, 0x81: 0x387, 0x11: 0x2a1, 0x10f: 0xd04, 0xa9c: 0x4e2, 0x323: 0x2f0, 0x1: 0x10, 0x2: 0x11, 0x3: 0x12, 0x4: 0x13, 0x5: 0x14 };

function tlbPte(vpn: number, asid: number): LabPte {
  const frame = TLB_FRAMES[vpn];
  if (frame === undefined) return blankPte(vpn);
  return { ...blankPte(vpn), valid: true, frame: asid === 2 && vpn === 0x40a ? 0x222 : frame, read: true, write: true, user: true, referenced: true };
}

function seedTlb(entries: number, assoc: TlbAssoc): LabTlbEntry[] {
  const geometry = tlbGeometry(entries, assoc);
  let tlb = emptyTlb(geometry);
  let seed = 1;
  for (const [vpn, pfn] of [[0x40a, 0x1f3], [0x81, 0x387], [0x11, 0x2a1], [0xa9c, 0x4e2]] as const) {
    const placed = insertTLBEntry(tlb, vpn, pfn, 1, geometry, "lru", seed, false, { read: true, write: true, execute: false, user: true });
    tlb = placed.tlb;
    seed = placed.seed;
  }
  return tlb;
}

export function TlbPanel({ explain }: { explain: boolean }) {
  const [text, setText] = useState("0x0040A3F8");
  const [entries, setEntries] = useState(8);
  const [assoc, setAssoc] = useState<TlbAssoc>("2");
  const [policy, setPolicy] = useState<TlbPolicy>("lru");
  const [asid, setAsid] = useState(1);
  const [tlbCycles, setTlbCycles] = useState(1);
  const [walkCycles, setWalkCycles] = useState(100);
  const [seed, setSeed] = useState(1);
  const [tlb, setTlb] = useState(() => seedTlb(8, "2"));
  const [result, setResult] = useState<LabTranslation | null>(null);
  const [trace, setTrace] = useState<Array<{ n: number; time: string; va: string; asid: number; vpn: string; result: string; pfn: string; pa: string; cycles: number; note: string }>>([]);
  const geometry = tlbGeometry(entries, assoc);
  const parsed = parseHexAddress(text, 32);
  const flowRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!flowRef.current || reducedMotion() || !result) return;
    gsap.fromTo(flowRef.current.querySelectorAll(".hot"), { scale: 0.96 }, { scale: 1, duration: 0.3 });
  }, { dependencies: [result?.status, result?.note], scope: flowRef });

  function applyGeometry(nextEntries: number, nextAssoc: TlbAssoc) {
    setEntries(nextEntries);
    setAssoc(nextAssoc);
    setTlb(seedTlb(nextEntries, nextAssoc));
    setResult(null);
  }

  function run(value = parsed.ok ? parsed.value : null, process = asid, notePrefix = "") {
    if (value === null) return;
    const parts = splitVirtualAddress(value, 12, 32);
    const next = translateAddress({
      virtualAddress: value, offsetBits: 12, addressBits: 32, table: [tlbPte(parts.vpn, process)], tlb, geometry, policy, asid: process, access: "read", seed, tlbCycles, walkCycles,
    });
    setTlb(next.tlb);
    setSeed((current) => current + 1);
    setResult(next);
    setTrace((rows) => [{
      n: rows.length + 1,
      time: clock(),
      va: formatHex(value, 8),
      asid: process,
      vpn: formatHex(next.vpn),
      result: next.pageFault ? "Fault" : next.tlbHit ? "Hit" : "Miss",
      pfn: next.pfn === null ? "—" : formatHex(next.pfn),
      pa: next.physical === null ? "—" : formatHex(next.physical),
      cycles: next.cycles,
      note: `${notePrefix}${next.note}`,
    }, ...rows].slice(0, 8));
  }

  function thrash() {
    const geo = tlbGeometry(4, "full");
    setEntries(4);
    setAssoc("full");
    let current = emptyTlb(geo);
    let currentSeed = seed;
    const values = [0x1000, 0x2000, 0x3000, 0x4000, 0x5000, 0x1000];
    const rows = [...trace];
    values.forEach((value, index) => {
      const parts = splitVirtualAddress(value, 12, 32);
      const next = translateAddress({
        virtualAddress: value, offsetBits: 12, addressBits: 32, table: [tlbPte(parts.vpn, 1)], tlb: current, geometry: geo, policy, asid: 1, access: "read", seed: currentSeed, tlbCycles, walkCycles,
      });
      current = next.tlb;
      currentSeed += 1;
      rows.unshift({
        n: rows.length + 1, time: clock(), va: formatHex(value, 8), asid: 1, vpn: formatHex(next.vpn),
        result: next.tlbHit ? "Hit" : next.pageFault ? "Fault" : "Miss", pfn: next.pfn === null ? "—" : formatHex(next.pfn),
        pa: next.physical === null ? "—" : formatHex(next.physical), cycles: next.cycles, note: next.note,
      });
      if (index === values.length - 1) setResult(next);
    });
    setTlb(current);
    setSeed(currentSeed);
    setTrace(rows.slice(0, 8));
  }

  function playTrace(values: number[], processes: number[]) {
    let current = tlb;
    let currentSeed = seed;
    const rows = [...trace];
    values.forEach((value, index) => {
      const process = processes[index] ?? asid;
      const parts = splitVirtualAddress(value, 12, 32);
      const next = translateAddress({
        virtualAddress: value, offsetBits: 12, addressBits: 32, table: [tlbPte(parts.vpn, process)], tlb: current, geometry, policy, asid: process, access: "read", seed: currentSeed, tlbCycles, walkCycles,
      });
      current = next.tlb;
      currentSeed += 1;
      rows.unshift({
        n: rows.length + 1, time: clock(), va: formatHex(value, 8), asid: process, vpn: formatHex(next.vpn),
        result: next.pageFault ? "Fault" : next.tlbHit ? "Hit" : "Miss", pfn: next.pfn === null ? "—" : formatHex(next.pfn),
        pa: next.physical === null ? "—" : formatHex(next.physical), cycles: next.cycles, note: next.note,
      });
      if (index === values.length - 1) setResult(next);
    });
    setTlb(current);
    setSeed(currentSeed);
    setTrace(rows.slice(0, 8));
  }

  const hitWidth = Math.max(8, Math.round((tlbCycles / Math.max(tlbCycles, walkCycles)) * 100));
  const preview = Object.entries(TLB_FRAMES).slice(0, 4);

  return (
    <div className="vmx-grid">
      <div className="vmx-main">
        <section className="vmx-intro vmx-intro-split">
          <div>
            <h1>Translation Lookaside Buffer (TLB)</h1>
            <p>The TLB stores recent VPN → frame translations. A hit returns the frame without walking the page table. A miss walks the table, and a valid entry is installed under the replacement policy.</p>
          </div>
          <ExplainNote on={explain} text="What changed: the TLB cached a translation. Why: a page walk costs the walk assumption below. Notice the set index is VPN mod sets, and the tag match includes the ASID." />
        </section>
        <div className="vmx-tlb">
          <section className="vmx-card">
            <h2>TLB Configuration</h2>
            <label>Virtual address (hex)<input aria-label="TLB virtual address" value={text} onChange={(event) => setText(event.target.value)} /></label>
            <label>TLB size<select aria-label="TLB size" value={entries} onChange={(event) => applyGeometry(Number(event.target.value), assoc)}>{[2, 4, 8, 16].map((count) => <option key={count} value={count}>{count} entries</option>)}</select></label>
            <label>Associativity<select aria-label="Associativity" value={assoc} onChange={(event) => applyGeometry(entries, event.target.value as TlbAssoc)}><option value="full">Fully associative</option><option value="direct">Direct mapped</option><option value="2">2-way</option><option value="4">4-way</option></select></label>
            <label>Replacement<select aria-label="Replacement" value={policy} onChange={(event) => setPolicy(event.target.value as TlbPolicy)}><option value="lru">LRU</option><option value="fifo">FIFO</option><option value="random">Random</option></select></label>
            <label>ASID<input aria-label="ASID" type="number" min={0} value={asid} onChange={(event) => setAsid(Number(event.target.value) || 0)} /></label>
            <div className="vmx-actions">
              <button type="button" className="primary" onClick={() => run()}>Translate</button>
              <button type="button" onClick={() => { setTlb(emptyTlb(geometry)); setResult(null); }}>Clear</button>
              <button type="button" onClick={() => { const value = ((seed % 5) + 1) << 12; setText(formatHex(value, 8)); setSeed(seed + 1); run(value, asid); }}>Random</button>
            </div>
            <div className="vmx-actions">
              <button type="button" onClick={() => thrash()}>Try thrashing</button>
              <button type="button" onClick={() => playTrace([0x0040a3f8, 0x0040a3f8], [1, 2])}>Try ASID switch</button>
            </div>
          </section>
          <section className="vmx-card">
            <h2>TLB Contents ({geometry.entries} entries, {geometry.ways}-way, {geometry.sets} sets)</h2>
            <div className="vmx-scroll">
              <table className="vmx-table">
                <thead><tr><th>Entry</th><th>Set</th><th>VPN</th><th>Frame</th><th>Valid</th><th>ASID</th><th>Age</th></tr></thead>
                <tbody>
                  {tlb.map((entry, index) => (
                    <tr key={`${entry.set}-${entry.way}`} className={`${result && entry.set === result.set ? "set" : ""} ${result?.tlbHit && entry.set === result.set && entry.way === result.way ? "on" : ""} ${result?.victim === index ? "victim" : ""}`}>
                      <td>{index}</td><td>{entry.set}</td><td>{entry.valid ? formatHex(entry.vpn) : "—"}</td><td>{entry.valid ? formatHex(entry.pfn) : "—"}</td><td>{entry.valid ? "Yes" : "No"}</td><td>{entry.valid ? entry.asid : "—"}</td><td>{entry.valid ? entry.age : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="vmx-card" ref={flowRef}>
            <h2>Translation Flow</h2>
            <div className={`vmx-flow ${result?.tlbHit ? "hit" : "miss"}`}>
              <article className="hot">CPU<br />{parsed.ok ? formatHex(parsed.value, 8) : "—"}</article>
              <article className="hot">TLB<br />{result?.tlbHit ? "Hit" : result ? "Miss" : "Lookup"}</article>
              <article className={result?.tlbHit ? "" : "hot"}>Page table<br />{result?.tlbHit ? "Not used" : "Walk"}</article>
              <article className="hot">Memory<br />{result?.physical === null || result?.physical === undefined ? "—" : formatHex(result.physical)}</article>
            </div>
            <p className="vmx-live" role="status">{result ? `${result.note}. Cycles ${result.cycles} (assumption).` : "Translate to animate the path."}</p>
          </section>
        </div>
        <div className="vmx-three">
          <section className="vmx-card">
            <h2>Result {result ? (result.tlbHit ? "TLB HIT" : result.pageFault ? "PAGE FAULT" : "TLB MISS") : ""}</h2>
            <p>VA {parsed.ok ? formatHex(parsed.value, 8) : "—"} · VPN {parsed.ok ? formatHex(splitVirtualAddress(parsed.value, 12, 32).vpn) : "—"}</p>
            <p>Entry {result?.way === null || result?.way === undefined ? "—" : `set ${result.set}, way ${result.way}`} · Frame {result?.pfn === null || result?.pfn === undefined ? "—" : formatHex(result.pfn)}</p>
            <p>PA {result?.physical === null || result?.physical === undefined ? "—" : formatHex(result.physical)} · {result ? `${result.cycles} cycles` : "—"}</p>
          </section>
          <section className="vmx-card">
            <h2>Latency Comparison</h2>
            <label>TLB lookup cycles<input aria-label="TLB cycles" type="number" min={1} value={tlbCycles} onChange={(event) => setTlbCycles(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Page-walk cycles<input aria-label="Page walk cycles" type="number" min={1} value={walkCycles} onChange={(event) => setWalkCycles(Math.max(1, Number(event.target.value) || 1))} /></label>
            <div className="vmx-lat"><span>TLB hit</span><i style={{ width: `${hitWidth}%` }} /><b>{tlbCycles}</b></div>
            <div className="vmx-lat miss"><span>Page walk</span><i style={{ width: "100%" }} /><b>{walkCycles}</b></div>
            <p className="vmx-hint">These cycle counts are simulation assumptions, not a datasheet.</p>
          </section>
          <section className="vmx-card">
            <h2>Page Table Preview</h2>
            <table className="vmx-table">
              <thead><tr><th>VPN</th><th>Frame</th><th>Valid</th></tr></thead>
              <tbody>
                {preview.map(([vpn, frame]) => (
                  <tr key={vpn} onClick={() => setText(formatHex(Number(vpn) << 12, 8))}><td>{formatHex(Number(vpn))}</td><td>{formatHex(asid === 2 && Number(vpn) === 0x40a ? 0x222 : frame)}</td><td>Yes</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <section className="vmx-card">
          <h2>Access Trace</h2>
          <div className="vmx-scroll">
            <table className="vmx-table">
              <thead><tr><th>#</th><th>Time</th><th>VA</th><th>ASID</th><th>VPN</th><th>Result</th><th>PFN</th><th>PA</th><th>Cycles</th><th>Note</th></tr></thead>
              <tbody>
                {trace.length === 0 ? <tr><td colSpan={10}>No trace yet.</td></tr> : trace.map((row) => (
                  <tr key={`${row.n}-${row.va}`} className={row.result === "Hit" ? "good" : row.result === "Fault" ? "bad" : ""} onClick={() => { setText(row.va); setAsid(row.asid); }}><td>{row.n}</td><td>{row.time}</td><td>{row.va}</td><td>{row.asid}</td><td>{row.vpn}</td><td>{row.result}</td><td>{row.pfn}</td><td>{row.pa}</td><td>{row.cycles}</td><td>{row.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <Guide id="tlb" />
    </div>
  );
}

export function TwoLevelPanel({ explain }: { explain: boolean }) {
  const [dirBits, setDirBits] = useState(10);
  const [tableBits, setTableBits] = useState(10);
  const [offsetBits, setOffsetBits] = useState(12);
  const [text, setText] = useState("0x16CA300");
  const [machine, setMachine] = useState<TwoLevelMachine>(demoTwoLevel);
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [fraction, setFraction] = useState(0.08);
  const [seed, setSeed] = useState(3);
  const parsed = parseHexAddress(text, 32);
  const fields = parsed.ok ? splitTwoLevelFields(parsed.value, dirBits, tableBits, offsetBits) : { error: "Enter a hexadecimal address." };
  const sum = dirBits + tableBits + offsetBits;
  const walked = parsed.ok && !("error" in fields) ? walkTwoLevelPageTable(machine, parsed.value) : null;

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setStage((value) => (value >= 5 ? 5 : value + 1)), 450);
    return () => window.clearInterval(timer);
  }, [running]);

  function load(address: number, directory: number, table: number, offset: number) {
    const built = machineAround(address, directory, table, offset);
    setDirBits(directory);
    setTableBits(table);
    setOffsetBits(offset);
    setText(formatHex(address, 8));
    setMachine(built);
    setStage(0);
    setRunning(true);
  }

  const bits = parsed.ok ? formatBinary(parsed.value, 32) : formatBinary(0, 32);
  const savings = pageTableBytes(dirBits, tableBits, fraction);
  const steps = ["Split address into PDI, PTI, and offset.", "Read the page-directory entry.", "Locate the second-level table.", "Read the page-table entry.", "Obtain the frame number.", "Combine the frame with the offset."];

  return (
    <div className="vmx-grid">
      <div className="vmx-main">
        <section className="vmx-intro">
          <h1>Two-Level Page Table</h1>
          <p>The address splits into a page-directory index (PDI), a page-table index (PTI), and an offset. A second-level table is allocated only when its directory entry is present.</p>
          <ExplainNote on={explain} text="What changed is which directory and table indexes are live. Why: empty regions do not need a second-level table. Notice the offset is still copied, not translated." />
        </section>
        <section className="vmx-card">
          <h2>Virtual address breakdown · {sum} bits {sum === 32 ? "" : "(set the three fields so they sum to 32)"}</h2>
          <div className="vmx-fields">
            <span className="pdi">{bits.slice(0, dirBits) || "—"}<small>PDI {dirBits}</small></span>
            <span className="pti">{bits.slice(dirBits, dirBits + tableBits) || "—"}<small>PTI {tableBits}</small></span>
            <span className="off">{bits.slice(dirBits + tableBits, dirBits + tableBits + offsetBits) || "—"}<small>Offset {offsetBits}</small></span>
          </div>
          <div className="vmx-config">
            <label>Directory bits<input aria-label="Directory bits" type="number" min={1} max={16} value={dirBits} onChange={(event) => setDirBits(Number(event.target.value) || 1)} /></label>
            <label>Table bits<input aria-label="Table bits" type="number" min={1} max={16} value={tableBits} onChange={(event) => setTableBits(Number(event.target.value) || 1)} /></label>
            <label>Offset bits<input aria-label="Offset bits" type="number" min={1} max={16} value={offsetBits} onChange={(event) => setOffsetBits(Number(event.target.value) || 1)} /></label>
            <label>Example address<input aria-label="Two-level address" value={text} onChange={(event) => setText(event.target.value)} /></label>
            <div className="vmx-actions">
              <button type="button" onClick={() => load(0x16ca300, 10, 10, 12)}>Load Example</button>
              <button type="button" onClick={() => { const next = (seed * 1664525 + 1013904223) >>> 0; setSeed(next); load(next & 0x00ffffff, dirBits, tableBits, offsetBits); }}>Random</button>
              <button type="button" onClick={() => setStage((value) => Math.min(5, value + 1))}>Step</button>
              <button type="button" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Run"}</button>
              <button type="button" onClick={() => load(0x16ca300, 10, 10, 12)}>Reset</button>
            </div>
          </div>
        </section>
        <section className="vmx-card">
          <h2>Page walk</h2>
          <div className="vmx-path">
            {["CPU", "Page directory", "Second-level table", "Physical frame", "Physical address"].map((label, index) => (
              <article key={label} className={index <= Math.min(4, stage) ? "on" : ""}><b>{label}</b><span>{walkLabel(label, walked, parsed.ok ? parsed.value : 0)}</span></article>
            ))}
          </div>
        </section>
        <div className="vmx-three">
          <section className="vmx-card">
            <h2>Page directory</h2>
            <table className="vmx-table"><thead><tr><th>Index</th><th>Entry</th><th>Present</th><th>Points to</th></tr></thead><tbody>
              {machine.directory.map((row) => <tr key={row.index} className={walked && walked.pdi === row.index ? "on" : ""}><td>{formatHex(row.index)}</td><td>{row.present ? formatHex(row.tableBase) : "—"}</td><td>{row.present ? "Yes" : "No"}</td><td>{row.present ? "Page table" : "—"}</td></tr>)}
            </tbody></table>
          </section>
          <section className="vmx-card">
            <h2>Second-level page table</h2>
            <table className="vmx-table"><thead><tr><th>Index</th><th>Entry</th><th>Present</th><th>PFN</th></tr></thead><tbody>
              {(machine.tables.get(walked?.pde?.tableBase ?? 0x23f000) ?? []).map((row) => <tr key={row.index} className={walked && walked.pti === row.index ? "on" : ""}><td>{formatHex(row.index)}</td><td>{row.present ? formatHex(row.pfn) : "—"}</td><td>{row.present ? "Yes" : "No"}</td><td>{row.present ? formatHex(row.pfn) : "—"}</td></tr>)}
            </tbody></table>
          </section>
          <section className="vmx-card">
            <h2>Physical frame map</h2>
            <ul className="vmx-vpns">
              {[0x1a0, 0x1a1, 0x1a2, 0x1a3, 0x1a4, 0x1a5].map((frame) => <li key={frame}><span className={walked?.pfn === frame ? "on" : ""}>Frame {formatHex(frame)} · {walked?.pfn === frame ? "selected" : "free"}</span></li>)}
            </ul>
          </section>
        </div>
        <section className={`vmx-card ${walked?.status === "ok" ? "good-card" : "bad-card"}`}>
          <h2>Translation result</h2>
          <p role="status">{walked ? walked.note : "error" in fields ? fields.error : "Enter an address."}</p>
          <p>{walked?.status === "ok" ? `PA = (${formatHex(walked.pfn ?? 0)} << ${offsetBits}) | ${formatHex(walked.offset)} = ${formatHex(walked.physical ?? 0)} (${walked.physical})` : "No physical address."}</p>
        </section>
        <ol className="vmx-stepbar">
          {steps.map((step, index) => <li key={step} className={index <= stage ? "on" : ""}><b>{index + 1}</b>{step}</li>)}
        </ol>
        <section className="vmx-card">
          <h2>Memory savings</h2>
          <label>Allocated second-level tables {Math.round(fraction * 100)}%<input aria-label="Allocated fraction" type="range" min={0} max={100} value={Math.round(fraction * 100)} onChange={(event) => setFraction(Number(event.target.value) / 100)} /></label>
          <p>Single-level {savings.single.toLocaleString()} bytes · Two-level {savings.hierarchical.toLocaleString()} bytes at this occupancy. Unused second-level tables are not allocated.</p>
        </section>
      </div>
      <Guide id="levels" />
    </div>
  );
}

function machineAround(address: number, directoryBits: number, tableBits: number, offsetBits: number): TwoLevelMachine {
  const fields = splitTwoLevelFields(address, directoryBits, tableBits, offsetBits);
  if ("error" in fields) return demoTwoLevel();
  const directory = Array.from({ length: 5 }, (_, index) => {
    const at = fields.pdi - 2 + index;
    return { index: at, present: at === fields.pdi, tableBase: at === fields.pdi ? 0x23f000 : 0 };
  });
  const rows = Array.from({ length: 5 }, (_, index) => {
    const at = fields.pti - 2 + index;
    return { index: at, present: at === fields.pti, pfn: at === fields.pti ? 0x1a3 : 0, read: true, write: true, execute: false };
  });
  return { directoryBits, tableBits, offsetBits, directory, tables: new Map([[0x23f000, rows]]) };
}

function walkLabel(label: string, walked: ReturnType<typeof walkTwoLevelPageTable> | null, address: number): string {
  if (!walked) return "—";
  if (label === "CPU") return formatHex(address, 8);
  if (label === "Page directory") return formatHex(walked.pdi);
  if (label === "Second-level table") return formatHex(walked.pti);
  if (label === "Physical frame") return walked.pfn === null ? "Fault" : formatHex(walked.pfn);
  return walked.physical === null ? "Fault" : formatHex(walked.physical);
}

const PRESETS: Array<{ label: string; address: string; access: AccessKind; privilege: Privilege }> = [
  { label: "User read code", address: "0x00018000", access: "read", privilege: "user" },
  { label: "User write data", address: "0x00101000", access: "write", privilege: "user" },
  { label: "Execute code", address: "0x00001000", access: "exec", privilege: "user" },
  { label: "User → kernel", address: "0x00C01000", access: "read", privilege: "user" },
  { label: "Write read-only", address: "0x00001000", access: "write", privilege: "user" },
  { label: "Execute NX", address: "0x00101000", access: "exec", privilege: "user" },
  { label: "Read unmapped", address: "0x00E01000", access: "read", privilege: "user" },
];

export function ProtectPanel({ explain }: { explain: boolean }) {
  const [text, setText] = useState("0x00418000");
  const [access, setAccess] = useState<AccessKind>("read");
  const [privilege, setPrivilege] = useState<Privilege>("user");
  const [log, setLog] = useState<Array<{ time: string; va: string; access: string; mode: string; result: string; reason: string }>>([]);
  const parsed = parseHexAddress(text, 32);
  const address = parsed.ok ? parsed.value : 0;
  const parts = splitVirtualAddress(address, 12, 32);
  const outcome = parsed.ok ? protectionCheck(address, access, privilege) : null;
  const region = parsed.ok ? regionAt(address) : null;

  function commit(nextText = text, nextAccess = access, nextPrivilege = privilege) {
    const next = parseHexAddress(nextText, 32);
    if (!next.ok) return;
    const checked = protectionCheck(next.value, nextAccess, nextPrivilege);
    setLog((rows) => [{
      time: clock(),
      va: formatHex(next.value, 8),
      access: nextAccess === "exec" ? "Execute" : nextAccess === "write" ? "Write" : "Read",
      mode: nextPrivilege === "kernel" ? "Kernel" : "User",
      result: checked.status === "granted" ? "Access granted" : checked.status === "fault" ? "Page fault" : "Protection fault",
      reason: checked.reason,
    }, ...rows].slice(0, 8));
  }

  return (
    <div className="vmx-grid">
      <div className="vmx-main">
        <section className="vmx-intro">
          <h1>Memory Protection & Permissions</h1>
          <p>Each page has read, write, execute, and user/supervisor permission. The check order is presence, privilege, then the requested access. This map is an educational example, not a universal operating-system layout.</p>
          <ExplainNote on={explain} text="What to observe: a user access to a supervisor page stops at privilege. A write with W=0 stops at permission. An unmapped page never reaches those checks." />
        </section>
        <div className="vmx-protect">
          <section className="vmx-card">
            <label>Virtual address (hex)<input aria-label="Protection address" value={text} onChange={(event) => setText(event.target.value)} /></label>
            <p>VPN {formatHex(parts.vpn)} · offset {formatHex(parts.offset)}</p>
            <div className="vmx-actions" role="group" aria-label="Access type">
              {(["read", "write", "exec"] as const).map((kind) => <button key={kind} type="button" className={access === kind ? "on" : ""} onClick={() => { setAccess(kind); commit(text, kind, privilege); }}>{kind === "exec" ? "Execute" : kind === "write" ? "Write" : "Read"}</button>)}
            </div>
            <div className="vmx-actions" role="group" aria-label="Privilege">
              <button type="button" className={privilege === "user" ? "on" : ""} onClick={() => { setPrivilege("user"); commit(text, access, "user"); }}>User</button>
              <button type="button" className={privilege === "kernel" ? "on" : ""} onClick={() => { setPrivilege("kernel"); commit(text, access, "kernel"); }}>Kernel</button>
            </div>
            <div className="vmx-presets">
              {PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => { setText(preset.address); setAccess(preset.access); setPrivilege(preset.privilege); commit(preset.address, preset.access, preset.privilege); }}>{preset.label}</button>)}
            </div>
          </section>
          <section className="vmx-card">
            <h2>Memory region map</h2>
            <p className="vmx-hint">Educational example address map.</p>
            <div className="vmx-map">
              {[...REGIONS].reverse().map((item) => (
                <button key={item.id} type="button" className={`region ${item.id} ${region?.id === item.id ? "on" : ""}`} onClick={() => { const sample = formatHex(item.start + 0x1000, 8); setText(sample); }}>
                  <b>{item.name}</b>
                  <span>{formatHex(item.start, 8)}–{formatHex(item.end, 8)}</span>
                  <em>{item.role}</em>
                </button>
              ))}
            </div>
          </section>
        </div>
        <div className="vmx-three">
          <section className="vmx-card">
            <h2>Page table — selected region</h2>
            <table className="vmx-table">
              <thead><tr><th>Region</th><th>Valid</th><th>R</th><th>W</th><th>X</th><th>U/S</th><th>Frame</th></tr></thead>
              <tbody>
                {REGIONS.map((item) => (
                  <tr key={item.id} className={region?.id === item.id ? "on" : ""} onClick={() => setText(formatHex(item.start + 0x1000, 8))}>
                    <td>{item.name}</td><td>{item.present ? "Yes" : "No"}</td><td>{item.read ? "R" : "—"}</td><td>{item.write ? "W" : "—"}</td><td>{item.execute ? "X" : "—"}</td><td>{item.user ? "U" : "S"}</td><td>{item.present ? formatHex(item.frame) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="vmx-card">
            <h2>Access check flow</h2>
            <ol className="vmx-steps">
              <li className="on">Virtual address {parsed.ok ? formatHex(address, 8) : "invalid"}</li>
              <li className="on">Find PTE VPN {formatHex(parts.vpn)}</li>
              <li className={outcome && outcome.status !== "fault" ? "on" : ""}>Validate page {outcome?.pte.valid ? "present" : "not present"}</li>
              <li className={outcome?.status === "granted" || outcome?.status === "protection" || outcome?.status === "privilege" ? "on" : ""}>Privilege {privilege} {outcome?.status === "privilege" ? "denied" : outcome?.status === "fault" ? "not reached" : "checked"}</li>
              <li className={outcome?.status === "granted" || outcome?.status === "protection" ? "on" : ""}>Permission {access} {outcome?.status === "protection" ? "denied" : outcome?.status === "fault" || outcome?.status === "privilege" ? "not reached" : "checked"}</li>
              <li className={outcome?.status === "granted" ? "on" : ""}>{outcome?.status === "granted" ? `PA ${formatHex(outcome.physical ?? 0)}` : outcome?.status === "fault" ? "Page fault" : "Protection fault"}</li>
            </ol>
          </section>
          <section className={`vmx-card ${outcome?.status === "granted" ? "good-card" : "bad-card"}`}>
            <h2>{outcome?.status === "granted" ? "ACCESS GRANTED" : outcome?.status === "fault" ? "PAGE FAULT" : outcome ? "PROTECTION FAULT" : "—"}</h2>
            <p role="status">{parsed.ok ? outcome?.reason : parsed.error}</p>
            <p>{region ? `${region.name}: ${region.role}` : "No region."}</p>
            <p>{outcome?.physical !== null && outcome?.physical !== undefined ? `Physical address ${formatHex(outcome.physical)}` : ""}</p>
          </section>
        </div>
        <section className="vmx-card">
          <header><h2>Access log</h2><button type="button" onClick={() => setLog([])}>Clear log</button></header>
          <table className="vmx-table">
            <thead><tr><th>Time</th><th>Virtual address</th><th>Access</th><th>Mode</th><th>Result</th><th>Reason</th></tr></thead>
            <tbody>
              {log.length === 0 ? <tr><td colSpan={6}>No checks yet. Choose a preset or an access type.</td></tr> : log.map((row, index) => (
                <tr key={`${row.time}-${index}`} className={row.result === "Access granted" ? "good" : "bad"}><td>{row.time}</td><td>{row.va}</td><td>{row.access}</td><td>{row.mode}</td><td>{row.result}</td><td>{row.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <Guide id="protect" />
    </div>
  );
}
