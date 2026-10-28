import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStudioTab } from "../../layout/useStudioTab";
import { gateCount, logicDepth, parseBoolean } from "../../engines/boolean/ast";
import { cellMinterm, describeImplicant, headerBits, kmapLayout, rectsForImplicant, type CellValue } from "../../engines/kmap/map";
import { defaultNames, maskToMinterms, quineMcCluskey, type Implicant } from "../../engines/kmap/quine";
import { truthTableToCanonicalSOP } from "../../engines/truth/table";
import { Card, ExplainBar, Segmented, Toggle } from "../../design-system/ui";
import { StudioFrame } from "../../layout/StudioFrame";
import "./kmap.css";
import { searchStudios } from "../../data/curriculum";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "map", label: "K-Map" },
  { id: "primes", label: "Prime Implicants" },
  { id: "qm", label: "Quine–McCluskey" },
  { id: "circuit", label: "Circuit Compare" },
];

const LESSONS: Record<string, { guide: string[]; takeaways: string[]; theory: { title: string; body: string }; what: string; why: string; notice: string }> = {
  map: {
    theory: { title: "Karnaugh maps", body: "A K-map lays minterms in Gray-code order so adjacent cells differ by one variable. A group of 1, 2, 4, or 8 (power of two), including wraparound, drops the variables that change inside the group. Don't-cares may join a group but need not be covered." },
    guide: ["Choose 2 to 6 variables.", "Cycle cells through 0, 1, and X.", "Read each group's product term.", "Include a wraparound pair if the 1s sit on opposite edges."],
    takeaways: ["Adjacent cells differ by one variable.", "Group size must be a power of two.", "Don't-cares may be used but need not be covered."],
    what: "Cell order is Gray code, so neighbors differ by one bit.",
    why: "A power-of-two group eliminates the variables that change inside it.",
    notice: "A dashed group wraps around the map edge.",
  },
  primes: {
    theory: { title: "Prime implicants", body: "A prime implicant is a largest legal group that is not contained in a larger one. An essential prime is the only prime that covers some minterm — it must appear in every minimal cover. The remaining primes are chosen to cover leftovers at least cost." },
    guide: ["Fill 1s, then open this tab.", "Read which primes are essential.", "See leftover minterms that still need a prime.", "Compare the selected cover with the map groups."],
    takeaways: ["Essential primes are the only cover for some minterm.", "A prime is maximal: growing it would include a 0.", "Cost here is how many gates the cover implies."],
    what: "The engine lists primes from the same map you edited.",
    why: "Picking non-essential primes is how two students get two equally short SOPs.",
    notice: "This is the covering step, not a different Boolean algebra.",
  },
  qm: {
    theory: { title: "Quine–McCluskey", body: "Quine–McCluskey is tabular minimization: combine minterms that differ by one bit, repeat, then cover the 1s with primes. It does the same job as a K-map without drawing cells, so it scales past six variables in textbooks (this lab stays small and visible)." },
    guide: ["Read the combination table from the current 1s and X's.", "Follow which pairs merge by one bit.", "See the prime chart and the chosen cover.", "Compare the expression with the map tab."],
    takeaways: ["Merging two terms that differ by one bit drops that variable.", "The prime chart is a covering problem.", "QM and the K-map agree on this function."],
    what: "Each merge is a larger implicant.",
    why: "The algorithm is mechanical so it does not rely on seeing adjacency.",
    notice: "Don't-cares may be used in merges and need not be covered at the end.",
  },
  circuit: {
    theory: { title: "Before and after grouping", body: "Canonical SOP is one AND per minterm, then an OR. After grouping, fewer, wider ANDs feed a smaller OR. Gate count and depth drop when implicants cover several 1s. The two circuits must match on every input." },
    guide: ["Compare gate count before and after.", "Toggle inputs and confirm both circuits agree.", "Return to the map if a group looks wrong.", "Note that don't-cares can shrink the after circuit."],
    takeaways: ["Fewer terms usually means fewer gates.", "Depth follows the longest AND-OR path.", "Equivalence is the truth table, not the drawing."],
    what: "Both networks implement the same output column.",
    why: "Simplification is worth it only if the function is unchanged.",
    notice: "Counts are teaching gates, not a synthesizer report.",
  },
};

