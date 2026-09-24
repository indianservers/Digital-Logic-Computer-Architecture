import { BooleanParseError, evalBoolean, formatAst, literalCount, parseBoolean, type AstNode } from "../../engines/boolean/ast";
import { describeImplicant, grayCodes, kmapLayout } from "../../engines/kmap/map";
import { maskToMinterms, quineMcCluskey, sopFromImplicants, termFromMask, type Implicant, type Minimized } from "../../engines/kmap/quine";
import { minimizeOutputs, tableFromOutputs, truthTableToCanonicalPOS, truthTableToCanonicalSOP } from "../../engines/truth/table";

export type Cell = 0 | 1 | "X";
export type Format = "table" | "expression" | "minterms" | "maxterms";

export interface OutputColumn {
  name: string;
  cells: Cell[];
}

export interface FnState {
  names: string[];
  /** Active column. Further columns can live in `extras` (Sum, Carry, …). */
  output: string;
  cells: Cell[];
  extras: OutputColumn[];
}

export interface CoverChoice {
  expression: string;
  literals: number;
  terms: number;
}

export interface WorkbenchModel {
  names: string[];
  cells: Cell[];
  minterms: number[];
  maxterms: number[];
  donts: number[];
  canonicalSop: string;
  canonicalPos: string;
  sop: Minimized;
  pos: string;
  covers: CoverChoice[];
  posCovers: CoverChoice[];
  literalsBefore: number;
  literalsAfter: number;
  termsBefore: number;
  termsAfter: number;
  reduction: number;
  gatesBefore: number;
  gatesAfter: number;
  equivalent: boolean;
  mismatches: number[];
}

const KEYWORDS = new Set(["AND", "OR", "NOT", "XOR", "NAND", "NOR", "XNOR"]);

export function blank(count: number, names = defaultNames(count)): FnState {
  return { names, cells: Array.from({ length: 1 << count }, () => 0 as Cell), output: "F", extras: [] };
}

export function defaultNames(count: number): string[] {
  return [..."ABCDE".slice(0, count)];
}

export function resizeDrops(state: FnState, count: number): boolean {
  return count < state.names.length && state.cells.slice(1 << count).some((cell) => cell !== 0);
}

export function resizeState(state: FnState, count: number): FnState {
  const names = state.names.slice(0, count);
  const used = new Set(names.map((name) => name.toUpperCase()));
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (names.length >= count) break;
    if (!used.has(letter)) {
      names.push(letter);
      used.add(letter);
    }
  }
  const size = 1 << count;
  const cells = state.cells.slice(0, size);
  while (cells.length < size) cells.push(0);
  return { ...state, names, cells, extras: [] };
}

export function paint(cells: Cell[], indexes: number[], value: Cell): Cell[] {
  const chosen = new Set(indexes);
  return cells.map((cell, index) => (chosen.size === 0 || chosen.has(index) ? value : cell));
}

export function invertCells(cells: Cell[]): Cell[] {
  return cells.map((cell) => (cell === "X" ? "X" : cell === 1 ? 0 : 1));
}

export function clearDontCares(cells: Cell[]): Cell[] {
  return cells.map((cell) => (cell === "X" ? 0 : cell));
}

export function randomCells(cells: Cell[]): Cell[] {
  const roll = [0, 1, "X"] as const;
  return cells.map(() => roll[Math.floor(Math.random() * 3)] ?? 0);
}

export function cycle(cell: Cell): Cell {
  if (cell === 0) return 1;
  if (cell === 1) return "X";
  return 0;
}

export function validateNames(names: string[]): string | null {
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) return `"${name}" is not a variable name. Use a letter, then letters or digits.`;
    if (KEYWORDS.has(trimmed.toUpperCase())) return `"${trimmed}" is a Boolean operator.`;
    const key = trimmed.toUpperCase();
    if (seen.has(key)) return `"${trimmed}" is already used.`;
    seen.add(key);
  }
  return null;
}

