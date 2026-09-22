import { maskWidth } from "./registers";

export interface RegisterFile {
  count: number;
  width: number;
  values: number[];
}

export function createRegisterFile(count: number, width: number): RegisterFile {
  return { count, width, values: Array.from({ length: count }, () => 0) };
}

export function readPorts(file: RegisterFile, addressA: number, addressB: number): { a: number; b: number } {
  return { a: file.values[addressA] ?? 0, b: file.values[addressB] ?? 0 };
}

export function writePort(file: RegisterFile, address: number, data: number, regWrite: boolean): RegisterFile {
  if (!regWrite || address < 0 || address >= file.count) return file;
  const values = file.values.slice();
  values[address] = data & maskWidth(file.width);
  return { ...file, values };
}