const GROUP_COLORS = ["#2F6FED", "#12B76A", "#D97706", "#E11D48", "#7C3AED", "#0891B2"];

export function KmapStudio() {
  useSimulatorCapture("studios/kmap/KmapStudio.tsx:KmapStudio", () => ({ tab, initial, count, cells, mode, hover }), "f774c8ff09f2");

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useStudioTab(TABS, "map");
  const incoming = params.get("data");
  const { prefs, update } = usePrefs();
  const initial = useMemo(() => readIncoming(incoming), [incoming]);
  const [count, setCount] = useState(initial?.names.length ?? 4);
  const [cells, setCells] = useState<CellValue[]>(initial?.outputs ?? seed(4));
  const [mode, setMode] = useState<"sop" | "pos">("sop");
  const [hover, setHover] = useState<number | null>(null);
  const names = defaultNames(count);
  const sized = resize(cells, count);
  const ones = sized.flatMap((cell, index) => (cell === 1 ? [index] : []));
  const zeros = sized.flatMap((cell, index) => (cell === 0 ? [index] : []));
  const donts = sized.flatMap((cell, index) => (cell === "X" ? [index] : []));
  const result = quineMcCluskey(mode === "sop" ? ones : zeros, donts, count, names);
  const expression = mode === "sop" ? result.expression : posExpression(result);
  const lesson = LESSONS[tab] ?? LESSONS.map!;
  return (
    <div className="km-page"><header className="km-nav"><Link to="/" className="km-brand"><span>⊞</span>Math Universe</Link><nav><Link to="/">Home</Link><Link to="/studios" className="active">Studios</Link><Link to="/practice">Practice</Link><Link to="/learn">Progress</Link></nav><input aria-label="Search topics" onKeyDown={(event) => { if (event.key === "Enter") { const hit = searchStudios(event.currentTarget.value).find(item => item.active); if (hit) navigate(hit.path); } }} placeholder="⌕　Search topics, e.g. two’s complement"/><span>Practice {prefs.challenges.length} / 11　◯</span><Toggle on={prefs.explain} onChange={(explain) => update({ explain })} label="Explain" /><span>☼</span><span className="km-avatar">S</span></header><div className="km-body"><div className="km-crumb"><Link to="/">Home</Link>　›　<Link to="/studios">Studios</Link>　›　K-Map Solver　›　<b>{TABS.find(t=>t.id===tab)?.label}</b></div><StudioFrame icon="map" title="K-Map & Logic Simplification" description="Cycle cells through 0, 1, and X. Groups follow Gray-code adjacency, including wraparound." tabs={TABS} tab={tab} onTab={setTab} onReset={() => { setCells(seed(count)); setMode("sop"); }} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain && tab === "primes" ? <ExplainBar what={lesson.what} why={lesson.why} notice={lesson.notice} /> : null}
      <div className="km-controls"><b>Variables</b>
        <Segmented options={["2", "3", "4", "5", "6"]} value={String(count)} onChange={(v) => setCount(Number(v))} />
        <b className="km-divider">Form</b><Segmented options={["sop", "pos"]} value={mode} onChange={(v) => setMode(v as "sop" | "pos")} />
        <b className="km-divider">Expression</b><output>{expression}</output>
      </div>
      {tab === "map" ? <div className="km-map-card"><div className="spread"><h3>K-map ({count} variables)　ⓘ</h3><div className="row">Cell values　<span className="km-values">0　 <b>1</b>　 X</span><button onClick={() => setCells(Array(1 << count).fill(0))}>♜　Clear map</button></div></div><MapView count={count} names={names} cells={sized} groups={result.selected} hover={hover} onHover={setHover} onCycle={(index) => setCells((prev) => {
        const next = resize(prev, count);
        const cell = next[index] ?? 0;
        next[index] = cell === 0 ? 1 : cell === 1 ? "X" : 0;
        return next;
      })} /></div> : null}
      {tab === "primes" ? <PrimeView implicants={result.implicants} names={names} hover={hover} onHover={setHover} /> : null}
      {tab === "qm" ? <QmView result={result} /> : null}
      {tab === "circuit" ? <CircuitView names={names} cells={sized} after={mode === "sop" ? result.expression : expression} /> : null}
    </StudioFrame></div></div>
  );
}

