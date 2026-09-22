type IconName = "home" | "path" | "grid" | "practice" | "project" | "sheet" | "people" | "search" | "bell" | "back" | "bolt" | "book" | "gate" | "table" | "map" | "reset" | "info" | "play" | "pause" | "step";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home": return <svg {...props}><path d="M4 11.5 12 4l8 7.5V20H4z" /><path d="M9 20v-6h6v6" /></svg>;
    case "path": return <svg {...props}><path d="M5 19c4-1 4-5 8-6s4-5 6-6" /><circle cx="5" cy="19" r="1.4" fill="currentColor" /><circle cx="19" cy="7" r="1.4" fill="currentColor" /></svg>;
    case "grid": return <svg {...props}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>;
    case "practice": return <svg {...props}><path d="M8 4h8v4H8zM6 8h12v12H6z" /><path d="M9 13h6M9 16h4" /></svg>;
    case "project": return <svg {...props}><path d="M4 8h16v11H4zM8 8V5h8v3" /></svg>;
    case "sheet": return <svg {...props}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
    case "people": return <svg {...props}><circle cx="9" cy="9" r="3" /><circle cx="16" cy="10" r="2.2" /><path d="M4 19c1-3 3-4.5 5-4.5S13 16 14 19M14 19c.4-2 1.6-3.2 3.2-3.2 1.5 0 2.6.8 3.3 2.2" /></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
    case "bell": return <svg {...props}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5zM10 19a2 2 0 0 0 4 0" /></svg>;
    case "back": return <svg {...props}><path d="M15 6 9 12l6 6" /></svg>;
    case "bolt": return <svg {...props}><path d="M13 3 6 13h5l-1 8 8-12h-5z" /></svg>;
    case "book": return <svg {...props}><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" /><path d="M5 5.5A2.5 2.5 0 0 1 7.5 8H19" /></svg>;
    case "gate": return <svg {...props}><path d="M5 7h6a5 5 0 0 1 0 10H5zM4 7v10M16 12h4" /></svg>;
    case "table": return <svg {...props}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M10 10v9" /></svg>;
    case "map": return <svg {...props}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>;
    case "reset": return <svg {...props}><path d="M20 12a8 8 0 1 1-2.2-5.5" /><path d="M20 4v5h-5" /></svg>;
    case "info": return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg>;
    case "play": return <svg {...props}><path d="m8 6 10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
    case "pause": return <svg {...props}><path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none" /></svg>;
    case "step": return <svg {...props}><path d="m7 6 7 6-7 6zM16 6v12" /></svg>;
    default: return null;
  }
}

export type { IconName };
