import { useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStudioTab } from "../../layout/useStudioTab";
import { BooleanParseError, type AstNode, evalBoolean, formatAst, parseBoolean } from "../../engines/boolean/ast";
import { BOOLEAN_LAWS } from "../../engines/boolean/laws";
import { algebraicSimplify } from "../../engines/boolean/simplify";
import { quineMcCluskey } from "../../engines/kmap/quine";
import { assignments, canonicalFromExpression, generateTruthTable, minimizeOutputs } from "../../engines/truth/table";
import { Card, ExplainBar } from "../../design-system/ui";
import { BitMark, BitSwitch } from "../shared/widgets";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "play", label: "Expression Lab" },
  { id: "laws", label: "Boolean Laws" },
  { id: "simplify", label: "Simplification" },
  { id: "forms", label: "SOP / POS" },
  { id: "terms", label: "Minterms & Maxterms" },
];

const LESSONS: Record<string, { guide: string[]; takeaways: string[]; theory: { title: string; body: string }; what: string; why: string; notice: string }> = {
  play: {
    theory: { title: "Boolean expressions", body: "AND, OR, and NOT combine 0/1 variables. The parser builds a tree; evaluation walks that tree. Two expressions are equal when they produce the same output on every assignment." },
    guide: ["Build the expression with the keypad, or type it.", "Read the Venn diagram, K-map, cube, and gate tree together.", "Toggle A, B, and C. Every figure highlights the same live row.", "Check a second expression in the equivalence panel."],
    takeaways: ["The engine parses a tree; it does not call eval().", "Each Venn region and K-map cell is one minterm.", "The gate tree, table, and diagram all evaluate that same tree."],
    what: "The keypad and the text field write the same expression.",
    why: "Every figure is a view of one truth table.",
    notice: "Venn diagrams are drawn for one, two, and three variables. Four variables use the K-map.",
  },
  laws: {
    theory: { title: "Boolean identities", body: "De Morgan, absorption, idempotent, and the other listed laws are equalities: both sides match on every input. You can try to break a law by toggling; if both sides stay equal, the identity holds in this algebra." },
    guide: ["Pick a law and read both sides.", "Toggle the variables used in that law.", "Confirm the two sides stay equal.", "Open De Morgan next to absorption and see they are different rewrites."],
    takeaways: ["A law is an identity, not a suggestion.", "De Morgan: (AB)' = A' + B' and (A+B)' = A'B'.", "Absorption: A + AB = A."],
    what: "Each law is checked by evaluating both sides on the live assignment.",
    why: "If a rewrite were wrong, some toggle would make the sides differ.",
    notice: "These are two-level Boolean identities, not timing or voltage rules.",
  },
  simplify: {
    theory: { title: "Algebraic simplification", body: "Simplification applies identities to drop redundant terms. The lab shows a sequence of rewrites toward fewer operators. Quine–McCluskey on the truth table is the same function with a different algorithm." },
    guide: ["Enter an expression such as A + AB.", "Read each rewrite step.", "Compare the simplified form with the original table.", "Try a larger SOP and see which terms survive."],
    takeaways: ["A + AB = A is absorption.", "The simplified expression must match the original truth table.", "Fewer operators is a cost metric, not a unique normal form."],
    what: "Each step names the identity it used.",
    why: "You should be able to justify every dropped literal.",
    notice: "This simplifier is teaching-scale; huge expressions belong on the K-map or QM tabs.",
  },
  forms: {
    theory: { title: "SOP and POS", body: "Sum of products is OR of AND terms (minterms or larger products). Product of sums is AND of OR terms (maxterms or larger sums). Both can represent any Boolean function. Canonical SOP lists every true minterm; canonical POS lists every false maxterm." },
    guide: ["Enter a function and read SOP and POS.", "Compare canonical (one term per row) with a reduced form.", "Toggle inputs and see which SOP term is active.", "Switch to the terms tab if you need minterm numbers."],
    takeaways: ["SOP is a union of the 1-rows.", "POS is a union of constraints from the 0-rows.", "Canonical forms are unique; reduced forms are not."],
    what: "SOP and POS are two writings of the same output column.",
    why: "Gate networks follow the form: AND-OR for SOP, OR-AND for POS.",
    notice: "Don't-cares are handled on the truth-table and K-map studios.",
  },
  terms: {
    theory: { title: "Minterms and maxterms", body: "A minterm is a product that is 1 for exactly one assignment (m0, m1, …). A maxterm is a sum that is 0 for exactly one assignment (M0, M1, …). Canonical SOP is the OR of the true minterms. Canonical POS is the AND of the false maxterms." },
    guide: ["Enter an expression and list minterm indices.", "Read the matching maxterms for the 0-rows.", "Toggle variables and see which minterm number is live.", "Write Y as Σm(…) or ΠM(…)."],
    takeaways: ["Minterm index is the binary value of the assignment.", "Each 1-row contributes one minterm to canonical SOP.", "Each 0-row contributes one maxterm to canonical POS."],
    what: "The index is the row number in the truth table.",
    why: "Numbering minterms lets you talk about a function without drawing every gate.",
    notice: "Variable order A, B, C with A as MSB matches the table in this lab.",
  },
};

