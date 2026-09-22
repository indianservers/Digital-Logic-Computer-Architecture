export interface DecodedAddress {
  index: number;
  active: number;
  explain: string;
}

export function decodeAddress(address: number, addressBits: number): DecodedAddress {
  const lines = 2 ** addressBits;
  const index = address & (lines - 1);
  return {
    index,
    active: index,
    explain: `Address ${address} activates decoder output ${index}. The other ${lines - 1} outputs stay low.`,
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
