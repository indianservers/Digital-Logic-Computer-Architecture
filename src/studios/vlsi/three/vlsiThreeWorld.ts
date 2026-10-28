import * as T from "three";
import { SCENE_COLORS, type SceneModel, type Solid } from "./vlsiThreeModel";
export function createVlsiWorld() {
  const scene = new T.Scene(); scene.background = new T.Color("#101c2c");
  const assembly = new T.Group(); scene.add(assembly);
  const materials = new Map<string, T.MeshStandardMaterial>();
  const geometries = new Set<T.BufferGeometry>();
  let moving: Array<{ mesh: T.Mesh; from: T.Vector3; to: T.Vector3; phase: number; speed: number }> = [];
  const picks: T.Mesh[] = [];
  const material = (name: string, opacity = 1, glow = 0, heat = false) => {
    const key = `${name}:${opacity}:${glow}:${heat}`; const old = materials.get(key); if (old) return old;
    const metallic = ["metal", "via", "contact", "copper", "gate", "solder"].includes(name);
    const color = SCENE_COLORS[name] ?? "#8091a9";
    const m = new T.MeshStandardMaterial({ color, metalness: metallic ? .8 : name === "silicon" ? .45 : .1, roughness: metallic ? .28 : .48, transparent: opacity < 1, opacity: Math.min(1, opacity), depthWrite: opacity >= 1, emissive: heat ? "#ff5a24" : color, emissiveIntensity: glow });
    materials.set(key, m); return m;
  };
  const geometry = (s: Solid) => {
    const [x, y, z] = s.size;
    let g: T.BufferGeometry;
    if (s.shape === "sphere") g = new T.SphereGeometry(x, 12, 8);
    else if (s.shape === "cylinder") g = new T.CylinderGeometry(x, z, y, 24);
    else if (s.shape === "sleeve") {
      const shape = new T.Shape(); shape.moveTo(-z/2,-y/2); shape.lineTo(z/2,-y/2); shape.lineTo(z/2,y/2); shape.lineTo(-z/2,y/2); shape.closePath();
      const wall = s.material === "gate" ? .1 : .035;
      const hole = new T.Path(); hole.moveTo(-z/2+wall,-y/2+wall); hole.lineTo(-z/2+wall,y/2-wall); hole.lineTo(z/2-wall,y/2-wall); hole.lineTo(z/2-wall,-y/2+wall); hole.closePath(); shape.holes.push(hole);
      g = new T.ExtrudeGeometry(shape, { depth: x, bevelEnabled: false, steps: 1 }); g.translate(0, 0, -x/2); g.rotateY(Math.PI/2);
    } else g = new T.BoxGeometry(x,y,z);
    geometries.add(g); return g;
  };
  const hemi = new T.HemisphereLight("#deeeff", "#263044", 2.5); scene.add(hemi);
  const light = new T.DirectionalLight("#fff1d9", 3.8); light.position.set(3,8,6); light.castShadow = true; light.shadow.mapSize.set(1024,1024); light.shadow.camera.left=-8; light.shadow.camera.right=8; light.shadow.camera.top=8; light.shadow.camera.bottom=-8; light.shadow.normalBias=.035; scene.add(light);
  const rim = new T.DirectionalLight("#77b6ff", 2.2); rim.position.set(-5,4,-4); scene.add(rim);
  const floorGeometry = new T.PlaneGeometry(50,50), floorMaterial = new T.MeshStandardMaterial({ color:"#16263b", roughness:.85 });
  const floor = new T.Mesh(floorGeometry,floorMaterial); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;scene.add(floor);
  const clear = () => { assembly.clear(); geometries.forEach(g=>g.dispose()); geometries.clear(); materials.forEach(m=>m.dispose()); materials.clear(); picks.length=0; moving=[]; };
  return { scene, picks,
    setModel(model: SceneModel) {
      clear();
      model.solids.forEach(s=>{const mesh=new T.Mesh(geometry(s),material(s.material,s.opacity,s.glow,s.heat));mesh.name=s.id;mesh.position.set(...s.at);if(s.rotate)mesh.rotation.set(...s.rotate);mesh.castShadow=s.opacity===undefined||s.opacity>=1;mesh.receiveShadow=true;mesh.userData.pick=s.pick;assembly.add(mesh);if(s.pick!==undefined)picks.push(mesh);});
      const bounds=new T.Box3().setFromObject(assembly);floor.position.y=bounds.min.y-.06;
      model.flows.forEach(flow=>{const g=new T.SphereGeometry(.055,10,8);geometries.add(g);for(let j=0;j<flow.count;j++){const mesh=new T.Mesh(g,material(flow.material,1,1.3));assembly.add(mesh);moving.push({mesh,from:new T.Vector3(...flow.from),to:new T.Vector3(...flow.to),phase:j/flow.count,speed:flow.speed});}});
      return bounds;
    },
    tick(time: number, motion: boolean) {moving.forEach(p=>{p.mesh.position.lerpVectors(p.from,p.to,(p.phase+time*p.speed)%1);p.mesh.visible=motion;});},
    dispose() {clear();floorGeometry.dispose();floorMaterial.dispose();light.shadow.dispose();}
  };
}
