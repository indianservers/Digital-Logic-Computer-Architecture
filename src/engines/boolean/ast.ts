export type BinOp = "AND" | "OR" | "XOR" | "NAND" | "NOR" | "XNOR";

export type AstNode =
  | { type: "VAR"; name: string }
  | { type: "CONST"; value: 0 | 1 }
  | { type: "NOT"; child: AstNode }
  | { type: BinOp; left: AstNode; right: AstNode };

export interface ParseResult {
  ast: AstNode;
  variables: string[];
}

const KEYWORDS = new Set(["AND", "OR", "NOT", "XOR", "NAND", "NOR", "XNOR"]);

type Tok =
  | { kind: "num"; value: 0 | 1 }
  | { kind: "id"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lp" }
  | { kind: "rp" };

export class BooleanParseError extends Error {
  readonly index?: number;

  constructor(message: string, index?: number) {
    super(index === undefined ? message : `${message} (position ${index + 1})`);
    this.name = "BooleanParseError";
    this.index = index;
  }
}

function tokenize(input: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] ?? "";
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lp" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rp" });
      i += 1;
      continue;
    }
    if (ch === "&" || ch === "|") {
      if (input[i + 1] === ch) i += 1;
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }
    if ("!~^+*'·⊕¬".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i += 1;
      continue;
    }
    if (ch === "0" || ch === "1") {
      const next = input[i + 1] ?? "";
      if (/[A-Za-z]/.test(next)) throw new BooleanParseError(`'${ch}${next}' is not a Boolean token`);
      tokens.push({ kind: "num", value: ch === "1" ? 1 : 0 });
      i += 1;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j] ?? "")) j += 1;
      const word = input.slice(i, j).toUpperCase();
      if (!KEYWORDS.has(word) && /^[A-Z]{2,}$/.test(word)) {
        for (const letter of word) tokens.push({ kind: "id", value: letter });
      } else {
        tokens.push({ kind: "id", value: word });
      }
      i = j;
      continue;
    }
    throw new BooleanParseError(`Unexpected character '${ch}'`, i);
  }
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Tok[]) {}

  parse(): AstNode {
    if (this.tokens.length === 0) throw new BooleanParseError("Enter an expression");
    const ast = this.parseOr();
    if (this.peek()) throw new BooleanParseError("Unexpected input after the expression");
    return ast;
  }

  private peek(): Tok | undefined {
    return this.tokens[this.index];
  }

  private eat(): Tok {
    const tok = this.tokens[this.index];
    if (!tok) throw new BooleanParseError("Expression ended early");
    this.index += 1;
    return tok;
  }

  private parseOr(): AstNode {
    let left = this.parseXor();
    while (this.matchKeyword(["OR", "NOR"]) || this.matchOp(["|", "+"])) {
      const word = this.takeOperator();
      const right = this.parseXor();
      left = { type: word === "NOR" ? "NOR" : "OR", left, right };
    }
    return left;
  }

  private parseXor(): AstNode {
    let left = this.parseAnd();
    while (this.matchKeyword(["XOR", "XNOR"]) || this.matchOp(["^", "⊕"])) {
      const word = this.takeOperator();
      const right = this.parseAnd();
      left = { type: word === "XNOR" ? "XNOR" : "XOR", left, right };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseUnary();
    while (this.matchKeyword(["AND", "NAND"]) || this.matchOp(["&", "*", "·"]) || this.startsPrimary()) {
      const juxtaposed = this.startsPrimary();
      const word = juxtaposed ? "AND" : this.takeOperator();
      const right = this.parseUnary();
      left = { type: word === "NAND" ? "NAND" : "AND", left, right };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.matchKeyword(["NOT"]) || this.matchOp(["!", "~", "¬"])) {
      this.eat();
      return { type: "NOT", child: this.parseUnary() };
    }
    let node = this.parsePrimary();
    while (this.matchOp(["'"])) {
      this.eat();
      node = { type: "NOT", child: node };
    }
    return node;
  }

  private parsePrimary(): AstNode {
    const tok = this.peek();
    if (!tok) throw new BooleanParseError("Expected a variable, constant, or '('");
    if (tok.kind === "lp") {
      this.eat();
      const inner = this.parseOr();
      const close = this.eat();
      if (close.kind !== "rp") throw new BooleanParseError("Missing ')'");
      return inner;
    }
    if (tok.kind === "num") {
      this.eat();
      return { type: "CONST", value: tok.value };
    }
    if (tok.kind === "id") {
      if (KEYWORDS.has(tok.value)) throw new BooleanParseError(`'${tok.value}' needs operands`);
      this.eat();
      return { type: "VAR", name: tok.value };
    }
    throw new BooleanParseError("Expected a variable or constant");
  }

  private startsPrimary(): boolean {
    const tok = this.peek();
    if (!tok) return false;
    if (tok.kind === "lp" || tok.kind === "num") return true;
    if (tok.kind === "id" && !KEYWORDS.has(tok.value)) return true;
    if (tok.kind === "id" && tok.value === "NOT") return true;
    if (tok.kind === "op" && "!¬~".includes(tok.value)) return true;
    return false;
  }

  private matchKeyword(words: string[]): boolean {
    const tok = this.peek();
    return tok?.kind === "id" && words.includes(tok.value);
  }

  private matchOp(ops: string[]): boolean {
    const tok = this.peek();
    return tok?.kind === "op" && ops.includes(tok.value);
  }

  private takeOperator(): string {
    const tok = this.eat();
    if (tok.kind === "id") return tok.value;
    if (tok.kind === "op") {
      if (tok.value === "| " || tok.value === "|" || tok.value === "+") return "OR";
      if (tok.value === "&" || tok.value === "*" || tok.value === "·") return "AND";
      if (tok.value === "^" || tok.value === "⊕") return "XOR";
    }
    return "OR";
  }
}

