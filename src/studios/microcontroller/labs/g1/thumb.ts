import { compileC, type Diagnostic, type Expr, type FnDef, type Stmt } from "../core/cinterp";

/** Registers 0–12 are general purpose; 13 = SP, 14 = LR, 15 = PC. */
export const SP = 13, LR = 14, PC = 15;
export const regName = (r: number) => (r === SP ? "SP" : r === LR ? "LR" : r === PC ? "PC" : `R${r}`);

export interface Ins {
  op: string;
  rd?: number; rn?: number; rm?: number; imm?: number;
  cond?: string; target?: string; regs?: number[];
  addr: number; size: number; line: number; fn: string; text: string; note?: string; slot?: string;
  /** Show the literal as a hex address. */
  hex?: boolean;
}
export interface ThumbGlobal { name: string; addr: number; init: number; line: number }
export interface ThumbProgram {
  ins: Ins[];
  labels: Map<string, number>;
  byAddr: Map<number, number>;
  fns: Array<{ name: string; addr: number; end: number; line: number }>;
  diagnostics: Diagnostic[];
  /** Global variables in SRAM (only with ThumbOptions.globals). */
  globals: ThumbGlobal[];
  /** String literals placed in flash after the code (.rodata). */
  strings: Map<number, string>;
  /** Names for the data addresses the program touches (globals, peripheral registers). */
  symbols: Map<number, string>;
}

/** Opt-in extensions; with none set the compiler behaves exactly like the stack lab's. */
export interface ThumbOptions {
  /** Flash address of Reset_Handler. */
  codeBase?: number;
  /** Allow global int variables, placed one word apart from this SRAM address. */
  dataBase?: number;
  /** Address of a memory-mapped register written as PER->REG; also enables *(uint32_t *)ADDR. */
  mmio?: (per: string, reg: string) => number | undefined;
  /** Display name for a raw MMIO address. */
  mmioName?: (addr: number) => string | undefined;
  /** Functions provided by the host (delay_ms, printf, ...), called with up to 4 word arguments. */
  lib?: ReadonlySet<string>;
}

interface GenCtx {
  opts: ThumbOptions;
  globals: Map<string, number>;
  strings: Array<{ label: string; text: string }>;
  symbols: Map<number, string>;
}

class GenError extends Error { constructor(readonly line: number, message: string) { super(message); } }

type Item = { label: string } | Omit<Ins, "addr" | "size" | "text" | "fn">;

const ARITH: Record<string, string> = { "+": "ADD", "-": "SUB", "*": "MUL", "/": "SDIV", "&": "AND", "|": "ORR", "^": "EOR", "<<": "LSL", ">>": "ASR" };
const CMP: Record<string, string> = { "==": "EQ", "!=": "NE", "<": "LT", ">=": "GE", ">": "GT", "<=": "LE" };
const INV: Record<string, string> = { EQ: "NE", NE: "EQ", LT: "GE", GE: "LT", GT: "LE", LE: "GT" };
const IMM_OK = new Set(["ADD", "SUB", "LSL", "ASR"]);
const FLOAT = /float|double/;

function fmtIns(i: Omit<Ins, "addr" | "size" | "text" | "fn">): string {
  const R = regName;
  const m = i.op === "B" && i.cond ? `B${i.cond}` : i.op === "LDRI" ? "LDR" : i.op === "LDRSP" ? "LDR" : i.op === "STRSP" ? "STR" : i.op === "ADDSP" ? "ADD" : i.op === "SUBSP" ? "SUB" : i.op === "LIB" ? "BL" : i.op;
  const pad = (s: string) => s.padEnd(6);
  switch (i.op) {
    case "MOV": case "NEG": case "MVN": return `${pad(m)}${R(i.rd!)}, ${i.imm !== undefined ? `#${i.imm}` : R(i.rm!)}`;
    case "LDRI": return `${pad(m)}${R(i.rd!)}, =${i.target ?? (i.hex ? hx(i.imm!, 8) : i.imm)}`;
    case "LDR": case "STR": return `${pad(m)}${R(i.rd!)}, [${R(i.rn!)}${i.imm ? `, #${i.imm}` : ""}]`;
    case "LIB": return `${pad(m)}${i.target}`;
    case "CMP": return `${pad(m)}${R(i.rn!)}, ${i.imm !== undefined ? `#${i.imm}` : R(i.rm!)}`;
    case "B": case "BL": return `${pad(m)}${i.target}`;
    case "BX": return `${pad(m)}${R(i.rm!)}`;
    case "PUSH": case "POP": return `${pad(m)}{${regList(i.regs!)}}`;
    case "LDRSP": case "STRSP": return `${pad(m)}${R(i.rd!)}, [SP, #${i.imm}]`;
    case "ADDSP": case "SUBSP": return `${pad(m)}SP, SP, #${i.imm}`;
    case "BKPT": case "NOP": return m;
    default: return `${pad(m)}${R(i.rd!)}, ${R(i.rn!)}, ${i.imm !== undefined ? `#${i.imm}` : R(i.rm!)}`;
  }
}

function regList(regs: number[]): string {
  const low = regs.filter((r) => r < 13).sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < low.length;) {
    let j = i;
    while (j + 1 < low.length && low[j + 1] === low[j]! + 1) j++;
    parts.push(j - i >= 2 ? `R${low[i]}-R${low[j]}` : low.slice(i, j + 1).map((r) => `R${r}`).join(", "));
    i = j + 1;
  }
  return [...parts, ...regs.filter((r) => r >= 13).map(regName)].join(", ");
}

