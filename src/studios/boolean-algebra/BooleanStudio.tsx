import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BooleanParseError, type AstNode, evalBoolean, formatAst, parseBoolean } from "../../engines/boolean/ast";
import { BOOLEAN_LAWS } from "../../engines/boolean/laws";
import { algebraicSimplify } from "../../engines/boolean/simplify";
import { quineMcCluskey } from "../../engines/kmap/quine";
import { assignments, canonicalFromExpression, generateTruthTable, minimizeOutputs } from "../../engines/truth/table";
import { Card, ExplainBar } from "../../design-system/ui";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "play", label: "Expression Lab" },
  { id: "laws", label: "Boolean Laws" },
  { id: "simplify", label: "Simplification" },
  { id: "forms", label: "SOP / POS" },
  { id: "terms", label: "Minterms & Maxterms" },
];

export function BooleanStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "play";
  const [resetKey, setResetKey] = useState(0);
  const { prefs } = usePrefs();
  return (
    <StudioFrame icon="bolt" title="Boolean Algebra" description="Type an expression, toggle its variables, and see the tree, table, and circuit agree." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} onReset={() => setResetKey((n) => n + 1)} guide={["Enter A, B, and C with AND, OR, or NOT", "Toggle variables and read the live output", "Check a law on both sides", "Compare SOP with POS"]} takeaways={["Operators are parsed into a tree, never eval()", "Laws are identities you can falsify by toggling", "Canonical SOP lists every true row"]}>
      <div key={resetKey}>
        {prefs.explain ? <ExplainBar what="The expression is tokenized into an AST." why="Each operator node computes from its children, so a toggle only changes the variables you touch." notice="A true row in the table is a minterm." /> : null}
        {tab === "play" ? <PlayLab /> : null}
        {tab === "laws" ? <LawsLab /> : null}
        {tab === "simplify" ? <SimplifyLab /> : null}
        {tab === "forms" ? <FormsLab /> : null}
        {tab === "terms" ? <TermsLab /> : null}
      </div>
    </StudioFrame>
  );
}

function useExpression(initial: string) {
  const [text, setText] = useState(initial);
  const parsed = useMemo(() => {
    try { return { ok: true as const, ...parseBoolean(text) }; }
    catch (error) { return { ok: false as const, message: error instanceof BooleanParseError ? error.message : "Could not parse" }; }
  }, [text]);
  return { text, setText, parsed };
}

function Tree({ node }: { node: AstNode }) {
  if (node.type === "VAR" || node.type === "CONST") return <div className="tree-node">{node.type === "VAR" ? node.name : node.value}</div>;
  if (node.type === "NOT") return <div className="tree"><div className="tree-node">NOT</div><Tree node={node.child} /></div>;
  return <div className="tree"><div className="tree-node">{node.type}</div><div className="tree-kids"><Tree node={node.left} /><Tree node={node.right} /></div></div>;
}

