import { compileC, sizeOf, toNum, type ArrVal, type Expr, type Firmware, type Stmt } from "../core/cinterp";

/** STM32F103RB (NUCLEO-F103RB) memory map. */
export const MAP = {
  flash: { base: 0x08000000, size: 126 * 1024 },
  eeprom: { base: 0x0801f800, size: 2 * 1024 },
  boot: { base: 0x1ffff000, size: 2 * 1024 },
  sram: { base: 0x20000000, size: 20 * 1024 },
} as const;
export type Region = keyof typeof MAP;
export const STACK_SIZE = 0x400, HEAP_SIZE = 0x200;

export function regionOf(addr: number): Region | null {
  for (const k of ["eeprom", "flash", "boot", "sram"] as Region[]) { const r = MAP[k]; if (addr >= r.base && addr < r.base + r.size) return k; }
  return null;
}

export interface GlobalVar {
  name: string; type: string; addr: number; size: number; align: number;
  kind: "scalar" | "array" | "struct"; elem: number; count: number; signed: boolean;
  fields?: Array<{ name: string; off: number; size: number; signed: boolean }>;
  section: ".data" | ".bss" | ".rodata"; init: number[];
}
export interface Section { name: string; addr: number; size: number; region: Region; note: string }
export interface Layout {
  globals: GlobalVar[];
  sections: Section[];
  image: number[];
  flashUsed: number;
  sramStatic: number;
  sramUsed: number;
  codeBytes: number;
  modules: Array<[string, number]>;
}

const isSigned = (t: string) => !/unsigned|uint|bool|_Bool|byte|size_t/.test(t) && /int|char|short|long/.test(t);
const align = (v: number, a: number) => Math.ceil(v / a) * a;

function structTable(src: string) {
  const out = new Map<string, { size: number; align: number; fields: NonNullable<GlobalVar["fields"]> }>();
  const re = /typedef\s+struct\s*\w*\s*\{([^}]*)\}\s*(\w+)\s*;/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let off = 0, maxA = 1;
    const fields: NonNullable<GlobalVar["fields"]> = [];
    for (const line of m[1]!.split(";")) {
      const f = line.replace(/\/\/.*$/gm, "").trim().match(/^([\w\s]+?)\s+(\w+)\s*(?:\[\s*(\d+)\s*\])?$/);
      if (!f) continue;
      const sz = sizeOf(f[1]!), n = Number(f[3] ?? 1), a = Math.min(4, sz);
      off = align(off, a);
      fields.push({ name: f[2]!, off, size: sz * n, signed: isSigned(f[1]!) });
      off += sz * n; maxA = Math.max(maxA, a);
    }
    out.set(m[2]!, { size: align(off, maxA), align: maxA, fields });
  }
  return out;
}

const constNum = (e: Expr | null | undefined, defs: Record<string, number | string>): number => {
  if (!e) return 1;
  if (e.k === "num") return e.v;
  if (e.k === "id" && typeof defs[e.name] === "number") return defs[e.name] as number;
  if (e.k === "bin") { const a = constNum(e.a, defs), b = constNum(e.b, defs); return e.op === "*" ? a * b : e.op === "+" ? a + b : e.op === "-" ? a - b : a; }
  return 1;
};
const initValues = (e: Expr | undefined, defs: Record<string, number | string>): number[] => {
  if (!e) return [];
  if (e.k === "init") return e.items.map((x) => constNum(x, defs));
  if (e.k === "str") return [...e.v].map((c) => c.charCodeAt(0)).concat(0);
  if (e.k === "un" && e.op === "-") return [-constNum(e.e, defs)];
  return [constNum(e, defs)];
};
const bytesOf = (v: number, size: number) => Array.from({ length: size }, (_, k) => Math.floor((v >>> 0) / 2 ** (8 * k)) & 0xff);
function initBytes(g: GlobalVar): number[] {
  const out = new Array<number>(g.size).fill(0);
  const put = (off: number, v: number, size: number) => bytesOf(v, size).forEach((b, k) => { if (off + k < out.length) out[off + k] = b; });
  if (g.kind === "struct") (g.fields ?? []).forEach((f, i) => put(f.off, g.init[i] ?? 0, f.size));
  else for (let i = 0; i < g.count; i++) put(i * g.elem, g.init[i] ?? 0, g.elem);
  return out;
}

function countStatements(body: Stmt[]): number {
  let n = 0;
  const walk = (s: Stmt | undefined) => {
    if (!s) return;
    n++;
    if (s.k === "block") s.body.forEach(walk);
    if (s.k === "if") { walk(s.a); walk(s.b); }
    if (s.k === "while" || s.k === "do" || s.k === "for") walk(s.body);
    if (s.k === "switch") s.cases.forEach((c) => c.body.forEach(walk));
  };
  body.forEach(walk);
  return n;
}