export function derive(state: FnState): WorkbenchModel {
  const names = state.names;
  const cells = state.cells;
  const minterms = cells.flatMap((cell, index) => (cell === 1 ? [index] : []));
  const maxterms = cells.flatMap((cell, index) => (cell === 0 ? [index] : []));
  const donts = cells.flatMap((cell, index) => (cell === "X" ? [index] : []));
  const table = tableFromOutputs(names, cells);
  const sop = quineMcCluskey(minterms, donts, names.length, names);
  const pos = minimizeOutputs(names, cells, "pos");
  const covers = listCovers(sop.implicants, minterms, names);
  const zeroQm = quineMcCluskey(maxterms, donts, names.length, names);
  const posCovers = posChoices(zeroQm.implicants, maxterms, names);
  const canonicalSop = truthTableToCanonicalSOP(table);
  const canonicalPos = truthTableToCanonicalPOS(table);
  const literalsBefore = countLiterals(canonicalSop);
  const literalsAfter = countLiterals(sop.expression);
  const termsBefore = minterms.length;
  const termsAfter = sop.expression === "0" || sop.expression === "1" ? (sop.expression === "0" ? 0 : 1) : sop.expression.split("+").length;
  const reduction = literalsBefore === 0 ? 0 : Math.round((1 - literalsAfter / literalsBefore) * 100);
  const check = mismatches(state, sop.expression);
  return {
    names, cells, minterms, maxterms, donts, canonicalSop, canonicalPos, sop, pos, covers, posCovers,
    literalsBefore, literalsAfter, termsBefore, termsAfter, reduction,
    gatesBefore: estimateGates(canonicalSop),
    gatesAfter: estimateGates(sop.expression),
    equivalent: check.length === 0,
    mismatches: check,
  };
}

export function teach(model: WorkbenchModel): string[] {
  const ones = model.minterms.length ? model.minterms.map((m) => `m${m}`).join(", ") : "none";
  const essentials = model.sop.implicants.filter((im) => im.essential).map((im) => termFromMask(im.mask, model.names) || "1");
  const groups = model.sop.selected.map((im) => {
    const info = describeImplicant(im.mask, model.names);
    return `${info.term} from ${info.covered.filter((m) => model.cells[m] !== 0).map((m) => `m${m}`).join(", ")} (${info.kept || "constant"})`;
  });
  return [
    `Output rows where F = 1: ${ones}.`,
    `Minterms Σm(${model.minterms.join(", ") || "—"}). Don't cares d(${model.donts.join(", ") || "—"}). Maxterms ΠM(${model.maxterms.join(", ") || "—"}).`,
    "Those values are placed in Gray-code order, so neighboring cells differ by one variable.",
    `Prime implicants: ${model.sop.implicants.map((im) => termFromMask(im.mask, model.names) || "1").join(", ") || "none"}.`,
    `Essential prime implicants: ${essentials.join(", ") || "none"}.`,
    `Chosen groups: ${groups.join("; ") || "the function is constant"}.`,
    `Minimal SOP is ${model.sop.expression}. Minimal POS is ${model.pos}.`,
    model.equivalent
      ? `Checked all ${model.cells.filter((cell) => cell !== "X").length} defined rows. The minimized SOP matches the truth table.`
      : `Mismatch on rows ${model.mismatches.join(", ")}.`,
  ];
}

export function parseSpec(text: string, width: number): { cells: Cell[]; names?: string[]; error?: string } {
  const cleaned = text.trim();
  if (!cleaned) return { cells: [], error: "Enter a minterm or maxterm list." };
  const header = cleaned.match(/F\s*\(([^)]*)\)/i);
  let names: string[] | undefined;
  if (header?.[1]) {
    names = header[1].split(",").map((part) => part.trim()).filter(Boolean);
    const problem = validateNames(names);
    if (problem) return { cells: [], error: problem };
    if (names.length !== width) return { cells: [], error: `This list is for ${names.length} variables. The table has ${width}.` };
  }
  const minterms = readList(cleaned, /(?:Σ\s*m|sum\s*m|minterms?|σm)\s*\(([^)]*)\)/i);
  const maxterms = readList(cleaned, /(?:Π\s*M|prod(?:uct)?\s*M|maxterms?)\s*\(([^)]*)\)/i);
  const donts = readList(cleaned, /(?:\+\s*)?d\s*\(([^)]*)\)/i);
  if (minterms.error) return { cells: [], error: minterms.error };
  if (maxterms.error) return { cells: [], error: maxterms.error };
  if (donts.error) return { cells: [], error: donts.error };
  if (!minterms.found && !maxterms.found) return { cells: [], error: "Use Σm(…) or ΠM(…)." };
  const limit = (1 << width) - 1;
  const lists = [
    ["minterm", minterms.values],
    ["maxterm", maxterms.values],
    ["don't care", donts.values],
  ] as const;
  for (const [label, values] of lists) {
    const seen = new Set<number>();
    for (const value of values) {
      if (value < 0 || value > limit) return { cells: [], error: `${label} ${value} is outside 0…${limit}.` };
      if (seen.has(value)) return { cells: [], error: `${label} ${value} is listed twice.` };
      seen.add(value);
    }
  }
  const conflict = overlap(minterms.values, maxterms.values, "minterm", "maxterm")
    ?? overlap(minterms.values, donts.values, "minterm", "don't care")
    ?? overlap(maxterms.values, donts.values, "maxterm", "don't care");
  if (conflict) return { cells: [], error: conflict };
  const cells: Cell[] = Array.from({ length: 1 << width }, () => (minterms.found && !maxterms.found ? 0 : maxterms.found && !minterms.found ? 1 : "X") as Cell);
  if (minterms.found && maxterms.found) {
    const named = new Set([...minterms.values, ...maxterms.values, ...donts.values]);
    for (let i = 0; i < cells.length; i += 1) {
      if (!named.has(i)) return { cells: [], error: `Row ${i} is neither a minterm, a maxterm, nor a don't care.` };
    }
  }
  for (const value of minterms.values) cells[value] = 1;
  for (const value of maxterms.values) cells[value] = 0;
  for (const value of donts.values) cells[value] = "X";
  return { cells, names };
}

