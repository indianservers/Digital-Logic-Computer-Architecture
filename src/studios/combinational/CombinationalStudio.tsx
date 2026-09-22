import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card } from "../../design-system/ui";
import { StudioFrame } from "../../layout/StudioFrame";
import { evaluate, twoGateTemplate } from "../../engines/digital/circuit";
import { CanvasLab } from "./CanvasLab";

const TABS = [
  { id: "canvas", label: "Circuit canvas" },
  { id: "process", label: "Design process" },
  { id: "challenge", label: "Challenge" },
];

const STEPS = [
  ["Define the problem", "Write the inputs, outputs, and the behavior in one sentence."],
  ["Name inputs and outputs", "A majority circuit uses A, B, and C and one output Y."],
  ["Build the truth table", "Every input combination gets an output. Open the truth-table studio if the function is still an expression."],
  ["Derive the expression", "Y is 1 when at least two inputs are 1: AB + BC + CA."],
  ["Simplify", "The K-map studio groups those minterms when the expression is larger."],
  ["Choose parts", "Three AND gates and two OR gates implement that sum of products."],
  ["Construct", "Drop the parts on the canvas and wire outputs to inputs."],
  ["Verify", "Toggle every combination and compare the LED with the truth table."],
];

export function CombinationalStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "canvas";
  const [resetKey, setResetKey] = useState(0);
  return (
    <StudioFrame icon="gate" title="Combinational Circuit Design" description="Drag parts, wire ports, and watch the signals change. The canvas is the circuit." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} onReset={() => setResetKey((n) => n + 1)} guide={["Drag a part onto the canvas", "Pull a wire from an output dot to an input dot", "Toggle an input and read the probe", "Save the circuit in this browser"]} takeaways={["Outputs depend only on the current inputs", "A wire carries the value of its source", "A combinational loop is marked instead of freezing the page"]}>
      <div key={resetKey}>
        {tab === "canvas" ? <CanvasLab /> : null}
        {tab === "process" ? (
          <div className="grid cards-2">
            {STEPS.map(([title, body], index) => (
              <Card key={title} title={`${index + 1}. ${title ?? ""}`}><p className="muted">{body}</p></Card>
            ))}
            <Card title="Continue in Phase 1 tools">
              <div className="row">
                <Link className="btn-primary" to="/studios/truth-tables">Truth table</Link>
                <Link className="btn-ghost" to="/studios/kmap">K-map</Link>
              </div>
            </Card>
          </div>
        ) : null}
        {tab === "challenge" ? <Challenge /> : null}
      </div>
    </StudioFrame>
  );
}

function Challenge() {
  const doc = twoGateTemplate();
  const led = doc.nodes.find((node) => node.type === "LED");
  const high = evaluate({ ...doc, nodes: doc.nodes.map((node) => node.type === "TOGGLE" ? { ...node, bits: [1] } : node) }, 0, 0);
  const value = high.signals[`${led?.id}.A`]?.[0];
  return (
    <Card title="Two-gate chain">
      <p>With both toggles at 1, an AND followed by NOT drives the LED. What level reaches the lamp?</p>
      <p className="expr">{value === 0 ? "LOW — both inputs make AND high, and NOT inverts it." : "Check the wiring."}</p>
      <p className="tiny">Open the two-gate template on the canvas and toggle the inputs yourself.</p>
    </Card>
  );
}
