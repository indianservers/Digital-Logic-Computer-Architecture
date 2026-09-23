import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { STUDIOS, searchStudios } from "../data/curriculum";
import { PRACTICE_COUNT } from "../pages/HomePages";
import { Icon } from "../design-system/icons";
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

function crumbTitle(pathname: string, search: string): string {
  const page = LINKS.find((link) => link.to === pathname);
  if (page) return page.label;
  const tab = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("tab");
  const matches = STUDIOS.filter((item) => {
    const base = pathOnly(item.path);
    return base !== "/" && pathname.startsWith(base);
  }).sort((a, b) => pathOnly(b.path).length - pathOnly(a.path).length);
  if (pathname === "/studios/isa" && tab === "modes") {
    return STUDIOS.find((item) => item.id === "addressing")?.title ?? "Addressing Modes";
  }
  return matches[0]?.title ?? "Studios";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { prefs, update } = usePrefs();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => searchStudios(query), [query]);
  const architecture = location.pathname.startsWith("/architecture");
  const links = architecture ? LINKS.filter((link) => link.to === "/") : LINKS;
  const crumb = crumbTitle(location.pathname, location.search);
  const done = prefs.challenges.length;

  useEffect(() => {
    update({ lastPath: `${location.pathname}${location.search}` });
    setOpen(false);
    setQuery("");
  }, [location.pathname, location.search, update]);

  return (
    <div className="app-shell">
      {open ? <button className="drawer-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link to="/" className="brand">
          <span className="brand-mark"><Icon name="bolt" size={18} /></span>
          <span><strong>LogicLab</strong><span>Learn · Build · Think</span></span>
        </Link>
        <nav className="nav-group">
          {links.map((link) => (
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
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setOpen(true)}><Icon name="grid" /></button>
          <div className="crumbs">
            <Link to="/">Digital Logic & Computer Architecture</Link>
            <span>›</span>
            <span>{crumb}</span>
          </div>
          <div className="search">
            <Icon name="search" size={16} />
            <input aria-label="Search topics" placeholder="Search topics, e.g. two's complement" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && hits[0]) navigate(hits[0].path);
            }} />
            {query && hits.length > 0 ? (
              <div className="search-pop">
                {hits.map((hit) => (
                  <button key={hit.id} onClick={() => navigate(hit.path)}>{hit.title}<div className="tiny">{hit.active ? `Phase ${hit.phase}` : `Phase ${hit.phase} · upcoming`}</div></button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="top-meta">
            <span className="pill progress">Practice {Math.min(prefs.challenges.length, PRACTICE_COUNT)} / {PRACTICE_COUNT}</span>
            <span className="pill ok">Offline Ready</span>
            <button className="icon-btn" aria-label="Notifications are stored on this device" title="Saved locally"><Icon name="bell" size={16} /></button>
            <span className="avatar" aria-hidden="true">S</span>
          </div>
        </header>
        <main className="page"><ErrorBoundary>{children}</ErrorBoundary></main>
      </div>
    </div>
  );
}
