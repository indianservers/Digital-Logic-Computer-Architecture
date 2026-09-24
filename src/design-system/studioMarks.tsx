const props = { width: 22, height: 22, viewBox: "0 0 32 32", fill: "none" };

function glyph(id: string) {
  switch (id) {
    case "numbers":
      return <><rect x="4" y="6" width="10" height="10" rx="2" fill="#fff" opacity="0.95" /><rect x="18" y="6" width="10" height="10" rx="2" fill="#fff" opacity="0.55" /><rect x="4" y="18" width="10" height="8" rx="2" fill="#fff" opacity="0.55" /><rect x="18" y="18" width="10" height="8" rx="2" fill="#fff" /><path d="M7 11h4M21 11h4M7 22h4M21 22h4" stroke="#0369a1" strokeWidth="1.8" strokeLinecap="round" /></>;
    case "boolean":
      return <><path d="M6 16c0-6 4-9 10-9s10 3 10 9-4 9-10 9-10-3-10-9z" fill="#fff" opacity="0.9" /><path d="M12 16h8M16 12v8" stroke="#047857" strokeWidth="2" strokeLinecap="round" /></>;
    case "gates":
      return <><path d="M6 8h8c5 0 9 3.6 9 8s-4 8-9 8H6z" fill="#fff" /><circle cx="6" cy="12" r="1.6" fill="#065f46" /><circle cx="6" cy="20" r="1.6" fill="#065f46" /><circle cx="26" cy="16" r="1.8" fill="#fff" /></>;
    case "truth":
      return <><rect x="6" y="6" width="20" height="20" rx="3" fill="#fff" /><path d="M6 13h20M14 6v20" stroke="#0f766e" strokeWidth="1.6" /><circle cx="10" cy="18" r="1.4" fill="#0f766e" /><circle cx="20" cy="22" r="1.4" fill="#0f766e" /></>;
    case "kmap":
      return <><rect x="5" y="5" width="10" height="10" rx="2" fill="#fff" /><rect x="17" y="5" width="10" height="10" rx="2" fill="#fff" opacity="0.55" /><rect x="5" y="17" width="10" height="10" rx="2" fill="#fff" opacity="0.55" /><rect x="17" y="17" width="10" height="10" rx="2" fill="#fff" /><circle cx="10" cy="10" r="2" fill="#7c3aed" /></>;
    case "combo":
      return <><rect x="4" y="8" width="10" height="8" rx="2" fill="#fff" /><rect x="18" y="8" width="10" height="8" rx="2" fill="#fff" /><path d="M14 12h4M16 16v6h8" stroke="#fff" strokeWidth="2" /><circle cx="24" cy="22" r="3" fill="#bbf7d0" /></>;
    case "adders":
      return <><circle cx="16" cy="16" r="10" fill="#fff" /><path d="M16 10v12M10 16h12" stroke="#b45309" strokeWidth="2.4" strokeLinecap="round" /></>;
    case "mux":
      return <><path d="M10 6l12 4v12L10 26z" fill="#fff" /><path d="M6 10h4M6 16h4M6 22h4M22 16h4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></>;
    case "alu":
      return <><path d="M8 6h10l6 10-6 10H8l6-10z" fill="#fff" opacity="0.9" /><path d="M14 16h6" stroke="#b45309" strokeWidth="2" /></>;
    case "timing":
      return <><circle cx="16" cy="16" r="10" fill="#fff" /><path d="M16 8v8l5 3" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" /></>;
    case "latches":
      return <><rect x="6" y="8" width="20" height="16" rx="3" fill="#fff" /><path d="M10 16h4l2-4 2 8 2-4h4" stroke="#c2410c" strokeWidth="1.8" strokeLinecap="round" /></>;
    case "registers":
      return <><rect x="4" y="10" width="6" height="12" rx="1.5" fill="#fff" /><rect x="13" y="10" width="6" height="12" rx="1.5" fill="#fff" opacity="0.75" /><rect x="22" y="10" width="6" height="12" rx="1.5" fill="#fff" /></>;
    case "counters":
      return <><rect x="6" y="8" width="20" height="16" rx="3" fill="#fff" /><path d="M10 18c2-6 12-6 12 0" stroke="#c2410c" strokeWidth="2" fill="none" /><circle cx="22" cy="18" r="1.6" fill="#c2410c" /></>;
    case "fsm":
      return <><circle cx="10" cy="16" r="5" fill="#fff" /><circle cx="22" cy="16" r="5" fill="#fff" opacity="0.8" /><path d="M15 16h2" stroke="#fff" strokeWidth="2" /><path d="M20 11c4-4 8 0 4 4" stroke="#fff" strokeWidth="1.6" fill="none" /></>;
    case "memory":
      return <><rect x="7" y="6" width="18" height="20" rx="3" fill="#fff" /><path d="M10 11h12M10 16h12M10 21h8" stroke="#6d28d9" strokeWidth="1.7" /></>;
    case "cache":
      return <><path d="M8 22h16l-3-12H11z" fill="#fff" /><rect x="12" y="8" width="8" height="4" rx="1" fill="#ede9fe" /></>;
    case "hierarchy":
      return <><rect x="11" y="5" width="10" height="5" rx="1" fill="#fff" /><rect x="8" y="13" width="16" height="5" rx="1" fill="#fff" opacity="0.75" /><rect x="5" y="21" width="22" height="5" rx="1" fill="#fff" opacity="0.5" /></>;
    case "vm":
      return <><rect x="5" y="8" width="12" height="16" rx="2" fill="#fff" /><rect x="15" y="12" width="12" height="12" rx="2" fill="#fff" opacity="0.65" /><path d="M13 16h6" stroke="#6d28d9" strokeWidth="1.8" /></>;
    case "cpu-blocks":
      return <><rect x="6" y="6" width="20" height="20" rx="4" fill="#fff" /><rect x="10" y="10" width="5" height="5" rx="1" fill="#1d4ed8" /><rect x="17" y="10" width="5" height="5" rx="1" fill="#60a5fa" /><rect x="10" y="17" width="12" height="5" rx="1" fill="#93c5fd" /></>;
    case "datapath":
      return <><rect x="5" y="12" width="8" height="8" rx="2" fill="#fff" /><rect x="19" y="12" width="8" height="8" rx="2" fill="#fff" /><path d="M13 16h6" stroke="#fff" strokeWidth="2" /><path d="M16 10v4M16 18v4" stroke="#bfdbfe" strokeWidth="2" /></>;
    case "isa":
      return <><rect x="4" y="12" width="7" height="8" rx="1.5" fill="#fff" /><rect x="12" y="12" width="6" height="8" rx="1.5" fill="#fff" opacity="0.75" /><rect x="19" y="12" width="9" height="8" rx="1.5" fill="#fff" opacity="0.5" /></>;
    case "addressing":
      return <><circle cx="10" cy="16" r="5" fill="#fff" /><path d="M14 16h10l-3-3M24 16l-3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></>;
    case "assembly":
      return <><rect x="6" y="6" width="20" height="20" rx="3" fill="#fff" /><path d="M10 12h12M10 16h8M10 20h10" stroke="#1d4ed8" strokeWidth="1.7" /></>;
    case "fde":
      return <><circle cx="8" cy="16" r="3.2" fill="#fff" /><circle cx="16" cy="16" r="3.2" fill="#fff" opacity="0.8" /><circle cx="24" cy="16" r="3.2" fill="#fff" opacity="0.6" /><path d="M11 16h2M19 16h2" stroke="#fff" strokeWidth="1.6" /></>;
    case "control":
      return <><rect x="7" y="7" width="18" height="18" rx="4" fill="#fff" /><circle cx="16" cy="16" r="4" fill="#1d4ed8" /><path d="M16 9v2M16 21v2M9 16h2M21 16h2" stroke="#1d4ed8" strokeWidth="1.6" /></>;
    case "pipeline":
      return <><rect x="4" y="12" width="5" height="8" rx="1" fill="#fff" /><rect x="10" y="12" width="5" height="8" rx="1" fill="#fff" opacity="0.85" /><rect x="16" y="12" width="5" height="8" rx="1" fill="#fff" opacity="0.7" /><rect x="22" y="12" width="6" height="8" rx="1" fill="#fff" opacity="0.55" /></>;
    case "hazards":
      return <><path d="M16 5l12 22H4z" fill="#fff" /><path d="M16 13v6M16 22h.01" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" /></>;
    case "io":
      return <><rect x="6" y="8" width="12" height="16" rx="2" fill="#fff" /><path d="M18 12h6v8h-6" stroke="#fff" strokeWidth="2" /><circle cx="24" cy="16" r="2" fill="#99f6e4" /></>;
    case "interrupts":
      return <><path d="M16 5v6l4 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><path d="M8 20h16l-4 6H12z" fill="#fff" /></>;
    case "bus":
      return <><rect x="4" y="14" width="24" height="4" rx="2" fill="#fff" /><rect x="6" y="6" width="6" height="6" rx="1.5" fill="#ccfbf1" /><rect x="13" y="22" width="6" height="6" rx="1.5" fill="#ccfbf1" /><rect x="20" y="6" width="6" height="6" rx="1.5" fill="#ccfbf1" /></>;
    case "parallel":
      return <><path d="M8 8v16M16 8v16M24 8v16" stroke="#fff" strokeWidth="3" strokeLinecap="round" /><path d="M8 12h8M16 20h8" stroke="#99f6e4" strokeWidth="2" /></>;
    case "multicore":
      return <><rect x="5" y="5" width="10" height="10" rx="2" fill="#fff" /><rect x="17" y="5" width="10" height="10" rx="2" fill="#fff" opacity="0.75" /><rect x="5" y="17" width="10" height="10" rx="2" fill="#fff" opacity="0.75" /><rect x="17" y="17" width="10" height="10" rx="2" fill="#fff" /></>;
    case "accelerator":
      return <><rect x="6" y="6" width="8" height="8" rx="1.5" fill="#fff" /><rect x="18" y="6" width="8" height="8" rx="1.5" fill="#fff" /><rect x="6" y="18" width="8" height="8" rx="1.5" fill="#fff" /><rect x="18" y="18" width="8" height="8" rx="1.5" fill="#fce7f3" /></>;
    case "hetero":
      return <><circle cx="11" cy="16" r="6" fill="#fff" /><rect x="18" y="10" width="9" height="12" rx="2" fill="#fff" opacity="0.75" /></>;
    case "soc":
      return <><rect x="5" y="5" width="22" height="22" rx="4" fill="#fff" /><rect x="8" y="8" width="7" height="7" rx="1.5" fill="#db2777" /><rect x="17" y="8" width="7" height="7" rx="1.5" fill="#f9a8d4" /><rect x="8" y="17" width="16" height="7" rx="1.5" fill="#fce7f3" /></>;
    case "cpu8":
      return <><rect x="6" y="8" width="20" height="16" rx="3" fill="#fff" /><path d="M10 16h12" stroke="#be185d" strokeWidth="2" /><path d="M16 8v-3M16 24v3M6 16H3M26 16h3" stroke="#fff" strokeWidth="1.6" /></>;
    case "cpu16":
      return <><rect x="5" y="7" width="22" height="18" rx="3" fill="#fff" /><path d="M9 13h14M9 19h10" stroke="#be185d" strokeWidth="1.8" /></>;
    case "gpu":
      return <><rect x="5" y="10" width="22" height="14" rx="3" fill="#fff" /><path d="M9 17h3M14 17h3M19 17h3" stroke="#be185d" strokeWidth="2" strokeLinecap="round" /></>;
    case "mips":
      return <><rect x="6" y="8" width="20" height="16" rx="3" fill="#fff" /><path d="M10 16l4-4 4 8 4-6" stroke="#c2410c" strokeWidth="1.8" fill="none" /></>;
    case "riscv-lab":
      return <><circle cx="16" cy="16" r="10" fill="#fff" /><path d="M11 16h10M16 11l5 5-5 5" stroke="#c2410c" strokeWidth="2" fill="none" /></>;
    case "arm":
      return <><path d="M8 20c4-12 12-12 16 0" stroke="#fff" strokeWidth="3" fill="none" /><circle cx="10" cy="20" r="3" fill="#fff" /><circle cx="22" cy="20" r="3" fill="#fff" /></>;
    case "x86":
      return <><rect x="5" y="10" width="6" height="12" rx="1.5" fill="#fff" /><rect x="12" y="10" width="4" height="12" rx="1.5" fill="#fff" opacity="0.8" /><rect x="17" y="10" width="10" height="12" rx="1.5" fill="#fff" opacity="0.55" /></>;
    case "compare-isa":
      return <><rect x="5" y="8" width="9" height="16" rx="2" fill="#fff" /><rect x="18" y="8" width="9" height="16" rx="2" fill="#fff" opacity="0.7" /><path d="M14 16h4" stroke="#fff" strokeWidth="2" /></>;
    case "mobile":
      return <><rect x="10" y="4" width="12" height="24" rx="3" fill="#fff" /><circle cx="16" cy="24" r="1.4" fill="#c2410c" /></>;
    case "desktop":
      return <><rect x="5" y="7" width="22" height="14" rx="2" fill="#fff" /><rect x="12" y="21" width="8" height="3" fill="#fff" /><rect x="9" y="24" width="14" height="2" rx="1" fill="#fff" /></>;
    case "builder":
      return <><path d="M8 22V10l8-4 8 4v12H8z" fill="#fff" /><path d="M16 10v12M8 16h16" stroke="#4338ca" strokeWidth="1.6" /></>;
    case "sandbox":
      return <><rect x="5" y="14" width="22" height="10" rx="2" fill="#fff" /><rect x="9" y="8" width="6" height="6" rx="1" fill="#c7d2fe" /><rect x="17" y="8" width="6" height="6" rx="1" fill="#a5b4fc" /></>;
    default:
      return <circle cx="16" cy="16" r="8" fill="#fff" />;
  }
}

export function StudioMark({ id, size = 42 }: { id: string; size?: number }) {
  return (
    <span className={`studio-mark mark-${id}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg {...props}>{glyph(id)}</svg>
    </span>
  );
}
