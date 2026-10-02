const PATHS = {
  home: "M3 11 12 4l9 7v9h-6v-6H9v6H3z",
  folder: "M3 6h6l2 2h10v11H3z",
  layers: "m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5",
  chip: "M7 7h10v10H7zM9 3v4m3-4v4m3-4v4M9 17v4m3-4v4m3-4v4M3 9h4m-4 3h4m-4 3h4m10-6h4m-4 3h4m-4 3h4",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0v16",
  grid: "M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z",
  search: "m21 21-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6m0 3h.01",
  play: "M7 4v16l13-8z",
  pause: "M7 4h4v16H7zm6 0h4v16h-4z",
  reset: "M4 4v6h6M20 12a8 8 0 1 1-2.3-5.7L20 9",
  sim: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m-2-13 6 4-6 4z",
  save: "M5 3h11l3 3v15H5zm3 0v5h7V3M8 21v-7h8v7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  chevUp: "m6 15 6-6 6 6",
  chevDown: "m6 9 6 6 6-6",
  chevRight: "m9 6 6 6-6 6",
  code: "m8 8-4 4 4 4m8-8 4 4-4 4m-6 4 4-16",
  wave: "M2 12h4l3-7 4 14 3-7h6",
  cpu: "M6 6h12v12H6zm3 3h6v6H9z",
  table: "M3 5h18v14H3zm0 5h18M3 15h18M9 5v14",
  bulb: "M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3",
  apps: "M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z",
  gauge: "M12 14l4-4M4 18a9 9 0 1 1 16 0",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1m-2 7.4a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  check: "m5 12 5 5L20 7",
  x: "M6 6l12 12M18 6 6 18",
  expand: "M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5",
  cube: "m12 3 8 4.5v9L12 21l-8-4.5v-9zm0 0v18M4 7.5l8 4.5 8-4.5",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m0-13v4l3 2",
  memory: "M3 7h18v10H3zm4 0v10m4-10v10m4-10v10M3 20h18",
  flag: "M5 21V4h11l-2 4 2 4H5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  sliders: "M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4m8 2v4",
  bug: "M8 8V6a4 4 0 0 1 8 0v2m-9 0h10v6a5 5 0 0 1-10 0zm-3 3h3m10 0h3M4 17h3m10 0h3",
  terminal: "M4 5h16v14H4zm3 4 3 3-3 3m5 0h5",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  alert: "M12 3 2 20h20zm0 6v5m0 3h.01",
  power: "M12 3v8m5.7-5.7a8 8 0 1 1-11.4 0",
  thermo: "M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0",
  radio: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2m-4.2 3.2a6 6 0 0 1 0-8.4m8.4 0a6 6 0 0 1 0 8.4M5 19a10 10 0 0 1 0-14m14 0a10 10 0 0 1 0 14",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  edit: "M4 20h4L19 9l-4-4L4 16zm9-13 4 4",
  activity: "M3 12h4l3-8 4 16 3-8h4",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`mcl-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
