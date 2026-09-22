import { accessCache, createCache, type CacheMachine } from "../cache/cache";
import { L1_PRESET } from "../arch/hierarchy";

export const DESKTOP_BLOCKS = [
  { id: "cores", name: "CPU cores", note: "Out-of-order cores with private L1/L2 in this teaching package." },
  { id: "llc", name: "Last-level cache", note: "Shared LLC between cores." },
  { id: "mesh", name: "Interconnect", note: "Conceptual fabric, not a vendor mesh copy." },
  { id: "mc", name: "Memory controller", note: "DDR channel scheduling." },
  { id: "igpu", name: "Integrated GPU", note: "Optional graphics block sharing the package memory system." },
  { id: "pcie", name: "I/O / PCIe", note: "Link to devices off-package." },
];

export function threadsShare(smt: boolean): { threads: number; note: string } {
  return smt
    ? { threads: 2, note: "Two hardware threads share the core’s execution resources conceptually." }
    : { threads: 1, note: "One thread occupies the core." };
}

export function desktopCache(): CacheMachine {
  return createCache({ ...L1_PRESET, associativity: 2, cacheBytes: 32 });
}

export function cacheHop(machine: CacheMachine, address: number): { machine: CacheMachine; hit: boolean } {
  const next = accessCache(machine, address, "read");
  return { machine: next.machine, hit: next.result.hit };
}

export const PCIE_DEVICES = [
  { id: "dgpu", name: "Discrete GPU", note: "High-bandwidth peer on PCIe." },
  { id: "nvme", name: "NVMe storage", note: "Block device via NVMe over PCIe." },
  { id: "nic", name: "Network card", note: "Packets DMA into system memory." },
];

export const DDR_PATH = ["Core", "Cache miss", "Memory controller", "DDR", "Return data"];

export function boost(cores: number, load: number, thermalHeadroom: number, powerLimit: number): { base: number; boost: number; limited: string } {
  const base = 3.0;
  const room = Math.max(0, Math.min(1, thermalHeadroom / 100)) * Math.max(0, Math.min(1, powerLimit / 100));
  const corePenalty = Math.max(0.4, 1 - (Math.max(1, cores) - 1) * 0.08);
  const boostGhz = Number((base + 1.6 * room * corePenalty * (load / 100)).toFixed(2));
  const limited = thermalHeadroom < 30 ? "thermal" : powerLimit < 40 ? "package power" : cores > 6 ? "many-core sharing" : "headroom available";
  return { base, boost: boostGhz, limited };
}

export function packagePower(cores: number, igpu: number, llc: number): { total: number; parts: Record<string, number>; hot: boolean } {
  const parts = {
    cores: Math.round(cores * 8),
    cache: Math.round(llc * 0.4),
    igpu: Math.round(igpu * 6),
    mc: 6,
  };
  const total = parts.cores + parts.cache + parts.igpu + parts.mc;
  return { total, parts, hot: total > 90 };
}

export const WORKLOADS = [
  { id: "st", name: "Single-thread compilation", cores: 1, smt: false, mem: 30, igpu: 0 },
  { id: "mt", name: "Multi-thread rendering", cores: 8, smt: true, mem: 50, igpu: 20 },
  { id: "game", name: "Gaming-style CPU load", cores: 4, smt: true, mem: 40, igpu: 70 },
  { id: "mem", name: "Memory-heavy workload", cores: 4, smt: false, mem: 90, igpu: 0 },
  { id: "bg", name: "Background workload", cores: 2, smt: false, mem: 20, igpu: 0 },
];
