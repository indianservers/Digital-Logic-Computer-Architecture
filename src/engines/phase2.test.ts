import { describe, expect, it } from "vitest";
import { addSub, alu, carryLookahead, carrySelect, compareMagnitude, decrement, divideSteps, fullAdder, fullSubtractor, halfAdder, halfSubtractor, increment, multiplySteps, rippleAdd, shiftVector, signedOverflow } from "./digital/arithmetic";
import { addNode, connect, emptyDoc, evaluate, twoGateTemplate } from "./digital/circuit";
import { bcdToSeven, binaryToGrayCircuit, cascadedMux, decoder, demux, encoder, mux, priorityEncoder } from "./digital/routing";
import { drainTime, schedule } from "./digital/schedule";
import { designCounter, dFlipFlop, jkFlipFlop, masterSlaveJk, nextCount, srNand, srNor, stepRegister, tFlipFlop } from "./digital/sequential";
import { capture, clockSamples, frequencyMHz, periodNs, setupViolated } from "./digital/timing";
import { fromUnsigned, parseBinary, signExtend, sliceVector, toHex, toSigned, toUnsigned, zeroExtend } from "./digital/vector";

describe("vectors", () => {
  it("converts, slices, and extends", () => {
    expect(toUnsigned(fromUnsigned(13, 8))).toBe(13);
    expect(toSigned(fromUnsigned(0b11111011, 8))).toBe(-5);
    expect(toHex(fromUnsigned(0xad, 8))).toBe("AD");
    expect(parseBinary("1011", 8)?.join("")).toBe("00001011");
    expect(sliceVector(fromUnsigned(0b1101, 4), 1, 3).join("")).toBe("10");
    expect(zeroExtend([1, 0], 4).join("")).toBe("0010");
    expect(signExtend([1, 0], 4).join("")).toBe("1110");
  });
});

describe("arithmetic", () => {
  it("adds and subtracts", () => {
    expect(halfAdder(1, 1)).toEqual({ sum: 0, carry: 1 });
    expect(fullAdder(1, 1, 1)).toEqual({ sum: 1, cout: 1 });
    const ripple = rippleAdd(fromUnsigned(0b1101, 4), fromUnsigned(0b0110, 4), 0);
    expect(toUnsigned(ripple.sum)).toBe(19 % 16);
    expect(ripple.cout).toBe(1);
    expect(toUnsigned(carryLookahead(fromUnsigned(9, 4), fromUnsigned(6, 4), 0).sum)).toBe(15);
    const selected = carrySelect(fromUnsigned(3, 8), fromUnsigned(5, 8), 0);
    expect(toUnsigned(selected.sum)).toBe(8);
    expect(halfSubtractor(0, 1)).toEqual({ diff: 1, borrow: 1 });
    expect(fullSubtractor(0, 1, 1).bout).toBe(1);
    const sub = addSub(fromUnsigned(5, 4), fromUnsigned(3, 4), 1);
    expect(toUnsigned(sub.sum)).toBe(2);
    expect(toUnsigned(increment(fromUnsigned(7, 4)).sum)).toBe(8);
    expect(toUnsigned(decrement(fromUnsigned(0, 4)).sum)).toBe(15);
  });

  it("compares, shifts, and flags the ALU", () => {
    expect(compareMagnitude(fromUnsigned(4, 4), fromUnsigned(4, 4)).eq).toBe(1);
    expect(compareMagnitude(fromUnsigned(9, 4), fromUnsigned(2, 4)).gt).toBe(1);
    expect(shiftVector([1, 0, 1, 1], "logical-left", 1).result.join("")).toBe("0110");
    expect(shiftVector([1, 0, 1, 1], "arithmetic-right", 1).result.join("")).toBe("1101");
    expect(shiftVector([1, 0, 0, 1], "rotate-left", 1).result.join("")).toBe("0011");
    const added = alu(fromUnsigned(7, 4), fromUnsigned(1, 4), "ADD");
    expect(toUnsigned(added.result)).toBe(8);
    expect(added.overflow).toBe(1);
    expect(signedOverflow(fromUnsigned(7, 4), fromUnsigned(1, 4), added.result, false)).toBe(1);
    expect(alu(fromUnsigned(1, 4), fromUnsigned(1, 4), "XOR").zero).toBe(1);
    const product = multiplySteps([1, 0, 1, 1], [0, 1, 0, 1]);
    expect(toUnsigned(product.product)).toBe(0b1011 * 0b0101);
    const divided = divideSteps(fromUnsigned(13, 4), fromUnsigned(3, 4));
    expect(toUnsigned(divided.quotient)).toBe(4);
    expect(divided.remainder).toBe(1);
  });
});

