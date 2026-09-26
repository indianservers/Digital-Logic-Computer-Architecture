import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { STUDIOS, searchStudios } from "../data/curriculum";
import { PRACTICE_COUNT } from "../pages/HomePages";
import { Icon } from "../design-system/icons";
import { Toggle } from "../design-system/ui";
import { usePrefs } from "../store/prefs";
import { ErrorBoundary } from "./ErrorBoundary";

const LINKS = [
  { to: "/", label: "Home", icon: "home" as const, end: true },
  { to: "/learn", label: "Learning Path", icon: "path" as const, end: false },
  { to: "/studios", label: "Studios", icon: "grid" as const, end: false },
  { to: "/practice", label: "Practice", icon: "practice" as const, end: false },
  { to: "/projects", label: "Projects", icon: "project" as const, end: false },
  { to: "/cheat-sheet", label: "Cheat Sheet", icon: "sheet" as const, end: false },
  { to: "/notes", label: "Notes", icon: "people" as const, end: false },
];

function pathOnly(path: string): string {
  return path.split("?")[0] ?? path;
}

function readableSlug(slug: string): string {
  return slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function crumbTrail(pathname: string, search: string): Array<{ label: string; to?: string }> {
  if (pathname === "/") return [{ label: "Home" }];
  const trail: Array<{ label: string; to?: string }> = [{ label: "Home", to: "/" }];
  const page = LINKS.find((link) => link.to === pathname);
  if (page) {
    trail.push({ label: page.label });
    return trail;
  }
  const tab = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("tab");
  const matches = STUDIOS.filter((item) => {
    const base = pathOnly(item.path);
    return base !== "/" && (pathname === base || pathname.startsWith(`${base}/`));
  }).sort((a, b) => pathOnly(b.path).length - pathOnly(a.path).length);
  const studio = matches[0];
  if (!studio) {
    trail.push({ label: "Studios", to: "/studios" });
    return trail;
  }
  trail.push({ label: "Studios", to: "/studios" });
  const base = pathOnly(studio.path);
  const rest = pathname.slice(base.length).split("/").filter(Boolean);
  if (pathname === "/studios/isa" && tab === "modes") {
    trail.push({ label: studio.title, to: base });
    trail.push({ label: STUDIOS.find((item) => item.id === "addressing")?.title ?? "Addressing Modes" });
    return trail;
  }
  if (rest.length === 0) {
    trail.push({ label: studio.title });
    return trail;
  }
  trail.push({ label: studio.title, to: base });
  const last = rest[rest.length - 1] ?? studio.title;
  trail.push({ label: readableSlug(last) });
  return trail;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { prefs, update, noteVisit } = usePrefs();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => searchStudios(query), [query]);
  const aca = location.pathname.startsWith("/studios/advanced-computer-architecture");
  const gates = location.pathname.startsWith("/studios/logic-gates");
  const truth = location.pathname.startsWith("/studios/truth-tables");
  const combo = location.pathname.startsWith("/studios/combinational");
  const studioChrome = gates || truth || combo;
  const home = location.pathname === "/";
  const crumbs = crumbTrail(location.pathname, location.search);
  const done = prefs.challenges.length;

  useEffect(() => {
    noteVisit(`${location.pathname}${location.search}`);
    setOpen(false);
    setQuery("");
  }, [location.pathname, location.search, noteVisit]);

  if (aca) {
    return (
      <div className="app-shell aca-bleed">
        <main className="page"><ErrorBoundary>{children}</ErrorBoundary></main>
      </div>
    );
  }

  return (
    <div className={home ? "app-shell" : "app-shell no-app-menu"}>
      {home && open ? <button className="drawer-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      {home ? <aside className={open ? "sidebar open" : "sidebar"}>
        <Link to="/" className="brand">
          <span className="brand-mark"><Icon name="bolt" size={18} /></span>
          <span><strong>LogicLab</strong><span>Learn · Build · Think</span></span>
        </Link>
        <nav className="nav-group">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              <Icon name={link.icon} size={16} /> {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-label">MY LEARNING</div>
        <div className="card" style={{ padding: 10 }}>
          <div className="spread tiny"><span>Progress</span><b>{Math.min(100, Math.round((done / PRACTICE_COUNT) * 100))}%</b></div>
          <div className="progress-bar" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, Math.round((done / PRACTICE_COUNT) * 100))}%` }} /></div>
          <div className="spread" style={{ marginTop: 8 }}><span className="tiny">Badges</span><b>{prefs.badges.length}</b></div>
        </div>
        <div className="sidebar-card">
          <p>Think in Logic.</p>
          <span>Build what’s next.</span>
          <svg className="hills" width="120" height="48" viewBox="0 0 120 48" aria-hidden="true">
            <path d="M0 40 L20 22 L36 34 L58 12 L80 30 L120 8 V48 H0 Z" fill="white" />
          </svg>
        </div>
      </aside> : null}
      <div className="workspace">
        <header className="topbar">
          {home ? <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setOpen(true)}><Icon name="grid" /></button> : null}
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="crumbs-part">
                {index > 0 ? <span aria-hidden="true">›</span> : null}
                {item.to ? <Link to={item.to}>{item.label}</Link> : <span className="current">{item.label}</span>}
              </span>
            ))}
          </nav>
          <div className="search">
            <Icon name="search" size={16} />
            <input aria-label="Search topics" placeholder={gates ? "Search topics, e.g. \"K-map for 3 variables\"..." : truth ? "Search topics, e.g. \"Karnaugh map\"..." : combo ? "Search topics, e.g. \"multiplexer\" or \"Boolean algebra\"..." : location.pathname.startsWith("/architecture/compare") ? "Search topics, e.g. RISC-V registers, ARM encoding..." : location.pathname.startsWith("/architecture/mobile") ? "Search topics, e.g. GPU, NPU, thermal, camera..." : location.pathname.startsWith("/architecture/desktop") ? "Search topics, e.g. cache, DDR, PCIe, boost..." : "Search topics, e.g. two's complement"} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && hits[0]?.active) navigate(hits[0].path);
            }} />
            {query && hits.length > 0 ? (
              <div className="search-pop">
                {hits.map((hit) => (
                  <button key={hit.id} type="button" disabled={!hit.active} onClick={() => { if (hit.active) navigate(hit.path); }}>{hit.title}<div className="tiny">{hit.active ? `Phase ${hit.phase}` : `Phase ${hit.phase} · upcoming`}</div></button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="top-meta">
            {studioChrome ? (
              <span className="pill progress">Studio Progress {Math.min(prefs.challenges.length, 12)} / 12</span>
            ) : (
              <span className="pill progress">Practice {Math.min(prefs.challenges.length, PRACTICE_COUNT)} / {PRACTICE_COUNT}</span>
            )}
            {studioChrome ? null : <Toggle on={prefs.explain} onChange={(next) => update({ explain: next })} label="Explain" tone="primary" />}
            <span className="pill ok">{gates ? "Online Ready" : "Offline Ready"}</span>
            <button className="icon-btn" aria-label="Notifications are stored on this device" title="Saved locally"><Icon name="bell" size={16} /></button>
            <span className="avatar" aria-hidden="true">S</span>
          </div>
        </header>
        <main className="page"><ErrorBoundary>{children}</ErrorBoundary></main>
      </div>
    </div>
  );
}
