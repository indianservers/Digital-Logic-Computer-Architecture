import { addNode, connect, emptyDoc } from "./engine";
import type { CircuitDoc } from "./types";

type CircuitExample = { id: string; name: string; category: string; build: () => CircuitDoc };

type Part = { type: string; x: number; y: number; label: string; params?: Record<string, number | string> };
type Link = [string, string, string, string];

function circuit(parts: Part[], links: Link[]): CircuitDoc {
  let doc = emptyDoc();
  const ids = new Map<string, string>();
  for (const part of parts) {
    doc = addNode(doc, part.type, part.x, part.y, part.label, part.params);
    ids.set(part.label, `n${doc.nextId - 1}`);
  }
  for (const [from, fromPort, to, toPort] of links) {
    const source = ids.get(from);
    const sink = ids.get(to);
    if (!source || !sink) continue;
    doc = connect(doc, source, fromPort, sink, toPort).doc;
  }
  return doc;
}

/** `in A 1, and G, led L >> A.Y>G.A, G.Y>L.A` */
function parse(spec: string): CircuitDoc {
  const [body, wires] = spec.split(" >> ");
  const parts: Part[] = [];
  let inputs = 0;
  let gates = 0;
  let sinks = 0;
  for (const raw of (body ?? "").split(",")) {
    const token = raw.trim().split(/\s+/);
    const kind = token[0] ?? "";
    const label = token[1] ?? kind;
    if (kind === "in") {
      parts.push({ type: "input", x: 24, y: 24 + inputs * 64, label, params: { value: Number(token[2] ?? 0) } });
      inputs += 1;
    } else if (kind === "high" || kind === "low") {
      parts.push({ type: kind, x: 24, y: 24 + inputs * 64, label });
      inputs += 1;
    } else if (kind === "clock" || kind === "button") {
      parts.push({ type: kind, x: 24, y: 24 + inputs * 64, label });
      inputs += 1;
    } else {
      const wide = kind === "led" || kind === "bulb" || kind === "buzzer" || kind === "motor" || kind === "relay" || kind === "probe" || kind === "output" || kind === "hex" || kind === "bar" || kind === "rgb" || kind === "bicolor" || kind === "traffic" || kind === "seg7";
      const x = wide ? 420 : 200;
      const y = wide ? 36 + sinks * 72 : 28 + gates * 78;
      const inputsCount = Number(token[2] ?? 0);
      parts.push({ type: kind, x, y, label, params: inputsCount >= 2 ? { inputs: inputsCount } : undefined });
      if (wide) sinks += 1;
      else gates += 1;
    }
  }
  const links: Link[] = (wires ?? "").split(",").filter((item) => item.includes(">")).map((item) => {
    const [from, to] = item.split(">").map((side) => side.trim());
    const [fromLabel, fromPort] = (from ?? "").split(".");
    const [toLabel, toPort] = (to ?? "").split(".");
    return [fromLabel ?? "", fromPort ?? "Y", toLabel ?? "", toPort ?? "A"];
  });
  return circuit(parts, links);
}

function row(id: string, category: string, name: string, spec: string): CircuitExample {
  return { id, name, category, build: () => parse(spec) };
}

const gates = ["and", "or", "xor", "nand", "nor", "xnor"] as const;
const pairs: Array<[number, number]> = [[0, 0], [0, 1], [1, 0], [1, 1]];
const truth: CircuitExample[] = gates.flatMap((gate) => pairs.map(([a, b]) => row(
  `${gate}-${a}${b}`,
  "Gates",
  `${gate.toUpperCase()} with A=${a} B=${b}`,
  `in A ${a}, in B ${b}, ${gate} G, led L >> A.Y>G.A, B.Y>G.B, G.Y>L.A`,
)));

