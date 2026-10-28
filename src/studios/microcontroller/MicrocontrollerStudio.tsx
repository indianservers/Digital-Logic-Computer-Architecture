import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MICROCONTROLLER_SECTIONS } from "../../data/microcontrollerLabs";
import { Icon } from "../../design-system/icons";
import { MCU_CATALOGUE, MCU_OPEN_LABS } from "./catalogue";
import { LAB_META } from "./labs/registry";
import { PROJECT_LABS } from "./projectData";
import "./directory.css";

type Availability = "all" | "open" | "planned";

export function MicrocontrollerStudio() {
  useSimulatorCapture("studios/microcontroller/MicrocontrollerStudio.tsx:MicrocontrollerStudio", () => ({ availability }), "e421d6273347");

  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<Availability>("open");
  const normalized = query.trim().toLowerCase();
  const labs = MCU_CATALOGUE.filter((lab) =>
    (availability === "all" || lab.status === availability)
    && `${lab.number} ${lab.title} ${lab.section} ${lab.kind}`.toLowerCase().includes(normalized),
  );
  const planned = MCU_CATALOGUE.length - MCU_OPEN_LABS.length;
  const first = MCU_OPEN_LABS[0];

  return (
    <div className="microcontroller-studio mcu-directory">
      <header className="microcontroller-hero">
        <div>
          <span className="mcu-eyebrow"><Icon name="grid" size={16} /> EMBEDDED SYSTEMS LAB</span>
          <h1>Build an understanding.<br /><em>Then build a system.</em></h1>
          <p>Microcontroller Studio · Explore firmware, registers, signals, and working embedded projects in interactive browser labs.</p>
          <div className="mcu-hero-actions">
            {first?.path && <Link className="mcu-primary" to={first.path}>Start with fundamentals <Icon name="play" size={16} /></Link>}
            <a href="#mcu-labs" className="mcu-secondary">Browse labs ↓</a>
          </div>
        </div>
        <div className="mcu-chip-map" aria-label="Microcontroller teaching block diagram">
          <span className="mcu-chip-heading">MICROCONTROLLER</span>
          <div><strong>CPU</strong><strong>Flash / SRAM</strong><strong>GPIO</strong><strong>Timers / PWM</strong><strong>ADC / DAC</strong><strong>UART / SPI / I²C</strong></div>
          <small>Firmware → registers → peripherals → signals</small>
        </div>
      </header>
      <div className="mcu-summary" aria-label="Lab availability">
        <div><strong>{LAB_META.length}</strong><span>Open core labs</span></div>
        <div><strong>{PROJECT_LABS.length}</strong><span>Open project labs</span></div>
        <div><strong>{planned || MCU_OPEN_LABS.length}</strong><span>{planned ? "Planned labs" : "Labs ready to explore"}</span></div>
        <p>Choose a lab, predict the behavior, then run and inspect the result. {planned ? "Planned labs stay visible in the roadmap." : "Every core and project lab is now open, including RTOS, instruments, and MCU families."}</p>
      </div>
      <section id="mcu-labs" className="mcu-browser" aria-labelledby="mcu-browser-title">
        <div className="mcu-browser-heading"><div><span className="mcu-eyebrow">YOUR WORKBENCH</span><h2 id="mcu-browser-title">Choose an experiment</h2></div><Link to="/studios">All studios →</Link></div>
        <div className="mcu-filters">
          <label className="microcontroller-search"><span>Find a lab</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search GPIO, PWM, UART, RTOS…" /></label>
          <div className="mcu-availability" role="group" aria-label="Filter lab availability">
            {planned ? ([['open', 'Open labs'], ['all', 'All labs'], ['planned', 'Planned']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={availability === value} onClick={() => setAvailability(value)}>{label}</button>) : <span className="mcu-status open">All {MCU_OPEN_LABS.length} labs open</span>}
          </div>
        </div>
        <p className="mcu-results" role="status">{labs.length} {labs.length === 1 ? "lab" : "labs"} shown · {MCU_OPEN_LABS.length} open in total</p>
        {MICROCONTROLLER_SECTIONS.map((section) => {
          const sectionLabs = labs.filter((lab) => lab.section === section);
          if (!sectionLabs.length) return null;
          return <section className="microcontroller-section" key={section}>
            <h2>{section} <span>{sectionLabs.length}</span></h2>
            <ol className="microcontroller-labs">
              {sectionLabs.map((lab) => {
                const content = <><div className="mcu-lab-top"><span className="microcontroller-number">{String(lab.number).padStart(2, "0")}</span><span className={`mcu-status ${lab.status}`}>{lab.path ? "Open lab" : "Planned"}</span></div><h3>{lab.title}</h3><div className="mcu-lab-bottom"><span>{lab.kind}</span><span>{lab.path ? "Explore & simulate →" : "Simulator not available yet"}</span></div></>;
                return <li key={lab.number} value={lab.number}>{lab.path ? <Link className="mcu-lab-card" to={lab.path}>{content}</Link> : <div className="mcu-lab-card mcu-planned">{content}</div>}</li>;
              })}
            </ol>
          </section>;
        })}
        {labs.length === 0 && <div className="mcu-empty"><h3>No labs match these filters</h3><p>Try a different topic or include all labs.</p><button type="button" onClick={() => { setQuery(""); setAvailability("all"); }}>Clear filters</button></div>}
      </section>
    </div>
  );
}
