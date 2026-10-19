import { connect, type CpuDesign } from "./model";

export type Point = {x:number;y:number};
export type Obstacle = {x:number;y:number;width:number;height:number};
export function wirePath(points:readonly Point[],curved=false):string {
  return points.map((p,i)=>{
    if(!i)return `M ${p.x} ${p.y}`;
    const before=points[i-1]!,after=points[i+1];if(!curved||!after)return `L ${p.x} ${p.y}`;
    const previousLength=Math.hypot(p.x-before.x,p.y-before.y),nextLength=Math.hypot(after.x-p.x,after.y-p.y);
    const r=Math.min(6,previousLength/2,nextLength/2);if(!r)return `L ${p.x} ${p.y}`;
    return `L ${p.x-(p.x-before.x)/previousLength*r} ${p.y-(p.y-before.y)/previousLength*r} Q ${p.x} ${p.y} ${p.x+(after.x-p.x)/nextLength*r} ${p.y+(after.y-p.y)/nextLength*r}`;
  }).join(" ");
}
export function crosses(a:Point,b:Point,r:Obstacle):boolean {
  return a.x===b.x ? a.x>r.x&&a.x<r.x+r.width&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.height
    : a.y>r.y&&a.y<r.y+r.height&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.width;
}
/** Rectilinear visibility grid. Routes around component bounds, including rotated bounds. */
export function routeWire(a:Point,b:Point,obstacles:Obstacle[]):Point[] {
  const xs=[...new Set([a.x,b.x,...obstacles.flatMap(r=>[r.x,r.x+r.width])])].sort((a,b)=>a-b);
  const ys=[...new Set([a.y,b.y,...obstacles.flatMap(r=>[r.y,r.y+r.height])])].sort((a,b)=>a-b);
  const start=ys.indexOf(a.y)*xs.length+xs.indexOf(a.x),end=ys.indexOf(b.y)*xs.length+xs.indexOf(b.x);
  const point=(i:number)=>({x:xs[i%xs.length]!,y:ys[Math.floor(i/xs.length)]!});
  const distance=(p:Point,q:Point)=>Math.abs(p.x-q.x)+Math.abs(p.y-q.y);
  const costs=new Map([[start,0]]),parents=new Map<number,number>();
  const open=[{id:start,f:distance(a,b)}];let count=0;
  while(open.length&&count++<15000){
    open.sort((a,b)=>b.f-a.f);const current=open.pop()!;
    if(current.id===end){const path=[b];let id=end;while(id!==start){id=parents.get(id)!;path.push(point(id));}return path.reverse().filter((p,i,all)=>i===0||i===all.length-1||!(all[i-1]!.x===p.x&&p.x===all[i+1]!.x||all[i-1]!.y===p.y&&p.y===all[i+1]!.y));}
    const p=point(current.id),x=current.id%xs.length,y=Math.floor(current.id/xs.length);
    for(const id of [x>0?current.id-1:-1,x<xs.length-1?current.id+1:-1,y>0?current.id-xs.length:-1,y<ys.length-1?current.id+xs.length:-1]){
      if(id<0)continue;const q=point(id);if(obstacles.some(r=>crosses(p,q,r)))continue;
      const cost=costs.get(current.id)!+distance(p,q);if(cost>=(costs.get(id)??Infinity))continue;
      costs.set(id,cost);parents.set(id,current.id);open.push({id,f:cost+distance(q,b)});
    }
  }
  return [a,{x:(a.x+b.x)/2,y:a.y},{x:(a.x+b.x)/2,y:b.y},b];
}
export function reconnectWire(d:CpuDesign,id:string,from:string,fp:string,to:string,tp:string){
  const old=d.wires.find(w=>w.id===id);if(!old)return {design:d,error:"Connection no longer exists."};
  const result=connect({...d,wires:d.wires.filter(w=>w.id!==id)},from,fp,to,tp);
  if(result.error)return {design:d,error:result.error};
  const added=result.design.wires.at(-1)!;
  return {design:{...result.design,wires:result.design.wires.map(w=>w.id===added.id?{...w,id:old.id}:w)},error:null};
}
export function editDescription(before:CpuDesign,after:CpuDesign):string {
  if(after.nodes.length>before.nodes.length)return "add components";
  if(after.nodes.length<before.nodes.length)return "delete components";
  if(after.wires.length!==before.wires.length)return after.wires.length>before.wires.length?"connect ports":"delete wire";
  if(after.wires.some((w,i)=>JSON.stringify(w)!==JSON.stringify(before.wires[i])))return "reconnect wire";
  if(after.nodes.some((n,i)=>n.x!==before.nodes[i]?.x||n.y!==before.nodes[i]?.y))return "move components";
  if(after.nodes.some((n,i)=>JSON.stringify(n)!==JSON.stringify(before.nodes[i])))return "edit component";
  return "edit project";
}
export function tracedWires(d:CpuDesign,selected:string[]):Set<string>{
  const visited=new Set(selected),wires=new Set<string>();let changed=true;
  while(changed){changed=false;for(const w of d.wires)if(visited.has(w.from)){wires.add(w.id);if(!visited.has(w.to)){visited.add(w.to);changed=true;}}}
  // Include immediate drivers without pulling unrelated sibling branches into the trace.
  for(const w of d.wires)if(selected.includes(w.to))wires.add(w.id);
  return wires;
}
