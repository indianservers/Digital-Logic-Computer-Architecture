import type { ReactNode } from "react";
import { ConceptNotes } from "../conceptNotes";
import { Link, NavLink } from "react-router-dom";
import { archLab, archStudio } from "../../data/architecture";
import { usePrefs } from "../../store/prefs";

const GLYPH: Record<string, ReactNode> = {
  home: <path d="M4 11 12 4l8 7v9H4z" />,
  overview: <path d="M4 8h7v7H4zm9-3h7v6h-7zM13 14h7v6h-7z" />,
  "cpu-cores": <path d="M8 8h8v8H8zM8 4v4M12 4v4M16 4v4M8 16v4M12 16v4M16 16v4" />,
  gpu: <path d="M5 16 12 6l7 10z" />,
  npu: <path d="M5 5h6v6H5zm8 0h6v6h-6zM5 13h6v6H5zm8 0h6v6h-6z" />,
  isp: <path d="M8 8h8v8H8zM12 4v4M12 16v4M4 12h4M16 12h4" />,
  memory: <path d="M6 7h12v3H6zm0 5h12v3H6zm2 5h8" />,
  connectivity: <path d="M12 18v2M8 14a5 5 0 0 1 8 0M5 11a9 9 0 0 1 14 0" />,
  "power-thermal": <path d="M12 4v8M9 14a3 3 0 1 0 6 0c0-2-3-3-3-6" />,
  integration: <path d="M12 4v16M4 12h16" />,
};

const HEADS: Record<string, { title: string; sub: string; quote: string }> = {
  home: { title: "Modern Mobile SoC Explorer", sub: "A generic educational look at P/E cores, GPU, NPU, ISP, memory, modem, and power.", quote: "Many engines. One package." },
  overview: { title: "SoC Overview", sub: "Click a block and follow the path it takes through the package.", quote: "The interconnect is the meeting place." },
  "cpu-cores": { title: "CPU: Performance & Efficiency Cores", sub: "Schedule work onto P-cores and E-cores. Figures are illustrative.", quote: "Right core for the job, not a bigger core for every job." },
  gpu: { title: "GPU Architecture", sub: "A simplified educational simulation of a mobile graphics pipeline.", quote: "Pixels are parallel work." },
  npu: { title: "NPU / AI Engine", sub: "Tensor flow through a generic on-device accelerator. Browser-only.", quote: "MACs need data as much as they need multiply units." },
  isp: { title: "ISP & Camera Pipeline", sub: "Turn a sensor-style image into a display image, stage by stage.", quote: "The photograph is a pipeline, not a single filter." },
  memory: { title: "Memory & Interconnect", sub: "Follow a request from an engine through cache toward LPDDR.", quote: "Most of the energy is moving the bytes." },
  connectivity: { title: "Modem & Connectivity", sub: "An illustrative radio path. Not a measured network.", quote: "The modem is another client of memory." },
  "power-thermal": { title: "Power, Thermal & DVFS", sub: "Simplified educational thermal model. Not a vendor governor.", quote: "Frequency follows the thermal budget." },
  integration: { title: "System Integration", sub: "One scenario wakes several blocks. Step the timeline.", quote: "A feature is a path across the SoC." },
};

function Glyph({ id }: { id: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {GLYPH[id] ?? GLYPH.home}
    </svg>
  );
}

export function MobileShell({ lab, onReset, children }: { lab: string; onReset: () => void; children: ReactNode }) {
  const studio = archStudio("mobile");
  const current = archLab("mobile", lab);
  const head = HEADS[lab] ?? HEADS.home;
  const { prefs, update } = usePrefs();
  if (!studio || !current || !head) return null;
  return (
    <div className={`rvx mob${prefs.explain ? "" : " explain-off"}`}>
      <nav className="rvx-nav" aria-label="Modern Mobile SoC Explorer">
        <p className="cmp-nav-kicker">Mobile SoC</p>
        {studio.labs.map((item) => {
          const to = item.id === "home" ? studio.path : `${studio.path}/${item.id}`;
          return (
            <NavLink key={item.id} to={to} end={item.id === "home"} className={lab === item.id ? "active" : undefined}>
              <Glyph id={item.id} />
              {item.id === "home" ? "Studio Home" : item.title}
            </NavLink>
          );
        })}
      </nav>
      <div className="rvx-main">
        <header className="cmp-head">
          <div className="cmp-title">
            <span className="cmp-mark"><Glyph id={lab} /></span>
            <div>
              <h1>{head.title}</h1>
              <p>{head.sub}</p>
            </div>
          </div>
          <div className="cmp-tools">
            <Link to={lab === "home" ? "/" : "/architecture/mobile"}>{lab === "home" ? "Digital Logic Home" : "Studio Home"}</Link>
            <Link to="/">Home</Link>
            <button type="button" className={prefs.explain ? "on" : ""} aria-pressed={prefs.explain} onClick={() => update({ explain: !prefs.explain })}>Explain</button>
            <button type="button" onClick={onReset}>Reset</button>
          </div>
        </header>
        {children}
        <ConceptNotes studio="mobile" lab={lab} />
      </div>
      <aside className="rvx-rail">
        <section className="rvx-guide" id="mob-guide">
          <h3>Studio Guide</h3>
          <ol>{current.guide.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
        </section>
        <section className="rvx-takes">
          <h3>Key Takeaways</h3>
          <ul>{current.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="cmp-help">
          <h3>Need Help?</h3>
          <a href="#mob-guide">Open Studio Guide</a>
          <button type="button" onClick={() => update({ explain: true })}>Show explanations</button>
          <button type="button" onClick={onReset}>Reset this lab</button>
        </section>
        <p className="rvx-quote">“{head.quote}”</p>
      </aside>
    </div>
  );
}
