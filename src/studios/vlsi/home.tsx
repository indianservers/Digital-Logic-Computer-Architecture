import { useEffect, useRef, useState, type ReactElement } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { VLSI_CATEGORIES, VLSI_LABS, vlsiLabBySlug, vlsiRoute, type VlsiCategory, type VlsiLabMeta } from "../../data/vlsiLabs";
import { CATEGORY_COLOR, DIFFICULTIES, DURATIONS, LEARNING_PATHS, labMatches } from "./content";
import { pathRoute } from "./learning";
import { labStatus, useVlsiProgress, useVlsiTheme, type LabStatus, type VlsiProgress } from "./store";
import { VIcon } from "./vlsiIcons";
import { useMedia } from "./widgets";

const MARKS: Record<VlsiCategory, string> = {
  device: "M3 12h10M8 12V4M5 7h6",
  cmos: "M3 4h4v8H3zM9 4h4v8H9z",
  timing: "M2 12c2-8 4-8 6 0s4 8 6 0",
  layout: "M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z",
  cells: "M2 4h12v8H2zM6 4v8M10 4v8",
  physical: "M3 13V5l5-2 5 2v8l-5 2z",
  power: "M8 2v6l3-1-4 7V8L4 9z",
  memory: "M3 3h10v10H3zM3 6h10M3 10h10",
  advanced: "M8 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z",
  fab: "M8 2a6 6 0 100 12 6 6 0 000-12zM8 2v12",
  dft: "M2 8h3l2-4 2 8 2-4h3",
  soc: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z",
  flow: "M2 3h5v3H2zM9 7h5v3H9zM2 11h5v3H2zM7 4h2M9 8H7M7 12h2",
};

