import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStudioTab } from "../../layout/useStudioTab";
import { gateCount, logicDepth, parseBoolean } from "../../engines/boolean/ast";
import { cellMinterm, describeImplicant, headerBits, kmapLayout, rectsForImplicant, type CellValue } from "../../engines/kmap/map";
import { defaultNames, maskToMinterms, quineMcCluskey, type Implicant } from "../../engines/kmap/quine";
import { truthTableToCanonicalSOP } from "../../engines/truth/table";
import { Card, ExplainBar, Segmented } from "../../design-system/ui";
import { StudioFrame } from "../../layout/StudioFrame";
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
  const [params] = useSearchParams();
  const [tab, setTab] = useStudioTab(TABS, "map");
  const incoming = params.get("data");
  const { prefs } = usePrefs();
  const initial = useMemo(() => readIncoming(incoming), [incoming]);
  const [count, setCount] = useState(initial?.names.length ?? 3);
  const [cells, setCells] = useState<CellValue[]>(initial?.outputs ?? seed(3));
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
    <StudioFrame icon="map" title="K-Map & Logic Simplification" description="Cycle cells through 0, 1, and X. Groups follow Gray-code adjacency, including wraparound." tabs={TABS} tab={tab} onTab={setTab} onReset={() => { setCells(seed(count)); setMode("sop"); }} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={lesson.what} why={lesson.why} notice={lesson.notice} /> : null}
      <div className="row" style={{ marginBottom: 10 }}>
        <Segmented options={["2", "3", "4", "5", "6"]} value={String(count)} onChange={(v) => setCount(Number(v))} />
        <Segmented options={["sop", "pos"]} value={mode} onChange={(v) => setMode(v as "sop" | "pos")} />
        <strong>{expression}</strong>
      </div>
      {tab === "map" ? <MapView count={count} names={names} cells={sized} groups={result.selected} hover={hover} onHover={setHover} onCycle={(index) => setCells((prev) => {
        const next = resize(prev, count);
        const cell = next[index] ?? 0;
        next[index] = cell === 0 ? 1 : cell === 1 ? "X" : 0;
        return next;
      })} /> : null}
      {tab === "primes" ? <PrimeView implicants={result.implicants} names={names} hover={hover} onHover={setHover} /> : null}
      {tab === "qm" ? <QmView result={result} /> : null}
      {tab === "circuit" ? <CircuitView names={names} cells={sized} after={mode === "sop" ? result.expression : expression} /> : null}
    </StudioFrame>
  );
}

function seed(count: number): CellValue[] {
  return Array.from({ length: 1 << count }, (_, index) => (index === 1 || index === 3 || index === 5 ? 1 : 0));
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
    <div className="grid" style={{ gridTemplateColumns: layout.maps > 1 ? "1fr 1fr" : "1fr" }}>
      {Array.from({ length: layout.maps }, (_, map) => (
        <Card key={map} title={layout.maps === 1 ? "K-map" : `${names[0] ?? "M"} map ${map.toString(2).padStart(Math.log2(layout.maps) || 1, "0")}`}>
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
                      return <td key={colCode}><button className={value === 1 ? "kcell on" : value === "X" ? "kcell x" : "kcell"} style={{ boxShadow: mark ? `inset 0 0 0 2px ${mark}` : undefined }} onClick={() => onCycle(minterm)} aria-label={"minterm " + minterm + " is " + value}>{value}<small className="tiny" style={{ display: "block" }}>m{minterm}</small></button></td>;
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
          return <button key={group.mask} className="btn-ghost" onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(index)} style={{ borderColor: GROUP_COLORS[index % GROUP_COLORS.length], marginRight: 6 }}>{"G" + (index + 1) + " " + info.term + (wraps ? " · wraps" : "") + " · drops " + info.eliminated}</button>;
        })}
        {groups.length === 0 ? <p className="muted">No selected group. The function is constant 0, or POS found no zero-cells.</p> : null}
      </Card>
    </div>
  );
}

function PrimeView({ implicants, names, hover, onHover }: { implicants: Implicant[]; names: string[]; hover: number | null; onHover: (index: number | null) => void }) {
  return (
    <Card title="Implicant chart">
      <table className="data">
        <thead><tr><th>Mask</th><th>Term</th><th>Minterms</th><th>Essential</th><th>Selected</th></tr></thead>
        <tbody>
          {implicants.map((im, index) => (
            <tr key={im.mask} className={hover === index ? "active" : ""} onMouseEnter={() => onHover(index)}>
              <td className="mono">{im.mask}</td>
              <td>{describeImplicant(im.mask, names).term}</td>
              <td>{im.minterms.join(", ")}</td>
              <td>{im.essential ? "Yes" : "No"}</td>
              <td>{im.selected ? "Cover" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function QmView({ result }: { result: ReturnType<typeof quineMcCluskey> }) {
  return (
    <div className="grid">
      {result.stages.map((stage) => (
        <Card key={stage.title} title={stage.title}>
          <pre className="mono">{stage.rows.join("\n")}</pre>
        </Card>
      ))}
    </div>
  );
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
  return (
    <div className="grid cards-2">
      <Card title="Before optimization">
        <p className="mono">{before}</p>
        <p>{beforeStats.gates} gates · depth {beforeStats.depth}</p>
      </Card>
      <Card title="After optimization">
        <p className="mono">{after}</p>
        <p>{afterStats.gates} gates · depth {afterStats.depth}</p>
        <p className="tiny">Counts are gate nodes in the expression tree, not transistors.</p>
      </Card>
    </div>
  );
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
