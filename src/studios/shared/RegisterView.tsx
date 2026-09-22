import { formatReg } from "../../engines/cpu8/cpu8";

export function RegisterView({ name, width, value, changed }: { name: string; width: 8 | 16; value: number; changed?: boolean }) {
  const shown = formatReg(value, width);
  return (
    <div className={changed ? "cpu-block on" : "cpu-block"}>
      <strong>{name}</strong>
      <small>Binary {shown.binary}</small>
      <small>Hex {shown.hex}</small>
      <small>Unsigned {shown.decimal}</small>
    </div>
  );
}
