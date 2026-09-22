import { type AstNode, collectVariables, evalBoolean, formatAst, parseBoolean } from "../boolean/ast";
import { defaultNames, quineMcCluskey, sopFromImplicants, termFromMask } from "../kmap/quine";

export interface TruthRow {
  index: number;
  values: Array<0 | 1>;
  output: 0 | 1;
  minterm: string;
  maxterm: string;
}

export interface TruthTable {
  variables: string[];
  rows: TruthRow[];
  minterms: number[];
  maxterms: number[];
}

export function assignments(variables: string[]): Array<Record<string, 0 | 1>> {
  const count = 1 << variables.length;
  const rows: Array<Record<string, 0 | 1>> = [];
  for (let i = 0; i < count; i += 1) {
    const assign: Record<string, 0 | 1> = {};
    variables.forEach((name, bit) => {
      const shift = variables.length - 1 - bit;
      assign[name] = ((i >> shift) & 1) === 1 ? 1 : 0;
    });
    rows.push(assign);
  }
  return rows;
}

export function generateTruthTable(ast: AstNode, variables = collectVariables(ast)): TruthTable {
  const rows = assignments(variables).map((assign, index) => {
    const values = variables.map((name) => assign[name] ?? 0);
    const output = evalBoolean(ast, assign);
    return {
      index,
      values,
      output,
      minterm: productTerm(variables, values, false),
      maxterm: productTerm(variables, values, true),
    };
  });
  return {
    variables,
    rows,
    minterms: rows.filter((row) => row.output === 1).map((row) => row.index),
    maxterms: rows.filter((row) => row.output === 0).map((row) => row.index),
  };
}

function productTerm(variables: string[], values: Array<0 | 1>, maxterm: boolean): string {
  const parts = variables.map((name, index) => {
    const bit = values[index] ?? 0;
    const asserted = maxterm ? bit === 1 : bit === 0;
    return asserted ? `${name}'` : name;
  });
  return maxterm ? `(${parts.join(" + ")})` : parts.join("·");
}

export function expressionToMinterms(expression: string): number[] {
  const { ast } = parseBoolean(expression);
  return generateTruthTable(ast).minterms;
}

export function expressionToMaxterms(expression: string): number[] {
  const { ast } = parseBoolean(expression);
  return generateTruthTable(ast).maxterms;
}

export function truthTableToCanonicalSOP(table: TruthTable): string {
  if (table.minterms.length === 0) return "0";
  if (table.minterms.length === table.rows.length) return "1";
  return table.rows
    .filter((row) => row.output === 1)
    .map((row) => row.minterm)
    .join(" + ");
}

export function truthTableToCanonicalPOS(table: TruthTable): string {
  if (table.maxterms.length === 0) return "1";
  if (table.maxterms.length === table.rows.length) return "0";
  return table.rows
    .filter((row) => row.output === 0)
    .map((row) => row.maxterm)
    .join(" · ");
}

export function tableFromOutputs(variables: string[], outputs: Array<0 | 1 | "X">): TruthTable {
  const rows = assignments(variables).map((assign, index) => {
    const values = variables.map((name) => assign[name] ?? 0);
    const cell = outputs[index] ?? 0;
    const output: 0 | 1 = cell === 1 ? 1 : 0;
    return { index, values, output, minterm: productTerm(variables, values, false), maxterm: productTerm(variables, values, true) };
  });
  return {
    variables,
    rows,
    minterms: outputs.flatMap((cell, index) => (cell === 1 ? [index] : [])),
    maxterms: outputs.flatMap((cell, index) => (cell === 0 ? [index] : [])),
  };
}

export function minimizeOutputs(variables: string[], outputs: Array<0 | 1 | "X">, mode: "sop" | "pos"): string {
  const minterms = outputs.flatMap((cell, index) => (cell === 1 ? [index] : []));
  const zeros = outputs.flatMap((cell, index) => (cell === 0 ? [index] : []));
  const donts = outputs.flatMap((cell, index) => (cell === "X" ? [index] : []));
  if (mode === "sop") {
    return quineMcCluskey(minterms, donts, variables.length, variables).expression;
  }
  if (zeros.length === 0) return "1";
  const complement = quineMcCluskey(zeros, donts, variables.length, variables);
  if (complement.constant === 1) return "0";
  return posFromSop(complement.expression, variables, complement.selected.map((im) => im.mask));
}

export function posFromSop(_expression: string, variables: string[], masks: string[]): string {
  if (masks.length === 0) return "1";
  const clauses = masks.map((mask) => {
    const literals: string[] = [];
    [...mask].forEach((bit, index) => {
      const name = variables[index];
      if (!name || bit === "-") return;
      literals.push(bit === "1" ? `${name}'` : name);
    });
    if (literals.length === 0) return "0";
    return literals.length === 1 ? literals[0] ?? "0" : `(${literals.join(" + ")})`;
  });
  if (clauses.includes("0")) return "0";
  return clauses.join(" · ");
}

export function canonicalFromExpression(expression: string): { sop: string; pos: string; table: TruthTable } {
  const { ast } = parseBoolean(expression);
  const table = generateTruthTable(ast);
  return { sop: truthTableToCanonicalSOP(table), pos: truthTableToCanonicalPOS(table), table };
}

export function formatExpression(expression: string): string {
  return formatAst(parseBoolean(expression).ast);
}

export function namesFor(count: number): string[] {
  return defaultNames(count);
}

export function termOf(mask: string, variables: string[]): string {
  return termFromMask(mask, variables);
}

export function sopJoin(masks: string[], variables: string[]): string {
  return sopFromImplicants(
    masks.map((mask) => ({ mask, minterms: [], prime: true, essential: false, selected: true })),
    variables,
  );
}
