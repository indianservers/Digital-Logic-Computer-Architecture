import { Link, useLocation, useNavigate } from "react-router-dom";
import { STUDIOS } from "../data/curriculum";
import "./studioNavigation.css";

/** Persistent wayfinding contract; each studio owns its experiment controls below. */
export function StudioNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const roots = [...new Map(STUDIOS.map(studio => [studio.path.split("?")[0]!, studio])).values()];
  const current = roots.filter(studio => pathname === studio.path.split("?")[0] || pathname.startsWith(`${studio.path.split("?")[0]}/`)).sort((a, b) => b.path.length - a.path.length)[0];
  const base = current?.path.split("?")[0] ?? pathname.split("/").slice(0, 3).join("/");
  return <header className="lab-navigation">
    <nav aria-label="Lab navigation"><Link to="/studios" className="lab-navigation-brand"><span aria-hidden="true">◈</span> LAB DIRECTORY</Link><span className="lab-navigation-divider" aria-hidden="true">/</span><Link to={base} aria-current={pathname === base ? "page" : undefined}>{current?.title ?? "Studio home"}</Link></nav>
    <div className="lab-navigation-tools"><label><span className="lab-navigation-label">Switch studio</span><select aria-label="Switch studio" value="" onChange={event => { if (event.target.value) navigate(event.target.value); }}><option value="">Choose a studio…</option>{roots.map(studio => <option key={studio.id} value={studio.path}>{studio.title}</option>)}</select></label>
      <details className="lab-navigation-guide"><summary>Lab guide</summary><div><strong>Work like an engineer</strong><ol><li>Predict the result before changing a control.</li><li>Change one parameter and run or step the experiment.</li><li>Inspect signals, state, units, and model assumptions.</li><li>Record evidence in the experiment notebook; compare a second run.</li></ol><p>Use Interactive Lab and Theory & Textbook below to switch views while keeping your experiment.</p></div></details>
    </div>
  </header>;
}
