import { Link } from "react-router-dom";
import { CATEGORIES, STUDIOS } from "../data/curriculum";
import { MASTER_CONCEPTS } from "../data/master";
import { StudioMark } from "../design-system/studioMarks";
import { Card, Toggle } from "../design-system/ui";
import { usePrefs } from "../store/prefs";
import type { StudioInfo } from "../data/curriculum";

function conceptCount(studio: StudioInfo): number {
  const pathBase = studio.path.split("?")[0] ?? studio.path;
  const hasTab = studio.path.includes("?");
  return MASTER_CONCEPTS.filter((item) => {
    if (item.studio === studio.id) return true;
    if (hasTab) return item.route.startsWith(studio.path);
    const routeBase = item.route.split("?")[0] ?? item.route;
    return routeBase === pathBase || routeBase.startsWith(`${pathBase}/`);
  }).length;
}

function StudioCard({ studio }: { studio: StudioInfo }) {
  const count = conceptCount(studio);
  return (
    <Link to={studio.path} className={`card studio-card tone-${studio.category}${studio.active ? "" : " is-locked"}`}>
      <div className="studio-card-head">
        <StudioMark id={studio.id} />
        {studio.active ? <span className="pill ok">Open</span> : <span className="lock">Upcoming · Phase {studio.phase}</span>}
      </div>
      <strong>{studio.title}</strong>
      <p className="muted" style={{ margin: 0 }}>{studio.summary}</p>
      <span className="tiny">{studio.topics.slice(0, 3).join(" · ")}{count ? ` · ${count} concepts` : ""}</span>
    </Link>
  );
}

