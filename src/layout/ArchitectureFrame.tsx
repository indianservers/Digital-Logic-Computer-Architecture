import type { ReactNode } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import { archLab, archStudio, labTheory } from "../data/architecture";
import { Icon } from "../design-system/icons";
import { Button, Card, Theory, Toggle } from "../design-system/ui";
import { usePrefs } from "../store/prefs";

export function ArchitectureFrame({ studioId, onReset, children }: { studioId: string; onReset?: () => void; children: ReactNode }) {
  const { labId } = useParams();
  const { prefs, update } = usePrefs();
  const studio = archStudio(studioId);
  const requested = labId ?? "overview";
  if (!studio) {
    return (
      <Card title="Unknown studio">
        <p>That architecture lab is not on the map.</p>
        <Link to="/" className="btn-primary">Back to Path</Link>
      </Card>
    );
  }
  const known = studio.labs.some((item) => item.id === requested);
  if (!known) return <Navigate to={studio.path} replace />;
  const lab = archLab(studioId, requested);
  if (!lab) {
    return (
      <Card title={studio.title}>
        <p>That lab is missing from this studio.</p>
        <Link to={studio.path} className="btn-primary">Studio Home</Link>
      </Card>
    );
  }
  return (
    <div className="studio arch-studio">
      <nav className="arch-menu" aria-label={`${studio.title} labs`}>
        <Link to="/" className="arch-home"><Icon name="home" size={14} /> Home</Link>
        <Link to={studio.path} className="arch-home"><Icon name="back" size={14} /> Studio Home</Link>
        <div className="nav-label">This studio</div>
        {studio.labs.map((item) => {
          const to = item.id === "overview" ? studio.path : `${studio.path}/${item.id}`;
          const current = labId ?? "overview";
          return (
            <NavLink key={item.id} to={to} end={item.id === "overview"} className={() => (current === item.id ? "arch-link active" : "arch-link")}>
              {item.title}
            </NavLink>
          );
        })}
      </nav>
      <div className="studio-main">
        <div className="spread">
          <div className="studio-head">
            <div className="studio-icon"><Icon name="grid" /></div>
            <div>
              <h1>{studio.title}</h1>
              <p>{lab.title} · {studio.summary}</p>
            </div>
          </div>
          <div className="row">
            <Link to={studio.path} className="btn-ghost"><Icon name="back" size={14} /> Studio Home</Link>
            <Link to="/" className="btn-ghost"><Icon name="home" size={14} /> Home</Link>
            <Toggle on={prefs.explain} onChange={(next) => update({ explain: next })} label="Explain" tone="primary" />
            {onReset ? <Button onClick={onReset}><Icon name="reset" size={14} />Reset</Button> : null}
          </div>
        </div>
        <Theory title={lab.title}>{labTheory(studio, lab)}</Theory>
        {children}
      </div>
      <aside className="guide">
        <section className="card">
          <h3><Icon name="book" size={16} /> Studio Guide</h3>
          <ol>
            {lab.guide.map((step, index) => (
              <li key={step}><span className="step-no">{index + 1}</span><span>{step}</span></li>
            ))}
          </ol>
        </section>
        <section className="card">
          <h3>Key Takeaways</h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            {lab.takeaways.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </aside>
    </div>
  );
}

export function ArchitectureLanding({ studioId }: { studioId: string }) {
  const studio = archStudio(studioId);
  if (!studio) {
    return (
      <Card title="Unknown studio">
        <p>That architecture lab is not on the map.</p>
        <Link to="/" className="btn-primary">Back to Path</Link>
      </Card>
    );
  }
  return (
    <div className="grid cards-3">
      {studio.labs.filter((item) => item.id !== "overview").map((lab) => (
        <Link key={lab.id} to={`${studio.path}/${lab.id}`} className="card studio-card">
          <strong>{lab.title}</strong>
          <p className="muted" style={{ margin: 0 }}>{lab.takeaways[0]}</p>
        </Link>
      ))}
    </div>
  );
}
