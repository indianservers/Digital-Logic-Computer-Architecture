import { MATERIALS } from "../processModel";

export type Solid = { id: string; material: string; size: [number, number, number]; at: [number, number, number]; shape?: "box" | "sphere" | "cylinder" | "sleeve"; opacity?: number; glow?: number; heat?: boolean; pick?: string; rotate?: [number, number, number] };
export type Flow = { id: string; from: [number, number, number]; to: [number, number, number]; count: number; speed: number; material: string };
export type SceneModel = { solids: Solid[]; flows: Flow[]; caption: string; view?: "section" | "perspective" | "exploded"; animate: boolean };
export type VlsiSceneSpec =
  | { kind: "fin"; device: "planar" | "finfet"; height: number; width: number; count: number; vgs: number; vds: number }
  | { kind: "gaa"; count: number; width: number; thickness: number; spacing: number; vgs: number; view: "section" | "perspective" | "exploded" }
  | { kind: "package"; mode: "2.5d" | "3d"; count: number; tsv: number; thermalRise: number };

export const SCENE_COLORS: Record<string, string> = { ...Object.fromEntries(Object.entries(MATERIALS).map(([id, m]) => [id, m.color])), copper: "#bc7651", gate: "#c0c8d3", package: "#514b57", solder: "#b3bdc9", dark: "#243246", carrier: "#1bd5ec", hole: "#f28ab8", light: "#e4c6ff", good: "#458e89", failed: "#d85266", edge: "#616779" };

