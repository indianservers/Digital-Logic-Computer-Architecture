import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, Segmented, parseNumberInput } from "../../design-system/ui";
import { alu, shiftVector } from "../../engines/digital/arithmetic";
import { fromUnsigned, toBinary, toUnsigned } from "../../engines/digital/vector";
import { driveBus, type BusDriver } from "../../engines/cpu/buses";
import { extendBits, idleControls, manualDatapath, type ControlSignals } from "../../engines/cpu/datapathComponents";
import { createRegisterFile, writePort, type RegisterFile } from "../../engines/cpu/registerFile";
import { createRegisters, loadRegister, popStack, pushStack, stepProgramCounter, type CpuRegisters } from "../../engines/cpu/registers";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { saveRecord } from "../../store/projects";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "registers", label: "Registers" },
  { id: "datapath", label: "Datapath" },
  { id: "bus", label: "Internal Bus" },
  { id: "extend", label: "Extend / Shift" },
  { id: "clock", label: "Clocking" },
];

const BLOCKS: Record<string, { purpose: string; inputs: string; outputs: string }> = {
  PC: { purpose: "Holds the address of the next instruction word.", inputs: "Increment or a loaded address", outputs: "Address toward MAR" },
  IR: { purpose: "Captures the instruction word.", inputs: "Memory word when IRWrite is on", outputs: "The held word; decode happens in the Fetch-Decode-Execute studio" },
  MAR: { purpose: "Drives the address bus.", inputs: "An address from the datapath", outputs: "Address bus" },
  MDR: { purpose: "Sits between memory and the CPU.", inputs: "Memory data or CPU data", outputs: "The other side, depending on direction" },
  Registers: { purpose: "Two read ports and one write port.", inputs: "Read addresses, write address, write data", outputs: "Read data A and B" },
  ALU: { purpose: "The arithmetic logic unit from the adder studio.", inputs: "A and the selected B or immediate", outputs: "Result and Z, N, C, V" },
  Control: { purpose: "Introduces the signals that steer the datapath.", inputs: "The instruction word from IR", outputs: "PCWrite, IRWrite, RegWrite, ALUSrc, MemRead, MemWrite" },
};

export function CpuStudio() {
  const [tab, setTab] = useStudioTab(TABS, "overview");
  const [regs, setRegs] = useState<CpuRegisters>(() => createRegisters(16, 4));
  const [file, setFile] = useState<RegisterFile>(() => createRegisterFile(8, 16));
  const [selected, setSelected] = useState("PC");
  const [note, setNote] = useState("Click a block. The inspector names what it holds and where it connects.");
  const [controls, setControls] = useState<ControlSignals>(idleControls());
  const { prefs } = usePrefs();
  const block = BLOCKS[selected] ?? BLOCKS.PC;

  return (
    <StudioFrame icon="project" title="CPU Building Blocks" description="Inspect the pieces that a later instruction cycle will use. This lab does not fetch or execute a program." tabs={TABS} tab={tab} onTab={setTab} guide={["The program counter changes only when you increment, load, or assert PCWrite.", "One bus driver is valid. Two drivers make the bus X.", "ALU flags are the same Z, N, C, and V as the adder studio."]} takeaways={["ALUSrc picks register B or an immediate.", "MAR points at memory. MDR carries the word.", "Registers update on the clock edge you step."]}>
      {prefs.explain ? <ExplainBar what={note} why="Control signals choose the route. The ALU and register file are the same engines used in the earlier studios." notice="Nothing here decodes an instruction yet." /> : null}
      {tab === "overview" ? (
        <div className="grid cards-2">
          <Card title="CPU core">
            <div className="cpu-grid">
              {Object.keys(BLOCKS).map((name) => (
                <button key={name} className={name === selected ? "cpu-block on" : "cpu-block"} onClick={() => { setSelected(name); setNote(`${name}: ${BLOCKS[name]?.purpose ?? ""}`); }}>{name}</button>
              ))}
            </div>
            <svg className="diagram" viewBox="0 0 420 120" role="img" aria-label="Datapath sketch">
              <path d="M40 30 H380" stroke="#2F6FED" strokeWidth="4" />
              <text x="200" y="24" textAnchor="middle" fontSize="11">Internal bus</text>
              <text x="40" y="70" fontSize="11">PC → IR → MAR → MDR</text>
              <text x="40" y="96" fontSize="11">Register file → ALU → result</text>
            </svg>
          </Card>
          <Card title={selected}>
            {block ? <><p>{block.purpose}</p><p>Inputs: {block.inputs}</p><p>Outputs: {block.outputs}</p></> : null}
            <Metric label="PC" value={`0x${regs.pc.toString(16)}`} />
            <Metric label="IR" value={regs.ir.toString(2).padStart(8, "0")} />
          </Card>
        </div>
      ) : null}
      {tab === "registers" ? <RegisterLab regs={regs} setRegs={setRegs} file={file} setFile={setFile} setNote={setNote} /> : null}
      {tab === "datapath" ? <DatapathLab regs={regs} setRegs={setRegs} file={file} setFile={setFile} controls={controls} setControls={setControls} setNote={setNote} /> : null}
      {tab === "bus" ? <BusLab regs={regs} /> : null}
      {tab === "extend" ? <ExtendLab /> : null}
      {tab === "clock" ? <ClockLab /> : null}
    </StudioFrame>
  );
}

