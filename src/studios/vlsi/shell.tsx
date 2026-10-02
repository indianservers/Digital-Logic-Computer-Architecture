import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { VLSI_CATEGORIES, VLSI_HOME, implementedVlsiLabs, vlsiNeighbors, vlsiRoute, type VlsiLabMeta } from "../../data/vlsiLabs";
import { CATEGORY_COLOR, MODEL_LIMITS, PRESETS, labMatches, type Preset } from "./content";
import { downloadPng, largestSvg } from "./exporting";
import { LabCheck, PathBar, PredictCard, RelatedLinks, pathRoute } from "./learning";
import { LabRuntime, RuntimeContext, RuntimeStateContext, type RuntimeState, type Snapshot } from "./runtime";
import { labStatus, useUserPresets, useVlsiProgress, useVlsiTheme, visitLab } from "./store";
import { VIcon } from "./vlsiIcons";
import { useMedia } from "./widgets";

const SHORTCUTS: Array<[string, string]> = [
  ["[ and ]", "Previous and next lab"],
  ["R", "Reset the lab (undo appears for a few seconds)"],
  ["Space", "Play or pause the simulation"],
  [".", "Step the simulation"],
  ["/", "Open the lab switcher"],
  ["F", "Toggle focus mode"],
  ["T", "Toggle dark theme"],
  ["?", "Show this list"],
  ["Shift + arrows", "Move a focused slider 10 steps"],
  ["Double-click a slider label", "Reset that one control"],
  ["Esc", "Close dialogs or leave focus mode"],
];