const MODULES: Array<[RegExp, string, number]> = [
  [/HAL_Init|HAL_Delay|HAL_GetTick/, "HAL core + RCC + SysTick", 1820],
  [/HAL_GPIO_/, "HAL GPIO", 980],
  [/HAL_FLASH|HAL_FLASHEx/, "HAL FLASH / FLASHEx", 1340],
  [/HAL_UART_/, "HAL UART", 2240],
  [/HAL_ADC_/, "HAL ADC", 2120],
  [/\b(s?n?printf)\s*\(/, "newlib-nano printf", 4310],
  [/\b(memcpy|memset|strlen|strcpy)\s*\(/, "string.h", 260],
];

/** Static memory layout the linker would produce for this source (sizes are estimates — there is no real linker). */
export function buildLayout(src: string): Layout {
  const { program } = compileC(src);
  const structs = structTable(src);
  const globals: GlobalVar[] = [];
  const defs = program?.defines ?? {};
  for (const g of program?.globals ?? []) {
    if (g.k !== "decl") continue;
    for (const d of g.decls) {
      const st = structs.get(d.type.replace(/\b(const|volatile|static)\b/g, "").trim());
      const count = d.dims.length ? d.dims.reduce((a, e) => a * constNum(e, defs), 1) : 1;
      const elem = d.ptr ? 4 : st ? st.size : sizeOf(d.type);
      const init = initValues(d.init, defs);
      const isConst = !d.ptr && new RegExp(`^(?:static\\s+|volatile\\s+)*const\\b[^;{(=]*\\b${d.name}\\b`, "m").test(src);
      const nonZero = init.some((v) => v !== 0);
      globals.push({
        name: d.name, type: d.type.replace(/\s+/g, " ").trim() + (d.ptr ? " *" : ""), addr: 0, size: elem * count, align: d.ptr ? 4 : st ? st.align : Math.min(4, elem),
        kind: st && !d.dims.length ? "struct" : d.dims.length ? "array" : "scalar", elem, count, signed: isSigned(d.type), fields: st?.fields,
        section: isConst ? ".rodata" : nonZero ? ".data" : ".bss", init,
      });
    }
  }
  const strings = [...src.replace(/^\s*#\s*include.*$/gm, "").matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]!.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\(.)/g, "$1"));
  const fnCount = program?.functions.size ?? 0;
  const stmts = [...(program?.functions.values() ?? [])].reduce((a, f) => a + countStatements(f.body), 0);
  const modules: Array<[string, number]> = [["Vector table", 236], ["Startup (Reset_Handler, SystemInit)", 420]];
  for (const [re, name, bytes] of MODULES) if (re.test(src)) modules.push([name, bytes]);
  const userCode = align(fnCount * 18 + stmts * 7, 4);
  modules.push(["Your code (.text)", userCode]);
  const codeBytes = modules.slice(1).reduce((a, [, b]) => a + b, 0);

  const image: number[] = [];
  const vectors = Array.from({ length: 59 }, (_, i) => (i === 0 ? MAP.sram.base + MAP.sram.size : i === 1 ? MAP.flash.base + 236 + 1 : MAP.flash.base + 236 + 0x180 + 1));
  vectors.forEach((v) => image.push(...bytesOf(v, 4)));
  let seed = 0x2545f491;
  for (const ch of src) seed = Math.imul(seed ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  const thumb = [0xb580, 0xaf00, 0x4b03, 0x681b, 0x3301, 0x601a, 0xbd80, 0xf000, 0x2000, 0x4770, 0x6018, 0x2101, 0x4a02, 0x6813];
  for (let i = 0; i < codeBytes; i += 2) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; const op = thumb[seed % thumb.length]! ^ ((seed >>> 20) & 0x7); image.push(op & 0xff, op >> 8); }
  const sections: Section[] = [
    { name: ".isr_vector", addr: MAP.flash.base, size: 236, region: "flash", note: "Initial SP + exception vectors" },
    { name: ".text", addr: MAP.flash.base + 236, size: codeBytes, region: "flash", note: "Machine code" },
  ];
  let at = MAP.flash.base + image.length;
  const rodataStart = at;
  for (const g of globals.filter((x) => x.section === ".rodata")) {
    while ((at - MAP.flash.base) % g.align) { image.push(0); at++; }
    g.addr = at;
    image.push(...initBytes(g));
    at = MAP.flash.base + image.length;
  }
  for (const s of strings) { for (const c of s) image.push(c.charCodeAt(0) & 0xff); image.push(0); }
  while (image.length % 4) image.push(0);
  at = MAP.flash.base + image.length;
  sections.push({ name: ".rodata", addr: rodataStart, size: at - rodataStart, region: "flash", note: `const data + ${strings.length} string literal${strings.length === 1 ? "" : "s"}` });

  let ram: number = MAP.sram.base;
  const place = (sec: ".data" | ".bss") => {
    const start = ram;
    for (const g of globals.filter((x) => x.section === sec)) { ram = align(ram, g.align); g.addr = ram; ram += g.size; }
    ram = align(ram, 4);
    return { start, size: ram - start };
  };
  const data = place(".data");
  const dataInit = at;
  const dataImage = new Array<number>(data.size).fill(0);
  for (const g of globals.filter((x) => x.section === ".data")) initBytes(g).forEach((b, k) => { dataImage[g.addr - data.start + k] = b; });
  image.push(...dataImage);
  while (image.length % 4) image.push(0);
  if (data.size) sections.push({ name: ".data (load image)", addr: dataInit, size: image.length - (dataInit - MAP.flash.base), region: "flash", note: "Initial values copied to SRAM at boot" });
  const bss = place(".bss");
  sections.push({ name: ".data", addr: data.start, size: data.size, region: "sram", note: "Initialized globals" });
  sections.push({ name: ".bss", addr: bss.start, size: bss.size, region: "sram", note: "Zero-initialized globals" });
  sections.push({ name: "heap", addr: ram, size: HEAP_SIZE, region: "sram", note: "malloc() area (_Min_Heap_Size)" });
  sections.push({ name: "stack", addr: MAP.sram.base + MAP.sram.size - STACK_SIZE, size: STACK_SIZE, region: "sram", note: "Grows down from 0x2000 5000" });
  const sramStatic = data.size + bss.size;
  return { globals, sections, image, flashUsed: image.length, sramStatic, sramUsed: sramStatic + HEAP_SIZE + STACK_SIZE, codeBytes, modules };
}

/* ----- live global values (bytes) ----- */
function fromBytes(bytes: number[], signed: boolean) {
  let v = 0;
  bytes.forEach((b, k) => { v += (b & 0xff) * 2 ** (8 * k); });
  if (signed && bytes.length < 8 && v >= 2 ** (8 * bytes.length - 1)) v -= 2 ** (8 * bytes.length);
  return v;
}
export function globalBytes(fw: Firmware | undefined, g: GlobalVar): number[] {
  const out = new Array<number>(g.size).fill(0);
  const put = (off: number, v: number, size: number) => bytesOf(v, size).forEach((b, k) => { if (off + k < out.length) out[off + k] = b; });
  if (!fw) return initBytes(g);
  if (g.kind === "struct") { for (const f of g.fields ?? []) put(f.off, fw.field(`${g.name}.${f.name}`) ?? 0, f.size); return out; }
  const v = fw.globalValue(g.name);
  if (g.kind === "array" && v && typeof v === "object" && v.kind === "arr") { const data = (v as ArrVal).slot.data ?? []; for (let i = 0; i < g.count; i++) put(i * g.elem, toNum(data[i] ?? 0), g.elem); return out; }
  put(0, typeof v === "number" ? v : 0, g.size);
  return out;
}
export function setGlobalBytes(fw: Firmware | undefined, g: GlobalVar, bytes: number[]) {
  if (!fw) return;
  if (g.kind === "struct") { for (const f of g.fields ?? []) fw.setField(`${g.name}.${f.name}`, fromBytes(bytes.slice(f.off, f.off + f.size), f.signed)); return; }
  const v = fw.globalValue(g.name);
  if (g.kind === "array" && v && typeof v === "object" && v.kind === "arr") { const data = (v as ArrVal).slot.data; if (data) for (let i = 0; i < g.count; i++) data[i] = fromBytes(bytes.slice(i * g.elem, (i + 1) * g.elem), g.signed); return; }
  fw.setField(g.name, fromBytes(bytes, g.signed));
}
export function displayValue(fw: Firmware | undefined, g: GlobalVar): string {
  const b = globalBytes(fw, g);
  if (g.kind === "struct") return `{ ${(g.fields ?? []).map((f) => `${f.name}=${fromBytes(b.slice(f.off, f.off + f.size), f.signed)}`).join(", ")} }`;
  if (g.kind === "array" && g.elem === 1 && /char/.test(g.type)) { const end = b.indexOf(0); return `"${String.fromCharCode(...b.slice(0, end < 0 ? b.length : end)).slice(0, 40)}"`; }
  if (g.kind === "array") return `{${Array.from({ length: Math.min(g.count, 6) }, (_, i) => fromBytes(b.slice(i * g.elem, (i + 1) * g.elem), g.signed)).join(", ")}${g.count > 6 ? ", …" : ""}}`;
  return String(fromBytes(b, g.signed));
}
