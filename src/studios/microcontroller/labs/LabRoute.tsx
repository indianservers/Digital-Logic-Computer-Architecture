import { Component, Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { labBySlug, type LabMeta } from "./registry";
import "./labs.css";

type GroupComponent = LazyExoticComponent<ComponentType<{ meta: LabMeta }>>;

const GROUPS: Record<number, GroupComponent> = {
  1: lazy(() => import("./groups/Group1")),
  2: lazy(() => import("./groups/Group2")),
  3: lazy(() => import("./groups/Group3")),
  4: lazy(() => import("./groups/Group4")),
};

class LabBoundary extends Component<{ children: ReactNode; slug: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { slug: string }) { if (prev.slug !== this.props.slug && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <div className="mcl-root mcl-pro"><div className="mcl-main"><div className="mcl-panel">
          <h2>This lab hit an unexpected error</h2>
          <p className="mcl-muted">{this.state.error.message}</p>
          <div className="mcl-row">
            <button type="button" className="mcl-small-btn primary" onClick={() => this.setState({ error: null })}>Reload lab</button>
            <button type="button" className="mcl-small-btn" onClick={() => { localStorage.removeItem(`mcu.lab.${this.props.slug}`); this.setState({ error: null }); }}>Clear saved state and reload</button>
          </div>
        </div></div></div>
      );
    }
    return this.props.children;
  }
}

export function MicrocontrollerLabRoute() {
  const { slug = "" } = useParams();
  const meta = labBySlug(slug);
  const Group = meta ? GROUPS[meta.group] : undefined;
  if (!meta || !Group) {
    return (
      <div className="mcl-root mcl-pro"><div className="mcl-main"><div className="mcl-panel">
        <h2>Lab not found</h2>
        <Link to="/studios/microcontroller">Return to Microcontroller Studio</Link>
      </div></div></div>
    );
  }
  return (
    <LabBoundary slug={slug}>
      <Suspense fallback={<div className="mcl-root mcl-pro"><div className="mcl-main"><div className="mcl-panel">Loading lab {meta.n}…</div></div></div>}>
        <Group key={meta.slug} meta={meta} />
      </Suspense>
    </LabBoundary>
  );
}
