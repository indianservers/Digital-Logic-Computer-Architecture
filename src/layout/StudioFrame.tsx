import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { IconName } from "../design-system/icons";
import { Icon } from "../design-system/icons";
import { Button, Tabs } from "../design-system/ui";
import { usePrefs } from "../store/prefs";

export function StudioFrame({
  icon, title, description, tabs, tab, onTab, onReset, guide, takeaways, children,
}: {
  icon: IconName;
  title: string;
  description: string;
  tabs: Array<{ id: string; label: string }>;
  tab: string;
  onTab: (id: string) => void;
  onReset?: () => void;
  guide: string[];
  takeaways: string[];
  children: ReactNode;
}) {
  const { prefs, update } = usePrefs();
  return (
    <div className="studio">
      <div className="studio-main">
        <div className="spread">
          <div className="studio-head">
            <div className="studio-icon"><Icon name={icon} /></div>
            <div>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
          </div>
          <div className="row">
            <Button onClick={() => update({ explain: !prefs.explain })}><Icon name="info" size={14} />{prefs.explain ? "Explain on" : "Explain"}</Button>
            {onReset ? <Button onClick={onReset}><Icon name="reset" size={14} />Reset</Button> : null}
            <Link to="/" className="btn-ghost"><Icon name="back" size={14} />Back to Path</Link>
          </div>
        </div>
        <Tabs tabs={tabs} value={tab} onChange={onTab} />
        {children}
      </div>
      <aside className="guide">
        <section className="card">
          <h3><Icon name="book" size={16} /> Studio Guide</h3>
          <ol>
            {guide.map((step, index) => (
              <li key={step}><span className="step-no">{index + 1}</span><span>{step}</span></li>
            ))}
          </ol>
        </section>
        <section className="card">
          <h3>Key Takeaways</h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            {takeaways.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section className="card quote">“Numbers are the language in which the universe is written.”<b>— Galileo</b></section>
      </aside>
    </div>
  );
}
