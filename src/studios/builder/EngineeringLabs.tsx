import { CpuOverview } from "./CpuOverview";
import { ContestLab } from "./ContestLab";
import { LibraryLab } from "./LibraryLab";
import { IsaLab,FormatLab } from "./IsaLabs";
import { ControlLab,MemoryLab } from "./ControlMemoryLabs";
import { ProgramLab,AssemblerLab } from "./ProgramLabs";
import { DebugLab,ValidationLab,TemplatesLab } from "./DebugValidationTemplates";
import { GraphLab } from "./GraphLab";
import type { LabProps } from "./labTypes";
export function EngineeringLabs({ lab,...props }:LabProps & { lab:string }) {
  switch(lab) {
    case "contest":return <ContestLab {...props}/>;
    case "library":return <LibraryLab {...props}/>;
    case "datapath":return <GraphLab {...props}/>;
    case "wires":return <GraphLab {...props} wires/>;
    case "isa":return <IsaLab {...props}/>;
    case "format":return <FormatLab {...props}/>;
    case "control":return <ControlLab {...props}/>;
    case "memory":return <MemoryLab {...props}/>;
    case "editor":return <ProgramLab {...props}/>;
    case "assembler":return <AssemblerLab {...props}/>;
    case "debug":return <DebugLab {...props}/>;
    case "validate":return <ValidationLab {...props}/>;
    case "templates":return <TemplatesLab {...props}/>;
    default:return <CpuOverview/>;
  }
}