function RegisterLab({ regs, setRegs, file, setFile, setNote }: {
  regs: CpuRegisters;
  setRegs: (regs: CpuRegisters) => void;
  file: RegisterFile;
  setFile: (file: RegisterFile) => void;
  setNote: (note: string) => void;
}) {
  const [load, setLoad] = useState(0x40);
  const [stackMem, setStackMem] = useState<Record<string, number>>({});
  return (
    <div className="grid cards-2">
      <Card title="Program counter">
        <p>PC = 0x{regs.pc.toString(16)} · next increment 0x{(regs.pc + regs.pcStep).toString(16)}</p>
        <label>Step<input className="text-input" type="number" value={regs.pcStep} onChange={(event) => setRegs({ ...regs, pcStep: parseNumberInput(event.target.value, regs.pcStep) })} /></label>
        <div className="row">
          <Button onClick={() => { setRegs(stepProgramCounter(regs, "increment")); setNote("PC increments by the configured step."); }}>Increment</Button>
          <Button onClick={() => setRegs(stepProgramCounter(regs, "load", load))}>Load</Button>
          <Button onClick={() => setRegs(stepProgramCounter(regs, "reset"))}>Reset</Button>
        </div>
        <input className="text-input" aria-label="PC load value" type="number" value={load} onChange={(event) => setLoad(parseNumberInput(event.target.value, load))} />
      </Card>
      <Card title="IR, MAR, MDR">
        <Button onClick={() => setRegs(loadRegister(regs, "ir", 0b1011001010000011, true))}>Load IR</Button>
        <p>IR = {regs.ir.toString(2).padStart(16, "0")}</p>
        <Button onClick={() => { setRegs({ ...loadRegister(regs, "mar", regs.pc, true), mdrDirection: "read" }); setNote("MAR takes the PC value and drives the address bus."); }}>PC → MAR</Button>
        <p>MAR = 0x{regs.mar.toString(16)} · MDR direction {regs.mdrDirection}</p>
        <Button onClick={() => setRegs({ ...regs, mdrDirection: regs.mdrDirection === "read" ? "write" : "read" })}>Flip MDR</Button>
      </Card>
      <Card title="Register file">
        <Segmented options={["8×8", "8×16", "16×32"]} value={file.count === 16 ? "16×32" : file.width === 8 ? "8×8" : "8×16"} onChange={(value) => setFile(createRegisterFile(value === "16×32" ? 16 : 8, value === "8×8" ? 8 : value === "8×16" ? 16 : 32))} />
        {file.values.map((value, index) => (
          <div key={index} className="spread"><span>R{index}</span><input aria-label={`R${index}`} type="number" value={value} onChange={(event) => setFile(writePort(file, index, parseNumberInput(event.target.value, value), true))} /></div>
        ))}
      </Card>
      <Card title="Stack and flags">
        <p>SP = 0x{regs.sp.toString(16)}</p>
        <div className="row">
          <Button onClick={() => { const next = pushStack(regs, stackMem, 1); setRegs(next.registers); setStackMem(next.memory); setNote(next.explain); }}>Push</Button>
          <Button onClick={() => { const next = popStack(regs, stackMem); setRegs(next.registers); setNote(next.explain); }}>Pop</Button>
        </div>
        <p>Z {regs.flags.z} · N {regs.flags.n} · C {regs.flags.c} · V {regs.flags.v}</p>
        <Button onClick={() => {
          const result = alu(fromUnsigned(7, 4), fromUnsigned(1, 4), "ADD");
          setRegs({ ...regs, flags: { z: result.zero, n: result.negative, c: result.carry, v: result.overflow } });
          setNote("4-bit 7 + 1 uses the adder ALU. The result is 8 and the signed overflow flag is 1.");
        }}>ALU 7 + 1</Button>
        <Button onClick={() => void saveRecord({ id: "cpu-lab", kind: "cpu", name: "CPU blocks", data: JSON.stringify({ pc: regs.pc, ir: regs.ir }), updated: Date.now() })}>Save</Button>
      </Card>
    </div>
  );
}

