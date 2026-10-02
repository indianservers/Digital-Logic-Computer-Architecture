/** STM32 package drawing used by the bench labs (11-20): a blue QFP with labelled, selectable pin tags on its right edge. */
export interface BenchPin { key: string; y: number; level: number; tag?: string; selected?: boolean; onSelect?: () => void }

export function BenchChip({ x = 30, y = 30, w = 220, h = 150, pins, sub = "Cortex-M4 · F401RE", note }: { x?: number; y?: number; w?: number; h?: number; pins: BenchPin[]; sub?: string; note?: string }) {
  const n = Math.floor((w - 20) / 14.5);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#1f5fa8" stroke="#1a4f8c" />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}><rect x={x + 14 + i * 14.5} y={y - 8} width={4} height={8} fill="#d4b26a" /><rect x={x + 14 + i * 14.5} y={y + h} width={4} height={8} fill="#d4b26a" /></g>
      ))}
      <text x={x + (w - 54) / 2} y={y + h / 2 - 3} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">STM32</text>
      <text x={x + (w - 54) / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize="9.5" fill="#cfe0f7">{sub}</text>
      {note ? <text x={x + (w - 54) / 2} y={y + h / 2 + 34} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fde68a">{note}</text> : null}
      {pins.map((p) => {
        const lit = p.level < 0 ? "#f59e0b" : p.level ? "#4ade80" : "#94a3b8";
        const tw = p.tag && p.tag.length > 1 ? 32 + p.key.length * 5.6 + p.tag.length * 4.8 : 50;
        const px = x + w - 4 - tw;
        return (
          <g key={p.key} className={`mcl-g2-pin ${p.selected ? "sel" : ""}`} onClick={p.onSelect} role={p.onSelect ? "button" : undefined} tabIndex={p.onSelect ? 0 : undefined} aria-label={p.onSelect ? `Select ${p.key}` : undefined}
            onKeyDown={(e) => { if (p.onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); p.onSelect(); } }}>
            <rect x={px} y={p.y - 7} width={tw} height={14} rx={3} fill={p.selected ? "#fff" : "#174a85"} />
            <circle cx={px + 8} cy={p.y} r={3} fill={lit} />
            <text x={px + 16} y={p.y + 3.5} fontSize="9" fontWeight="700" fill={p.selected ? "#0f2547" : "#e2ecf8"}>{p.key}</text>
            {p.tag ? <text x={px + tw - 4} y={p.y + 3.5} textAnchor="end" fontSize="8" fill={p.selected ? "#4b6283" : "#a9c2e3"}>{p.tag}</text> : null}
          </g>
        );
      })}
    </g>
  );
}

/** Deterministic xorshift PRNG so bounce bursts and noise are reproducible per run. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
