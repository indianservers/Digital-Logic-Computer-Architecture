import { useState } from "react";
import type { PartImage } from "./part-images";
import { hardwareIdentity, picturedIdentity } from "./hardwareIdentity";

export function HardwareIdentityPanel({ art }: { art?: PartImage }) {
  const identity = hardwareIdentity(art);
  const [pin, setPin] = useState(0);
  return <div className="hardware-identity-panel">
    <span className="hardware-evidence-badge">{art?.kind === "reference" ? "PHOTOGRAPH · EXAMPLE HARDWARE" : "ILLUSTRATION · REPRESENTATIVE"}</span>
    <dl><div><dt>Pictured hardware</dt><dd>{picturedIdentity(art)}</dd></div><div><dt>Relationship to device</dt><dd>{identity?.scope ?? "Component-family example; not evidence of an actual component recovered from this device. Exact model and installation are unverified."}</dd></div><div><dt>Physical scale</dt><dd>{identity?.dimensions ?? "Dimensions unavailable from the supplied image. Display size is not physical scale."}</dd></div></dl>
    {identity ? <details className="hardware-pinout"><summary>Inspect pinout & technical reference</summary><p>{identity.orientation}</p>
      {identity.name.startsWith("ULN2003")&&<svg className="hardware-package-drawing" viewBox="0 0 340 340" role="img" aria-label={`ULN2003A PDIP-16 top-view reference. Pin ${pin + 1} selected. Body length 19.30 mm and width 6.35 mm nominal; drawing enlarged.`}>
        <rect x="125" y="25" width="82" height="250" rx="6" fill="#173549"/><path d="M154 25a12 12 0 0 0 24 0" fill="#eef6fa"/><circle cx="138" cy="47" r="4" fill="#5dbcae"/>
        <text x="166" y="145" textAnchor="middle" fill="white" transform="rotate(-90 166 145)">ULN2003A · N</text>
        {Array.from({length:16},(_,i)=>{const left=i<8, row=left?i:15-i, x=left?105:207, y=42+row*30;return <g key={i}><rect x={x} y={y} width="20" height="9" fill={pin===i?"#edab3d":"#93adbc"}/><text x={left?96:236} y={y+9} textAnchor={left?"end":"start"} fill={pin===i?"#a35b00":"#31556b"}>{i+1}</text></g>;})}
        <path d="M270 25h8M274 25v250M270 275h8M125 297v8M125 301h82M207 297v8" stroke="#7396a8" fill="none"/><text x="290" y="150" fill="#31556b" transform="rotate(-90 290 150)" textAnchor="middle">19.30 mm</text><text x="166" y="322" textAnchor="middle" fill="#31556b">6.35 mm body · enlarged reference</text>
      </svg>}
      <div className="hardware-pin-grid" role="group" aria-label={`${identity.name} pin inspector`}>{identity.pins.map(([name], i) => <button type="button" key={name} aria-pressed={pin === i} onClick={() => setPin(i)}>{name}</button>)}</div><p className="hardware-pin-detail" role="status"><strong>{identity.pins[pin]?.[0]}</strong> → {identity.pins[pin]?.[1]}</p><a href={identity.source} target="_blank" rel="noreferrer">Manufacturer pinout, dimensions & electrical specifications ↗</a></details> : <p className="hardware-unverified">Pinout: unverified for the pictured item. Use a manufacturer part number and package drawing before assigning pins.</p>}
  </div>;
}
