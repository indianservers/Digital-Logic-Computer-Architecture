import { useEffect, useState } from "react";
import { DRAG_THRESHOLD } from "./interact";
import { componentTruth, getComponent, listComponents, matchesComponent, PALETTE_CATEGORIES } from "./registry";
import { ComponentGlyph } from "./symbols";
import type { ComponentSpec } from "./types";
import type { CircuitSession } from "./useCircuit";

const OPEN_KEY = "logiclab.palette.open.v1";
const MODE_KEY = "logiclab.palette.mode.v1";

const SECTIONS: Array<{ id: (typeof PALETTE_CATEGORIES)[number]; label: string }> = [
  { id: "inputs", label: "Inputs" },
  { id: "outputs", label: "Outputs" },
  { id: "basic", label: "Basic Gates" },
  { id: "universal", label: "Universal Gates" },
  { id: "special", label: "Compound Gates" },
  { id: "arithmetic", label: "Arithmetic" },
  { id: "multiplexing", label: "Multiplexing" },
  { id: "sequential", label: "Sequential Logic" },
  { id: "timing", label: "Timing & Clock" },
  { id: "probes", label: "Probes & Measurement" },
];

const DEFAULT_OPEN = new Set(["inputs", "outputs", "basic"]);

type Mode = "full" | "compact" | "hidden";
type Menu = { type: string; x: number; y: number };
type Doc = { type: string };

