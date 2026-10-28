import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import "./theory.css";
import { StudioNavigation } from "../layout/StudioNavigation";
import { SimulatorCaptureProvider } from "../layout/SimulatorCapture";
import { LabMotionControl } from "../design-system/LabMotion";

const LabOverview=lazy(()=>import("./LabOverview").then(m=>({default:m.LabOverview})));
const SiteFAQ=lazy(()=>import("./LessonFAQ").then(m=>({default:m.SiteFAQ})));
const TheoryReader=lazy(()=>import("./TheoryReader").then(m=>({default:m.TheoryReader})));
const LabTheory=lazy(()=>import("./TheoryReader").then(m=>({default:m.LabTheory})));
const ExperimentNotebook=lazy(()=>import("../layout/ExperimentNotebook").then(m=>({default:m.ExperimentNotebook})));

/** A real page tab. Keep the lab mounted so changing reading mode retains its state. */
export function StudioLearningLayout({children}:{children:ReactNode}) {
  const location=useLocation();
  const [params,setParams]=useSearchParams();
  const home=location.pathname==="/";
  const enabled=home||/^\/(studios|architecture)\/.+/.test(location.pathname);
  const reading=params.get("view")==="theory";
  const [notebookOpen, setNotebookOpen] = useState(false);
  if(!enabled)return <>{children}{["/studios","/learn","/practice","/projects","/cheat-sheet","/encyclopedia"].includes(location.pathname)&&<Suspense fallback={null}><div className="lab-study-companion"><SiteFAQ/></div></Suspense>}</>;
  function select(theory:boolean){const next=new URLSearchParams(params);if(theory)next.set("view","theory");else next.delete("view");setParams(next);}
  const tabs = <nav className="studio-learning-tabs" role="tablist" aria-label={home?"Home and textbook":"Lab and textbook"} onKeyDown={event=>{if(!(event.target instanceof HTMLElement) || event.target.getAttribute("role")!=="tab")return;if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const next=event.key==="Home"?false:event.key==="End"?true:!reading;select(next);document.getElementById(next?"learning-theory-tab":"learning-interactive-tab")?.focus();}}>
      <button id="learning-interactive-tab" role="tab" tabIndex={reading?-1:0} aria-selected={!reading} aria-controls="learning-interactive-panel" onClick={()=>select(false)}><span aria-hidden="true">{home?"⌂":"◇"}</span>{home?"Home":"Interactive Lab"}</button>
      <button id="learning-theory-tab" role="tab" tabIndex={reading?0:-1} aria-selected={reading} aria-controls="learning-theory-panel" onClick={()=>select(true)}><span aria-hidden="true">▤</span>Theory & Textbook</button>
      {reading&&!home&&<Link to="/?view=theory" className="studio-learning-home">Home textbook ↗</Link>}
      {!home&&<LabMotionControl/>}
    </nav>;
  return <SimulatorCaptureProvider><div className={`studio-learning ${reading?"is-reading":""}`}>
    {home ? tabs : <StudioNavigation>{tabs}<button id="lab-notebook-toggle" className="lab-notebook-toggle" type="button" aria-expanded={notebookOpen} aria-controls="experiment-notebook" onClick={() => setNotebookOpen(value => !value)}>Notebook</button></StudioNavigation>}

    <div id="learning-interactive-panel" role="tabpanel" aria-labelledby="learning-interactive-tab" className="studio-learning-simulation" hidden={reading} inert={reading}><div id="studio-simulator-content">{children}</div>{!reading&&<Suspense fallback={null}>{home?<div className="lab-study-companion"><SiteFAQ/></div>:<LabOverview key={location.pathname+location.search} context={{pathname:location.pathname,search:location.search}}/>}</Suspense>}</div>
    {!home && <Suspense fallback={null}><ExperimentNotebook open={notebookOpen} onClose={() => { setNotebookOpen(false); document.getElementById("lab-notebook-toggle")?.focus(); }} /></Suspense>}
    {reading&&<section id="learning-theory-panel" role="tabpanel" aria-labelledby="learning-theory-tab"><Suspense fallback={<div className="textbook-loading">Loading this lesson…</div>}>{home?<><TheoryReader/><div className="lab-study-companion"><SiteFAQ/></div></>:<LabTheory context={{pathname:location.pathname,search:location.search}}/>}</Suspense></section>}
  </div></SimulatorCaptureProvider>;
}