export function parseBoolean(input: string): ParseResult {
  const ast = new Parser(tokenize(input)).parse();
  return { ast, variables: collectVariables(ast) };
}

export function collectVariables(ast: AstNode): string[] {
  const names = new Set<string>();
  const walk = (node: AstNode) => {
    if (node.type === "VAR") names.add(node.name);
    else if (node.type === "NOT") walk(node.child);
    else if (node.type !== "CONST") {
      walk(node.left);
      walk(node.right);
    }
  };
  walk(ast);
  return [...names].sort();
}

export function evalBoolean(ast: AstNode, assign: Record<string, 0 | 1>): 0 | 1 {
  switch (ast.type) {
    case "CONST":
      return ast.value;
    case "VAR": {
      const value = assign[ast.name];
      if (value === undefined) throw new BooleanParseError(`Variable ${ast.name} has no value`);
      return value;
    }
    case "NOT":
      return evalBoolean(ast.child, assign) === 1 ? 0 : 1;
    case "AND":
      return (evalBoolean(ast.left, assign) & evalBoolean(ast.right, assign)) as 0 | 1;
    case "OR":
      return (evalBoolean(ast.left, assign) | evalBoolean(ast.right, assign)) as 0 | 1;
    case "XOR":
      return (evalBoolean(ast.left, assign) ^ evalBoolean(ast.right, assign)) as 0 | 1;
    case "NAND":
      return evalBoolean(ast.left, assign) & evalBoolean(ast.right, assign) ? 0 : 1;
    case "NOR":
      return evalBoolean(ast.left, assign) | evalBoolean(ast.right, assign) ? 0 : 1;
    case "XNOR":
      return evalBoolean(ast.left, assign) === evalBoolean(ast.right, assign) ? 1 : 0;
    default:
      return 0;
  }
}

const PREC: Record<string, number> = { OR: 1, NOR: 1, XOR: 2, XNOR: 2, AND: 3, NAND: 3, NOT: 4 };

export function formatAst(node: AstNode, style: "symbolic" | "words" = "symbolic"): string {
  return format(node, style, 0);
}

function format(node: AstNode, style: "symbolic" | "words", parent: number): string {
  if (node.type === "CONST") return String(node.value);
  if (node.type === "VAR") return node.name;
  if (node.type === "NOT") {
    const inner = format(node.child, style, PREC.NOT ?? 4);
    if (style === "words") return `NOT ${node.child.type === "VAR" || node.child.type === "CONST" ? inner : `(${inner})`}`;
    if (node.child.type === "VAR" || node.child.type === "CONST") return `${inner}'`;
    return `(${inner})'`;
  }
  const prec = PREC[node.type] ?? 0;
  const symbol =
    style === "words"
      ? ` ${node.type} `
      : node.type === "AND" || node.type === "NAND"
        ? " · "
        : node.type === "OR" || node.type === "NOR"
          ? " + "
          : node.type === "XOR"
            ? " ⊕ "
            : " ⊙ ";
  let text = `${format(node.left, style, prec)}${symbol}${format(node.right, style, prec)}`;
  if (node.type === "NAND" && style === "symbolic") text = `(${format(node.left, style, 0)} · ${format(node.right, style, 0)})'`;
  if (node.type === "NOR" && style === "symbolic") text = `(${format(node.left, style, 0)} + ${format(node.right, style, 0)})'`;
  if (node.type === "XNOR" && style === "symbolic") text = `(${format(node.left, style, 0)} ⊕ ${format(node.right, style, 0)})'`;
  if (prec < parent) return `(${text})`;
  return text;
}

export function sameAst(a: AstNode, b: AstNode): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "CONST" && b.type === "CONST") return a.value === b.value;
  if (a.type === "VAR" && b.type === "VAR") return a.name === b.name;
  if (a.type === "NOT" && b.type === "NOT") return sameAst(a.child, b.child);
  if (a.type !== "CONST" && a.type !== "VAR" && a.type !== "NOT" && b.type !== "CONST" && b.type !== "VAR" && b.type !== "NOT") {
    return sameAst(a.left, b.left) && sameAst(a.right, b.right);
  }
  return false;
}

export function cloneAst(node: AstNode): AstNode {
  if (node.type === "CONST" || node.type === "VAR") return { ...node };
  if (node.type === "NOT") return { type: "NOT", child: cloneAst(node.child) };
  return { type: node.type, left: cloneAst(node.left), right: cloneAst(node.right) };
}

export function literalCount(node: AstNode): number {
  if (node.type === "VAR") return 1;
  if (node.type === "CONST") return 0;
  if (node.type === "NOT") return literalCount(node.child);
  return literalCount(node.left) + literalCount(node.right);
}

export function gateCount(node: AstNode): number {
  if (node.type === "VAR" || node.type === "CONST") return 0;
  if (node.type === "NOT") return 1 + gateCount(node.child);
  return 1 + gateCount(node.left) + gateCount(node.right);
}

export function logicDepth(node: AstNode): number {
  if (node.type === "VAR" || node.type === "CONST") return 0;
  if (node.type === "NOT") return 1 + logicDepth(node.child);
  return 1 + Math.max(logicDepth(node.left), logicDepth(node.right));
}
