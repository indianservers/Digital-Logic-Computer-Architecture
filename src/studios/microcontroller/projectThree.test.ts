import { describe, expect, it } from "vitest";
import { PROJECT_LABS } from "./projectData";
import { advanceRuntime, compileProjectCode, createRuntime, updateInput } from "./projectEngine";
import { projectSceneState, type ThreeProjectId } from "./projectSceneState";
import { projectTrack } from "./projectTrack";
import { createProjectWorld } from "./projectThreeWorld";

function setup(id: ThreeProjectId) {
  const def = PROJECT_LABS.find(lab => lab.id === id)!;
  const program = compileProjectCode(def.code).program!;
  return { def, state: createRuntime(def, program), program };
}
describe("3D project simulator integration", () => {
  it("integrates motor rotation through acceleration and reversal without moving on input edits", () => {
    const { def, state, program } = setup("motor");
    const forward = advanceRuntime(def, state, .5);
    expect(Number(forward.memory.shaftAngle)).toBeGreaterThan(0);
    const reversed = updateInput(def, forward, "direction", "Reverse");
    expect(reversed.memory.shaftAngle).toBe(forward.memory.shaftAngle);
    const next = advanceRuntime(def, reversed, .1);
    expect(Number(next.memory.shaftAngle)).toBeLessThan(Number(reversed.memory.shaftAngle));
    expect(projectSceneState("motor", advanceRuntime(def, next, 0)).shaft).toBe(projectSceneState("motor", next).shaft);
    expect(projectSceneState("motor", createRuntime(def, program)).shaft).toBe(0);
  });
  it("stops robot wheels and position on emergency stop, and resets accumulated motion", () => {
    const { def, state, program } = setup("robot");
    const moving = advanceRuntime(def, state, .5);
    expect(Number(moving.memory.leftWheelAngle)).toBeGreaterThan(0);
    const stopped = updateInput(def, moving, "emergencyStop", true);
    const later = advanceRuntime(def, stopped, .5);
    expect(later.memory.leftWheelAngle).toBe(stopped.memory.leftWheelAngle);
    expect(later.outputs.trackX).toBe(stopped.outputs.trackX);
    expect(later.outputs.trackY).toBe(stopped.outputs.trackY);
    expect(projectSceneState("robot", createRuntime(def, program)).leftWheel).toBe(0);
  });
  it("maps arm output angles rather than unexecuted control targets", () => {
    const { def, state } = setup("arm");
    const edited = updateInput(def, state, "shoulder", 110);
    expect(projectSceneState("arm", edited).shoulder).toBe(projectSceneState("arm", state).shoulder);
    const stepped = advanceRuntime(def, edited, .5);
    expect(projectSceneState("arm", stepped).shoulder).toBeGreaterThan(projectSceneState("arm", edited).shoulder);
    const stopped = updateInput(def, stepped, "armStop", true);
    expect(advanceRuntime(def, stopped, .5).outputs.shoulder).toBe(stopped.outputs.shoulder);
  });
  it("moves the ultrasonic target and suppresses an idle echo", () => {
    const { def, state } = setup("ultrasonic");
    const edited = updateInput(def, state, "distance", 120);
    expect(projectSceneState("ultrasonic", edited).distance).toBe(120);
    const empty = compileProjectCode("void loop() {} ").program!;
    expect(projectSceneState("ultrasonic", createRuntime(def, empty)).echo).toBe(false);
  });
  it.each(["Oval", "S curve", "Figure eight", "Challenging"])("matches the runtime to the rendered %s track", track => {
    const { def, state } = setup("robot");
    const next = advanceRuntime(def, updateInput(def, state, "track", track), .5);
    const point = projectTrack(track, Number(next.memory.visualPhase));
    expect(Number(next.outputs.trackX)).toBeCloseTo(point.x, 2);
    expect(Number(next.outputs.trackY)).toBeCloseTo(point.y, 2);
  });
  it.each(["arm", "motor", "robot", "ultrasonic"] as const)("builds and updates the %s assembly without WebGL", id => {
    const { def, state } = setup(id); const world = createProjectWorld(id);
    world.update(advanceRuntime(def, state, .5), true); world.update(state, false);
    world.scene.updateMatrixWorld(true);
    let meshes = 0;
    world.scene.traverse(object => { if (object.type === "Mesh") meshes++; expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true); });
    expect(meshes).toBeGreaterThan(20); world.dispose();
  });
});
