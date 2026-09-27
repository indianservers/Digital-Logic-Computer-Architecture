import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import type { Latencies } from "../../engines/arch/hierarchy";
import { DEFAULT_LATENCIES } from "../../engines/arch/hierarchyLab";
import { usePrefs } from "../../store/prefs";
import { AccessPanel, CachePanel, HierarchyPanel, LocalityPanel } from "./hierarchyPanels";

const TABS = [
  { id: "pyramid", label: "Hierarchy" },
  { id: "access", label: "Access" },
  { id: "locality", label: "Locality" },
  { id: "cache", label: "Cache" },
] as const;

const ALIAS: Record<string, string> = { hierarchy: "pyramid" };

export function HierarchyStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const aliased = raw ? ALIAS[raw] ?? raw : "pyramid";
  const tab = TABS.some((item) => item.id === aliased) ? aliased : "pyramid";
  const { prefs, update } = usePrefs();
  const [latencies, setLatencies] = useState<Latencies>(DEFAULT_LATENCIES);

  function setTab(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  return (
    <div className="hhx">
      <header className="hhx-head">
        <div>
          <h1><Icon name="book" size={18} /> Memory Hierarchy</h1>
          <p>The memory pyramid: registers, caches, RAM and storage. Closer levels are faster and smaller. Latencies are teaching parameters you can edit.</p>
        </div>
        <div className="hhx-head-actions">
          <label className="hhx-switch">Explain
            <button type="button" role="switch" aria-checked={prefs.explain} aria-label="Explain in this studio" className={prefs.explain ? "on" : ""} onClick={() => update({ explain: !prefs.explain })} />
          </label>
          <Link className="hhx-back" to="/"><Icon name="back" size={14} /> Back to Path</Link>
        </div>
      </header>
      <div className="hhx-tabs" role="tablist" aria-label="Memory hierarchy labs">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div hidden={tab !== "pyramid"} inert={tab !== "pyramid" ? true : undefined}><HierarchyPanel explain={prefs.explain} latencies={latencies} onLatencies={setLatencies} /></div>
      <div hidden={tab !== "access"} inert={tab !== "access" ? true : undefined}><AccessPanel explain={prefs.explain} latencies={latencies} /></div>
      <div hidden={tab !== "locality"} inert={tab !== "locality" ? true : undefined}><LocalityPanel explain={prefs.explain} /></div>
      <div hidden={tab !== "cache"} inert={tab !== "cache" ? true : undefined}><CachePanel explain={prefs.explain} /></div>
    </div>
  );
}
