import { useSimulatorCapture } from "../../../layout/SimulatorCapture";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { buildVlsiScene, type VlsiSceneSpec } from "./vlsiThreeModel";
import "./vlsiThree.css";
const Viewer = lazy(() => import("./VlsiThreeViewer"));
export function VlsiThree({ spec, children, onPick, enabled = true }: { spec: VlsiSceneSpec; children: ReactNode; onPick?: (id: string) => void; enabled?: boolean }) {
  useSimulatorCapture("studios/vlsi/three/VlsiThree.tsx:VlsiThree", () => ({ diagram, unavailable, model }), "878a45cc5558");

  const [diagram, setDiagram] = useState(false), [unavailable, setUnavailable] = useState(false);
  const key = JSON.stringify(spec);
  // Structural model data is serializable. Memoization avoids rebuilding on unrelated runtime readout updates.
  const model = useMemo(() => enabled ? buildVlsiScene(JSON.parse(key) as VlsiSceneSpec) : null, [key, enabled]);
  if (!enabled || !model) return <>{children}</>;
  return <div className="vlsi-three" data-motion-skip>
    <div className="vlsi-three-tabs" role="group" aria-label="Structure display">
      <button type="button" aria-pressed={!diagram && !unavailable} disabled={unavailable} onClick={() => setDiagram(false)}>3D structure</button>
      <button type="button" aria-pressed={diagram || unavailable} onClick={() => setDiagram(true)}>2D diagram</button>
    </div>
    {unavailable && <p className="vlsi-three-note" role="status">3D is unavailable on this device. The diagram and lab controls remain available.</p>}
    {diagram || unavailable ? children : <Suspense fallback={children}><Viewer model={model} onPick={onPick} onUnavailable={() => setUnavailable(true)} /></Suspense>}
  </div>;
}