export function applyExpression(text: string, names: string[]): { state?: FnState; error?: string } {
  try {
    const parsed = parseBoolean(text);
    const used = parsed.variables;
    if (used.length < 2 || used.length > 5) return { error: "Use 2 to 5 variables." };
    const same = used.length === names.length && used.every((name) => names.some((current) => current.toUpperCase() === name.toUpperCase()));
    const nextNames = same ? names : used;
    const problem = validateNames(nextNames);
    if (problem) return { error: problem };
    const cells = cellsFromAst(parsed.ast, nextNames);
    return { state: { names: nextNames, cells, output: "F", extras: [] } };
  } catch (error) {
    if (error instanceof BooleanParseError) return { error: error.message };
    return { error: "That expression could not be read." };
  }
}

export function cellsFromAst(ast: AstNode, names: string[]): Cell[] {
  const count = 1 << names.length;
  return Array.from({ length: count }, (_, index) => {
    const assign: Record<string, 0 | 1> = {};
    names.forEach((name, bit) => {
      assign[name] = ((index >> (names.length - 1 - bit)) & 1) === 1 ? 1 : 0;
    });
    return evalBoolean(ast, assign);
  });
}

export function validateGroup(cells: Cell[], indexes: number[], width: number): { ok: true; mask: string } | { ok: false; reason: string } {
  const picked = [...new Set(indexes)].sort((a, b) => a - b);
  if (picked.length === 0) return { ok: false, reason: "Select at least one cell." };
  if (!isPowerOfTwo(picked.length)) return { ok: false, reason: "Groups must contain 1, 2, 4, 8... cells." };
  if (picked.some((index) => cells[index] === 0)) return { ok: false, reason: "This group contains a 0." };
  if (!picked.some((index) => cells[index] === 1)) return { ok: false, reason: "A group should cover at least one 1." };
  const bits = picked.map((index) => index.toString(2).padStart(width, "0"));
  const mask = Array.from({ length: width }, (_, bit) => {
    const column = bits.map((row) => row[bit]);
    return column.every((value) => value === column[0]) ? column[0] ?? "0" : "-";
  }).join("");
  const covered = maskToMinterms(mask);
  if (covered.length !== picked.length || covered.some((index) => !picked.includes(index))) {
    return { ok: false, reason: "These cells are not adjacent under K-map topology. A valid group is a rectangle, including wrap-around edges." };
  }
  return { ok: true, mask };
}

