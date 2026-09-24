import { evalBoolean, parseBoolean, type AstNode } from "../../engines/boolean/ast";

interface DrawNode {
  id: string;
  label: string;
  x: number;
  y: number;
  value: 0 | 1;
  term: string;
}

interface DrawWire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: 0 | 1;
}

export function CircuitView({
  expression,
  names,
  values,
  onToggle,
  title,
}: {
  expression: string;
  names: string[];
  values: Record<string, 0 | 1>;
  onToggle: (name: string) => void;
  title: string;
}) {
  const drawing = draw(expression, values);
  const output = drawing?.output ?? 0;
  return (
    <div className="twb-circuit">
      <header><b>{title}</b><span className={output ? "one" : "zero"}>{output ? "HIGH 1" : "LOW 0"}</span></header>
      <div className="ttx-switches" role="group" aria-label="Circuit inputs">
        {names.map((name) => (
          <button key={name} type="button" className={values[name] ? "on" : ""} aria-pressed={values[name] === 1} onClick={() => onToggle(name)}>
            {name} = {values[name] ?? 0}
          </button>
        ))}
      </div>
      {drawing ? (
        <svg className="ttx-schematic" viewBox={`0 0 ${drawing.width} ${drawing.height}`} role="img" aria-label={`${title}. Output is ${output}.`}>
          {drawing.wires.map((wire, index) => (
            <line key={index} x1={wire.x1} y1={wire.y1} x2={wire.x2} y2={wire.y2} className={wire.value ? "hot" : "cold"} />
          ))}
          {drawing.nodes.map((node) => (
            <g key={node.id} className={node.value ? "hot" : "cold"}>
              <rect x={node.x} y={node.y - 16} width={72} height={32} rx={8} />
              <text x={node.x + 36} y={node.y + 4} textAnchor="middle">{node.label}</text>
              <title>{node.term}</title>
            </g>
          ))}
        </svg>
      ) : <p className="cwb-error">This expression has no gate diagram.</p>}
    </div>
  );
}

function treeDepth(node: AstNode): number {
  if (node.type === "VAR" || node.type === "CONST") return 0;
  if (node.type === "NOT") return 1 + treeDepth(node.child);
  return 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
}

function draw(expression: string, values: Record<string, 0 | 1>): { nodes: DrawNode[]; wires: DrawWire[]; width: number; height: number; output: 0 | 1 } | null {
  let ast: AstNode;
  if (expression === "0" || expression === "1") ast = { type: "CONST", value: expression === "1" ? 1 : 0 };
  else {
    try { ast = parseBoolean(expression).ast; } catch { return null; }
  }
  const deepest = treeDepth(ast);
  const nodes: DrawNode[] = [];
  const wires: DrawWire[] = [];
  let seq = 0;
  function place(node: AstNode, level: number, top: number): { id: string; y: number; span: number; value: 0 | 1 } {
    const id = `g${seq}`;
    seq += 1;
    const value = evalBoolean(node, values);
    const x = 8 + (deepest - level) * 108;
    if (node.type === "VAR" || node.type === "CONST") {
      const y = top + 18;
      nodes.push({ id, label: node.type === "VAR" ? node.name : String(node.value), x, y, value, term: node.type === "VAR" ? node.name : String(node.value) });
      return { id, y, span: 36, value };
    }
    if (node.type === "NOT") {
      const child = place(node.child, level + 1, top);
      nodes.push({ id, label: "NOT", x, y: child.y, value, term: "NOT" });
      wires.push(link(child, x, child.y));
      return { id, y: child.y, span: child.span, value };
    }
    const left = place(node.left, level + 1, top);
    const right = place(node.right, level + 1, top + left.span);
    const y = (left.y + right.y) / 2;
    nodes.push({ id, label: node.type, x, y, value, term: node.type });
    wires.push(link(left, x, y));
    wires.push(link(right, x, y));
    return { id, y, span: left.span + right.span, value };
  }
  function xOf(id: string): number {
    return nodes.find((node) => node.id === id)?.x ?? 8;
  }
  function link(child: { id: string; y: number; value: 0 | 1 }, x: number, y: number): DrawWire {
    return { x1: xOf(child.id) + 72, y1: child.y, x2: x, y2: y, value: child.value };
  }
  const root = place(ast, 0, 8);
  const outX = Math.max(...nodes.map((node) => node.x)) + 108;
  nodes.push({ id: "F", label: "F", x: outX, y: root.y, value: root.value, term: "F" });
  wires.push({ x1: xOf(root.id) + 72, y1: root.y, x2: outX, y2: root.y, value: root.value });
  const width = outX + 88;
  const height = Math.max(72, ...nodes.map((node) => node.y + 28));
  return { nodes, wires, width, height, output: root.value };
}

export function inputRecord(names: string[], bits: number): Record<string, 0 | 1> {
  const values: Record<string, 0 | 1> = {};
  names.forEach((name, index) => {
    values[name] = ((bits >> (names.length - 1 - index)) & 1) === 1 ? 1 : 0;
  });
  return values;
}
