import type { ComponentType } from "react";
import type { LabMeta } from "../registry";
import L21 from "../g3/L21";
import L22 from "../g3/L22";
import L23 from "../g3/L23";
import L24 from "../g3/L24";
import L25 from "../g3/L25";
import L26 from "../g3/L26";
import L27 from "../g3/L27";
import L28 from "../g3/L28";
import L29 from "../g3/L29";
import L30 from "../g3/L30";
import "../g2/g2.css";
import "../g3/g3.css";

const LABS: Record<number, ComponentType<{ meta: LabMeta }>> = { 21: L21, 22: L22, 23: L23, 24: L24, 25: L25, 26: L26, 27: L27, 28: L28, 29: L29, 30: L30 };

export default function Group3({ meta }: { meta: LabMeta }) {
  const Lab = LABS[meta.n];
  return Lab ? <Lab meta={meta} /> : <div className="mcl-root mcl-pro"><div className="mcl-main"><div className="mcl-panel">Lab {meta.n} is not available yet.</div></div></div>;
}