class FnGen {
  items: Item[] = [];
  private vars = new Map<string, number>();
  private spAdj = 0;
  private line: number;
  private loops: Array<{ brk: string; cont: string }> = [];
  private usedExit = false;
  constructor(private f: FnDef, private fns: Map<string, FnDef>, private defines: Record<string, number | string>, private labelSeq: { n: number }, private ctx: GenCtx = { opts: {}, globals: new Map(), strings: [], symbols: new Map() }) { this.line = f.line; }

  constant(e: Expr): number | undefined { return this.constVal(e); }

  /** Compile-time value of an address or constant expression. */
  private constVal(e: Expr): number | undefined {
    switch (e.k) {
      case "num": return e.float ? undefined : e.v;
      case "id": { const d = this.defines[e.name]; return typeof d === "number" && !this.vars.has(e.name) ? d : undefined; }
      case "cast": return this.constVal(e.e);
      case "un": { const v = this.constVal(e.e); if (v === undefined) return undefined; return e.op === "-" ? -v : e.op === "~" ? ~v : e.op === "+" ? v : undefined; }
      case "bin": {
        const a = this.constVal(e.a), b = this.constVal(e.b);
        if (a === undefined || b === undefined) return undefined;
        switch (e.op) { case "+": return a + b; case "-": return a - b; case "*": return Math.imul(a, b); case "|": return a | b; case "&": return a & b; case "^": return a ^ b; case "<<": return a << b; case ">>": return a >>> b; default: return undefined; }
      }
      default: return undefined;
    }
  }

  /** Data address of a global, a PER->REG register or *(type *)ADDR; undefined for locals and values. */
  private addrOf(e: Expr): { addr: number; name: string } | undefined {
    const { opts, globals } = this.ctx;
    if (e.k === "id" && !this.vars.has(e.name)) { const a = globals.get(e.name); return a === undefined ? undefined : { addr: a, name: e.name }; }
    if (e.k === "mem" && e.e.k === "id" && opts.mmio) {
      const a = opts.mmio(e.e.name, e.name);
      if (a === undefined) throw new GenError(this.line, `${e.e.name}->${e.name} is not a register this model knows.`);
      return { addr: a >>> 0, name: `${e.e.name}->${e.name}` };
    }
    if (e.k === "un" && e.op === "*" && opts.mmio) {
      const v = this.constVal(e.e);
      if (v === undefined) throw new GenError(this.line, "Only fixed addresses can be dereferenced here, e.g. *(volatile uint32_t *)0x40020014.");
      const addr = v >>> 0;
      if (addr & 3) throw new GenError(this.line, `${hx(addr, 8)} is not word-aligned: 32-bit registers sit on addresses that are multiples of 4.`);
      return { addr, name: opts.mmioName?.(addr) ?? hx(addr, 8) };
    }
    return undefined;
  }

  private loadAddr(a: { addr: number; name: string }, r: number) {
    this.ctx.symbols.set(a.addr, a.name);
    this.emit({ op: "LDRI", rd: r, imm: a.addr | 0, hex: true, note: `&${a.name}` });
  }

  private emit(i: Omit<Ins, "addr" | "size" | "text" | "fn" | "line">) { this.items.push({ ...i, line: this.line }); }
  private label(l: string) { this.items.push({ label: l }); }
  private fresh(tag: string) { return `.L${tag}${this.labelSeq.n++}`; }
  private off(name: string, line: number) {
    const slot = this.vars.get(name);
    if (slot === undefined) throw new GenError(line, `'${name}' is not a parameter or local variable of ${this.f.name}()`);
    return slot * 4 + this.spAdj;
  }
  private reg(r: number, line: number) { if (r > 7) throw new GenError(line, "Expression too deep for the low registers R0–R7 — split it into smaller statements."); }

  private collect(s: Stmt | undefined) {
    if (!s) return;
    switch (s.k) {
      case "decl":
        for (const d of s.decls) {
          if (d.dims.length || d.ptr) throw new GenError(s.line, `'${d.name}': arrays and pointers are not modelled in this stack lab — use plain int variables.`);
          if (FLOAT.test(d.type)) throw new GenError(s.line, `'${d.name}': floating point is not modelled — use int.`);
          if (!this.vars.has(d.name)) this.vars.set(d.name, this.vars.size);
        }
        break;
      case "if": this.collect(s.a); this.collect(s.b); break;
      case "while": case "do": this.collect(s.body); break;
      case "for": this.collect(s.init); this.collect(s.body); break;
      case "block": s.body.forEach((b) => this.collect(b)); break;
      default: break;
    }
  }

  generate(): Item[] {
    const f = this.f;
    const params = f.params.filter((p) => p.name);
    if (params.length > 4) throw new GenError(f.line, `${f.name}(): only up to 4 parameters fit in R0–R3 (AAPCS).`);
    for (const p of params) {
      if (p.ptr || FLOAT.test(p.type)) throw new GenError(f.line, `${f.name}(): parameter '${p.name}' must be a plain int.`);
      this.vars.set(p.name, this.vars.size);
    }
    f.body.forEach((s) => this.collect(s));
    const n = this.vars.size;
    this.label(f.name);
    this.emit({ op: "PUSH", regs: [LR], note: "save return address" });
    if (n) this.emit({ op: "SUBSP", imm: n * 4, note: `reserve ${n} local slot${n > 1 ? "s" : ""}` });
    params.forEach((p, i) => this.emit({ op: "STRSP", rd: i, imm: i * 4, note: `spill ${p.name}`, slot: p.name }));
    f.body.forEach((s, i) => this.stmt(s, i === f.body.length - 1));
    const last = f.body[f.body.length - 1];
    const endsForever = last?.k === "while" && last.c.k === "num" && last.c.v !== 0 && !hasBreak(last.body);
    if (!endsForever || this.usedExit) {
      this.line = lastLine(f);
      if (this.usedExit) this.label(`${f.name}_exit`);
      if (n) this.emit({ op: "ADDSP", imm: n * 4, note: "free locals" });
      this.emit({ op: "POP", regs: [LR], note: "restore return address" });
      this.emit({ op: "BX", rm: LR, note: "return to caller" });
    }
    return this.items;
  }

