import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { archStudio } from "../../data/architecture";
import { blankX86, type X86Cpu } from "../../engines/isaarch/x86";
import { AddressingPage, AssemblerPage, CachePage, DatapathPage, EncodingPage, MicroPage, OooPage, OverviewPage, PracticePage, RegisterPage } from "./pages";
import { X86Shell } from "./shell";

const ALIAS: Record<string, string> = {
  registers: "registers-flags",
  x64: "registers-flags",
  privilege: "registers-flags",
  flags: "registers-flags",
  variable: "instruction-encoding",
  decoder: "instruction-encoding",
  addressing: "addressing-modes",
  frontend: "decode-datapath",
  microops: "micro-operations",
  simd: "micro-operations",
  ooo: "out-of-order",
  memory: "memory-cache",
};

const SAMPLE = `xor rax, rax
mov rcx, 1
mov edx, 5
loop:
add rax, rcx
inc rcx
cmp rcx, rdx
jle loop
mov rdi, rax
ret`;

export function X86Studio() {
  const raw = useParams().labId ?? "overview";
  const lab = ALIAS[raw] ?? raw;
  const known = new Set(archStudio("x86")?.labs.map((item) => item.id));
  const [cpu, setCpu] = useState<X86Cpu>(() => blankX86());
  const [source, setSource] = useState(SAMPLE);
  const [status, setStatus] = useState("Ready.");
  if (!known.has(lab)) return <Navigate to="/architecture/x86" replace />;
  const api = { cpu, setCpu, source, setSource, status, setStatus };
  return (
    <X86Shell lab={lab}>
      {lab === "overview" && <OverviewPage />}
      {lab === "registers-flags" && <RegisterPage api={api} />}
      {lab === "instruction-encoding" && <EncodingPage />}
      {lab === "addressing-modes" && <AddressingPage />}
      {lab === "assembler-disassembler" && <AssemblerPage api={api} />}
      {lab === "decode-datapath" && <DatapathPage />}
      {lab === "micro-operations" && <MicroPage />}
      {lab === "out-of-order" && <OooPage />}
      {lab === "memory-cache" && <CachePage />}
      {lab === "practice" && <PracticePage />}
    </X86Shell>
  );
}

export default X86Studio;
