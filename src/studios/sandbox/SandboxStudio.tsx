import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { SandboxContext, useSandboxState, useSandbox } from "./sandboxState";
import {
  LIBRARY,
  PAGES,
  TEMPLATE_LIST,
  type SandboxPage,
} from "./sandboxModel";
import { GateSymbol, PartThumbnail, SIcon } from "./SandboxUI";
import {
  CircuitView,
  CircuitDock,
  TemplateView,
  TemplateDock,
} from "./CircuitViews";
import {
  MemoryView,
  MemoryDock,
  MemoryInspector,
  MulticoreView,
  MulticoreDock,
  MulticoreInspector,
} from "./MemoryViews";
import {
  CpuView,
  CpuDock,
  CpuInspector,
  DatapathView,
  DatapathDock,
  DatapathInspector,
} from "./CpuViews";
import {
  CircuitInspector,
  LibraryView,
  LibraryDock,
  LibraryInspector,
  ProbesView,
  ProbesInspector,
  WaveformDock,
  TemplateInspector,
} from "./AnalysisViews";
import {
  DebugView,
  DebugDock,
  DebugInspector,
  BreakpointList,
} from "./DebugViews";
import {
  HistoryView,
  TimeMachineDock,
  TimeMachineInspector,
} from "./HistoryViews";
import "./sandbox.css";
export function SandboxStudio() {
  useSimulatorCapture("studios/sandbox/SandboxStudio.tsx:SandboxStudio", () => ({ state }), "70bd7c960ff5");

  const { labId } = useParams();
  const page = PAGES.some((p) => p.id === labId)
    ? (labId as SandboxPage)
    : "circuit";
  const state = useSandboxState(page);
  return (
    <SandboxContext.Provider value={state}>
      <Workbench />
    </SandboxContext.Provider>
  );
}
function Workbench() {
  useSimulatorCapture("studios/sandbox/SandboxStudio.tsx:Workbench", () => ({ s, settings }), "70bd7c960ff5");

  const s = useSandbox();
  const [settings, setSettings] = useState(false);
  const views = {
    circuit: <CircuitView />,
    datapath: <DatapathView />,
    memory: <MemoryView />,
    cpu: <CpuView />,
    multicore: <MulticoreView />,
    library: <LibraryView />,
    probes: <ProbesView />,
    breaks: <DebugView />,
    history: <HistoryView />,
    templates:
      s.templateIndex === 1 ? (
        <CircuitView />
      ) : s.templateIndex === 2 ? (
        <ProbesView />
      ) : s.templateIndex === 3 ? (
        <CpuView />
      ) : s.templateIndex === 4 ? (
        <MemoryView />
      ) : s.templateIndex === 5 ? (
        <MulticoreView />
      ) : (
        <TemplateView />
      ),
  };
  const docks = {
    circuit: <CircuitDock />,
    datapath: <DatapathDock />,
    memory: <MemoryDock />,
    cpu: <CpuDock />,
    multicore: <MulticoreDock />,
    library: <LibraryDock />,
    probes: <WaveformDock />,
    breaks: <DebugDock />,
    history: <TimeMachineDock />,
    templates: <TemplateDock />,
  };
  const inspectors = {
    circuit: <CircuitInspector />,
    datapath: <DatapathInspector />,
    memory: <MemoryInspector />,
    cpu: <CpuInspector />,
    multicore: <MulticoreInspector />,
    library: <LibraryInspector />,
    probes: <ProbesInspector />,
    breaks: <DebugInspector />,
    history: <TimeMachineInspector />,
    templates: <TemplateInspector />,
  };
  return (
    <div
      className={`sandbox-app sb-page-${s.page}`}
      data-running={s.running}
      style={{ "--sb-speed": `${1.6 / s.speed}s` } as React.CSSProperties}
    >
      <header className="sb-header">
        <a className="sb-brand" href="/studios">
          <span className="sb-logo">
            <svg
              width="28"
              height="28"
              viewBox="0 0 32 32"
              fill="none"
              stroke="#009bff"
              strokeWidth="3"
            >
              <path d="M17 3L4 16l7 7 13-13-7-7zM21 9l7 7-13 13-7-7M10 16l6 6M16 10l6 6" />
            </svg>
          </span>
          <b>AIMER</b> Digital
        </a>
        <strong className="sb-app-name">Architecture Sandbox</strong>
        <div className="sb-project">
          Project:{" "}
          <button
            onClick={() => {
              const name = prompt(
                "Project name",
                s.projectName || s.activePage.project,
              );
              if (name?.trim()) s.setProjectName(name.trim());
            }}
          >
            {s.projectName || s.activePage.project}⌄
          </button>
        </div>
        <span className="sb-saved">●　{s.saveState}</span>
        <nav className="sb-workspace-tabs">
          {["Build", "Simulate", "Debug"].map((t) => (
            <button
              className={s.workspace === t ? "active" : ""}
              key={t}
              onClick={() => {
                s.setWorkspace(t);
                if (t === "Debug" && s.page === "cpu") s.go("breaks");
              }}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="sb-history-buttons">
          <button aria-label="Undo" disabled={!s.past.length} onClick={s.undo}>
            <SIcon name="undo" />
          </button>
          <button
            aria-label="Redo"
            disabled={!s.future.length}
            onClick={s.redo}
          >
            <SIcon name="redo" />
          </button>
        </div>
        <div className="sb-run-group">
          <button
            className="sb-primary"
            onClick={() => s.setRunning(!s.running)}
          >
            <SIcon name={s.running ? "pause" : "run"} size={17} />
            {s.running ? "Pause" : "Run"}
          </button>
          <select
            aria-label="Simulation speed"
            value={s.speed}
            onChange={(e) => s.setSpeed(Number(e.target.value))}
          >
            {[0.5, 1, 2, 4].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </div>
        <button
          className="sb-header-step"
          onClick={() =>
            ["cpu", "breaks"].includes(s.page)
              ? s.commitInstruction(true)
              : s.step()
          }
        >
          <SIcon name="step" size={16} />
          {["cpu", "breaks", "history"].includes(s.page)
            ? "Step Instruction"
            : "Step"}
        </button>
        <button
          className="sb-header-reset"
          onClick={() => (s.page === "cpu" ? s.step() : s.reset())}
        >
          <SIcon name={s.page === "cpu" ? "clock" : "reset"} size={16} />
          {s.page === "cpu" ? "Step Clock" : "Reset"}
        </button>
        <span className="sb-cycle">
          Cycle {s.page === "cpu" ? s.cpu.cycle : s.tick} |{" "}
          {s.running ? "Running" : s.page === "cpu" ? "Writeback" : "Ready"}
        </span>
        <button
          className="sb-settings"
          aria-label="Workbench settings"
          onClick={() => setSettings(!settings)}
        >
          <SIcon name="settings" size={17} />
        </button>
      </header>
      {settings && (
        <div className="sb-settings-popover">
          <h3>Workbench Settings</h3>
          <label>
            <input
              type="checkbox"
              checked={s.showPins}
              onChange={(e) => s.setShowPins(e.target.checked)}
            />{" "}
            Show pin labels
          </label>
          <button
            onClick={() =>
              s.download(
                "architecture-project.json",
                JSON.stringify(
                  { circuit: s.circuit, program: s.program },
                  null,
                  2,
                ),
              )
            }
          >
            Export project
          </button>
          <button
            onClick={() => {
              s.setZoom(100);
              s.setPan({ x: 0, y: 0 });
              setSettings(false);
            }}
          >
            Reset view
          </button>
        </div>
      )}
      <div className="sb-layout">
        <nav className="sb-nav" aria-label="Sandbox labs">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={s.page === p.id ? "active" : ""}
              onClick={() => s.go(p.id)}
              title={p.label}
            >
              <SIcon name={p.icon} />
              <span>{p.label}</span>
            </button>
          ))}
        </nav>
        <Palette />
        {s.page === "breaks" && <BreakpointList />}
        <main className="sb-canvas-host">{views[s.page]}</main>
        <aside className="sb-inspector">{inspectors[s.page]}</aside>
        <section className="sb-dock" aria-label="Simulation results">
          {docks[s.page]}
        </section>
      </div>
    </div>
  );
}
function Palette() {
  useSimulatorCapture("studios/sandbox/SandboxStudio.tsx:Palette", () => ({ s, groups }), "70bd7c960ff5");

  const s = useSandbox();
  const [groups, setGroups] = useState<string[]>([]);
  const isCpu = ["cpu", "breaks", "history", "datapath"].includes(s.page);
  const items = LIBRARY.filter(
    (p) =>
      !s.search ||
      `${p.label} ${p.description}`
        .toLowerCase()
        .includes(s.search.toLowerCase()),
  );
  return (
    <aside className="sb-library-sidebar">
      <h2>
        {s.page === "templates"
          ? "Experiment Templates"
          : s.page === "library"
            ? "Component Library"
            : "Components"}
        <SIcon name="settings" size={14} />
      </h2>
      <div className="sb-search">
        <SIcon name="search" size={13} />
        <input
          aria-label="Search components"
          placeholder={
            s.page === "templates"
              ? "Search templates..."
              : "Search components..."
          }
          value={s.search}
          onChange={(e) => s.setSearch(e.target.value)}
        />
      </div>
      {s.page === "circuit" ? (
        <div className="sb-circuit-palette">
          {items
            .filter((p) =>
              [
                "and",
                "or",
                "xor",
                "not",
                "fa",
                "constant",
                "led",
                "clock",
              ].includes(p.kind),
            )
            .sort(
              (a, b) =>
                [
                  "and",
                  "or",
                  "xor",
                  "not",
                  "fa",
                  "constant",
                  "led",
                  "clock",
                ].indexOf(a.kind) -
                [
                  "and",
                  "or",
                  "xor",
                  "not",
                  "fa",
                  "constant",
                  "led",
                  "clock",
                ].indexOf(b.kind),
            )
            .map((p) => (
              <button
                key={p.kind}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("sandbox-kind", p.kind)
                }
                onClick={() => s.insertPart(p.kind)}
              >
                <PartThumbnail kind={p.kind} />
                <span>{p.kind === "constant" ? "Toggle Switch" : p.label}</span>
              </button>
            ))}
        </div>
      ) : s.page === "templates" ? (
        <>
          <div className="sb-palette-subtitle">STARTER TEMPLATES</div>
          <div className="sb-template-list">
            {TEMPLATE_LIST.filter((t) =>
              t.name.toLowerCase().includes(s.search.toLowerCase()),
            ).map((t) => (
              <button
                key={t.name}
                className={
                  s.templateIndex === TEMPLATE_LIST.indexOf(t) ? "active" : ""
                }
                onClick={() => s.setTemplateIndex(TEMPLATE_LIST.indexOf(t))}
              >
                <PartThumbnail kind={t.kind} />
                <span>
                  <b>{t.name}</b>
                  <small>{t.description}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="sb-palette-tip">
            <h4>Start with a template</h4>
            <p>
              Learn by exploring a working circuit. Every component is editable.
            </p>
            <button className="sb-primary" onClick={() => s.loadTemplate()}>
              Load Template
            </button>
          </div>
        </>
      ) : s.page === "probes" ? (
        <>
          {[
            {
              name: "Basic",
              parts: [
                ["AND", "and"],
                ["OR", "or"],
                ["NOT", "not"],
                ["NAND", "and"],
                ["NOR", "or"],
                ["XOR", "xor"],
              ],
            },
            {
              name: "Sequential",
              parts: [
                ["D Flip-Flop", "register"],
                ["JK Flip-Flop", "register"],
                ["Register", "register"],
              ],
            },
            {
              name: "Counters",
              parts: [
                ["4-bit Counter", "counter"],
                ["8-bit Counter", "counter"],
                ["Up/Down Counter", "counter"],
              ],
            },
            {
              name: "IO",
              parts: [
                ["Clock", "clock"],
                ["Toggle Switch", "constant"],
                ["LED", "led"],
              ],
            },
          ].map((group) => (
            <div className="sb-probe-palette" key={group.name}>
              <h3>{group.name}</h3>
              <div>
                {group.parts.map(([label, kind]) => (
                  <button
                    key={label}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("sandbox-kind", kind!)
                    }
                    onClick={() =>
                      s.setNotice(
                        `${label} selected. Use Circuit mode to build with this component.`,
                      )
                    }
                  >
                    <GateSymbol kind={kind!} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : s.page === "library" ? (
        <>
          {[
            "All Components",
            "Logic",
            "Arithmetic",
            "Storage",
            "Control",
            "Memory",
            "I/O",
          ].map((group) => (
            <div className="sb-library-group" key={group}>
              <button
                onClick={() =>
                  setGroups((g) =>
                    g.includes(group)
                      ? g.filter((n) => n !== group)
                      : [...g, group],
                  )
                }
              >
                ⌄　{group}
              </button>
              {(group === "Arithmetic" || groups.includes(group)) &&
                items
                  .filter(
                    (p) => group === "All Components" || p.group === group,
                  )
                  .map((p) => (
                    <button
                      className={s.libItem === p.label ? "active" : ""}
                      key={p.label}
                      onClick={() => s.setLibItem(p.label)}
                    >
                      <PartThumbnail kind={p.kind} />
                      <span>
                        {p.label}
                        <small>{p.description}</small>
                      </span>
                    </button>
                  ))}
            </div>
          ))}
        </>
      ) : (
        <>
          <h3>
            {s.page === "multicore"
              ? "Multicore"
              : s.page === "memory"
                ? "Memory System"
                : isCpu
                  ? "Core"
                  : "Logic Gates"}
            <span>⌃</span>
          </h3>
          <div className={`sb-palette-grid ${isCpu ? "two-col" : ""}`}>
            {(isCpu
              ? items
                  .filter((p) =>
                    [
                      "alu",
                      "register",
                      "counter",
                      "decoder",
                      "memory",
                      "clock",
                    ].includes(p.kind),
                  )
                  .sort(
                    (a, b) =>
                      [
                        "alu",
                        "register",
                        "counter",
                        "decoder",
                        "memory",
                        "clock",
                      ].indexOf(a.kind) -
                      [
                        "alu",
                        "register",
                        "counter",
                        "decoder",
                        "memory",
                        "clock",
                      ].indexOf(b.kind),
                  )
              : s.page === "memory"
                ? items.filter((p) =>
                    ["alu", "memory", "register", "constant"].includes(p.kind),
                  )
                : s.page === "multicore"
                  ? items.filter((p) =>
                      ["alu", "memory", "register"].includes(p.kind),
                    )
                  : items.slice(0, 4)
            ).map((p) => (
              <button
                key={p.kind}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("sandbox-kind", p.kind)
                }
                onClick={() => {
                  {
                    s.setSelected(p.label);
                    s.setNotice(
                      `${p.label} selected. Drag into Circuit mode to add editable components.`,
                    );
                  }
                }}
              >
                <PartThumbnail
                  kind={p.kind}
                  label={
                    isCpu
                      ? p.kind === "counter"
                        ? "PC"
                        : undefined
                      : undefined
                  }
                />
                <span>
                  {isCpu
                    ? p.kind === "register"
                      ? "Register File"
                      : p.kind === "counter"
                        ? "Program Counter"
                        : p.kind === "decoder"
                          ? "Instruction Decoder"
                          : p.kind === "memory"
                            ? "RAM"
                            : p.label
                    : p.label}
                </span>
                <small>{p.description}</small>
              </button>
            ))}
          </div>
          <h3>
            More Components <span>⌃</span>
          </h3>
          {[
            "Buses & Wiring",
            "Logic Gates",
            "Multiplexers",
            "Adders",
            "Control",
            "I/O",
          ].map((g, i) => (
            <div className="sb-palette-category" key={g}>
              <button
                onClick={() =>
                  setGroups((p) =>
                    p.includes(g) ? p.filter((n) => n !== g) : [...p, g],
                  )
                }
              >
                <i
                  style={{
                    background: [
                      "#fa9800",
                      "#08b4e9",
                      "#6a3cff",
                      "#00ba78",
                      "#ffb500",
                      "#688399",
                    ][i],
                  }}
                />
                {g}
                <span>⌄</span>
              </button>
              {groups.includes(g) &&
                items
                  .filter((p) =>
                    g === "Logic Gates"
                      ? p.group === "Logic"
                      : g === "I/O"
                        ? p.group === "I/O"
                        : g === "Adders"
                          ? p.group === "Arithmetic"
                          : p.group === "Control",
                  )
                  .map((p) => (
                    <button
                      key={p.label}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("sandbox-kind", p.kind)
                      }
                      onClick={() => s.insertPart(p.kind)}
                    >
                      {p.label}　＋
                    </button>
                  ))}
            </div>
          ))}
          <div className="sb-palette-tip">
            <SIcon name="select" />
            <p>Drag components onto the canvas to build your architecture.</p>
          </div>
        </>
      )}
    </aside>
  );
}
export default SandboxStudio;