  private stmt(s: Stmt, isLast = false) {
    if ("line" in s) this.line = s.line;
    switch (s.k) {
      case "empty": return;
      case "block": s.body.forEach((b, i) => this.stmt(b, isLast && i === s.body.length - 1)); return;
      case "expr": this.expr(s.e, 0); return;
      case "decl":
        for (const d of s.decls) if (d.init) { this.expr(d.init, 0); this.emit({ op: "STRSP", rd: 0, imm: this.off(d.name, s.line), note: d.name, slot: d.name }); }
        return;
      case "ret":
        if (s.e) this.expr(s.e, 0);
        if (!isLast) { this.usedExit = true; this.emit({ op: "B", target: `${this.f.name}_exit` }); }
        return;
      case "if": {
        const elseL = this.fresh("else"), endL = this.fresh("endif");
        this.jumpIf(s.c, elseL, false, 0);
        this.stmt(s.a, isLast && !s.b);
        if (s.b) { this.line = s.line; this.emit({ op: "B", target: endL }); this.label(elseL); this.stmt(s.b, isLast); this.label(endL); }
        else this.label(elseL);
        return;
      }
      case "while": {
        if (s.c.k === "num" && s.c.v !== 0 && isEmpty(s.body)) { this.emit({ op: "BKPT", note: "while (1) — stop here" }); return; }
        const top = this.fresh("loop"), end = this.fresh("done");
        this.label(top);
        if (!(s.c.k === "num" && s.c.v !== 0)) this.jumpIf(s.c, end, false, 0);
        this.loops.push({ brk: end, cont: top });
        this.stmt(s.body);
        this.loops.pop();
        this.line = s.line;
        this.emit({ op: "B", target: top });
        this.label(end);
        return;
      }
      case "do": {
        const top = this.fresh("do"), cont = this.fresh("cond"), end = this.fresh("done");
        this.label(top);
        this.loops.push({ brk: end, cont });
        this.stmt(s.body);
        this.loops.pop();
        this.label(cont);
        this.line = s.line;
        this.jumpIf(s.c, top, true, 0);
        this.label(end);
        return;
      }
      case "for": {
        if (s.init) this.stmt(s.init);
        const top = this.fresh("for"), cont = this.fresh("next"), end = this.fresh("done");
        this.label(top);
        this.line = s.line;
        if (s.c) this.jumpIf(s.c, end, false, 0);
        this.loops.push({ brk: end, cont });
        this.stmt(s.body);
        this.loops.pop();
        this.label(cont);
        this.line = s.line;
        if (s.step) this.expr(s.step, 0);
        this.emit({ op: "B", target: top });
        this.label(end);
        return;
      }
      case "brk": case "cont": {
        const l = this.loops[this.loops.length - 1];
        if (!l) throw new GenError(s.line, `'${s.k === "brk" ? "break" : "continue"}' outside a loop`);
        this.emit({ op: "B", target: s.k === "brk" ? l.brk : l.cont });
        return;
      }
      default: throw new GenError("line" in s ? s.line : this.line, `'${s.k}' statements are not compiled in this lab — use if/while/for and function calls.`);
    }
  }

  private num(v: number, r: number) {
    if (v >= 0 && v <= 255) this.emit({ op: "MOV", rd: r, imm: v });
    else this.emit({ op: "LDRI", rd: r, imm: v | 0 });
  }

