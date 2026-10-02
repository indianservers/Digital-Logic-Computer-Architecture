export type FirmwareDiagnostic = { line: number; message: string };
export type FirmwareCommand = { name: string; args: string[]; line: number };
type Token = { text: string; line: number };
type Expr = { kind: "number"; value: number } | { kind: "string"; value: string } | { kind: "name"; name: string } | { kind: "unary"; op: string; value: Expr } | { kind: "binary"; op: string; left: Expr; right: Expr } | { kind: "call"; name: string; args: Expr[] };
export type Statement = { kind: "block"; body: Statement[] } | { kind: "if"; condition: Expr; yes: Statement; no?: Statement } | { kind: "set"; name: string; op: string; value: Expr } | { kind: "call"; name: string; args: Expr[]; line: number };
export type FirmwareProgram = { constants: Record<string, number>; commands: FirmwareCommand[]; setup: Statement[]; loop: Statement[] };

const outputs = new Set(["trafficCycle", "setLamp", "displayTemperature", "measureDistance", "controlIrrigation", "setMotorSpeed", "analogWrite", "servo_write", "sampleWeather", "automateHome", "publishMQTT", "digitalWrite", "relayWrite", "serialPrint", "Serial.print", "Serial.println", "Serial.begin", "pinMode"]);
const arity: Record<string, number> = { trafficCycle: 2, setLamp: 1, displayTemperature: 1, measureDistance: 1, controlIrrigation: 2, setMotorSpeed: 2, analogWrite: 2, servo_write: 2, sampleWeather: 1, automateHome: 2, publishMQTT: 2, digitalWrite: 2, relayWrite: 2, serialPrint: 1, "Serial.print": 1, "Serial.println": 1, "Serial.begin": 1, pinMode: 2 };
const inputs = new Set(["readTemperature", "readDistance", "readMoisture", "readHumidity", "readLight", "digitalRead", "analogRead", "millis", "micros", "min", "max", "abs", "constrain", "map"]);
const precedence: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5 };

class ParseError extends Error { constructor(readonly line: number, message: string) { super(message); } }

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||\+=|-=|\*=|\/=|[{}();.,+\-*/%<>=!]/gy;
  let offset = 0, line = 1;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match) throw new ParseError(line, `Unexpected character ${JSON.stringify(source[offset])}.`);
    const value = match[0];
    if (!/^\s|^\/\//.test(value) && !value.startsWith("/*")) tokens.push({ text: value, line });
    line += (value.match(/\n/g) ?? []).length;
    offset += value.length;
  }
  tokens.push({ text: "<end>", line });
  return tokens;
}

