import * as T from "three";
import type { Runtime } from "./projectEngine";
import { projectSceneState, type ThreeProjectId } from "./projectSceneState";
import { projectTrack } from "./projectTrack";

// Procedural mechanical assemblies: no remote models, textures, or asset requests.
export function createProjectWorld(id: ThreeProjectId) {
  const scene = new T.Scene(); scene.background = new T.Color("#e7edf2");
  const metal = new T.MeshStandardMaterial({ color: "#aebbc6", metalness: .8, roughness: .29 });
  const dark = new T.MeshStandardMaterial({ color: "#202b38", metalness: .35, roughness: .5 });
  const rubber = new T.MeshStandardMaterial({ color: "#171b21", roughness: .92 });
  const orange = new T.MeshStandardMaterial({ color: "#ed8a24", metalness: .35, roughness: .32 });
  const blue = new T.MeshStandardMaterial({ color: "#2174b9", metalness: .3, roughness: .38 });
  const pcb = new T.MeshStandardMaterial({ color: "#167261", roughness: .55 });
  const gold = new T.MeshStandardMaterial({ color: "#d8b256", metalness: .8, roughness: .3 });
  const red = new T.MeshStandardMaterial({ color: "#e65b4c", roughness: .5 });
  const allMaterials: T.Material[] = [metal, dark, rubber, orange, blue, pcb, gold, red];
  function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (p: T.Object3D, w: number, h: number, d: number, m: T.Material, x = 0, y = 0, z = 0) => mesh(p, new T.BoxGeometry(w, h, d), m, x, y, z);
  const cylinder = (p: T.Object3D, r: number, h: number, m: T.Material, x = 0, y = 0, z = 0) => mesh(p, new T.CylinderGeometry(r, r, h, 40), m, x, y, z);
  const group = (p: T.Object3D, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); p.add(g); return g; };
  function screw(p: T.Object3D, x: number, y: number, z: number) { cylinder(p, .045, .035, metal, x, y, z); box(p, .055, .006, .009, dark, x, y + .02, z); }
  function board(p: T.Object3D, x: number, z: number, scale = 1) {
    const g = group(p, x, .13, z); g.scale.setScalar(scale);
    box(g, 1.4, .08, .9, pcb); box(g, .45, .1, .4, dark, 0, .09);
    box(g, .25, .18, .3, metal, -.62, .13);
    for (let j = 0; j < 12; j++) for (const side of [-1, 1]) box(g, .045, .14, .045, gold, -.5 + j * .09, .1, side * .36);
    for (const x of [-.57, .57]) for (const z of [-.32, .32]) screw(g, x, .065, z);
    const led = new T.MeshStandardMaterial({ color: "#6be388", emissive: "#24c85a", emissiveIntensity: .6 }); allMaterials.push(led); cylinder(g, .04, .05, led, .4, .1, .17);
    return g;
  }
  function wire(p: T.Object3D, points: number[][], color: string) {
    const material = new T.MeshStandardMaterial({ color, roughness: .6 }); allMaterials.push(material);
    const curve = new T.CatmullRomCurve3(points.map(v => new T.Vector3(v[0], v[1], v[2])));
    return mesh(p, new T.TubeGeometry(curve, 32, .025, 8, false), material);
  }
  box(scene, 13, .18, 10, new T.MeshStandardMaterial({ color: "#cbd2d8", roughness: .82 }), 0, -.12);
  const grid = new T.GridHelper(12, 24, "#a8b4bf", "#bcc6cf"); grid.position.y = -.018; scene.add(grid);
  scene.add(new T.HemisphereLight("#e8f4ff", "#7b746b", 2.3));
  const key = new T.DirectionalLight("#fff5e8", 3.4); key.position.set(3, 9, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7; key.shadow.normalBias = .035; scene.add(key);
  const fill = new T.DirectionalLight("#bddeff", 1.5); fill.position.set(-5, 4, -3); scene.add(fill);
  let update: (s: Runtime, motion: boolean) => void = () => {};
  let target = new T.Vector3(0, 1.25, 0), camera = new T.Vector3(7, 5.5, 8);

  if (id === "arm") {
    box(scene, 1.8, .25, 1.6, dark, .8, .12);
    for (const x of [.1, 1.5]) for (const z of [-.6, .6]) screw(scene, x, .27, z);
    const base = group(scene, .8, .3); cylinder(base, .65, .3, orange, 0, .15);
    const shoulder = group(base, 0, .55); const elbow = group(shoulder, 2, 0); const wrist = group(elbow, 1.8, 0);
    function link(p: T.Object3D, length: number) {
      for (const z of [-.19, .19]) { box(p, length, .22, .09, orange, length / 2, 0, z); for (let x = .25; x < length; x += .35) { const bolt = cylinder(p, .045, .12, metal, x, 0, z); bolt.rotation.x = Math.PI / 2; } }
      const joint = cylinder(p, .28, .56, dark); joint.rotation.x = Math.PI / 2;
      const cap = cylinder(p, .16, .6, metal); cap.rotation.x = Math.PI / 2;
      box(p, .45, .42, .38, dark, -.06, -.19, .26);
    }
    link(shoulder, 2); link(elbow, 1.8); link(wrist, .5);
    const tool = group(wrist, .55); box(tool, .38, .5, .45, metal);
    const fingers = [-1, 1].map(side => { const g = group(tool); box(g, .5, .09, .09, dark, .25); box(g, .09, .09, .2, rubber, .5, 0, -side * .06); return g; });
    const payload = box(scene, .35, .35, .35, red, -1.8, .18, .7);
    box(scene, .8, .04, .8, blue, -1.8, .02, -.9); board(scene, -2, 2);
    wire(scene, [[-1.5,.25,2],[0,.1,1.5],[.6,.4,.3]], "#e45c49");
    update = s => { const v = projectSceneState(id, s); base.rotation.y = v.base; shoulder.rotation.z = v.shoulder; elbow.rotation.z = v.elbow; wrist.rotation.z = v.wrist;
      fingers.forEach((f, index) => { f.position.z = (index ? 1 : -1) * (.08 + v.grip * .27); });
      scene.updateMatrixWorld(true);
      if (v.holding) payload.position.copy(tool.localToWorld(new T.Vector3(.6, 0, 0))); else payload.position.set(-1.8, .2, v.placed ? -.9 : .7);
    };
    target = new T.Vector3(1.1, 1.3, 0); camera = new T.Vector3(9, 6.5, 11);
  }

  if (id === "motor") {
    board(scene, -3, .3);
    box(scene, 1.2, .1, 1, red, -1.2, .12); box(scene, .7, .5, .6, dark, -1.2, .4);
    for (let j = 0; j < 6; j++) box(scene, .055, .45, .6, metal, -1.48 + j * .11, .47);
    box(scene, 1.5, .15, 1.4, dark, 1.3, .12);
    const housing = cylinder(scene, .65, 1.5, metal, 1.3, .93); housing.rotation.z = Math.PI / 2;
    for (const x of [.58, 2.03]) { const cap = cylinder(scene, .66, .09, dark, x, .93); cap.rotation.z = Math.PI / 2; }
    for (let j = 0; j < 8; j++) { const t = j / 8 * Math.PI * 2; box(scene, .8, .08, .08, dark, 1.3, .93 + .63 * Math.cos(t), .63 * Math.sin(t)); }
    const shaft = cylinder(scene, .1, .8, metal, 2.38, .93); shaft.rotation.z = Math.PI / 2;
    const rotor = group(scene, 2.7, .93); const hub = cylinder(rotor, .2, .2, gold); hub.rotation.z = Math.PI / 2;
    for (let j = 0; j < 4; j++) { const blade = group(rotor); blade.rotation.x = j * Math.PI / 2; const b = box(blade, .07, .8, .24, blue, 0, .52); b.rotation.y = .3; }
    wire(scene, [[-2.5,.25,.1],[-2,.45,-.3],[-1.7,.2,0]], "#dc5148");
    wire(scene, [[-.6,.2,.3],[0,.2,.8],[.6,.65,.4]], "#e3ac33");
    wire(scene, [[-.6,.2,-.3],[0,.15,-.8],[.6,.65,-.4]], "#253d65");
    update = (s, motion) => { rotor.rotation.x = motion ? projectSceneState(id, s).shaft : 0; };
    target = new T.Vector3(0, .6, 0); camera = new T.Vector3(6, 4.8, 7);
  }

  if (id === "robot") {
    const tracks = new Map<string, T.Mesh>();
    for (const name of ["Oval", "S curve", "Figure eight", "Challenging"]) {
      const points = Array.from({ length: 241 }, (_, index) => { const p = projectTrack(name, index / 240 * (Math.PI * 2 - .000001)); return new T.Vector3((p.x - .5) * 10, .015, (p.y - .5) * 7); });
      const path = new T.CatmullRomCurve3(points, name !== "S curve");
      const track = mesh(scene, new T.TubeGeometry(path, 320, .085, 8, name !== "S curve"), rubber); track.scale.y = .15; tracks.set(name, track);
    }
    const bot = group(scene); box(bot, .9, .11, 1.05, blue, 0, .35); board(bot, 0, 0, .5);
    box(bot, .55, .22, .3, dark, 0, .52, .15);
    for (const z of [-.22, .22]) { const battery = cylinder(bot, .09, .5, gold, 0, .5, z); battery.rotation.z = Math.PI / 2; }
    const wheels = [-1, 1].map(side => {
      const wheel = group(bot, side * .57, .27); const tire = cylinder(wheel, .26, .18, rubber); tire.rotation.z = Math.PI / 2;
      const hub = cylinder(wheel, .15, .19, gold); hub.rotation.z = Math.PI / 2;
      for (let j = 0; j < 16; j++) { const t = j / 16 * Math.PI * 2; const tread = box(wheel, .2, .045, .06, dark, 0, Math.cos(t) * .255, Math.sin(t) * .255); tread.rotation.x = t; }
      box(wheel, .2, .04, .26, metal); return wheel;
    });
    mesh(bot, new T.SphereGeometry(.11, 20, 12), metal, 0, .15, .4);
    box(bot, .75, .06, .17, pcb, 0, .13, -.6);
    const sensors = [-.27, 0, .27].map(x => { const m = new T.MeshStandardMaterial({ color: "#6b2632", emissive: "#ef3d49", emissiveIntensity: 0 }); allMaterials.push(m); return box(bot, .1, .08, .1, m, x, .09, -.61); });
    wire(bot, [[-.28,.4,0],[-.32,.6,-.3],[-.2,.17,-.58]], "#e45949");
    update = (s, motion) => { const v = projectSceneState(id, s); tracks.forEach((track, name) => { track.visible = s.inputs.track === name; });
      bot.position.set(v.x, 0, v.z); bot.rotation.y = v.heading;
      wheels[0]!.rotation.x = motion ? v.leftWheel : 0; wheels[1]!.rotation.x = motion ? v.rightWheel : 0;
      const states = String(s.outputs.sensors).split(" "); sensors.forEach((sensor, j) => { (sensor.material as T.MeshStandardMaterial).emissiveIntensity = states[j] === "1" ? 1.7 : 0; });
    };
    target = new T.Vector3(0, 0, 0); camera = new T.Vector3(7.8, 9, 9);
  }

  if (id === "ultrasonic") {
    board(scene, -3, 1.4);
    const sensor = group(scene, -3, .9); box(sensor, .1, 1.1, 1.8, blue);
    for (const z of [-.48, .48]) {
      const can = cylinder(sensor, .36, .4, metal, .24, 0, z); can.rotation.z = Math.PI / 2;
      const face = cylinder(sensor, .29, .015, dark, .45, 0, z); face.rotation.z = Math.PI / 2;
      for (let j = -3; j <= 3; j++) { const half = Math.sqrt(.27 ** 2 - (j * .07) ** 2); box(sensor, .018, half * 2, .012, metal, .465, 0, z + j * .07); }
    }
    for (let j = 0; j < 4; j++) box(sensor, .04, .35, .04, gold, 0, -.68, -.3 + j * .2);
    box(scene, .5, .2, 1.4, dark, -3, .1);
    wire(scene, [[-3,.25,1.4],[-3.7,.3,.7],[-3,.3,.1]], "#e1ae35");
    const obstacle = box(scene, .2, 1.8, 1.8, new T.MeshStandardMaterial({ color: "#bd9870", roughness: .85 }), 1, .9);
    box(obstacle, .7, .12, 2, dark, 0, -.82);
    const pulseMaterial = new T.MeshBasicMaterial({ color: "#169be0", transparent: true, opacity: .55, side: T.DoubleSide }); allMaterials.push(pulseMaterial);
    const pulse = mesh(scene, new T.RingGeometry(.17, .2, 48), pulseMaterial); pulse.rotation.y = Math.PI / 2;
    const ruler = box(scene, 1, .025, .025, blue, 0, .08, 1.15);
    const alarmMaterial = new T.MeshStandardMaterial({ color: "#632b31", emissive: "#ee4343", emissiveIntensity: 0 }); allMaterials.push(alarmMaterial); cylinder(scene, .13, .08, alarmMaterial, -2.6, .25, 1.4);
    update = (s, motion) => { const v = projectSceneState(id, s); const span = .65 + v.distance / 200 * 7;
      obstacle.position.x = -2.5 + span; ruler.scale.x = span; ruler.position.x = -2.5 + span / 2;
      const phase = (s.time % 1.6) / 1.6; const outward = phase < .5; const travel = outward ? phase * 2 : (1 - phase) * 2;
      pulse.visible = motion && v.echo; pulse.position.set(-2.5 + span * travel, .9, 0); pulse.scale.setScalar(.6 + travel * 2);
      pulseMaterial.color.set(outward ? "#169be0" : "#26b785"); alarmMaterial.emissiveIntensity = s.outputs.buzzer ? 2 : 0;
    };
    target = new T.Vector3(.3, .6, 0); camera = new T.Vector3(7, 5, 9);
  }
  return { scene, target, camera, update, dispose() {
    scene.traverse(object => { if (object instanceof T.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(m => m.dispose()); } });
    grid.geometry.dispose(); (grid.material as T.Material).dispose(); allMaterials.forEach(m => m.dispose()); key.shadow.dispose();
  } };
}


