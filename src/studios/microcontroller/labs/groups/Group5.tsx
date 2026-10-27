import type { ComponentType } from "react";
import type { LabMeta } from "../registry";
import L41 from "../g5/L41";
import L42 from "../g5/L42";
import L43 from "../g5/L43";
import L44 from "../g5/L44";
import L45 from "../g5/L45";
import L46 from "../g5/L46";
import L47 from "../g5/L47";
import L48 from "../g5/L48";
import L49 from "../g5/L49";
import L50 from "../g5/L50";
const LABS: Record<number, ComponentType<{ meta: LabMeta }>> = { 41: L41, 42: L42, 43: L43, 44: L44, 45: L45, 46: L46, 47: L47, 48: L48, 49: L49, 50: L50 };
export default function Group5({ meta }: { meta: LabMeta }) {
  const Lab = LABS[meta.n];
  return Lab ? <Lab meta={meta} /> : <p>Lab not found.</p>;
}
