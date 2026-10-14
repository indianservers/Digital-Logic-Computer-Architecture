import { useId } from "react";
import type { NodeKind } from "../../engines/builder/model";
import "./componentIcons.css";

const labels: Record<NodeKind, string> = {
  pc:"PC", acc:"ACC", gpr:"REG", regfile:"RF", ir:"IR", mar:"MAR", mdr:"MDR", flags:"ZNCV", sp:"SP",
  imem:"ROM", dmem:"RAM", umem:"MEM", alu:"ALU", shifter:"SHIFT", cmp:"CMP", inc:"+1", sext:"SIGN",
  mux:"MUX", bus:"BUS", split:"SPLIT", join:"JOIN", const:"01", buf:"BUF", decoder:"DEC", cu:"CTRL",
  clock:"CLK", probe:"PROBE", led:"LED", hex:"HEX", num:"DEC", bin:"BIN", and:"AND", or:"OR",
  not:"NOT", nand:"NAND", xor:"XOR", dff:"DFF", counter:"COUNT", cache:"CACHE", core:"CORE",
};

/** Illustrations of logical components, not physical device pinout diagrams. */
export function ComponentIcon({ kind }: { kind: NodeKind }) {
  const id = useId().replace(/:/g, "");
  const memory = ["imem","dmem","umem","cache","regfile"].includes(kind);
  const routing = ["bus","split","join","mux"].includes(kind);
  const instrument = ["clock","probe","hex","num","bin"].includes(kind);
  const gate = ["and","or","not","nand","xor","buf"].includes(kind);
  const color = memory ? "#079e86" : routing ? "#087bea" : ["cu","decoder","flags"].includes(kind) ? "#cf35a1" : ["alu","shifter","cmp","sext"].includes(kind) ? "#8545de" : "#1763ce";
  const wire = { fill:"none", stroke:color, strokeWidth:3, strokeLinecap:"round" as const, strokeLinejoin:"round" as const };
  return <svg className="ce-component-icon" data-component-icon={kind} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-metal`} x2="0.8" y2="1"><stop stopColor="#f1f7ff"/><stop offset=".45" stopColor="#9aabc4"/><stop offset="1" stopColor="#d9e3f3"/></linearGradient>
      <linearGradient id={`${id}-body`} x2=".4" y2="1"><stop stopColor="#405477"/><stop offset="1" stopColor="#111f39"/></linearGradient>
      <linearGradient id={`${id}-light`} x2=".7" y2="1"><stop stopColor="#fff"/><stop offset=".3" stopColor={color}/><stop offset="1" stopColor="#103063"/></linearGradient>
    </defs>
    <ellipse cx="40" cy="69" rx="27" ry="5" fill="#183c69" opacity=".12"/>
    {routing ? <>
      {kind === "bus" ? [0,1,2,3].map(i=><path key={i} d={`M10 ${24+i*8} H30 Q40 ${24+i*8} 45 ${32+i*8} H70`} {...wire} stroke={["#ef5568","#ffb428","#168de3","#00b987"][i]}/>) : kind === "mux" ? <><path d="M12 24H29M12 48H29M51 36H69M40 62V51" {...wire}/><path d="M28 17L53 27V45L28 55Z" fill={`url(#${id}-body)`} stroke={color} strokeWidth="2"/><path d="M32 26L46 36H51" stroke="#55ddff" strokeWidth="2" fill="none"/></> : <><path d={kind === "split" ? "M10 36H34M34 36L53 22H70M34 36L53 50H70" : "M10 22H27L46 36M10 50H27L46 36H70"} {...wire}/><circle cx={kind === "split" ? 34 : 46} cy="36" r="5" fill={color}/></>}
      {[12,68].map(x=><circle key={x} cx={x} cy="36" r="3" fill="#fff" stroke={color}/>) }
    </> : kind === "led" ? <><path d="M31 50V66M49 50V70" stroke={`url(#${id}-metal)`} strokeWidth="5"/><path d="M23 49V32A17 17 0 0 1 57 32V49Z" fill={`url(#${id}-light)`} stroke={color}/><rect x="20" y="47" width="40" height="7" rx="3" fill={color}/><path d="M29 31Q29 23 36 21" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".8"/></> : instrument ? <><rect x="10" y="16" width="60" height="43" rx="7" fill={`url(#${id}-body)`} stroke="#8aabc8" strokeWidth="2"/><rect x="16" y="22" width="48" height="28" rx="3" fill="#091727"/>
      {kind === "clock" || kind === "probe" ? <><path d="M18 42H26V29H38V42H50V29H62" fill="none" stroke="#45e7d4" strokeWidth="2"/>{kind === "probe" && <path d="M61 55L71 66M71 66L75 59" {...wire}/>}</> : <text x="40" y="41" textAnchor="middle" fill="#57f2d6" fontFamily="monospace" fontSize={kind === "bin" ? 12 : 19}>{kind === "hex" ? "AF" : kind === "bin" ? "1010" : "42"}</text>}
      <circle cx="20" cy="55" r="2" fill="#46ef9a"/><path d="M30 60V66H50V60" stroke="#9bacc2" strokeWidth="3" fill="none"/></> : <>
      {[23,34,45,56].map(n=><g key={n} fill={`url(#${id}-metal)`} stroke="#8499b4" strokeWidth=".6"><rect x="7" y={n} width="13" height="5" rx="1"/><rect x="60" y={n} width="13" height="5" rx="1"/>{!gate && <><rect x={n} y="8" width="5" height="12" rx="1"/><rect x={n} y="60" width="5" height="10" rx="1"/></>}</g>)}
      <rect x="17" y="17" width="46" height="46" rx="6" fill="#0c1830"/><rect x="18" y="16" width="44" height="43" rx="5" fill={`url(#${id}-body)`} stroke={color} strokeWidth="2"/><path d="M23 21H56" stroke="#fff" opacity=".25"/><circle cx="23" cy="54" r="2" fill="#a5bdd8"/>
      {memory ? <g fill={color} stroke="#b0ffe7" strokeWidth=".5">{Array.from({length:kind === "regfile" ? 8 : 12},(_,i)=><rect key={i} x={27+(i%4)*7} y={25+Math.floor(i/4)*7} width="5" height="4" rx=".7"/>)}</g> : gate ? <><path d={kind === "not" || kind === "buf" ? "M29 26L48 35L29 44Z" : ["or","xor"].includes(kind) ? "M28 26Q39 26 49 35Q39 44 28 44Q35 35 28 26Z" : "M28 26H37A9 9 0 0 1 37 44H28Z"} fill="none" stroke="#64e6ff" strokeWidth="2"/>{["not","nand"].includes(kind)&&<circle cx="51" cy="35" r="2" stroke="#64e6ff" fill="none"/>}{kind === "xor" && <path d="M24 26Q31 35 24 44" stroke="#64e6ff" fill="none"/>}</> : kind === "alu" ? <path d="M27 25L40 30L53 25V40L40 46L27 40V34L33 32L27 30Z" fill={color} stroke="#d7baff"/> : kind === "shifter" || kind === "inc" || kind === "counter" ? <path d="M27 32H51M44 26L51 32L44 38M27 42H40" stroke="#7ee7ff" strokeWidth="2" fill="none"/> : kind === "cmp" ? <text x="40" y="39" textAnchor="middle" fill="#bfa3ff" fontSize="19">≷</text> : kind === "sext" ? <path d="M28 28H38V33H52M28 41H52M45 28L52 33L45 38" stroke="#c9aaff" strokeWidth="2" fill="none"/> : <>{[0,1,2].map(i=><rect key={i} x="27" y={25+i*6} width={kind === "sp" ? 24-i*5 : 25} height="3" rx="1" fill={color}/>)}{kind === "cu" && <path d="M40 24V42M27 34H53" stroke="#fba0df"/>}</>}
      <text x="40" y="54" textAnchor="middle" fill="#f1f7ff" fontFamily="monospace" fontWeight="700" fontSize={labels[kind].length>4 ? 7 : 9}>{labels[kind]}</text>
    </>}
    {(routing || instrument || kind === "led") && <text x="40" y="78" textAnchor="middle" fill={color} fontFamily="sans-serif" fontSize="8" fontWeight="700">{labels[kind]}</text>}
  </svg>;
}
