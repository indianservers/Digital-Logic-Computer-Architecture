import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { VLSI_HOME, vlsiNeighbors, vlsiRoute, type VlsiLabMeta } from "../../data/vlsiLabs";

export function VlsiFrame({ lab, children }: { lab: VlsiLabMeta; children: ReactNode }) {
  const [nonce, setNonce] = useState(0);
  const { previous, next, index } = vlsiNeighbors(lab.slug);
  const count = index >= 0 ? index + 1 : lab.number;
  return (
    <div className="vlsi">
      <header className="vlsi-bar">
        <Link to={VLSI_HOME} className="vlsi-home-link"><Icon name="back" size={14} />VLSI Studio</Link>
        <div className="vlsi-title">
          <p>Lab {lab.number} of the VLSI sequence · {count} of the open labs</p>
          <h1>{lab.title}</h1>
        </div>
        <div className="vlsi-nav">
          {previous ? <Link to={vlsiRoute(previous.slug)}>Previous</Link> : <span />}
          <button type="button" onClick={() => setNonce((value) => value + 1)}><Icon name="reset" size={14} />Reset</button>
          {next ? <Link to={vlsiRoute(next.slug)}>Next</Link> : null}
        </div>
      </header>
      <p className="vlsi-status">Simulation ready · educational compact model · {lab.difficulty} · about {lab.minutes} min</p>
      <div key={nonce}>{children}</div>
    </div>
  );
}

export function VlsiGrid({ controls, stage, readouts, footer }: { controls: ReactNode; stage: ReactNode; readouts: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="vlsi-grid">
        <aside className="vlsi-panel">{controls}</aside>
        <section className="vlsi-stage">{stage}</section>
        <aside className="vlsi-panel vlsi-read">{readouts}</aside>
      </div>
      {footer ? <div className="vlsi-panel">{footer}</div> : null}
    </>
  );
}
