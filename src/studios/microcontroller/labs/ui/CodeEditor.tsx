import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Lab, LabParams } from "../core/useLab";
import { Icon } from "./Icon";

const KEYWORDS = /^(void|int|char|float|double|long|short|unsigned|signed|const|volatile|static|struct|enum|typedef|union|if|else|while|for|do|return|break|continue|switch|case|default|sizeof|bool|true|false|NULL|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t|sbit|sfr|bit|interrupt|using|__interrupt|ISR|String|byte|boolean|TaskHandle_t|QueueHandle_t|SemaphoreHandle_t|TickType_t|BaseType_t)$/;
const TOKEN = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|^[ \t]*#[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b0x[0-9a-fA-F]+[uUlL]*\b|\b\d+(?:\.\d+)?[uUlLfF]*\b|\b[A-Za-z_]\w*\b)/gm;

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(TOKEN)) {
    const s = m[0];
    const i = m.index ?? 0;
    if (i > last) out.push(code.slice(last, i));
    const after = code.slice(i + s.length).match(/^\s*\(/);
    const tone = s.startsWith("/") ? "com" : /^\s*#/.test(s) ? "dir" : s.startsWith('"') || s.startsWith("'") ? "str" : /^\d|^0x/.test(s) ? "num" : KEYWORDS.test(s) ? "kw" : after ? "fn" : /^[A-Z][A-Z0-9_]+$/.test(s) ? "mac" : "id";
    out.push(tone === "id" ? s : <span key={k++} className={`mcl-tk-${tone}`}>{s}</span>);
    last = i + s.length;
  }
  if (last < code.length) out.push(code.slice(last));
  out.push("\n");
  return out;
}

export interface CodeEditorProps<P extends LabParams> {
  lab: Lab<P>;
  title?: string;
  languages?: Array<{ label: string; code: string }>;
  dark?: boolean;
  footer?: ReactNode;
  rows?: number;
  className?: string;
  /** Overrides the highlighted execution line (labs with their own CPU model). */
  currentLine?: number;
}

export function CodeEditor<P extends LabParams>({ lab, title = "Code Editor", languages, dark = false, footer, rows, className = "", currentLine }: CodeEditorProps<P>) {
  const [expanded, setExpanded] = useState(false);
  const [output, setOutput] = useState(false);
  const pre = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const colored = useMemo(() => highlight(lab.code), [lab.code]);
  const lines = lab.code.split("\n").length;
  const fw = lab.mcu.fw;
  const current = currentLine ?? (fw && (lab.status === "halted" || !lab.running) ? fw.line : -1);
  const errLines = new Set(lab.diagnostics.map((d) => d.line));
  const lang = languages?.find((l) => l.code === lab.code)?.label ?? languages?.[0]?.label;
  const ok = !lab.diagnostics.length;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const t = e.currentTarget, s = t.selectionStart, end = t.selectionEnd;
      const next = `${lab.code.slice(0, s)}    ${lab.code.slice(end)}`;
      lab.setCode(next);
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); lab.run(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); lab.save(); }
  };

  return (
    <section className={`mcl-panel mcl-editor ${dark ? "mcl-editor-dark" : ""} ${expanded ? "mcl-editor-expanded" : ""} ${className}`}>
      <div className="mcl-panel-head">
        <h2><Icon name="code" />{title}</h2>
        <div className="mcl-panel-tools">
          {languages && languages.length > 1 ? (
            <select aria-label="Code variant" value={lang} onChange={(e) => { const v = languages.find((l) => l.label === e.target.value); if (v) lab.setCode(v.code); }}>
              {languages.map((l) => <option key={l.label}>{l.label}</option>)}
            </select>
          ) : languages?.[0] ? <span className="mcl-chip">{languages[0].label}</span> : null}
          {lab.dirty ? <span className="mcl-chip mcl-chip-warn" title="Edited — press Run to rebuild">edited</span> : null}
          <button type="button" className="mcl-icon-btn" aria-label={expanded ? "Collapse editor" : "Expand editor"} onClick={() => setExpanded((v) => !v)}><Icon name="expand" /></button>
        </div>
      </div>
      <div className="mcl-code" style={rows ? { height: `${rows * 18 + 16}px` } : undefined}>
        <div className="mcl-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => {
            const n = i + 1;
            return <div key={n} className={`${lab.breakpoints.has(n) ? "bp" : ""} ${n === current ? "cur" : ""} ${errLines.has(n) ? "err" : ""}`} onClick={() => lab.toggleBreakpoint(n)} title="Toggle breakpoint">{n}</div>;
          })}
        </div>
        <div className="mcl-code-surface">
          <div className="mcl-code-lines" aria-hidden="true" style={{ transform: `translateY(${-(area.current?.scrollTop ?? 0)}px)` }}>
            {current > 0 ? <div className="mcl-line-cur" style={{ top: `${(current - 1) * 18 + 8}px` }} /> : null}
            {[...errLines].filter((l) => l > 0).map((l) => <div key={l} className="mcl-line-err" style={{ top: `${(l - 1) * 18 + 8}px` }} />)}
          </div>
          <pre ref={pre} aria-hidden="true">{colored}</pre>
          <textarea ref={area} value={lab.code} spellCheck={false} aria-label="Firmware source code" onKeyDown={onKeyDown}
            onChange={(e) => lab.setCode(e.target.value)}
            onScroll={(e) => { const t = e.currentTarget; if (pre.current) { pre.current.scrollTop = t.scrollTop; pre.current.scrollLeft = t.scrollLeft; } if (gutter.current) gutter.current.scrollTop = t.scrollTop; const ov = t.parentElement?.querySelector<HTMLElement>(".mcl-code-lines"); if (ov) ov.style.transform = `translateY(${-t.scrollTop}px)`; }} />
        </div>
      </div>
      <div className={`mcl-build ${ok ? "ok" : "bad"}`}>
        <span>{ok ? <><Icon name="check" />{lab.dirty ? "Edited — press Run (Ctrl+Enter) to rebuild" : lab.status === "halted" ? `Paused at line ${fw?.line ?? "?"}${fw?.pauseReason ? ` — ${fw.pauseReason}` : ""}` : "Code compiled successfully!"}</> : <><Icon name="x" />{lab.diagnostics[0]?.line ? `Line ${lab.diagnostics[0].line}: ` : ""}{lab.diagnostics[0]?.message}</>}</span>
        <button type="button" onClick={() => setOutput((v) => !v)} aria-expanded={output}>Build Output <Icon name={output ? "chevDown" : "chevRight"} size={12} /></button>
      </div>
      {output ? (
        <div className="mcl-build-out" role="log">
          {lab.diagnostics.map((d, i) => <div key={i} className="bad">error: {d.line ? `line ${d.line}: ` : ""}{d.message}</div>)}
          {ok ? <div>Build OK · {lines} lines · {fw ? `${fw.statements.toLocaleString()} statements executed · ${fw.threads.length} thread${fw.threads.length === 1 ? "" : "s"}` : "not running"}</div> : null}
          {lab.mcu.events.slice(-6).map((e, i) => <div key={i} className={e.kind === "fault" ? "bad" : ""}>[{(e.t * 1000).toFixed(2)} ms] {e.text}</div>)}
          {fw?.printed.length ? <pre>{fw.printed.join("").slice(-400)}</pre> : null}
        </div>
      ) : null}
      {footer}
    </section>
  );
}
