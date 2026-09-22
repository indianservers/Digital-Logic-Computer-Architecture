import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BooleanParseError, evalBoolean, parseBoolean } from "../../engines/boolean/ast";
import { assignments, generateTruthTable, minimizeOutputs, tableFromOutputs, truthTableToCanonicalPOS, truthTableToCanonicalSOP } from "../../engines/truth/table";
import { Card, ExplainBar, Segmented } from "../../design-system/ui";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "from-expr", label: "Expression → Table" },
  { id: "from-table", label: "Table → Expression" },
];

export function TruthStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "from-expr";
  const { prefs } = usePrefs();
  const [resetKey, setResetKey] = useState(0);
  return (
    <StudioFrame icon="table" title="Truth Tables" description="Generate every input row, or edit the outputs and read the canonical forms." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} onReset={() => setResetKey((n) => n + 1)} guide={["Enter Y = A·B + C", "Highlight the row that matches the switches", "Flip output cells", "Open the same outputs in the K-map"]} takeaways={["Rows are generated, not hardcoded", "A 1-row is a minterm", "A 0-row is a maxterm"]}>
      <div key={resetKey}>
        {prefs.explain ? <ExplainBar what="The highlighted row is the current switch setting." why="The expression is evaluated on every combination of its variables." notice="Editing an output cell changes the canonical SOP and POS." /> : null}
        {tab === "from-expr" ? <FromExpr /> : <FromTable />}
      </div>
    </StudioFrame>
  );
}

function FromExpr() {
  const [text, setText] = useState("A B + C");
  const [assign, setAssign] = useState<Record<string, 0 | 1>>({});
  const parsed = useMemo(() => {
    try { return parseBoolean(text); }
    catch (error) { return error instanceof BooleanParseError ? error.message : "Invalid expression"; }
  }, [text]);
  if (typeof parsed === "string") return <Card title="Expression"><input className="text-input" value={text} aria-label="Expression" onChange={(e) => setText(e.target.value)} /><p>{parsed}</p></Card>;
  const table = generateTruthTable(parsed.ast);
  const current = parsed.variables.map((name) => assign[name] ?? 0);
  return (
    <div className="grid cards-2">
      <Card title="Expression">
        <input className="text-input" aria-label="Expression" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          {parsed.variables.map((name) => (
            <button key={name} className={(assign[name] ?? 0) ? "bit on" : "bit"} onClick={() => setAssign((prev) => ({ ...prev, [name]: prev[name] === 1 ? 0 : 1 }))}>{name}={assign[name] ?? 0}</button>
          ))}
        </div>
        <p>Y = {evalBoolean(parsed.ast, Object.fromEntries(parsed.variables.map((name) => [name, assign[name] ?? 0])))}</p>
      </Card>
      <Card title={`${table.rows.length} rows`}>
        <table className="data">
          <thead><tr>{table.variables.map((v) => <th key={v}>{v}</th>)}<th>Y</th></tr></thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.index} className={row.values.join() === current.join() ? "active" : ""}>
                {row.values.map((value, i) => <td key={i}>{value}</td>)}
                <td className={row.output ? "one" : ""}>{row.output}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny">Canonical SOP {truthTableToCanonicalSOP(table)}</p>
      </Card>
    </div>
  );
}

function FromTable() {
  const [count, setCount] = useState(3);
  const names = "ABCDEF".slice(0, count).split("");
  const [outputs, setOutputs] = useState<Array<0 | 1 | "X">>(Array.from({ length: 64 }, () => 0 as 0 | 1 | "X"));
  const size = 1 << count;
  const slice = outputs.slice(0, size);
  const table = tableFromOutputs(names, slice.map((cell) => (cell === "X" ? 0 : cell)));
  const sop = minimizeOutputs(names, slice, "sop");
  const pos = minimizeOutputs(names, slice, "pos");
  const payload = encodeURIComponent(JSON.stringify({ names, outputs: slice }));
  return (
    <div className="grid cards-2">
      <Card title="Manual outputs" action={<Segmented options={["2", "3", "4", "5", "6"]} value={String(count)} onChange={(v) => setCount(Number(v))} />}>
        <div className="table-wrap" style={{ maxHeight: 360 }}>
          <table className="data">
            <thead><tr><th>#</th>{names.map((n) => <th key={n}>{n}</th>)}<th>F</th></tr></thead>
            <tbody>
              {assignments(names).map((row, index) => (
                <tr key={index}>
                  <td>{index}</td>
                  {names.map((name) => <td key={name}>{row[name]}</td>)}
                  <td><button className="btn-ghost" onClick={() => setOutputs((prev) => {
                    const next = prev.slice();
                    const cell = next[index] ?? 0;
                    next[index] = cell === 0 ? 1 : cell === 1 ? "X" : 0;
                    return next;
                  })}>{slice[index] ?? 0}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Derived expressions">
        <p>Canonical SOP {truthTableToCanonicalSOP(table)}</p>
        <p>Canonical POS {truthTableToCanonicalPOS(table)}</p>
        <p>Minimal SOP {sop}</p>
        <p>Minimal POS {pos}</p>
        <Link className="btn-primary" to={`/studios/kmap?tab=map&data=${payload}`}>Open in K-map</Link>
      </Card>
    </div>
  );
}
