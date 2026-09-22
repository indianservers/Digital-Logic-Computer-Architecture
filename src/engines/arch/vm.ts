export interface PageEntry {
  frame: number;
  valid: boolean;
  read: boolean;
  write: boolean;
  exec: boolean;
}

export interface TlbEntry extends PageEntry {
  vpn: number;
}

export type AccessKind = "read" | "write" | "exec";

export interface Translation {
  vpn: number;
  offset: number;
  frame: number | null;
  physical: number | null;
  status: "tlb-hit" | "page-hit" | "fault" | "protection";
  explain: string;
}

export function splitAddress(virtualAddress: number, pageBits: number): { vpn: number; offset: number } {
  const offsetMask = pageBits <= 0 ? 0 : (1 << pageBits) - 1;
  return { vpn: virtualAddress >>> pageBits, offset: virtualAddress & offsetMask };
}

export function splitTwoLevel(virtualAddress: number, pageBits: number, dirBits: number, tableBits: number): { directory: number; index: number; offset: number; vpn: number } {
  const { vpn, offset } = splitAddress(virtualAddress, pageBits);
  const indexMask = tableBits <= 0 ? 0 : (1 << tableBits) - 1;
  const directoryMask = dirBits <= 0 ? 0 : (1 << dirBits) - 1;
  return { directory: (vpn >>> tableBits) & directoryMask, index: vpn & indexMask, offset, vpn };
}

function allowed(entry: PageEntry, access: AccessKind): boolean {
  if (access === "write") return entry.write;
  if (access === "exec") return entry.exec;
  return entry.read;
}

function physicalOf(frame: number, offset: number, pageBits: number): number {
  return (frame << pageBits) | offset;
}

export function translate(
  virtualAddress: number,
  pageBits: number,
  table: PageEntry[],
  tlb: TlbEntry[],
  access: AccessKind,
): { result: Translation; tlb: TlbEntry[] } {
  const { vpn, offset } = splitAddress(virtualAddress, pageBits);
  const cached = tlb.find((entry) => entry.valid && entry.vpn === vpn);
  const entry = cached ?? table[vpn];
  if (!entry || !entry.valid) {
    return {
      result: { vpn, offset, frame: null, physical: null, status: "fault", explain: `VPN ${vpn} has no valid page. The lab raises a page fault and stops before a physical access.` },
      tlb,
    };
  }
  if (!allowed(entry, access)) {
    return {
      result: { vpn, offset, frame: entry.frame, physical: null, status: "protection", explain: `${access} is not allowed on VPN ${vpn}.` },
      tlb,
    };
  }
  const physical = physicalOf(entry.frame, offset, pageBits);
  if (cached) {
    return {
      result: { vpn, offset, frame: entry.frame, physical, status: "tlb-hit", explain: `TLB supplied frame ${entry.frame}. Physical address ${physical}.` },
      tlb,
    };
  }
  const installed: TlbEntry = { vpn, frame: entry.frame, valid: true, read: entry.read, write: entry.write, exec: entry.exec };
  const next = tlb.slice(1);
  next.push(installed);
  return {
    result: { vpn, offset, frame: entry.frame, physical, status: "page-hit", explain: `TLB miss. Page table maps VPN ${vpn} to frame ${entry.frame}. The TLB now stores that entry.` },
    tlb: next,
  };
}

export function translateTwoLevel(
  virtualAddress: number,
  pageBits: number,
  dirBits: number,
  tableBits: number,
  directory: Array<PageEntry[] | null>,
  access: AccessKind,
): Translation {
  const parts = splitTwoLevel(virtualAddress, pageBits, dirBits, tableBits);
  const table = directory[parts.directory];
  const entry = table?.[parts.index];
  if (!table || !entry || !entry.valid) {
    return { vpn: parts.vpn, offset: parts.offset, frame: null, physical: null, status: "fault", explain: `Directory ${parts.directory}, index ${parts.index} does not name a resident page.` };
  }
  if (!allowed(entry, access)) {
    return { vpn: parts.vpn, offset: parts.offset, frame: entry.frame, physical: null, status: "protection", explain: `${access} is blocked by the second-level entry.` };
  }
  const physical = physicalOf(entry.frame, parts.offset, pageBits);
  return { vpn: parts.vpn, offset: parts.offset, frame: entry.frame, physical, status: "page-hit", explain: `Walked directory ${parts.directory} then table index ${parts.index} to frame ${entry.frame}.` };
}

export function installPage(table: PageEntry[], vpn: number, frame: number): PageEntry[] {
  const next = table.slice();
  next[vpn] = { frame, valid: true, read: true, write: true, exec: false };
  return next;
}
