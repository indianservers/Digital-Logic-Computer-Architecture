import { useState } from "react";
import { Link } from "react-router-dom";
import { MICROCONTROLLER_LABS, MICROCONTROLLER_SECTIONS } from "../../data/microcontrollerLabs";
import { PROJECT_LABS } from "./projectData";

export function MicrocontrollerStudio() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const labs = MICROCONTROLLER_LABS.filter((lab) =>
    `${lab.number} ${lab.title} ${lab.section}`.toLowerCase().includes(normalized),
  );

  return (
    <div className="microcontroller-studio">
      <header className="microcontroller-hero card">
        <span className="pill">Studio roadmap</span>
        <h1>Microcontroller Studio</h1>
        <p>Explore the path from MCU architecture and GPIO to firmware, real-time systems, and embedded projects.</p>
        <p className="tiny">{PROJECT_LABS.length} interactive project labs open · {MICROCONTROLLER_LABS.length - PROJECT_LABS.length} earlier labs planned.</p>
      </header>

      <label className="microcontroller-search">
        <span>Find a lab</span>
        <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search GPIO, PWM, UART, RTOS…" />
      </label>

      {MICROCONTROLLER_SECTIONS.map((section) => {
        const sectionLabs = labs.filter((lab) => lab.section === section);
        if (!sectionLabs.length) return null;
        return (
          <section className="microcontroller-section" key={section}>
            <h2>{section} <span className="tiny">{sectionLabs.length}</span></h2>
            <ol className="microcontroller-labs">
              {sectionLabs.map((lab) => {
                const project = PROJECT_LABS.find((item) => item.number === lab.number);
                return <li className="card" key={lab.number}>
                  <span className="microcontroller-number">{String(lab.number).padStart(2, "0")}</span>
                  {project ? <Link to={`/studios/microcontroller/project/${project.slug}`}><strong>{lab.title}</strong></Link> : <strong>{lab.title}</strong>}
                  <span className="pill">{project ? "Open lab" : "Planned"}</span>
                </li>;
              })}
            </ol>
          </section>
        );
      })}
      {labs.length === 0 ? <p className="muted">No planned lab matches that search.</p> : null}
    </div>
  );
}
