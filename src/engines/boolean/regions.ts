/** Distinct set colors for a 3-variable Venn. Output only changes saturation. */
const THREE: Record<string, { one: string; zero: string; ink: string }> = {
  "000": { one: "#93c5fd", zero: "#e8eef6", ink: "#1e3a8a" },
  "100": { one: "#2563eb", zero: "#dbeafe", ink: "#ffffff" },
  "010": { one: "#e11d48", zero: "#ffe4e6", ink: "#ffffff" },
  "001": { one: "#059669", zero: "#d1fae5", ink: "#ffffff" },
  "110": { one: "#7c3aed", zero: "#ede9fe", ink: "#ffffff" },
  "101": { one: "#0891b2", zero: "#cffafe", ink: "#ffffff" },
  "011": { one: "#d97706", zero: "#fef3c7", ink: "#ffffff" },
  "111": { one: "#312e81", zero: "#e0e7ff", ink: "#ffffff" },
};

const TWO: Record<string, { one: string; zero: string; ink: string }> = {
  "00": { one: "#93c5fd", zero: "#e8eef6", ink: "#1e3a8a" },
  "10": { one: "#2563eb", zero: "#dbeafe", ink: "#ffffff" },
  "01": { one: "#e11d48", zero: "#ffe4e6", ink: "#ffffff" },
  "11": { one: "#7c3aed", zero: "#ede9fe", ink: "#ffffff" },
};

export function vennTone(bits: string, value: 0 | 1): { fill: string; ink: string } {
  const row = (bits.length === 3 ? THREE[bits] : TWO[bits]) ?? THREE["000"];
  if (!row) return { fill: "#e8eef6", ink: "#0f172a" };
  if (value === 1) return { fill: row.one, ink: row.ink };
  return { fill: row.zero, ink: "#0f172a" };
}

export function mintermLiteral(names: string[], bits: Array<0 | 1>): string {
  return names.map((name, index) => ((bits[index] ?? 0) === 1 ? name : `${name}'`)).join("");
}

export function maxtermLiteral(names: string[], bits: Array<0 | 1>): string {
  return names.map((name, index) => ((bits[index] ?? 0) === 0 ? name : `${name}'`)).join(" + ");
}

export function cubeEdges(vertices: Array<[0 | 1, 0 | 1, 0 | 1]>): Array<[[0 | 1, 0 | 1, 0 | 1], [0 | 1, 0 | 1, 0 | 1]]> {
  const edges: Array<[[0 | 1, 0 | 1, 0 | 1], [0 | 1, 0 | 1, 0 | 1]]> = [];
  vertices.forEach((from, index) => {
    vertices.slice(index + 1).forEach((to) => {
      const distance = from.filter((bit, bitIndex) => bit !== to[bitIndex]).length;
      if (distance === 1) edges.push([from, to]);
    });
  });
  return edges;
}
