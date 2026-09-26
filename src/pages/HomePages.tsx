import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORIES, matchStudio, searchStudios, studioMatchesQuery, STUDIOS, type StudioInfo } from "../data/curriculum";
import { MASTER_CONCEPTS } from "../data/master";
import { StudioMark } from "../design-system/studioMarks";
import { Card, Toggle } from "../design-system/ui";
import { usePrefs } from "../store/prefs";
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

function minutesFor(count: number): number {
  return Math.min(40, 15 + Math.ceil(count / 2) * 5);
}

function destinationLabel(path: string, studio: StudioInfo): string {
  const tab = new URLSearchParams(path.split("?")[1] ?? "").get("tab");
  return tab ? `${studio.title} · ${tab}` : studio.title;
}

function StudioCard({ studio, visited, next, preview }: { studio: StudioInfo; visited: boolean; next: boolean; preview: boolean }) {
  const count = conceptCount(studio);
  const minutes = minutesFor(count);
  const body = (
    <>
      <div className="studio-card-head">
        <StudioMark id={studio.id} />
        {studio.active ? <span className="pill ok">{visited ? "Visited" : "Open"}</span> : <span className="lock">Phase {studio.phase}</span>}
      </div>
      <strong>{studio.title}</strong>
      <p className="studio-action">{studio.summary.split(".")[0]}</p>
      <span className="tiny">Phase {studio.phase} · about {minutes} min{count ? ` · ${count} concepts` : ""}</span>
      {preview ? <span className="studio-preview">Opens {destinationLabel(studio.path, studio)}. {studio.summary}</span> : null}
    </>
  );
  const className = `card studio-card tone-${studio.category}${studio.active ? "" : " is-locked"}${next ? " is-next" : ""}`;
  if (!studio.active) return <div className={className} aria-disabled="true">{body}</div>;
  return <Link to={studio.path} className={className}>{body}</Link>;
}

const CHIP: Record<string, string> = {
  foundations: "Foundations",
  combinational: "Combinational",
  sequential: "Sequential",
  memory: "Memory",
  processor: "Processor",
  systems: "Systems",
  architecture: "Architecture",
  isa: "ISA",
  build: "Build",
};

