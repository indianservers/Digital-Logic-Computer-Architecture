import { useSearchParams } from "react-router-dom";
import { AddressingLab } from "./addressingLab";
import { DramLab } from "./dramLab";
import { EepromLab } from "./eepromLab";
import { FlashLab } from "./flashLab";
import { OrganizationLab } from "./organizationLab";
import { RamLab } from "./ramLab";
import { RomLab } from "./romLab";
import { SramLab } from "./sramLab";

/**
 * Memory Fundamentals checklist:
 * - Keep /studios/memory?tab= and the existing memory engines.
 * - RAM stays a real access simulator: decoder, buses, cycle, map, preload.
 * - SRAM, DRAM, ROM, EEPROM, Flash, Addressing, and Organization are interactive labs.
 * - Each lab owns its state so switching tabs does not wipe the experiment.
 * - Explain opens the lab guide. Reset restores that lab's known start.
 */

type Chip = "array" | "sram" | "dram" | "rom" | "eeprom" | "flash" | "addressing" | "organization";

const CHIPS: Array<{ id: Chip; label: string }> = [
  { id: "array", label: "RAM" },
  { id: "sram", label: "SRAM" },
  { id: "dram", label: "DRAM" },
  { id: "rom", label: "ROM" },
  { id: "eeprom", label: "EEPROM" },
  { id: "flash", label: "Flash" },
  { id: "addressing", label: "Addressing" },
  { id: "organization", label: "Memory Organization" },
];

export function MemoryFundamentals() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") ?? "array";
  const chip: Chip = CHIPS.some((item) => item.id === raw) ? raw as Chip : "array";

  function select(id: Chip) {
    const query = new URLSearchParams(params);
    query.set("tab", id);
    setParams(query);
  }

  return (
    <div className="memx">
      <div className="lgx-tabs" role="tablist" aria-label="Memory Fundamentals">
        {CHIPS.map((item) => (
          <button key={item.id} type="button" role="tab" id={`memory-tab-${item.id}`} aria-selected={chip === item.id} aria-controls={`memory-panel-${item.id}`} className={chip === item.id ? "on" : ""} onClick={() => select(item.id)}>{item.label}</button>
        ))}
      </div>
      <div role="tabpanel" id="memory-panel-array" aria-labelledby="memory-tab-array" hidden={chip !== "array"} inert={chip !== "array"}><RamLab /></div>
      <div role="tabpanel" id="memory-panel-sram" aria-labelledby="memory-tab-sram" hidden={chip !== "sram"} inert={chip !== "sram"}><SramLab /></div>
      <div role="tabpanel" id="memory-panel-dram" aria-labelledby="memory-tab-dram" hidden={chip !== "dram"} inert={chip !== "dram"}><DramLab /></div>
      <div role="tabpanel" id="memory-panel-rom" aria-labelledby="memory-tab-rom" hidden={chip !== "rom"} inert={chip !== "rom"}><RomLab /></div>
      <div role="tabpanel" id="memory-panel-eeprom" aria-labelledby="memory-tab-eeprom" hidden={chip !== "eeprom"} inert={chip !== "eeprom"}><EepromLab /></div>
      <div role="tabpanel" id="memory-panel-flash" aria-labelledby="memory-tab-flash" hidden={chip !== "flash"} inert={chip !== "flash"}><FlashLab /></div>
      <div role="tabpanel" id="memory-panel-addressing" aria-labelledby="memory-tab-addressing" hidden={chip !== "addressing"} inert={chip !== "addressing"}><AddressingLab /></div>
      <div role="tabpanel" id="memory-panel-organization" aria-labelledby="memory-tab-organization" hidden={chip !== "organization"} inert={chip !== "organization"}><OrganizationLab /></div>
    </div>
  );
}
