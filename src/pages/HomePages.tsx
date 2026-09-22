import { Link } from "react-router-dom";
import { STUDIOS } from "../data/curriculum";
import { Card } from "../design-system/ui";
import { usePrefs } from "../store/prefs";

export function HomePage() {
  const active = STUDIOS.filter((studio) => studio.active);
  const locked = STUDIOS.filter((studio) => !studio.active);
  const { prefs } = usePrefs();
  return (
    <div>
      <div className="home-hero">
        <div>
          <div className="tiny">PHASES 1–4 · LOGIC THROUGH PIPELINED EXECUTION</div>
          <h1>Digital Logic & Computer Architecture</h1>
          <p className="muted">Learn by changing the system. Toggle bits, edit expressions, and watch the result update.</p>
        </div>
        <Link to={prefs.lastPath.startsWith("/studios") ? prefs.lastPath : "/studios/number-systems"} className="btn-primary">Continue</Link>
      </div>
      <div className="grid cards-3">
        {active.map((studio) => (
          <Link key={studio.id} to={studio.path} className="card studio-card">
            <div className="spread"><strong>{studio.title}</strong><span className="pill ok">Open</span></div>
            <p className="muted" style={{ margin: 0 }}>{studio.summary}</p>
            <span className="tiny">{studio.topics.slice(0, 3).join(" · ")}</span>
          </Link>
        ))}
      </div>
      <h2 style={{ margin: "18px 0 10px", fontSize: 16 }}>Upcoming studios</h2>
      <div className="grid cards-4">
        {locked.map((studio) => (
          <Link key={studio.id} to={studio.path} className="card studio-card">
            <div className="spread"><strong>{studio.title}</strong><span className="lock">Phase {studio.phase}</span></div>
            <p className="muted" style={{ margin: 0 }}>{studio.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function StudiosPage() {
  return <HomePage />;
}

export function LearnPage() {
  const phases = [1, 2, 3, 4];
  return (
    <div className="grid cards-2">
      {phases.map((phase) => (
        <Card key={phase} title={`Phase ${phase} path`}>
          <ol>
            {STUDIOS.filter((studio) => studio.phase === phase && studio.active).map((studio, index) => (
              <li key={studio.id} style={{ marginBottom: 8 }}>
                <Link to={studio.path}><strong>{index + 1}. {studio.title}</strong></Link>
                <div className="tiny">{studio.summary}</div>
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

const CHALLENGES = [
  { id: "hex-7f", title: "Convert 7F to 8-bit binary", to: "/studios/number-systems?tab=convert" },
  { id: "twos", title: "Show −5 in two's complement", to: "/studios/number-systems?tab=signed" },
  { id: "hamming", title: "Correct a Hamming(7,4) bit", to: "/studios/number-systems?tab=hamming" },
  { id: "absorb", title: "Simplify A + AB", to: "/studios/boolean-algebra?tab=simplify" },
  { id: "xor", title: "Find when XOR is high", to: "/studios/logic-gates?tab=build" },
  { id: "kmap", title: "Group a wraparound pair", to: "/studios/kmap?tab=map" },
  { id: "adder-2", title: "Add two bits and read the carry", to: "/studios/adders?tab=half" },
  { id: "mux-d3", title: "Route I3 through a multiplexer", to: "/studios/routing?tab=mux" },
  { id: "jk-toggle", title: "Configure the JK flip-flop to toggle", to: "/studios/flip-flops?tab=jk" },
  { id: "siso", title: "Shift 1011 through a SISO register", to: "/studios/registers?tab=siso" },
  { id: "mod6", title: "Design a MOD-6 counter", to: "/studios/counters?tab=design" },
];

export function PracticePage() {
  const { prefs } = usePrefs();
  return (
    <div className="grid cards-2">
      {CHALLENGES.map((item) => (
        <Link key={item.id} to={item.to} className="card studio-card">
          <strong>{item.title}</strong>
          <span className="tiny">{prefs.challenges.includes(item.id) ? "Completed on this device" : "Open the lab"}</span>
        </Link>
      ))}
    </div>
  );
}

export function ProjectsPage() {
  return (
    <div className="grid cards-3">
      <Link className="card studio-card" to="/studios/number-systems?tab=hamming"><strong>Hamming encoder</strong><span className="muted">Encode 4 data bits, flip one, and repair it.</span></Link>
      <Link className="card studio-card" to="/studios/kmap?tab=circuit"><strong>Shrink a circuit</strong><span className="muted">Compare gate count before and after grouping.</span></Link>
      <Link className="card studio-card" to="/studios/logic-gates?tab=universal"><strong>NAND-only NOT, AND, OR</strong><span className="muted">Match a basic gate with only NAND.</span></Link>
      <Link className="card studio-card" to="/studios/combinational"><strong>Wire a half adder</strong><span className="muted">Drop parts on the canvas and probe sum and carry.</span></Link>
      <Link className="card studio-card" to="/studios/counters?tab=mod"><strong>MOD-6 counter</strong><span className="muted">Count 0 through 5, then return to 0.</span></Link>
    </div>
  );
}

export function CheatPage() {
  const rows = [
    ["Two's complement", "Invert every bit, then add 1"],
    ["Gray code", "g = n XOR (n >> 1)"],
    ["Even parity", "Parity bit makes the count of 1s even"],
    ["De Morgan", "(AB)' = A' + B' and (A+B)' = A'B'"],
    ["K-map group", "Size must be a power of two, including wraparound"],
    ["IEEE-754 single", "1 sign, 8 exponent (bias 127), 23 fraction"],
  ];
  return (
    <Card title="Phase 1 reference">
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
            <Link to={studio.path}>{studio.title}</Link>
            <button className="btn-ghost" onClick={() => toggleBookmark(studio.id)}>{prefs.bookmarks.includes(studio.id) ? "Saved" : "Save"}</button>
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
    <Card title={studio.title}>
      <p className="muted">Phase {studio.phase} reuses this shell, the signal language, and the logic engine. The lab itself is not part of Phase 1.</p>
      <p>{studio.summary}</p>
      <button className="btn-primary" onClick={() => toggleBookmark(studio.id)}>{prefs.bookmarks.includes(studio.id) ? "Bookmarked" : "Bookmark for later"}</button>
    </Card>
  );
}