function LabSwitcher({ current, onClose, pathId }: { current: string; onClose: () => void; pathId: string | null }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const progress = useVlsiProgress();
  const results = useMemo(() => implementedVlsiLabs().filter((lab) => labMatches(lab, query)), [query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const open = (lab: VlsiLabMeta | undefined) => {
    if (!lab) return;
    onClose();
    navigate(pathId ? pathRoute(lab.slug, pathId) : vlsiRoute(lab.slug));
  };
  return (
    <div className="vlsi-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="vlsi-dialog vlsi-switcher" role="dialog" aria-modal="true" aria-label="Switch lab">
        <input
          autoFocus
          value={query}
          placeholder={`Search ${implementedVlsiLabs().length} labs by name, topic, or number`}
          aria-label="Search labs"
          aria-controls="vlsi-switch-list"
          aria-activedescendant={results[active] ? `vlsi-switch-${results[active].slug}` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
            if (event.key === "Enter") open(results[active]);
            if (event.key === "Escape") onClose();
          }}
        />
        <ul id="vlsi-switch-list" role="listbox" ref={listRef}>
          {results.map((lab, index) => (
            <li
              key={lab.slug}
              id={`vlsi-switch-${lab.slug}`}
              role="option"
              aria-selected={index === active}
              data-index={index}
              className={`${index === active ? "active" : ""}${lab.slug === current ? " current" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => open(lab)}
            >
              <i style={{ background: CATEGORY_COLOR[lab.category] }} />
              <span>Lab {lab.number}</span>
              <b>{lab.title}</b>
              <small>{VLSI_CATEGORIES.find((item) => item.id === lab.category)?.title}{labStatus(progress, lab.slug) === "done" ? " · done" : ""}</small>
            </li>
          ))}
          {results.length === 0 ? <li className="empty">No lab matches “{query}”.</li> : null}
        </ul>
      </div>
    </div>
  );
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="vlsi-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="vlsi-dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="vlsi-dialog-head">
          <h2>Keyboard shortcuts</h2>
          <button type="button" className="vlsi-icon-btn" autoFocus aria-label="Close" onClick={onClose}><VIcon name="close" /></button>
        </div>
        <dl className="vlsi-keys">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function PresetMenu({ slug, runtime, onClose }: { slug: string; runtime: LabRuntime; onClose: () => void }) {
  const builtIn = PRESETS[slug] ?? [];
  const user = useUserPresets(slug);
  const [name, setName] = useState("");
  const apply = (preset: Preset) => {
    runtime.apply(preset.values);
    onClose();
  };
  return (
    <div className="vlsi-menu" role="menu" aria-label="Presets">
      <button type="button" role="menuitem" onClick={() => apply({ name: "Default", values: Object.fromEntries(runtime.entries().map((entry) => [entry.key, entry.initial])) })}>Default settings</button>
      {builtIn.map((preset) => <button key={preset.name} type="button" role="menuitem" onClick={() => apply(preset)}>{preset.name}</button>)}
      {user.list.length ? <p className="vlsi-menu-label">Your setups</p> : null}
      {user.list.map((preset) => (
        <div key={preset.name} className="vlsi-menu-row">
          <button type="button" role="menuitem" onClick={() => apply(preset)}>{preset.name}</button>
          <button type="button" className="vlsi-icon-btn" aria-label={`Delete ${preset.name}`} onClick={() => user.remove(preset.name)}><VIcon name="close" size={12} /></button>
        </div>
      ))}
      <form className="vlsi-menu-save" onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        user.save({ name: trimmed, values: runtime.snapshot() });
        setName("");
      }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name this setup" aria-label="Preset name" />
        <button type="submit" disabled={!name.trim()}>Save</button>
      </form>
    </div>
  );
}

export function VlsiFrame({ lab, children }: { lab: VlsiLabMeta; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<RuntimeState>({ version: 0, interacted: false, playing: false });
  const [announce, setAnnounce] = useState("");
  const [undo, setUndo] = useState<Snapshot | null>(null);
  const [focus, setFocus] = useState(false);
  const [help, setHelp] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const [tab, setTab] = useState<"controls" | "readings">("controls");
  const narrow = useMedia("(max-width: 800px)");
  const [theme, toggleTheme] = useVlsiTheme();
  const progress = useVlsiProgress();
  const initialSearch = useRef(location.search).current;
  const pathId = useMemo(() => new URLSearchParams(initialSearch).get("path"), [initialSearch]);
  const { previous, next, index } = vlsiNeighbors(lab.slug);
  const total = implementedVlsiLabs().length;
  const count = index >= 0 ? index + 1 : lab.number;
  const category = VLSI_CATEGORIES.find((item) => item.id === lab.category);
  const status = labStatus(progress, lab.slug);

  const timers = useRef({ frame: 0, url: 0, announce: 0, flash: 0 });
  const pending = useRef(new Map<string, string>());
  const seen = useRef(new Set<string>());
  const runtimeRef = useRef<LabRuntime | null>(null);
  const scheduleRef = useRef<() => void>(() => undefined);
  const measureRef = useRef<(label: string, text: string) => void>(() => undefined);

  const writeUrl = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const params = runtime.toParams();
    if (pathId) params.set("path", pathId);
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", url);
  };

  scheduleRef.current = () => {
    window.cancelAnimationFrame(timers.current.frame);
    timers.current.frame = window.requestAnimationFrame(() => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      setState((prev) => ({ version: prev.version + 1, interacted: runtime.interacted, playing: runtime.isPlaying() }));
    });
    window.clearTimeout(timers.current.url);
    timers.current.url = window.setTimeout(writeUrl, 300);
  };

  measureRef.current = (label, text) => {
    if (!seen.current.has(label)) {
      seen.current.add(label);
      return;
    }
    if (runtimeRef.current?.isPlaying()) return;
    pending.current.set(label, text);
    window.clearTimeout(timers.current.announce);
    timers.current.announce = window.setTimeout(() => {
      const parts = [...pending.current.entries()].slice(0, 4).map(([name, value]) => `${name} ${value}`);
      pending.current.clear();
      setAnnounce(parts.join(". "));
    }, 900);
  };

  if (!runtimeRef.current) {
    runtimeRef.current = new LabRuntime(lab.slug, () => scheduleRef.current(), (label, text) => measureRef.current(label, text));
  }
  const runtime = runtimeRef.current;

  useEffect(() => {
    runtime.applyParams(new URLSearchParams(initialSearch));
    visitLab(lab.slug);
    const handles = timers.current;
    return () => {
      window.cancelAnimationFrame(handles.frame);
      window.clearTimeout(handles.url);
      window.clearTimeout(handles.announce);
      window.clearTimeout(handles.flash);
    };
  }, [runtime, initialSearch, lab.slug]);

  useEffect(() => {
    if (!undo) return undefined;
    const id = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(id);
  }, [undo]);

  const say = (message: string) => {
    setFlash(message);
    window.clearTimeout(timers.current.flash);
    timers.current.flash = window.setTimeout(() => setFlash(""), 2200);
  };

  const reset = () => {
    const snapshot = runtime.snapshot();
    const changed = runtime.changedCount();
    runtime.interacted = false;
    runtime.linked.clear();
    setUndo(changed > 0 ? snapshot : null);
    setNonce((value) => value + 1);
  };

  const exportImage = () => {
    const svg = largestSvg(rootRef.current?.querySelector(".vlsi-stage") ?? rootRef.current);
    if (!svg) {
      say("This lab has no diagram to export.");
      return;
    }
    downloadPng(svg, `vlsi-${lab.slug}.png`);
    say("Image saved.");
  };

  const copyLink = () => {
    writeUrl();
    const done = () => say("Link with the current settings copied.");
    if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).then(done, () => say("Copy failed. The address bar has the link."));
    else say("The address bar has a link with the current settings.");
  };

  const keyRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);
    if (event.key === "Escape") {
      if (switcher || help || presetsOpen) {
        setSwitcher(false);
        setHelp(false);
        setPresetsOpen(false);
      } else if (focus) {
        setFocus(false);
      }
      return;
    }
    if (typing || switcher || help) return;
    const onControl = tag === "BUTTON" || tag === "A" || tag === "SUMMARY";
    switch (event.key) {
      case "[":
        if (previous) navigate(pathId ? pathRoute(previous.slug, pathId) : vlsiRoute(previous.slug));
        break;
      case "]":
        if (next) navigate(pathId ? pathRoute(next.slug, pathId) : vlsiRoute(next.slug));
        break;
      case "r":
      case "R":
        reset();
        break;
      case " ":
        if (onControl) return;
        if (runtime.togglePlay()) event.preventDefault();
        break;
      case ".":
        runtime.step();
        break;
      case "/":
        event.preventDefault();
        setSwitcher(true);
        break;
      case "f":
      case "F":
        setFocus((value) => !value);
        break;
      case "t":
      case "T":
        toggleTheme();
        break;
      case "?":
        setHelp(true);
        break;
      default:
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changed = runtime.changedCount();
  const neighborRoute = (item: VlsiLabMeta) => (pathId ? pathRoute(item.slug, pathId) : vlsiRoute(item.slug));

  return (
    <RuntimeContext.Provider value={runtime}>
      <RuntimeStateContext.Provider value={state}>
        <div
          ref={rootRef}
          className={`vlsi vlsi-lab${focus ? " is-focus" : ""}`}
          data-theme={theme}
          data-tab={narrow ? tab : undefined}
          style={{ ["--cat" as string]: CATEGORY_COLOR[lab.category] }}
        >
          <nav className="vlsi-crumbs" aria-label="Breadcrumb">
            <Link to={VLSI_HOME}>VLSI Studio</Link>
            <span aria-hidden="true">›</span>
            <Link to={`${VLSI_HOME}#cat-${lab.category}`}>{category?.title ?? lab.category}</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{lab.title}</span>
          </nav>
          <header className="vlsi-bar">
            <Link to={VLSI_HOME} className="vlsi-home-link"><Icon name="back" size={14} />VLSI Studio</Link>
            <div className="vlsi-title">
              <p><i className="vlsi-cat-dot" />Lab {lab.number} · {count} of {total} open labs</p>
              <div className="vlsi-title-row">
                <h1>{lab.title}</h1>
                <button type="button" className="vlsi-switch-btn" aria-haspopup="dialog" aria-expanded={switcher} title="Switch lab (/)" onClick={() => setSwitcher(true)}>
                  Switch lab<VIcon name="chevron" />
                </button>
              </div>
            </div>
            <div className="vlsi-nav">
              {previous ? (
                <Link to={neighborRoute(previous)} className="vlsi-neighbor" title="Previous lab ([)">
                  <small>← Previous</small><span>{previous.title}</span>
                </Link>
              ) : <span />}
              {next ? (
                <Link to={neighborRoute(next)} className="vlsi-neighbor next" title="Next lab (])">
                  <small>Next →</small><span>{next.title}</span>
                </Link>
              ) : null}
            </div>
          </header>

          <div className="vlsi-toolbar" role="toolbar" aria-label="Lab tools">
            <button type="button" onClick={reset} title="Reset (R)"><Icon name="reset" size={14} />Reset</button>
            <span className="vlsi-menu-anchor">
              <button type="button" aria-haspopup="menu" aria-expanded={presetsOpen} onClick={() => setPresetsOpen((value) => !value)} disabled={runtime.entries().length === 0}>
                <VIcon name="star" />Presets<VIcon name="chevron" size={12} />
              </button>
              {presetsOpen ? <PresetMenu slug={lab.slug} runtime={runtime} onClose={() => setPresetsOpen(false)} /> : null}
            </span>
            <button type="button" onClick={copyLink} title="Copy a link that reopens these exact settings"><VIcon name="copy" />Copy link</button>
            <button type="button" onClick={exportImage} title="Save the main diagram as PNG"><VIcon name="image" />Save image</button>
            <button type="button" aria-pressed={focus} onClick={() => setFocus((value) => !value)} title="Focus mode (F)"><VIcon name="focus" />{focus ? "Exit focus" : "Focus"}</button>
            <button type="button" aria-pressed={theme === "dark"} onClick={toggleTheme} title="Theme (T)"><VIcon name={theme === "dark" ? "sun" : "moon"} />{theme === "dark" ? "Light" : "Dark"}</button>
            <button type="button" onClick={() => setHelp(true)} title="Keyboard shortcuts (?)"><VIcon name="keyboard" />Shortcuts</button>
            {flash ? <span className="vlsi-flash" role="status">{flash}</span> : null}
          </div>

          <div className="vlsi-status">
            <span className={`vlsi-dot${state.playing ? " run" : changed ? " mod" : ""}`} aria-hidden="true" />
            <span>
              {state.playing ? "Running" : runtime.hasPlayer() ? "Paused" : "Live"}
              {" · "}
              {changed ? `${changed} control${changed === 1 ? "" : "s"} changed from default` : "Default settings"}
              {" · "}{lab.difficulty} · about {lab.minutes} min
              {status === "done" ? " · completed" : ""}
            </span>
            <details className="vlsi-limits">
              <summary><Icon name="info" size={13} />Educational compact model</summary>
              <div>
                <p>The numbers here come from simplified models meant for intuition:</p>
                <ul>{MODEL_LIMITS.map((item) => <li key={item}>{item}</li>)}</ul>
                {lab.reuse ? <p><b>This lab reuses:</b> {lab.reuse}</p> : null}
              </div>
            </details>
          </div>

          <PathBar pathId={pathId} slug={lab.slug} />
          <PredictCard slug={lab.slug} />

          {narrow ? (
            <div className="vlsi-tabs" role="tablist" aria-label="Lab panels">
              <button type="button" role="tab" aria-selected={tab === "controls"} onClick={() => setTab("controls")}>Controls</button>
              <button type="button" role="tab" aria-selected={tab === "readings"} onClick={() => setTab("readings")}>Readings</button>
            </div>
          ) : null}

          <div key={nonce} className="vlsi-lab-body">{children}</div>

          <LabCheck key={`check-${nonce}`} slug={lab.slug} runtime={runtime} />
          <RelatedLinks lab={lab} />

          {undo ? (
            <div className="vlsi-toast" role="status">
              Lab reset to defaults.
              <button type="button" onClick={() => { runtime.apply(undo); setUndo(null); }}>Undo</button>
              <button type="button" className="vlsi-icon-btn" aria-label="Dismiss" onClick={() => setUndo(null)}><VIcon name="close" size={12} /></button>
            </div>
          ) : null}
          <p className="vlsi-sr" aria-live="polite">{announce}</p>
          {switcher ? <LabSwitcher current={lab.slug} pathId={pathId} onClose={() => setSwitcher(false)} /> : null}
          {help ? <ShortcutHelp onClose={() => setHelp(false)} /> : null}
        </div>
      </RuntimeStateContext.Provider>
    </RuntimeContext.Provider>
  );
}

export function VlsiGrid({ controls, stage, readouts, footer }: { controls: ReactNode; stage: ReactNode; readouts: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="vlsi-grid">
        <aside className="vlsi-panel">{controls}</aside>
        <section className="vlsi-stage">{stage}</section>
        <aside className="vlsi-panel vlsi-read">{readouts}</aside>
      </div>
      {footer ? <div className="vlsi-panel vlsi-footer">{footer}</div> : null}
    </>
  );
}