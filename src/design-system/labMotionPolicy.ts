export type MotionKind = "enter" | "value" | "state";
export const LAB_MOTION_LIMITS = { pending:128, perFrame:20, entering:6, cooldown:180 } as const;
export function isAnimatedLabPath(pathname:string){return /^\/(studios|architecture)\/.+/.test(pathname);}

/** Coalesce fast simulator updates; motion must never create a rendering backlog. */
export class MotionQueue<T> {
  private pending=new Map<T,MotionKind>();
  add(target:T,kind:MotionKind){
    if(!this.pending.has(target)&&this.pending.size>=LAB_MOTION_LIMITS.pending)return;
    if(this.pending.get(target)!=="value")this.pending.set(target,kind);
  }
  take(){const result:Array<[T,MotionKind]>=[];let entering=0;
    for(const [target,kind] of this.pending){
      if(kind==="enter"&&entering++>=LAB_MOTION_LIMITS.entering)continue;
      result.push([target,kind]);if(result.length>=LAB_MOTION_LIMITS.perFrame)break;
    }
    // Discard excess cues instead of delaying them into a later simulation cycle.
    this.pending.clear();return result;
  }
  clear(){this.pending.clear();}
  get size(){return this.pending.size;}
}
export function activeState(classes:string){return classes.split(/\s+/).filter(c=>["on","active","current","selected","hazard","hit","miss","running","pass","fail"].includes(c)).sort().join(" ");}