export function CategoryMark({ category }: { category: VlsiCategory }) {
  return (
    <svg className="vlsi-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d={MARKS[category]} fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

const STATUS_TEXT: Record<LabStatus, string> = { done: "Done", visited: "Started", new: "" };

function LabCard({ lab, status, canPreview, renderPreview }: {
  lab: VlsiLabMeta;
  status: LabStatus;
  canPreview: boolean;
  renderPreview: (slug: string) => ReactElement | null;
}) {
  const [preview, setPreview] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div
      className="vlsi-card-wrap"
      onMouseEnter={() => {
        if (!canPreview) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPreview(true), 650);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setPreview(false);
      }}
    >
      <Link className={`vlsi-card ${status}`} to={vlsiRoute(lab.slug)} style={{ ["--cat" as string]: CATEGORY_COLOR[lab.category] }}>
        <span className="vlsi-card-top">
          <CategoryMark category={lab.category} />
          <span>Lab {lab.number}</span>
          {status !== "new" ? <span className={`vlsi-pill ${status}`}>{status === "done" ? <VIcon name="check" size={11} /> : null}{STATUS_TEXT[status]}</span> : null}
        </span>
        <strong>{lab.title}</strong>
        <em>{lab.summary}</em>
        <span className="vlsi-card-meta">
          <span className={`vlsi-diff ${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span>
          <span>{lab.minutes} min</span>
        </span>
      </Link>
      {preview ? (
        <div className="vlsi-preview" aria-hidden="true">
          <div className="vlsi-preview-inner" inert>{renderPreview(lab.slug)}</div>
          <span className="vlsi-preview-label">Live preview · Lab {lab.number}</span>
        </div>
      ) : null}
    </div>
  );
}

function categoryProgress(progress: VlsiProgress, category: VlsiCategory) {
  const labs = VLSI_LABS.filter((lab) => lab.implemented && lab.category === category);
  return { total: labs.length, done: labs.filter((lab) => progress.completed.includes(lab.slug)).length };
}

export function VlsiHome({ renderPreview }: { renderPreview: (slug: string) => ReactElement | null }) {
  const location = useLocation();
  const progress = useVlsiProgress();
  const [theme, toggleTheme] = useVlsiTheme();
  const canPreview = useMedia("(hover: hover) and (min-width: 1000px)");
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<VlsiCategory | "all">("all");
  const [difficulty, setDifficulty] = useState("all");
  const [duration, setDuration] = useState("all");
  const [statusFilter, setStatusFilter] = useState<LabStatus | "all">("all");

  const open = VLSI_LABS.filter((lab) => lab.implemented);
  const filtering = query.trim() !== "" || category !== "all" || difficulty !== "all" || duration !== "all" || statusFilter !== "all";
  const filtered = open.filter((lab) =>
    labMatches(lab, query)
    && (category === "all" || lab.category === category)
    && (difficulty === "all" || lab.difficulty === difficulty)
    && (duration === "all" || Boolean(DURATIONS.find((item) => item.id === duration)?.test(lab.minutes)))
    && (statusFilter === "all" || labStatus(progress, lab.slug) === statusFilter));
  const groups = VLSI_CATEGORIES.map((item) => ({ category: item, labs: filtered.filter((lab) => lab.category === item.id) })).filter((group) => group.labs.length > 0);
  const later = VLSI_CATEGORIES.filter((item) => !open.some((lab) => lab.category === item.id));
  const doneCount = open.filter((lab) => progress.completed.includes(lab.slug)).length;
  const lastLab = progress.last ? vlsiLabBySlug(progress.last) : undefined;
  const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setDifficulty("all");
    setDuration("all");
    setStatusFilter("all");
  };

  const jump = (id: VlsiCategory) => {
    clearFilters();
    window.requestAnimationFrame(() => document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior, block: "start" }));
  };

  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return;
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  }, [location.hash]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="vlsi vlsi-homepage" data-theme={theme}>
      <header className="vlsi-hero">
        <div className="vlsi-hero-top">
          <p>VLSI Studio</p>
          <button type="button" className="vlsi-theme-btn" aria-pressed={theme === "dark"} onClick={toggleTheme}>
            <VIcon name={theme === "dark" ? "sun" : "moon"} />{theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
        <h1>From transistor physics to silicon implementation</h1>
        <p>Change a voltage, a width, or a logic input and watch the silicon respond. {open.length} labs are open.{later.length > 0 ? " The rest of the sequence stays listed until its simulator is ready." : " Every lab in the sequence has a simulator."}</p>
        <div className="vlsi-progress" aria-label={`${doneCount} of ${open.length} labs completed`}>
          <span style={{ width: `${(doneCount / Math.max(1, open.length)) * 100}%` }} />
        </div>
        <small className="vlsi-progress-text">{doneCount} of {open.length} completed · {progress.visited.length} started</small>
      </header>

      {lastLab ? (
        <Link className="vlsi-continue" to={vlsiRoute(lastLab.slug)} style={{ ["--cat" as string]: CATEGORY_COLOR[lastLab.category] }}>
          <span>Continue where you left off</span>
          <b>Lab {lastLab.number} · {lastLab.title}</b>
          <em>{labStatus(progress, lastLab.slug) === "done" ? "Completed. Open it again or move on." : "Pick up the experiment."} →</em>
        </Link>
      ) : null}

      <section className="vlsi-home-block" aria-labelledby="vlsi-flow-title">
        <h2 id="vlsi-flow-title">The whole flow</h2>
        <p className="vlsi-block-sub">Each stage builds on the one before it. Select a stage to jump to its labs.</p>
        <ol className="vlsi-flowmap">
          {VLSI_CATEGORIES.map((item) => {
            const stats = categoryProgress(progress, item.id);
            return (
              <li key={item.id}>
                <button type="button" style={{ ["--cat" as string]: CATEGORY_COLOR[item.id] }} onClick={() => jump(item.id)} disabled={stats.total === 0}>
                  <CategoryMark category={item.id} />
                  <b>{item.title}</b>
                  <small>{stats.done}/{stats.total} done</small>
                  <i><span style={{ width: `${(stats.done / Math.max(1, stats.total)) * 100}%` }} /></i>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="vlsi-home-block" aria-labelledby="vlsi-paths-title">
        <h2 id="vlsi-paths-title">Learning paths</h2>
        <p className="vlsi-block-sub">Curated routes through the labs. The step bar inside each lab keeps your place.</p>
        <div className="vlsi-paths">
          {LEARNING_PATHS.map((path) => {
            const done = path.slugs.filter((slug) => progress.completed.includes(slug)).length;
            const nextSlug = path.slugs.find((slug) => !progress.completed.includes(slug)) ?? path.slugs[0] ?? "";
            return (
              <article key={path.id} className="vlsi-path-card">
                <h3>{path.title}</h3>
                <p>{path.blurb}</p>
                <ol className="vlsi-steps" aria-label={`${done} of ${path.slugs.length} steps done`}>
                  {path.slugs.map((slug, index) => (
                    <li key={slug}>
                      <Link to={pathRoute(slug, path.id)} className={labStatus(progress, slug)} title={vlsiLabBySlug(slug)?.title}>{index + 1}</Link>
                    </li>
                  ))}
                </ol>
                <Link className="vlsi-path-go" to={pathRoute(nextSlug, path.id)}>
                  {done === 0 ? "Start path" : done === path.slugs.length ? "Review path" : `Continue · ${vlsiLabBySlug(nextSlug)?.title ?? ""}`} →
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <div className="vlsi-filterbar">
        <div className="vlsi-filters">
          <label className="vlsi-search">
            <Icon name="search" size={14} />
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search labs: SRAM, slack, FinFET…  ( / )" aria-label="Search labs" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value as VlsiCategory | "all")} aria-label="Category">
            <option value="all">All categories</option>
            {VLSI_CATEGORIES.filter((item) => !later.includes(item)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Difficulty">
            <option value="all">Any difficulty</option>
            {DIFFICULTIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={duration} onChange={(event) => setDuration(event.target.value)} aria-label="Duration">
            <option value="all">Any length</option>
            {DURATIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LabStatus | "all")} aria-label="Progress">
            <option value="all">Any progress</option>
            <option value="new">Not started</option>
            <option value="visited">Started</option>
            <option value="done">Completed</option>
          </select>
          <span className="vlsi-count" aria-live="polite">{filtering ? `${filtered.length} of ${open.length} labs` : `${open.length} labs`}</span>
          {filtering ? <button type="button" onClick={clearFilters}>Clear</button> : null}
        </div>
        <nav className="vlsi-jump" aria-label="Jump to category">
          {VLSI_CATEGORIES.filter((item) => !later.includes(item)).map((item) => (
            <button key={item.id} type="button" style={{ ["--cat" as string]: CATEGORY_COLOR[item.id] }} onClick={() => jump(item.id)}>{item.title}</button>
          ))}
        </nav>
      </div>

      {groups.map(({ category: item, labs }) => {
        const stats = categoryProgress(progress, item.id);
        return (
          <section key={item.id} id={`cat-${item.id}`} className="vlsi-home-cat" style={{ ["--cat" as string]: CATEGORY_COLOR[item.id] }}>
            <div className="vlsi-cat-head">
              <h2><CategoryMark category={item.id} />{item.title}</h2>
              <span>{stats.done}/{stats.total} done</span>
            </div>
            <p>{item.blurb}</p>
            <div className="vlsi-cards">
              {labs.map((lab) => <LabCard key={lab.slug} lab={lab} status={labStatus(progress, lab.slug)} canPreview={canPreview} renderPreview={renderPreview} />)}
            </div>
          </section>
        );
      })}

      {groups.length === 0 ? (
        <section className="vlsi-home-cat vlsi-empty">
          <h2>No lab matches those filters</h2>
          <p>Try a broader word, or clear the filters.</p>
          <button type="button" onClick={clearFilters}>Clear filters</button>
        </section>
      ) : null}

      {later.length > 0 && !filtering ? (
        <section className="vlsi-later">
          <h2>Later in this studio</h2>
          <ul>{later.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}