export function HomePage() {
  const { prefs } = usePrefs();
  const resume = prefs.lastPath.startsWith("/studios") || prefs.lastPath.startsWith("/architecture") ? prefs.lastPath : "/studios/number-systems";
  const openCount = STUDIOS.filter((studio) => studio.active).length;
  return (
    <div className="home">
      <section className="home-hero-card">
        <div className="home-hero-copy">
          <div className="tiny">LEARN · BUILD · THINK</div>
          <h1>Digital Logic & Computer Architecture</h1>
          <p className="muted">Learn by changing the system. Toggle bits, edit expressions, and watch the circuit, CPU, or cache update.</p>
          <div className="row" style={{ marginTop: 12 }}>
            <Link to={resume} className="btn-primary">Continue</Link>
            <Link to="/learn" className="btn-ghost">Learning Path</Link>
          </div>
          <div className="home-stats">
            <div><b>{openCount}</b><span>open studios</span></div>
            <div><b>9</b><span>categories</span></div>
            <div><b>392</b><span>concepts</span></div>
          </div>
        </div>
        <img className="home-hero-art" src="/icons/home-hero.png" width={640} height={360} alt="Colorful LogicLab workshop with gates, bits, a CPU, and a bus" />
      </section>
      {CATEGORIES.map((category) => {
        const items = STUDIOS.filter((studio) => studio.category === category.id);
        const open = items.filter((studio) => studio.active).length;
        return (
          <section key={category.id} className={`home-cat tone-${category.id}`}>
            <header className="home-cat-head">
              <img src={category.art} width={72} height={72} alt="" />
              <div>
                <h2>{category.title}</h2>
                <p className="muted">{category.blurb}</p>
              </div>
              <span className="pill">{open} open{items.length > open ? ` · ${items.length - open} upcoming` : ""}</span>
            </header>
            <div className="grid cards-3">
              {items.map((studio) => <StudioCard key={studio.id} studio={studio} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function StudiosPage() {
  return <HomePage />;
}

export function LearnPage() {
  return (
    <div className="home">
      <p className="muted" style={{ marginTop: 0 }}>The path is the same map as Home, grouped by topic. ALU and GPU studios stay locked until they are built.</p>
      {CATEGORIES.map((category) => (
        <Card key={category.id} title={category.title} action={<img src={category.art} width={40} height={40} alt="" style={{ borderRadius: 10 }} />}>
          <p className="muted" style={{ marginTop: 0 }}>{category.blurb}</p>
          <ol className="learn-list">
            {STUDIOS.filter((studio) => studio.category === category.id).map((studio, index) => (
              <li key={studio.id}>
                <StudioMark id={studio.id} size={32} />
                <div>
                  <Link to={studio.path}><strong>{index + 1}. {studio.title}</strong></Link>
                  <div className="tiny">{studio.active ? studio.summary : `Upcoming · Phase ${studio.phase}. ${studio.summary}`}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ))}
      <Card title="How a studio works">
        <p className="muted">Each lab keeps the calculation in an engine and the picture in the workspace. Explain mode names what changed, why, and what to notice. Progress stays in this browser.</p>
      </Card>
    </div>
  );
}

export const PRACTICE_COUNT = 11;

const CHALLENGES = [
  { id: "hex-7f", title: "Convert 7F to 8-bit binary", to: "/studios/number-systems?tab=convert", studio: "numbers" },
  { id: "twos", title: "Show −5 in two's complement", to: "/studios/number-systems?tab=signed", studio: "numbers" },
  { id: "hamming", title: "Correct a Hamming(7,4) bit", to: "/studios/number-systems?tab=hamming", studio: "numbers" },
  { id: "absorb", title: "Simplify A + AB", to: "/studios/boolean-algebra?tab=simplify", studio: "boolean" },
  { id: "xor", title: "Find when XOR is high", to: "/studios/logic-gates?tab=build", studio: "gates" },
  { id: "kmap", title: "Group a wraparound pair", to: "/studios/kmap?tab=map", studio: "kmap" },
  { id: "adder-2", title: "Add two bits and read the carry", to: "/studios/adders?tab=half", studio: "adders" },
  { id: "mux-d3", title: "Route I3 through a multiplexer", to: "/studios/routing?tab=mux", studio: "mux" },
  { id: "jk-toggle", title: "Configure the JK flip-flop to toggle", to: "/studios/flip-flops?tab=jk", studio: "latches" },
  { id: "siso", title: "Shift 1011 through a SISO register", to: "/studios/registers?tab=siso", studio: "registers" },
  { id: "mod6", title: "Design a MOD-6 counter", to: "/studios/counters?tab=design", studio: "counters" },
];

export function PracticePage() {
  const { prefs } = usePrefs();
  return (
    <div className="grid cards-2">
      {CHALLENGES.map((item) => {
        const studio = STUDIOS.find((entry) => entry.id === item.studio);
        return (
          <Link key={item.id} to={item.to} className={`card studio-card tone-${studio?.category ?? "foundations"}`}>
            <div className="studio-card-head">
              <StudioMark id={item.studio} />
              <span className="tiny">{prefs.challenges.includes(item.id) ? "Completed on this device" : "Open the lab"}</span>
            </div>
            <strong>{item.title}</strong>
          </Link>
        );
      })}
    </div>
  );
}

export function ProjectsPage() {
  const projects = [
    { to: "/studios/number-systems?tab=hamming", title: "Hamming encoder", summary: "Encode 4 data bits, flip one, and repair it.", studio: "numbers" },
    { to: "/studios/kmap?tab=circuit", title: "Shrink a circuit", summary: "Compare gate count before and after grouping.", studio: "kmap" },
    { to: "/studios/logic-gates?tab=universal", title: "NAND-only NOT, AND, OR", summary: "Match a basic gate with only NAND.", studio: "gates" },
    { to: "/studios/combinational", title: "Wire a half adder", summary: "Drop parts on the canvas and probe sum and carry.", studio: "combo" },
    { to: "/studios/counters?tab=mod", title: "MOD-6 counter", summary: "Count 0 through 5, then return to 0.", studio: "counters" },
  ];
  return (
    <div className="grid cards-3">
      {projects.map((item) => {
        const studio = STUDIOS.find((entry) => entry.id === item.studio);
        return (
          <Link key={item.to} className={`card studio-card tone-${studio?.category ?? "foundations"}`} to={item.to}>
            <StudioMark id={item.studio} />
            <strong>{item.title}</strong>
            <span className="muted">{item.summary}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function CheatPage() {
  const rows = [
    ["Two's complement", "Invert every bit, then add 1"],
    ["Gray code", "g = n XOR (n >> 1)"],
    ["Even parity", "Parity bit makes the count of 1s even"],
    ["Hamming(7,4)", "Parity bits sit at positions 1, 2, and 4 (1-based)"],
    ["De Morgan", "(AB)' = A' + B' and (A+B)' = A'B'"],
    ["K-map group", "Size must be a power of two, including wraparound"],
    ["IEEE-754 single", "1 sign, 8 exponent (bias 127), 23 fraction"],
    ["IEEE-754 double", "1 sign, 11 exponent (bias 1023), 52 fraction"],
    ["Setup / hold", "Setup is before the capturing edge; hold is after it"],
    ["Load / store", "Arithmetic stays in registers; only loads and stores touch data memory"],
    ["PC-relative (this CPU)", "Branch target is the branch's own PC plus a signed offset"],
    ["MESI Exclusive", "A private read of an invalid line becomes Exclusive when no other copy exists"],
  ];
  return (
    <Card title="Quick reference">
      <table className="data">
        <tbody>
          {rows.map(([name, rule]) => <tr key={name}><td style={{ textAlign: "left", fontWeight: 700 }}>{name}</td><td style={{ textAlign: "left" }}>{rule}</td></tr>)}
        </tbody>
      </table>
    </Card>
  );
}

export function NotesPage() {
  const { prefs, update, toggleBookmark } = usePrefs();
  return (
    <div className="grid cards-2">
      <Card title="Notebook">
        <textarea className="input" aria-label="Local notes" rows={10} value={prefs.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Notes stay in this browser." />
      </Card>
      <Card title="Bookmarks">
        {STUDIOS.filter((studio) => studio.active).map((studio) => (
          <div key={studio.id} className="spread" style={{ marginBottom: 8 }}>
            <Link to={studio.path} className="row" style={{ textDecoration: "none", color: "inherit" }}>
              <StudioMark id={studio.id} size={28} />
              {studio.title}
            </Link>
            <Toggle on={prefs.bookmarks.includes(studio.id)} onChange={() => toggleBookmark(studio.id)} label="Saved" tone="ok" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function UpcomingPage({ id }: { id: string }) {
  const studio = STUDIOS.find((item) => item.id === id);
  const { prefs, toggleBookmark } = usePrefs();
  if (!studio) return <Card title="Unknown studio"><p>That lab is not on the map.</p></Card>;
  return (
    <Card title={studio.title} action={<StudioMark id={studio.id} />}>
      <p className="muted">Phase {studio.phase} is on the map, but this studio is not built yet. The shell, signal language, and logic engines stay the same when it opens.</p>
      <p>{studio.summary}</p>
      <Toggle on={prefs.bookmarks.includes(studio.id)} onChange={() => toggleBookmark(studio.id)} label="Bookmark" tone="ok" />
    </Card>
  );
}
