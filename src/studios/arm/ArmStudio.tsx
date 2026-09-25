import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { archStudio } from "../../data/architecture";
import { blankA64, type A64Cpu } from "../../engines/isaarch/arm";
import { ArmShell } from "./shell";
import { AssemblerPage, DatapathPage, EncodingPage, ExceptionPage, MemoryPage, OverviewPage, PipelinePage, PracticePage, RegisterPage, SocPage } from "./pages";

const ALIAS: Record<string, string> = {
  loadstore: "memory", arith: "instruction-set", branches: "datapath", calls: "assembler", stack: "memory", flags: "registers", aarch64: "instruction-set", neon: "instruction-set",
};

const SAMPLE = `ADD X0, X1, X2
ADDS X3, X0, X0
LDR X4, [X1, #0]
B skip
ADD X5, X5, X5
skip:
BL done
done:
RET`;

export function ArmStudio() {
  const raw = useParams().labId ?? "overview";
  const lab = ALIAS[raw] ?? raw;
  const known = new Set(archStudio("arm")?.labs.map((item) => item.id));
  const [cpu, setCpu] = useState<A64Cpu>(() => {
    const next = blankA64();
    next.x[1] = 8n;
    next.x[2] = 7n;
    return next;
  });
  const [source, setSource] = useState(SAMPLE);
  const [sel, setSel] = useState(0);
  const [status, setStatus] = useState("Ready.");
  if (!known.has(lab)) return <Navigate to="/architecture/arm" replace />;
  const api = { cpu, setCpu, source, setSource, sel, setSel, status, setStatus };
  return (
    <ArmShell lab={lab}>
      {lab === "overview" && <OverviewPage api={api} />}
      {lab === "registers" && <RegisterPage api={api} />}
      {lab === "instruction-set" && <EncodingPage />}
      {lab === "assembler" && <AssemblerPage api={api} />}
      {lab === "datapath" && <DatapathPage api={api} />}
      {lab === "pipeline" && <PipelinePage />}
      {lab === "memory" && <MemoryPage api={api} />}
      {lab === "exceptions" && <ExceptionPage api={api} />}
      {lab === "soc" && <SocPage />}
      {lab === "practice" && <PracticePage />}
    </ArmShell>
  );
}

export default ArmStudio;
