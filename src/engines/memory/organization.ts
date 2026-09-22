import { addressBitsFor, capacityBits } from "./memoryArray";

export interface Organization {
  words: number;
  width: number;
  addressLines: number;
  capacityBits: number;
  label: string;
}

export function describeOrganization(words: number, width: number): Organization {
  return {
    words,
    width,
    addressLines: addressBitsFor(words),
    capacityBits: capacityBits(words, width),
    label: `${words} × ${width}`,
  };
}

export interface ChipSpec {
  addressLines: number;
  dataLines: number;
  controls: string[];
}

export function chipFromPins(addressLines: number, dataLines: number): { spec: ChipSpec; words: number; label: string } {
  const words = 2 ** addressLines;
  return {
    spec: { addressLines, dataLines, controls: ["CE", "OE", "WE"] },
    words,
    label: `${words >= 1024 ? `${words / 1024}K` : words} × ${dataLines}`,
  };
}

export function expandByWord(chips: Array<{ words: number; width: number }>): Organization {
  const words = chips[0]?.words ?? 0;
  const width = chips.reduce((sum, chip) => sum + chip.width, 0);
  return describeOrganization(words, width);
}

export function expandByAddress(chips: Array<{ words: number; width: number }>): Organization {
  const width = chips[0]?.width ?? 0;
  const words = chips.reduce((sum, chip) => sum + chip.words, 0);
  return describeOrganization(words, width);
}

export function interleavedBank(address: number, banks: number): { bank: number; offset: number; explain: string } {
  const count = Math.max(1, banks);
  const bank = address % count;
  return {
    bank,
    offset: Math.floor(address / count),
    explain: `Address ${address} goes to bank ${bank}. Low-order interleaving spreads successive addresses across banks.`,
  };
}
