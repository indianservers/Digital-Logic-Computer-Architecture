import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { CPU_LESSONS, lessonOf } from "../../data/studioLessons";
import { ProgramLab } from "./ProgramLab";
import { SimulatorCaptureScope } from "../../layout/SimulatorCapture";
import { freshCpu, type BlockCpu } from "../../engines/cpu/blocksLab";
import { usePrefs } from "../../store/prefs";
import { BusPanel, ClockPanel, DatapathPanel, ExtendPanel, OverviewPanel, RegisterPanel } from "./cpuPanels";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "execute", label: "Execute a program" },
  { id: "registers", label: "Registers" },
  { id: "datapath", label: "Datapath" },
  { id: "bus", label: "Internal Bus" },
  { id: "extend", label: "Extend / Shift" },
  { id: "clock", label: "Clocking" },
] as const;

const ALIAS: Record<string, string> = { clocking: "clock" };

export function CpuStudio() {
  useSimulatorCapture("studios/cpu/CpuStudio.tsx:CpuStudio", () => ({ cpu }), "c843cef9a9c5");

  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const aliased = raw ? ALIAS[raw] ?? raw : "overview";
  const tab = TABS.some((item) => item.id === aliased) ? aliased : "overview";
  const { prefs, update } = usePrefs();
  const [cpu, setCpu] = useState<BlockCpu>(freshCpu);
  const [manualRevision, setManualRevision] = useState(0);
  const editCpu = (next: BlockCpu) => { setCpu(next); setManualRevision(n => n + 1); };
  const lesson = lessonOf(CPU_LESSONS, tab, "overview");

  function setTab(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  return (
    <div className={"cpx " + (tab === "execute" ? "cpx-program" : "")}>
      <header className="cpx-head">
        <div>
          <h1><Icon name="project" size={18} /> CPU Building Blocks</h1>
          <p>Inspect individual blocks, then connect them in a live fetch–decode–execute experiment.</p>
        </div>
        <div className="cpx-head-actions">
          <label className="cpx-switch">Explain
            <button type="button" role="switch" aria-checked={prefs.explain} aria-label="Explain in this studio" className={prefs.explain ? "on" : ""} onClick={() => update({ explain: !prefs.explain })} />
          </label>
          <Link className="cpx-back" to="/"><Icon name="back" size={14} /> Back to Path</Link>
        </div>
      </header>
      <div className="cpx-tabs" role="tablist" aria-label="CPU building blocks">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="cpx-grid">
        <div className="cpx-main">
          <div hidden={tab !== "overview"} inert={tab !== "overview" ? true : undefined}><SimulatorCaptureScope active={tab === "overview"}><OverviewPanel explain={prefs.explain} cpu={cpu} onReset={() => editCpu(freshCpu())} /></SimulatorCaptureScope></div>
          <div hidden={tab !== "execute"} inert={tab !== "execute"}><SimulatorCaptureScope active={tab === "execute"}><ProgramLab onCpu={setCpu} manualRevision={manualRevision} /></SimulatorCaptureScope></div>
          <div hidden={tab !== "registers"} inert={tab !== "registers" ? true : undefined}><SimulatorCaptureScope active={tab === "registers"}><RegisterPanel explain={prefs.explain} cpu={cpu} onCpu={editCpu} /></SimulatorCaptureScope></div>
          <div hidden={tab !== "datapath"} inert={tab !== "datapath" ? true : undefined}><SimulatorCaptureScope active={tab === "datapath"}><DatapathPanel explain={prefs.explain} cpu={cpu} onCpu={editCpu} /></SimulatorCaptureScope></div>
          <div hidden={tab !== "bus"} inert={tab !== "bus" ? true : undefined}><SimulatorCaptureScope active={tab === "bus"}><BusPanel explain={prefs.explain} cpu={cpu} onCpu={editCpu} /></SimulatorCaptureScope></div>
          <div hidden={tab !== "extend"} inert={tab !== "extend" ? true : undefined}><SimulatorCaptureScope active={tab === "extend"}><ExtendPanel explain={prefs.explain} /></SimulatorCaptureScope></div>
          <div hidden={tab !== "clock"} inert={tab !== "clock" ? true : undefined}><SimulatorCaptureScope active={tab === "clock"}><ClockPanel explain={prefs.explain} /></SimulatorCaptureScope></div>
        </div>
        <aside className="cpx-side">
          <section>
            <h2>Studio Guide</h2>
            <ol>{lesson.guide.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol>
          </section>
          <section>
            <h2>Key Takeaways</h2>
            <ul>{lesson.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
