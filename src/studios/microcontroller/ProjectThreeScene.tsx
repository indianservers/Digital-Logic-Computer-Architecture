import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useLabMotion } from "../../design-system/LabMotion";
import { PhotorealScene } from "./PhotorealScene";
import type { Runtime } from "./projectEngine";
import { numeric, type ThreeProjectId } from "./projectSceneState";
import { createProjectWorld } from "./projectThreeWorld";
import "./projectThree.css";

type View = "perspective" | "top" | "front";
export default function ProjectThreeScene({ id, state }: { id: ThreeProjectId; state: Runtime }) {
  useSimulatorCapture("studios/microcontroller/ProjectThreeScene.tsx:ProjectThreeScene", () => ({ host: host.current, enabled, latest: latest.current, requestDraw: requestDraw.current, changeView: changeView.current, view, failed }), "5cab39f97a88");

  const host = useRef<HTMLDivElement>(null);
  const { enabled } = useLabMotion();
  const latest = useRef({ state, enabled, received: performance.now() });
  const requestDraw = useRef<() => void>(() => {});
  const changeView = useRef<(view: View) => void>(() => {});
  const [view, setView] = useState<View>("perspective");
  const [failed, setFailed] = useState(false);
  useEffect(() => { latest.current = { state, enabled, received: performance.now() }; requestDraw.current(); }, [state, enabled]);
  useEffect(() => {
    const container = host.current; if (!container || failed) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" }); }
    catch { setFailed(true); return; }
    const world = createProjectWorld(id);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute("aria-label", `${id} interactive 3D hardware. Drag to orbit; scroll to zoom.`);
    renderer.domElement.setAttribute("role", "img"); container.append(renderer.domElement);
    const camera = new T.PerspectiveCamera(42, 1, .1, 80); camera.position.copy(world.camera);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(world.target); controls.minDistance = 3; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI / 2 - .015; controls.enablePan = false; controls.update();
    let frame = 0, visible = true, disposed = false;
    const draw = () => {
      frame = 0; if (disposed || !visible || document.hidden) return;
      const { state: current, enabled: motion, received } = latest.current;
      // Extrapolate at most one display interval from the latest tick. Never advance physics.
      const dt = current.running && motion ? Math.min(.1, Math.max(0, (performance.now() - received) / 1000)) : 0;
      const visual: Runtime = { ...current, time: current.time + dt, memory: { ...current.memory,
        shaftAngle: numeric(current.memory.shaftAngle) + numeric(current.outputs.rpm) / 60 * Math.PI * 2 * dt * (current.outputs.direction === "Reverse" ? -1 : 1),
        leftWheelAngle: numeric(current.memory.leftWheelAngle) + numeric(current.outputs.leftPWM) / 255 * dt * 12,
        rightWheelAngle: numeric(current.memory.rightWheelAngle) + numeric(current.outputs.rightPWM) / 255 * dt * 12,
      } };
      world.update(visual, motion); renderer.render(world.scene, camera);
      if (current.running && motion) schedule();
    };
    const schedule = () => { if (!disposed && !frame && visible && !document.hidden) frame = requestAnimationFrame(draw); };
    requestDraw.current = schedule;
    controls.addEventListener("change", schedule);
    changeView.current = next => {
      const distance = world.camera.distanceTo(world.target);
      camera.position.copy(next === "top" ? world.target.clone().add(new T.Vector3(0, distance, .001)) : next === "front" ? world.target.clone().add(new T.Vector3(0, 1, distance)) : world.camera);
      controls.target.copy(world.target); controls.update(); schedule();
    };
    const resize = new ResizeObserver(() => { const width = container.clientWidth, height = container.clientHeight; if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); schedule(); }); resize.observe(container);
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) schedule(); else { cancelAnimationFrame(frame); frame = 0; } }); intersection.observe(container);
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); };
    document.addEventListener("visibilitychange", visibility); renderer.domElement.addEventListener("webglcontextlost", lost);
    schedule();
    return () => { disposed = true; cancelAnimationFrame(frame); requestDraw.current = () => {}; changeView.current = () => {}; resize.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility); renderer.domElement.removeEventListener("webglcontextlost", lost); controls.dispose(); world.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, [id, failed]);
  const o = state.outputs;
  const summary = id === "motor" ? `${o.rpm} RPM · ${o.direction} · ${o.duty}% PWM${o.fault ? " · Overload" : ""}` : id === "arm" ? `Base ${o.base}° · Shoulder ${o.shoulder}° · Elbow ${o.elbow}° · Wrist ${o.wrist}° · ${o.holding ? "Holding object" : o.placed ? "Object placed" : `Grip ${o.gripper}%`}` : id === "robot" ? `${state.inputs.track} · L ${o.leftPWM} / R ${o.rightPWM} PWM · ${o.lost ? "Line lost" : "Tracking"}` : `${o.distance} cm · Echo ${o.echoQuality} · ${o.echoUs} µs${o.buzzer ? " · Alert" : ""}`;
  return <div className="mcu-three-workbench">
    <div className="mcu-three-toolbar"><span>3D workbench</span><div role="group" aria-label="Camera views">{(["perspective", "top", "front"] as const).map(option => <button type="button" key={option} aria-pressed={view === option} onClick={() => { setView(option); changeView.current(option); }}>{option === "perspective" ? "Perspective" : option === "top" ? "Top" : "Front"}</button>)}</div></div>
    {failed ? <><PhotorealScene id={id} state={state} /><p className="mcu-three-help">3D is unavailable on this device. The simulation and controls remain available.</p></> : <div className="mcu-three-viewport" ref={host} />}
    <div className="mcu-three-readout" data-lab-value>{summary}</div>
    <p className="mcu-three-help">Drag to orbit · Scroll or pinch to zoom · Run, Pause, Step and Reset control the hardware.{id === "ultrasonic" ? " Pulse travel is slowed for visibility; echo timing above uses the simulator’s calculation." : ""}{!enabled ? " Motion is off; positions and measurements still update." : ""}</p>
  </div>;
}