export function BooleanStudio() {
  const [tab, setTab] = useStudioTab(TABS, "play");
  const [resetKey, setResetKey] = useState(0);
  const { prefs } = usePrefs();
  const lesson = LESSONS[tab] ?? LESSONS.play!;
  return (
    <StudioFrame icon="bolt" title="Boolean Algebra" description="Build an expression and watch the Venn diagram, K-map, cube, gate tree, and truth table agree." tabs={TABS} tab={tab} onTab={setTab} onReset={() => setResetKey((n) => n + 1)} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      <div key={`${tab}-${resetKey}`}>
        {prefs.explain ? <ExplainBar what={lesson.what} why={lesson.why} notice={lesson.notice} /> : null}
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

const BUILDER_KEYS = [
  { label: "A", insert: "A" },
  { label: "B", insert: "B" },
  { label: "C", insert: "C" },
  { label: "D", insert: "D" },
  { label: "AND", insert: " & " },
  { label: "OR", insert: " | " },
  { label: "NOT", insert: "!" },
  { label: "XOR", insert: " ^ " },
  { label: "NAND", insert: " NAND " },
  { label: "NOR", insert: " NOR " },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "′", insert: "'" },
  { label: "0", insert: "0" },
  { label: "1", insert: "1" },
];

const PRESETS = ["(A & B) | !C", "A & B", "A | B", "(A | B)'", "A + A B", "AB + BC + CA", "A XOR B"];

function PlayLab() {
  const [params] = useSearchParams();
  const expr = useExpression(params.get("expr") || "(A & B) | !C");
  const other = useExpression("A·(B + C')");
  const [assign, setAssign] = useState<Record<string, 0 | 1>>({ A: 1, B: 0, C: 1 });
  const variables = expr.parsed.ok ? expr.parsed.variables : [];
  const liveAssign = Object.fromEntries(variables.map((name) => [name, assign[name] ?? 0])) as Record<string, 0 | 1>;
  const output = expr.parsed.ok ? evalBoolean(expr.parsed.ast, liveAssign) : null;
  const table = expr.parsed.ok ? generateTruthTable(expr.parsed.ast) : null;
  const same = expr.parsed.ok && other.parsed.ok ? sameTables(expr.text, other.text) : null;
  const active = variables.map((name) => assign[name] ?? 0).join("");
  return (
    <div className="bool-lab">
      <div className="bool-span">
        <Card title="Expression builder">
          <div className="bool-keys" role="group" aria-label="Insert Boolean tokens">
            {BUILDER_KEYS.map((key) => (
              <button key={key.label} type="button" onClick={() => expr.setText((current) => `${current}${key.insert}`.replace(/^\s+/, ""))}>{key.label}</button>
            ))}
            <button type="button" onClick={() => expr.setText((current) => current.slice(0, -1))}>⌫</button>
            <button type="button" onClick={() => expr.setText("")}>Clear</button>
          </div>
          <input className="text-input" aria-label="Boolean expression" value={expr.text} onChange={(e) => expr.setText(e.target.value)} />
          <div className="bool-presets">
            {PRESETS.map((preset) => (
              <button key={preset} type="button" className={preset === expr.text ? "on" : ""} onClick={() => expr.setText(preset)}>{preset}</button>
            ))}
          </div>
          {expr.parsed.ok ? <p className="expr">{formatAst(expr.parsed.ast)}</p> : <p>{expr.parsed.message}</p>}
          <div className="row">
            {variables.map((name) => (
              <BitSwitch key={name} label={name} on={(assign[name] ?? 0) === 1} onChange={(next) => setAssign((prev) => ({ ...prev, [name]: next ? 1 : 0 }))} />
            ))}
            <strong className={output === 1 ? "bool-y on" : "bool-y"}>Y = {output === null ? "—" : <BitMark value={output} />}</strong>
          </div>
        </Card>
      </div>
      <Card title="Venn diagram">
        {expr.parsed.ok ? <VennDiagram ast={expr.parsed.ast} names={variables} assign={liveAssign} /> : <p className="muted">Fix the expression to shade the diagram.</p>}
      </Card>
      <Card title="Gate tree">
        {expr.parsed.ok ? <GateTree node={expr.parsed.ast} assign={liveAssign} /> : <p className="muted">Fix the expression to draw the gates.</p>}
        <p className="tiny">Blue nodes are 1. White nodes are 0. The bottom node is Y.</p>
      </Card>
      <Card title="Karnaugh map">
        {expr.parsed.ok ? <Kmap ast={expr.parsed.ast} names={variables} assign={liveAssign} /> : <p className="muted">Fix the expression to fill the map.</p>}
      </Card>
      <Card title={variables.length === 3 ? "Boolean cube" : "Minterm chart"}>
        {expr.parsed.ok && variables.length === 3 ? <BooleanCube ast={expr.parsed.ast} names={variables} assign={liveAssign} /> : null}
        {expr.parsed.ok && variables.length !== 3 && table ? <MintermChart table={table} active={active} /> : null}
        {!expr.parsed.ok ? <p className="muted">Fix the expression to draw this figure.</p> : null}
      </Card>
      <Card title="Truth table">
        {table ? <Table table={table} active={active} /> : <p className="muted">The table appears when the expression parses.</p>}
      </Card>
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

function regionValue(ast: AstNode, names: string[], bits: Array<0 | 1>): 0 | 1 {
  const row: Record<string, 0 | 1> = {};
  names.forEach((name, index) => { row[name] = bits[index] ?? 0; });
  return evalBoolean(ast, row);
}

function isLive(names: string[], bits: Array<0 | 1>, assign: Record<string, 0 | 1>): boolean {
  return names.every((name, index) => (assign[name] ?? 0) === (bits[index] ?? 0));
}

function shade(value: 0 | 1): string {
  return value === 1 ? "#2f6fed" : "#e7eef8";
}

function VennDiagram({ ast, names, assign }: { ast: AstNode; names: string[]; assign: Record<string, 0 | 1> }) {
  if (names.length > 3) return <p className="muted">Venn diagrams here cover one, two, and three variables. Use the K-map for {names.join(", ")}.</p>;
  if (names.length === 0) {
    const value = evalBoolean(ast, {});
    return <p className="expr">Constant {value}</p>;
  }
  return (
    <>
      {names.length === 1 ? <Venn1 ast={ast} name={names[0] ?? "A"} assign={assign} /> : null}
      {names.length === 2 ? <Venn2 ast={ast} names={names} assign={assign} /> : null}
      {names.length === 3 ? <Venn3 ast={ast} names={names} assign={assign} /> : null}
      <RegionLegend ast={ast} names={names} assign={assign} />
    </>
  );
}

function Venn1({ ast, name, assign }: { ast: AstNode; name: string; assign: Record<string, 0 | 1> }) {
  const inside = regionValue(ast, [name], [1]);
  const outside = regionValue(ast, [name], [0]);
  return (
    <svg viewBox="0 0 280 180" className="bool-figure" role="img" aria-label={`One-variable Venn diagram for ${name}`}>
      <rect width="280" height="180" fill={shade(outside)} />
      <circle cx="150" cy="96" r="62" fill={shade(inside)} stroke="#2f6fed" strokeWidth="2" />
      <text x="150" y="92" textAnchor="middle" fontSize="16" fontWeight="700" fill={inside ? "#fff" : "#1e293b"}>{name}={inside}</text>
      <text x="24" y="28" fontSize="13" fontWeight="700" fill={outside ? "#fff" : "#334155"}>{name}′={outside}</text>
      {assign[name] === 1 ? <circle cx="150" cy="118" r="6" fill="#f59e0b" /> : <circle cx="36" cy="42" r="6" fill="#f59e0b" />}
    </svg>
  );
}

function Venn2({ ast, names, assign }: { ast: AstNode; names: string[]; assign: Record<string, 0 | 1> }) {
  const id = useId().replace(/:/g, "");
  const a = names[0] ?? "A";
  const b = names[1] ?? "B";
  const onlyA = regionValue(ast, names, [1, 0]);
  const onlyB = regionValue(ast, names, [0, 1]);
  const both = regionValue(ast, names, [1, 1]);
  const none = regionValue(ast, names, [0, 0]);
  return (
    <svg viewBox="0 0 280 190" className="bool-figure" role="img" aria-label="Two-variable Venn diagram">
      <defs>
        <clipPath id={`${id}-a`}><circle cx="112" cy="100" r="64" /></clipPath>
        <clipPath id={`${id}-b`}><circle cx="176" cy="100" r="64" /></clipPath>
        <mask id={`${id}-notb`}><rect width="280" height="190" fill="white" /><circle cx="176" cy="100" r="64" fill="black" /></mask>
        <mask id={`${id}-nota`}><rect width="280" height="190" fill="white" /><circle cx="112" cy="100" r="64" fill="black" /></mask>
      </defs>
      <rect width="280" height="190" fill={shade(none)} />
      <g clipPath={`url(#${id}-a)`} mask={`url(#${id}-notb)`}><rect width="280" height="190" fill={shade(onlyA)} /></g>
      <g clipPath={`url(#${id}-b)`} mask={`url(#${id}-nota)`}><rect width="280" height="190" fill={shade(onlyB)} /></g>
      <g clipPath={`url(#${id}-a)`}><g clipPath={`url(#${id}-b)`}><rect width="280" height="190" fill={shade(both)} /></g></g>
      <circle cx="112" cy="100" r="64" fill="none" stroke="#2f6fed" strokeWidth="2" />
      <circle cx="176" cy="100" r="64" fill="none" stroke="#e11d48" strokeWidth="2" />
      <SetName x={78} y={36} color="#2f6fed" name={a} />
      <SetName x={208} y={36} color="#e11d48" name={b} />
      <text x="78" y="104" textAnchor="middle" fontSize="13" fontWeight="700" fill={onlyA ? "#fff" : "#1e293b"}>{onlyA}</text>
      <text x="208" y="104" textAnchor="middle" fontSize="13" fontWeight="700" fill={onlyB ? "#fff" : "#1e293b"}>{onlyB}</text>
      <text x="144" y="104" textAnchor="middle" fontSize="13" fontWeight="700" fill={both ? "#fff" : "#1e293b"}>{both}</text>
      <OutsideNote value={none} />
      <LiveDot names={names} assign={assign} spots={[[1, 0, 78, 118], [0, 1, 208, 118], [1, 1, 144, 118], [0, 0, 28, 36]]} />
    </svg>
  );
}

function Venn3({ ast, names, assign }: { ast: AstNode; names: string[]; assign: Record<string, 0 | 1> }) {
  const id = useId().replace(/:/g, "");
  const [a, b, c] = [names[0] ?? "A", names[1] ?? "B", names[2] ?? "C"];
  const onlyA = regionValue(ast, names, [1, 0, 0]);
  const onlyB = regionValue(ast, names, [0, 1, 0]);
  const onlyC = regionValue(ast, names, [0, 0, 1]);
  const ab = regionValue(ast, names, [1, 1, 0]);
  const ac = regionValue(ast, names, [1, 0, 1]);
  const bc = regionValue(ast, names, [0, 1, 1]);
  const abc = regionValue(ast, names, [1, 1, 1]);
  const none = regionValue(ast, names, [0, 0, 0]);
  return (
    <svg viewBox="0 0 280 230" className="bool-figure" role="img" aria-label="Three-variable Venn diagram">
      <defs>
        <clipPath id={`${id}-a`}><circle cx="112" cy="96" r="62" /></clipPath>
        <clipPath id={`${id}-b`}><circle cx="176" cy="96" r="62" /></clipPath>
        <clipPath id={`${id}-c`}><circle cx="144" cy="148" r="62" /></clipPath>
        <mask id={`${id}-notbc`}><rect width="280" height="230" fill="white" /><circle cx="176" cy="96" r="62" fill="black" /><circle cx="144" cy="148" r="62" fill="black" /></mask>
        <mask id={`${id}-notac`}><rect width="280" height="230" fill="white" /><circle cx="112" cy="96" r="62" fill="black" /><circle cx="144" cy="148" r="62" fill="black" /></mask>
        <mask id={`${id}-notab`}><rect width="280" height="230" fill="white" /><circle cx="112" cy="96" r="62" fill="black" /><circle cx="176" cy="96" r="62" fill="black" /></mask>
        <mask id={`${id}-notc`}><rect width="280" height="230" fill="white" /><circle cx="144" cy="148" r="62" fill="black" /></mask>
        <mask id={`${id}-notb`}><rect width="280" height="230" fill="white" /><circle cx="176" cy="96" r="62" fill="black" /></mask>
        <mask id={`${id}-nota`}><rect width="280" height="230" fill="white" /><circle cx="112" cy="96" r="62" fill="black" /></mask>
      </defs>
      <rect width="280" height="230" rx="12" fill={shade(none)} />
      <g clipPath={`url(#${id}-a)`} mask={`url(#${id}-notbc)`}><rect width="280" height="230" fill={shade(onlyA)} /></g>
      <g clipPath={`url(#${id}-b)`} mask={`url(#${id}-notac)`}><rect width="280" height="230" fill={shade(onlyB)} /></g>
      <g clipPath={`url(#${id}-c)`} mask={`url(#${id}-notab)`}><rect width="280" height="230" fill={shade(onlyC)} /></g>
      <g clipPath={`url(#${id}-a)`}><g clipPath={`url(#${id}-b)`} mask={`url(#${id}-notc)`}><rect width="280" height="230" fill={shade(ab)} /></g></g>
      <g clipPath={`url(#${id}-a)`}><g clipPath={`url(#${id}-c)`} mask={`url(#${id}-notb)`}><rect width="280" height="230" fill={shade(ac)} /></g></g>
      <g clipPath={`url(#${id}-b)`}><g clipPath={`url(#${id}-c)`} mask={`url(#${id}-nota)`}><rect width="280" height="230" fill={shade(bc)} /></g></g>
      <g clipPath={`url(#${id}-a)`}><g clipPath={`url(#${id}-b)`}><g clipPath={`url(#${id}-c)`}><rect width="280" height="230" fill={shade(abc)} /></g></g></g>
      <circle cx="112" cy="96" r="62" fill="none" stroke="#2f6fed" strokeWidth="2" />
      <circle cx="176" cy="96" r="62" fill="none" stroke="#e11d48" strokeWidth="2" />
      <circle cx="144" cy="148" r="62" fill="none" stroke="#12b76a" strokeWidth="2" />
      <SetName x={46} y={52} color="#2f6fed" name={a} />
      <SetName x={210} y={28} color="#e11d48" name={b} />
      <SetName x={144} y={214} color="#067647" name={c} />
      <RegionText x={72} y={86} value={onlyA} />
      <RegionText x={214} y={86} value={onlyB} />
      <RegionText x={144} y={186} value={onlyC} />
      <RegionText x={144} y={68} value={ab} />
      <RegionText x={108} y={142} value={ac} />
      <RegionText x={180} y={142} value={bc} />
      <RegionText x={144} y={112} value={abc} />
      <OutsideNote value={none} />
      <LiveDot names={names} assign={assign} spots={[
        [1, 0, 0, 72, 100], [0, 1, 0, 214, 100], [0, 0, 1, 144, 198],
        [1, 1, 0, 144, 82], [1, 0, 1, 108, 156], [0, 1, 1, 180, 156],
        [1, 1, 1, 144, 126], [0, 0, 0, 24, 32],
      ]} />
    </svg>
  );
}

function SetName({ x, y, color, name }: { x: number; y: number; color: string; name: string }) {
  const width = Math.max(20, name.length * 8 + 12);
  return (
    <g>
      <rect x={x - width / 2} y={y - 12} width={width} height={16} rx="8" fill="white" stroke={color} />
      <text x={x} y={y} textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{name}</text>
    </g>
  );
}

function OutsideNote({ value }: { value: 0 | 1 }) {
  return (
    <g>
      <rect x="8" y="6" width="72" height="16" rx="8" fill="white" />
      <text x="44" y="17" textAnchor="middle" fontSize="10" fontWeight="800" fill="#334155">outside {value}</text>
    </g>
  );
}

function RegionText({ x, y, value }: { x: number; y: number; value: 0 | 1 }) {
  return <text x={x} y={y} textAnchor="middle" fontSize="12" fontWeight="800" fill={value ? "#fff" : "#1e293b"}>{value}</text>;
}

function LiveDot({ names, assign, spots }: { names: string[]; assign: Record<string, 0 | 1>; spots: number[][] }) {
  const spot = spots.find((row) => isLive(names, row.slice(0, names.length) as Array<0 | 1>, assign));
  if (!spot) return null;
  const x = spot[names.length] ?? 0;
  const y = spot[names.length + 1] ?? 0;
  return <circle cx={x} cy={y} r="5" fill="none" stroke="#f59e0b" strokeWidth="3" />;
}

function RegionLegend({ ast, names, assign }: { ast: AstNode; names: string[]; assign: Record<string, 0 | 1> }) {
  const count = 1 << names.length;
  return (
    <div className="bool-legend">
      {Array.from({ length: count }, (_, index) => {
        const bits = names.map((_, bit) => ((index >> (names.length - 1 - bit)) & 1) as 0 | 1);
        const value = regionValue(ast, names, bits);
        const label = names.map((name, bit) => (bits[bit] ? name : `${name}′`)).join("");
        return <span key={index} className={`${value ? "on" : ""} ${isLive(names, bits, assign) ? "live" : ""}`}>m{index} {label}={value}</span>;
      })}
    </div>
  );
}

function GateTree({ node, assign }: { node: AstNode; assign: Record<string, 0 | 1> }) {
  const value = evalBoolean(node, assign);
  const label = node.type === "VAR" ? node.name : node.type === "CONST" ? String(node.value) : node.type;
  return (
    <div className="bool-branch">
      {node.type === "NOT" ? <GateTree node={node.child} assign={assign} /> : null}
      {node.type !== "VAR" && node.type !== "CONST" && node.type !== "NOT" ? (
        <div className="bool-kids">
          <GateTree node={node.left} assign={assign} />
          <GateTree node={node.right} assign={assign} />
        </div>
      ) : null}
      <div className={value ? "bool-node on" : "bool-node"}>{label}<small>{value}</small></div>
    </div>
  );
}

function Kmap({ ast, names, assign }: { ast: AstNode; names: string[]; assign: Record<string, 0 | 1> }) {
  if (names.length === 0 || names.length > 4) return <p className="muted">This map covers one to four variables.</p>;
  const rows = names.length === 4 ? ["00", "01", "11", "10"] : names.length === 1 ? [""] : ["0", "1"];
  const cols = names.length >= 3 ? ["00", "01", "11", "10"] : ["0", "1"];
  const rowLabel = names.length === 4 ? names.slice(0, 2).join("") : names[0] ?? "";
  const colLabel = names.length === 4 ? names.slice(2).join("") : names.length === 3 ? names.slice(1).join("") : names.length === 2 ? names[1] ?? "" : "F";
  return (
    <table className="bool-k">
      <thead>
        <tr><th>{names.length === 1 ? rowLabel : `${rowLabel}\\${colLabel}`}</th>{cols.map((col) => <th key={col}>{col}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row || "f"}>
            <th>{row || "F"}</th>
            {cols.map((col) => {
              const code = `${row}${col}`;
              const bits = code.split("").map((ch) => (ch === "1" ? 1 : 0)) as Array<0 | 1>;
              const value = regionValue(ast, names, bits);
              const live = isLive(names, bits, assign);
              return <td key={code} className={`${value ? "on" : "off"} ${live ? "live" : ""}`}>{value}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CUBE: Array<{ bits: [0 | 1, 0 | 1, 0 | 1]; x: number; y: number }> = [
  { bits: [0, 0, 0], x: 78, y: 132 },
  { bits: [1, 0, 0], x: 178, y: 132 },
  { bits: [0, 1, 0], x: 46, y: 70 },
  { bits: [1, 1, 0], x: 146, y: 70 },
  { bits: [0, 0, 1], x: 128, y: 176 },
  { bits: [1, 0, 1], x: 228, y: 176 },
  { bits: [0, 1, 1], x: 96, y: 114 },
  { bits: [1, 1, 1], x: 196, y: 114 },
];

function BooleanCube({ ast, names, assign }: { ast: AstNode; names: string[]; assign: Record<string, 0 | 1> }) {
  const edges = CUBE.flatMap((from, index) => CUBE.slice(index + 1).filter((to) => from.bits.filter((bit, bitIndex) => bit !== to.bits[bitIndex]).length === 1).map((to) => [from, to] as const));
  return (
    <svg viewBox="0 0 280 210" className="bool-figure" role="img" aria-label="Three-variable Boolean cube">
      {edges.map(([from, to]) => <line key={`${from.x}-${to.x}-${from.y}-${to.y}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#b7c6de" strokeWidth="2" />)}
      {CUBE.map((vertex) => {
        const value = regionValue(ast, names, [...vertex.bits]);
        const live = isLive(names, [...vertex.bits], assign);
        const label = vertex.bits.join("");
        return (
          <g key={label}>
            <circle cx={vertex.x} cy={vertex.y} r="16" fill={shade(value)} stroke={live ? "#f59e0b" : "#94a3b8"} strokeWidth={live ? 3 : 1.5} />
            <text x={vertex.x} y={vertex.y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={value ? "#fff" : "#1e293b"}>{value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MintermChart({ table, active }: { table: ReturnType<typeof generateTruthTable>; active: string }) {
  return (
    <div className="bool-bars" role="img" aria-label="Minterm bar chart">
      {table.rows.map((row) => (
        <div key={row.index} className={`${row.output ? "on" : ""} ${active === row.values.join("") ? "live" : ""}`}>
          <i />
          <span>m{row.index}</span>
        </div>
      ))}
    </div>
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
          {["A", "B", "C"].map((name) => <BitSwitch key={name} label={name} on={bits[name] === 1} onChange={(next) => setBits((p) => ({ ...p, [name]: next ? 1 : 0 }))} />)}
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
