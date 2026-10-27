import {describe,expect,it} from "vitest";
import {activeState,isAnimatedLabPath,LAB_MOTION_LIMITS,MotionQueue} from "./labMotionPolicy";

describe("lab motion scheduling",()=>{
  it("covers both studio route families without animating ordinary pages",()=>{
    for(const path of ["/studios/pipeline","/studios/microcontroller/gpio","/architecture/builder/builder","/architecture/sandbox/circuit"])expect(isAnimatedLabPath(path)).toBe(true);
    for(const path of ["/","/about","/studios","/architecture"])expect(isAnimatedLabPath(path)).toBe(false);
  });
  it("bounds bursts and drops old cues rather than replaying stale simulation cycles",()=>{
    const queue=new MotionQueue<number>();
    for(let i=0;i<1000;i++)queue.add(i,"value");
    expect(queue.size).toBe(LAB_MOTION_LIMITS.pending);
    expect(queue.take()).toHaveLength(LAB_MOTION_LIMITS.perFrame);
    expect(queue.take()).toEqual([]);
  });
  it("coalesces repeated targets and preserves value feedback over decorative entry",()=>{
    const queue=new MotionQueue<string>();
    queue.add("register","enter");queue.add("register","value");queue.add("register","state");
    expect(queue.take()).toEqual([["register","value"]]);
  });
  it("limits panel entrances while allowing changed values through",()=>{
    const queue=new MotionQueue<number>();
    for(let i=0;i<30;i++)queue.add(i,"enter");
    queue.add(100,"value");
    const cues=queue.take();
    expect(cues.filter(([,kind])=>kind==="enter")).toHaveLength(LAB_MOTION_LIMITS.entering);
    expect(cues).toContainEqual([100,"value"]);
  });
  it("clears pending work when motion is stopped",()=>{
    const queue=new MotionQueue<number>();queue.add(1,"value");queue.clear();expect(queue.take()).toEqual([]);
  });
  it("ignores cosmetic class changes when detecting active state transitions",()=>{
    expect(activeState("large current blue")).toBe(activeState("blue current small"));
    expect(activeState("hit")).not.toBe(activeState("miss"));
  });
});
