/*
 * Educational embedded-C interpreter for Microcontroller Studio labs.
 * Supports a practical C subset: #define, globals, functions, arrays, pointers to
 * memory-mapped registers, loops, switch, ISRs and a FreeRTOS-style multi-task
 * scheduler. Blocking calls (HAL_Delay, vTaskDelay, xSemaphoreTake...) suspend the
 * calling thread against simulated time instead of real time.
 */

export type Diagnostic = { line: number; message: string };

type TokKind = "num" | "str" | "chr" | "id" | "op" | "eof";
type Tok = { k: TokKind; v: string; line: number; float?: boolean };

export type Expr =
  | { k: "num"; v: number; float: boolean }
  | { k: "str"; v: string }
  | { k: "id"; name: string; line: number }
  | { k: "un"; op: string; e: Expr }
  | { k: "post"; op: string; e: Expr }
  | { k: "bin"; op: string; a: Expr; b: Expr }
  | { k: "asg"; op: string; t: Expr; e: Expr }
  | { k: "cond"; c: Expr; a: Expr; b: Expr }
  | { k: "call"; fn: Expr; args: Expr[]; line: number }
  | { k: "idx"; e: Expr; i: Expr }
  | { k: "mem"; e: Expr; name: string }
  | { k: "cast"; type: string; ptr: boolean; e: Expr }
  | { k: "init"; items: Expr[] }
  | { k: "desig"; name: string; e: Expr }
  | { k: "sizeof"; size: number };

type Decl = { name: string; type: string; ptr: boolean; dims: Array<Expr | null>; init?: Expr };
export type Stmt =
  | { k: "expr"; e: Expr; line: number }
  | { k: "decl"; decls: Decl[]; line: number; isStatic: boolean }
  | { k: "if"; c: Expr; a: Stmt; b?: Stmt; line: number }
  | { k: "while"; c: Expr; body: Stmt; line: number }
  | { k: "do"; c: Expr; body: Stmt; line: number }
  | { k: "for"; init?: Stmt; c?: Expr; step?: Expr; body: Stmt; line: number }
  | { k: "block"; body: Stmt[] }
  | { k: "ret"; e?: Expr; line: number }
  | { k: "brk"; line: number }
  | { k: "cont"; line: number }
  | { k: "switch"; e: Expr; cases: Array<{ v?: Expr; body: Stmt[] }>; line: number }
  | { k: "empty" };

export type FnDef = { name: string; type: string; params: Decl[]; body: Stmt[]; line: number; vector?: string };
export type Program = { functions: Map<string, FnDef>; globals: Stmt[]; defines: Record<string, number | string>; source: string };

class CError extends Error { constructor(readonly line: number, message: string) { super(message); } }

const TYPE_WORDS = new Set(["void", "char", "short", "int", "long", "float", "double", "signed", "unsigned", "bool", "_Bool", "boolean", "byte", "word", "String", "size_t",
  "uint8_t", "uint16_t", "uint32_t", "uint64_t", "int8_t", "int16_t", "int32_t", "int64_t", "volatile", "const", "static", "extern", "register", "inline", "struct", "enum", "u8", "u16", "u32", "sbit", "bit", "sfr", "sfr16"]);
const QUALIFIERS = new Set(["volatile", "const", "static", "extern", "register", "inline"]);

/* ---------------- Preprocessor + tokenizer ---------------- */

const TOKEN_RE = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])+'|0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fFuUlL]*|[A-Za-z_]\w*|->|\+\+|--|<<=|>>=|<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|\/=|%=|&=|\|=|\^=|[{}()[\];,.?:+\-*/%<>=!~&|^#]/y;

function lex(src: string, firstLine = 1): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = firstLine;
  while (i < src.length) {
    TOKEN_RE.lastIndex = i;
    const m = TOKEN_RE.exec(src);
    if (!m) throw new CError(line, `Unexpected character ${JSON.stringify(src[i])}.`);
    const v = m[0];
    const c = v[0]!;
    if (!(/\s/.test(c) || v.startsWith("//") || v.startsWith("/*"))) {
      if (c === '"') out.push({ k: "str", v: unescape(v.slice(1, -1)), line });
      else if (c === "'") out.push({ k: "chr", v: unescape(v.slice(1, -1)), line });
      else if (/[0-9]/.test(c) || (c === "." && /\d/.test(v[1] ?? ""))) {
        const isHex = /^0[xX]/.test(v), isBin = /^0[bB]/.test(v);
        out.push({ k: "num", v, line, float: !isHex && !isBin && (/[.eE]/.test(v) || /[fF]$/.test(v)) });
      } else if (/[A-Za-z_]/.test(c)) out.push({ k: "id", v, line });
      else out.push({ k: "op", v, line });
    }
    line += (v.match(/\n/g) ?? []).length;
    i += v.length;
  }
  return out;
}

function unescape(s: string): string {
  return s.replace(/\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g, (_, e: string) => {
    if (e[0] === "x") return String.fromCharCode(parseInt(e.slice(1), 16));
    if (/^[0-7]/.test(e)) return String.fromCharCode(parseInt(e, 8));
    return ({ n: "\n", r: "\r", t: "\t", "0": "\0", "\\": "\\", "'": "'", '"': '"' } as Record<string, string>)[e] ?? e;
  });
}

function numValue(v: string): number {
  const s = v.replace(/[uUlL]+$/, "");
  if (/^0[xX]/.test(s)) return parseInt(s.slice(2), 16);
  if (/^0[bB]/.test(s)) return parseInt(s.slice(2), 2);
  if (/^0\d+$/.test(s)) return parseInt(s, 8);
  return parseFloat(s.replace(/[fF]$/, ""));
}

type Macro = { params?: string[]; body: Tok[] };

function preprocess(source: string): { tokens: Tok[]; macros: Map<string, Macro>; diagnostics: Diagnostic[] } {
  const macros = new Map<string, Macro>();
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];
  const diagnostics: Diagnostic[] = [];
  const skipStack: boolean[] = [];
  for (let n = 0; n < lines.length; n++) {
    const raw = lines[n]!;
    const t = raw.trim();
    const skipping = skipStack.includes(true);
    if (t.startsWith("#")) {
      const dir = t.slice(1).trim();
      const m = dir.match(/^(\w+)\s*(.*)$/);
      const name = m?.[1] ?? "";
      const rest = (m?.[2] ?? "").replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "").trim();
      if (name === "ifdef" || name === "ifndef") skipStack.push(name === "ifdef" ? !macros.has(rest) : macros.has(rest));
      else if (name === "if") skipStack.push(rest === "0");
      else if (name === "else") skipStack.push(!skipStack.pop());
      else if (name === "endif") skipStack.pop();
      else if (!skipping && name === "define") {
        const dm = rest.match(/^([A-Za-z_]\w*)(\(([^)]*)\))?\s*(.*)$/);
        if (dm) {
          try {
            macros.set(dm[1]!, { params: dm[2] ? dm[3]!.split(",").map((p) => p.trim()).filter(Boolean) : undefined, body: lex(dm[4] ?? "", n + 1) });
          } catch (error) { diagnostics.push({ line: n + 1, message: error instanceof Error ? error.message : String(error) }); }
        }
      } else if (!skipping && name === "undef") macros.delete(rest);
      kept.push("");
    } else kept.push(skipping ? "" : raw);
  }
  const tokens = lex(kept.join("\n"));
  return { tokens: expand(tokens, macros, 0), macros, diagnostics };
}

function expand(tokens: Tok[], macros: Map<string, Macro>, depth: number): Tok[] {
  if (depth > 12) return tokens;
  const out: Tok[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const macro = t.k === "id" ? macros.get(t.v) : undefined;
    if (!macro) { out.push(t); continue; }
    if (macro.params) {
      if (tokens[i + 1]?.v !== "(") { out.push(t); continue; }
      const args: Tok[][] = [[]];
      let level = 0, j = i + 2;
      for (; j < tokens.length; j++) {
        const a = tokens[j]!;
        if (a.v === "(") level++;
        if (a.v === ")") { if (level === 0) break; level--; }
        if (a.v === "," && level === 0) { args.push([]); continue; }
        args[args.length - 1]!.push(a);
      }
      const body = macro.body.flatMap((b) => {
        const index = b.k === "id" ? macro.params!.indexOf(b.v) : -1;
        return index >= 0 ? [{ k: "op" as const, v: "(", line: t.line }, ...(args[index] ?? []).map((a) => ({ ...a, line: t.line })), { k: "op" as const, v: ")", line: t.line }] : [{ ...b, line: t.line }];
      });
      out.push(...expand(body, macros, depth + 1));
      i = j;
    } else {
      out.push(...expand(macro.body.map((b) => ({ ...b, line: t.line })), macros, depth + 1));
    }
  }
  return out;
}

/* ---------------- Parser ---------------- */

const BIN_PREC: Record<string, number> = { "||": 1, "&&": 2, "|": 3, "^": 4, "&": 5, "==": 6, "!=": 6, "<": 7, ">": 7, "<=": 7, ">=": 7, "<<": 8, ">>": 8, "+": 9, "-": 9, "*": 10, "/": 10, "%": 10 };
const ASSIGN = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]);

class Parser {
  private p = 0;
  readonly typedefs = new Set<string>(["TIM_HandleTypeDef", "ADC_HandleTypeDef", "UART_HandleTypeDef", "SPI_HandleTypeDef", "I2C_HandleTypeDef", "DAC_HandleTypeDef", "DMA_HandleTypeDef", "GPIO_InitTypeDef", "TaskHandle_t", "SemaphoreHandle_t", "QueueHandle_t", "EventGroupHandle_t", "TickType_t", "BaseType_t", "UBaseType_t", "Servo", "HAL_StatusTypeDef", "GPIO_PinState", "RTC_TimeTypeDef", "RTC_DateTypeDef", "IWDG_HandleTypeDef", "CAN_HandleTypeDef", "CAN_TxHeaderTypeDef", "TimerHandle_t", "FLASH_EraseInitTypeDef", "RCC_OscInitTypeDef", "RCC_ClkInitTypeDef"]);
  constructor(private readonly t: Tok[]) {}
  private get cur(): Tok { return this.t[this.p] ?? { k: "eof", v: "<end>", line: this.t.at(-1)?.line ?? 1 }; }
  private peek(o = 1): Tok { return this.t[this.p + o] ?? { k: "eof", v: "<end>", line: this.cur.line }; }
  private next(): Tok { const t = this.cur; this.p++; return t; }
  private is(v: string) { return this.cur.v === v && this.cur.k !== "str" && this.cur.k !== "chr"; }
  private eat(v: string) { if (this.is(v)) { this.p++; return true; } return false; }
  private expect(v: string) { if (!this.eat(v)) throw new CError(this.cur.line, `Expected '${v}' but found '${this.cur.v}'.`); }
  private ident(): Tok { const t = this.next(); if (t.k !== "id") throw new CError(t.line, `Expected a name but found '${t.v}'.`); return t; }

