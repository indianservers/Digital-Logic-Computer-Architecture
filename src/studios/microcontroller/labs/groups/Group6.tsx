import type { ComponentType } from "react";
import type { LabMeta } from "../registry";
import L51 from "../g6/L51";
import L52 from "../g6/L52";
import L53 from "../g6/L53";
import L54 from "../g6/L54";
import L55 from "../g6/L55";
import L56 from "../g6/L56";
import L57 from "../g6/L57";
import L58 from "../g6/L58";
import L59 from "../g6/L59";
import L60 from "../g6/L60";
const LABS: Record<number, ComponentType<{ meta: LabMeta }>> = { 51: L51, 52: L52, 53: L53, 54: L54, 55: L55, 56: L56, 57: L57, 58: L58, 59: L59, 60: L60 };
export default function Group6({ meta }: { meta: LabMeta }) {
  const Lab = LABS[meta.n];
  return Lab ? <Lab meta={meta} /> : <p>Lab not found.</p>;
}
