import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CACHE_LESSONS } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";
import { HierarchyTab, LocalityTab, PoliciesTab, SimulatorTab } from "./cachePanels";

const TABS = [
  { id: "sim", label: "Simulator" },
  { id: "locality", label: "Locality" },
  { id: "policy", label: "Policies" },
  { id: "levels", label: "Hierarchy" },
];

const ALIAS: Record<string, string> = { policies: "policy", hierarchy: "levels" };

export function CacheStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const mapped = raw ? ALIAS[raw] ?? raw : "sim";
  const tab = TABS.some((item) => item.id === mapped) ? mapped : "sim";
  const [resetKey, setResetKey] = useState(0);
  const [shared, setShared] = useState("");
  const { prefs } = usePrefs();
  const lesson = CACHE_LESSONS[tab] ?? CACHE_LESSONS.sim!;

  function select(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShared("Link copied");
    } catch {
      setShared(url);
    }
  }

  return (
    <div className="cx">
      <header className="cx-head">
        <div className="cx-title">
          <span className="cx-mark" aria-hidden="true">▣</span>
          <div>
            <h1>Cache Memory</h1>
            <p>{tab === "levels" ? "Explore the memory hierarchy, visualize the request path, and see how each level changes average access time." : "Explore how a cache works, step through an address trace, and see the effects of different configurations and policies."}</p>
          </div>
        </div>
        <div className="cx-actions">
          <button type="button" onClick={() => setResetKey((value) => value + 1)}>Reset All</button>
          <button type="button" onClick={() => void share()}>Share</button>
          {shared ? <span className="tiny">{shared}</span> : null}
        </div>
      </header>
      <div className="cx-tabs" role="tablist" aria-label="Cache Memory">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => select(item.id)}>{item.label}</button>
        ))}
      </div>
      <div key={`${tab}-${resetKey}`}>
        {tab === "sim" ? <SimulatorTab explain={prefs.explain} guide={lesson.guide} takeaways={lesson.takeaways} /> : null}
        {tab === "locality" ? <LocalityTab explain={prefs.explain} guide={lesson.guide} takeaways={lesson.takeaways} /> : null}
        {tab === "policy" ? <PoliciesTab explain={prefs.explain} guide={lesson.guide} takeaways={lesson.takeaways} /> : null}
        {tab === "levels" ? <HierarchyTab explain={prefs.explain} guide={lesson.guide} takeaways={lesson.takeaways} /> : null}
      </div>
    </div>
  );
}
