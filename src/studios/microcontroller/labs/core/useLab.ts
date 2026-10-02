import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Diagnostic } from "./cinterp";
import { Mcu, type McuOptions } from "./mcu";

export type LabParams = Record<string, number | string | boolean>;

export interface LabConfig<P extends LabParams> {
  slug: string;
  code: string;
  params: P;
  /** MCU options; may depend on lab parameters (e.g. selected clock) or on the source being built (e.g. family). */
  mcu?: McuOptions | ((params: P, source: string) => McuOptions);
  /** Called once after a successful build (attach I2C devices, set analog inputs, …). */
  setup?: (mcu: Mcu, params: P, source: string) => void;
  /** Extra lab-specific build checks; any diagnostics fail the build like compiler errors. */
  validate?: (source: string) => Diagnostic[];
  /** External world physics, advanced on the same fixed 1 ms step as the MCU. */
  world?: (mcu: Mcu, dt: number, params: P) => void;
  /** Parameter keys whose change requires a rebuild of the MCU (e.g. clock source). */
  rebuildOn?: Array<keyof P>;
  autoRun?: boolean;
}

export type SimStatus = "running" | "paused" | "halted" | "error" | "stopped";

interface Saved<P> { code?: string; params?: Partial<P> }

const STEP = 0.001;
const FRAME_BUDGET_MS = 9;
const storageKey = (slug: string) => `mcu.lab.${slug}`;

function readSaved<P>(slug: string): Saved<P> {
  try { return (JSON.parse(localStorage.getItem(storageKey(slug)) ?? "null") as Saved<P> | null) ?? {}; } catch { return {}; }
}

export interface Lab<P extends LabParams> {
  mcu: Mcu;
  code: string;
  setCode: (code: string) => void;
  compiledCode: string;
  diagnostics: Diagnostic[];
  status: SimStatus;
  running: boolean;
  params: P;
  setParam: <K extends keyof P>(key: K, value: P[K]) => void;
  run: () => boolean;
  toggle: () => void;
  resetSim: () => void;
  resetLab: () => void;
  save: () => void;
  step: (kind: "into" | "over" | "out") => void;
  advance: (seconds: number) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  realtime: number;
  notice: string;
  setNotice: (text: string) => void;
  frame: number;
  dirty: boolean;
  breakpoints: Set<number>;
  toggleBreakpoint: (line: number) => void;
}