/** Geometry is derived from the same values and model outputs displayed by each lab. */
export function buildVlsiScene(s: VlsiSceneSpec): SceneModel {
  const solids: Solid[] = [], flows: Flow[] = [];
  let caption = "Dimensions are visually exaggerated for inspection; numerical readouts retain the lab model’s units.";
  let view: SceneModel["view"];
  let animate = false;
  const add = (id: string, material: string, size: Solid["size"], at: Solid["at"], extra: Partial<Solid> = {}) => { const solid: Solid = { id, material, size, at, ...extra }; solids.push(solid); return solid; };
  const substrate = (height = .9) => add("substrate", "silicon", [6.5, height, 3.2], [0, -height / 2, 0]);
  const flow = (id: string, from: Flow["from"], to: Flow["to"], count: number, speed: number, material = "carrier") => { flows.push({ id, from, to, count, speed, material }); animate = speed > 0; };
  const terminals = (y: number, h: number, depth: number, material = "ndiff") => {
    for (const [name, x] of [["source", -2.2], ["drain", 2.2]] as const) {
      add(name, material, [1, h, depth], [x, y, 0]);
      add(`${name}-contact`, "contact", [.5, .35, .65], [x, y + h / 2 + .17, 0]);
    }
  };
  if (s.kind === "fin" && s.device === "finfet") {
    substrate(.6); const h = s.height * .035, w = s.width * .035;
    const pitch = .85; const on = s.vgs >= .45;
    for (let j = 0; j < s.count; j++) {
      const z = (j - (s.count - 1) / 2) * pitch;
      add(`fin-${j}`, "silicon", [4.6, h, w], [0, h / 2, z]);
      for (const [name, x] of [["source", -1.8], ["drain", 1.8]] as const) add(`${name}-${j}`, "ndiff", [.9, h + .12, w + .12], [x, h / 2, z]);
      // Three-sided U-shaped oxide and gate; the fin remains connected to the substrate below.
      for (const side of [-1, 1]) {
        add(`fin-oxide-${j}-${side}`, "oxide", [1.25, h, .04], [0, h / 2, z + side * (w / 2 + .02)]);
        add(`fin-gate-${j}-${side}`, "gate", [1.25, h + .12, .13], [0, h / 2, z + side * (w / 2 + .12)]);
        if (on) add(`fin-channel-${j}-${side}`, "carrier", [3.2, h * .85, .018], [0, h / 2, z + side * (w / 2 + .005)], { glow: .4 });
      }
      add(`fin-cap-oxide-${j}`, "oxide", [1.25, .04, w + .08], [0, h + .02, z]);
      add(`fin-cap-gate-${j}`, "gate", [1.25, .14, w + .37], [0, h + .11, z]);
      if (on && s.vds > 0) flow(`fin-flow-${j}`, [-1.7, h + .23, z], [1.7, h + .23, z], 5, s.vds * .8);
    }
    if (s.count > 1) add("fin-gate-strap", "gate", [1.25, .12, (s.count - 1) * pitch + w + .37], [0, h + .24, 0]);
    caption = "Gate controls both sidewalls and the top of each fin; the bottom remains attached to silicon. Fin count, height, width and bias follow the controls.";
  }
  if (s.kind === "gaa") {
    substrate(.5); view = s.view;
    const thick = s.thickness * .035, width = s.width * .045;
    const pitch = thick + s.spacing * .035 + (s.view === "exploded" ? .5 : 0);
    const h = .5 + (s.count - 1) * pitch + thick;
    if (s.view !== "section") terminals(h / 2, h, width + .2);
    for (let j = 0; j < s.count; j++) {
      const y = .45 + j * pitch + thick / 2;
      add(`sheet-${j}`, "silicon", [4.2, thick, width], [0, y, 0]);
      add(`sheet-oxide-${j}`, "oxide", [1.3, thick + .08, width + .08], [0, y, 0], { shape: "sleeve", opacity: .85 });
      add(`sheet-gate-${j}`, "gate", [1.2, thick + .3, width + .3], [0, y, 0], { shape: "sleeve" });
      if (s.vgs >= .4) {
        add(`sheet-charge-${j}`, "carrier", [4.2, .015, width], [0, y + thick / 2 + .009, 0], { glow: .5 });
        flow(`sheet-flow-${j}`, [-1.7, y, width / 2 + .24], [1.7, y, width / 2 + .24], 7, Math.max(.1, s.vgs - .35));
      }
    }
    if (s.view !== "exploded") add("shared-gate-spine", "gate", [1.2, h - .3, .12], [0, .3 + (h - .3) / 2, -width / 2 - .17]);
    caption = "Each nanosheet passes through a closed oxide and metal-gate sleeve. Section looks along the channel; Exploded adds display spacing without changing electrical metrics.";
  }
  if (s.kind === "package") {
    const count = s.count;
    const stacked = s.mode === "3d", pitch = 1.25;
    const packageWidth = stacked ? 4.2 : Math.max(4.2, count * pitch + .6);
    add("package-carrier", "package", [packageWidth, .12, 3.35], [0, .19, 0]);
    for (let x = -packageWidth / 2 + .3; x < packageWidth / 2; x += .42) for (let z = -1.4; z <= 1.4; z += .45) add(`bga-${x}-${z}`, "solder", [.09, .09, .09], [x, .02, z], { shape: "sphere" });
    add("interposer", "silicon", [packageWidth - .25, .18, 3.2], [0, .39, 0]);
    const rise = s.thermalRise;
    for (let j = 0; j < count; j++) {
      const x = stacked ? 0 : (j - (count - 1) / 2) * pitch, y = stacked ? .75 + j * .5 : .75;
      const w = stacked ? 2.7 : 1;
      add(`die-${j}`, stacked && j === count - 1 ? "metal" : "silicon", [w, .3, 2.2], [x, y, 0], { glow: Math.min(.7, rise / 25), heat: true });
      for (let k = 0; k < 5; k++) add(`die-trace-${j}-${k}`, "copper", [w * .78, .012, .025], [x, y + .158, -.7 + k * .35]);
      for (let k = 0; k < 4; k++) add(`bump-${j}-${k}`, "solder", [.08, .17, .08], [x - w * .35 + k * w * .23, y - .23, .75], { shape: "sphere" });
      if (stacked) for (let k = 0; k < s.tsv; k++) {
        const cols = Math.ceil(Math.sqrt(s.tsv));
        add(`tsv-${j}-${k}`, "copper", [.045, .5, .045], [-1.15 + k % cols / Math.max(1, cols - 1) * 2.3, y, -.95 + Math.floor(k / cols) / Math.max(1, Math.ceil(s.tsv / cols) - 1) * 1.9], { shape: "cylinder" });
      }
      if (j < count - 1 && !stacked) {
        add(`rdl-${j}`, "copper", [pitch, .035, .06], [x + pitch / 2, .51, .7]);
      }
    }
    caption = `${s.mode === "3d" ? "Vertical TSV stack" : "Side-by-side dies on an interposer"}: ${count} dies, modeled thermal rise ${s.thermalRise.toFixed(1)}. Warm highlight follows thermal rise; TSVs are shown only in 3D mode. Dimensions are exaggerated.`;
  }
  return { solids, flows, caption, view, animate };
}