  private isTypeAt(o = 0): boolean {
    const t = this.peek(o);
    if (t.k !== "id") return false;
    if (TYPE_WORDS.has(t.v) || this.typedefs.has(t.v)) return true;
    const n = this.peek(o + 1);
    return n.k === "id" && !["return", "else", "case", "goto"].includes(t.v) && /^[A-Z]|_t$|TypeDef$/.test(t.v);
  }

  private parseType(): { type: string; ptr: boolean; isStatic: boolean } {
    const parts: string[] = [];
    let isStatic = false;
    while (this.cur.k === "id" && (TYPE_WORDS.has(this.cur.v) || this.typedefs.has(this.cur.v) || (parts.length === 0 && this.isTypeAt()))) {
      const w = this.next().v;
      if (w === "static") isStatic = true;
      if (w === "struct" || w === "enum") {
        if (this.cur.k === "id") parts.push(this.next().v);
        if (this.is("{")) this.skipBraces();
        continue;
      }
      if (!QUALIFIERS.has(w)) parts.push(w);
      if (this.typedefs.has(w) || (!TYPE_WORDS.has(w))) break;
    }
    let ptr = false;
    while (this.eat("*")) { ptr = true; while (this.cur.v === "const" || this.cur.v === "volatile") this.next(); }
    return { type: parts.join(" ") || "int", ptr, isStatic };
  }

  private skipBraces() { let level = 0; do { if (this.is("{")) level++; if (this.is("}")) level--; this.next(); } while (level > 0 && this.cur.k !== "eof"); }

  program(): { functions: Map<string, FnDef>; globals: Stmt[] } {
    const functions = new Map<string, FnDef>();
    const globals: Stmt[] = [];
    while (this.cur.k !== "eof") {
      if (this.eat(";")) continue;
      if (this.is("typedef")) {
        this.next();
        if (this.is("struct") || this.is("enum") || this.is("union")) {
          const isEnum = this.is("enum");
          this.next(); if (this.cur.k === "id" && !this.is("{")) this.next();
          if (this.is("{")) { if (isEnum) globals.push(...this.enumBody()); else this.skipBraces(); }
        }
        else while (this.cur.k === "id" && this.peek().v !== ";") this.next();
        while (this.eat("*")) { /* pointer typedef */ }
        const name = this.ident(); this.typedefs.add(name.v); this.expect(";"); continue;
      }
      if ((this.is("struct") || this.is("enum")) && (this.peek(2).v === "{" || this.peek().v === "{")) {
        const isEnum = this.is("enum");
        this.next(); if (this.cur.k === "id") this.next();
        if (isEnum && this.is("{")) { globals.push(...this.enumBody()); this.eat(";"); continue; }
        this.skipBraces(); this.eat(";"); continue;
      }
      if (this.is("ISR") && this.peek().v === "(") {
        const line = this.next().line; this.expect("("); const vec = this.ident().v; while (!this.is(")")) this.next(); this.expect(")");
        const body = this.block();
        functions.set(`ISR_${vec}`, { name: `ISR_${vec}`, type: "void", params: [], body: body.body, line });
        continue;
      }
      const start = this.cur.line;
      let vector: string | undefined;
      if (this.is("__interrupt")) { this.next(); vector = "pic"; if (this.eat("(")) while (!this.eat(")")) this.next(); }
      const { type, ptr, isStatic } = this.parseType();
      if (this.is("interrupt") || this.is("__interrupt")) { this.next(); vector = "pic"; if (this.eat("(")) while (!this.eat(")")) this.next(); }
      const name = this.ident();
      if (this.eat("(")) {
        const params: Decl[] = [];
        if (!this.is(")")) {
          if (this.is("void") && this.peek().v === ")") this.next();
          else do {
            if (this.eat("...")) break;
            const pt = this.parseType();
            const pn = this.cur.k === "id" ? this.next().v : `_p${params.length}`;
            const dims: Array<Expr | null> = [];
            while (this.eat("[")) { dims.push(this.is("]") ? null : this.expr()); this.expect("]"); }
            params.push({ name: pn, type: pt.type, ptr: pt.ptr || dims.length > 0, dims });
          } while (this.eat(","));
        }
        this.expect(")");
        if (this.eat("interrupt")) vector = `8051:${numValue(this.next().v)}`;
        if (this.eat("using")) this.next();
        if (this.eat(";")) continue;
        const body = this.block();
        functions.set(name.v, { name: name.v, type, params, body: body.body, line: start, vector });
        continue;
      }
      this.p--;
      globals.push(this.declRest(type, ptr, start, isStatic));
    }
    return { functions, globals };
  }

  private enumBody(): Stmt[] {
    this.expect("{");
    const decls: Decl[] = [];
    let value = 0;
    while (!this.is("}")) {
      const name = this.ident();
      let init: Expr = { k: "num", v: value, float: false };
      if (this.eat("=")) init = this.cond();
      decls.push({ name: name.v, type: "const int", ptr: false, dims: [], init });
      value = init.k === "num" ? init.v + 1 : value + 1;
      if (!this.eat(",")) break;
    }
    this.expect("}");
    return [{ k: "decl", decls, line: this.cur.line, isStatic: false }];
  }

  private declRest(type: string, firstPtr: boolean, line: number, isStatic: boolean): Stmt {
    const decls: Decl[] = [];
    let ptr = firstPtr;
    do {
      while (this.eat("*")) ptr = true;
      const name = this.ident();
      const dims: Array<Expr | null> = [];
      while (this.eat("[")) { dims.push(this.is("]") ? null : this.expr()); this.expect("]"); }
      let init: Expr | undefined;
      if (this.eat("=")) init = this.is("{") ? this.initList() : this.assign();
      else if (this.is("(") && /Servo|String/.test(type)) { this.next(); while (!this.is(")")) this.next(); this.next(); }
      decls.push({ name: name.v, type, ptr, dims, init });
      ptr = false;
    } while (this.eat(","));
    this.expect(";");
    return { k: "decl", decls, line, isStatic };
  }

  private initList(): Expr {
    this.expect("{");
    const items: Expr[] = [];
    while (!this.is("}")) {
      if (this.is(".") && this.peek().k === "id" && this.peek(2).v === "=") {
        this.next();
        const name = this.ident().v;
        this.expect("=");
        items.push({ k: "desig", name, e: this.is("{") ? this.initList() : this.assign() });
      } else items.push(this.is("{") ? this.initList() : this.assign());
      if (!this.eat(",")) break;
    }
    this.expect("}");
    return { k: "init", items };
  }

  private block(): { k: "block"; body: Stmt[] } {
    this.expect("{");
    const body: Stmt[] = [];
    while (!this.is("}")) { if (this.cur.k === "eof") throw new CError(this.cur.line, "Missing closing '}'."); body.push(this.stmt()); }
    this.expect("}");
    return { k: "block", body };
  }

  stmt(): Stmt {
    const line = this.cur.line;
    if (this.is("{")) return this.block();
    if (this.eat(";")) return { k: "empty" };
    if (this.eat("if")) { this.expect("("); const c = this.expr(); this.expect(")"); const a = this.stmt(); const b = this.eat("else") ? this.stmt() : undefined; return { k: "if", c, a, b, line }; }
    if (this.eat("while")) { this.expect("("); const c = this.expr(); this.expect(")"); return { k: "while", c, body: this.stmt(), line }; }
    if (this.eat("do")) { const body = this.stmt(); this.expect("while"); this.expect("("); const c = this.expr(); this.expect(")"); this.expect(";"); return { k: "do", c, body, line }; }
    if (this.eat("for")) {
      this.expect("(");
      let init: Stmt | undefined;
      if (!this.eat(";")) {
        if (this.isTypeAt()) { const t = this.parseType(); init = this.declRest(t.type, t.ptr, line, false); }
        else { init = { k: "expr", e: this.expr(), line }; this.expect(";"); }
      }
      const c = this.is(";") ? undefined : this.expr(); this.expect(";");
      const step = this.is(")") ? undefined : this.expr(); this.expect(")");
      return { k: "for", init, c, step, body: this.stmt(), line };
    }
    if (this.eat("return")) { const e = this.is(";") ? undefined : this.expr(); this.expect(";"); return { k: "ret", e, line }; }
    if (this.eat("break")) { this.expect(";"); return { k: "brk", line }; }
    if (this.eat("continue")) { this.expect(";"); return { k: "cont", line }; }
    if (this.eat("switch")) {
      this.expect("("); const e = this.expr(); this.expect(")"); this.expect("{");
      const cases: Array<{ v?: Expr; body: Stmt[] }> = [];
      while (!this.is("}")) {
        if (this.eat("case")) { const v = this.cond(); this.expect(":"); cases.push({ v, body: [] }); }
        else if (this.eat("default")) { this.expect(":"); cases.push({ body: [] }); }
        else { if (!cases.length) throw new CError(this.cur.line, "Statement before first case."); cases[cases.length - 1]!.body.push(this.stmt()); }
      }
      this.expect("}");
      return { k: "switch", e, cases, line };
    }
    if (this.isTypeAt()) { const t = this.parseType(); return this.declRest(t.type, t.ptr, line, t.isStatic); }
    const e = this.expr(); this.expect(";");
    return { k: "expr", e, line };
  }

  expr(): Expr { let e = this.assign(); while (this.eat(",")) e = { k: "bin", op: ",", a: e, b: this.assign() }; return e; }

  private assign(): Expr {
    const t = this.cond();
    if (this.cur.k === "op" && ASSIGN.has(this.cur.v)) { const op = this.next().v; return { k: "asg", op, t, e: this.assign() }; }
    return t;
  }

  private cond(): Expr {
    const c = this.bin(1);
    if (this.eat("?")) { const a = this.assign(); this.expect(":"); const b = this.cond(); return { k: "cond", c, a, b }; }
    return c;
  }