describe("routing", () => {
  it("steers muxes, encoders, and decoders", () => {
    expect(mux([0, 1, 0, 1], [1, 0]).y).toBe(0);
    expect(mux([0, 1, 0, 1], [1, 1]).index).toBe(3);
    expect(cascadedMux([0, 0, 0, 1, 0, 0, 0, 0], [0, 1, 1]).y).toBe(1);
    expect(demux(1, [1, 0], 4).join("")).toBe("0010");
    expect(encoder([0, 0, 1, 0]).valid).toBe(1);
    expect(toUnsigned(encoder([0, 0, 1, 0]).y)).toBe(2);
    expect(encoder([1, 1, 0, 0]).invalid).toBe(true);
    const priority = priorityEncoder([1, 1, 0, 1]);
    expect(priority.winner).toBe(3);
    expect(priority.ignored).toEqual([0, 1]);
    expect(decoder([1, 0]).join("")).toBe("0010");
    expect(bcdToSeven([1, 0, 1, 0]).valid).toBe(false);
    expect(bcdToSeven([0, 0, 0, 0]).segments[0]).toBe(1);
    expect(binaryToGrayCircuit([1, 0, 1, 0]).gray.join("")).toBe("1111");
  });
});

describe("sequential storage", () => {
  it("latches and flip-flops", () => {
    expect(srNor(1, 1, 0).label).toBe("invalid");
    expect(srNor(1, 0, 0).q).toBe(1);
    expect(srNor(0, 0, 1).q).toBe(1);
    expect(srNand(0, 0, 0).label).toBe("invalid");
    expect(srNand(1, 1, 1).q).toBe(1);
    expect(dFlipFlop(1, 1, 0, 0, "rise").q).toBe(1);
    expect(dFlipFlop(0, 1, 1, 1, "rise").q).toBe(1);
    expect(jkFlipFlop(1, 1, 1, 0, 0, "rise").q).toBe(1);
    expect(jkFlipFlop(1, 1, 1, 0, 1, "rise").q).toBe(0);
    expect(tFlipFlop(0, 1, 0, 1, "rise").q).toBe(1);
    expect(tFlipFlop(1, 1, 0, 1, "fall").q).toBe(1);
    const slave = masterSlaveJk(1, 1, 1, 0, 0, 0);
    expect(slave.master).toBe(1);
    expect(slave.slave).toBe(0);
    expect(masterSlaveJk(1, 1, 0, 1, slave.master, slave.slave).slave).toBe(1);
  });

  it("shifts and counts", () => {
    expect(stepRegister([1, 0, 1, 1], "shift-right", 0).q.join("")).toBe("0101");
    expect(stepRegister([0, 0, 0, 0], "load", 0, [1, 1, 0, 0]).q.join("")).toBe("1100");
    expect(stepRegister([1, 0, 1, 0], "shift-left", 1).q.join("")).toBe("0101");
    expect(stepRegister([1, 0, 0, 0], "ring", 0).q.join("")).toBe("0100");
    expect(stepRegister([0, 0, 0, 0], "johnson", 0).q.join("")).toBe("1000");
    expect(stepRegister([1, 1, 1, 1], "johnson", 0).q.join("")).toBe("0111");
    expect(nextCount(9, 10, "up")).toBe(0);
    expect(nextCount(0, 6, "down")).toBe(5);
    expect(nextCount(5, 6, "up")).toBe(0);
    const designed = designCounter([0, 1, 2, 3, 4, 5], 3, "D");
    const lsb = designed.bits.find((bit) => bit.name === "Q0" && bit.input === "D");
    expect(lsb?.expression.replace(/\s/g, "")).toBe("Q0'");
    const jk = designCounter([0, 1, 2, 3, 4, 5], 3, "JK");
    expect(jk.bits.find((bit) => bit.name === "Q0" && bit.input === "J")?.expression).toBe("1");
  });
});

describe("timing and circuits", () => {
  it("schedules events and measures the clock", () => {
    const queue = schedule([], { time: 5, componentId: "b", eventType: "delay" });
    const both = schedule(queue, { time: 2, componentId: "a", eventType: "clock-rise" });
    const drained = drainTime(both);
    expect(drained.time).toBe(2);
    expect(drained.rest).toHaveLength(1);
    expect(periodNs(100)).toBe(10);
    expect(frequencyMHz(10)).toBe(100);
    expect(clockSamples(10, 50, 0, 10).filter((bit) => bit === 1)).toHaveLength(5);
    expect(setupViolated(9, 10, 2)).toBe(true);
    expect(capture(1, 9, 10, 2, 1).value).toBe("X");
    expect(capture(1, 4, 10, 2, 1).value).toBe(1);
  });

  it("propagates a wired gate chain and rejects a bad wire", () => {
    const doc = twoGateTemplate();
    const result = evaluate(doc, 0, 0);
    const led = doc.nodes.find((node) => node.type === "LED");
    expect(result.signals[`${led?.id}.A`]?.join("")).toBe("1");
    let loop = emptyDoc();
    loop = addNode(loop, "NOT", 0, 0);
    loop = addNode(loop, "NOT", 40, 0);
    const [first, second] = loop.nodes;
    if (!first || !second) throw new Error("missing");
    loop = connect(loop, first.id, "Y", second.id, "A").doc;
    loop = connect(loop, second.id, "Y", first.id, "A").doc;
    expect(evaluate(loop, 0, 0).warning).toMatch(/loop/i);
    const mismatch = connect(twoGateTemplate(), doc.nodes[0]?.id ?? "", "Y", doc.nodes[0]?.id ?? "", "Y");
    expect(mismatch.error).toBeTruthy();
  });
});
