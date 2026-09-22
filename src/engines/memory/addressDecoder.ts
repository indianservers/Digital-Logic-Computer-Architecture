export interface DecodedAddress {
  index: number;
  active: number;
  explain: string;
}

export function decodeAddress(address: number, addressBits: number): DecodedAddress {
  const bits = Math.max(1, addressBits);
  const lines = 2 ** bits;
  const index = address & (lines - 1);
  return {
    index,
    active: index,
    explain: `Address ${address} (low ${bits} bits = ${index.toString(2).padStart(bits, "0")}) activates word line Y${index}. The other ${lines - 1} decoder outputs stay low.`,
  };
}

export function splitAddress(address: number, totalBits: number, offsetBits: number): {
  offset: number;
  select: number;
  offsetBits: string;
  selectBits: string;
  binary: string;
  explain: string;
} {
  const width = Math.max(1, totalBits);
  const offWidth = Math.min(width, Math.max(0, offsetBits));
  const selWidth = Math.max(0, width - offWidth);
  const mask = offWidth >= 31 ? 0x7fffffff : (1 << offWidth) - 1;
  const offset = address & mask;
  const select = selWidth === 0 ? 0 : (address >>> offWidth) & ((1 << Math.min(31, selWidth)) - 1);
  const binary = (address >>> 0).toString(2).padStart(width, "0").slice(-width);
  const selectBits = selWidth ? select.toString(2).padStart(selWidth, "0") : "—";
  const offsetText = offWidth ? offset.toString(2).padStart(offWidth, "0") : "—";
  return {
    offset,
    select,
    offsetBits: offsetText,
    selectBits,
    binary,
    explain: selWidth === 0
      ? `All ${width} bits are the offset; there is only one chip.`
      : selWidth === 1
        ? `A${offWidth} (${selectBits}) selects chip ${select}. A${Math.max(0, offWidth - 1)}…A0 (${offsetText}) are the offset inside that chip.`
        : `A${width - 1}…A${offWidth} (${selectBits}) select chip ${select}. A${Math.max(0, offWidth - 1)}…A0 (${offsetText}) are the offset inside that chip.`,
  };
}

export interface ChipRange {
  chip: number;
  start: number;
  end: number;
  selected: boolean;
}

export function chipMap(cpuAddressBits: number, wordsPerChip: number, address: number): { chips: ChipRange[]; bitsForSelect: number; explain: string } {
  const space = 2 ** cpuAddressBits;
  const count = Math.max(1, Math.ceil(space / wordsPerChip));
  const selectBits = Math.max(0, cpuAddressBits - Math.ceil(Math.log2(wordsPerChip)));
  const chips = Array.from({ length: count }, (_, chip) => {
    const start = chip * wordsPerChip;
    const end = Math.min(space, start + wordsPerChip) - 1;
    return { chip, start, end, selected: address >= start && address <= end };
  });
  const selected = chips.find((chip) => chip.selected);
  return {
    chips,
    bitsForSelect: selectBits,
    explain: selected
      ? `Address ${address} falls in chip ${selected.chip}, range ${selected.start}–${selected.end}. High-order bits form the chip select.`
      : "That address is outside the mapped chips.",
  };
}
