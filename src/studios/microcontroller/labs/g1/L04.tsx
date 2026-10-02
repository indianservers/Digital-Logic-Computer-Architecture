import { useMemo } from "react";
import type { Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle, hex } from "../ui/Panels";
import { LabShell } from "../ui/Shell";

const DEMO = `// Demo: Harvard vs Von Neumann
// Simple program: read a value and increment it
#include <stdint.h>

int main(void) {
    volatile uint32_t *data = (uint32_t*)0x20000000;
    uint32_t value = *data;     // Read from data memory
    value = value + 1;          // Increment
    *data = value;              // Write back to data memory

    while (1) {
        // Loop forever
    }
}
`;
const LOOP = `// Demo: a busy loop that keeps both buses working
#include <stdint.h>

int main(void) {
    volatile uint32_t *data = (uint32_t*)0x20000000;
    volatile uint32_t *out = (uint32_t*)0x20000004;
    while (1) {
        uint32_t value = *data;  // data read
        value = value + 3;       // ALU only
        *out = value;            // data write
        *data = value;           // data write
    }
}
`;

type Op = "fetch" | "read" | "write";
interface Instr { asm: string; read: boolean; write: boolean; line: number; target?: number }
interface Slot { cycle: number; op: Op; instr: number }
interface Schedule { slots: Slot[]; cycles: number; stalls: number; overlap: number; instructions: number }

type P = { rate: number; wait: number; dma: boolean; mode: string };