class Parser {
  private pos = 0;
  readonly commands: FirmwareCommand[] = [];
  constructor(private readonly tokens: Token[]) {}
  private current() { return this.tokens[this.pos]!; }
  private take() { return this.tokens[this.pos++]!; }
  private accept(text: string) { if (this.current().text === text) { this.pos++; return true; } return false; }
  private expect(text: string) { if (!this.accept(text)) throw new ParseError(this.current().line, `Expected ${text}, found ${this.current().text}.`); }
  private name() { const t = this.take(); if (!/^[A-Za-z_]\w*$/.test(t.text)) throw new ParseError(t.line, `Expected a name, found ${t.text}.`); return t; }
  parse() {
    let setup: Statement[] = [], loop: Statement[] | undefined;
    while (this.current().text !== "<end>") {
      this.expect("void"); const name = this.name();
      if (name.text !== "setup" && name.text !== "loop") throw new ParseError(name.line, "Only setup() and loop() functions are supported.");
      this.expect("("); this.expect(")");
      const block = this.statement(); if (block.kind !== "block") throw new ParseError(name.line, "Function body must use braces.");
      if (name.text === "setup") setup = block.body;
      else { if (loop) throw new ParseError(name.line, "Only one loop() is allowed."); loop = block.body; }
    }
    if (!loop) throw new ParseError(this.current().line, "Add a complete void loop() { ... } block.");
    return { setup, loop };
  }
  private statement(): Statement {
    if (this.accept("{")) { const body: Statement[] = []; while (this.current().text !== "}" && this.current().text !== "<end>") body.push(this.statement()); this.expect("}"); return { kind: "block", body }; }
    if (this.accept("if")) { this.expect("("); const condition = this.expression(); this.expect(")"); const yes = this.statement(); const no = this.accept("else") ? this.statement() : undefined; return { kind: "if", condition, yes, no }; }
    const declaration = ["int", "float", "double", "long", "bool", "boolean", "uint8_t", "uint16_t"].includes(this.current().text);
    if (declaration) this.take();
    const token = this.name();
    if (this.accept(".")) token.text += `.${this.name().text}`;
    if (this.accept("(")) {
      if (!outputs.has(token.text)) throw new ParseError(token.line, `Unsupported output API: ${token.text}.`);
      const args = this.arguments(); this.expect(";");
      if (args.length !== arity[token.text]) throw new ParseError(token.line, `${token.text} expects ${arity[token.text]} argument${arity[token.text] === 1 ? "" : "s"}.`);
      return { kind: "call", name: token.text, args, line: token.line };
    }
    const op = this.take();
    if (!["=", "+=", "-=", "*=", "/="].includes(op.text)) throw new ParseError(op.line, `Expected assignment after ${token.text}.`);
    const value = this.expression(); this.expect(";");
    return { kind: "set", name: token.text, op: op.text, value };
  }
  private arguments() { const args: Expr[] = []; if (!this.accept(")")) { do { args.push(this.expression()); } while (this.accept(",")); this.expect(")"); } return args; }
  private expression(minimum = 0): Expr {
    let left: Expr;
    const first = this.take();
    if (first.text === "(" ) { left = this.expression(); this.expect(")"); }
    else if (first.text === "!" || first.text === "-") left = { kind: "unary", op: first.text, value: this.expression(6) };
    else if (/^\d/.test(first.text)) left = { kind: "number", value: Number(first.text) };
    else if (first.text.startsWith('"')) { try { left = { kind: "string", value: JSON.parse(first.text) as string }; } catch { throw new ParseError(first.line, "Invalid text literal."); } }
    else if (/^[A-Za-z_]\w*$/.test(first.text)) {
      if (this.accept("(")) { if (!inputs.has(first.text)) throw new ParseError(first.line, `Unsupported input API: ${first.text}.`); left = { kind: "call", name: first.text, args: this.arguments() }; }
      else left = { kind: "name", name: first.text };
    } else throw new ParseError(first.line, `Expected expression, found ${first.text}.`);
    while (true) { const op = this.current().text, rank = precedence[op]; if (!rank || rank < minimum) break; this.take(); left = { kind: "binary", op, left, right: this.expression(rank + 1) }; }
    return left;
  }
}

export function compileFirmware(source: string): { program?: FirmwareProgram; diagnostics: FirmwareDiagnostic[] } {
  const constants: Record<string, number> = {};
  const cleaned = source.split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^#define\s+([A-Z][A-Z0-9_]*)\s+(-?\d+(?:\.\d+)?)\s*(?:\/\/.*)?$/);
    if (match) { constants[match[1]!] = Number(match[2]); return ""; }
    return line;
  }).join("\n");
  try {
    const parser = new Parser(tokenize(cleaned));
    const { setup, loop } = parser.parse();
    const commands = source.split(/\r?\n/).flatMap((line, index) => { const call = line.trim().match(/^([A-Za-z_]\w*)\s*\((.*)\)\s*;$/); return call && outputs.has(call[1]!) ? [{ name: call[1]!, args: call[2]!.split(/,(?![^()]*\))/).map((arg) => arg.trim()), line: index + 1 }] : []; });
    return { program: { constants, commands, setup, loop }, diagnostics: [] };
  } catch (error) {
    if (error instanceof ParseError) return { diagnostics: [{ line: error.line, message: error.message }] };
    throw error;
  }
}