  private bin(min: number): Expr {
    let a = this.unary();
    for (;;) {
      const op = this.cur.v, prec = this.cur.k === "op" ? BIN_PREC[op] : undefined;
      if (!prec || prec < min) return a;
      this.next();
      a = { k: "bin", op, a, b: this.bin(prec + 1) };
    }
  }

  private unary(): Expr {
    const t = this.cur;
    if (t.k === "op" && ["!", "~", "-", "+", "*", "&"].includes(t.v)) { this.next(); return { k: "un", op: t.v, e: this.unary() }; }
    if (t.k === "op" && (t.v === "++" || t.v === "--")) { this.next(); return { k: "un", op: t.v, e: this.unary() }; }
    if (t.k === "id" && t.v === "sizeof") {
      this.next(); this.expect("(");
      let size = 4;
      if (this.isTypeAt()) { const ty = this.parseType(); size = ty.ptr ? 4 : sizeOf(ty.type); } else this.expr();
      this.expect(")");
      return { k: "sizeof", size };
    }
    if (t.v === "(" && t.k === "op" && this.isTypeAt(1)) {
      const save = this.p; this.next();
      const ty = this.parseType();
      if (this.eat(")")) return { k: "cast", type: ty.type, ptr: ty.ptr, e: this.unary() };
      this.p = save;
    }
    return this.postfix(this.primary());
  }

  private postfix(e: Expr): Expr {
    for (;;) {
      if (this.is("(")) { const line = this.next().line; const args: Expr[] = []; if (!this.is(")")) do { args.push(this.assign()); } while (this.eat(",")); this.expect(")"); e = { k: "call", fn: e, args, line }; }
      else if (this.eat("[")) { const i = this.expr(); this.expect("]"); e = { k: "idx", e, i }; }
      else if (this.is(".") || this.is("->")) { this.next(); e = { k: "mem", e, name: this.ident().v }; }
      else if (this.is("++") || this.is("--")) e = { k: "post", op: this.next().v, e };
      else return e;
    }
  }

  private primary(): Expr {
    const t = this.next();
    if (t.k === "num") return { k: "num", v: numValue(t.v), float: Boolean(t.float) };
    if (t.k === "chr") return { k: "num", v: t.v.charCodeAt(0), float: false };
    if (t.k === "str") { let v = t.v; while (this.cur.k === "str") v += this.next().v; return { k: "str", v }; }
    if (t.k === "id") {
      if (t.v === "true" || t.v === "HIGH") return { k: "num", v: 1, float: false };
      if (t.v === "false" || t.v === "LOW" || t.v === "NULL") return { k: "num", v: 0, float: false };
      return { k: "id", name: t.v, line: t.line };
    }
    if (t.v === "(") { const e = this.expr(); this.expect(")"); return e; }
    if (t.v === "{") { this.p--; return this.initList(); }
    throw new CError(t.line, t.k === "eof" ? "Unexpected end of code." : `Unexpected '${t.v}'.`);
  }
}

export function sizeOf(type: string): number {
  if (/64|double/.test(type)) return 8;
  if (/32|long|float|int(?!8|16)|word32|u32/.test(type) && !/short/.test(type)) return 4;
  if (/16|short|word|u16/.test(type)) return 2;
  return 1;
}

export function compileC(source: string): { program?: Program; diagnostics: Diagnostic[] } {
  try {
    const pre = preprocess(source);
    if (pre.diagnostics.length) return { diagnostics: pre.diagnostics };
    const parser = new Parser(pre.tokens);
    const { functions, globals } = parser.program();
    const defines: Record<string, number | string> = {};
    for (const [name, macro] of pre.macros) {
      if (macro.params) continue;
      const toks = expand(macro.body, pre.macros, 0);
      if (toks.length === 1 && toks[0]!.k === "num") defines[name] = numValue(toks[0]!.v);
      else if (toks.length === 2 && toks[0]!.v === "-" && toks[1]!.k === "num") defines[name] = -numValue(toks[1]!.v);
      else if (toks.length === 1 && toks[0]!.k === "str") defines[name] = toks[0]!.v;
      else {
        try {
          const e = new Parser(toks).expr();
          const v = constEval(e);
          if (v !== undefined) defines[name] = v;
        } catch { /* non-constant macro */ }
      }
    }
    return { program: { functions, globals, defines, source }, diagnostics: [] };
  } catch (error) {
    if (error instanceof CError) return { diagnostics: [{ line: error.line, message: error.message }] };
    return { diagnostics: [{ line: 0, message: error instanceof Error ? error.message : String(error) }] };
  }
}

function constEval(e: Expr): number | undefined {
  switch (e.k) {
    case "num": return e.v;
    case "un": { const v = constEval(e.e); if (v === undefined) return undefined; return e.op === "-" ? -v : e.op === "~" ? ~v >>> 0 : e.op === "!" ? Number(!v) : v; }
    case "cast": return constEval(e.e);
    case "bin": { const a = constEval(e.a), b = constEval(e.b); if (a === undefined || b === undefined) return undefined; return binop(e.op, a, b, false); }
    default: return undefined;
  }
}

function binop(op: string, a: number, b: number, float: boolean): number {
  switch (op) {
    case "+": return a + b; case "-": return a - b; case "*": return a * b;
    case "/": if (b === 0) throw new Error("Division by zero."); return float ? a / b : Math.trunc(a / b);
    case "%": if (b === 0) throw new Error("Modulo by zero."); return a % b;
    case "<<": return (a << b) >>> 0; case ">>": return a >= 0 ? a >>> b : a >> b;
    case "&": return (a & b) >>> 0; case "|": return (a | b) >>> 0; case "^": return (a ^ b) >>> 0;
    case "==": return Number(a === b); case "!=": return Number(a !== b);
    case "<": return Number(a < b); case ">": return Number(a > b); case "<=": return Number(a <= b); case ">=": return Number(a >= b);
    case "&&": return Number(Boolean(a) && Boolean(b)); case "||": return Number(Boolean(a) || Boolean(b));
    case ",": return b;
  }
  return 0;
}

/* ---------------- Runtime ---------------- */

export type ArrVal = { kind: "arr"; slot: Slot; off: number; dims: number[] };
export type RefVal = { kind: "ref"; ref: Ref; name: string };
export type Val = number | string | ArrVal | RefVal;
export type Slot = { name: string; type: string; ptr: boolean; v: Val; data?: Val[]; dims?: number[]; alias?: Ref };
/** `mmio` = access width in bytes for memory-mapped locations, whose value must not be re-read after a store. */
export type Ref = { get(): Val; set(v: Val): void; type: string; name: string; float: boolean; mmio?: number };
const mmioValue = (v: Val, bytes: number) => { const n = toNum(v) >>> 0; return bytes >= 4 ? n : n & ((1 << (8 * bytes)) - 1); };

export class Wait { constructor(readonly seconds: number) {} }
export class Block { constructor(readonly ready: () => boolean, readonly timeout = Infinity, readonly onWake?: (timedOut: boolean) => Val, readonly label = "") {} }

export interface Host {
  call?(name: string, args: Val[], fw: Firmware, thread: Thread): Val | Wait | Block | undefined | void;
  reg?(path: string): Ref | undefined;
  peripheral?(name: string): boolean;
  readMem?(addr: number, size: number): number;
  writeMem?(addr: number, v: number, size: number): void;
  constant?(name: string): number | undefined;
  print?(text: string): void;
}

type Yld = number | Wait | Block | "yield";
type Gen<T> = Generator<Yld, T, unknown>;

class Scope {
  readonly vars = new Map<string, Slot>();
  constructor(readonly parent?: Scope) {}
  find(name: string): Slot | undefined { return this.vars.get(name) ?? this.parent?.find(name); }
}

export type Frame = { fn: string; line: number; scope: Scope };
export type ThreadState = "ready" | "running" | "blocked" | "suspended" | "done";
export class Thread {
  state: ThreadState = "ready";
  wakeAt = Infinity;
  waitFor?: Block;
  runTime = 0;
  frames: Frame[] = [];
  line = 0;
  basePrio: number;
  blockedLabel = "";
  lastResult?: Val;
  constructor(readonly id: number, public name: string, public prio: number, readonly kind: "main" | "task" | "isr", public gen: Gen<unknown> | null, public core = 0) { this.basePrio = prio; }
}

export type TraceSeg = { thread: string; kind: Thread["kind"]; t0: number; t1: number; core: number };
export type Sem = { id: number; kind: "mutex" | "binary" | "counting"; count: number; max: number; owner?: Thread; name: string; inherit: boolean };
export type Queue = { id: number; items: Val[]; length: number; name: string };

class Return { constructor(readonly v: Val) {} }
class Break {}
class Continue {}
const BREAK = new Break(), CONT = new Continue();

const MATH: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, pow: Math.pow, fabs: Math.abs, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  exp: Math.exp, log: Math.log, log10: Math.log10, atan: Math.atan, atan2: Math.atan2, asin: Math.asin, acos: Math.acos, sinf: Math.sin, cosf: Math.cos, sqrtf: Math.sqrt, fabsf: Math.abs, roundf: Math.round, fmod: (a, b) => a % b,
  min: Math.min, max: Math.max, constrain: (x, a, b) => Math.min(b, Math.max(a, x)), map: (x, a, b, c, d) => Math.trunc(c + (x - a) * (d - c) / (b - a || 1)), sq: (x) => x * x,
};
const FLOAT_FN = new Set(["sin", "cos", "tan", "sqrt", "pow", "fabs", "exp", "log", "log10", "atan", "atan2", "asin", "acos", "sinf", "cosf", "sqrtf", "fabsf", "fmod"]);
const NOOP = /^(HAL_Init|SystemClock_Config|SystemInit|SystemCoreClockUpdate|MX_\w+_Init|Error_Handler|HAL_\w+_MspInit|__NOP|__DSB|__ISB|wdt_enable|Serial\.begin|Serial\.flush|Serial\d?\.begin|Wire\.begin|SPI\.begin|initLCD|lcd_init|oled_init|tft_init|printf_init|stdio_init_all)$/;

