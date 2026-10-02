import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function Panel({ title, icon, tools, children, className = "", id }: { title: ReactNode; icon?: IconName; tools?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`mcl-panel ${className}`} id={id}>
      <div className="mcl-panel-head">
        <h2>{icon ? <Icon name={icon} /> : null}{title}</h2>
        {tools ? <div className="mcl-panel-tools">{tools}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, label, size = "md" }: { value: T; options: Array<T | { value: T; label: ReactNode; tone?: string }>; onChange: (v: T) => void; label?: string; size?: "sm" | "md" }) {
  return (
    <div className={`mcl-seg mcl-seg-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const opt = typeof o === "object" ? o : { value: o, label: String(o), tone: undefined };
        const on = opt.value === value;
        return <button key={String(opt.value)} type="button" role="radio" aria-checked={on} className={`${on ? "on" : ""} ${opt.tone ? `mcl-tone-${opt.tone}` : ""}`} onClick={() => onChange(opt.value)}>{opt.label}</button>;
      })}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = "", onChange, format }: { label: ReactNode; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="mcl-slider">
      <span>{label}<b>{format ? format(value) : `${value}${unit}`}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="mcl-toggle" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="mcl-toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function Metric({ label, value, unit, icon, tone, sub }: { label: ReactNode; value: ReactNode; unit?: string; icon?: IconName; tone?: string; sub?: ReactNode }) {
  return (
    <div className={`mcl-metric ${tone ? `mcl-tone-${tone}` : ""}`}>
      {icon ? <Icon name={icon} size={20} /> : null}
      <div><span>{label}</span><b>{value}{unit ? <small> {unit}</small> : null}</b>{sub ? <em>{sub}</em> : null}</div>
    </div>
  );
}

export function KV({ rows, className = "" }: { rows: Array<[ReactNode, ReactNode]>; className?: string }) {
  return <dl className={`mcl-kv ${className}`}>{rows.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export interface Fault { id: string; label: string; hint: string }

export function FaultPanel({ faults, active, onToggle, title = "Fault Injection" }: { faults: Fault[]; active: Record<string, boolean>; onToggle: (id: string, on: boolean) => void; title?: string }) {
  return (
    <Panel title={title} icon="bug" className="mcl-faults">
      <ul>
        {faults.map((f) => (
          <li key={f.id} className={active[f.id] ? "on" : ""}>
            <Toggle label={f.label} checked={!!active[f.id]} onChange={(v) => onToggle(f.id, v)} hint={f.hint} />
            <small>{f.hint}</small>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export interface Notes {
  takeaways: string[];
  observe: string;
  tryIt: string;
  measure: string;
  modify: string;
  runAgain: string;
  challenge: string;
  question?: string;
  checks?: Array<{ label: string; done: boolean }>;
}

export function LearningNotes({ notes, title = "Learning Notes", variant = "tabs" }: { notes: Notes; title?: string; variant?: "tabs" | "tasks" }) {
  const [tab, setTab] = useState<"key" | "steps" | "challenge">("key");
  const steps: Array<[string, string]> = [["Observe", notes.observe], ["Try", notes.tryIt], ["Measure", notes.measure], ["Modify", notes.modify], ["Run Again", notes.runAgain]];
  if (variant === "tasks") {
    return (
      <Panel title={title} icon="check" className="mcl-notes mcl-notes-tasks">
        <ol>{steps.map(([k, v]) => <li key={k}><b>{k}.</b> {v}</li>)}</ol>
        {notes.checks?.length ? <ul className="mcl-checks">{notes.checks.map((c) => <li key={c.label} className={c.done ? "done" : ""}><Icon name={c.done ? "check" : "target"} size={14} />{c.label}</li>)}</ul> : null}
        <p className="mcl-challenge"><b>Challenge:</b> {notes.challenge}</p>
      </Panel>
    );
  }
  return (
    <Panel title={title} icon="book" className="mcl-notes">
      <div className="mcl-tabs" role="tablist">
        {([["key", "Key Takeaways"], ["steps", "Steps"], ["challenge", "Challenge"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "key" ? <ul className="mcl-takeaways">{notes.takeaways.map((t) => <li key={t}><Icon name="check" size={13} />{t}</li>)}</ul> : null}
      {tab === "steps" ? <ol className="mcl-steps">{steps.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}</ol> : null}
      {tab === "challenge" ? (
        <div className="mcl-challenge-tab">
          <p>{notes.challenge}</p>
          {notes.checks?.length ? <ul className="mcl-checks">{notes.checks.map((c) => <li key={c.label} className={c.done ? "done" : ""}><Icon name={c.done ? "check" : "target"} size={14} />{c.label}</li>)}</ul> : null}
        </div>
      ) : null}
      {notes.question ? <p className="mcl-question"><Icon name="bulb" size={18} />{notes.question}</p> : null}
    </Panel>
  );
}

export function LogView({ lines, empty = "No events yet — press Run.", className = "" }: { lines: Array<{ t?: number; text: string; tone?: string }>; empty?: string; className?: string }) {
  return (
    <div className={`mcl-log ${className}`} role="log">
      {lines.length ? lines.map((l, i) => <div key={i} className={l.tone ? `mcl-tone-${l.tone}` : ""}>{l.t !== undefined ? <time>{(l.t * 1000).toFixed(3)} ms</time> : null}{l.text}</div>) : <div className="mcl-muted">{empty}</div>}
    </div>
  );
}

export function hex(v: number, digits = 8) { return `0x${(v >>> 0).toString(16).toUpperCase().padStart(digits, "0")}`; }
export function bin(v: number, bits = 8) { return (v >>> 0).toString(2).padStart(bits, "0").slice(-bits); }