const value = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : v === true ? 1 : 0;
const finite = (n: number) => Number.isFinite(n) ? n : 0;
export function executeFirmware(program: FirmwareProgram, sensors: Record<string, number>, previousVars: Record<string, number>, time: number, includeSetup: boolean): { commands: FirmwareCommand[]; variables: Record<string, number>; error?: string } {
  const vars = { ...previousVars }, commands: FirmwareCommand[] = [];
  let operations = 0;
  const resolve = (expr: Expr): number => {
    if (++operations > 1000) throw new Error("Firmware instruction limit exceeded.");
    if (expr.kind === "number") return expr.value;
    if (expr.kind === "string") throw new Error("Text can only be used with serial output.");
    if (expr.kind === "name") {
      if (expr.name === "true") return 1; if (expr.name === "false") return 0;
      if (expr.name === "HIGH" || expr.name === "OUTPUT") return 1; if (expr.name === "LOW" || expr.name === "INPUT") return 0;
      if (Object.hasOwn(vars, expr.name)) return vars[expr.name] ?? 0;
      if (Object.hasOwn(sensors, expr.name)) return sensors[expr.name] ?? 0;
      if (Object.hasOwn(program.constants, expr.name)) return program.constants[expr.name] ?? 0;
      throw new Error(`Unknown symbol: ${expr.name}`);
    }
    if (expr.kind === "unary") return expr.op === "!" ? Number(!resolve(expr.value)) : -resolve(expr.value);
    if (expr.kind === "call") {
      const arg = (index: number) => expr.args[index] ? resolve(expr.args[index]!) : 0;
      switch (expr.name) {
        case "readTemperature": return sensors.temperature ?? 0; case "readDistance": return sensors.distance ?? 0;
        case "readMoisture": return sensors.moisture ?? 0; case "readHumidity": return sensors.humidity ?? 0; case "readLight": return sensors.light ?? 0;
        case "millis": return Math.round(time * 1000); case "micros": return Math.round(time * 1000000);
        case "digitalRead": case "analogRead": { const pin = expr.args[0]; if (pin?.kind !== "name") throw new Error(`${expr.name} requires a pin name.`); return sensors[pin.name] ?? 0; }
        case "min": return Math.min(arg(0), arg(1)); case "max": return Math.max(arg(0), arg(1)); case "abs": return Math.abs(arg(0));
        case "constrain": return Math.min(arg(2), Math.max(arg(1), arg(0)));
        case "map": return arg(3) + (arg(0) - arg(1)) * (arg(4) - arg(3)) / Math.max(1e-9, arg(2) - arg(1));
      }
    }
    if (expr.kind === "binary") {
      const a = resolve(expr.left);
      if (expr.op === "&&" && !a) return 0; if (expr.op === "||" && a) return 1;
      const b = resolve(expr.right);
      switch (expr.op) {
        case "+": return finite(a + b); case "-": return finite(a - b); case "*": return finite(a * b); case "/": return finite(a / b); case "%": return finite(a % b);
        case "<": return Number(a < b); case ">": return Number(a > b); case "<=": return Number(a <= b); case ">=": return Number(a >= b);
        case "==": return Number(a === b); case "!=": return Number(a !== b); case "&&": return Number(Boolean(a) && Boolean(b)); case "||": return Number(Boolean(a) || Boolean(b));
      }
    }
    return 0;
  };
  const run = (statements: Statement[]) => { for (const statement of statements) {
    if (++operations > 1000) throw new Error("Firmware instruction limit exceeded.");
    if (statement.kind === "block") run(statement.body);
    else if (statement.kind === "if") { if (resolve(statement.condition)) run([statement.yes]); else if (statement.no) run([statement.no]); }
    else if (statement.kind === "set") { const next = resolve(statement.value), old = vars[statement.name] ?? 0; vars[statement.name] = statement.op === "+=" ? old + next : statement.op === "-=" ? old - next : statement.op === "*=" ? old * next : statement.op === "/=" ? finite(old / next) : next; }
    else {
      const args = statement.args.map((expr, index) => expr.kind === "string" && ["serialPrint", "Serial.print", "Serial.println"].includes(statement.name) ? expr.value : index === 0 && ["analogWrite", "servo_write", "digitalWrite", "relayWrite", "pinMode"].includes(statement.name) && expr.kind === "name" ? expr.name : String(value(resolve(expr))));
      commands.push({ name: statement.name, args, line: statement.line });
    }
  } };
  try { if (includeSetup) run(program.setup); run(program.loop); return { commands, variables: vars }; }
  catch (error) { return { commands: [], variables: vars, error: error instanceof Error ? error.message : String(error) }; }
}