export function wrapType(type: string, ptr: boolean, v: number): number {
  if (ptr || !Number.isFinite(v)) return Number.isFinite(v) ? v : 0;
  if (/float|double/.test(type)) return v;
  if (/bool|boolean|_Bool|\bbit\b|sbit/.test(type)) return v ? 1 : 0;
  const t = Math.trunc(v);
  if (/uint8_t|unsigned char|byte|u8\b/.test(type)) return t & 0xff;
  if (/int8_t|^char$|signed char/.test(type)) return (t << 24) >> 24;
  if (/uint16_t|unsigned short|word|u16\b/.test(type)) return t & 0xffff;
  if (/int16_t|short/.test(type)) return (t << 16) >> 16;
  if (/uint64_t|int64_t/.test(type)) return t;
  if (/unsigned|uint32_t|size_t|u32\b|TickType_t/.test(type)) return t >>> 0;
  if (/long/.test(type)) return t | 0;
  return t | 0;
}

export function formatC(fmt: string, args: Val[]): string {
  let i = 0;
  return fmt.replace(/%([-+0 #]*)(\d+)?(?:\.(\d+))?(hh|h|ll|l|z)?([diuxXfFcsep%])/g, (_, flags: string, width: string | undefined, prec: string | undefined, _len: string | undefined, conv: string) => {
    if (conv === "%") return "%";
    const a = args[i++];
    let s: string;
    const n = typeof a === "number" ? a : Number(a ?? 0);
    switch (conv) {
      case "d": case "i": s = String(Math.trunc(n)); break;
      case "u": s = String(Math.trunc(n) >>> 0); break;
      case "x": s = (Math.trunc(n) >>> 0).toString(16); break;
      case "X": s = (Math.trunc(n) >>> 0).toString(16).toUpperCase(); break;
      case "f": case "F": case "e": s = conv === "e" ? n.toExponential(prec ? Number(prec) : 6) : n.toFixed(prec !== undefined ? Number(prec) : 6); break;
      case "c": s = String.fromCharCode(n); break;
      case "s": s = typeof a === "string" ? a : a && typeof a === "object" && a.kind === "arr" ? arrToString(a) : String(a ?? ""); break;
      case "p": s = `0x${(Math.trunc(n) >>> 0).toString(16).padStart(8, "0")}`; break;
      default: s = String(a);
    }
    const w = width ? Number(width) : 0;
    if (s.length < w) s = flags.includes("-") ? s.padEnd(w) : s.padStart(w, flags.includes("0") && conv !== "s" ? "0" : " ");
    return s;
  });
}

function arrToString(a: ArrVal): string {
  const data = a.slot.data ?? [];
  let s = "";
  for (let k = a.off; k < data.length; k++) { const c = data[k]; if (typeof c !== "number" || c === 0) break; s += String.fromCharCode(c); }
  return s;
}

export interface FirmwareOptions { ips?: number; tickHz?: number; inheritance?: boolean; cores?: number }

export class Firmware {
  time = 0;
  ips: number;
  threads: Thread[] = [];
  current?: Thread;
  globals = new Scope();
  error?: Diagnostic;
  paused = false;
  pauseReason = "";
  breakpoints = new Set<number>();
  private stepMode: null | { kind: "into" | "over" | "out" | "line"; thread: Thread; depth: number; line: number } = null;
  private skipBreak = false;
  line = 0;
  statements = 0;
  busyTime = 0;
  idleTime = 0;
  switches = 0;
  trace: TraceSeg[] = [];
  private segStart = 0;
  private segThread?: Thread;
  sems: Sem[] = [];
  queues: Queue[] = [];
  eventBits = 0;
  schedulerStarted = false;
  inheritance: boolean;
  readonly cores: number;
  coreBusy: number[];
  private nextId = 1;
  printed: string[] = [];
  irqPending: string[] = [];
  irqPriority = new Map<string, number>();
  irqEnabled = new Set<string>();
  globalIrqEnabled = true;
  lastIsr?: { name: string; t0: number; t1: number };
  isrLog: Array<{ name: string; t0: number; t1: number; depth: number }> = [];
  private sliceStart = 0;
  private floatCache = new WeakMap<Expr, boolean>();
  writes: Array<{ t: number; name: string; v: number }> = [];
  onIsrExit?: (name: string) => void;
  /** Value of a struct field written through `var.field` (e.g. `htim2.Init.Period`). */
  field(path: string): number | undefined { const s = this.globals.vars.get(path); return s && typeof s.v === "number" ? s.v : undefined; }
  setField(path: string, v: Val) { const s = this.globals.vars.get(path); if (s) s.v = v; else this.globals.vars.set(path, { name: path, type: "int", ptr: false, v }); }
  functionsWithVector(): FnDef[] { return [...this.program.functions.values()].filter((f) => f.vector); }

  constructor(readonly program: Program, readonly host: Host, opts: FirmwareOptions = {}) {
    this.ips = opts.ips ?? 400_000;
    this.inheritance = opts.inheritance ?? true;
    this.cores = opts.cores ?? 1;
    this.coreBusy = new Array(this.cores).fill(0);
    try {
      for (const s of program.globals) if (s.k === "decl") this.declareSync(s, this.globals);
    } catch (error) { this.fail(error, 0); }
    const main = program.functions.get("main");
    const setup = program.functions.get("setup"), loop = program.functions.get("loop");
    if (main) this.spawn("main", 1, "main", this.callGen(main, [], undefined));
    else if (loop) this.spawn("loop", 1, "main", this.arduinoMain(setup, loop));
    else if (!this.error) this.error = { line: 1, message: "Add int main(void) { ... } or void setup()/void loop()." };
  }

  get define() { return this.program.defines; }

  private *arduinoMain(setup: FnDef | undefined, loop: FnDef): Gen<void> {
    const th = this.current!;
    if (setup) yield* this.callGen(setup, [], th);
    for (;;) { yield* this.callGen(loop, [], th); yield "yield"; }
  }

  spawn(name: string, prio: number, kind: Thread["kind"], gen: Gen<unknown> | null, core = 0): Thread {
    const th = new Thread(this.nextId++, name, prio, kind, gen, core);
    this.threads.push(th);
    return th;
  }

  hasFunction(name: string) { return this.program.functions.has(name); }

  /** Queue an interrupt; it runs at the next statement boundary if enabled and of sufficient priority. */
  raise(handler: string, prio?: number, args: Val[] = []): boolean {
    const fn = this.program.functions.get(handler);
    if (!fn || !this.globalIrqEnabled || this.error) return false;
    const p = prio ?? this.irqPriority.get(handler) ?? 0;
    // Hardware priority: ISRs sit above all tasks; lower NVIC numbers preempt higher ones.
    const th = this.spawn(handler, 1000 - p, "isr", null);
    th.gen = this.callGen(fn, args, th);
    th.wakeAt = this.time;
    this.isrLog.push({ name: handler, t0: this.time, t1: NaN, depth: this.threads.filter((t) => t.kind === "isr" && t.state !== "done").length });
    if (this.isrLog.length > 200) this.isrLog.splice(0, this.isrLog.length - 200);
    return true;
  }

  get halted() { return Boolean(this.error) || this.threads.every((t) => t.state === "done"); }

  setBreakpoints(lines: Iterable<number>) { this.breakpoints = new Set(lines); }

  resume() { this.paused = false; this.pauseReason = ""; this.skipBreak = true; this.stepMode = null; }
  step(kind: "into" | "over" | "out" | "line") {
    const th = this.current ?? this.threads.find((t) => t.state !== "done");
    if (!th) return;
    this.stepMode = { kind, thread: th, depth: th.frames.length, line: th.line };
    this.paused = false; this.skipBreak = true;
  }
  pause(reason = "Paused") { this.paused = true; this.pauseReason = reason; }

  private pick(): Thread | undefined {
    let best: Thread | undefined;
    for (const th of this.threads) {
      if (th.state === "blocked") {
        if (th.waitFor ? th.waitFor.ready() || this.time >= th.wakeAt : this.time >= th.wakeAt) {
          const timedOut = th.waitFor ? !th.waitFor.ready() : false;
          if (th.waitFor?.onWake) th.lastResult = th.waitFor.onWake(timedOut);
          th.state = "ready"; th.waitFor = undefined; th.blockedLabel = ""; th.wakeAt = Infinity;
        }
      }
      if ((th.state === "ready" || th.state === "running") && (!best || th.prio > best.prio)) best = th;
    }
    return best;
  }

  private nextWake(): number {
    let t = Infinity;
    for (const th of this.threads) if (th.state === "blocked") t = Math.min(t, th.wakeAt);
    return t;
  }

  private closeSeg() {
    if (this.segThread && this.time > this.segStart) {
      const last = this.trace[this.trace.length - 1];
      if (last && last.thread === this.segThread.name && Math.abs(last.t1 - this.segStart) < 1e-9) last.t1 = this.time;
      else this.trace.push({ thread: this.segThread.name, kind: this.segThread.kind, t0: this.segStart, t1: this.time, core: this.segThread.core });
      if (this.trace.length > 600) this.trace.splice(0, this.trace.length - 600);
    }
    this.segStart = this.time;
  }

  /** Execute until simulated time reaches `target` seconds or the statement budget runs out. */
  run(target: number, budget = 60_000): void {
    if (this.error) return;
    let guard = 0;
    while (this.time < target && budget > 0 && !this.paused && !this.error) {
      if (++guard > budget * 4) break;
      const th = this.pick();
      if (!th) {
        const wake = Math.min(this.nextWake(), target);
        this.closeSeg(); this.segThread = undefined;
        const dt = Math.max(0, wake - this.time);
        this.idleTime += dt;
        this.time += dt || 1 / this.ips;
        continue;
      }
      if (th !== this.current) {
        if (this.current && this.current.state === "running") this.current.state = "ready";
        if (this.current && this.current.state !== "done") this.switches++;
        this.current = th;
        this.sliceStart = this.time;
      }
      if (this.segThread !== th) { this.closeSeg(); this.segThread = th; }
      th.state = "running";
      // Round-robin time slicing among equal-priority tasks every RTOS tick.
      if (th.kind === "task" && this.time - this.sliceStart >= 0.001) {
        const peer = this.threads.find((o) => o !== th && o.kind === "task" && o.state === "ready" && o.prio === th.prio);
        if (peer) { th.state = "ready"; this.threads.splice(this.threads.indexOf(th), 1); this.threads.push(th); this.sliceStart = this.time; continue; }
      }
      let r: IteratorResult<Yld, unknown>;
      try {
        r = th.gen!.next(th.lastResult);
        th.lastResult = undefined;
      } catch (error) {
        this.fail(error, th.line);
        break;
      }
      if (r.done) {
        th.state = "done";
        if (th.kind === "isr") { const rec = [...this.isrLog].reverse().find((x) => x.name === th.name && Number.isNaN(x.t1)); if (rec) rec.t1 = this.time; this.lastIsr = { name: th.name, t0: rec?.t0 ?? this.time, t1: this.time }; this.onIsrExit?.(th.name); }
        this.threads = this.threads.filter((t) => t.state !== "done" || t.kind === "main");
        continue;
      }
      const v = r.value;
      if (typeof v === "number") {
        if (this.breakpoints.has(v) && !this.skipBreak) { this.pauseAt(th, v, `Breakpoint at line ${v}`); break; }
        if (this.stepMode && !this.skipBreak) {
          const sm = this.stepMode;
          const depth = th.frames.length;
          const hit = sm.kind === "into" || sm.kind === "line" ? true : sm.kind === "over" ? th === sm.thread && depth <= sm.depth : th === sm.thread && depth < sm.depth;
          if (hit) { this.stepMode = null; this.pauseAt(th, v, "Step"); break; }
        }
        this.skipBreak = false;
        th.line = v; this.line = v;
        const dt = 1 / this.ips;
        this.time += dt; th.runTime += dt; this.busyTime += dt; this.coreBusy[th.core] = (this.coreBusy[th.core] ?? 0) + dt;
        this.statements++; budget--;
      } else if (v === "yield") {
        if (th.kind === "task") { th.state = "ready"; this.threads.splice(this.threads.indexOf(th), 1); this.threads.push(th); }
      } else if (v instanceof Wait) {
        th.state = "blocked"; th.wakeAt = this.time + Math.max(0, v.seconds); th.blockedLabel = "delay";
      } else if (v instanceof Block) {
        th.state = "blocked"; th.waitFor = v; th.wakeAt = this.time + v.timeout; th.blockedLabel = v.label;
      }
    }
    if (this.time >= target) this.closeSeg();
  }

  private pauseAt(th: Thread, line: number, reason: string) {
    this.paused = true; this.pauseReason = reason; th.line = line; this.line = line; this.current = th;
    // Re-deliver the same line marker on resume: the statement has not executed yet.
    const gen = th.gen!;
    th.gen = (function* (): Gen<unknown> { yield line; return yield* gen; })();
  }

  fail(error: unknown, line: number) {
    const message = error instanceof CError ? error.message : error instanceof Error ? error.message : String(error);
    this.error = { line: error instanceof CError ? error.line : line || this.line, message };
  }

  /* ----- variable access for inspectors ----- */
  globalValue(name: string): Val | undefined { const s = this.globals.find(name); return s ? (s.data ? { kind: "arr", slot: s, off: 0, dims: s.dims ?? [s.data.length] } : s.v) : undefined; }
  num(name: string, fallback = 0): number { const v = this.globalValue(name); return typeof v === "number" ? v : fallback; }
  /** Debugger-style write to a scalar global. Returns false if there is no such scalar. */
  setGlobal(name: string, v: number): boolean {
    const s = this.globals.find(name);
    if (!s || s.data || typeof s.v !== "number") return false;
    s.v = /float|double/.test(s.type) ? v : Math.trunc(v);
    return true;
  }
  locals(th = this.current): Array<[string, Val]> {
    const frame = th?.frames[th.frames.length - 1];
    const out: Array<[string, Val]> = [];
    let sc: Scope | undefined = frame?.scope;
    while (sc && sc !== this.globals) { for (const [k, s] of sc.vars) if (!out.some(([n]) => n === k)) out.push([k, s.data ? `[${s.data.length}]` : s.v]); sc = sc.parent; }
    return out;
  }
  globalsList(): Array<[string, Val, string]> { return [...this.globals.vars.values()].filter((s) => !s.name.includes("@")).map((s) => [s.name, s.data ? `{${s.data.slice(0, 8).map((x) => typeof x === "number" ? x : "?").join(", ")}${s.data.length > 8 ? ", …" : ""}}` : s.v, s.type]); }

  /* ----- declarations ----- */
  private declareSync(s: Extract<Stmt, { k: "decl" }>, scope: Scope) {
    const g = this.declGen(s, scope, undefined);
    for (let r = g.next(); !r.done; r = g.next()) { /* globals cannot block */ }
  }

  private *declGen(s: Extract<Stmt, { k: "decl" }>, scope: Scope, th: Thread | undefined): Gen<void> {
    for (const d of s.decls) {
      if (s.isStatic && scope !== this.globals) {
        const key = `${d.name}@${s.line}`;
        const existing = this.globals.vars.get(key);
        if (existing) { scope.vars.set(d.name, existing); continue; }
      }
      const slot: Slot = { name: d.name, type: d.type, ptr: d.ptr && d.dims.length === 0, v: 0 };
      if (/\bsbit\b/.test(d.type) && d.init?.k === "bin" && d.init.op === "^" && d.init.a.k === "id") {
        const bit = Math.trunc(yield* this.numGen(d.init.b, scope, th));
        const reg = this.host.reg?.(`${d.init.a.name}.${bit}`);
        if (!reg) throw new CError(s.line, `sbit ${d.name}: SFR ${d.init.a.name} is not modelled.`);
        slot.alias = reg;
        scope.vars.set(d.name, slot);
        continue;
      }
      if (/\bsfr(16)?\b/.test(d.type)) {
        const reg = this.host.reg?.(d.name);
        if (reg) { slot.alias = reg; scope.vars.set(d.name, slot); continue; }
      }
      if (d.dims.length) {
        const dims: number[] = [];
        for (let k = 0; k < d.dims.length; k++) {
          const de = d.dims[k];
          if (de) dims.push(Math.max(0, Math.trunc(yield* this.numGen(de, scope, th))));
          else dims.push(d.init?.k === "init" ? d.init.items.length : d.init?.k === "str" ? d.init.v.length + 1 : 1);
        }
        const total = dims.reduce((a, b) => a * b, 1);
        if (total > 65536) throw new CError(s.line, `Array ${d.name} is too large for this simulator.`);
        slot.dims = dims;
        slot.data = new Array<Val>(total).fill(0);
        if (d.init) {
          if (d.init.k === "str") for (let k = 0; k < d.init.v.length && k < total; k++) slot.data[k] = d.init.v.charCodeAt(k);
          else if (d.init.k === "init") {
            const flat: Expr[] = [];
            const flatten = (e: Expr) => { if (e.k === "init") e.items.forEach(flatten); else flat.push(e); };
            flatten(d.init);
            for (let k = 0; k < flat.length && k < total; k++) slot.data[k] = wrapType(d.type, false, yield* this.numGen(flat[k]!, scope, th));
          }
        }
      } else if (d.init && d.init.k === "init" && d.init.items.some((x) => x.k === "desig")) {
        // Designated initializer: fill the per-variable field store used by member access.
        const todo: Array<[string, Expr]> = [[d.name, d.init]];
        while (todo.length) {
          const [pre, ie] = todo.pop()!;
          if (ie.k !== "init") continue;
          for (const it of ie.items) {
            if (it.k !== "desig") continue;
            const key = `${pre}.${it.name}`;
            if (it.e.k === "init" && it.e.items.some((x) => x.k === "desig")) { todo.push([key, it.e]); continue; }
            const v = yield* this.ev(it.e, scope, th);
            this.globals.vars.set(key, { name: key, type: "int", ptr: false, v });
          }
        }
        slot.v = 0;
      } else if (d.init) {
        const v = yield* this.ev(d.init, scope, th);
        slot.v = typeof v === "number" ? wrapType(d.type, slot.ptr, v) : v;
      }
      scope.vars.set(d.name, slot);
      if (s.isStatic && scope !== this.globals) this.globals.vars.set(`${d.name}@${s.line}`, slot);
    }
  }

  /* ----- function calls ----- */
  *callGen(fn: FnDef, args: Val[], th: Thread | undefined): Gen<Val> {
    const thread = th ?? this.current;
    const scope = new Scope(this.globals);
    fn.params.forEach((p, k) => {
      const a = args[k] ?? 0;
      scope.vars.set(p.name, { name: p.name, type: p.type, ptr: p.ptr, v: typeof a === "number" ? wrapType(p.type, p.ptr, a) : a });
    });
    if (thread) thread.frames.push({ fn: fn.name, line: fn.line, scope });
    if (thread && thread.frames.length > 64) throw new CError(fn.line, `Stack overflow: call depth exceeded in ${fn.name}().`);
    try {
      yield* this.block(fn.body, scope, thread);
    } catch (signal) {
      if (signal instanceof Return) return signal.v;
      throw signal;
    } finally {
      if (thread) thread.frames.pop();
    }
    return 0;
  }

  private *block(body: Stmt[], scope: Scope, th: Thread | undefined): Gen<void> {
    for (const s of body) yield* this.exec(s, scope, th);
  }

  private *exec(s: Stmt, scope: Scope, th: Thread | undefined): Gen<void> {
    switch (s.k) {
      case "empty": return;
      case "block": yield* this.block(s.body, new Scope(scope), th); return;
      case "expr": this.mark(th, s.line); yield s.line; yield* this.ev(s.e, scope, th); return;
      case "decl": this.mark(th, s.line); yield s.line; yield* this.declGen(s, scope, th); return;
      case "if": this.mark(th, s.line); yield s.line; if (truthy(yield* this.ev(s.c, scope, th))) yield* this.exec(s.a, scope, th); else if (s.b) yield* this.exec(s.b, scope, th); return;
      case "while":
        for (;;) {
          this.mark(th, s.line); yield s.line;
          if (!truthy(yield* this.ev(s.c, scope, th))) return;
          try { yield* this.exec(s.body, scope, th); } catch (sig) { if (sig === BREAK) return; if (sig !== CONT) throw sig; }
        }
      case "do":
        for (;;) {
          try { yield* this.exec(s.body, scope, th); } catch (sig) { if (sig === BREAK) return; if (sig !== CONT) throw sig; }
          this.mark(th, s.line); yield s.line;
          if (!truthy(yield* this.ev(s.c, scope, th))) return;
        }
      case "for": {
        const inner = new Scope(scope);
        if (s.init) { if (s.init.k === "decl") yield* this.declGen(s.init, inner, th); else if (s.init.k === "expr") yield* this.ev(s.init.e, inner, th); }
        for (;;) {
          this.mark(th, s.line); yield s.line;
          if (s.c && !truthy(yield* this.ev(s.c, inner, th))) return;
          try { yield* this.exec(s.body, inner, th); } catch (sig) { if (sig === BREAK) return; if (sig !== CONT) throw sig; }
          if (s.step) yield* this.ev(s.step, inner, th);
        }
      }
      case "ret": this.mark(th, s.line); yield s.line; throw new Return(s.e ? yield* this.ev(s.e, scope, th) : 0);
      case "brk": throw BREAK;
      case "cont": throw CONT;
      case "switch": {
        this.mark(th, s.line); yield s.line;
        const v = yield* this.ev(s.e, scope, th);
        let start = -1;
        for (let k = 0; k < s.cases.length; k++) { const c = s.cases[k]!; if (c.v && (yield* this.ev(c.v, scope, th)) === v) { start = k; break; } }
        if (start < 0) start = s.cases.findIndex((c) => !c.v);
        if (start < 0) return;
        try { for (let k = start; k < s.cases.length; k++) yield* this.block(s.cases[k]!.body, scope, th); } catch (sig) { if (sig !== BREAK) throw sig; }
        return;
      }
    }
  }

  private mark(th: Thread | undefined, line: number) { if (th) { const f = th.frames[th.frames.length - 1]; if (f) f.line = line; } }

  /* ----- expressions ----- */
  private *numGen(e: Expr, scope: Scope, th: Thread | undefined): Gen<number> {
    const v = yield* this.ev(e, scope, th);
    return toNum(v);
  }

  isFloat(e: Expr, scope: Scope): boolean {
    const cached = this.floatCache.get(e);
    if (cached !== undefined && e.k !== "id") return cached;
    let r = false;
    switch (e.k) {
      case "num": r = e.float; break;
      case "id": { const s = scope.find(e.name); r = s ? /float|double/.test(s.type) && !s.ptr : false; break; }
      case "cast": r = /float|double/.test(e.type) && !e.ptr; break;
      case "bin": r = ["+", "-", "*", "/", "%"].includes(e.op) ? this.isFloat(e.a, scope) || this.isFloat(e.b, scope) : false; break;
      case "un": r = e.op === "-" || e.op === "+" ? this.isFloat(e.e, scope) : false; break;
      case "cond": r = this.isFloat(e.a, scope) || this.isFloat(e.b, scope); break;
      case "asg": r = this.isFloat(e.t, scope); break;
      case "post": r = this.isFloat(e.e, scope); break;
      case "idx": { const base = rootId(e); const s = base ? scope.find(base) : undefined; r = s ? /float|double/.test(s.type) : false; break; }
      case "call": { const name = e.fn.k === "id" ? e.fn.name : ""; const f = this.program.functions.get(name); r = f ? /float|double/.test(f.type) : FLOAT_FN.has(name) || /Voltage|readTemp|readHum|Float/.test(name); break; }
      default: r = false;
    }
    if (e.k !== "id") this.floatCache.set(e, r);
    return r;
  }

  *ev(e: Expr, scope: Scope, th: Thread | undefined): Gen<Val> {
    switch (e.k) {
      case "num": return e.v;
      case "str": return e.v;
      case "sizeof": return e.size;
      case "init": return e.items[0]?.k === "desig" ? 0 : yield* this.ev(e.items[0] ?? { k: "num", v: 0, float: false }, scope, th);
      case "desig": return yield* this.ev(e.e, scope, th);
      case "id": {
        const s = scope.find(e.name);
        if (s) return s.alias ? s.alias.get() : s.data ? { kind: "arr", slot: s, off: 0, dims: s.dims ?? [s.data.length] } : s.v;
        const reg = this.host.reg?.(e.name);
        if (reg) return reg.get();
        const c = this.host.constant?.(e.name);
        if (c !== undefined) return c;
        const d = this.program.defines[e.name];
        if (d !== undefined) return d;
        const b = BUILTIN_CONST[e.name];
        if (b !== undefined) return b;
        if (this.program.functions.has(e.name)) return e.name;
        if (HANDLE_RE.test(e.name) || /_IRQn$/.test(e.name)) return e.name;
        throw new CError(e.line, `'${e.name}' is not declared.`);
      }
      case "cast": {
        const v = yield* this.ev(e.e, scope, th);
        return typeof v === "number" ? wrapType(e.type, e.ptr, v) : v;
      }
      case "un": {
        if (e.op === "&") {
          if (e.e.k === "id" && scope.find(e.e.name)?.data) return yield* this.ev(e.e, scope, th);
          const ref = yield* this.lval(e.e, scope, th);
          return { kind: "ref", ref, name: ref.name };
        }
        if (e.op === "*") {
          const target = yield* this.ev(e.e, scope, th);
          return this.deref(target, e).get();
        }
        if (e.op === "++" || e.op === "--") {
          const ref = yield* this.lval(e.e, scope, th);
          const nv = toNum(ref.get()) + (e.op === "++" ? 1 : -1);
          ref.set(nv);
          return ref.get();
        }
        const v = toNum(yield* this.ev(e.e, scope, th));
        if (e.op === "-") return -v;
        if (e.op === "+") return v;
        if (e.op === "!") return Number(!v);
        return (~v) >>> 0;
      }
      case "post": {
        const ref = yield* this.lval(e.e, scope, th);
        const old = toNum(ref.get());
        ref.set(old + (e.op === "++" ? 1 : -1));
        return old;
      }
      case "bin": {
        if (e.op === "&&") { const a = yield* this.ev(e.a, scope, th); if (!truthy(a)) return 0; return Number(truthy(yield* this.ev(e.b, scope, th))); }
        if (e.op === "||") { const a = yield* this.ev(e.a, scope, th); if (truthy(a)) return 1; return Number(truthy(yield* this.ev(e.b, scope, th))); }
        const a = yield* this.ev(e.a, scope, th);
        const b = yield* this.ev(e.b, scope, th);
        if ((e.op === "==" || e.op === "!=") && typeof a !== "number" && typeof b !== "number") {
          const key = (x: Exclude<Val, number>) => (typeof x === "string" ? x : x.kind === "ref" ? x.name : `${x.slot.name}+${x.off}`);
          return Number((key(a) === key(b)) === (e.op === "=="));
        }
        if (typeof a === "object" && a.kind === "arr" && (e.op === "+" || e.op === "-")) return { ...a, off: a.off + (e.op === "+" ? toNum(b) : -toNum(b)) };
        try { return binop(e.op, toNum(a), toNum(b), this.isFloat(e, scope)); } catch (error) { throw new CError(exprLine(e), error instanceof Error ? error.message : String(error)); }
      }
      case "cond": return truthy(yield* this.ev(e.c, scope, th)) ? yield* this.ev(e.a, scope, th) : yield* this.ev(e.b, scope, th);
      case "asg": {
        const ref = yield* this.lval(e.t, scope, th);
        const rhs = yield* this.ev(e.e, scope, th);
        if (e.op === "=") { ref.set(rhs); return ref.mmio ? mmioValue(rhs, ref.mmio) : ref.get(); }
        const op = e.op.slice(0, -1);
        let next: Val;
        try { next = binop(op, toNum(ref.get()), toNum(rhs), ref.float || this.isFloat(e.e, scope)); } catch (error) { throw new CError(exprLine(e.t), error instanceof Error ? error.message : String(error)); }
        ref.set(next);
        return ref.mmio ? mmioValue(next, ref.mmio) : ref.get();
      }
      case "idx": case "mem": return (yield* this.lval(e, scope, th)).get();
      case "call": return yield* this.call(e, scope, th);
    }
  }

  private deref(target: Val, e: Expr): Ref {
    if (typeof target === "object" && target.kind === "ref") return target.ref;
    if (typeof target === "object" && target.kind === "arr") return this.elemRef(target, 0);
    if (typeof target === "number") {
      const addr = target >>> 0;
      const size = e.k === "un" && e.e.k === "cast" ? sizeOf(e.e.type) : 4;
      const reg = this.host.readMem;
      if (!reg) throw new CError(exprLine(e), `No memory at address 0x${addr.toString(16)}.`);
      return { name: `*0x${addr.toString(16).toUpperCase()}`, type: "uint32_t", float: false, mmio: size, get: () => this.host.readMem!(addr, size), set: (v) => { this.host.writeMem?.(addr, toNum(v), size); this.writes.push({ t: this.time, name: `0x${addr.toString(16)}`, v: toNum(v) }); } };
    }
    throw new CError(exprLine(e), "Cannot dereference this value.");
  }

  private elemRef(a: ArrVal, i: number): Ref {
    const stride = a.dims.slice(1).reduce((x, y) => x * y, 1);
    const index = a.off + i * stride;
    if (a.dims.length > 1) {
      const sub: ArrVal = { kind: "arr", slot: a.slot, off: index, dims: a.dims.slice(1) };
      return { name: a.slot.name, type: a.slot.type, float: false, get: () => sub, set: () => { throw new Error("Cannot assign to an array row."); } };
    }
    const data = a.slot.data!;
    if (index < 0 || index >= data.length) throw new CError(this.line, `Index ${i} is outside ${a.slot.name}[${data.length}] (buffer overflow).`);
    return { name: `${a.slot.name}[${index}]`, type: a.slot.type, float: /float|double/.test(a.slot.type), get: () => data[index] ?? 0, set: (v) => { data[index] = typeof v === "number" ? wrapType(a.slot.type, false, v) : v; } };
  }

  *lval(e: Expr, scope: Scope, th: Thread | undefined): Gen<Ref> {
    if (e.k === "id") {
      const s = scope.find(e.name);
      if (s?.alias) return this.trackReg(s.alias);
      if (s) return { name: s.name, type: s.type, float: /float|double/.test(s.type) && !s.ptr, get: () => s.data ? { kind: "arr", slot: s, off: 0, dims: s.dims ?? [] } : s.v, set: (v) => { if (/const/.test(s.type)) throw new CError(e.line, `'${s.name}' is const.`); s.v = typeof v === "number" ? wrapType(s.type, s.ptr, v) : v; } };
      const reg = this.host.reg?.(e.name);
      if (reg) return this.trackReg(reg);
      if (HANDLE_RE.test(e.name)) { const name = e.name; return { name, type: "handle", float: false, get: () => name, set: () => undefined }; }
      throw new CError(e.line, `'${e.name}' is not declared.`);
    }
    if (e.k === "idx") {
      if (e.e.k === "mem") {
        const base = memPath(e.e);
        if (base) { const i = toNum(yield* this.ev(e.i, scope, th)); const reg = this.host.reg?.(`${base}${i}`) ?? this.host.reg?.(`${base}[${i}]`); if (reg) return this.trackReg(reg); }
      }
      const arr = yield* this.ev(e.e, scope, th);
      const i = Math.trunc(toNum(yield* this.ev(e.i, scope, th)));
      if (typeof arr === "object" && arr.kind === "arr") return this.elemRef(arr, i);
      if (typeof arr === "object" && arr.kind === "ref") { const inner = arr.ref.get(); if (typeof inner === "object" && inner.kind === "arr") return this.elemRef(inner, i); }
      if (typeof arr === "string") { const str = arr; return { name: "str", type: "char", float: false, get: () => str.charCodeAt(i) || 0, set: () => { throw new CError(exprLine(e), "String literals are read-only."); } }; }
      if (typeof arr === "number" && this.host.readMem) { const addr = (arr + i * 4) >>> 0; return this.deref(addr, e); }
      throw new CError(exprLine(e), "Subscripted value is not an array.");
    }
    if (e.k === "mem") {
      const path = memPath(e);
      if (path) {
        const root = path.split(".")[0]!;
        const s = scope.find(root);
        if (s && typeof s.v === "object" && s.v.kind === "ref") { const r = this.host.reg?.(`${s.v.name}.${path.split(".").slice(1).join(".")}`); if (r) return this.trackReg(r); }
        const reg = this.host.reg?.(path);
        if (reg) return this.trackReg(reg);
        if (this.host.peripheral?.(root) || /^(GPIO[A-K]?|TIM\d*|USART\d*|UART\d*|ADC\d*|SPI\d*|I2C\d*|RCC|EXTI|NVIC|SysTick|DAC\d*|DMA\d*|IWDG|RTC|PWR)$/.test(root)) throw new CError(exprLine(e), `Register ${path.replace(".", "->")} is not modelled in this lab.`);
        // Plain struct-like field on a variable: keep a per-variable field store.
        const holder = s ?? this.globals.find(root);
        if (holder) {
          const key = `${holder.name}.${path.split(".").slice(1).join(".")}`;
          let field = this.globals.vars.get(key);
          if (!field) { field = { name: key, type: "int", ptr: false, v: 0 }; this.globals.vars.set(key, field); }
          const f = field;
          return { name: key, type: "int", float: false, get: () => f.v, set: (v) => { f.v = v; } };
        }
      }
      throw new CError(exprLine(e), "Unsupported member access.");
    }
    if (e.k === "un" && e.op === "*") return this.deref(yield* this.ev(e.e, scope, th), e);
    if (e.k === "cast") return yield* this.lval(e.e, scope, th);
    throw new CError(exprLine(e), "Expression is not assignable.");
  }

  private trackReg(reg: Ref): Ref {
    return { ...reg, set: (v) => { reg.set(v); this.writes.push({ t: this.time, name: reg.name, v: reg.mmio ? mmioValue(v, reg.mmio) : toNum(reg.get()) }); if (this.writes.length > 300) this.writes.splice(0, this.writes.length - 300); } };
  }

  private *call(e: Extract<Expr, { k: "call" }>, scope: Scope, th: Thread | undefined): Gen<Val> {
    const name = e.fn.k === "id" ? e.fn.name : e.fn.k === "mem" ? memPath(e.fn) ?? "" : "";
    if (!name) throw new CError(e.line, "Unsupported call target.");
    const fn = this.program.functions.get(name);
    const args: Val[] = [];
    for (const a of e.args) args.push(yield* this.ev(a, scope, th));
    if (fn) return yield* this.callGen(fn, args, th);
    const thread = th ?? this.current!;
    const result = this.host.call?.(name, args, this, thread);
    if (result !== undefined) return yield* this.settle(result, thread);
    if (e.fn.k === "mem" && e.fn.e.k === "id") {
      const objName = e.fn.e.name;
      const slot = scope.find(objName);
      if (slot) {
        const objRef: RefVal = { kind: "ref", name: objName, ref: { name: objName, type: slot.type, float: false, get: () => slot.v, set: (v) => { slot.v = v; } } };
        const typed = this.host.call?.(`${slot.type}.${e.fn.name}`, [objRef, ...args], this, thread) ?? stringMethod(slot, e.fn.name, args);
        if (typed !== undefined) return yield* this.settle(typed, thread);
      }
    }
    const builtin = this.builtin(name, args, e, thread);
    if (builtin !== undefined) return yield* this.settle(builtin, thread);
    const member = name.includes(".") ? name.split(".").pop()! : "";
    if (NOOP.test(name) || /^(begin|flush|attach|init|clear|display|setCursor|backlight)$/.test(member)) return 0;
    throw new CError(e.line, `Unknown function ${name}().`);
  }

  private *settle(r: Val | Wait | Block | void, th: Thread): Gen<Val> {
    if (r instanceof Wait) { yield r; return 0; }
    if (r instanceof Block) { const got = yield r; return (got as Val | undefined) ?? 0; }
    void th;
    return (r ?? 0) as Val;
  }

  private builtin(name: string, args: Val[], e: Extract<Expr, { k: "call" }>, th: Thread): Val | Wait | Block | undefined {
    const n = (k: number) => toNum(args[k] ?? 0);
    if (/^Serial\d\./.test(name)) name = `Serial.${name.slice(name.indexOf(".") + 1)}`;
    if (name in MATH) return MATH[name]!(...args.map(toNum));
    switch (name) {
      case "HAL_Delay": case "delay": case "delay_ms": case "_delay_ms": case "__delay_ms": case "osDelay": case "sleep_ms": case "Delay_ms": case "msDelay": return new Wait(n(0) / 1000);
      case "delayMicroseconds": case "_delay_us": case "__delay_us": case "delay_us": return new Wait(n(0) / 1e6);
      case "vTaskDelay": return new Wait(n(0) / 1000);
      case "vTaskDelayUntil": { const ref = args[0]; const last = typeof ref === "object" && ref.kind === "ref" ? toNum(ref.ref.get()) : 0; const next = last + n(1); if (typeof ref === "object" && ref.kind === "ref") ref.ref.set(next); return new Wait(Math.max(0, next / 1000 - this.time)); }
      case "pdMS_TO_TICKS": return n(0);
      case "millis": case "HAL_GetTick": case "xTaskGetTickCount": case "osKernelGetTickCount": return Math.floor(this.time * 1000);
      case "micros": return Math.floor(this.time * 1e6);
      case "printf": case "Serial.print": case "Serial.println": case "Serial.printf": case "puts": case "uart_print": case "Serial.write": {
        let text = name === "printf" || name === "Serial.printf" ? formatC(typeof args[0] === "string" ? args[0] : String(args[0] ?? ""), args.slice(1))
          : typeof args[0] === "number" && args.length > 1 && name !== "Serial.write" ? (args[1] === 16 || args[1] === 0x10 ? (args[0] >>> 0).toString(16).toUpperCase() : args[1] === 2 ? (args[0] >>> 0).toString(2) : (args[0] as number).toFixed(Math.max(0, n(1))))
          : typeof args[0] === "number" ? (name === "Serial.write" ? String.fromCharCode(args[0]) : formatNum(args[0], this.isFloat(e.args[0]!, this.globals) || !Number.isInteger(args[0])))
          : typeof args[0] === "object" && args[0].kind === "arr" ? arrToString(args[0]) : String(args[0] ?? "");
        if (name === "Serial.println" || name === "puts") text += "\n";
        this.emit(text);
        return text.length;
      }
      case "sprintf": case "snprintf": {
        const buf = args[0];
        const fmtIndex = name === "snprintf" ? 2 : 1;
        const text = formatC(String(args[fmtIndex] ?? ""), args.slice(fmtIndex + 1));
        if (typeof buf === "object" && buf.kind === "arr") { const data = buf.slot.data!; for (let k = 0; k < text.length && buf.off + k < data.length - 1; k++) data[buf.off + k] = text.charCodeAt(k); data[Math.min(data.length - 1, buf.off + text.length)] = 0; }
        return text.length;
      }
      case "strlen": return typeof args[0] === "string" ? args[0].length : typeof args[0] === "object" && args[0].kind === "arr" ? arrToString(args[0]).length : 0;
      case "memset": { const a = args[0]; if (typeof a === "object" && a.kind === "arr") { const d = a.slot.data!; for (let k = 0; k < n(2) && a.off + k < d.length; k++) d[a.off + k] = n(1); } return 0; }
      case "rand": case "random": { const seed = (this.statements * 1103515245 + 12345) & 0x7fffffff; return args.length === 2 ? n(0) + (seed % Math.max(1, n(1) - n(0))) : args.length === 1 ? seed % Math.max(1, n(0)) : seed; }
      case "__disable_irq": case "cli": case "noInterrupts": case "taskENTER_CRITICAL": case "portENTER_CRITICAL": this.globalIrqEnabled = false; return 0;
      case "__enable_irq": case "sei": case "interrupts": case "taskEXIT_CRITICAL": case "portEXIT_CRITICAL": this.globalIrqEnabled = true; return 0;
      case "__WFI": case "__wfi": case "__WFE": case "sleep_cpu": case "PCON_IDLE": return new Block(() => this.threads.some((t) => t.kind === "isr" && t.state !== "done"), Infinity, undefined, "WFI");
      case "NVIC_SetPriority": { const irq = irqName(args[0]); this.irqPriority.set(`${irq}_IRQHandler`, n(1)); this.irqPriority.set(irq, n(1)); return 0; }
      case "HAL_NVIC_SetPriority": { const irq = irqName(args[0]); this.irqPriority.set(`${irq}_IRQHandler`, n(1)); this.irqPriority.set(irq, n(1)); return 0; }
      case "NVIC_EnableIRQ": case "HAL_NVIC_EnableIRQ": { const irq = irqName(args[0]); this.irqEnabled.add(irq); return 0; }
      case "NVIC_DisableIRQ": case "HAL_NVIC_DisableIRQ": { this.irqEnabled.delete(irqName(args[0])); return 0; }
      /* ---- FreeRTOS ---- */
      case "xTaskCreate": case "xTaskCreatePinnedToCore": {
        const fnName = typeof args[0] === "string" ? args[0] : "";
        const fn = this.program.functions.get(fnName);
        if (!fn) throw new CError(e.line, `Task function ${String(args[0])} not found.`);
        const label = typeof args[1] === "string" ? args[1] : fnName;
        const core = name === "xTaskCreatePinnedToCore" ? Math.min(this.cores - 1, Math.max(0, n(6))) : 0;
        const task = this.spawn(label, n(4), "task", null, core);
        task.gen = this.callGen(fn, [args[3] ?? 0], task);
        const handle = args[5];
        if (typeof handle === "object" && handle.kind === "ref") handle.ref.set(task.id);
        return 1;
      }
      case "vTaskStartScheduler": case "osKernelStart": this.schedulerStarted = true; return new Block(() => false, Infinity, undefined, "scheduler");
      case "taskYIELD": case "portYIELD": case "yield": return undefined;
      case "vTaskSuspend": { const t = this.taskById(args[0], th); if (t) { t.state = "suspended"; } return t === th ? new Block(() => th.state !== "suspended", Infinity, undefined, "suspended") : 0; }
      case "vTaskResume": { const t = this.taskById(args[0], th); if (t && t.state === "suspended") t.state = "ready"; return 0; }
      case "vTaskPrioritySet": { const t = this.taskById(args[0], th); if (t) { t.prio = n(1); t.basePrio = n(1); } return 0; }
      case "uxTaskPriorityGet": { const t = this.taskById(args[0], th); return t?.prio ?? 0; }
      case "vTaskDelete": { const t = this.taskById(args[0], th); if (t) t.state = "done"; return t === th ? new Block(() => false, Infinity, undefined, "deleted") : 0; }
      case "xSemaphoreCreateMutex": case "xSemaphoreCreateBinary": case "xSemaphoreCreateCounting": {
        const kind = name.endsWith("Mutex") ? "mutex" : name.endsWith("Binary") ? "binary" : "counting";
        const sem: Sem = { id: this.sems.length + 1, kind, count: kind === "mutex" ? 1 : kind === "counting" ? n(1) : 0, max: kind === "counting" ? n(0) : 1, name: kind, inherit: kind === "mutex" && this.inheritance };
        this.sems.push(sem);
        return 0x5e000 + sem.id;
      }
      case "xSemaphoreTake": {
        const sem = this.sems[toNum(args[0] ?? 0) - 0x5e001];
        if (!sem) throw new CError(e.line, "xSemaphoreTake on an uncreated semaphore.");
        const timeout = n(1) >= 0xffffffff || n(1) === -1 || args[1] === undefined ? Infinity : n(1) / 1000;
        const grab = () => { sem.count--; if (sem.kind === "mutex") sem.owner = th; return 1; };
        if (sem.count > 0) return grab();
        if (timeout === 0) return 0;
        if (sem.kind === "mutex" && sem.inherit && sem.owner && sem.owner.prio < th.prio) sem.owner.prio = th.prio;
        return new Block(() => sem.count > 0, timeout, (timedOut) => (timedOut ? 0 : grab()), `take ${sem.kind}`);
      }
      case "xSemaphoreGive": case "xSemaphoreGiveFromISR": {
        const sem = this.sems[toNum(args[0] ?? 0) - 0x5e001];
        if (!sem) throw new CError(e.line, "xSemaphoreGive on an uncreated semaphore.");
        if (sem.count >= sem.max) return 0;
        sem.count++;
        if (sem.kind === "mutex" && sem.owner) { sem.owner.prio = sem.owner.basePrio; sem.owner = undefined; }
        return 1;
      }
      case "uxSemaphoreGetCount": { const sem = this.sems[toNum(args[0] ?? 0) - 0x5e001]; return sem?.count ?? 0; }
      case "xQueueCreate": { const q: Queue = { id: this.queues.length + 1, items: [], length: Math.max(1, n(0)), name: `Q${this.queues.length + 1}` }; this.queues.push(q); return 0x9e000 + q.id; }
      case "xQueueSend": case "xQueueSendToBack": case "xQueueSendFromISR": {
        const q = this.queues[toNum(args[0] ?? 0) - 0x9e001];
        if (!q) throw new CError(e.line, "xQueueSend on an uncreated queue.");
        const item = args[1];
        const value = typeof item === "object" && item.kind === "ref" ? item.ref.get() : item ?? 0;
        const put = () => { q.items.push(value); return 1; };
        if (q.items.length < q.length) return put();
        const timeout = name === "xQueueSendFromISR" ? 0 : n(2) >= 0xffffffff ? Infinity : n(2) / 1000;
        if (timeout === 0) return 0;
        return new Block(() => q.items.length < q.length, timeout, (to) => (to ? 0 : put()), "queue full");
      }
      case "xQueueReceive": {
        const q = this.queues[toNum(args[0] ?? 0) - 0x9e001];
        if (!q) throw new CError(e.line, "xQueueReceive on an uncreated queue.");
        const dest = args[1];
        const take = () => { const v = q.items.shift() ?? 0; if (typeof dest === "object" && dest.kind === "ref") dest.ref.set(v); return 1; };
        if (q.items.length) return take();
        const timeout = n(2) >= 0xffffffff ? Infinity : n(2) / 1000;
        if (timeout === 0) return 0;
        return new Block(() => q.items.length > 0, timeout, (to) => (to ? 0 : take()), "queue empty");
      }
      case "uxQueueMessagesWaiting": { const q = this.queues[toNum(args[0] ?? 0) - 0x9e001]; return q?.items.length ?? 0; }
      case "xEventGroupCreate": return 0xe0001;
      case "xEventGroupSetBits": this.eventBits = (this.eventBits | n(1)) >>> 0; return this.eventBits;
      case "xEventGroupClearBits": this.eventBits = (this.eventBits & ~n(1)) >>> 0; return this.eventBits;
      case "xEventGroupGetBits": return this.eventBits;
      case "xEventGroupWaitBits": {
        const mask = n(1), clear = n(2), all = n(3);
        const ok = () => (all ? (this.eventBits & mask) === mask : (this.eventBits & mask) !== 0);
        const done = () => { const bits = this.eventBits; if (clear) this.eventBits = (this.eventBits & ~mask) >>> 0; return bits; };
        if (ok()) return done();
        const timeout = n(4) >= 0xffffffff ? Infinity : n(4) / 1000;
        return new Block(ok, timeout, (to) => (to ? this.eventBits : done()), "event bits");
      }
      case "xPortGetCoreID": return th.core;
      case "Serial.available": return 0;
      case "Serial.read": return -1;
    }
    return undefined;
  }

  private taskById(arg: Val | undefined, self: Thread): Thread | undefined {
    if (arg === undefined || arg === 0) return self;
    const id = toNum(arg);
    return this.threads.find((t) => t.id === id);
  }

  emit(text: string) {
    this.host.print?.(text);
    this.printed.push(text);
    if (this.printed.length > 400) this.printed.splice(0, this.printed.length - 400);
  }
}

const BUILTIN_CONST: Record<string, number> = {
  portMAX_DELAY: 0xffffffff, pdTRUE: 1, pdFALSE: 0, pdPASS: 1, pdFAIL: 0, portTICK_PERIOD_MS: 1, configTICK_RATE_HZ: 1000, tskIDLE_PRIORITY: 0, configMAX_PRIORITIES: 25, tskNO_AFFINITY: -1,
  INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, INPUT_PULLDOWN: 3, RISING: 3, FALLING: 2, CHANGE: 1, LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19,
  HAL_OK: 0, HAL_ERROR: 1, HAL_BUSY: 2, HAL_TIMEOUT: 3, HAL_MAX_DELAY: 0xffffffff, GPIO_PIN_RESET: 0, GPIO_PIN_SET: 1, ENABLE: 1, DISABLE: 0, SET: 1, RESET: 0,
  UINT8_MAX: 255, UINT16_MAX: 65535, UINT32_MAX: 0xffffffff, INT16_MAX: 32767, INT32_MAX: 0x7fffffff, M_PI: Math.PI, PI: Math.PI, EOF: -1,
};

const HANDLE_RE = /^(GPIO[A-K]|TIM\d+|USART\d|UART\d|ADC\d|SPI\d|I2C\d|DAC\d?|DMA\d|RCC|EXTI|NVIC|SysTick|IWDG|RTC|PWR|FLASH|CAN\d?|hadc\d|htim\d+|huart\d|hspi\d|hi2c\d|hdac\d?|hiwdg|hrtc|hcan\d?|hdma\w*)$/;

function stringMethod(slot: Slot, method: string, args: Val[]): Val | undefined {
  if (!/String/.test(slot.type)) return undefined;
  const s = typeof slot.v === "string" ? slot.v : "";
  switch (method) {
    case "trim": slot.v = s.trim(); return 0;
    case "length": return s.length;
    case "toInt": return Number.parseInt(s, 10) || 0;
    case "toFloat": return Number.parseFloat(s) || 0;
    case "equals": return Number(s === args[0]);
    case "startsWith": return Number(s.startsWith(String(args[0] ?? "")));
    case "indexOf": return s.indexOf(String(args[0] ?? ""));
    case "substring": return s.substring(toNum(args[0]), args[1] === undefined ? undefined : toNum(args[1]));
    case "toUpperCase": slot.v = s.toUpperCase(); return 0;
    case "toLowerCase": slot.v = s.toLowerCase(); return 0;
  }
  return undefined;
}

function irqName(v: Val | undefined): string { return typeof v === "string" ? v.replace(/_IRQn$/, "").replace(/_IRQHandler$/, "") : String(v ?? ""); }
function rootId(e: Expr): string | undefined { if (e.k === "id") return e.name; if (e.k === "idx" || e.k === "mem") return rootId(e.e); return undefined; }
function memPath(e: Expr): string | undefined {
  if (e.k === "id") return e.name;
  if (e.k === "mem") { const base = memPath(e.e); return base ? `${base}.${e.name}` : undefined; }
  return undefined;
}
function exprLine(e: Expr): number {
  switch (e.k) { case "id": return e.line; case "call": return e.line; case "bin": return exprLine(e.a) || exprLine(e.b); case "un": case "post": case "cast": return exprLine(e.e); case "asg": return exprLine(e.t); case "idx": case "mem": return exprLine(e.e); default: return 0; }
}
export function toNum(v: Val | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return v.length ? 1 : 0;
  if (v && typeof v === "object" && v.kind === "ref") return toNum(v.ref.get());
  return v ? 1 : 0;
}
function truthy(v: Val): boolean { return typeof v === "number" ? v !== 0 && !Number.isNaN(v) : Boolean(v); }
function formatNum(v: number, float: boolean): string { return float ? v.toFixed(2) : String(v); }
