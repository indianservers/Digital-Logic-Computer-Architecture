/** Shared digital-circuit document. Studios embed this; they do not invent their own wires. */
export type Bit = 0 | 1 | "X" | "Z";

export type ParamValue = number | string;

export interface PortSpec {
  id: string;
  name: string;
  dir: "in" | "out";
}

export interface ParamSpec {
  id: string;
  label: string;
  kind: "number" | "text";
  min?: number;
  max?: number;
  default: ParamValue;
}

export interface EvalInput {
  inputs: Record<string, Bit>;
  state: Bit[];
  params: Record<string, ParamValue>;
}

export interface EvalOutput {
  outputs: Record<string, Bit>;
  state?: Bit[];
  note?: string;
}

export interface ComponentSpec {
  type: string;
  category: string;
  displayName: string;
  description: string;
  /** Short canvas label. The palette uses displayName. */
  shortLabel?: string;
  /** One line under the palette name. */
  summary?: string;
  keywords?: string[];
  /** Hidden from the palette. Kept so older saved circuits still simulate. */
  listed?: boolean;
  /** Propagation delay in simulation ticks. */
  delay: number;
  width: number;
  height: number;
  params: ParamSpec[];
  ports: (params: Record<string, ParamValue>) => PortSpec[];
  evaluate: (input: EvalInput) => EvalOutput;
  expression?: (names: string[]) => string;
}

export type LabelPlace = "auto" | "top" | "bottom" | "left" | "right" | "inside";

export interface CircuitNode {
  id: string;
  type: string;
  x: number;
  y: number;
  label: string;
  params: Record<string, ParamValue>;
  state: Bit[];
  /** Quarter turns clockwise. Ports and the symbol follow this. */
  rotation?: number;
  /** Drawn size. Omitted or 0 uses the symbol's natural size. */
  width?: number;
  height?: number;
  /** Dragging skips a locked part. Logic interaction still works. */
  locked?: boolean;
  labelAt?: LabelPlace;
  /** Port names. Pins stay visible either way. */
  showPorts?: boolean;
  showLabel?: boolean;
  /** Simulation ticks. Omitted uses the component's built-in delay. */
  delay?: number;
}

export interface CircuitWire {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  /** Optional net name. Wires that share a name are one named net. */
  name?: string;
}

export interface CircuitDoc {
  nodes: CircuitNode[];
  wires: CircuitWire[];
  nextId: number;
}

export interface SimFrame {
  time: number;
  nodeId: string;
  signals: Record<string, Bit>;
}

export interface SimResult {
  signals: Record<string, Bit>;
  state: Record<string, Bit[]>;
  warning: string | null;
  frames: SimFrame[];
  time: number;
}

export interface TruthRow {
  values: Bit[];
  outputs: Bit[];
}

export interface TruthReport {
  inputs: Array<{ id: string; label: string }>;
  outputs: Array<{ id: string; label: string }>;
  rows: TruthRow[];
  tooBig: boolean;
  note: string;
}
