import { loadProgram, stepStage, type CpuState } from "../../engines/isa/cpu";
export const ADD_PROGRAM="ADDI R1, R0, 5\nADDI R2, R0, 3\nADD R3, R1, R2\nHALT\n";
export const STAGES=["IF","ID","EX","MEM","WB"] as const;
export type FdeStage=typeof STAGES[number];
/** The engine stores the next stage; the visualizer names the last completed one. */
export function displayedStage(cpu:CpuState|null):FdeStage {
  if(!cpu||cpu.cycles===0)return "IF";
  return STAGES[(cpu.cycles-1)%5]??"IF";
}
export function finishInstruction(cpu:CpuState):CpuState {
  let next=cpu;
  for(let i=0;i<5;i++){next=stepStage(next);if(next.stage==="IF"||next.stage==="done")break;}
  return next;
}
export function addMachine():CpuState {
  const result=loadProgram(ADD_PROGRAM);
  if("error" in result)throw new Error(result.error);
  return result;
}
