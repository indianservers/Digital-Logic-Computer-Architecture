import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {useLocation} from "react-router-dom";
import {activeState,isAnimatedLabPath,LAB_MOTION_LIMITS,MotionQueue,type MotionKind} from "./labMotionPolicy";
import "./labMotion.css";

const STORAGE_KEY="logiclab.motion.enabled";
const MotionContext=createContext({enabled:true,reduced:false,requested:true,toggle:()=>{}});
export const useLabMotion=()=>useContext(MotionContext);
const VALUES='[data-lab-value],output,.metric>b,.bit-mark,.bit-knob,.cpu-block small,.pipe-stage>span,.pipe-reg>span,.ce-table td,.data td,.ns-value strong,.ns-value-tile strong,.fsmx-readout>b,.mcl-metric b,.mcl-kv dd,.mcl-slider b,.tm-metrics strong,.ns-bit,.sb-table-wrap td,.sb-svg text,[role="status"]';
const STATES='[data-lab-active],.dp-node,.dp-wire,.mem-cell,.word-line,.pipe-stage,.cpu-block,.tm-result,.ce-status,[role="status"]';
const PANELS='.card,.ce-panel,.lgx-card,.ns-card,.tm-card,.tm-scope,.mcl-panel,.sb-panel,[role="dialog"],[role="alert"],.ce-status';
const EXCLUDE='input,textarea,select,[contenteditable="true"],pre,code,[data-lab-motion="off"],[data-motion-skip]';