  private expr(e: Expr, r: number): void {
    this.reg(r, this.line);
    switch (e.k) {
      case "num":
        if (e.float) throw new GenError(this.line, "Floating-point constants are not modelled — use integers.");
        return this.num(e.v, r);
      case "id": {
        const d = this.defines[e.name];
        if (typeof d === "number" && !this.vars.has(e.name)) return this.num(d, r);
        const g = this.addrOf(e);
        if (g) { this.loadAddr(g, r); this.emit({ op: "LDR", rd: r, rn: r, imm: 0, note: g.name }); return; }
        this.emit({ op: "LDRSP", rd: r, imm: this.off(e.name, e.line), note: e.name, slot: e.name });
        return;
      }
      case "mem": {
        const a = this.addrOf(e);
        if (!a) throw new GenError(this.line, "Structure members are not modelled in this lab.");
        this.loadAddr(a, r);
        this.emit({ op: "LDR", rd: r, rn: r, imm: 0, note: a.name });
        return;
      }
      case "cast": return this.expr(e.e, r);
      case "un":
        if (e.op === "+") return this.expr(e.e, r);
        if (e.op === "-") { this.expr(e.e, r); this.emit({ op: "NEG", rd: r, rm: r }); return; }
        if (e.op === "~") { this.expr(e.e, r); this.emit({ op: "MVN", rd: r, rm: r }); return; }
        if (e.op === "!") return this.boolValue(e, r);
        if (e.op === "++" || e.op === "--") return this.incdec(e.e, e.op, r, false);
        if (e.op === "*") {
          const a = this.addrOf(e);
          if (a) { this.loadAddr(a, r); this.emit({ op: "LDR", rd: r, rn: r, imm: 0, note: a.name }); return; }
        }
        throw new GenError(this.line, `Operator '${e.op}' (pointers) is not modelled in this lab.`);
      case "post": return this.incdec(e.e, e.op, r, true);
      case "bin": {
        if (e.op in CMP || e.op === "&&" || e.op === "||") return this.boolValue(e, r);
        if (e.op === "%") {
          this.expr(e.a, r); this.expr(e.b, r + 1); this.reg(r + 2, this.line);
          this.emit({ op: "SDIV", rd: r + 2, rn: r, rm: r + 1 });
          this.emit({ op: "MUL", rd: r + 2, rn: r + 2, rm: r + 1 });
          this.emit({ op: "SUB", rd: r, rn: r, rm: r + 2, note: "remainder" });
          return;
        }
        const op = ARITH[e.op];
        if (!op) throw new GenError(this.line, `Operator '${e.op}' is not supported here.`);
        this.expr(e.a, r);
        if (e.b.k === "num" && !e.b.float && e.b.v >= 0 && e.b.v <= 255 && IMM_OK.has(op)) { this.emit({ op, rd: r, rn: r, imm: e.b.v }); return; }
        this.expr(e.b, r + 1);
        this.emit({ op, rd: r, rn: r, rm: r + 1 });
        return;
      }
      case "asg": {
        const val: Expr = e.op === "=" ? e.e : { k: "bin", op: e.op.slice(0, -1), a: e.t, b: e.e };
        const at = e.t.k === "id" && this.vars.has(e.t.name) ? undefined : this.addrOf(e.t);
        if (at) {
          this.expr(val, r);
          this.reg(r + 1, this.line);
          this.loadAddr(at, r + 1);
          this.emit({ op: "STR", rd: r, rn: r + 1, imm: 0, note: at.name });
          return;
        }
        if (e.t.k !== "id") throw new GenError(this.line, "Only plain variables can be assigned in this lab.");
        this.expr(val, r);
        this.emit({ op: "STRSP", rd: r, imm: this.off(e.t.name, e.t.line), note: e.t.name, slot: e.t.name });
        return;
      }
      case "cond": {
        const elseL = this.fresh("else"), endL = this.fresh("end");
        this.jumpIf(e.c, elseL, false, r);
        this.expr(e.a, r);
        this.emit({ op: "B", target: endL });
        this.label(elseL);
        this.expr(e.b, r);
        this.label(endL);
        return;
      }
      case "call": {
        const name = e.fn.k === "id" ? e.fn.name : "";
        const target = this.fns.get(name);
        if (!target && this.ctx.opts.lib?.has(name)) return this.libCall(name, e.args, e.line, r);
        if (!target) throw new GenError(e.line, `${name || "This call"}() is not defined in this file — the stack view only follows your own functions.`);
        const params = target.params.filter((p) => p.name);
        if (e.args.length !== params.length) throw new GenError(e.line, `${name}() expects ${params.length} argument${params.length === 1 ? "" : "s"}, got ${e.args.length}.`);
        if (e.args.length > 4) throw new GenError(e.line, `${name}(): more than 4 arguments would need the stack — keep it to R0–R3.`);
        const live = Array.from({ length: r }, (_, i) => i);
        if (r > 0) { this.emit({ op: "PUSH", regs: live, note: "keep temporaries" }); this.spAdj += 4 * r; }
        e.args.forEach((a, i) => this.expr(a, i));
        this.emit({ op: "BL", target: name, note: `call ${name}()` });
        if (r > 0) { this.emit({ op: "MOV", rd: r, rm: 0, note: "result" }); this.emit({ op: "POP", regs: live }); this.spAdj -= 4 * r; }
        return;
      }
      default: throw new GenError(this.line, `'${e.k}' expressions are not modelled in this lab.`);
    }
  }

  private libCall(name: string, args: Expr[], line: number, r: number) {
    if (args.length > 4) throw new GenError(line, `${name}(): this model passes at most 4 arguments, in R0–R3.`);
    const live = Array.from({ length: r }, (_, i) => i);
    if (r > 0) { this.emit({ op: "PUSH", regs: live, note: "keep temporaries" }); this.spAdj += 4 * r; }
    args.forEach((a, i) => {
      if (a.k === "str") {
        const label = `.LC${this.ctx.strings.length}`;
        this.ctx.strings.push({ label, text: a.v });
        this.emit({ op: "LDRI", rd: i, imm: 0, target: label, note: `"${a.v.replace(/\n/g, "\\n")}"` });
      } else this.expr(a, i);
    });
    this.emit({ op: "LIB", target: name, imm: args.length, note: `library: ${name}()` });
    if (r > 0) { this.emit({ op: "MOV", rd: r, rm: 0, note: "result" }); this.emit({ op: "POP", regs: live }); this.spAdj -= 4 * r; }
  }

