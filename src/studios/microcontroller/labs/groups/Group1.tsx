import type { ComponentType } from "react";
import type { LabMeta } from "../registry";
import L01 from "../g1/L01";
import L02 from "../g1/L02";
import L03 from "../g1/L03";
import L04 from "../g1/L04";
import L05 from "../g1/L05";
import L06 from "../g1/L06";
import L07 from "../g1/L07";
import L08 from "../g1/L08";
import L09 from "../g1/L09";
import L10 from "../g1/L10";
import "../g1/g1.css";

const LABS: Record<number, ComponentType<{ meta: LabMeta }>> = { 1: L01, 2: L02, 3: L03, 4: L04, 5: L05, 6: L06, 7: L07, 8: L08, 9: L09, 10: L10 };

export default function Group1({ meta }: { meta: LabMeta }) {
  const Lab = LABS[meta.n];
  return Lab ? <Lab meta={meta} /> : <div className="mcl-root mcl-pro"><div className="mcl-main"><div className="mcl-panel">Lab {meta.n} is not available.</div></div></div>;
}