function PlayLab() {
  const [params] = useSearchParams();
  const expr = useExpression(params.get("expr") || "(A & B) | !C");
  const other = useExpression("A·(B + C')");
  const [assign, setAssign] = useState<Record<string, 0 | 1>>({ A: 1, B: 0, C: 1 });
  const variables = expr.parsed.ok ? expr.parsed.variables : [];
  const output = expr.parsed.ok ? evalBoolean(expr.parsed.ast, Object.fromEntries(variables.map((name) => [name, assign[name] ?? 0]))) : null;
  const table = expr.parsed.ok ? generateTruthTable(expr.parsed.ast) : null;
  const same = expr.parsed.ok && other.parsed.ok ? sameTables(expr.text, other.text) : null;
  return (
    <div className="grid">
      <div className="grid cards-2">
        <Card title="Expression">
          <input className="text-input" aria-label="Boolean expression" value={expr.text} onChange={(e) => expr.setText(e.target.value)} />
          {expr.parsed.ok ? <p className="expr">{formatAst(expr.parsed.ast)}</p> : <p>{expr.parsed.message}</p>}
          <div className="row">
            {variables.map((name) => (
              <button key={name} className={(assign[name] ?? 0) ? "bit on" : "bit"} onClick={() => setAssign((prev) => ({ ...prev, [name]: prev[name] === 1 ? 0 : 1 }))}>{name}={assign[name] ?? 0}</button>
            ))}
            <strong>Y = {output ?? "—"}</strong>
          </div>
        </Card>
        <Card title="Expression tree">{expr.parsed.ok ? <Tree node={expr.parsed.ast} /> : <p className="muted">Fix the expression to draw the tree.</p>}</Card>
      </div>
      <div className="grid cards-2">
        <Card title="Truth table">
          {table ? <Table table={table} active={variables.map((name) => assign[name] ?? 0).join("")} /> : null}
        </Card>
        <Card title="Venn, two variables">
          {variables.length === 2 && expr.parsed.ok ? <Venn expression={expr.parsed.ast} names={variables} /> : <p className="muted">Shown when the expression uses exactly two variables.</p>}
        </Card>
      </div>
      <Card title="Equivalence checker">
        <input className="text-input" aria-label="Second expression" value={other.text} onChange={(e) => other.setText(e.target.value)} />
        <p>{same === null ? "Both expressions need to parse." : same ? "Equivalent. They produce the same truth table." : "Not equivalent. At least one row differs."}</p>
      </Card>
    </div>
  );
}

function Table({ table, active }: { table: ReturnType<typeof generateTruthTable>; active?: string }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{table.variables.map((v) => <th key={v}>{v}</th>)}<th>F</th></tr></thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.index} className={active === row.values.join("") ? "active" : ""}>
              {row.values.map((value, index) => <td key={index}>{value}</td>)}
              <td className={row.output ? "one" : ""}>{row.output}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Venn({ expression, names }: { expression: AstNode | null; names: string[] }) {
  const [a, b] = names.length === 2 ? names : ["A", "B"];
  const region = (av: 0 | 1, bv: 0 | 1) => expression ? evalBoolean(expression, { [a ?? "A"]: av, [b ?? "B"]: bv }) : 0;
  return (
    <svg viewBox="0 0 220 140" width="100%" height="140" role="img" aria-label="Two-variable Venn diagram">
      <circle cx="90" cy="70" r="48" fill={region(1, 0) ? "#dbe7ff" : "#f8fafc"} stroke="#2F6FED" />
      <circle cx="130" cy="70" r="48" fill={region(0, 1) ? "#fde2e1" : "transparent"} stroke="#E11D48" />
      <circle cx="110" cy="70" r="22" fill={region(1, 1) ? "#c7d7fe" : "transparent"} />
      <text x="70" y="30" fontSize="12">{a}</text>
      <text x="150" y="30" fontSize="12">{b}</text>
    </svg>
  );
}

function sameTables(left: string, right: string): boolean {
  try {
    const a = parseBoolean(left);
    const b = parseBoolean(right);
    const names = [...new Set([...a.variables, ...b.variables])].sort();
    return assignments(names).every((row) => evalBoolean(a.ast, row) === evalBoolean(b.ast, row));
  } catch { return false; }
}

