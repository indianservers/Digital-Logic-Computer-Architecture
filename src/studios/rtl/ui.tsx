export function Mark({ kind }: { kind: string }) {
  const p = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "file") return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
  if (kind === "play") return <svg {...p}><path d="M8 6l10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
  if (kind === "reset") return <svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /></svg>;
  if (kind === "book") return <svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /></svg>;
  if (kind === "bulb") return <svg {...p}><path d="M9 18h6M10 21h4" /><path d="M8 14a6 6 0 1 1 8 0c-.8.7-1.2 1.4-1.4 2.2H9.4C9.2 15.4 8.8 14.7 8 14z" /></svg>;
  if (kind === "ok") return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M8 12l2.5 2.5L16 9" /></svg>;
  if (kind === "bus") return <svg {...p}><path d="M3 12h18M7 8v8M12 8v8M17 8v8" /></svg>;
  if (kind === "gear") return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /></svg>;
  if (kind === "info") return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg>;
  return <svg {...p}><rect x="5" y="5" width="14" height="14" rx="2" /></svg>;
}