function readOpen(): Record<string, boolean> {
  try {
    const parsed = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "");
    return parsed && typeof parsed === "object" ? parsed as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

function beginPaletteDrag(event: React.PointerEvent, type: string) {
  if (event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  let moved = false;
  const handle = event.currentTarget;
  try { handle.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
  const move = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD) moved = true;
    if (moved) window.dispatchEvent(new CustomEvent("cwb-palette", { detail: { phase: "move", type, x: ev.clientX, y: ev.clientY } }));
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    try { handle.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
    paletteMoved = moved;
    if (moved) window.dispatchEvent(new CustomEvent("cwb-palette", { detail: { phase: "up", type, x: ev.clientX, y: ev.clientY } }));
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

let paletteMoved = false;

export function PalettePanel({ circuit, categories = [...PALETTE_CATEGORIES] }: { circuit: CircuitSession; categories?: string[] }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) === "compact" || localStorage.getItem(MODE_KEY) === "hidden" ? localStorage.getItem(MODE_KEY) as Mode : "full"));
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const items = listComponents(categories).filter((spec) => matchesComponent(spec, query));
  const searching = query.trim().length > 0;

  useEffect(() => localStorage.setItem(MODE_KEY, mode), [mode]);
  useEffect(() => localStorage.setItem(OPEN_KEY, JSON.stringify(open)), [open]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "[") setMode((value) => (value === "full" ? "compact" : value === "compact" ? "hidden" : "full"));
      if (event.key === "Escape") setMenu(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function arm(type: string, multiple = false) {
    circuit.setRepeat(multiple);
    circuit.setArmed(type);
  }

  function placeCenter(type: string) {
    window.dispatchEvent(new CustomEvent("cwb-place-center", { detail: { type } }));
  }

  const documented = doc ? getComponent(doc.type) : undefined;
  const truth = doc ? componentTruth(doc.type) : null;

  return (
    <section className={`lgx-card cwb-pal ${mode}`} data-palette="true" onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} onClick={() => setMenu(null)}>
      <div className="lgx-card-bar">
        {mode === "hidden" ? null : <h3><i>1</i> Components</h3>}
        <button className="lgx-tool" type="button" aria-label={mode === "hidden" ? "Expand palette" : mode === "compact" ? "Hide palette" : "Compact palette"} title="Palette size. [ cycles full, compact, and hidden." onClick={(event) => { event.stopPropagation(); setMode((value) => (value === "full" ? "compact" : value === "compact" ? "hidden" : "full")); }}>{mode === "hidden" ? "»" : "‹"}</button>
      </div>
      {mode === "hidden" ? null : (
        <>
          <label className="lgx-search">
            <input aria-label="Search components" placeholder="Search components..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {circuit.favorites.length > 0 ? (
            <Shelf title="Favorites" items={circuit.favorites.map((type) => getComponent(type)).filter((spec): spec is ComponentSpec => !!spec && matchesComponent(spec, query))} circuit={circuit} onArm={arm} onCenter={placeCenter} onMenu={setMenu} onDoc={setDoc} />
          ) : null}
          {circuit.recent.length > 0 ? (
            <Shelf title="Recently used" items={circuit.recent.map((type) => getComponent(type)).filter((spec): spec is ComponentSpec => !!spec && spec.listed !== false && matchesComponent(spec, query))} circuit={circuit} onArm={arm} onCenter={placeCenter} onMenu={setMenu} onDoc={setDoc} />
          ) : null}
          <div className="cwb-scroll">
            {SECTIONS.filter((section) => categories.includes(section.id)).map((section) => {
              const group = items.filter((spec) => spec.category === section.id);
              if (group.length === 0) return null;
              const expanded = searching || (open[section.id] ?? DEFAULT_OPEN.has(section.id));
              return (
                <div key={section.id} className="cwb-cat">
                  <button type="button" className="cwb-cat-bar" aria-expanded={expanded} onClick={() => setOpen((value) => ({ ...value, [section.id]: !expanded }))}>
                    <ComponentGlyph type={group[0]?.type ?? "and"} />
                    <span>{section.label}</span>
                    <small>{group.length}</small>
                    <b>{expanded ? "▾" : "▸"}</b>
                  </button>
                  {expanded ? (
                    <div className="cwb-lib">
                      {group.map((spec) => (
                        <PartCard key={spec.type} spec={spec} circuit={circuit} onArm={arm} onCenter={placeCenter} onMenu={setMenu} onDoc={setDoc} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {items.length === 0 ? <p className="tiny">No component matches that search.</p> : null}
          </div>
        </>
      )}
      {menu ? (
        <div className="cwb-menu" style={{ left: menu.x, top: menu.y }} role="menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => { placeCenter(menu.type); setMenu(null); }}>Add to canvas</button>
          <button type="button" onClick={() => { circuit.toggleFavorite(menu.type); setMenu(null); }}>{circuit.favorites.includes(menu.type) ? "Remove favorite" : "Add to favorites"}</button>
          <button type="button" onClick={() => { arm(menu.type, true); setMenu(null); }}>Place multiple</button>
          <button type="button" onClick={() => { setDoc({ type: menu.type }); setMenu(null); }}>View description</button>
          {componentTruth(menu.type) ? <button type="button" onClick={() => { setDoc({ type: menu.type }); setMenu(null); }}>View truth table</button> : null}
        </div>
      ) : null}
      {documented ? (
        <div className="cwb-doc" role="dialog" aria-label={documented.displayName}>
          <div className="cwb-doc-head">
            <ComponentGlyph type={documented.type} />
            <strong>{documented.displayName}</strong>
            <button type="button" aria-label="Close description" onClick={() => setDoc(null)}>×</button>
          </div>
          <p>{documented.description}</p>
          <p className="tiny">Ports: {documented.ports({}).map((port) => `${port.name} ${port.dir === "in" ? "in" : "out"}`).join(", ")}</p>
          {truth ? (
            <table>
              <thead>
                <tr>{truth.inputs.map((name) => <th key={name}>{name}</th>)}<th> </th>{truth.outputs.map((name) => <th key={name}>{name}</th>)}</tr>
              </thead>
              <tbody>
                {truth.rows.map((row, index) => (
                  <tr key={index}>{row.input.map((bit, bitIndex) => <td key={bitIndex}>{bit}</td>)}<td> </td>{row.output.map((bit, bitIndex) => <td key={bitIndex}>{bit}</td>)}</tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <button type="button" onClick={() => { placeCenter(documented.type); setDoc(null); }}>Add to circuit</button>
        </div>
      ) : null}
    </section>
  );
}

function Shelf({ title, items, circuit, onArm, onCenter, onMenu, onDoc }: { title: string; items: ComponentSpec[]; circuit: CircuitSession; onArm: (type: string, multiple?: boolean) => void; onCenter: (type: string) => void; onMenu: (menu: Menu) => void; onDoc: (doc: Doc) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="cwb-shelf">
      <span>{title}</span>
      <div className="cwb-lib">
        {items.map((spec) => <PartCard key={`${title}-${spec.type}`} spec={spec} circuit={circuit} onArm={onArm} onCenter={onCenter} onMenu={onMenu} onDoc={onDoc} />)}
      </div>
    </div>
  );
}

function PartCard({ spec, circuit, onArm, onCenter, onMenu, onDoc }: { spec: ComponentSpec; circuit: CircuitSession; onArm: (type: string, multiple?: boolean) => void; onCenter: (type: string) => void; onMenu: (menu: Menu) => void; onDoc: (doc: Doc) => void }) {
  const favorite = circuit.favorites.includes(spec.type);
  return (
    <button
      type="button"
      className={`cwb-card ${circuit.armed === spec.type ? "on" : ""}`}
      draggable={false}
      aria-label={`${spec.displayName}, drag to canvas`}
      title={`${spec.displayName}. ${spec.description} Drag to the canvas, or click to place.`}
      onPointerDown={(event) => {
        if ((event.target as Element).closest(".cwb-card-tools")) return;
        beginPaletteDrag(event, spec.type);
      }}
      onClick={(event) => {
        if (paletteMoved) { paletteMoved = false; return; }
        if (event.detail > 1) return;
        onArm(spec.type, event.shiftKey);
      }}
      onDoubleClick={() => onCenter(spec.type)}
      onContextMenu={(event) => {
        event.preventDefault();
        const host = (event.currentTarget as HTMLElement).closest("section");
        const rect = host?.getBoundingClientRect();
        onMenu({ type: spec.type, x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onArm(spec.type, event.shiftKey);
      }}
    >
      <ComponentGlyph type={spec.type} />
      <span className="cwb-card-copy">
        <b>{spec.displayName}</b>
        <small>{spec.summary}</small>
      </span>
      <span className="cwb-card-tools">
        <span role="button" tabIndex={-1} className={favorite ? "on" : ""} aria-label={favorite ? `Remove ${spec.displayName} from favorites` : `Favorite ${spec.displayName}`} onClick={(event) => { event.stopPropagation(); circuit.toggleFavorite(spec.type); }}>★</span>
        <span role="button" tabIndex={-1} aria-label={`${spec.displayName} description`} onClick={(event) => { event.stopPropagation(); onDoc({ type: spec.type }); }}>?</span>
      </span>
    </button>
  );
}
