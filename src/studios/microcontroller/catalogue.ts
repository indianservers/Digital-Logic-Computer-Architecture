import { MICROCONTROLLER_LABS } from "../../data/microcontrollerLabs";
import { LAB_META, labPath } from "./labs/registry";
import { PROJECT_LABS } from "./projectData";

/** The directory derives availability from the same registry used by lab navigation. */
export const MCU_CATALOGUE = MICROCONTROLLER_LABS.map((lab) => {
  const core = LAB_META.find((item) => item.n === lab.number);
  const project = PROJECT_LABS.find((item) => item.number === lab.number);
  const path = core ? labPath(core) : project ? `/studios/microcontroller/project/${project.slug}` : undefined;
  return { ...lab, status: path ? "open" as const : "planned" as const, path, kind: project ? "Project" : "Core lab" };
});

export const MCU_OPEN_LABS = MCU_CATALOGUE.filter((lab) => lab.status === "open");
