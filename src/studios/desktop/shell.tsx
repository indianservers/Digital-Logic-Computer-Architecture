import type { ReactNode } from "react";
import { ConceptNotes } from "../conceptNotes";
import { Link, NavLink } from "react-router-dom";
import { archLab, archStudio } from "../../data/architecture";
import { usePrefs } from "../../store/prefs";

const GLYPH: Record<string, ReactNode> = {
  home: <path d="M4 11 12 4l8 7v9H4z" />,
  package: <rect x="6" y="6" width="12" height="12" rx="2" />,
  cores: <path d="M8 8h8v8H8zM6 4h2M12 4h2M6 18h2M12 18h2" />,
  cache: <path d="M5 16h14M7 12h10M9 8h6" />,
  memory: <path d="M7 6h10v12H7zM9 6v12M12 6v12M15 6v12" />,
  pcie: <path d="M4 10h16v4H4zM8 10V7M16 10V7" />,
  "boost-power": <path d="M13 3 6 13h5l-1 8 8-12h-5z" />,
  thermal: <path d="M12 4c2 3 3 5 3 7a3 3 0 1 1-6 0c0-2 1-4 3-7z" />,
  workloads: <path d="M5 18V8m7 10V5m7 13v-6" />,
  practice: <path d="M7 4h10v4H7zM6 10h12v10H6z" />,
};

const HEADS: Record<string, { title: string; sub: string; quote: string }> = {
  home: { title: "Modern Desktop CPU Explorer", sub: "Explore the architecture, components, and performance of a modern desktop processor.", quote: "A package is a set of contracts, not a logo." },
  package: { title: "CPU Package & Block Diagram", sub: "Explore the internal structure of a modern desktop CPU and how all components work together.", quote: "The lid is not the processor." },
  cores: { title: "Performance vs Efficiency Cores", sub: "Compare the microarchitecture of high-performance cores and efficiency cores.", quote: "Heterogeneous cores deliver the best of performance and efficiency." },
  cache: { title: "Cache Hierarchy Explorer", sub: "Understand how multi-level caches reduce memory latency and improve performance.", quote: "Caches make memory feel much faster than main memory." },
  memory: { title: "Memory System (DDR)", sub: "Explore the DDR memory controller, channels, and memory subsystem.", quote: "Fast memory feeds the CPU, but caches keep it busy." },
  pcie: { title: "PCIe & I/O Subsystem", sub: "Explore PCIe lanes, devices, and the I/O subsystem.", quote: "PCIe enables the modern PC ecosystem of high-performance devices." },
  "boost-power": { title: "CPU Boost & Power Management", sub: "See how a desktop CPU adjusts frequency from workload, power limits, and thermal headroom. Simplified educational boost model.", quote: "Performance, power, and thermals are always connected." },
  thermal: { title: "Thermal Management", sub: "Explore how the CPU manages temperature with cooling solutions and thermal throttling.", quote: "Thermal headroom enables higher sustained performance." },
  workloads: { title: "Real-World Workload Analysis", sub: "See how different workloads use CPU resources, memory, and I/O in a desktop system.", quote: "Modern desktops are built for diverse work across CPU, GPU, and I/O." },
  practice: { title: "Practice & Quiz", sub: "Test your understanding of modern desktop CPU concepts.", quote: "Practice today, build tomorrow." },
};

function Glyph({ id }: { id: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {GLYPH[id] ?? GLYPH.home}
    </svg>
  );
}

export function DesktopShell({ lab, onReset, children }: { lab: string; onReset: () => void; children: ReactNode }) {
  const studio = archStudio("desktop");
  const current = archLab("desktop", lab);
  const head = HEADS[lab] ?? HEADS.home;
  const { prefs, update } = usePrefs();
  if (!studio || !current || !head) return null;
  return (
    <div className={`rvx dsk${prefs.explain ? "" : " explain-off"}`} data-lab={lab}>
      <nav className="rvx-nav" aria-label="Modern Desktop CPU Explorer">
        <p className="cmp-nav-kicker">Desktop CPU</p>
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
            <Link to={lab === "home" ? "/" : "/architecture/desktop"}>{lab === "home" ? "Digital Logic Home" : "Studio Home"}</Link>
            <Link to="/">Home</Link>
            <button type="button" className={prefs.explain ? "on" : ""} aria-pressed={prefs.explain} onClick={() => update({ explain: !prefs.explain })}>Explain</button>
            <button type="button" onClick={onReset}>Reset</button>
          </div>
        </header>
        {children}
        <ConceptNotes studio="desktop" lab={lab} />
      </div>
      <aside className="rvx-rail">
        <section className="rvx-guide" id="dsk-guide">
          <h3>Studio Guide</h3>
          <ol>{current.guide.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
        </section>
        <section className="rvx-takes">
          <h3>Key Takeaways</h3>
          <ul>{current.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="cmp-help">
          <h3>Try it</h3>
          <button type="button" onClick={() => update({ explain: true })}>Show explanations</button>
          <button type="button" onClick={onReset}>Reset this lab</button>
        </section>
        <p className="rvx-quote">“{head.quote}”</p>
      </aside>
    </div>
  );
}
