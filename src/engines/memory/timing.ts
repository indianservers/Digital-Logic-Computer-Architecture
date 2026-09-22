export interface TimingMark {
  name: string;
  at: number;
  level: 0 | 1;
}

export function writeCycle(): TimingMark[] {
  return [
    { name: "Address", at: 0, level: 1 },
    { name: "CE", at: 1, level: 1 },
    { name: "WE", at: 2, level: 1 },
    { name: "Data in", at: 2, level: 1 },
    { name: "Stored", at: 3, level: 1 },
  ];
}

export function readCycle(): TimingMark[] {
  return [
    { name: "Address", at: 0, level: 1 },
    { name: "CE", at: 1, level: 1 },
    { name: "OE", at: 2, level: 1 },
    { name: "Data out", at: 3, level: 1 },
  ];
}

export const ROM_KINDS = [
  { id: "rom", title: "ROM", program: "Mask programmed at manufacture", erase: "Cannot erase", grain: "Whole chip", keep: "Non-volatile" },
  { id: "prom", title: "PROM", program: "Programmed once by the user", erase: "Cannot erase", grain: "Bit or word, once", keep: "Non-volatile" },
  { id: "eprom", title: "EPROM", program: "Electrically programmed", erase: "Ultraviolet light, whole chip", grain: "Chip erase", keep: "Non-volatile" },
  { id: "eeprom", title: "EEPROM", program: "Electrically programmed", erase: "Electrically, byte by byte", grain: "Byte", keep: "Non-volatile" },
  { id: "flash", title: "Flash", program: "Electrically programmed", erase: "Electrically, by block", grain: "Block", keep: "Non-volatile" },
] as const;
