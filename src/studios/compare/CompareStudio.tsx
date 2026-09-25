import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CompareShell } from "./shell";
import { AddressingPage, DecodePage, EcosystemPage, EncodingPage, HomePage, LengthPage, MemoryPage, OverviewPage, RegisterPage, SameTaskPage } from "./pages";

const ALIAS: Record<string, string> = {
  home: "home",
  overview: "overview",
  registers: "register-models",
  "register-models": "register-models",
  encoding: "instruction-encoding",
  "instruction-encoding": "instruction-encoding",
  length: "instruction-length",
  "instruction-length": "instruction-length",
  memory: "memory-access",
  "memory-access": "memory-access",
  addressing: "addressing",
  same: "same-task",
  "same-task": "same-task",
  decode: "decode-complexity",
  "decode-complexity": "decode-complexity",
  ecosystem: "ecosystem-roles",
  "ecosystem-roles": "ecosystem-roles",
};

export function CompareStudio() {
  const raw = useParams().labId ?? "home";
  const lab = ALIAS[raw];
  const [resetKey, setResetKey] = useState(0);
  if (!lab) return <Navigate to="/architecture/compare" replace />;
  return (
    <CompareShell lab={lab} onReset={() => setResetKey((value) => value + 1)}>
      <div key={resetKey}>
        {lab === "home" && <HomePage />}
        {lab === "overview" && <OverviewPage />}
        {lab === "register-models" && <RegisterPage />}
        {lab === "instruction-encoding" && <EncodingPage />}
        {lab === "instruction-length" && <LengthPage />}
        {lab === "memory-access" && <MemoryPage />}
        {lab === "addressing" && <AddressingPage />}
        {lab === "same-task" && <SameTaskPage />}
        {lab === "decode-complexity" && <DecodePage />}
        {lab === "ecosystem-roles" && <EcosystemPage />}
      </div>
    </CompareShell>
  );
}

export default CompareStudio;
