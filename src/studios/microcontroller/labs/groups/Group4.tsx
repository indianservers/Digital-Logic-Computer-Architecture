import type { ComponentType } from "react";
import type { LabMeta } from "../registry";
import L31 from "../g4/L31";
import L32 from "../g4/L32";
import L33 from "../g4/L33";
import L34 from "../g4/L34";
import L35 from "../g4/L35";
import L36 from "../g4/L36";
import L37 from "../g4/L37";
import L38 from "../g4/L38";
import "../g4/g4.css";

const LABS: Record<number, ComponentType<{ meta: LabMeta }>> = { 31: L31, 32: L32, 33: L33, 34: L34, 35: L35, 36: L36, 37: L37, 38: L38 };

export default function Group4({ meta }: { meta: LabMeta }) {
  const Lab = LABS[meta.n];
  return Lab ? <Lab meta={meta} /> : <div className="mcl-root mcl-pro"><div className="mcl-main"><div className="mcl-panel">Lab {meta.n} is not available yet.</div></div></div>;
}
