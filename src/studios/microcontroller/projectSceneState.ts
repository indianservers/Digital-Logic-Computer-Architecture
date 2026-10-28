import type { Runtime } from "./projectEngine";
export type ThreeProjectId = "arm" | "motor" | "robot" | "ultrasonic";
export const isThreeProject = (id: string): id is ThreeProjectId => ["arm", "motor", "robot", "ultrasonic"].includes(id);
export const numeric = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : 0;
/** Read only authoritative simulator outputs; changing a control never invents movement. */
export function projectSceneState(id: ThreeProjectId, state: Runtime) {
  const o = state.outputs;
  return {
    id, time: state.time,
    base: (numeric(o.base) - 90) * Math.PI / 180,
    shoulder: numeric(o.shoulder) * Math.PI / 180,
    elbow: -numeric(o.elbow) * Math.PI / 180,
    wrist: -numeric(o.wrist) * Math.PI / 180,
    grip: Math.max(0, Math.min(100, numeric(o.gripper))) / 100,
    shaft: numeric(state.memory.shaftAngle),
    leftWheel: numeric(state.memory.leftWheelAngle), rightWheel: numeric(state.memory.rightWheelAngle),
    x: (numeric(o.trackX) - .5) * 10, z: (numeric(o.trackY) - .5) * 7,
    heading: -numeric(o.trackHeading) * Math.PI / 180,
    distance: Math.max(0, numeric(o.rawDistance ?? state.inputs.distance)),
    echo: o.echoQuality === "Valid" && numeric(o.triggerUs) > 0,
    holding: o.holding === true, placed: o.placed === true,
  };
}
