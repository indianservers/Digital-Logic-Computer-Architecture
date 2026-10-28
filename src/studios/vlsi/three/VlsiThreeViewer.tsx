import { useSimulatorCapture } from "../../../layout/SimulatorCapture";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useLabMotion } from "../../../design-system/LabMotion";
import { createVlsiWorld } from "./vlsiThreeWorld";
import { SCENE_COLORS, type SceneModel } from "./vlsiThreeModel";

type CameraView = "perspective" | "front" | "top";
export default function VlsiThreeViewer({ model, onPick, onUnavailable }: { model: SceneModel; onPick?: (id: string) => void; onUnavailable: () => void }) {
  useSimulatorCapture("studios/vlsi/three/VlsiThreeViewer.tsx:VlsiThreeViewer", () => ({ host: host.current, enabled, motion, cameraView, live: live.current, update: update.current, cameraChange: cameraChange.current }), "ccd4b0e27fa4");

  const host=useRef<HTMLDivElement>(null); const {enabled}=useLabMotion();
  const [motion,setMotion]=useState(true),[cameraView,setCameraView]=useState<CameraView>("perspective");
  const live=useRef({model,onPick,onUnavailable,enabled,motion});live.current={model,onPick,onUnavailable,enabled,motion};
  const update=useRef<()=>void>(()=>{}), cameraChange=useRef<(view:CameraView)=>void>(()=>{});
  useEffect(()=>{update.current();},[model,enabled,motion]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:"low-power"});}catch{live.current.onUnavailable();return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    const canvas=renderer.domElement;canvas.setAttribute("role","img");canvas.setAttribute("aria-label","Interactive 3D semiconductor structure. Drag to orbit; scroll to zoom. Camera buttons provide alternate views.");canvas.dataset.vlsiThree="true";element.append(canvas);
    const world=createVlsiWorld();const camera=new T.PerspectiveCamera(40,1,.05,120);
    const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.minDistance=2;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.95;
    let frame=0,visible=true,disposed=false,last=performance.now(),clock=0;
    let previousModel:SceneModel|undefined, previousView:SceneModel["view"], bounds=new T.Box3(), initialized=false;
    let activeView:CameraView="perspective";
    const fit=(view:CameraView)=>{
      const center=bounds.getCenter(new T.Vector3());
      const direction=live.current.model.view==="section"&&view==="perspective"?new T.Vector3(1,.08,0):view==="front"?new T.Vector3(0,.06,1):view==="top"?new T.Vector3(0,1,.001):new T.Vector3(1,.7,1.15);
      direction.normalize();
      const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize();
      const up=new T.Vector3().crossVectors(direction,right).normalize();
      const tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));
      let distance=2;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const offset=new T.Vector3(x,y,z).sub(center), depth=offset.dot(direction);
        distance=Math.max(distance,Math.abs(offset.dot(right))/(tan*camera.aspect)+depth,Math.abs(offset.dot(up))/tan+depth);
      }
      distance*=1.18;
      camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));controls.target.copy(center);controls.update();
    };
    const draw=()=>{frame=0;if(disposed||!visible||document.hidden)return;
      const current=live.current;const changed=previousModel!==current.model;
      if(changed){
        const nextBounds=world.setModel(current.model), resize=!bounds.equals(nextBounds), viewChanged=previousView!==current.model.view;
        bounds=nextBounds;
        if(viewChanged){activeView="perspective";setCameraView("perspective");}
        if(!initialized||resize||viewChanged){fit(activeView);initialized=true;}
        previousView=current.model.view;previousModel=current.model;
      }
      const now=performance.now();const moving=current.enabled&&current.motion&&current.model.animate;
      if(moving)clock+=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
      world.tick(clock,current.enabled);renderer.render(world.scene,camera);
      if(moving&&current.model.flows.length)schedule();
    };
    const schedule=()=>{if(!disposed&&!frame&&visible&&!document.hidden)frame=requestAnimationFrame(draw);};
    update.current=schedule;cameraChange.current=view=>{activeView=view;fit(view);schedule();};controls.addEventListener("change",schedule);
    const observer=new ResizeObserver(()=>{if(!element.clientWidth||!element.clientHeight)return;renderer.setSize(element.clientWidth,element.clientHeight);camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();if(initialized)fit(activeView);schedule();});observer.observe(element);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;last=performance.now();if(visible)schedule();else{cancelAnimationFrame(frame);frame=0;}});intersection.observe(element);
    const visibility=()=>{last=performance.now();if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();};document.addEventListener("visibilitychange",visibility);
    const lost=(event:Event)=>{event.preventDefault();live.current.onUnavailable();};canvas.addEventListener("webglcontextlost",lost);
    let down=[0,0];const pointerdown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
    const pointerup=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0]!,e.clientY-down[1]!)>5)return;const r=canvas.getBoundingClientRect();const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(world.picks)[0];if(hit)live.current.onPick?.(String(hit.object.userData.pick));};canvas.addEventListener("pointerdown",pointerdown);canvas.addEventListener("pointerup",pointerup);
    schedule();
    return()=>{disposed=true;cancelAnimationFrame(frame);update.current=()=>{};cameraChange.current=()=>{};observer.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",visibility);canvas.removeEventListener("webglcontextlost",lost);canvas.removeEventListener("pointerdown",pointerdown);canvas.removeEventListener("pointerup",pointerup);controls.dispose();world.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();};
  },[]);
  const materials=[...new Set(model.solids.map(s=>s.material))];
  const selectable=model.solids.filter(s=>s.pick!==undefined);
  return <>
    <div className="vlsi-three-tools"><div role="group" aria-label="3D camera">{(["perspective","front","top"] as const).map(view=><button type="button" key={view} aria-pressed={cameraView===view} onClick={()=>{setCameraView(view);cameraChange.current(view);}}>{view.charAt(0).toUpperCase()+view.slice(1)}</button>)}</div>{model.flows.length>0&&<button type="button" aria-pressed={!motion} onClick={()=>setMotion(v=>!v)}>{motion?"Pause motion":"Resume motion"}</button>}</div>
    {onPick && selectable.length>0 && <label className="vlsi-three-select">Selected structure <select aria-label="Selected structure" value={selectable.find(s=>(s.glow??0)>0)?.pick??""} onChange={event=>onPick(event.target.value)}><option value="" disabled>Select a part</option>{selectable.map(s=><option key={s.id} value={s.pick}>{s.id.replaceAll("-"," ")}</option>)}</select></label>}
    <div ref={host} className="vlsi-three-viewport"/>
    <div className="vlsi-three-legend">{materials.map(name=><span key={name}><i style={{background:SCENE_COLORS[name]}}/>{name.replaceAll("-"," ")}</span>)}</div>
    <p className="vlsi-three-note">Drag to orbit · Scroll / pinch to zoom. {model.caption}{!enabled?" Motion is disabled; structure and readings still update.":""}</p>
  </>;
}
