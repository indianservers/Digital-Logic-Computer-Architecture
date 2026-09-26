const svg = { width: 28, height: 28, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function AcaIcon({ name, label }: { name: string; label?: string }) {
  return (
    <svg {...svg} className="aca-icon" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {paths(name)}
    </svg>
  );
}

function paths(name: string) {
  switch (name) {
    case "studio":
      return <><rect x="6" y="6" width="20" height="20" rx="3" /><rect x="9" y="9" width="6" height="6" /><rect x="17" y="9" width="6" height="5" /><rect x="9" y="17" width="14" height="6" /></>;
    case "ilp":
      return <><path d="M6 10h8M6 16h12M6 22h8" /><path d="M16 8l4 2-4 2M20 14l4 2-4 2M16 20l4 2-4 2" /></>;
    case "branch":
      return <><path d="M8 24V12M8 12l12-6M8 12l12 6" /><circle cx="8" cy="24" r="2" fill="currentColor" stroke="none" /></>;
    case "ooo":
      return <><rect x="5" y="8" width="6" height="16" rx="1" /><rect x="13" y="8" width="6" height="16" rx="1" /><rect x="21" y="8" width="6" height="16" rx="1" /></>;
    case "coherence":
      return <><circle cx="8" cy="10" r="3" /><circle cx="24" cy="10" r="3" /><circle cx="16" cy="22" r="3" /><path d="M11 12l3 7M21 12l-3 7" /></>;
    case "memory":
      return <><rect x="8" y="5" width="16" height="6" rx="1" /><rect x="6" y="13" width="20" height="6" rx="1" /><rect x="4" y="21" width="24" height="6" rx="1" /></>;
    case "multicore":
      return <><rect x="5" y="5" width="9" height="9" rx="1.5" /><rect x="18" y="5" width="9" height="9" rx="1.5" /><rect x="5" y="18" width="9" height="9" rx="1.5" /><rect x="18" y="18" width="9" height="9" rx="1.5" /></>;
    case "performance":
      return <><path d="M6 22a10 10 0 1 1 20 0" /><path d="M16 22l6-6" /></>;
    case "arithmetic":
      return <><path d="M6 8h8M6 14h8M6 20h8" /><path d="M16 8l6 6-6 6" /><rect x="22" y="11" width="6" height="6" rx="1" /></>;
    case "wallace-tree":
      return <><rect x="4" y="6" width="6" height="4" /><rect x="12" y="6" width="6" height="4" /><rect x="20" y="6" width="6" height="4" /><rect x="8" y="14" width="6" height="4" /><rect x="16" y="14" width="6" height="4" /><rect x="12" y="22" width="8" height="4" /><path d="M7 10l4 4M15 10v4M23 10l-4 4M11 18l4 4M19 18l-4 4" /></>;
    case "array-multiplier":
      return <><circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><circle cx="24" cy="8" r="2.5" /><rect x="6" y="14" width="6" height="5" rx="1" /><rect x="14" y="14" width="6" height="5" rx="1" /><rect x="22" y="14" width="6" height="5" rx="1" /><path d="M9 13v1M17 13v1M25 13v1M12 16h2M20 16h2" /><path d="M8 22h16" /></>;
    case "booth-multiplier":
      return <><rect x="4" y="8" width="10" height="6" rx="1" /><rect x="16" y="8" width="8" height="6" rx="1" /><rect x="26" y="8" width="3" height="6" rx="1" /><path d="M8 18v4h16" /><path d="M20 20l4 2-4 2" /></>;
    case "data-hazards":
      return <><path d="M6 10h8l4 6H8zM18 10h8l-4 6h-4z" /><path d="M12 20h8" /></>;
    case "scoreboard":
      return <><rect x="6" y="6" width="20" height="20" rx="2" /><path d="M6 12h20M6 18h20M13 6v20" /></>;
    case "tomasulo":
      return <><rect x="4" y="7" width="8" height="5" /><rect x="4" y="14" width="8" height="5" /><rect x="4" y="21" width="8" height="5" /><path d="M12 9h8M12 16h8M12 23h8M20 9v14" /></>;
    case "register-renaming":
      return <><path d="M6 8h6M6 16h6M6 24h6M20 8h6M20 16h6M20 24h6" /><path d="M12 8c6 0 2 8 8 8M12 24c6 0 2-8 8-8" /></>;
    case "reorder-buffer":
      return <><path d="M6 8h20M6 14h14M6 20h20M6 26h10" /><circle cx="24" cy="14" r="2" fill="currentColor" stroke="none" /></>;
    case "branch-predictor":
      return <><circle cx="10" cy="16" r="5" /><path d="M15 16h8M19 12l4 4-4 4" /><path d="M8 16h4" /></>;
    case "correlating-predictor":
      return <><rect x="4" y="12" width="8" height="8" /><path d="M12 16h4" /><rect x="16" y="6" width="12" height="6" /><rect x="16" y="14" width="12" height="6" /><rect x="16" y="22" width="12" height="5" /></>;
    case "branch-target-buffer":
      return <><path d="M5 16h8l3-4" /><rect x="16" y="8" width="12" height="16" rx="2" /><path d="M19 13h6M19 18h6M19 23h4" /></>;
    case "tournament-predictor":
      return <><circle cx="8" cy="8" r="3" /><circle cx="8" cy="16" r="3" /><circle cx="8" cy="24" r="3" /><path d="M11 8h8M11 16h8M11 24h8M19 8v16" /><circle cx="24" cy="16" r="3" /></>;
    case "speculative-execution":
      return <><path d="M6 22V10l10 6M16 16l8-6M16 16l8 6" /><path d="M24 22l-4 4" /></>;
    case "superscalar":
      return <><path d="M5 8h22M5 16h22M5 24h22" /><path d="M10 8v16M18 8v16M26 8v16" /></>;
    case "issue-queue":
      return <><rect x="6" y="6" width="16" height="6" /><rect x="6" y="13" width="16" height="6" /><rect x="6" y="20" width="16" height="6" /><circle cx="26" cy="9" r="2" fill="currentColor" stroke="none" /><circle cx="26" cy="23" r="2" /></>;
    case "physical-register-file":
      return <><rect x="4" y="8" width="8" height="16" /><rect x="16" y="5" width="12" height="22" /><path d="M12 12h4M12 20h4" /></>;
    case "load-store-queue":
      return <><path d="M6 8l6 4-6 4M20 12l6-4v8z" /><rect x="10" y="18" width="12" height="8" rx="1" /></>;
    case "memory-disambiguation":
      return <><path d="M6 10h14M6 22h14" /><path d="M20 10c6 0 6 12 0 12" /><path d="M14 13v6" /></>;
    case "execution-ports":
      return <><rect x="4" y="6" width="10" height="20" rx="1" /><path d="M14 10h6M14 16h6M14 22h6" /><rect x="20" y="7" width="8" height="4" /><rect x="20" y="14" width="8" height="4" /><rect x="20" y="21" width="8" height="4" /></>;
    case "mesi":
      return <><rect x="4" y="8" width="10" height="8" /><rect x="18" y="8" width="10" height="8" /><path d="M9 16v6h14v-6" /><path d="M7 12h4M21 12h4" /></>;
    case "moesi":
      return <><circle cx="16" cy="16" r="10" /><path d="M16 6v4M16 22v4M6 16h4M22 16h4" /><circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" /></>;
    case "directory-coherence":
      return <><rect x="12" y="12" width="8" height="8" /><circle cx="6" cy="8" r="2.5" /><circle cx="26" cy="8" r="2.5" /><circle cx="6" cy="24" r="2.5" /><circle cx="26" cy="24" r="2.5" /><path d="M8 9l5 5M24 9l-5 5M8 23l5-5M24 23l-5-5" /></>;
    case "false-sharing":
      return <><rect x="4" y="12" width="24" height="8" /><path d="M16 12v8" /><circle cx="10" cy="8" r="2" /><circle cx="22" cy="8" r="2" /><path d="M10 10v2M22 10v2" /></>;
    case "coherence-traffic":
      return <><path d="M4 16h24" /><path d="M8 16V8h4M20 16v8h4" /><path d="M10 8l2 2M22 24l2-2" /></>;
    case "snooping-vs-directory":
      return <><path d="M4 10h12" /><circle cx="6" cy="10" r="2" /><circle cx="14" cy="10" r="2" /><circle cx="22" cy="22" r="3" /><path d="M22 19V12M22 22l6-4M22 22l-6-2" /></>;
    case "mshr":
      return <><rect x="5" y="6" width="14" height="20" rx="2" /><rect x="21" y="8" width="6" height="4" /><rect x="21" y="14" width="6" height="4" /><rect x="21" y="20" width="6" height="4" /></>;
    case "prefetching":
      return <><rect x="4" y="12" width="6" height="8" /><rect x="13" y="12" width="6" height="8" opacity="0.7" /><rect x="22" y="12" width="6" height="8" opacity="0.4" /><path d="M10 10h12" /></>;
    case "dram-controller":
      return <><rect x="5" y="6" width="8" height="20" /><rect x="15" y="6" width="12" height="6" /><rect x="15" y="14" width="12" height="6" /><rect x="15" y="22" width="12" height="4" /></>;
    case "memory-consistency":
      return <><path d="M8 6v20M24 6v20" /><path d="M8 12h16M8 22h16" /><circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="24" cy="22" r="2" fill="currentColor" stroke="none" /></>;
    case "atomic-operations":
      return <><rect x="11" y="14" width="10" height="10" rx="1" /><path d="M13 14v-3a3 3 0 0 1 6 0v3" /></>;
    case "amdahl":
      return <><path d="M5 24c4-2 8-10 14-12 4-1 7 0 8 1" /><rect x="6" y="20" width="4" height="6" /><rect x="12" y="16" width="4" height="10" /><rect x="18" y="12" width="4" height="14" /></>;
    case "roofline":
      return <><path d="M5 26V6M5 26h22" /><path d="M5 20l10-10h12" /></>;
    case "cpi-ipc":
      return <><circle cx="16" cy="16" r="10" /><path d="M16 16l5-3" /><path d="M16 8v2M16 22v2M8 16h2M22 16h2" /></>;
    case "performance-counters":
      return <><rect x="4" y="6" width="24" height="16" rx="2" /><path d="M8 18l4-5 4 3 5-6" /><path d="M10 26h12" /></>;
    default:
      return <circle cx="16" cy="16" r="8" />;
  }
}