  private incdec(t: Expr, op: string, r: number, post: boolean) {
    const at = t.k === "id" && this.vars.has(t.name) ? undefined : this.addrOf(t);
    if (at) {
      const alu = op === "++" ? "ADD" : "SUB";
      this.reg(r + 2, this.line);
      this.loadAddr(at, r + 1);
      this.emit({ op: "LDR", rd: r, rn: r + 1, imm: 0, note: at.name });
      if (post) { this.emit({ op: alu, rd: r + 2, rn: r, imm: 1 }); this.emit({ op: "STR", rd: r + 2, rn: r + 1, imm: 0, note: at.name }); }
      else { this.emit({ op: alu, rd: r, rn: r, imm: 1 }); this.emit({ op: "STR", rd: r, rn: r + 1, imm: 0, note: at.name }); }
      return;
    }
    if (t.k !== "id") throw new GenError(this.line, "++/-- needs a plain variable here.");
    const off = this.off(t.name, t.line);
    const alu = op === "++" ? "ADD" : "SUB";
    this.reg(r + 1, this.line);
    this.emit({ op: "LDRSP", rd: r, imm: off, note: t.name, slot: t.name });
    if (post) { this.emit({ op: alu, rd: r + 1, rn: r, imm: 1 }); this.emit({ op: "STRSP", rd: r + 1, imm: off, note: t.name, slot: t.name }); }
    else { this.emit({ op: alu, rd: r, rn: r, imm: 1 }); this.emit({ op: "STRSP", rd: r, imm: off, note: t.name, slot: t.name }); }
  }

  private boolValue(e: Expr, r: number) {
    const f = this.fresh("f"), end = this.fresh("b");
    this.jumpIf(e, f, false, r);
    this.emit({ op: "MOV", rd: r, imm: 1 });
    this.emit({ op: "B", target: end });
    this.label(f);
    this.emit({ op: "MOV", rd: r, imm: 0 });
    this.label(end);
  }

  /** Branch to `label` when the condition's truth equals `when`. */
  private jumpIf(c: Expr, label: string, when: boolean, r: number): void {
    if (c.k === "num") { if ((c.v !== 0) === when) this.emit({ op: "B", target: label }); return; }
    if (c.k === "un" && c.op === "!") return this.jumpIf(c.e, label, !when, r);
    if (c.k === "bin" && (c.op === "&&" || c.op === "||")) {
      const and = c.op === "&&";
      if (and !== when) { this.jumpIf(c.a, label, when, r); this.jumpIf(c.b, label, when, r); return; }
      const skip = this.fresh("sc");
      this.jumpIf(c.a, skip, !when, r);
      this.jumpIf(c.b, label, when, r);
      this.label(skip);
      return;
    }
    if (c.k === "bin" && c.op in CMP) {
      this.expr(c.a, r);
      if (c.b.k === "num" && !c.b.float && c.b.v >= 0 && c.b.v <= 255) this.emit({ op: "CMP", rn: r, imm: c.b.v });
      else { this.expr(c.b, r + 1); this.emit({ op: "CMP", rn: r, rm: r + 1 }); }
      const cc = CMP[c.op]!;
      this.emit({ op: "B", cond: when ? cc : INV[cc]!, target: label });
      return;
    }
    this.expr(c, r);
    this.emit({ op: "CMP", rn: r, imm: 0 });
    this.emit({ op: "B", cond: when ? "NE" : "EQ", target: label });
  }
}

function isEmpty(s: Stmt): boolean { return s.k === "empty" || (s.k === "block" && s.body.every(isEmpty)); }
function hasBreak(s: Stmt): boolean {
  if (s.k === "brk") return true;
  if (s.k === "block") return s.body.some(hasBreak);
  if (s.k === "if") return hasBreak(s.a) || (!!s.b && hasBreak(s.b));
  return false;
}
function lastLine(f: FnDef): number {
  let max = f.line;
  const walk = (s: Stmt | undefined) => {
    if (!s) return;
    if ("line" in s) max = Math.max(max, s.line);
    if (s.k === "block") s.body.forEach(walk);
    if (s.k === "if") { walk(s.a); walk(s.b); }
    if (s.k === "while" || s.k === "do" || s.k === "for") walk(s.body);
  };
  f.body.forEach(walk);
  return max + 1;
}