export function latexOf(expression: string): string {
  return expression
    .replaceAll("·", "")
    .replaceAll("⊕", " \\oplus ")
    .replaceAll("⊙", " \\odot ")
    .replace(/([A-Za-z0-9_]+)'/g, "\\bar{$1}");
}

export function presets(_count: number): Array<{ id: string; name: string; state: FnState }> {
  const make = (id: string, name: string, text: string, used: string[]): { id: string; name: string; state: FnState } => {
    const parsed = parseBoolean(text);
    return { id, name, state: { names: used, cells: cellsFromAst(parsed.ast, used), output: "F", extras: [] } };
  };
  return [
    make("and", "AND", "A·B", ["A", "B"]),
    make("or", "OR", "A+B", ["A", "B"]),
    make("xor", "XOR", "A XOR B", ["A", "B"]),
    make("xnor", "XNOR", "A XNOR B", ["A", "B"]),
    make("majority", "Majority", "AB+BC+AC", ["A", "B", "C"]),
    make("parity", "Parity", "A XOR B XOR C", ["A", "B", "C"]),
    make("half-sum", "Half adder sum", "A XOR B", ["A", "B"]),
    make("half-carry", "Half adder carry", "A·B", ["A", "B"]),
    make("full-sum", "Full adder sum", "A XOR B XOR C", ["A", "B", "C"]),
    make("full-carry", "Full adder carry", "AB+BC+AC", ["A", "B", "C"]),
    make("mux", "2-to-1 MUX", "S'·A + S·B", ["S", "A", "B"]),
    make("compare", "Comparator A>B", "A·B'", ["A", "B"]),
    {
      id: "bcd",
      name: "BCD 0–9",
      state: {
        names: ["A", "B", "C", "D"],
        output: "F",
        extras: [],
        cells: Array.from({ length: 16 }, (_, index) => (index < 10 ? 1 : "X") as Cell),
      },
    },
  ];
}

export function practiceSet(): Array<{ id: string; level: "Easy" | "Medium" | "Hard"; prompt: string; hint: string; step: string; names: string[]; minterms: number[]; donts: number[] }> {
  return [
    { id: "p1", level: "Easy", prompt: "Minimize F(A,B) = Σm(1,2).", hint: "The two 1s are diagonal, so they do not form a group.", step: "Each minterm stays a term: A'B + AB'.", names: ["A", "B"], minterms: [1, 2], donts: [] },
    { id: "p2", level: "Easy", prompt: "Minimize F(A,B,C) = Σm(0,1,4,5).", hint: "Group the cells where C changes and B stays 0.", step: "The quad is B'.", names: ["A", "B", "C"], minterms: [0, 1, 4, 5], donts: [] },
    { id: "p3", level: "Medium", prompt: "Minimize F(A,B,C) = Σm(0,3,4,5,6,7).", hint: "All of A = 1 is one group. Then look at m0 and m3.", step: "One minimum is A + B'C' + BC.", names: ["A", "B", "C"], minterms: [0, 3, 4, 5, 6, 7], donts: [] },
    { id: "p4", level: "Medium", prompt: "Minimize F(A,B,C) = Σm(1,3,5,7) + d(6).", hint: "The don't care can complete a pair, or you can ignore it.", step: "The required 1s already form C. d(6) is not needed.", names: ["A", "B", "C"], minterms: [1, 3, 5, 7], donts: [6] },
    { id: "p5", level: "Hard", prompt: "Minimize F(A,B,C,D) = Σm(0,2,5,7,8,10).", hint: "Look for pairs that wrap the left and right edges.", step: "Check pairs on B'D' and the cells where A changes.", names: ["A", "B", "C", "D"], minterms: [0, 2, 5, 7, 8, 10], donts: [] },
  ];
}

export function answerMatches(text: string, names: string[], minterms: number[], donts: number[]): string | null {
  try {
    const parsed = parseBoolean(text);
    const cells = cellsFromAst(parsed.ast, names);
    for (let index = 0; index < cells.length; index += 1) {
      if (donts.includes(index)) continue;
      const want: Cell = minterms.includes(index) ? 1 : 0;
      if (cells[index] !== want) return `Row ${index} should be ${want}.`;
    }
    const got = literalCount(parsed.ast);
    const best = countLiterals(quineMcCluskey(minterms, donts, names.length, names).expression);
    if (got > best) return `That matches the function, but it still has ${got} literals. A minimum has ${best}.`;
    return null;
  } catch (error) {
    return error instanceof BooleanParseError ? error.message : "Could not read that expression.";
  }
}

export function toLatex(expression: string): string {
  return latexOf(expression);
}

export function plainSop(model: WorkbenchModel): string {
  return `F(${model.names.join(",")}) = Σm(${model.minterms.join(",")})${model.donts.length ? ` + d(${model.donts.join(",")})` : ""}`;
}

export function plainPos(model: WorkbenchModel): string {
  return `F(${model.names.join(",")}) = ΠM(${model.maxterms.join(",")})`;
}

export function formatPretty(ast: AstNode): string {
  return formatAst(ast);
}

function readList(text: string, pattern: RegExp): { found: boolean; values: number[]; error?: string } {
  const match = text.match(pattern);
  if (!match) return { found: false, values: [] };
  const body = match[1]?.trim() ?? "";
  if (!body) return { found: true, values: [] };
  const values: number[] = [];
  for (const part of body.split(",")) {
    const token = part.trim();
    if (!/^\d+$/.test(token)) return { found: true, values: [], error: `"${token}" is not a row number.` };
    values.push(Number(token));
  }
  return { found: true, values };
}

function overlap(left: number[], right: number[], a: string, b: string): string | null {
  const hit = left.find((value) => right.includes(value));
  return hit === undefined ? null : `Row ${hit} cannot be both a ${a} and a ${b}.`;
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function countLiterals(expression: string): number {
  if (expression === "0" || expression === "1") return 0;
  try {
    return literalCount(parseBoolean(expression).ast);
  } catch {
    return expression.split("+").join("").split("·").join("").replaceAll("'", "").replaceAll(" ", "").length;
  }
}

function estimateGates(expression: string): number {
  if (expression === "0" || expression === "1") return 0;
  const products = expression.split("+").map((part) => part.trim()).filter(Boolean);
  const ands = products.filter((part) => part.includes("·") || part.replaceAll("'", "").length > 1).length;
  const nots = (expression.match(/'/g) ?? []).length;
  const or = products.length > 1 ? 1 : 0;
  return ands + nots + or;
}

function mismatches(state: FnState, expression: string): number[] {
  if (expression === "0") return state.cells.flatMap((cell, index) => (cell === 1 ? [index] : []));
  if (expression === "1") return state.cells.flatMap((cell, index) => (cell === 0 ? [index] : []));
  try {
    const ast = parseBoolean(expression).ast;
    const bad: number[] = [];
    state.cells.forEach((cell, index) => {
      if (cell === "X") return;
      const assign: Record<string, 0 | 1> = {};
      state.names.forEach((name, bit) => {
        assign[name] = ((index >> (state.names.length - 1 - bit)) & 1) === 1 ? 1 : 0;
      });
      if (evalBoolean(ast, assign) !== cell) bad.push(index);
    });
    return bad;
  } catch {
    return [-1];
  }
}

function listCovers(implicants: Implicant[], required: number[], names: string[]): CoverChoice[] {
  const essential = implicants.filter((im) => im.essential);
  const optional = implicants.filter((im) => !im.essential);
  if (optional.length > 12) {
    const chosen = implicants.filter((im) => im.selected);
    return [choiceOf(chosen, names)];
  }
  const need = required.filter((m) => !essential.some((im) => im.minterms.includes(m)));
  let best = Number.POSITIVE_INFINITY;
  const found: CoverChoice[] = [];
  const limit = 1 << optional.length;
  for (let mask = 0; mask < limit; mask += 1) {
    const chosen = optional.filter((_, index) => (mask & (1 << index)) !== 0);
    const all = [...essential, ...chosen];
    if (!need.every((m) => all.some((im) => im.minterms.includes(m)))) continue;
    const item = choiceOf(all, names);
    if (item.literals < best) {
      best = item.literals;
      found.length = 0;
    }
    if (item.literals === best && !found.some((cover) => cover.expression === item.expression)) found.push(item);
  }
  return found.slice(0, 4);
}

function posChoices(implicants: Implicant[], zeros: number[], names: string[]): CoverChoice[] {
  return listCovers(implicants, zeros, names).map((cover) => ({
    ...cover,
    expression: cover.expression === "0" ? "1" : cover.expression === "1" ? "0" : dualize(cover.expression, names),
  }));
}

function dualize(expression: string, names: string[]): string {
  if (expression === "0") return "1";
  if (expression === "1") return "0";
  const terms = expression.split("+").map((part) => part.trim());
  const clauses = terms.map((term) => {
    const literals = term.split("·").map((literal) => literal.trim()).filter(Boolean).map((literal) => (literal.endsWith("'") ? literal.slice(0, -1) : `${literal}'`));
    if (literals.length === 0) return "0";
    return literals.length === 1 ? literals[0] ?? "0" : `(${literals.join(" + ")})`;
  });
  if (clauses.includes("0")) return "0";
  return clauses.join(" · ") || names.join("");
}

function choiceOf(implicants: Implicant[], names: string[]): CoverChoice {
  const expression = sopFromImplicants(implicants, names);
  const literals = implicants.reduce((sum, im) => sum + [...im.mask].filter((bit) => bit !== "-").length, 0);
  return { expression, literals, terms: expression === "0" || expression === "1" ? 0 : implicants.length };
}

export function grayHeader(bits: number): string[] {
  return grayCodes(bits).map((code) => code.toString(2).padStart(Math.max(bits, 1), "0"));
}

export function mapShape(variables: number) {
  return kmapLayout(variables);
}

export { describeImplicant, termFromMask };
