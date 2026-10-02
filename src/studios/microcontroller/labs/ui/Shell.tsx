import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Lab, LabParams } from "../core/useLab";
import { LAB_META, groupLabel, labByNumber, labPath, type LabMeta } from "../registry";
import { Icon, type IconName } from "./Icon";

export interface ShellProps<P extends LabParams> {
  meta: LabMeta;
  lab: Lab<P>;
  subtitle: string;
  components?: string[];
  children: ReactNode;
  className?: string;
}

function LabSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hits = q.trim() ? LAB_META.filter((l) => `${l.n} ${l.title} ${l.section}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const go = (l: LabMeta) => { setQ(""); setOpen(false); navigate(labPath(l)); };
  return (
    <div className="mcl-search">
      <Icon name="search" />
      <input ref={input} value={q} placeholder="Search labs, components, or topics…" aria-label="Search labs"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) go(hits[0]); if (e.key === "Escape") { setOpen(false); input.current?.blur(); } }} />
      <kbd>Ctrl</kbd><kbd>K</kbd>
      {open && hits.length ? <ul className="mcl-search-results" role="listbox">{hits.map((l) => <li key={l.n}><button type="button" onMouseDown={() => go(l)}><b>{l.n}</b>{l.title}<small>{l.section}</small></button></li>)}</ul> : null}
    </div>
  );
}

function ComponentsPopover({ items, onClose }: { items: string[]; onClose: () => void }) {
  return (
    <div className="mcl-popover" role="dialog" aria-label="Components used in this lab">
      <header><b>Components in this lab</b><button type="button" onClick={onClose} aria-label="Close">×</button></header>
      <ul>{items.map((c) => <li key={c}>{c}</li>)}</ul>
    </div>
  );
}

function scrollToPanel(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("mcl-flash");
  window.setTimeout(() => el.classList.remove("mcl-flash"), 1200);
}

export function LabShell<P extends LabParams>({ meta, lab, subtitle, components = [], children, className = "" }: ShellProps<P>) {
  const [groupOpen, setGroupOpen] = useState(true);
  const [menu, setMenu] = useState(false);
  const [comps, setComps] = useState(false);
  const prev = labByNumber(meta.n - 1), next = labByNumber(meta.n + 1);
  const groupLabs = LAB_META.filter((l) => l.group === meta.group);
  const bench = meta.variant === "bench";
  const simulating = lab.running && lab.status !== "halted";

  useEffect(() => { document.title = `${meta.n}. ${meta.title} · Microcontroller Studio`; }, [meta]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "F5") { e.preventDefault(); lab.run(); }
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "F10") { e.preventDefault(); lab.step("over"); }
      if (e.key === "F11") { e.preventDefault(); lab.step("into"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lab]);

  const nav: Array<{ label: string; icon: IconName; to?: string; act?: () => void }> = bench
    ? [{ label: "Home", icon: "home", to: "/" }, { label: "Learn", icon: "book", act: () => scrollToPanel(".mcl-notes") }, { label: "Components", icon: "chip", act: () => setComps((v) => !v) }, { label: "Simulator", icon: "play", act: () => scrollToPanel(".mcl-sim") }]
    : [{ label: "Home", icon: "home", to: "/" }, { label: "My Projects", icon: "folder", to: "/studios/microcontroller/project/traffic-light-controller" }, { label: "Components", icon: "chip", act: () => setComps((v) => !v) }, { label: "Learn", icon: "book", act: () => scrollToPanel(".mcl-notes") }, { label: "All Labs", icon: "grid", to: "/studios/microcontroller" }];

  return (
    <div className={`mcl-root mcl-${meta.variant} ${className}`}>
      {!bench ? (
        <header className="mcl-appbar">
          <Link to="/studios/microcontroller" className="mcl-brand"><span className="mcl-brand-mark"><Icon name="chip" /></span><span><b>Microcontroller Studio</b><small>Learn · Build · Simulate · Create</small></span></Link>
          <LabSearch />
          <div className="mcl-appbar-right">
            <button type="button" className="mcl-icon-btn" title="Lab notes" aria-label="Open learning notes" onClick={() => scrollToPanel(".mcl-notes")}><Icon name="help" /></button>
            <span className={`mcl-run-dot mcl-${lab.status}`} title={`Simulation ${lab.status}`}>{lab.status}</span>
          </div>
        </header>
      ) : null}
      <div className="mcl-body">
        <aside className="mcl-side" aria-label="Microcontroller labs">
          {bench ? <Link to="/studios/microcontroller" className="mcl-side-brand"><Icon name="chip" /><span>Microcontroller<br />Studio</span></Link> : null}
          <nav className="mcl-side-nav">
            {nav.map((item) => item.to
              ? <Link key={item.label} to={item.to}><Icon name={item.icon} />{item.label}</Link>
              : <button key={item.label} type="button" onClick={item.act}><Icon name={item.icon} />{item.label}</button>)}
            {!bench ? <button type="button" className="mcl-side-series" aria-expanded={groupOpen} onClick={() => setGroupOpen((v) => !v)}><Icon name="layers" />Lab Series<Icon name={groupOpen ? "chevUp" : "chevDown"} /></button> : null}
          </nav>
          {comps ? <ComponentsPopover items={components.length ? components : ["MCU development board"]} onClose={() => setComps(false)} /> : null}
          {groupOpen ? (
            <div className="mcl-side-group">
              <h3>{groupLabel(meta.group)}</h3>
              {groupLabs.map((l) => (
                <Link key={l.n} to={labPath(l)} className={l.n === meta.n ? "active" : ""} aria-current={l.n === meta.n ? "page" : undefined}>
                  {!bench ? <span className="mcl-side-num">{l.n}</span> : null}<span>{bench ? `${l.n}. ` : ""}{l.title}</span>
                </Link>
              ))}
              <div className="mcl-side-groups">
                {[1, 2, 3, 4, 5, 6].filter((g) => g !== meta.group).map((g) => { const first = labByNumber(g * 10 - 9)!; return <Link key={g} to={labPath(first)}>{groupLabel(g)}</Link>; })}
              </div>
            </div>
          ) : null}
        </aside>
        <main className="mcl-main">
          <header className="mcl-head">
            <div className="mcl-head-text">
              <nav className="mcl-crumbs" aria-label="Breadcrumb">
                {bench ? <><Link to="/studios/microcontroller">Microcontroller Studio</Link><span>/</span><span>Core Labs</span><span>/</span><span>{meta.n}</span></>
                  : <><Link to={labPath(groupLabs[0]!)}>{groupLabel(meta.group)}</Link><Icon name="chevRight" /><span>{meta.n}. {meta.title}</span></>}
              </nav>
              <h1>{meta.n}. {meta.title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="mcl-actions">
              <button type="button" className="mcl-btn mcl-btn-run" onClick={() => lab.run()} title="Build and flash the code (F5)"><Icon name="play" />Run</button>
              <button type="button" className="mcl-btn" onClick={lab.resetSim} title="Restart the simulation with the current firmware"><Icon name="reset" />Reset</button>
              <button type="button" className={`mcl-btn ${simulating ? "mcl-btn-live" : ""}`} onClick={lab.toggle} aria-pressed={simulating} title="Pause or resume simulated time">
                <Icon name={simulating ? "pause" : "sim"} />{simulating ? "Pause" : "Simulate"}
              </button>
              <button type="button" className="mcl-btn" onClick={lab.save} title="Save code and settings in this browser"><Icon name="save" />Save</button>
              <div className="mcl-menu-wrap">
                <button type="button" className="mcl-btn mcl-btn-icon" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Icon name="more" /></button>
                {menu ? (
                  <div className="mcl-menu" role="menu" onMouseLeave={() => setMenu(false)}>
                    <button type="button" role="menuitem" onClick={() => { lab.step("into"); setMenu(false); }}>Step into <kbd>F11</kbd></button>
                    <button type="button" role="menuitem" onClick={() => { lab.step("over"); setMenu(false); }}>Step over <kbd>F10</kbd></button>
                    <button type="button" role="menuitem" onClick={() => { lab.step("out"); setMenu(false); }}>Step out</button>
                    <label className="mcl-menu-speed">Speed
                      <select value={lab.speed} onChange={(e) => lab.setSpeed(Number(e.target.value))}>
                        {[0.001, 0.01, 0.1, 0.25, 0.5, 1, 2, 5].map((s) => <option key={s} value={s}>{s < 1 ? `${s}×` : `${s}×`}</option>)}
                      </select>
                    </label>
                    <button type="button" role="menuitem" onClick={() => { void navigator.clipboard?.writeText(lab.code); lab.setNotice("Code copied to the clipboard."); setMenu(false); }}>Copy code</button>
                    <button type="button" role="menuitem" className="mcl-danger" onClick={() => { lab.resetLab(); setMenu(false); }}>Reset lab to defaults</button>
                    <hr />
                    {prev ? <Link role="menuitem" to={labPath(prev)} onClick={() => setMenu(false)}>← {prev.n}. {prev.title}</Link> : null}
                    {next ? <Link role="menuitem" to={labPath(next)} onClick={() => setMenu(false)}>{next.n}. {next.title} →</Link> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          {lab.notice ? <div className="mcl-toast" role="status">{lab.notice}</div> : null}
          {children}
          <footer className="mcl-foot">
            {prev ? <Link to={labPath(prev)}>← {prev.n}. {prev.title}</Link> : <span />}
            <span>Sim time {fmtTime(lab.mcu.time)} · {lab.status}{lab.speed !== 1 ? ` · ${lab.speed}×` : ""}{lab.running && lab.realtime < 0.95 ? ` · ${(lab.realtime * 100).toFixed(0)}% real-time` : ""}</span>
            {next ? <Link to={labPath(next)}>{next.n}. {next.title} →</Link> : <span />}
          </footer>
        </main>
      </div>
    </div>
  );
}

export function fmtTime(s: number) {
  if (s < 1e-3) return `${(s * 1e6).toFixed(0)} µs`;
  if (s < 1) return `${(s * 1e3).toFixed(1)} ms`;
  if (s < 120) return `${s.toFixed(2)} s`;
  return `${Math.floor(s / 60)} m ${(s % 60).toFixed(0)} s`;
}
