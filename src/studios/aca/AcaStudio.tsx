import { Link, Navigate, useParams } from "react-router-dom";
import { ACA_CATEGORIES, ACA_HOME, ACA_LABS, acaCategory, acaLab, acaRoute } from "../../data/acaLabs";
import { AcaIcon } from "./icons";
import { AcaNav } from "./shell";
import { DataHazardsLab, StudioTop } from "./labs/HazardLab";
import { ScoreboardLab } from "./labs/ScoreboardLab";
import { TomasuloLab } from "./labs/TomasuloLab";
import { RenameLab } from "./labs/RenameLab";
import { OooLab } from "./labs/OooLab";
import { PredictorLab } from "./labs/PredictorLab";
import { CorrelateLab } from "./labs/CorrelateLab";
import { BtbLab } from "./labs/BtbLab";
import { TournamentLab } from "./labs/TournamentLab";
import { SpeculateLab } from "./labs/SpeculateLab";
import { SuperscalarLab } from "./labs/SuperscalarLab";
import { IssueQueueLab } from "./labs/IssueQueueLab";
import { PrfLab } from "./labs/PrfLab";
import { LsqLab } from "./labs/LsqLab";
import { DisambigLab } from "./labs/DisambigLab";
import { PortLab } from "./labs/PortLab";
import { MesiLab } from "./labs/MesiLab";
import { MoesiLab } from "./labs/MoesiLab";
import { DirectoryLab } from "./labs/DirectoryLab";
import { FalseShareLab } from "./labs/FalseShareLab";
import { TrafficLab } from "./labs/TrafficLab";
import { SnoopLab } from "./labs/SnoopLab";
import { MshrLab } from "./labs/MshrLab";
import { PrefetchLab } from "./labs/PrefetchLab";
import { DramLab } from "./labs/DramLab";
import { ConsistencyLab } from "./labs/ConsistencyLab";
import { SyncLab } from "./labs/SyncLab";
import { AmdahlLab } from "./labs/AmdahlLab";
import { RooflineLab } from "./labs/RooflineLab";
import { CpiLab } from "./labs/CpiLab";
import { CounterLab } from "./labs/CounterLab";
import { WallaceLab } from "./labs/WallaceLab";
import { ArrayMultiplierLab } from "./labs/ArrayMultiplierLab";
import { BoothLab } from "./labs/BoothLab";
import { GuideFocusProvider } from "./guide/focus";

export function AcaStudio() {
  const { labId } = useParams();
  if (!labId) return <AcaHome />;
  const lab = acaLab(labId);
  if (!lab) return <Navigate to={ACA_HOME} replace />;
  return <GuideFocusProvider key={lab.slug}>{renderAcaLab(lab.slug)}</GuideFocusProvider>;
}

function renderAcaLab(slug: string) {
  if (slug === "data-hazards") return <DataHazardsLab />;
  if (slug === "scoreboard") return <ScoreboardLab />;
  if (slug === "tomasulo") return <TomasuloLab />;
  if (slug === "register-renaming") return <RenameLab />;
  if (slug === "reorder-buffer") return <OooLab />;
  if (slug === "branch-predictor") return <PredictorLab />;
  if (slug === "correlating-predictor") return <CorrelateLab />;
  if (slug === "branch-target-buffer") return <BtbLab />;
  if (slug === "tournament-predictor") return <TournamentLab />;
  if (slug === "speculative-execution") return <SpeculateLab />;
  if (slug === "superscalar") return <SuperscalarLab />;
  if (slug === "issue-queue") return <IssueQueueLab />;
  if (slug === "physical-register-file") return <PrfLab />;
  if (slug === "load-store-queue") return <LsqLab />;
  if (slug === "memory-disambiguation") return <DisambigLab />;
  if (slug === "execution-ports") return <PortLab />;
  if (slug === "mesi") return <MesiLab />;
  if (slug === "moesi") return <MoesiLab />;
  if (slug === "directory-coherence") return <DirectoryLab />;
  if (slug === "false-sharing") return <FalseShareLab />;
  if (slug === "coherence-traffic") return <TrafficLab />;
  if (slug === "snooping-vs-directory") return <SnoopLab />;
  if (slug === "mshr") return <MshrLab />;
  if (slug === "prefetching") return <PrefetchLab />;
  if (slug === "dram-controller") return <DramLab />;
  if (slug === "memory-consistency") return <ConsistencyLab />;
  if (slug === "atomic-operations") return <SyncLab />;
  if (slug === "amdahl") return <AmdahlLab />;
  if (slug === "roofline") return <RooflineLab />;
  if (slug === "cpi-ipc") return <CpiLab />;
  if (slug === "performance-counters") return <CounterLab />;
  if (slug === "wallace-tree-adder") return <WallaceLab />;
  if (slug === "combinational-multipliers") return <ArrayMultiplierLab />;
  if (slug === "booths-multiplier") return <BoothLab />;
  const index = ACA_LABS.findIndex((item) => item.slug === slug);
  const previous = ACA_LABS[index - 1];
  const next = ACA_LABS[index + 1];
  const lab = acaLab(slug);
  if (!lab) return <Navigate to={ACA_HOME} replace />;
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
    <div className="aca-studio-page">
      <StudioTop />
      <div className="aca-studio-body">
        <aside className="aca-lab-nav">
          <p>Virtual Labs</p>
          <Link to="/">LogicLab</Link>
          <Link to={ACA_HOME} className="on">Studio home</Link>
          <div className="aca-watermark">Architecture Today for Smarter Tomorrow</div>
        </aside>
        <div className="vl">
      <nav className="vl-crumb" aria-label="Breadcrumb">
        <Link to="/">LogicLab</Link>
        <span aria-hidden="true">/</span>
        <Link to="/studios">Studios</Link>
        <span aria-hidden="true">/</span>
        <span>Advanced Computer Architecture</span>
      </nav>
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
      </div>
    </div>
  );
}
