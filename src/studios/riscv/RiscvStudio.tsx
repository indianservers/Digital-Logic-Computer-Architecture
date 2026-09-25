import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { archStudio } from "../../data/architecture";
import { blankRv, loadRv, stepRv, type RvState } from "../../engines/isaarch/riscv";
import {
  AluPage, AssemblerPage, BranchPage, DatapathPage, FormatPage, ImmPage, JalPage, LuiPage, MemoryPage, MultiPage, OverviewPage, PipePage, ProgramPage, RegisterPage,
} from "./pages";
import { RiscvShell } from "./shell";

const ADD = `addi x1, x0, 5
addi x2, x0, 7
add x3, x1, x2`;

function loaded(source: string): RvState {
  const next = loadRv(source);
  if ("ok" in next) {
    const failed = blankRv();
    failed.error = next.error;
    failed.halted = true;
    return failed;
  }
  return next;
}

export function RiscvStudio() {
  const lab = useParams().labId ?? "overview";
  const known = archStudio("riscv")?.labs.some((item) => item.id === lab) ?? false;
  const [sel, setSel] = useState(2);
  const [source, setSource] = useState(ADD);
  const [cpu, setCpuState] = useState<RvState>(() => loaded(ADD));
  const [playing, setPlaying] = useState(false);
  const setCpu = (update: (prev: RvState) => RvState) => setCpuState((prev) => update(prev));
  const loadSrc = (text: string) => {
    setSource(text);
    setCpuState(loaded(text));
    setPlaying(false);
  };
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setCpuState((prev) => {
        if (prev.halted) {
          setPlaying(false);
          return prev;
        }
        return stepRv(prev);
      });
    }, 280);
    return () => window.clearInterval(id);
  }, [playing]);
  const api = { source, setSource, cpu, setCpu, sel, setSel, loadSrc, playing, setPlaying };
  if (!known) return <Navigate to="/architecture/riscv" replace />;
  return (
    <RiscvShell lab={lab}>
      {lab === "overview" ? <OverviewPage api={api} /> : null}
      {lab === "registers" ? <RegisterPage api={api} /> : null}
      {lab === "formats" ? <FormatPage api={api} /> : null}
      {lab === "encoding" ? <FormatPage api={api} encoding /> : null}
      {lab === "assembler" ? <AssemblerPage api={api} /> : null}
      {lab === "arith" ? <AluPage /> : null}
      {lab === "loadstore" ? <MemoryPage api={api} /> : null}
      {lab === "branches" ? <BranchPage /> : null}
      {lab === "jal" ? <JalPage /> : null}
      {lab === "lui" ? <LuiPage /> : null}
      {lab === "immgen" ? <ImmPage /> : null}
      {lab === "datapath" ? <DatapathPage api={api} /> : null}
      {lab === "multicycle" ? <MultiPage api={api} /> : null}
      {lab === "pipeline" ? <PipePage /> : null}
      {lab === "hazards" ? <PipePage hazards /> : null}
      {lab === "program" ? <ProgramPage api={api} /> : null}
    </RiscvShell>
  );
}

export default RiscvStudio;