/** One bounded observer covers common and bespoke lab layouts, without remounting labs. */
export function LabMotionBoundary({children}:{children:ReactNode}){
  const location=useLocation();const root=useRef<HTMLDivElement>(null);
  const [requested,setRequested]=useState(()=>{try{return localStorage.getItem(STORAGE_KEY)!=="false";}catch{return true;}});
  const [reduced,setReduced]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const lab=isAnimatedLabPath(location.pathname);
  const enabled=lab&&requested&&!reduced;
  useEffect(()=>{const query=window.matchMedia("(prefers-reduced-motion: reduce)");const change=()=>setReduced(query.matches);query.addEventListener("change",change);return()=>query.removeEventListener("change",change);},[]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,String(requested));}catch{/* Motion preferences are optional. */}},[requested]);
  useEffect(()=>{const node=root.current;if(!node||!lab)return;
    const scope=()=>node.querySelector('#learning-interactive-panel')??node;
    const owned=new Map<Element,Animation>();const queue=new MotionQueue<Element>();
    const values=new WeakMap<Element,string>();const lastPlayed=new WeakMap<Element,number>();let frame=0,gesture=false;
    const remember=(el:Element)=>{if(el.matches(VALUES))values.set(el,el.textContent??"");el.querySelectorAll(VALUES).forEach(v=>values.set(v,v.textContent??""));};
    const visible=(el:Element)=>{if(!el.isConnected||el.closest('[hidden],[inert]')||el.closest(EXCLUDE))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;};
    const play=(el:Element,kind:MotionKind)=>{
      if(typeof el.animate!=="function"||!visible(el))return;
      const now=performance.now();if(now-(lastPlayed.get(el)??-Infinity)<LAB_MOTION_LIMITS.cooldown)return;lastPlayed.set(el,now);
      owned.get(el)?.cancel();
      const svg=el instanceof SVGElement;
      const frames:Keyframe[]=kind==="enter"?[{opacity:.65},{opacity:1}]:svg?[{opacity:.45},{opacity:1}]:kind==="value"?[{backgroundColor:"rgba(250,204,21,.4)"},{backgroundColor:getComputedStyle(el).backgroundColor}]:[{boxShadow:"0 0 0 3px rgba(47,111,237,.25)"},{boxShadow:getComputedStyle(el).boxShadow}];
      const animation=el.animate(frames,{duration:kind==="enter"?180:kind==="value"?420:280,easing:"cubic-bezier(.2,.8,.2,1)"});
      owned.set(el,animation);animation.onfinish=()=>{if(owned.get(el)===animation)owned.delete(el);};
    };
    const flush=()=>{frame=0;if(document.hidden||gesture){queue.clear();return;}for(const [el,kind] of queue.take())play(el,kind);};
    const enqueue=(el:Element,kind:MotionKind)=>{if(!enabled||gesture||document.hidden||!scope().contains(el)||el.closest(EXCLUDE))return;queue.add(el,kind);if(!frame)frame=requestAnimationFrame(flush);};
    const valueChanged=(el:Element)=>{const target=el.closest(VALUES);if(!target)return;const text=target.textContent??"",previous=values.get(target);values.set(target,text);if(previous!==undefined&&previous!==text&&text.length<160)enqueue(target,"value");};
    const pauseSvg=(el:Element)=>{const svg=el instanceof SVGSVGElement?[el]:Array.from(el.querySelectorAll('svg'));for(const s of svg){if(enabled)s.unpauseAnimations?.();else s.pauseAnimations?.();}};
    remember(node);pauseSvg(node);
    if(enabled)for(const panel of Array.from(scope().querySelectorAll(PANELS)).slice(0,LAB_MOTION_LIMITS.entering))enqueue(panel,"enter");
    const observer=new MutationObserver(records=>{for(const record of records){
      const target=record.target instanceof Element?record.target:record.target.parentElement;if(!target)continue;
      if(record.type==="characterData"){valueChanged(target);continue;}
      if(record.type==="attributes"){
        if(record.attributeName==="class"&&target.matches(STATES)&&activeState(record.oldValue??"")!==activeState(target.getAttribute("class")??""))enqueue(target,"state");
        if(record.attributeName==="data-lab-active"&&record.oldValue!==target.getAttribute("data-lab-active"))enqueue(target,"state");
        continue;
      }
      valueChanged(target);
      for(const added of record.addedNodes){if(!(added instanceof Element))continue;remember(added);if(!enabled){pauseSvg(added);continue;}
        if(added.matches(PANELS))enqueue(added,"enter");else {let n=0;for(const panel of added.querySelectorAll(PANELS)){if(n++===LAB_MOTION_LIMITS.entering)break;enqueue(panel,"enter");}}
      }
    }});
    observer.observe(node,{subtree:true,childList:true,characterData:enabled,attributes:enabled,attributeOldValue:enabled,attributeFilter:enabled?["class","data-lab-active"]:undefined});
    const down=()=>{gesture=true;};const up=()=>{gesture=false;};
    node.addEventListener("pointerdown",down);window.addEventListener("pointerup",up);window.addEventListener("pointercancel",up);
    const hidden=()=>{if(document.hidden){queue.clear();for(const animation of owned.values())animation.cancel();owned.clear();}};document.addEventListener("visibilitychange",hidden);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);queue.clear();for(const animation of owned.values())animation.cancel();owned.clear();node.removeEventListener("pointerdown",down);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up);document.removeEventListener("visibilitychange",hidden);};
  },[enabled,lab,location.pathname]);
  return <MotionContext.Provider value={{enabled,reduced,requested,toggle:()=>setRequested(v=>!v)}}><div ref={root} className="lab-motion-root" data-lab-motion={lab?enabled?"full":"reduced":"off"}>{children}</div></MotionContext.Provider>;
}
export function LabMotionControl(){
  const {enabled,reduced,toggle}=useLabMotion();
  return <button type="button" className="lab-motion-control" aria-label="Animate lab changes" aria-pressed={enabled} disabled={reduced} title={reduced?"Your device requests reduced motion":"Toggle lab animations; simulation speed stays unchanged"} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key))e.stopPropagation();}} onClick={toggle}>Motion: {reduced?"Reduced":enabled?"On":"Off"}</button>;
}
