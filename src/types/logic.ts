/** Logic levels shared by every studio. Future phases extend components, not this value set. */
export type LogicValue = 0 | 1 | "Z" | "X";

export interface LogicPort {
  id: string;
  name: string;
  value: LogicValue;
  bitWidth: number;
}

export type GateKind =
  | "BUF"
  | "NOT"
  | "AND"
  | "OR"
  | "NAND"
  | "NOR"
  | "XOR"
  | "XNOR"
  | "TRI";

export interface LogicComponent {
  id: string;
  type: GateKind | "INPUT" | "OUTPUT" | "CONST";
  inputs: LogicPort[];
  outputs: LogicPort[];
  propagationDelay?: number;
}

/** Phase 2 buses use the same levels as a single wire. */
export type LogicBit = LogicValue;
export type LogicVector = LogicBit[];

export interface Point {
  x: number;
  y: number;
}

export type ComponentType =
  | GateKind
  | "TOGGLE"
  | "BUTTON"
  | "CONST"
  | "BUS"
  | "CLOCK"
  | "HA"
  | "FA"
  | "RCA"
  | "CLA"
  | "CSA"
  | "ADDER"
  | "HSUB"
  | "FSUB"
  | "ADDSUB"
  | "INC"
  | "DEC"
  | "CMP"
  | "MUX"
  | "DEMUX"
  | "ENC"
  | "PENC"
  | "DECODER"
  | "SEG7"
  | "BARREL"
  | "ALU"
  | "SR_LATCH"
  | "NAND_LATCH"
  | "GATED_SR"
  | "D_LATCH"
  | "SRFF"
  | "DFF"
  | "JKFF"
  | "TFF"
  | "MSFF"
  | "REG"
  | "SHIFT"
  | "COUNTER"
  | "LED"
  | "HEX"
  | "PROBE";

export interface SimulationEvent {
  time: number;
  componentId: string;
  portId?: string;
  value?: LogicBit | LogicVector;
  eventType: "change" | "clock-rise" | "clock-fall" | "reset" | "delay";
}

export type Bit = 0 | 1;

export interface ExplainNote {
  what: string;
  why: string;
  notice: string;
}