function LawsLab() {
  const [bits, setBits] = useState<Record<string, 0 | 1>>({ A: 1, B: 0, C: 1 });
  return (
    <div className="grid">
      <Card title="Toggle the variables">
        <div className="row">
          {["A", "B", "C"].map((name) => <button key={name} className={bits[name] ? "bit on" : "bit"} onClick={() => setBits((p) => ({ ...p, [name]: p[name] === 1 ? 0 : 1 }))}>{name}={bits[name]}</button>)}
        </div>
      </Card>
      <div className="grid cards-2">
        {BOOLEAN_LAWS.map((law) => {
          const left = safeEval(law.pair[0], bits);
          const right = safeEval(law.pair[1], bits);
          return (
            <Card key={law.id} title={law.name}>
              <p className="mono">{law.pair[0]} = {law.pair[1]}</p>
              <p>{left} and {right} {left === right ? "match" : "differ"}</p>
              <p className="tiny">{law.note}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function safeEval(expression: string, bits: Record<string, 0 | 1>): string {
  try {
    const parsed = parseBoolean(expression);
    const assign = Object.fromEntries(parsed.variables.map((name) => [name, bits[name] ?? 0]));
    return String(evalBoolean(parsed.ast, assign));
  } catch { return "—"; }
}

function SimplifyLab() {
  const expr = useExpression("A + A B");
  const { earn } = usePrefs();
  const steps = expr.parsed.ok ? algebraicSimplify(expr.parsed.ast) : null;
  const qm = expr.parsed.ok ? quineFromAst(expr.parsed.ast) : null;
  return (
    <Card title="Step-by-step simplification">
      <input className="text-input" aria-label="Expression to simplify" value={expr.text} onChange={(e) => expr.setText(e.target.value)} />
      {steps?.steps.map((step, index) => <p key={index}><strong>{index + 1}. {step.law}</strong> {step.before} → {step.after}</p>)}
      {steps && steps.steps.length === 0 ? <p className="muted">No local algebraic rewrite fired. The prime-implicant cover is still computed.</p> : null}
      {qm ? <p>Quine–McCluskey cover: <span className="expr" style={{ fontSize: 16 }}>{qm}</span></p> : null}
      <button className="btn-ghost" onClick={() => earn("absorb")}>Mark the absorption challenge</button>
    </Card>
  );
}

function quineFromAst(ast: AstNode): string {
  const table = generateTruthTable(ast);
  if (table.variables.length > 6) return "Use 6 variables or fewer";
  return quineMcCluskey(table.minterms, [], table.variables.length, table.variables).expression;
}

function FormsLab() {
  const [count, setCount] = useState(3);
  const names = "ABCDEF".slice(0, count).split("");
  const [outputs, setOutputs] = useState<Array<0 | 1 | "X">>(Array.from({ length: 8 }, (_, i) => (i % 2 === 1 ? 1 : 0)));
  const sized = outputs.slice(0, 1 << count);
  while (sized.length < (1 << count)) sized.push(0);
  const sop = minimizeOutputs(names, sized, "sop");
  const pos = minimizeOutputs(names, sized, "pos");
  const canonical = useMemo(() => {
    try { return canonicalFromExpression(sop === "0" || sop === "1" ? sop : sop.replace(/·/g, " & ").replace(/\+/g, " | ").replace(/'/g, "'")); }
    catch { return null; }
  }, [sop]);
  return (
    <div className="grid cards-2">
      <Card title="Truth table">
        <label className="field">Variables
          <input className="text-input" type="number" min={2} max={4} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        {assignments(names).map((row, index) => (
          <div key={index} className="row">
            <span className="mono">{names.map((name) => row[name]).join("")}</span>
            <button className="btn-ghost" onClick={() => setOutputs(() => {
              const next = [...sized];
              const cell = next[index] ?? 0;
              next[index] = cell === 0 ? 1 : cell === 1 ? "X" : 0;
              return next;
            })}>{sized[index]}</button>
          </div>
        ))}
      </Card>
      <Card title="Forms">
        <p>Minimal SOP <strong>{sop}</strong></p>
        <p>Minimal POS <strong>{pos}</strong></p>
        {canonical ? <p className="tiny">Canonical SOP {canonical.sop}</p> : null}
      </Card>
    </div>
  );
}

function TermsLab() {
  const [count, setCount] = useState(3);
  const [picked, setPicked] = useState(1);
  const names = "ABC".slice(0, count).split("");
  const rows = assignments(names.length ? names : ["A"]);
  return (
    <Card title="Minterms and maxterms">
      <input type="number" min={1} max={3} value={count} aria-label="Variable count" onChange={(e) => setCount(Number(e.target.value))} />
      <table className="data">
        <tbody>
          {rows.map((row, index) => {
            const values = names.map((name) => row[name] ?? 0);
            const min = names.map((name, bit) => ((values[bit] ?? 0) === 1 ? name : `${name}'`)).join("");
            const max = names.map((name, bit) => ((values[bit] ?? 0) === 0 ? name : `${name}'`)).join("+");
            return (
              <tr key={index} className={picked === index ? "active" : ""} onClick={() => setPicked(index)}>
                <td>m{index} = {min}</td>
                <td>M{index} = ({max})</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
