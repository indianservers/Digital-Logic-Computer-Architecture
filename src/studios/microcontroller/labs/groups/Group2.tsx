import type { ComponentType } from "react";
import type { LabMeta } from "../registry";
import L11 from "../g2/L11";
import L12 from "../g2/L12";
import L13 from "../g2/L13";
import L14 from "../g2/L14";
import L15 from "../g2/L15";
import L16 from "../g2/L16";
import L17 from "../g2/L17";
import L18 from "../g2/L18";
import L19 from "../g2/L19";
import L20 from "../g2/L20";
import "../g2/g2.css";

const LABS: Record<number, ComponentType<{ meta: LabMeta }>> = { 11: L11, 12: L12, 13: L13, 14: L14, 15: L15, 16: L16, 17: L17, 18: L18, 19: L19, 20: L20 };

export default function Group2({ meta }: { meta: LabMeta }) {
  const Lab = LABS[meta.n];
  return Lab ? <Lab meta={meta} /> : <div className="mcl-root mcl-bench"><div className="mcl-main"><div className="mcl-panel">Lab {meta.n} is not available.</div></div></div>;
}
