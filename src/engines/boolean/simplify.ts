import { type AstNode, cloneAst, formatAst, literalCount, sameAst } from "./ast";

export interface SimplifyStep {
  before: string;
  after: string;
  law: string;
}

function bin(type: "AND" | "OR", left: AstNode, right: AstNode): AstNode {
  return { type, left, right };
}

function isNotOf(node: AstNode, inner: AstNode): boolean {
  return node.type === "NOT" && sameAst(node.child, inner);
}

function commuteMatch(node: AstNode, op: "AND" | "OR"): [AstNode, AstNode] | null {
  if (node.type !== op) return null;
  return [node.left, node.right];
}

/** Apply a single textbook rewrite. Returns null when the tree is locally stable. */
function rewrite(node: AstNode): { node: AstNode; law: string } | null {
  if (node.type === "NOT") {
    if (node.child.type === "NOT") return { node: cloneAst(node.child.child), law: "Involution" };
    if (node.child.type === "AND") {
      return {
        node: bin("OR", { type: "NOT", child: cloneAst(node.child.left) }, { type: "NOT", child: cloneAst(node.child.right) }),
        law: "De Morgan",
      };
    }
    if (node.child.type === "OR") {
      return {
        node: bin("AND", { type: "NOT", child: cloneAst(node.child.left) }, { type: "NOT", child: cloneAst(node.child.right) }),
        law: "De Morgan",
      };
    }
    const inner = rewrite(node.child);
    if (inner) return { node: { type: "NOT", child: inner.node }, law: inner.law };
    return null;
  }
  if (node.type === "CONST" || node.type === "VAR") return null;

  const leftHit = rewrite(node.left);
  if (leftHit) return { node: { ...node, left: leftHit.node }, law: leftHit.law };
  const rightHit = rewrite(node.right);
  if (rightHit) return { node: { ...node, right: rightHit.node }, law: rightHit.law };

  const { left, right, type } = node;
  if ((type === "AND" || type === "OR") && sameAst(left, right)) {
    return { node: cloneAst(left), law: "Idempotent" };
  }
  if (type === "OR" && left.type === "CONST" && left.value === 0) return { node: cloneAst(right), law: "Identity" };
  if (type === "OR" && right.type === "CONST" && right.value === 0) return { node: cloneAst(left), law: "Identity" };
  if (type === "AND" && left.type === "CONST" && left.value === 1) return { node: cloneAst(right), law: "Identity" };
  if (type === "AND" && right.type === "CONST" && right.value === 1) return { node: cloneAst(left), law: "Identity" };
  if (type === "OR" && ((left.type === "CONST" && left.value === 1) || (right.type === "CONST" && right.value === 1))) {
    return { node: { type: "CONST", value: 1 }, law: "Null" };
  }
  if (type === "AND" && ((left.type === "CONST" && left.value === 0) || (right.type === "CONST" && right.value === 0))) {
    return { node: { type: "CONST", value: 0 }, law: "Null" };
  }
  if (type === "OR" && (isNotOf(left, right) || isNotOf(right, left))) return { node: { type: "CONST", value: 1 }, law: "Complement" };
  if (type === "AND" && (isNotOf(left, right) || isNotOf(right, left))) return { node: { type: "CONST", value: 0 }, law: "Complement" };
  if (type === "XOR" && right.type === "CONST" && right.value === 0) return { node: cloneAst(left), law: "XOR identity" };
  if (type === "XOR" && left.type === "CONST" && left.value === 0) return { node: cloneAst(right), law: "XOR identity" };
  if (type === "XOR" && sameAst(left, right)) return { node: { type: "CONST", value: 0 }, law: "XOR same" };
  if (type === "XOR" && right.type === "CONST" && right.value === 1) return { node: { type: "NOT", child: cloneAst(left) }, law: "XOR with 1" };

  const absorption = absorb(type, left, right);
  if (absorption) return absorption;

  const factored = factor(type, left, right);
  if (factored) return factored;

  return null;
}

function absorb(type: string, left: AstNode, right: AstNode): { node: AstNode; law: string } | null {
  if (type === "OR") {
    const hit = absorbOr(left, right) ?? absorbOr(right, left);
    if (hit) return { node: hit, law: "Absorption" };
  }
  if (type === "AND") {
    const hit = absorbAnd(left, right) ?? absorbAnd(right, left);
    if (hit) return { node: hit, law: "Absorption" };
  }
  return null;
}

function absorbOr(a: AstNode, b: AstNode): AstNode | null {
  const parts = commuteMatch(b, "AND");
  if (!parts) return null;
  if (sameAst(a, parts[0]) || sameAst(a, parts[1])) return cloneAst(a);
  return null;
}

function absorbAnd(a: AstNode, b: AstNode): AstNode | null {
  const parts = commuteMatch(b, "OR");
  if (!parts) return null;
  if (sameAst(a, parts[0]) || sameAst(a, parts[1])) return cloneAst(a);
  return null;
}

function factor(type: string, left: AstNode, right: AstNode): { node: AstNode; law: string } | null {
  if (type !== "OR") return null;
  const l = commuteMatch(left, "AND");
  const r = commuteMatch(right, "AND");
  if (!l || !r) return null;
  const pairs: Array<[AstNode, AstNode, AstNode, AstNode]> = [
    [l[0], l[1], r[0], r[1]],
    [l[0], l[1], r[1], r[0]],
    [l[1], l[0], r[0], r[1]],
    [l[1], l[0], r[1], r[0]],
  ];
  for (const [common, restL, otherCommon, restR] of pairs) {
    if (sameAst(common, otherCommon)) {
      return {
        node: bin("AND", cloneAst(common), bin("OR", cloneAst(restL), cloneAst(restR))),
        law: "Distributive",
      };
    }
  }
  return null;
}

export function algebraicSimplify(ast: AstNode, limit = 16): { ast: AstNode; steps: SimplifyStep[] } {
  let current = cloneAst(ast);
  const steps: SimplifyStep[] = [];
  for (let i = 0; i < limit; i += 1) {
    const next = rewrite(current);
    if (!next) break;
    const before = formatAst(current);
    const after = formatAst(next.node);
    if (before !== after) steps.push({ before, after, law: next.law });
    current = next.node;
  }
  return { ast: current, steps };
}

export function simpler(a: AstNode, b: AstNode): AstNode {
  const la = literalCount(a);
  const lb = literalCount(b);
  if (lb < la) return b;
  if (la < lb) return a;
  return formatAst(b).length < formatAst(a).length ? b : a;
}
