import type { ReactNode } from "react";

export function Mark({ kind }: { kind: string }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "chip") return <svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg>;
  if (kind === "book") return <svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" /></svg>;
  if (kind === "quote") return <svg {...p}><path d="M8 8H5v5h4V8c0-3 2-4 4-4M19 8h-3v5h4V8c0-3 2-4 4-4" /></svg>;
  if (kind === "link") return <svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" /></svg>;
  if (kind === "play") return <svg {...p}><path d="M8 6l10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
  if (kind === "reset") return <svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /></svg>;
  if (kind === "bulb") return <svg {...p}><path d="M9 18h6M10 21h4" /><path d="M8 14a6 6 0 1 1 8 0c-.8.7-1.2 1.4-1.4 2.2H9.4C9.2 15.4 8.8 14.7 8 14z" /></svg>;
  if (kind === "cap") return <svg {...p}><path d="M3 9l9-5 9 5-9 5z" /><path d="M7 11.5V16c2 1.5 8 1.5 10 0v-4.5" /></svg>;
  if (kind === "search") return <svg {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-3.5-3.5" /></svg>;
  if (kind === "gear") return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5" /></svg>;
  if (kind === "bars") return <svg {...p}><path d="M4 19V10M10 19V5M16 19v-7M22 19H2" /></svg>;
  if (kind === "term") return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M12 15h5" /></svg>;
  if (kind === "full") return <svg {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
  if (kind === "calc") return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2" /></svg>;
  if (kind === "scale") return <svg {...p}><path d="M12 4v16M8 20h8M12 7l-6 6h4M12 7l6 6h-4" /></svg>;
  if (kind === "flow") return <svg {...p}><circle cx="6" cy="12" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="18" cy="17" r="2" /><path d="M8 12h6M14 12l2-4M14 12l2 4" /></svg>;
  return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /></svg>;
}

export function CodeBlock({ lines }: { lines: ReactNode[] }) {
  return (
    <div className="isx-code" role="group" aria-label="Assembly">
      {lines.map((line, index) => (
        <div key={index}><span>{index + 1}</span><code>{line}</code></div>
      ))}
    </div>
  );
}

export function WhatChanged({ items, hidden }: { items: Array<{ title: string; body: string }>; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <section className="isx-what">
      <h3><Mark kind="bars" /> What changed?</h3>
      <ol>
        {items.map((item, index) => (
          <li key={item.title}><b>{index + 1}</b><span><strong>{item.title}</strong> {item.body}</span></li>
        ))}
      </ol>
    </section>
  );
}

export function RunBar({ label, onRun, onReset, extra }: { label: string; onRun: () => void; onReset: () => void; extra?: ReactNode }) {
  return (
    <div className="isx-run">
      {extra}
      <span className="isx-run-label">{label}</span>
      <button type="button" className="isx-go" onClick={onRun}><Mark kind="play" /> Run</button>
      <button type="button" className="isx-quiet" onClick={onReset}><Mark kind="reset" /> Reset</button>
    </div>
  );
}