/** Translate the straight-line C in main() into a Thumb-like instruction trace. */
export function compileTrace(src: string): Instr[] {
  const out: Instr[] = [];
  const regs = new Map<string, string>();
  const reg = (name: string) => { if (!regs.has(name)) regs.set(name, `R${regs.size}`); return regs.get(name)!; };
  const lines = src.split("\n");
  const start = lines.findIndex((l) => /\bmain\s*\(/.test(l));
  let loopAt = -1, depth = 0, inLoop = false;
  for (let i = Math.max(0, start + 1); i < lines.length; i++) {
    const raw = lines[i]!;
    const s = raw.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "").trim();
    const ln = i + 1;
    if (!s) continue;
    if (/^while\s*\(\s*1\s*\)/.test(s)) { loopAt = out.length; inLoop = true; depth = s.includes("{") ? 1 : 0; continue; }
    if (inLoop) { depth += (s.match(/\{/g) ?? []).length - (s.match(/\}/g) ?? []).length; if (depth <= 0) { const idle = loopAt === out.length; out.push({ asm: idle ? "B     .            ; idle" : "B     loop", read: false, write: false, line: ln, target: idle ? out.length : loopAt }); break; } }
    if (s === "{" || s === "}") continue;
    let m = s.match(/^(?:volatile\s+)?\w+\s*\*\s*(\w+)\s*=\s*\(\s*\w+\s*\*\s*\)\s*(0x[0-9a-fA-F]+|\d+)/);
    if (m) { out.push({ asm: `LDR   ${reg(m[1]!)}, =${hex(Number(m[2]), 8)}`, read: false, write: false, line: ln }); continue; }
    m = s.match(/^(?:\w+\s+)?(\w+)\s*=\s*\*\s*(\w+)\s*;/);
    if (m) { out.push({ asm: `LDR   ${reg(m[1]!)}, [${reg(m[2]!)}]`, read: true, write: false, line: ln }); continue; }
    m = s.match(/^\*\s*(\w+)\s*=\s*\*\s*\1\s*([+-])\s*(\d+)\s*;/);
    if (m) {
      const p = reg(m[1]!), t = reg("__t");
      out.push({ asm: `LDR   ${t}, [${p}]`, read: true, write: false, line: ln });
      out.push({ asm: `${m[2] === "+" ? "ADDS" : "SUBS"}  ${t}, ${t}, #${m[3]}`, read: false, write: false, line: ln });
      out.push({ asm: `STR   ${t}, [${p}]`, read: false, write: true, line: ln });
      continue;
    }
    m = s.match(/^\*\s*(\w+)\s*=\s*(\w+)\s*;/);
    if (m) { out.push({ asm: `STR   ${reg(m[2]!)}, [${reg(m[1]!)}]`, read: false, write: true, line: ln }); continue; }
    m = s.match(/^(?:\w+\s+)?(\w+)\s*=\s*(\w+)\s*([+\-*&|^])\s*(\w+)\s*;/);
    if (m) { const op = ({ "+": "ADDS", "-": "SUBS", "*": "MULS", "&": "ANDS", "|": "ORRS", "^": "EORS" } as Record<string, string>)[m[3]!]!; out.push({ asm: `${op}  ${reg(m[1]!)}, ${reg(m[2]!)}, ${/^\d/.test(m[4]!) ? `#${m[4]}` : reg(m[4]!)}`, read: false, write: false, line: ln }); continue; }
    m = s.match(/^(\w+)\s*(\+\+|--)\s*;/);
    if (m) { out.push({ asm: `${m[2] === "++" ? "ADDS" : "SUBS"}  ${reg(m[1]!)}, ${reg(m[1]!)}, #1`, read: false, write: false, line: ln }); continue; }
    m = s.match(/^(?:\w+\s+)?(\w+)\s*=\s*(\d+|0x[0-9a-fA-F]+)\s*;/);
    if (m) { out.push({ asm: `MOVS  ${reg(m[1]!)}, #${m[2]}`, read: false, write: false, line: ln }); continue; }
    if (/;$/.test(s)) out.push({ asm: `OP    ; ${s.slice(0, 18)}`, read: false, write: false, line: ln });
  }
  if (!out.length) out.push({ asm: "B     .", read: false, write: false, line: 1 });
  return out;
}

/** Cycle-by-cycle bus schedule; harvard = separate I and D buses, otherwise one shared bus. */
export function schedule(trace: Instr[], harvard: boolean, wait: number, dma: boolean, maxInstr = 24): Schedule {
  const seq: number[] = [];
  const idleEnd = trace[trace.length - 1]?.target === trace.length - 1;
  const limit = idleEnd ? Math.min(maxInstr, trace.length + 2) : maxInstr;
  for (let i = 0; seq.length < limit && i < trace.length;) {
    seq.push(i);
    const t = trace[i]!.target;
    i = t !== undefined ? t : i + 1;
  }
  const slots: Slot[] = [];
  let cycle = 1, fetched = 0, done = 0, stalls = 0, overlap = 0;
  let fetchBusyUntil = 0;
  const pendingData: Array<{ k: number; op: Op; ready: number }> = [];
  let guard = 0;
  while (done < seq.length && guard++ < 400) {
    const dmaSteal = dma && cycle % 4 === 0;
    let dataBusTaken = dmaSteal;
    let usedData = false;
    const head = pendingData[0];
    if (head && head.ready <= cycle && !dataBusTaken) {
      slots.push({ cycle, op: head.op, instr: head.k });
      pendingData.shift(); done++; usedData = true; dataBusTaken = true;
    }
    const sharedFree = harvard ? true : !dataBusTaken;
    const canFetch = fetched < seq.length && fetched - done <= 1 && cycle > fetchBusyUntil && pendingData.length < 2;
    if (canFetch && sharedFree) {
      const k = fetched++;
      const span = 1 + wait;
      for (let c = 0; c < span; c++) slots.push({ cycle: cycle + c, op: "fetch", instr: k });
      fetchBusyUntil = cycle + span - 1;
      const ins = trace[seq[k]!]!;
      if (ins.read || ins.write) pendingData.push({ k, op: ins.read ? "read" : "write", ready: cycle + span });
      else done++;
      if (usedData) overlap++;
    } else if (canFetch && !sharedFree) stalls++;
    cycle++;
  }
  const last = slots.reduce((a, s) => Math.max(a, s.cycle), 0);
  return { slots: slots.map((s) => ({ ...s, instr: seq[s.instr]! })), cycles: last, stalls, overlap, instructions: seq.length };
}

const world = new WeakMap<Mcu, { acc: number }>();
const stateOf = (m: Mcu) => { let s = world.get(m); if (!s) { s = { acc: 0 }; world.set(m, s); } return s; };

const BUS = { fetch: "#ef4444", read: "#1769e0", write: "#16a34a" } as const;

function ArchDiagram({ harvard, active, fetchText, dataText, ptr, value }: { harvard: boolean; active: Set<Op>; fetchText: string; dataText: string; ptr: number; value: number }) {
  const on = (o: Op) => active.has(o);
  const bar = (x: number, y: number, w: number, color: string, lit: boolean, dir: "r" | "l" | "both", h = 10) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={color} opacity={lit ? 1 : 0.28} className={lit ? "mcl-l04-bus" : ""} />
      {dir !== "l" ? <path d={`M${x + w} ${y - 5} L${x + w + 12} ${y + h / 2} L${x + w} ${y + h + 5} z`} fill={color} opacity={lit ? 1 : 0.28} /> : null}
      {dir !== "r" ? <path d={`M${x} ${y - 5} L${x - 12} ${y + h / 2} L${x} ${y + h + 5} z`} fill={color} opacity={lit ? 1 : 0.28} /> : null}
    </g>
  );
  const cpu = (x: number) => (
    <g>
      <rect x={x} y={40} width={92} height={156} rx={8} fill="#1f2a3a" />
      <text x={x + 46} y={60} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">CPU</text>
      <text x={x + 46} y={73} textAnchor="middle" fill="#b9c6d8" fontSize="8.5">(MCU Core)</text>
      {["PC", "Instruction Decoder", "Registers", "ALU"].map((t, i) => (
        <g key={t}><rect x={x + 8} y={82 + i * 27} width={76} height={21} rx={3} fill="#2c3b52" stroke="#4b5d78" /><text x={x + 46} y={96 + i * 27} textAnchor="middle" fill="#e8eef7" fontSize={t.length > 10 ? 7.5 : 9}>{t}</text></g>
      ))}
    </g>
  );
  if (harvard) {
    return (
      <svg viewBox="0 0 470 236" className="mcl-svg" role="img" aria-label="Harvard architecture: separate instruction and data buses">
        <rect x={4} y={58} width={96} height={118} rx={6} fill="#fdecec" stroke="#ef4444" strokeWidth={on("fetch") ? 2.4 : 1.3} />
        <path d="M42 78h14l6 6v18H42z M56 78v6h6 M46 90h12 M46 95h12" fill="#fff" stroke="#ef4444" strokeWidth="1.6" />
        <text x={52} y={122} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">Instruction</text>
        <text x={52} y={136} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">Memory (Flash)</text>
        <text x={52} y={156} textAnchor="middle" fontSize="8.5" fill="#4b6283">0x0800 0000 – …</text>
        <text x={157} y={74} textAnchor="middle" fontSize="10" fontWeight="800" fill="#dc2626">Instruction Bus</text>
        {bar(110, 104, 82, BUS.fetch, on("fetch"), "r", 12)}
        {cpu(208)}
        <text x={350} y={74} textAnchor="middle" fontSize="10" fontWeight="800" fill="#1769e0">Data Bus</text>
        {bar(316, 98, 54, BUS.read, on("read"), "l")}
        {bar(316, 118, 54, BUS.write, on("write"), "r")}
        <rect x={384} y={58} width={82} height={118} rx={6} fill="#e8f1ff" stroke="#1769e0" strokeWidth={on("read") || on("write") ? 2.4 : 1.3} />
        <Db x={425} y={80} color="#1769e0" />
        <text x={425} y={122} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">Data Memory</text>
        <text x={425} y={136} textAnchor="middle" fontSize="10" fill="#0f2547">(SRAM)</text>
        <text x={425} y={156} textAnchor="middle" fontSize="8" fill="#4b6283">{hex(ptr, 8)}</text>
        <text x={425} y={168} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1769e0">= {hex(value, 2)}</text>
        {fetchText ? <g><rect x={96} y={182} width={176} height={30} rx={4} fill="#fff" stroke="#ef4444" /><text x={104} y={195} fontSize="8.5" fontWeight="700" fill="#dc2626">Fetching Instruction</text><text x={104} y={207} fontSize="8.5" fill="#0f2547" className="mcl-mono-svg">{fetchText}</text></g> : null}
        {dataText ? <g><rect x={316} y={182} width={150} height={30} rx={4} fill="#fff" stroke="#1769e0" /><text x={324} y={195} fontSize="8.5" fontWeight="700" fill="#1769e0">{dataText.startsWith("W") ? "Writing Data" : "Reading Data"}</text><text x={324} y={207} fontSize="8.5" fill="#0f2547" className="mcl-mono-svg">{dataText.slice(2)}</text></g> : null}
        <Legend y={228} />
      </svg>
    );
  }
  const any = on("fetch") || on("read") || on("write");
  const color = on("fetch") && (on("read") || on("write")) ? "#f59e0b" : on("fetch") ? BUS.fetch : on("read") ? BUS.read : on("write") ? BUS.write : "#f59e0b";
  return (
    <svg viewBox="0 0 470 236" className="mcl-svg" role="img" aria-label="Von Neumann architecture: one shared bus">
      {cpu(8)}
      <text x={206} y={74} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#0f2547">Shared Bus</text>
      <text x={206} y={86} textAnchor="middle" fontSize="8.5" fill="#4b6283">(Address / Data / Control)</text>
      <rect x={118} y={100} width={182} height={26} rx={4} fill={color} opacity={any ? 1 : 0.3} className={any ? "mcl-l04-bus" : ""} />
      <path d="M118 92 L104 113 L118 134 z" fill={color} opacity={any ? 1 : 0.3} />
      <path d="M300 92 L314 113 L300 134 z" fill={color} opacity={any ? 1 : 0.3} />
      <rect x={130} y={128} width={160} height={6} rx={2} fill="#16a34a" opacity={on("write") ? 1 : 0.25} />
      <rect x={322} y={58} width={142} height={118} rx={6} fill="#f1e8ff" stroke="#7c3aed" strokeWidth={any ? 2.4 : 1.3} />
      <Db x={393} y={80} color="#7c3aed" />
      <text x={393} y={122} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">Unified Memory</text>
      <text x={393} y={136} textAnchor="middle" fontSize="10" fill="#0f2547">(Program + Data)</text>
      <text x={393} y={156} textAnchor="middle" fontSize="8.5" fill="#4b6283">0x0000 0000 – 0xFFFF FFFF</text>
      <text x={393} y={168} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#7c3aed">{hex(ptr, 8)} = {hex(value, 2)}</text>
      {fetchText ? <g><rect x={116} y={20} width={178} height={30} rx={4} fill="#fff" stroke="#ef4444" /><text x={124} y={33} fontSize="8.5" fontWeight="700" fill="#dc2626">Fetching Instruction</text><text x={124} y={45} fontSize="8.5" fill="#0f2547" className="mcl-mono-svg">{fetchText}</text></g> : null}
      {dataText ? <g><rect x={150} y={150} width={150} height={30} rx={4} fill="#fff" stroke="#1769e0" /><text x={158} y={163} fontSize="8.5" fontWeight="700" fill="#1769e0">{dataText.startsWith("W") ? "Writing Data" : "Reading Data"}</text><text x={158} y={175} fontSize="8.5" fill="#0f2547" className="mcl-mono-svg">{dataText.slice(2)}</text></g> : null}
      {on("fetch") && (on("read") || on("write")) ? <text x={209} y={196} textAnchor="middle" fontSize="9" fontWeight="800" fill="#c2410c">Bus contention</text> : null}
      <Legend y={228} />
    </svg>
  );
}

function Db({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g fill="#fff" stroke={color} strokeWidth="1.6">
      <path d={`M${x - 10} ${y + 3} v16 a10 4 0 0 0 20 0 v-16`} />
      <path d={`M${x - 10} ${y + 11} a10 4 0 0 0 20 0`} fill="none" />
      <ellipse cx={x} cy={y + 3} rx={10} ry={4} />
    </g>
  );
}

function Legend({ y }: { y: number }) {
  return (
    <g>
      {([["Instruction Fetch", BUS.fetch], ["Data Read", BUS.read], ["Data Write", BUS.write]] as const).map(([t, c], i) => (
        <g key={t} transform={`translate(${70 + i * 125} ${y - 6})`}><path d="M0 0 H22" stroke={c} strokeWidth="3" /><path d="M22 -4 L29 0 L22 4 z" fill={c} /><text x={34} y={3} fontSize="9" fill="#2a4672">{t}</text></g>
      ))}
    </g>
  );
}

function Timeline({ s, cursor, title, window: win }: { s: Schedule; cursor: number; title: string; window: number }) {
  const first = Math.max(1, Math.min(cursor - Math.floor(win / 2), s.cycles - win + 1));
  const cols = Array.from({ length: win }, (_, i) => first + i);
  const rows: Op[] = ["fetch", "read", "write"];
  const W = 360, x0 = 78, cw = (W - x0) / win;
  return (
    <div className="mcl-l04-tl">
      <b>{title}</b>
      <svg viewBox={`0 0 ${W} 92`} className="mcl-svg" role="img" aria-label={title}>
        {rows.map((r, ri) => (
          <g key={r}>
            <text x={x0 - 6} y={14 + ri * 20} textAnchor="end" fontSize="9" fill="#2a4672">{r === "fetch" ? "Instruction Fetch" : r === "read" ? "Data Read" : "Data Write"}</text>
            {cols.map((c, ci) => {
              const hit = s.slots.find((sl) => sl.cycle === c && sl.op === r);
              return hit ? <rect key={c} x={x0 + ci * cw + 1} y={4 + ri * 20} width={cw - 2} height={14} rx={2} fill={BUS[r]} opacity={c <= cursor ? 1 : 0.35}><title>{`Cycle ${c}: ${r} (instruction ${hit.instr + 1})`}</title></rect> : null;
            })}
          </g>
        ))}
        {cols.map((c, ci) => <text key={c} x={x0 + ci * cw + cw / 2} y={76} textAnchor="middle" fontSize="8.5" fill={c === cursor ? "#1769e0" : "#5b708f"} fontWeight={c === cursor ? 800 : 500}>{c}</text>)}
        {cursor >= first && cursor < first + win ? <rect x={x0 + (cursor - first) * cw} y={0} width={cw} height={66} fill="none" stroke="#1769e0" strokeWidth="1.4" strokeDasharray="3 2" /> : null}
        <text x={x0 + (W - x0) / 2} y={89} textAnchor="middle" fontSize="8.5" fill="#5b708f">Clock Cycles</text>
      </svg>
    </div>
  );
}

const RATES = [1, 2, 4, 8, 16];

export default function L04({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: DEMO, params: { rate: 4, wait: 0, dma: false, mode: "both" },
    mcu: { part: "F103" },
    setup: (m) => { m.writeMem(0x20000000, 0x3c, 4); },
    world: (m, dt, p) => { stateOf(m).acc += dt * p.rate; },
  });
  const { mcu, params } = lab;
  const win = 10;
  const trace = useMemo(() => compileTrace(lab.compiledCode), [lab.compiledCode]);
  const sh = useMemo(() => schedule(trace, true, params.wait, params.dma), [trace, params.wait, params.dma]);
  const sv = useMemo(() => schedule(trace, false, params.wait, params.dma), [trace, params.wait, params.dma]);
  const st = stateOf(mcu);
  const span = Math.max(sh.cycles, sv.cycles) + 2;
  const cursor = (Math.floor(st.acc) % span) + 1;
  const at = (s: Schedule) => new Set(s.slots.filter((x) => x.cycle === cursor).map((x) => x.op));
  const slotAt = (s: Schedule, op: Op) => s.slots.find((x) => x.cycle === cursor && x.op === op);
  const pcOf = (i: number) => 0x08000800 + i * 2;
  const ptrMatch = lab.compiledCode.match(/\(\s*\w+\s*\*\s*\)\s*(0x[0-9a-fA-F]+)/);
  const ptr = ptrMatch ? Number(ptrMatch[1]) : 0x20000000;
  const value = ptr >= 0x20000000 && ptr < 0x20005000 ? mcu.readMem(ptr, 4) : 0;
  const describe = (s: Schedule) => {
    const f = slotAt(s, "fetch"), d = slotAt(s, "read") ?? slotAt(s, "write");
    return {
      fetchText: f ? `${hex(pcOf(f.instr), 4)}: ${trace[f.instr]!.asm.replace(/\s+/g, " ").split(";")[0]!.trim()}` : "",
      dataText: d ? `${d.op === "write" ? "W" : "R"} ${hex(ptr, 8)} ${d.op === "write" ? "←" : "→"} ${hex(value, 2)}` : "",
      instr: f?.instr ?? d?.instr ?? -1,
    };
  };
  const dh = describe(sh), dv = describe(sv);
  const ipcH = sh.cycles ? Math.min(1, sh.instructions / sh.cycles) : 0;
  const ipcV = sv.cycles ? Math.min(1, sv.instructions / sv.cycles) : 0;
  const curInstr = dh.instr >= 0 ? dh.instr : 0;
  const advance = () => { if (lab.running) lab.toggle(); st.acc = Math.floor(st.acc) + 1; lab.advance(0); };
  const stop = () => { st.acc = 0; lab.resetSim(); };
  const show = params.mode;
  const sawContention = sv.stalls > 0;

  const controls = (s: Schedule, d: ReturnType<typeof describe>, label: string) => (
    <div className="mcl-l04-ctl">
      <div className="mcl-l04-ctl-btns">
        <b>Simulation Controls</b>
        <div>
          <button type="button" className="mcl-l04-round" onClick={lab.toggle} aria-label={lab.running ? "Pause" : "Play"}><Icon name={lab.running ? "pause" : "play"} /></button>
          <button type="button" className="mcl-l04-round ghost" onClick={stop} aria-label="Stop and rewind"><span className="mcl-l04-sq" /></button>
          <button type="button" className="mcl-l04-round ghost" onClick={advance} aria-label="Step one clock cycle"><Icon name="chevRight" /></button>
        </div>
      </div>
      <label className="mcl-l04-speed">Execution Speed
        <input type="range" min={0} max={RATES.length - 1} value={Math.max(0, RATES.indexOf(params.rate))} onChange={(e) => lab.setParam("rate", RATES[Number(e.target.value)]!)} aria-label={`${label} execution speed`} />
        <small>{params.rate <= 1 ? "Slow" : params.rate <= 4 ? "Medium" : "Fast"} · {params.rate} cyc/s</small>
      </label>
      <div className="mcl-l04-box"><small>{label === "Harvard" ? "Current Instruction" : "Current Operation"}</small><code>{d.instr >= 0 ? trace[d.instr]!.asm.split(";")[0]!.replace(/\s+/g, " ").trim() : "—"}</code></div>
      <div className="mcl-l04-box"><small>{label === "Harvard" ? "Program Counter" : "Address Bus"}</small><code>{label === "Harvard" ? (d.instr >= 0 ? hex(pcOf(d.instr), 4) : "—") : slotAt(s, "read") || slotAt(s, "write") ? hex(ptr, 8) : d.instr >= 0 ? hex(pcOf(d.instr), 8) : "—"}</code></div>
    </div>
  );

  return (
    <LabShell meta={meta} lab={lab} subtitle="Visualize and compare instruction and data paths."
      components={["STM32F103 (Cortex-M3, modified Harvard)", "Flash 0x0800 0000 (instructions)", "SRAM 0x2000 0000 (data)"]}>
      <div className="mcl-grid mcl-l04-grid">
        <Panel title="Harvard Architecture" icon="cpu" className="mcl-sim mcl-l04-h" tools={<span className={`mcl-chip ${lab.status === "running" ? "mcl-chip-live" : ""}`}>Simulation {lab.status === "running" ? "Running" : lab.status}</span>}>
          <p className="mcl-l04-sub">Separate instruction and data memories with dedicated buses.</p>
          {show !== "vn" ? <ArchDiagram harvard active={at(sh)} fetchText={dh.fetchText} dataText={dh.dataText} ptr={ptr} value={value} /> : <p className="mcl-muted">Hidden — compare mode shows Von Neumann only.</p>}
          {controls(sh, dh, "Harvard")}
        </Panel>
        <Panel title="Von Neumann Architecture" icon="layers" className="mcl-l04-v" tools={<span className={`mcl-chip ${lab.status === "running" ? "mcl-chip-live" : ""}`}>Simulation {lab.status === "running" ? "Running" : lab.status}</span>}>
          <p className="mcl-l04-sub">Single memory for both instructions and data using a shared bus.</p>
          {show !== "h" ? <ArchDiagram harvard={false} active={at(sv)} fetchText={dv.fetchText} dataText={dv.dataText} ptr={ptr} value={value} /> : <p className="mcl-muted">Hidden — compare mode shows Harvard only.</p>}
          {controls(sv, dv, "Von Neumann")}
        </Panel>
        <Panel title="Key Differences" icon="list" className="mcl-l04-diff">
          <table className="mcl-table mcl-l04-cmp">
            <thead><tr><th>Feature</th><th className="h">Harvard</th><th className="v">Von Neumann</th></tr></thead>
            <tbody>
              {[["Memory Space", "Separate (I & D)", "Unified"], ["Buses", "Separate buses", "Single shared bus"], ["Simultaneous Access", `Yes (parallel) — ${sh.overlap} overlaps`, `No (shared) — ${sv.stalls} stalls`], ["Typical Use", "Microcontrollers (DSP, AVR, PIC)", "General-purpose CPUs (x86, ARM)"], ["Code as Data", "Not directly accessible", "Accessible (same memory)"], ["Complexity", "Higher", "Lower"], ["Performance", `Higher — ${sh.cycles} cycles`, `Lower — ${sv.cycles} cycles`]].map(([f, h, v]) => <tr key={f}><td>{f}</td><td>{h}</td><td>{v}</td></tr>)}
            </tbody>
          </table>
          <div className="mcl-field"><span>Show</span>
            <select className="mcl-input" value={params.mode} onChange={(e) => lab.setParam("mode", e.target.value)} aria-label="Architectures to show"><option value="both">Both architectures</option><option value="h">Harvard only</option><option value="vn">Von Neumann only</option></select>
          </div>
        </Panel>

        <CodeEditor lab={lab} className="mcl-l04-code" languages={[{ label: "C (GCC)", code: DEMO }, { label: "C (busy loop)", code: LOOP }]} />

        <Panel title="Pipeline / Access Timeline" icon="wave" className="mcl-l04-pipe" tools={<span className="mcl-chip">Cycle {cursor}</span>}>
          <div className="mcl-l04-legend">{([["Instruction Fetch", BUS.fetch], ["Data Read", BUS.read], ["Data Write", BUS.write]] as const).map(([t, c]) => <span key={t}><i style={{ background: c }} />{t}</span>)}</div>
          <Timeline s={sh} cursor={cursor} window={win} title="Harvard Architecture (Parallel Access)" />
          <Timeline s={sv} cursor={cursor} window={win} title="Von Neumann Architecture (Shared Bus)" />
          <table className="mcl-table mcl-mono mcl-l04-trace">
            <thead><tr><th>#</th><th>Address</th><th>Instruction</th><th>Bus use</th></tr></thead>
            <tbody>{trace.slice(0, 8).map((t, i) => <tr key={i} className={i === curInstr ? "hl" : ""}><td>{i + 1}</td><td>{hex(pcOf(i), 4)}</td><td>{t.asm.split(";")[0]}</td><td>{t.read ? "fetch + read" : t.write ? "fetch + write" : "fetch"}</td></tr>)}</tbody>
          </table>
        </Panel>

        <div className="mcl-col mcl-l04-side">
          <Panel title="Performance & Bottlenecks" icon="gauge">
            <div className="mcl-l04-perf">
              <span>Harvard (Simulated)</span><div className="mcl-l04-bar"><i style={{ width: `${ipcH * 100}%` }} /></div><b>{ipcH.toFixed(2)}</b>
              <small>Higher throughput (parallel access) · {sh.cycles} cycles</small>
              <span>Von Neumann (Simulated)</span><div className="mcl-l04-bar v"><i style={{ width: `${ipcV * 100}%` }} /></div><b>{ipcV.toFixed(2)}</b>
              <small>Bus contention reduces performance · {sv.cycles} cycles</small>
            </div>
            <div className={`mcl-l04-alert ${sawContention || params.wait || params.dma ? "" : "ok"}`}>
              <Icon name={sawContention || params.wait || params.dma ? "alert" : "check"} />
              <div>
                <b>{sv.stalls ? "Current Bottleneck (Von Neumann)" : params.wait ? "Current Bottleneck (Flash)" : "No bottleneck"}</b>
                <span>{sv.stalls ? `Shared bus: ${sv.stalls} fetch stall${sv.stalls === 1 ? "" : "s"} — cannot fetch an instruction and move data at the same time.` : params.wait ? `${params.wait} Flash wait state${params.wait > 1 ? "s" : ""} stretch every fetch.` : "This program has no data accesses, so both buses only fetch."}</span>
              </div>
            </div>
            <div className="mcl-l04-faults">
              <label className="mcl-slider"><span>Flash wait states<b>{params.wait}</b></span><input type="range" min={0} max={3} value={params.wait} onChange={(e) => lab.setParam("wait", Number(e.target.value))} /></label>
              <Toggle label="DMA steals the data bus every 4th cycle" checked={params.dma} onChange={(v) => lab.setParam("dma", v)} />
            </div>
          </Panel>
          <LearningNotes notes={{
            takeaways: ["Harvard architecture uses separate instruction and data memories.", "Von Neumann architecture uses a single shared memory and bus.", "Harvard allows simultaneous instruction fetch and data access.", "Von Neumann can suffer from bus contention (Von Neumann bottleneck).", "Most modern microcontrollers (e.g., AVR, PIC, ARM Cortex-M) use Harvard.", "Experiment: step through the simulation and observe bus activity."],
            observe: "Watch the red instruction bus and the blue/green data bus light up cycle by cycle.",
            tryIt: "Pause, then step one clock cycle at a time and compare the two current operations.",
            measure: `Count the cycles: Harvard needs ${sh.cycles}, Von Neumann ${sv.cycles} for the same ${sh.instructions} instructions.`,
            modify: "Load the busy-loop example or add another *data access, then press Run.",
            runAgain: "Add Flash wait states or DMA contention and see which architecture suffers more.",
            challenge: "Write a program where both architectures need the same number of cycles. Why does that happen?",
            checks: [{ label: "Saw a Von Neumann fetch stall", done: sawContention }, { label: "Observed a write-back to SRAM", done: value !== 0x3c }],
            question: "Why can a Harvard core start fetching the next instruction while the current one is still reading data?",
          }} />
        </div>
      </div>
    </LabShell>
  );
}

