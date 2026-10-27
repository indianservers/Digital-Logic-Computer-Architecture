import { describe, expect, it } from "vitest";
import { stepStage, signalsFor } from "../../engines/isa/cpu";
import { addMachine, displayedStage, finishInstruction, STAGES } from "./fdeModel";
import { assemble } from "../../engines/isa/assembler";
import { decode } from "../../engines/isa/spec";

describe("FDE visualizer sequencing",()=>{
  it("labels the stage just executed, including the instruction boundary",()=>{
    let cpu=addMachine();
    expect(displayedStage(cpu)).toBe("IF");
    for(const stage of STAGES){cpu=stepStage(cpu);expect(displayedStage(cpu)).toBe(stage);}
    expect(cpu.retired).toBe(1);
    expect(cpu.regs[1]).toBe(5);
    cpu=stepStage(cpu);
    expect(displayedStage(cpu)).toBe("IF");
  });
  it("finishes only the current instruction and safely stops at HALT",()=>{
    let cpu=stepStage(stepStage(addMachine()));
    cpu=finishInstruction(cpu);
    expect(cpu.cycles).toBe(5);
    expect(cpu.retired).toBe(1);
    cpu=finishInstruction(finishInstruction(finishInstruction(cpu)));
    expect(cpu.stage).toBe("done");
    expect(cpu.regs[3]).toBe(8);
    expect(cpu.cycles).toBe(20);
    expect(finishInstruction(cpu)).toEqual(cpu);
  });
  it("distinguishes instruction fetch, data read, and store write controls",()=>{
    for(const op of ["LOAD R1, 0(R0)","STORE R1, 0(R0)","ADD R3, R1, R2","BEQ R1, R2, 2"]){
      const built=assemble(op);expect(built.ok,op).toBe(true);if(!built.ok)continue;
      const instruction=decode(built.words[0]!);
      expect(signalsFor(instruction,"IF").memRead).toBe(1);
      expect(signalsFor(instruction,"MEM").memWrite).toBe(op.startsWith("STORE")?1:0);
      expect(signalsFor(instruction,"MEM").memRead).toBe(op.startsWith("LOAD")?1:0);
      expect(signalsFor(instruction,"WB").regWrite).toBe(op.startsWith("ADD")||op.startsWith("LOAD")?1:0);
    }
  });
});