/** Compile the C subset (int functions, locals, if/while/for, calls, recursion) to Thumb-style assembly at -O0. */
export function compileThumb(source: string, opts: ThumbOptions = {}): ThumbProgram {
  const empty: ThumbProgram = { ins: [], labels: new Map(), byAddr: new Map(), fns: [], diagnostics: [], globals: [], strings: new Map(), symbols: new Map() };
  const { program, diagnostics } = compileC(source);
  if (!program || diagnostics.length) return { ...empty, diagnostics };
  try {
    const ctx: GenCtx = { opts, globals: new Map(), strings: [], symbols: new Map() };
    const globals: ThumbGlobal[] = [];
    for (const g of program.globals) {
      if (g.k !== "decl") continue;
      if (opts.dataBase === undefined) throw new GenError(g.line, "Global variables live in .data, not on the stack — declare them inside a function for this lab.");
      for (const d of g.decls) {
        if (d.dims.length || d.ptr) throw new GenError(g.line, `'${d.name}': only plain integer globals are modelled — no arrays or pointers.`);
        if (FLOAT.test(d.type)) throw new GenError(g.line, `'${d.name}': floating point is not modelled — use an integer type.`);
        if (ctx.globals.has(d.name)) throw new GenError(g.line, `'${d.name}' is defined twice.`);
        const probe = new FnGen({ name: "", type: "void", params: [], body: [], line: g.line }, program.functions, program.defines, { n: 0 }, ctx);
        const init = d.init ? probe.constant(d.init) : 0;
        if (init === undefined) throw new GenError(g.line, `'${d.name}': a global's initial value must be a constant (it is copied from flash before main runs).`);
        const addr = (opts.dataBase + globals.length * 4) >>> 0;
        globals.push({ name: d.name, addr, init: init | 0, line: g.line });
        ctx.globals.set(d.name, addr);
        ctx.symbols.set(addr, d.name);
      }
    }
    const main = program.functions.get("main");
    if (!main) throw new GenError(1, "Add int main(void) { ... } — the reset handler calls main().");
    const seq = { n: 0 };
    const items: Array<Item & { fn?: string }> = [{ label: "Reset_Handler" }, { op: "BL", target: "main", line: main.line, note: "start the C program" }, { op: "BKPT", line: main.line, note: "main() returned" }];
    const order = [main, ...[...program.functions.values()].filter((f) => f.name !== "main" && !f.vector)];
    const fnOf: string[] = ["Reset_Handler", "Reset_Handler", "Reset_Handler"];
    for (const f of order) {
      const out = new FnGen(f, program.functions, program.defines, seq, ctx).generate();
      for (const it of out) { items.push(it); fnOf.push(f.name); }
    }
    const ins: Ins[] = [], labels = new Map<string, number>(), byAddr = new Map<number, number>();
    const fns: ThumbProgram["fns"] = [];
    let addr = opts.codeBase ?? 0;
    items.forEach((it, k) => {
      if ("label" in it) {
        labels.set(it.label, addr);
        if (!it.label.startsWith(".") && !it.label.endsWith("_exit")) { const prev = fns[fns.length - 1]; if (prev) prev.end = addr; fns.push({ name: it.label, addr, end: addr, line: 0 }); }
        return;
      }
      const size = it.op === "BL" ? 4 : 2;
      byAddr.set(addr, ins.length);
      ins.push({ ...it, addr, size, fn: fnOf[k]!, text: fmtIns(it) });
      addr += size;
    });
    const lastFn = fns[fns.length - 1];
    if (lastFn) lastFn.end = addr;
    for (const f of fns) f.line = program.functions.get(f.name)?.line ?? main.line;
    const strings = new Map<number, string>();
    addr = (addr + 3) & ~3;
    for (const s of ctx.strings) { labels.set(s.label, addr); strings.set(addr, s.text); addr = (addr + s.text.length + 1 + 3) & ~3; }
    for (const i of ins) {
      if (i.op === "LIB") continue;
      if (i.target && !labels.has(i.target)) throw new GenError(i.line, `Unknown branch target ${i.target}`);
      if (i.op === "LDRI" && i.target) i.imm = labels.get(i.target)!;
    }
    return { ins, labels, byAddr, fns, diagnostics: [], globals, strings, symbols: ctx.symbols };
  } catch (err) {
    if (err instanceof GenError) return { ...empty, diagnostics: [{ line: err.line, message: err.message }] };
    throw err;
  }
}

/* ---------------- CPU ---------------- */

export interface CpuLog { t: number; kind: "exec" | "push" | "pop" | "call" | "ret" | "fault" | "halt" | "store"; text: string; pc: number }
export interface CallFrame { fn: string; site: number; ret: number; sp: number }
export interface CpuFaults { corruptLr?: boolean; skipPop?: boolean }
export interface LastBranch { kind: "call" | "ret"; from: number; to: number; ret: number; fn: string }

/** Connects LDR/STR outside plain RAM and library calls to a peripheral model. */
export interface ThumbHost {
  /** Value of a memory-mapped register, or undefined for plain memory. */
  load?(addr: number, t: number): number | undefined;
  /** Side-effect-free read used for logging old values; undefined for plain memory. */
  peek?(addr: number): number | undefined;
  /** True when the store went to a peripheral rather than RAM. */
  store?(addr: number, value: number, t: number): boolean;
  /** Runs a library function; `cycles` is how long it keeps the CPU busy. */
  call?(name: string, args: number[], cpu: ThumbCpu, t: number): { ret?: number; cycles: number; text?: string };
}

export interface StoreLog { t: number; pc: number; addr: number; name: string; from: number; to: number; mmio: boolean }

export class ThumbCpu {
  r: number[] = new Array<number>(16).fill(0);
  n = false; z = false; c = false; v = false;
  mem = new Map<number, number>();
  tags = new Map<number, string>();
  calls: CallFrame[] = [];
  cycles = 0;
  executed = 0;
  halted = "";
  fault = "";
  log: CpuLog[] = [];
  last: LastBranch | null = null;
  lastCall: LastBranch | null = null;
  lastRet: LastBranch | null = null;
  maxDepth = 0;
  minSp: number;
  lastIndex = -1;
  changed = new Set<number>();
  stackWrites = new Set<number>();

  stores: StoreLog[] = [];
  /** Total stores since reset; `stores` only keeps the most recent 240. */
  storeCount = 0;
  /** Log every executed instruction. Turn off when running millions of instructions per second. */
  verbose = true;

  constructor(readonly prog: ThumbProgram, readonly stackTop = 0x20000400, public stackLimit = 0x20000300, public host: ThumbHost = {}) {
    this.minSp = stackTop;
    this.reset();
  }

  reset() {
    this.r.fill(0);
    this.r[SP] = this.stackTop;
    this.r[LR] = 0xffffffff;
    this.r[PC] = this.prog.labels.get("Reset_Handler") ?? 0;
    this.n = this.z = this.c = this.v = false;
    this.mem.clear(); this.tags.clear(); this.calls = [];
    this.cycles = 0; this.executed = 0; this.halted = ""; this.fault = ""; this.log = []; this.last = this.lastCall = this.lastRet = null; this.maxDepth = 0; this.minSp = this.stackTop; this.lastIndex = -1;
    this.stores = [];
    this.storeCount = 0;
    for (const g of this.prog.globals) { this.mem.set(g.addr, g.init >>> 0); this.tags.set(g.addr, `global ${g.name}`); }
  }

  private load(addr: number, t: number): number {
    const v = this.host.load?.(addr, t);
    return v === undefined ? this.read(addr) : v >>> 0;
  }

