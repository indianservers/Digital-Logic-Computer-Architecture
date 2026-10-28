/** Shared display track used by the runtime and the 3D workbench. Coordinates are normalized. */
export function projectTrack(track: string, phase: number) {
  const t = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (track === "Oval") return { x: .5 + .36 * Math.cos(t), y: .5 + .29 * Math.sin(t), dx: -.36 * Math.sin(t), dy: .29 * Math.cos(t) };
  if (track === "S curve") return { x: .5 + .3 * Math.sin(t), y: .16 + .68 * t / (Math.PI * 2), dx: .3 * Math.cos(t), dy: .68 / (Math.PI * 2) };
  if (track === "Challenging") return { x: .5 + .32 * Math.sin(t) + .06 * Math.sin(3 * t), y: .5 - .29 * Math.sin(2 * t), dx: .32 * Math.cos(t) + .18 * Math.cos(3 * t), dy: -.58 * Math.cos(2 * t) };
  return { x: .5 + .37 * Math.sin(t), y: .49 - .31 * Math.sin(2 * t), dx: .37 * Math.cos(t), dy: -.62 * Math.cos(2 * t) };
}
