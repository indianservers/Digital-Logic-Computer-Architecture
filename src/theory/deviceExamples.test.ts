import { describe, expect, it } from "vitest";
import examples from "./deviceExamples.json";
import { LABS, initialValues } from "../studios/how-devices-work/labs/data";
import { simulate } from "../studios/how-devices-work/labs/engine";
import { ADVANCED_LABS, initialAdvancedValues } from "../studios/how-devices-work/advanced/data";
import { simulateAdvanced } from "../studios/how-devices-work/advanced/engine";
import { devicePath } from "../studios/how-devices-work/catalogue";

describe("solved device scenarios",()=>{
  it("matches the actual engine for every baseline and changed-control example",()=>{
    expect(examples).toHaveLength(LABS.length+ADVANCED_LABS.length);
    for(const example of examples){
      const basic=LABS.find(l=>devicePath(l.device)===example.route);
      const advanced=ADVANCED_LABS.find(l=>devicePath(l.device)===example.route);
      const lab=basic??advanced!;
      const input=basic?initialValues(basic):initialAdvancedValues(advanced!);
      const changed={...input};
      if(example.change){const control=lab.controls.find(c=>c.label===example.change!.label)!;changed[control.key]=example.change.to;}
      const run=(p:Record<string,number>,fault=false)=>basic?simulate(basic,p,example.mode,fault,5,"measure"):simulateAdvanced(advanced!,p,example.mode,5,fault);
      expect(run(input).metrics,example.route).toEqual(example.before);
      expect(run(changed).metrics,example.route).toEqual(example.after);
      expect(run(input,true).metrics,example.route).toEqual(example.fault);
    }
  });
});