export function useLab<P extends LabParams>(cfg: LabConfig<P>): Lab<P> {
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const initial = useMemo(() => readSaved<P>(cfg.slug), [cfg.slug]);
  const [code, setCode] = useState(initial.code ?? cfg.code);
  const [compiledCode, setCompiled] = useState(initial.code ?? cfg.code);
  const paramsRef = useRef<P>({ ...cfg.params, ...(initial.params ?? {}) } as P);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [running, setRunning] = useState(cfg.autoRun !== false);
  const [speed, setSpeed] = useState(1);
  const [notice, setNotice] = useState("");
  const [frame, bump] = useReducer((x: number) => x + 1, 0);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(() => new Set());
  const realtimeRef = useRef(1);
  const mcuRef = useRef<Mcu | null>(null);

  const build = useCallback((source: string): { mcu: Mcu; diags: Diagnostic[] } => {
    const c = cfgRef.current;
    const opts = typeof c.mcu === "function" ? c.mcu(paramsRef.current, source) : c.mcu ?? {};
    const mcu = new Mcu(opts);
    c.setup?.(mcu, paramsRef.current, source);
    const diags = mcu.load(source);
    if (!diags.length && c.validate) diags.push(...c.validate(source));
    return { mcu, diags };
  }, []);

  if (!mcuRef.current) {
    let built = build(initial.code ?? cfg.code);
    if (built.diags.length && initial.code) built = build(cfg.code);
    mcuRef.current = built.mcu;
  }

  const applyBreakpoints = (mcu: Mcu, set: Set<number>) => mcu.fw?.setBreakpoints([...set]);

  const run = useCallback((): boolean => {
    const { mcu, diags } = build(code);
    if (diags.length) {
      setDiagnostics(diags);
      setNotice(`Build failed — ${diags.length} error${diags.length > 1 ? "s" : ""}. The previous program keeps running until you fix it.`);
      bump();
      return false;
    }
    applyBreakpoints(mcu, breakpoints);
    mcuRef.current = mcu;
    setCompiled(code);
    setDiagnostics([]);
    setRunning(true);
    setNotice("Build succeeded — firmware flashed and restarted.");
    bump();
    return true;
  }, [build, code, breakpoints]);

  const resetSim = useCallback(() => {
    const { mcu } = build(compiledCode);
    applyBreakpoints(mcu, breakpoints);
    mcuRef.current = mcu;
    setNotice("Simulation reset — your code is unchanged.");
    bump();
  }, [build, compiledCode, breakpoints]);

  const resetLab = useCallback(() => {
    localStorage.removeItem(storageKey(cfgRef.current.slug));
    paramsRef.current = { ...cfgRef.current.params };
    const src = cfgRef.current.code;
    setCode(src);
    setCompiled(src);
    setDiagnostics([]);
    setSpeed(1);
    setBreakpoints(new Set());
    mcuRef.current = build(src).mcu;
    setRunning(cfgRef.current.autoRun !== false);
    setNotice("Lab restored to its default code and settings.");
    bump();
  }, [build]);

  const save = useCallback(() => {
    localStorage.setItem(storageKey(cfgRef.current.slug), JSON.stringify({ code, params: paramsRef.current }));
    setNotice("Saved in this browser — code and lab settings will be restored next time.");
  }, [code]);

  const setParam = useCallback(<K extends keyof P>(key: K, value: P[K]) => {
    paramsRef.current = { ...paramsRef.current, [key]: value };
    if (cfgRef.current.rebuildOn?.includes(key)) {
      const { mcu, diags } = build(compiledCode);
      if (!diags.length) mcuRef.current = mcu;
    }
    bump();
  }, [build, compiledCode]);

  const toggle = useCallback(() => {
    const fw = mcuRef.current?.fw;
    if (fw?.paused) { fw.resume(); setRunning(true); }
    else setRunning((r) => !r);
    bump();
  }, []);

  const step = useCallback((kind: "into" | "over" | "out") => {
    const mcu = mcuRef.current;
    if (!mcu?.fw) return;
    setRunning(false);
    mcu.fw.step(kind);
    const target = mcu.fw.time;
    if (target > mcu.time) mcu.tick(target - mcu.time);
    bump();
  }, []);

  const advance = useCallback((seconds: number) => {
    const mcu = mcuRef.current;
    if (!mcu) return;
    const world = cfgRef.current.world;
    let left = seconds;
    while (left > 1e-9) { const h = Math.min(STEP, left); world?.(mcu, h, paramsRef.current); mcu.tick(h); left -= h; }
    bump();
  }, []);

  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line); else next.add(line);
      mcuRef.current?.fw?.setBreakpoints([...next]);
      return next;
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPaint = 0;
    let debt = 0;
    const loop = (now: number) => {
      const wall = Math.min(0.1, (now - last) / 1000);
      last = now;
      const mcu = mcuRef.current;
      if (mcu && running && !mcu.fw?.paused && !mcu.fw?.error) {
        debt += wall * speed;
        const start = performance.now();
        const world = cfgRef.current.world;
        let simulated = 0;
        while (debt >= STEP) {
          world?.(mcu, STEP, paramsRef.current);
          mcu.tick(STEP);
          debt -= STEP;
          simulated += STEP;
          if (mcu.fw?.paused || performance.now() - start > FRAME_BUDGET_MS) break;
        }
        if (debt > 0.05 * Math.max(1, speed)) debt = 0;
        const wanted = wall * speed;
        realtimeRef.current = wanted > 0 ? realtimeRef.current * 0.9 + 0.1 * Math.min(1, simulated / wanted) : realtimeRef.current;
      }
      if (now - lastPaint > 45) { lastPaint = now; bump(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(id);
  }, [notice]);

  const mcu = mcuRef.current!;
  const status: SimStatus = mcu.fw?.error ? "error" : mcu.fw?.paused ? "halted" : !mcu.fw ? "stopped" : running ? "running" : "paused";

  return {
    mcu, code, setCode, compiledCode, diagnostics: diagnostics.length ? diagnostics : mcu.fw?.error ? [mcu.fw.error] : [],
    status, running, params: paramsRef.current, setParam, run, toggle, resetSim, resetLab, save, step, advance,
    speed, setSpeed, realtime: realtimeRef.current, notice, setNotice, frame, dirty: code !== compiledCode, breakpoints, toggleBreakpoint,
  };
}
