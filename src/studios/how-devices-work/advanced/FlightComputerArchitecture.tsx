export function FlightComputerArchitecture() {
  const inputs=["Air-data computer", "Inertial reference", "GNSS / navigation", "Pilot targets"];
  return <svg viewBox="0 0 700 330" role="img" aria-label="Aircraft flight computer functional architecture: sensor inputs, avionics interfaces, processing, monitored guidance outputs and protected power">
    <defs><marker id="flight-computer-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#1689ce"/></marker></defs>
    {inputs.map((name,i)=><g key={name}><rect x="10" y={20+i*49} width="160" height="36" rx="4" fill="#edf6ff" stroke="#1689ce"/><text x="90" y={43+i*49} textAnchor="middle" fill="#123c60" fontSize="13">{name}</text><path d={`M170 ${38+i*49}H190V112H210`} fill="none" stroke="#1689ce"/></g>)}
    <rect x="211" y="75" width="132" height="74" rx="5" fill="#e0f0ff" stroke="#1689ce"/><text x="277" y="102" textAnchor="middle" fill="#123c60" fontSize="13">Avionics interfaces</text><text x="277" y="125" textAnchor="middle" fill="#123c60" fontSize="12">ARINC / sensor buses</text>
    <path d="M343 112H366" stroke="#1689ce" markerEnd="url(#flight-computer-arrow)"/>
    <rect x="370" y="22" width="164" height="178" rx="5" fill="#0b5682" stroke="#1689ce"/>
    {["Flight processor", "Input validity checks", "State estimation", "Target comparison", "Guidance calculation"].map((name,i)=><text key={name} x="452" y={50+i*30} textAnchor="middle" fill="white" fontSize={i?12:15}>{name}</text>)}
    {["Display / FMS", "Autopilot guidance", "Status / fault flags"].map((name,i)=><g key={name}><rect x="566" y={28+i*65} width="124" height="45" rx="5" fill="#edf6ff" stroke="#1689ce"/><text x="628" y={55+i*65} textAnchor="middle" fill="#123c60" fontSize="12">{name}</text><path d={`M534 111H549V${50+i*65}H563`} fill="none" stroke="#1689ce" markerEnd="url(#flight-computer-arrow)"/></g>)}
    <rect x="370" y="220" width="164" height="35" rx="4" fill="#e8f8f0" stroke="#28a879"/><text x="452" y="242" textAnchor="middle" fill="#17563f" fontSize="12">Independent monitoring</text><path d="M452 220V200M534 238H628V203" fill="none" stroke="#28a879" strokeDasharray="5 3"/>
    <rect x="10" y="273" width="680" height="36" rx="4" fill="#fff7df" stroke="#bf942b"/><text x="350" y="296" textAnchor="middle" fill="#755614" fontSize="12">Aircraft power → protection / conversion → regulated logic and interface supplies</text><path d="M277 273V149M452 273V255" stroke="#bf942b" fill="none"/>
    <text x="350" y="326" textAnchor="middle" fill="#55738b" fontSize="12">Conceptual guidance architecture; the simulation does not implement aircraft control software.</text>
  </svg>;
}