function seed(count: number): CellValue[] {
  return Array.from({ length: 1 << count }, (_, index) => ((count === 4 ? [0, 1, 10, 11] : [1, 3, 5]).includes(index) ? 1 : 0));
}

function resize(cells: CellValue[], count: number): CellValue[] {
  const size = 1 << count;
  return Array.from({ length: size }, (_, index) => cells[index] ?? 0);
}

function readIncoming(raw: string | null): { names: string[]; outputs: CellValue[] } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { names: string[]; outputs: CellValue[] };
    if (!Array.isArray(parsed.outputs)) return null;
    return parsed;
  } catch { return null; }
}

function posExpression(result: ReturnType<typeof quineMcCluskey>): string {
  if (result.selected.length === 0) return "1";
  const clauses = result.selected.map((im) => {
    const lits: string[] = [];
    [...im.mask].forEach((bit, index) => {
      const name = result.variables[index];
      if (!name || bit === "-") return;
      lits.push(bit === "1" ? `${name}'` : name);
    });
    if (lits.length === 0) return "0";
    return lits.length === 1 ? (lits[0] ?? "0") : `(${lits.join(" + ")})`;
  });
  return clauses.join(" · ");
}

function MapView({ count, names, cells, groups, hover, onHover, onCycle }: {
  count: number; names: string[]; cells: CellValue[]; groups: Implicant[]; hover: number | null; onHover: (index: number | null) => void; onCycle: (index: number) => void;
}) {
  const layout = kmapLayout(count);
  const rows = headerBits(layout.rowBits);
  const cols = headerBits(layout.colBits);
  const active = hover === null ? groups : groups.filter((_, index) => index === hover);
  return (
    <div className="grid" style={{ gridTemplateColumns: layout.maps > 1 ? "1fr 1fr" : "1.35fr 1fr" }}>
      {Array.from({ length: layout.maps }, (_, map) => (
        <Card key={map} title={layout.maps === 1 ? "" : `${names[0] ?? "M"} map ${map.toString(2).padStart(Math.log2(layout.maps) || 1, "0")}`}>
          <div>
            <table className="kmap">
              <thead>
                <tr><th /><th colSpan={cols.length} className="tiny">{names.slice(layout.rowBits + (count - layout.rowBits - layout.colBits)).join("") || names.slice(-layout.colBits).join("")}</th></tr>
                <tr><th className="tiny">{names.slice(count - layout.rowBits - layout.colBits, count - layout.colBits).join("")}</th>{cols.map((code) => <th key={code}>{code}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((code, row) => (
                  <tr key={code}>
                    <th>{code}</th>
                    {cols.map((colCode, col) => {
                      const minterm = cellMinterm(count, map, row, col);
                      const value = cells[minterm] ?? 0;
                      const groupIndex = active.findIndex((group) => maskToMinterms(group.mask).includes(minterm));
                      const mark = groupIndex >= 0 ? GROUP_COLORS[groupIndex % GROUP_COLORS.length] : undefined;
                      return <td key={colCode}><button className={value === 1 ? "kcell on" : value === "X" ? "kcell x" : "kcell"} style={{ boxShadow: mark ? `inset 0 0 0 2px ${mark}` : undefined, background: mark ? `${mark}18` : undefined }} onClick={() => onCycle(minterm)} aria-label={"minterm " + minterm + " is " + value}>{value}<small className="tiny" style={{ display: "block" }}>m{minterm}</small></button></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      <Card title="Groups">
        {groups.map((group, index) => {
          const info = describeImplicant(group.mask, names);
          const wraps = rectsForImplicant(group, count, "G").some((rect) => rect.wrap);
          return <button key={group.mask} className="btn-ghost" onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(index)} style={{ borderColor: GROUP_COLORS[index % GROUP_COLORS.length], marginRight: 6 }}><span className="km-group-number">{index + 1}</span><span><b>{"G" + (index + 1) + ": " + info.term + (wraps ? " · wraps" : "") + " · drops " + info.eliminated}</b><small>Cells: {group.minterms.map(m => "m" + m).join(", ")}</small></span></button>;
        })}
        {groups.length === 0 ? <p className="muted">No selected group. The function is constant 0, or POS found no zero-cells.</p> : null}
      </Card>
    </div>
  );
}

function PrimeView({ implicants, names, hover, onHover }: { implicants: Implicant[]; names: string[]; hover: number | null; onHover: (index: number | null) => void }) {
  return (
    <Card title="Implicant chart"><p className="muted">List of prime implicants found for the current K-map.</p>
      <table className="data">
        <thead><tr><th>#</th><th>Mask</th><th>Term</th><th>Minterms</th><th>Essential</th><th>Selected</th></tr></thead>
        <tbody>
          {implicants.map((im, index) => (
            <tr key={im.mask} className={hover === index ? "active" : ""} onMouseEnter={() => onHover(index)}>
              <td><span className="km-group-number">{index + 1}</span></td><td className="mono">{im.mask}</td>
              <td>{describeImplicant(im.mask, names).term}</td>
              <td>{im.minterms.join(", ")}</td>
              <td><span className="km-yes">{im.essential ? "● Yes" : "No"}</span></td>
              <td><span className="km-cover">{im.selected ? "☑ Cover" : ""}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function QmView({ result }: { result: ReturnType<typeof quineMcCluskey> }) {
  useSimulatorCapture("studios/kmap/KmapStudio.tsx:QmView", () => ({ binary }), "f774c8ff09f2");

 const terms=[...new Set(result.implicants.flatMap(i=>i.minterms))].sort((a,b)=>a-b);
 const [binary,setBinary]=useState(true);
 return <div className="grid"><Card title="Group by number of 1s" action={<button className="km-cover" onClick={()=>setBinary(!binary)}>Show {binary ? "decimal" : "binary"}</button>}><table className="data"><thead><tr><th># of 1s</th><th>Minterms (decimal)</th><th>Minterms ({binary ? "binary" : "decimal"})</th></tr></thead><tbody>{terms.map(m=><tr key={m}><td>{m.toString(2).replaceAll("0", "").length}</td><td><span className="km-cover">m{m}</span></td><td className="mono">{binary ? m.toString(2).padStart(result.variables.length,"0") : m}</td></tr>)}</tbody></table></Card>{result.stages.filter(stage=>stage.title.startsWith("Combine")).map(stage=><Card key={stage.title} title={stage.title}><table className="data"><thead><tr><th>Pair</th><th>Combined term</th><th>Minterms covered</th></tr></thead><tbody>{stage.rows.map((row,i)=>{const parts=row.split("  covers ");return <tr key={i}><td>{i+1}</td><td><span className="km-yes mono">{parts[0]}</span></td><td>{parts[1]}</td></tr>})}</tbody></table></Card>)}<Card title="Prime implicant chart"><table className="data"><thead><tr><th>Prime implicant</th>{terms.map(m=><th key={m}>{m}</th>)}</tr></thead><tbody>{result.implicants.map(im=><tr key={im.mask}><td className="mono">{im.mask}</td>{terms.map(m=><td key={m} style={{color:im.minterms.includes(m)?"#0668ff":"#dce4ef"}}>●</td>)}</tr>)}</tbody></table></Card><Card title="Selected cover"><span className="km-cover">{result.expression}</span></Card></div>;
}

function CircuitView({ names, cells, after }: { names: string[]; cells: CellValue[]; after: string }) {
  const before = truthTableToCanonicalSOP({
    variables: names,
    rows: cells.map((cell, index) => ({
      index,
      values: [],
      output: cell === 1 ? 1 : 0,
      minterm: mintermText(names, index),
      maxterm: "",
    })),
    minterms: cells.flatMap((cell, index) => (cell === 1 ? [index] : [])),
    maxterms: [],
  });
  const beforeStats = stats(before);
  const afterStats = stats(after);
  return <div className="grid cards-2">{[{title:"Before optimization",expression:before,metrics:beforeStats,optimized:false},{title:"After optimization",expression:after,metrics:afterStats,optimized:true}].map(item=><Card key={item.title} title={item.title} action={<span className={item.optimized?"km-yes":"km-cover"}>{item.optimized?"Optimized":"Original"}</span>}><p className="muted">{item.optimized?"Simplified SOP from K-map grouping":"Canonical SOP (one AND per minterm, then OR)"}</p><b>Logic expression</b><div className="km-expression">{item.expression}<button style={{float:"right",border:0,color:"#0668ff",background:"transparent"}} aria-label="Copy expression" onClick={()=>navigator.clipboard.writeText(item.expression)}>▢</button></div><b>Logic circuit</b><CircuitDiagram expression={item.expression}/><div className="km-metrics"><div>◉ Gate count<strong>{item.metrics.gates} <small>gates</small></strong></div><div>ϟ Logic depth<strong>{item.metrics.depth} <small>levels</small></strong></div><div>◈ Terms<strong>{item.expression === "0" ? 0 : item.expression.split(" + ").length} <small>AND gates</small></strong></div></div>{item.optimized && <div className="km-equivalent"><b>● Circuits are equivalent</b><small>Both networks implement the same output for all specified input combinations.</small></div>}</Card>)}</div>;
}
function CircuitDiagram({expression}:{expression:string}) {
 const terms=expression.split(" + ");const height=Math.max(160,terms.length*48);
 return <svg className="km-circuit" viewBox={`0 0 550 ${height}`} role="img" aria-label="AND OR logic circuit">{terms.map((term,i)=>{const y=25+i*44;return <g key={i}><rect x="10" y={y-17} width="130" height="36" rx="12" fill="#eaf2ff"/><text x="75" y={y+5} textAnchor="middle" fill="#53678e" fontSize="12">{term}</text><path d={`M140 ${y}H185 M235 ${y}H300Q310 ${y} 310 ${height/2}H375`} fill="none" stroke="#465575" strokeWidth="2"/><path d={`M185 ${y-18}H215A18 18 0 0 1 215 ${y+18}H185Z`} fill="#e3f2ff" stroke="#0668ff" strokeWidth="2"/></g>})}<path d={`M375 ${height/2-26}Q415 ${height/2-30} 435 ${height/2}Q415 ${height/2+30} 375 ${height/2+26}Q394 ${height/2} 375 ${height/2-26}Z`} fill="#e3f2ff" stroke="#0668ff" strokeWidth="2"/><path d={`M435 ${height/2}H500`} stroke="#465575" strokeWidth="2"/><circle cx="500" cy={height/2} r="5" fill="white" stroke="#465575" strokeWidth="2"/><text x="520" y={height/2+5}>F</text></svg>;
}

function mintermText(names: string[], index: number): string {
  return names.map((name, bit) => {
    const on = ((index >> (names.length - 1 - bit)) & 1) === 1;
    return on ? name : `${name}'`;
  }).join("·");
}

function stats(expression: string): { gates: number; depth: number } {
  if (expression === "0" || expression === "1") return { gates: 0, depth: 0 };
  try {
    const ast = parseBoolean(expression.replace(/·/g, "&"));
    return { gates: gateCount(ast.ast), depth: logicDepth(ast.ast) };
  } catch {
    return { gates: 0, depth: 0 };
  }
}