  private store(addr: number, value: number, t: number, pc: number) {
    const name = this.prog.symbols.get(addr) ?? hx(addr, 8);
    const from = this.host.peek?.(addr) ?? this.read(addr);
    const mmio = !!this.host.store?.(addr, value, t);
    if (!mmio) { this.mem.set(addr, value); if (!this.tags.has(addr)) this.tags.set(addr, `data ${name}`); }
    this.stores.push({ t, pc, addr, name, from: from >>> 0, to: value >>> 0, mmio });
    this.storeCount++;
    if (this.stores.length > 240) this.stores.splice(0, this.stores.length - 240);
    this.push({ kind: "store", text: `STR ${name} ← ${hx(value, 8)}${from >>> 0 !== value >>> 0 ? ` (was ${hx(from, 8)})` : ""}`, pc }, t);
  }

  get current(): Ins | undefined { const k = this.prog.byAddr.get(this.r[PC]!); return k === undefined ? undefined : this.prog.ins[k]; }
  get stopped() { return !!(this.halted || this.fault); }
  fnAt(addr: number): string { return this.prog.fns.find((f) => addr >= f.addr && addr < f.end)?.name ?? "?"; }
  read(addr: number): number { return this.mem.get(addr) ?? 0; }

  private push(entry: Omit<CpuLog, "t">, t: number) { this.log.push({ ...entry, t }); if (this.log.length > 240) this.log.splice(0, this.log.length - 240); }
  private setFlags(res: number) { this.n = (res | 0) < 0; this.z = (res >>> 0) === 0; }
  private hardFault(msg: string, t: number) { this.fault = msg; this.push({ kind: "fault", text: msg, pc: this.r[PC]! }, t); }
  private cond(c: string): boolean {
    switch (c) {
      case "EQ": return this.z; case "NE": return !this.z;
      case "LT": return this.n !== this.v; case "GE": return this.n === this.v;
      case "GT": return !this.z && this.n === this.v; case "LE": return this.z || this.n !== this.v;
      default: return true;
    }
  }
  private moveSp(next: number, t: number): boolean {
    if (next < this.stackLimit) { this.hardFault(`HardFault: stack overflow — SP would drop to ${hx(next, 8)} below the stack limit ${hx(this.stackLimit, 8)}`, t); return false; }
    this.r[SP] = next >>> 0;
    this.minSp = Math.min(this.minSp, next);
    return true;
  }