function DatapathLab({ regs, setRegs, file, setFile, controls, setControls, setNote }: {
  regs: CpuRegisters;
  setRegs: (regs: CpuRegisters) => void;
  file: RegisterFile;
  setFile: (file: RegisterFile) => void;
  controls: ControlSignals;
  setControls: (controls: ControlSignals) => void;
  setNote: (note: string) => void;
}) {
  const keys = ["pcWrite", "irWrite", "regWrite", "memRead", "memWrite"] as const;
  return (
    <Card title="Manual control">
      <div className="row">
        {keys.map((key) => <Button key={key} onClick={() => setControls({ ...controls, [key]: !controls[key] })}>{key} {controls[key] ? "1" : "0"}</Button>)}
        <Button onClick={() => setControls({ ...controls, aluSrc: controls.aluSrc === 0 ? 1 : 0 })}>ALUSrc {controls.aluSrc}</Button>
      </div>
      <Button variant="primary" onClick={() => {
        const next = manualDatapath({ registers: regs, file, readA: 0, readB: 1, writeAddress: 2, immediate: 1, op: "ADD", controls, memory: {} });
        setRegs(next.registers);
        setFile(next.file);
        setNote(next.explain.join(" "));
      }}>Clock the datapath</Button>
      <p>Active route: {controls.aluSrc === 0 ? "both register outputs" : "register A and the immediate"} · result register R2 · flags Z{regs.flags.z} N{regs.flags.n} C{regs.flags.c} V{regs.flags.v}</p>
    </Card>
  );
}

function BusLab({ regs }: { regs: CpuRegisters }) {
  const [drivers, setDrivers] = useState<BusDriver[]>([
    { name: "PC", enabled: true, value: regs.pc },
    { name: "IR", enabled: false, value: regs.ir },
    { name: "MDR", enabled: false, value: regs.mdr },
  ]);
  const bus = driveBus(drivers);
  return (
    <Card title="Shared bus">
      {drivers.map((driver, index) => (
        <Button key={driver.name} onClick={() => setDrivers(drivers.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: !item.enabled, value: driver.name === "PC" ? regs.pc : item.value } : item))}>{driver.name} {driver.enabled ? "enabled" : "off"}</Button>
      ))}
      <p>Bus = {String(bus.value)}. {bus.explain}</p>
    </Card>
  );
}

function ExtendLab() {
  const [bits, setBits] = useState("11110000");
  const [signed, setSigned] = useState(true);
  const vector = fromUnsigned(0b1101, 4);
  const shifted = shiftVector(vector, "arithmetic-right", 1);
  return (
    <div className="grid cards-2">
      <Card title="Extension">
        <input className="text-input" aria-label="Bits to extend" value={bits} onChange={(event) => setBits(event.target.value.replace(/[^01]/g, "").slice(0, 16))} />
        <Button onClick={() => setSigned((value) => !value)}>{signed ? "Sign extend" : "Zero extend"}</Button>
        <p>{extendBits(bits || "0", 16, signed)}</p>
      </Card>
      <Card title="Shifter">
        <p>1101 arithmetic right → {toBinary(shifted.result)} carry {shifted.shiftedOut}</p>
        <p>Logical left of 0001 is {toBinary(shiftVector(fromUnsigned(1, 4), "logical-left", 1).result)}.</p>
        <p>Unsigned check {toUnsigned(fromUnsigned(1, 4))}.</p>
      </Card>
    </div>
  );
}

function ClockLab() {
  const [phase, setPhase] = useState(0);
  const phases = ["Clock edge", "Registers update", "Combinational logic evaluates", "Next values settle", "Next clock edge"];
  return (
    <Card title="Edge then cloud">
      <ol>{phases.map((item, index) => <li key={item}><strong>{index === phase ? item : item}</strong></li>)}</ol>
      <Button onClick={() => setPhase((value) => (value + 1) % phases.length)}>Advance</Button>
      <p>Now: {phases[phase]}. The register file and ALU do not form a pipeline here.</p>
    </Card>
  );
}
