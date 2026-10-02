export type VIconName = "link" | "focus" | "moon" | "sun" | "download" | "keyboard" | "check" | "chevron" | "copy" | "star" | "pin" | "close" | "image" | "zoomOut" | "cursor";

export function VIcon({ name, size = 14 }: { name: VIconName; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "link": return <svg {...props}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
    case "focus": return <svg {...props}><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>;
    case "moon": return <svg {...props}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
    case "sun": return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "download": return <svg {...props}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
    case "keyboard": return <svg {...props}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></svg>;
    case "check": return <svg {...props}><path d="m5 12 5 5 9-10" /></svg>;
    case "chevron": return <svg {...props}><path d="m7 10 5 5 5-5" /></svg>;
    case "copy": return <svg {...props}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>;
    case "star": return <svg {...props}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>;
    case "pin": return <svg {...props}><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" /></svg>;
    case "close": return <svg {...props}><path d="M6 6l12 12M18 6 6 18" /></svg>;
    case "image": return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>;
    case "zoomOut": return <svg {...props}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M8 11h6" /></svg>;
    case "cursor": return <svg {...props}><path d="M8 3v18M16 3v18" /></svg>;
  }
}
