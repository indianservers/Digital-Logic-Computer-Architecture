import { Link, Navigate, useParams } from "react-router-dom";
import { ACA_CATEGORIES, ACA_HOME, ACA_LABS, acaCategory, acaLab, acaRoute } from "../../data/acaLabs";
import { AcaIcon } from "./icons";
import { AcaNav } from "./shell";

export function AcaStudio() {
  const { labId } = useParams();
  if (!labId) return <AcaHome />;
  const lab = acaLab(labId);
  if (!lab) return <Navigate to={ACA_HOME} replace />;
  const index = ACA_LABS.findIndex((item) => item.slug === lab.slug);
  const previous = ACA_LABS[index - 1];
  const next = ACA_LABS[index + 1];
  const category = acaCategory(lab.category);
  return (
    <div className="aca-studio">
      <AcaNav current={lab.category} />
      <header className="aca-page-head">
        <AcaIcon name={lab.id} label={lab.title} />
        <div>
          <p className="aca-kicker">{category.title}</p>
          <h1>{lab.title}</h1>
          <p>{lab.description}</p>
        </div>
      </header>
      <div className="aca-page-links">
        <Link to={ACA_HOME}>Back to Advanced Computer Architecture</Link>
        {previous ? <Link to={acaRoute(previous.slug)}>Previous: {previous.title}</Link> : <span />}
        {next ? <Link to={acaRoute(next.slug)}>Next: {next.title}</Link> : null}
      </div>
      <div className="aca-workspace">
        <aside className="aca-panel" aria-label="Controls">
          <h2>Controls</h2>
          <p>Setup for this laboratory will be added with the interactive simulation.</p>
        </aside>
        <section className="aca-panel aca-stage" aria-label="Visualization">
          <h2>Visualization</h2>
          <p>The main workspace is reserved for the lab diagram.</p>
        </section>
      </div>
      <section className="aca-panel" aria-label="Observations">
        <h2>Observations</h2>
        <p>Metrics and explanations will appear here once the simulation is connected. No results are shown yet.</p>
      </section>
    </div>
  );
}

function AcaHome() {
  return (
    <div className="aca-studio">
      <AcaNav current="home" />
      <header className="aca-page-head">
        <AcaIcon name="studio" label="Advanced Computer Architecture" />
        <div>
          <h1>Advanced Computer Architecture</h1>
          <p>Interactive virtual laboratories for modern processor architecture, dynamic scheduling, branch prediction, memory systems, coherence, multicore processing, and performance analysis.</p>
        </div>
      </header>
      {ACA_CATEGORIES.map((category) => {
        const labs = ACA_LABS.filter((lab) => lab.category === category.id);
        return (
          <section key={category.id} id={category.id} className="aca-category" aria-labelledby={`aca-${category.id}`}>
            <header>
              <AcaIcon name={category.id} label={category.title} />
              <div>
                <h2 id={`aca-${category.id}`}>{category.title}</h2>
                <p>{category.description}</p>
              </div>
              <span>{labs.length} labs</span>
            </header>
            <ul>
              {labs.map((lab) => (
                <li key={lab.id}>
                  <Link to={acaRoute(lab.slug)}>
                    <AcaIcon name={lab.id} />
                    <span>
                      <strong>{lab.title}</strong>
                      <small>{lab.description}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
