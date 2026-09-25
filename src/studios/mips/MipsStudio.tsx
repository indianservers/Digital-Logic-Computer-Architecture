import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { archStudio } from "../../data/architecture";
import { blankMips, type MipsCpu } from "../../engines/isaarch/mips";
import { MipsShell } from "./shell";
import { AssemblerPage, DatapathPage, FormatsPage, HazardsPage, MemoryPage, OverviewPage, PipelinePage, PracticePage, RegisterPage, SyscallPage } from "./pages";

const ALIAS: Record<string, string> = {
  registers: "register-file",
  formats: "instruction-formats",
  decoder: "instruction-formats",
  arith: "datapath",
  loadstore: "memory-io",
  branch: "datapath",
  control: "datapath",
  walkthrough: "assembler",
};

const SAMPLE = `addi $t0, $zero, 0
addi $t1, $zero, 10
loop:
add $t2, $t2, $t0
addi $t0, $t0, 1
bne $t0, $t1, loop`;

export function MipsStudio() {
  const raw = useParams().labId ?? "overview";
  const lab = ALIAS[raw] ?? raw;
  const known = new Set(archStudio("mips")?.labs.map((item) => item.id));
  const [source, setSource] = useState(SAMPLE);
  const [cpu, setCpu] = useState<MipsCpu>(() => {
    const next = blankMips();
    next.regs = next.regs.slice();
    next.regs[8] = 15;
    next.regs[9] = 11;
    next.regs[10] = 7;
    return next;
  });
  const [sel, setSel] = useState(8);
  const [status, setStatus] = useState("Ready.");
  if (!known.has(lab)) return <Navigate to="/architecture/mips" replace />;
  const api = { source, setSource, cpu, setCpu, sel, setSel, status, setStatus };
  return (
    <MipsShell lab={lab}>
      {lab === "overview" && <OverviewPage api={api} />}
      {lab === "instruction-formats" && <FormatsPage />}
      {lab === "register-file" && <RegisterPage api={api} />}
      {lab === "assembler" && <AssemblerPage api={api} />}
      {lab === "datapath" && <DatapathPage api={api} />}
      {lab === "pipeline" && <PipelinePage />}
      {lab === "hazards" && <HazardsPage />}
      {lab === "memory-io" && <MemoryPage api={api} />}
      {lab === "system-calls" && <SyscallPage api={api} />}
      {lab === "practice" && <PracticePage />}
    </MipsShell>
  );
}

export default MipsStudio;