const named: CircuitExample[] = [
  row("id-or0", "Networks", "A OR 0", "in A 1, low Z, or G, led L >> A.Y>G.A, Z.Y>G.B, G.Y>L.A"),
  row("id-or1", "Networks", "A OR 1", "in A 0, high H, or G, led L >> A.Y>G.A, H.Y>G.B, G.Y>L.A"),
  row("id-and0", "Networks", "A AND 0", "in A 1, low Z, and G, led L >> A.Y>G.A, Z.Y>G.B, G.Y>L.A"),
  row("id-and1", "Networks", "A AND 1", "in A 1, high H, and G, led L >> A.Y>G.A, H.Y>G.B, G.Y>L.A"),
  row("id-anda", "Networks", "A AND A", "in A 1, and G, led L >> A.Y>G.A, A.Y>G.B, G.Y>L.A"),
  row("id-ora", "Networks", "A OR A", "in A 0, or G, led L >> A.Y>G.A, A.Y>G.B, G.Y>L.A"),
  row("id-xor0", "Networks", "A XOR 0", "in A 1, low Z, xor G, led L >> A.Y>G.A, Z.Y>G.B, G.Y>L.A"),
  row("id-xor1", "Networks", "A XOR 1 is NOT", "in A 1, high H, xor G, led L >> A.Y>G.A, H.Y>G.B, G.Y>L.A"),
  row("id-xora", "Networks", "A XOR A is 0", "in A 1, xor G, led L >> A.Y>G.A, A.Y>G.B, G.Y>L.A"),
  row("id-nn", "Networks", "NOT NOT A", "in A 0, not N1, not N2, led L >> A.Y>N1.A, N1.Y>N2.A, N2.Y>L.A"),
  row("id-nand-not", "Networks", "NAND tied inputs is NOT", "in A 1, nand G, led L >> A.Y>G.A, A.Y>G.B, G.Y>L.A"),
  row("id-nor-not", "Networks", "NOR tied inputs is NOT", "in A 0, nor G, led L >> A.Y>G.A, A.Y>G.B, G.Y>L.A"),
  row("disp-bulb1", "Displays", "Bulb on", "high H, bulb L >> H.Y>L.A"),
  row("disp-bulb0", "Displays", "Bulb off", "low Z, bulb L >> Z.Y>L.A"),
  row("disp-buzz1", "Displays", "Buzzer on", "high H, buzzer Z >> H.Y>Z.A"),
  row("disp-buzz0", "Displays", "Buzzer off", "low Z, buzzer B >> Z.Y>B.A"),
  row("disp-motor", "Displays", "Motor on", "high H, motor M >> H.Y>M.A"),
  row("disp-relay", "Displays", "Relay closed", "high H, relay R >> H.Y>R.A"),
  row("disp-red", "Displays", "Bi-color red", "high H, low Z, bicolor L >> H.Y>L.R, Z.Y>L.G"),
  row("disp-green", "Displays", "Bi-color green", "low Z, high H, bicolor L >> Z.Y>L.R, H.Y>L.G"),
  row("disp-yellow", "Displays", "Bi-color yellow", "high R, high G, bicolor L >> R.Y>L.R, G.Y>L.G"),
  row("disp-rgb-r", "Displays", "RGB red", "high R, low G, low B, rgb L >> R.Y>L.R, G.Y>L.G, B.Y>L.B"),
  row("disp-rgb-g", "Displays", "RGB green", "low R, high G, low B, rgb L >> R.Y>L.R, G.Y>L.G, B.Y>L.B"),
  row("disp-rgb-b", "Displays", "RGB blue", "low R, low G, high B, rgb L >> R.Y>L.R, G.Y>L.G, B.Y>L.B"),
  row("disp-rgb-w", "Displays", "RGB white", "high R, high G, high B, rgb L >> R.Y>L.R, G.Y>L.G, B.Y>L.B"),
  row("disp-hex-a", "Displays", "Hex digit A", "high D3, low D2, high D1, low D0, hex H >> D3.Y>H.D3, D2.Y>H.D2, D1.Y>H.D1, D0.Y>H.D0"),
  row("disp-hex-0", "Displays", "Hex digit 0", "low D3, low D2, low D1, low D0, hex H >> D3.Y>H.D3, D2.Y>H.D2, D1.Y>H.D1, D0.Y>H.D0"),
  row("disp-red-lamp", "Displays", "Traffic lamp red", "high R, low Y, low G, traffic T >> R.Y>T.R, Y.Y>T.Y, G.Y>T.G"),
  row("disp-green-lamp", "Displays", "Traffic lamp green", "low R, low Y, high G, traffic T >> R.Y>T.R, Y.Y>T.Y, G.Y>T.G"),
  row("route-mux0", "Routing", "MUX selects I0", "high A, low B, low S, mux2 M, led L >> A.Y>M.I0, B.Y>M.I1, S.Y>M.S, M.Y>L.A"),
  row("route-mux1", "Routing", "MUX selects I1", "low A, high B, high S, mux2 M, led L >> A.Y>M.I0, B.Y>M.I1, S.Y>M.S, M.Y>L.A"),
  row("route-dec0", "Routing", "Decoder address 00", "low A, low B, dec2 D, led L >> A.Y>D.A, B.Y>D.B, D.Y0>L.A"),
  row("route-dec1", "Routing", "Decoder address 01", "high A, low B, dec2 D, led L >> A.Y>D.A, B.Y>D.B, D.Y1>L.A"),
  row("route-dec2", "Routing", "Decoder address 10", "low A, high B, dec2 D, led L >> A.Y>D.A, B.Y>D.B, D.Y2>L.A"),
  row("route-dec3", "Routing", "Decoder address 11", "high A, high B, dec2 D, led L >> A.Y>D.A, B.Y>D.B, D.Y3>L.A"),
  row("route-bar", "Routing", "Decoder into LED bar", "high A, low B, dec2 D, bar L >> A.Y>D.A, B.Y>D.B, D.Y0>L.L0, D.Y1>L.L1, D.Y2>L.L2, D.Y3>L.L3"),
  row("route-en", "Routing", "AND used as enable", "high D, low E, and G, led L >> D.Y>G.A, E.Y>G.B, G.Y>L.A"),
  row("route-buf", "Routing", "Buffer copies A", "in A 1, buf G, led L >> A.Y>G.A, G.Y>L.A"),
  row("route-tri", "Routing", "Tri-state enabled", "high D, high E, tri G, probe P >> D.Y>G.A, E.Y>G.EN, G.Y>P.A"),
  row("add-ha00", "Arithmetic", "Half adder 0+0", "low A, low B, ha H, led S, led C >> A.Y>H.A, B.Y>H.B, H.S>S.A, H.C>C.A"),
  row("add-ha01", "Arithmetic", "Half adder 0+1", "low A, high B, ha H, led S, led C >> A.Y>H.A, B.Y>H.B, H.S>S.A, H.C>C.A"),
  row("add-ha10", "Arithmetic", "Half adder 1+0", "high A, low B, ha H, led S, led C >> A.Y>H.A, B.Y>H.B, H.S>S.A, H.C>C.A"),
  row("add-ha11", "Arithmetic", "Half adder 1+1", "high A, high B, ha H, led S, led C >> A.Y>H.A, B.Y>H.B, H.S>S.A, H.C>C.A"),
  row("add-fa", "Arithmetic", "Full adder 1+1+1", "high A, high B, high C, fa H, led S, led CO >> A.Y>H.A, B.Y>H.B, C.Y>H.CIN, H.S>S.A, H.COUT>CO.A"),
  row("add-eq", "Arithmetic", "Equality A XNOR B", "in A 1, in B 1, xnor G, led L >> A.Y>G.A, B.Y>G.B, G.Y>L.A"),
  row("add-ne", "Arithmetic", "Inequality A XOR B", "in A 1, in B 0, xor G, led L >> A.Y>G.A, B.Y>G.B, G.Y>L.A"),
  row("add-hs", "Arithmetic", "Half subtract 1−0", "high A, low B, hsub H, led D, led BO >> A.Y>H.A, B.Y>H.B, H.D>D.A, H.BO>BO.A"),
  row("add-inc", "Arithmetic", "Increment with XOR and AND", "in A 1, high C, xor S, and K, led Y, led CO >> A.Y>S.A, C.Y>S.B, A.Y>K.A, C.Y>K.B, S.Y>Y.A, K.Y>CO.A"),
  row("add-cmp0", "Arithmetic", "Both inputs low", "low A, low B, xnor G, led L >> A.Y>G.A, B.Y>G.B, G.Y>L.A"),
  row("seq-dff", "Sequential", "D flip-flop D=1 clock low", "high D, low C, low R, dff Q, led L >> D.Y>Q.D, C.Y>Q.CLK, R.Y>Q.CLR, Q.Q>L.A"),
  row("seq-sr", "Sequential", "SR latch set", "high S, low R, sr Q, led L >> S.Y>Q.S, R.Y>Q.R, Q.Q>L.A"),
  row("seq-sr-r", "Sequential", "SR latch reset", "low S, high R, sr Q, led L >> S.Y>Q.S, R.Y>Q.R, Q.Q>L.A"),
  row("seq-dl", "Sequential", "D latch enabled", "high D, high E, dlatch Q, led L >> D.Y>Q.D, E.Y>Q.EN, Q.Q>L.A"),
  row("seq-jk", "Sequential", "JK hold J=0 K=0", "low J, low K, low C, jkff Q, led L >> J.Y>Q.J, K.Y>Q.K, C.Y>Q.CLK, Q.Q>L.A"),
  row("seq-t", "Sequential", "T flip-flop T=1", "high T, low C, tff Q, led L >> T.Y>Q.T, C.Y>Q.CLK, Q.Q>L.A"),
  row("seq-clk", "Sequential", "Clock into an LED", "clock C, led L >> C.Y>L.A"),
  row("seq-clk-buzz", "Sequential", "Clock into a buzzer", "clock C, buzzer Z >> C.Y>Z.A"),
  row("bool-abn", "Networks", "A AND NOT B", "in A 1, in B 1, not N, and G, led L >> B.Y>N.A, A.Y>G.A, N.Y>G.B, G.Y>L.A"),
  row("bool-nab", "Networks", "NOT A AND B", "in A 1, in B 1, not N, and G, led L >> A.Y>N.A, N.Y>G.A, B.Y>G.B, G.Y>L.A"),
  row("bool-dem", "Networks", "NOT (A OR B)", "in A 0, in B 1, or G, not N, led L >> A.Y>G.A, B.Y>G.B, G.Y>N.A, N.Y>L.A"),
  row("bool-dm2", "Networks", "NOT A AND NOT B", "in A 0, in B 0, not N1, not N2, and G, led L >> A.Y>N1.A, B.Y>N2.A, N1.Y>G.A, N2.Y>G.B, G.Y>L.A"),
  row("bool-imp", "Networks", "NOT A OR B", "in A 0, in B 0, not N, or G, led L >> A.Y>N.A, N.Y>G.A, B.Y>G.B, G.Y>L.A"),
  row("bool-orand", "Networks", "(A OR B) AND C", "in A 1, in B 0, in C 1, or G, and H, led L >> A.Y>G.A, B.Y>G.B, G.Y>H.A, C.Y>H.B, H.Y>L.A"),
  row("bool-andor", "Networks", "(A AND B) OR C", "in A 0, in B 1, in C 1, and G, or H, led L >> A.Y>G.A, B.Y>G.B, G.Y>H.A, C.Y>H.B, H.Y>L.A"),
  row("bool-xor3", "Networks", "3-bit odd parity", "in A 1, in B 1, in C 0, xor G, xor H, led L >> A.Y>G.A, B.Y>G.B, G.Y>H.A, C.Y>H.B, H.Y>L.A"),
  row("bool-xnor2", "Networks", "2-bit even parity", "in A 1, in B 0, xnor G, led L >> A.Y>G.A, B.Y>G.B, G.Y>L.A"),
  row("bool-nand2", "Networks", "NAND then NOT is AND", "in A 1, in B 1, nand G, not N, led L >> A.Y>G.A, B.Y>G.B, G.Y>N.A, N.Y>L.A"),
  row("bool-nor2", "Networks", "NOR then NOT is OR", "in A 0, in B 1, nor G, not N, led L >> A.Y>G.A, B.Y>G.B, G.Y>N.A, N.Y>L.A"),
  row("bool-fan", "Networks", "One switch, LED and bulb", "in A 1, led L, bulb B >> A.Y>L.A, A.Y>B.A"),
  row("bool-maj", "Networks", "Two of three with AND-OR", "in A 1, in B 1, in C 0, and G1, and G2, or H, led L >> A.Y>G1.A, B.Y>G1.B, A.Y>G2.A, C.Y>G2.B, G1.Y>H.A, G2.Y>H.B, H.Y>L.A"),
  row("bool-buf3", "Networks", "Three buffers", "in A 1, buf B1, buf B2, buf B3, led L >> A.Y>B1.A, B1.Y>B2.A, B2.Y>B3.A, B3.Y>L.A"),
  row("bool-not3", "Networks", "Three NOTs", "in A 1, not N1, not N2, not N3, led L >> A.Y>N1.A, N1.Y>N2.A, N2.Y>N3.A, N3.Y>L.A"),
  row("bool-a-bc", "Networks", "A OR (B AND C)", "in A 0, in B 1, in C 1, and G, or H, led L >> B.Y>G.A, C.Y>G.B, A.Y>H.A, G.Y>H.B, H.Y>L.A"),
  row("bool-consensus", "Networks", "BC term beside AB", "in A 1, in B 1, in C 0, and AB, and BC, or H, led L >> A.Y>AB.A, B.Y>AB.B, B.Y>BC.A, C.Y>BC.B, AB.Y>H.A, BC.Y>H.B, H.Y>L.A"),
  row("seg-a", "Displays", "7-segment segment a", "high A, seg7 S >> A.Y>S.a"),
  row("seg-g", "Displays", "7-segment segment g", "high G, seg7 S >> G.Y>S.g"),
  row("btn-led", "Displays", "Button into an LED", "button B, led L >> B.Y>L.A"),
  row("probe-or", "Displays", "Probe on an OR", "in A 0, in B 1, or G, probe P >> A.Y>G.A, B.Y>G.B, G.Y>P.A"),
];

export const MORE_EXAMPLES: CircuitExample[] = [...truth, ...named];