  step(t = 0, faults: CpuFaults = {}): void {
    if (this.stopped) return;
    this.changed.clear(); this.stackWrites.clear();
    const pc = this.r[PC]!;
    const k = this.prog.byAddr.get(pc);
    if (k === undefined) { this.hardFault(`HardFault: PC = ${hx(pc)} is not an instruction (corrupted return address?)`, t); return; }
    const ins = this.prog.ins[k]!;
    this.lastIndex = k;
    let next = pc + ins.size;
    let cost = 1;
    const R = this.r;
    const set = (rd: number, v: number) => { R[rd] = v | 0; this.changed.add(rd); };
    const b = ins.imm !== undefined ? ins.imm : R[ins.rm ?? 0]!;
    if (this.verbose) this.push({ kind: "exec", text: ins.text.replace(/\s+/, " "), pc }, t);
    switch (ins.op) {
      case "MOV": set(ins.rd!, b); this.setFlags(b); break;
      case "LDRI": set(ins.rd!, ins.imm!); cost = 2; break;
      case "NEG": set(ins.rd!, -R[ins.rm!]!); this.setFlags(R[ins.rd!]!); break;
      case "MVN": set(ins.rd!, ~R[ins.rm!]!); this.setFlags(R[ins.rd!]!); break;
      case "ADD": case "SUB": {
        const a = R[ins.rn!]! | 0, bb = b | 0;
        const res = ins.op === "ADD" ? a + bb : a - bb;
        set(ins.rd!, res);
        this.setFlags(res);
        this.c = ins.op === "ADD" ? (a >>> 0) + (bb >>> 0) > 0xffffffff : (a >>> 0) >= (bb >>> 0);
        this.v = res !== (res | 0);
        break;
      }
      case "MUL": set(ins.rd!, Math.imul(R[ins.rn!]!, b)); this.setFlags(R[ins.rd!]!); break;
      case "SDIV": { const d = b | 0; set(ins.rd!, d === 0 ? 0 : Math.trunc((R[ins.rn!]! | 0) / d)); cost = 6; break; }
      case "AND": set(ins.rd!, R[ins.rn!]! & b); this.setFlags(R[ins.rd!]!); break;
      case "ORR": set(ins.rd!, R[ins.rn!]! | b); this.setFlags(R[ins.rd!]!); break;
      case "EOR": set(ins.rd!, R[ins.rn!]! ^ b); this.setFlags(R[ins.rd!]!); break;
      case "LSL": set(ins.rd!, R[ins.rn!]! << (b & 31)); this.setFlags(R[ins.rd!]!); break;
      case "ASR": set(ins.rd!, R[ins.rn!]! >> (b & 31)); this.setFlags(R[ins.rd!]!); break;
      case "CMP": {
        const a = R[ins.rn!]! | 0, bb = b | 0, res = a - bb;
        this.setFlags(res);
        this.c = (a >>> 0) >= (bb >>> 0);
        this.v = res !== (res | 0);
        break;
      }
      case "B":
        if (!ins.cond || this.cond(ins.cond)) { next = this.prog.labels.get(ins.target!)!; cost = 3; }
        break;
      case "BL": {
        R[LR] = next; this.changed.add(LR);
        const to = this.prog.labels.get(ins.target!)!;
        this.calls.push({ fn: ins.target!, site: pc, ret: next, sp: R[SP]! });
        this.maxDepth = Math.max(this.maxDepth, this.calls.length);
        this.last = this.lastCall = { kind: "call", from: pc, to, ret: next, fn: ins.target! };
        this.push({ kind: "call", text: `CALL ${ins.target}() — LR = ${hx(next)}, jump to ${hx(to)}`, pc }, t);
        next = to; cost = 4;
        break;
      }
      case "BX": {
        const to = (R[ins.rm!]! >>> 0) & ~1;
        cost = 3;
        if (to === 0xfffffffe) { this.hardFault("HardFault: returned with LR = 0xFFFFFFFF (EXC_RETURN reset value) — nothing to return to", t); return; }
        this.doReturn(pc, to, t);
        next = to;
        break;
      }
      case "PUSH": {
        const regs = [...ins.regs!].sort((a, c) => a - c);
        const base = R[SP]! - 4 * regs.length;
        if (!this.moveSp(base, t)) return;
        regs.forEach((reg, i) => {
          let val = R[reg]! >>> 0;
          if (reg === LR && faults.corruptLr) val = (val ^ 0x10) >>> 0;
          const at = base + 4 * i;
          this.mem.set(at, val);
          this.stackWrites.add(at);
          this.tags.set(at, reg === LR ? `return → ${this.fnAt(val)}` : `saved ${regName(reg)}`);
        });
        this.push({ kind: "push", text: `PUSH {${regList(regs)}} → SP = ${hx(base)}${regs.includes(LR) ? ` (return address ${hx(this.read(base + 4 * regs.indexOf(LR)))} saved)` : ""}`, pc }, t);
        cost = 1 + regs.length;
        break;
      }
      case "POP": {
        const regs = [...ins.regs!].sort((a, c) => a - c);
        if (faults.skipPop && regs.includes(LR)) { this.push({ kind: "fault", text: `POP {${regList(regs)}} skipped (fault injected) — SP stays ${hx(R[SP]!)}`, pc }, t); break; }
        const base = R[SP]!;
        let to = -1;
        regs.forEach((reg, i) => { const val = this.read(base + 4 * i); if (reg === PC) to = val & ~1; else set(reg, val); });
        R[SP] = (base + 4 * regs.length) >>> 0;
        this.push({ kind: "pop", text: `POP {${regList(regs)}} ← ${regs.map((reg, i) => `${regName(reg)} = ${hx(this.read(base + 4 * i))}`).join(", ")} · SP = ${hx(R[SP]!)}`, pc }, t);
        cost = 1 + regs.length;
        if (to >= 0) { this.doReturn(pc, to, t); next = to; cost += 3; }
        break;
      }
      case "LDR": set(ins.rd!, this.load((R[ins.rn!]! + (ins.imm ?? 0)) >>> 0, t)); cost = 2; break;
      case "STR": this.store((R[ins.rn!]! + (ins.imm ?? 0)) >>> 0, R[ins.rd!]! >>> 0, t, pc); cost = 2; break;
      case "LIB": {
        const res = this.host.call?.(ins.target!, [R[0]!, R[1]!, R[2]!, R[3]!].slice(0, ins.imm ?? 4), this, t) ?? { cycles: 1 };
        if (res.ret !== undefined) set(0, res.ret);
        cost = Math.max(1, Math.round(res.cycles));
        this.push({ kind: "call", text: `BL ${ins.target}() — library${res.text ? `: ${res.text}` : ""}`, pc }, t);
        break;
      }
      case "LDRSP": set(ins.rd!, this.read((R[SP]! + ins.imm!) >>> 0)); cost = 2; break;
      case "STRSP": {
        const at = (R[SP]! + ins.imm!) >>> 0;
        this.mem.set(at, R[ins.rd!]! >>> 0);
        this.stackWrites.add(at);
        this.tags.set(at, `${ins.fn}: ${ins.slot ?? "local"}`);
        cost = 2;
        break;
      }
      case "SUBSP": if (!this.moveSp(R[SP]! - ins.imm!, t)) return; break;
      case "ADDSP": R[SP] = (R[SP]! + ins.imm!) >>> 0; break;
      case "BKPT": this.halted = ins.note ?? "BKPT"; this.push({ kind: "halt", text: `BKPT — ${this.halted}`, pc }, t); return;
      case "NOP": break;
      default: this.hardFault(`UsageFault: undefined instruction ${ins.op}`, t); return;
    }
    if (ins.op !== "LDRSP" && ins.op !== "STRSP" && ins.op !== "STR" && ins.rd !== undefined) this.changed.add(ins.rd);
    this.changed.add(PC);
    R[PC] = next >>> 0;
    this.cycles += cost;
    this.executed++;
  }

  private doReturn(pc: number, to: number, t: number) {
    const top = this.calls[this.calls.length - 1];
    const fn = top?.fn ?? this.fnAt(pc);
    if (top && top.ret === to) this.calls.pop();
    else {
      const k = this.calls.findIndex((c) => c.ret === to);
      if (k >= 0) this.calls.length = k;
    }
    this.last = this.lastRet = { kind: "ret", from: pc, to, ret: to, fn };
    this.push({ kind: "ret", text: `RET from ${fn}() → ${hx(to)}${top && top.ret !== to ? " (unexpected address!)" : ` back in ${this.fnAt(to)}()`}`, pc }, t);
  }
}

export const hx = (v: number, d = 4) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(d, "0")}`;