function Catalog({ home }: { home: boolean }) {
  const { prefs } = usePrefs();
  const [filter, setFilter] = useState<"all" | "open" | "upcoming">("all");
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<string[]>([]);
  const openStudios = STUDIOS.filter((studio) => studio.active);
  const upcoming = STUDIOS.filter((studio) => !studio.active);
  const resume = matchStudio(prefs.lastPath);
  const resumeStudio = resume?.active ? resume : openStudios[0];
  const resumePath = resume?.active ? prefs.lastPath : resumeStudio?.path ?? "/studios/number-systems";
  const firstVisit = prefs.visited.length === 0;
  const nextStudio = openStudios.find((studio) => !prefs.visited.includes(studio.id)) ?? openStudios[0];
  const challenge = CHALLENGES.find((item) => !prefs.challenges.includes(item.id)) ?? CHALLENGES[0];
  const done = Math.min(prefs.challenges.length, PRACTICE_COUNT);
  const progress = Math.min(100, Math.round((done / PRACTICE_COUNT) * 100));
  const saved = STUDIOS.filter((studio) => prefs.bookmarks.includes(studio.id));
  const path = openStudios.slice(0, 5);
  const navigate = useNavigate();
  const [activeHit, setActiveHit] = useState(0);
  const hits = useMemo(() => searchStudios(query), [query]);
  const matches = useMemo(() => (studio: StudioInfo) => studioMatchesQuery(studio, query), [query]);

  return (
    <div className="home">
      {home && resumeStudio ? (
        <section className="home-hero-card">
          <div className="home-hero-copy">
            <div className="tiny">LEARN · BUILD · THINK</div>
            <h1>Digital Logic & Computer Architecture</h1>
            <p className="muted">Change an input and the lab’s engine updates the picture. Progress and notes stay in this browser, which is what Offline Ready means.</p>
            <div className="row" style={{ marginTop: 12 }}>
              {firstVisit ? <Link to="/studios/number-systems" className="btn-primary">Start here · Number Systems</Link> : (
                <Link to={resumePath} className="btn-primary" title={`Opens ${destinationLabel(resumePath, resumeStudio)}`}>Continue · {resumeStudio.title}</Link>
              )}
              <Link to="/learn" className="btn-ghost">Learning Path</Link>
            </div>
            <p className="tiny home-dest">{firstVisit ? "First lab opens the number converter." : `Opens ${destinationLabel(resumePath, resumeStudio)}.`}</p>
            <div className="home-next">
              {nextStudio ? <Link to={nextStudio.path}>Next lab · {nextStudio.title}</Link> : null}
              {challenge ? <Link to={challenge.to}>Try · {challenge.title}</Link> : null}
            </div>
            <div className="home-progress">
              <div className="spread tiny"><span>Practice {done} of {PRACTICE_COUNT}</span><b>{progress}%</b></div>
              <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
              <span className="tiny">{prefs.badges.length} badges</span>
            </div>
            <div className="home-stats">
              <Link to="/studios"><b>{openStudios.length}</b><span>open studios</span></Link>
              <a href="#cat-foundations"><b>{CATEGORIES.length}</b><span>categories</span></a>
              <Link to="/cheat-sheet"><b>{MASTER_CONCEPTS.length}</b><span>concepts</span></Link>
            </div>
          </div>
          <img className="home-hero-art" src="/icons/home-hero.png" width={640} height={280} alt="Colorful LogicLab workshop with gates, bits, a CPU, and a bus" />
        </section>
      ) : (
        <header className="home-catalog-head">
          <h1>Studios</h1>
          <p className="muted">Every open lab, grouped by topic. Upcoming labs stay on the map at the bottom.</p>
        </header>
      )}
      {home && saved.length > 0 ? (
        <section className="home-saved">
          <h2>Saved</h2>
          <div className="home-saved-row">
            {saved.map((studio) => <Link key={studio.id} to={studio.path}><StudioMark id={studio.id} size={28} />{studio.title}</Link>)}
          </div>
        </section>
      ) : null}
      {home ? (
        <section className="home-path">
          <h2>Start with these five</h2>
          <ol>
            {path.map((studio, index) => (
              <li key={studio.id}><Link to={studio.path}><b>{index + 1}</b>{studio.title}</Link></li>
            ))}
          </ol>
        </section>
      ) : null}
      <div className="home-tools">
        <div className="home-search-wrap">
          <input
            aria-label="Search labs"
            aria-autocomplete="list"
            aria-expanded={hits.length > 0}
            aria-controls="home-search-list"
            className="home-search"
            placeholder="Search labs, e.g. Karnaugh, CLA, Booth, Wallace"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveHit(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveHit((index) => Math.min(hits.length - 1, index + 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveHit((index) => Math.max(0, index - 1)); }
              const chosen = hits[activeHit] ?? hits[0];
              if (event.key === "Enter" && chosen?.active) navigate(chosen.path);
              if (event.key === "Escape") setQuery("");
            }}
          />
          {query.trim() && hits.length > 0 ? (
            <div id="home-search-list" className="search-pop home-search-pop" role="listbox">
              {hits.map((hit, index) => (
                <button key={hit.id} type="button" role="option" aria-selected={index === activeHit} className={index === activeHit ? "on" : ""} disabled={!hit.active} onMouseEnter={() => setActiveHit(index)} onClick={() => { if (hit.active) navigate(hit.path); }}>
                  {hit.title}
                  <div className="tiny">{hit.active ? hit.summary : `Phase ${hit.phase} · upcoming`}</div>
                </button>
              ))}
            </div>
          ) : null}
          {query.trim().length >= 2 && hits.length === 0 ? <p className="tiny home-search-empty">No lab matches that name.</p> : null}
        </div>
        <div className="home-filters" role="group" aria-label="Studio status">
          {(["all", "open", "upcoming"] as const).map((item) => (
            <button key={item} type="button" className={filter === item ? "on" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : item === "open" ? "Open" : "Upcoming"}</button>
          ))}
        </div>
      </div>
      <nav className="home-jumps" aria-label="Categories">
        {CATEGORIES.map((category) => <a key={category.id} href={`#cat-${category.id}`}>{CHIP[category.id]}</a>)}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Top</button>
      </nav>
      {filter !== "upcoming" ? CATEGORIES.map((category) => {
        const items = STUDIOS.filter((studio) => studio.category === category.id && studio.active && matches(studio));
        if (items.length === 0) return null;
        const folded = closed.includes(category.id);
        const nextId = items.find((studio) => !prefs.visited.includes(studio.id))?.id;
        return (
          <section key={category.id} id={`cat-${category.id}`} className={`home-cat tone-${category.id}`}>
            <header className="home-cat-head">
              <img src={category.art} width={72} height={72} alt="" />
              <div>
                <h2>{category.title}</h2>
                <p className="muted">{category.blurb}</p>
              </div>
              <button type="button" className="pill" aria-expanded={!folded} onClick={() => setClosed((current) => folded ? current.filter((id) => id !== category.id) : [...current, category.id])}>{items.length} open</button>
            </header>
            {folded ? null : (
              <div className="grid cards-3">
                {items.map((studio) => <StudioCard key={studio.id} studio={studio} visited={prefs.visited.includes(studio.id)} next={studio.id === nextId} preview />)}
              </div>
            )}
          </section>
        );
      }) : null}
      {filter !== "open" ? (
        <section className="home-upcoming" id="upcoming">
          <h2>On the map</h2>
          <p className="muted">These labs are listed so the path stays complete. They do not open yet.</p>
          <div className="grid cards-3">
            {upcoming.filter(matches).map((studio) => <StudioCard key={studio.id} studio={studio} visited={false} next={false} preview={false} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function HomePage() {
  return <Catalog home />;
}

export function StudiosPage() {
  return <Catalog home={false} />;
}

export function LearnPage() {
  return (
    <div className="home">
      <p className="muted" style={{ marginTop: 0 }}>The path follows the same topics as Home. GPU stays on the map until that studio is built.</p>
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
