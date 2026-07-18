import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type {
  PuzzleCandidate,
  ValidationIssue,
  ValidationResult
} from "../../core/types.ts";

// ===== Seeded RNG (same LCG-with-shift approach as angleChaseStudio) =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0x53c0ffee) >>> 0;
  }
  next(): number {
    this.s = (Math.imul(this.s, 1103515245) + 12345) >>> 0;
    return this.s;
  }
  int(min: number, max: number): number {
    return min + ((this.next() >>> 8) % (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[(this.next() >>> 8) % arr.length];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (this.next() >>> 8) % (i + 1);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
}

// ===== Data model =====

type BlockKind = "given" | "step" | "goal" | "distractor";

// A single statement "block". `deps` lists the ids of the statements that must
// already be established (appear earlier in the proof) before this block's
// justification is valid. Givens have no deps; distractors are never part of a
// valid proof and are always rejected by the grader.
type Block = {
  id: string;
  kind: BlockKind;
  statement: string;
  reason: string;
  deps: string[];
};

// One line of the derivation, used only to build the hint ladder.
type ChainStep = { statement: string; reason: string };

type GenResult = {
  promptText: string;
  goalStatement: string;
  givensText: string;
  blocks: Block[]; // shuffled presentation order (proof nodes + distractors)
  canonicalOrder: string[]; // a valid topological order of the non-distractor ids
  goalId: string;
  chain: ChainStep[]; // ordered derivation (steps + goal), for hints
  domain: string;
  variant: string;
  skillTags: string[];
  selfCheck: boolean;
};

// ===== Proof builder =====
//
// Generators describe a proof by pushing nodes in a natural, dependency-
// respecting order (every dep must reference a node already added). The builder
// assigns ids, and the assembler derives the canonical order directly from this
// insertion order — so the canonical order is topologically valid by
// construction, and validatePuzzle re-verifies that invariant.

type RawNode = {
  key: string;
  kind: Exclude<BlockKind, "distractor">;
  statement: string;
  reason: string;
  deps: string[];
};
type RawDistractor = { statement: string; reason: string; deps: string[] };

class ProofBuilder {
  nodes: RawNode[] = [];
  distractors: RawDistractor[] = [];
  private keys = new Set<string>();

  private add(kind: RawNode["kind"], key: string, statement: string, reason: string, deps: string[]) {
    if (this.keys.has(key)) throw new Error(`duplicate proof node key: ${key}`);
    for (const d of deps) {
      if (!this.keys.has(d)) throw new Error(`node ${key} references unknown dep ${d}`);
    }
    this.keys.add(key);
    this.nodes.push({ key, kind, statement, reason, deps });
  }
  given(key: string, statement: string) {
    this.add("given", key, statement, "Given", []);
  }
  step(key: string, statement: string, reason: string, deps: string[]) {
    this.add("step", key, statement, reason, deps);
  }
  goal(key: string, statement: string, reason: string, deps: string[]) {
    this.add("goal", key, statement, reason, deps);
  }
  distractor(statement: string, reason: string, deps: string[] = []) {
    this.distractors.push({ statement, reason, deps });
  }
}

function assemble(
  rng: Rng,
  b: ProofBuilder,
  meta: {
    promptText: string;
    goalStatement: string;
    givensText: string;
    domain: string;
    variant: string;
    skillTags: string[];
  }
): GenResult {
  const proofBlocks: Block[] = b.nodes.map((n) => ({
    id: n.key,
    kind: n.kind,
    statement: n.statement,
    reason: n.reason,
    deps: n.deps
  }));

  const distractorBlocks: Block[] = b.distractors.map((d, i) => ({
    id: `d${i + 1}`,
    kind: "distractor" as const,
    statement: d.statement,
    reason: d.reason,
    deps: d.deps
  }));

  const canonicalOrder = proofBlocks.map((n) => n.id);
  const goalNode = proofBlocks.find((n) => n.kind === "goal");
  const goalId = goalNode ? goalNode.id : canonicalOrder[canonicalOrder.length - 1];

  // Chain (for hints): the derived steps + goal in canonical order.
  const chain: ChainStep[] = proofBlocks
    .filter((n) => n.kind !== "given")
    .map((n) => ({ statement: n.statement, reason: n.reason }));

  const allBlocks = rng.shuffle([...proofBlocks, ...distractorBlocks]);

  const selfCheck = verifyProof(proofBlocks, canonicalOrder, goalId);

  return {
    promptText: meta.promptText,
    goalStatement: meta.goalStatement,
    givensText: meta.givensText,
    blocks: allBlocks,
    canonicalOrder,
    goalId,
    chain,
    domain: meta.domain,
    variant: meta.variant,
    skillTags: meta.skillTags,
    selfCheck
  };
}

// Structural self-check: canonical order is dependency-respecting, the goal is
// the unique sink, every non-distractor node is an ancestor of the goal (so no
// step is dead weight), and there is at least one given and one derived step.
function verifyProof(proofBlocks: Block[], canonicalOrder: string[], goalId: string): boolean {
  const byId = new Map(proofBlocks.map((n) => [n.id, n]));
  if (proofBlocks.length !== canonicalOrder.length) return false;
  const pos = new Map<string, number>();
  canonicalOrder.forEach((id, i) => pos.set(id, i));

  // deps precede, and reference only proof nodes
  for (const id of canonicalOrder) {
    const node = byId.get(id);
    if (!node) return false;
    for (const dep of node.deps) {
      const dp = pos.get(dep);
      if (dp === undefined || dp >= (pos.get(id) as number)) return false;
    }
  }

  const givens = proofBlocks.filter((n) => n.kind === "given");
  const steps = proofBlocks.filter((n) => n.kind === "step");
  const goals = proofBlocks.filter((n) => n.kind === "goal");
  if (givens.length < 1 || steps.length < 1 || goals.length !== 1) return false;
  if (goals[0].id !== goalId) return false;
  // Goal must be the last node (it is the sink of the ancestor closure).
  if (canonicalOrder[canonicalOrder.length - 1] !== goalId) return false;

  // Every node must be an ancestor of the goal (reachable via reverse deps).
  const reachable = new Set<string>([goalId]);
  const stack = [goalId];
  while (stack.length) {
    const cur = stack.pop() as string;
    const node = byId.get(cur);
    if (!node) return false;
    for (const dep of node.deps) {
      if (!reachable.has(dep)) {
        reachable.add(dep);
        stack.push(dep);
      }
    }
  }
  if (reachable.size !== proofBlocks.length) return false;

  return true;
}

// ===== Word banks / helpers =====

function coeffTerm(k: number, varName = "x"): string {
  if (k === 1) return varName;
  if (k === -1) return `-${varName}`;
  return `${k}${varName}`;
}

// ===== Domain 1: Algebraic equation solving (linear chain) =====

function genAlgebra(rng: Rng, opts: { threeStep: boolean; distractors: number }): GenResult {
  const b = new ProofBuilder();
  const varName = "x";
  const skillTags = ["proof", "argument_structure", "algebra", "equations", "justification"];

  if (!opts.threeStep) {
    // a*x + c = r  ->  subtract c, divide by a
    const a = rng.int(2, 6);
    const x = rng.int(2, 9);
    const c = rng.int(1, 9) * rng.pick([1, -1]);
    const r = a * x + c;
    const startEq = `${coeffTerm(a, varName)} ${c >= 0 ? "+ " + c : "− " + -c} = ${r}`;
    b.given("g1", `${startEq}`);
    const afterSub = `${coeffTerm(a, varName)} = ${a * x}`;
    b.step("s1", afterSub, c >= 0 ? `Subtract ${c} from both sides` : `Add ${-c} to both sides`, ["g1"]);
    b.goal("goal", `${varName} = ${x}`, `Divide both sides by ${a}`, ["s1"]);

    if (opts.distractors >= 1) {
      // wrong-direction inverse operation
      b.distractor(`${coeffTerm(a, varName)} = ${a * x + 2 * c}`, c >= 0 ? `Add ${c} to both sides` : `Subtract ${-c} from both sides`, ["g1"]);
    }
    if (opts.distractors >= 2) {
      b.distractor(`${varName} = ${a * x}`, `Divide both sides by ${a}`, ["s1"]);
    }

    return assemble(rng, b, {
      promptText: buildPrompt(`x = ${x}`),
      goalStatement: `${varName} = ${x}`,
      givensText: `the equation ${startEq}`,
      domain: "algebra",
      variant: "algebra-2step",
      skillTags
    });
  }

  // 3-step: k(x + p) = r  ->  distribute, subtract, divide
  const k = rng.int(2, 5);
  const x = rng.int(2, 9);
  const p = rng.int(1, 6);
  const r = k * (x + p);
  const startEq = `${k}(${varName} + ${p}) = ${r}`;
  const kp = k * p;
  b.given("g1", startEq);
  b.step("s1", `${coeffTerm(k, varName)} + ${kp} = ${r}`, "Distributive property", ["g1"]);
  b.step("s2", `${coeffTerm(k, varName)} = ${k * x}`, `Subtract ${kp} from both sides`, ["s1"]);
  b.goal("goal", `${varName} = ${x}`, `Divide both sides by ${k}`, ["s2"]);

  if (opts.distractors >= 1) {
    b.distractor(`${coeffTerm(k, varName)} + ${p} = ${r}`, "Distributive property", ["g1"]);
  }
  if (opts.distractors >= 2) {
    b.distractor(`${coeffTerm(k, varName)} = ${k * x + 2 * kp}`, `Add ${kp} to both sides`, ["s1"]);
  }

  return assemble(rng, b, {
    promptText: buildPrompt(`x = ${x}`),
    goalStatement: `${varName} = ${x}`,
    givensText: `the equation ${startEq}`,
    domain: "algebra",
    variant: "algebra-3step",
    skillTags
  });
}

// ===== Domain 2: Logic if-then chains (modus ponens) =====

const LOGIC_STORIES: { facts: string[]; chain: string[] }[] = [
  { facts: ["it is raining"], chain: ["the game is cancelled", "we watch a movie at home"] },
  { facts: ["the alarm rings"], chain: ["the doors lock", "the guard is alerted"] },
  { facts: ["Maya finishes her homework"], chain: ["she can play outside", "she feels happy"] },
  { facts: ["the seeds get water"], chain: ["the plants grow", "the garden blooms"] },
  { facts: ["the battery is charged"], chain: ["the robot turns on", "it starts cleaning"] }
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function genLogic(rng: Rng, opts: { links: 2 | 3; distractors: number }): GenResult {
  const b = new ProofBuilder();
  const story = rng.pick(LOGIC_STORIES);
  const props = [story.facts[0], ...story.chain];
  const links = opts.links;
  const usedProps = props.slice(0, links + 1); // fact + `links` consequents

  b.given("f", `${cap(usedProps[0])}.`);
  const condKeys: string[] = [];
  for (let i = 0; i < links; i++) {
    const key = `c${i + 1}`;
    condKeys.push(key);
    b.given(key, `If ${usedProps[i]}, then ${usedProps[i + 1]}.`);
  }

  // Steps: modus ponens along the chain.
  let prevFactKey = "f";
  let prevProp = usedProps[0];
  for (let i = 0; i < links; i++) {
    const isGoal = i === links - 1;
    const key = isGoal ? "goal" : `s${i + 1}`;
    const stmt = `${cap(usedProps[i + 1])}.`;
    const reason = `Modus Ponens: "${cap(prevProp)}" and "If ${prevProp}, then ${usedProps[i + 1]}" together force "${usedProps[i + 1]}".`;
    if (isGoal) b.goal(key, stmt, reason, [prevFactKey, condKeys[i]]);
    else b.step(key, stmt, reason, [prevFactKey, condKeys[i]]);
    prevFactKey = key;
    prevProp = usedProps[i + 1];
  }

  if (opts.distractors >= 1) {
    // Affirming the converse — plausible but logically invalid.
    b.distractor(
      `${cap(usedProps[0])}.`,
      `Converse error: reasoning backwards from "${usedProps[1]}" to "${usedProps[0]}" is not valid.`,
      []
    );
  }
  if (opts.distractors >= 2) {
    // Irrelevant true-sounding statement not among the givens.
    b.distractor(
      `${cap(usedProps[links])} only sometimes.`,
      "Hedged restatement — not something the givens actually establish.",
      []
    );
  }

  return assemble(rng, b, {
    promptText: buildPrompt(`${cap(usedProps[links])}`),
    goalStatement: `${cap(usedProps[links])}.`,
    givensText: `the fact "${cap(usedProps[0])}" and the if-then rules`,
    domain: "logic",
    variant: `logic-${links}link`,
    skillTags: ["proof", "argument_structure", "logic", "if_then", "modus_ponens", "justification"]
  });
}

// ===== Domain 3: Number-property (parity) proofs — branching DAG =====

type ParityVariant = "sum-even" | "sum-odd" | "sum-mixed" | "product-even";

function genParity(rng: Rng, opts: { variant: ParityVariant; distractors: number }): GenResult {
  const b = new ProofBuilder();
  const skillTags = ["proof", "argument_structure", "number_properties", "parity", "justification"];
  const v = opts.variant;

  if (v === "sum-even" || v === "sum-odd" || v === "sum-mixed") {
    const aEven = v === "sum-even" || v === "sum-mixed";
    const bEven = v === "sum-even";
    // sum-mixed: a even, b odd -> odd. sum-odd: both odd -> even. sum-even: both even -> even.
    const aWord = aEven ? "even" : "odd";
    const bWord = bEven ? "even" : "odd";
    b.given("ga", `a is an ${aWord} number.`);
    b.given("gb", `b is an ${bWord} number.`);
    // Independent definition steps — these two can be established in either
    // order, which is what makes this a branching (not linear) proof.
    b.step("sa", aEven ? "a = 2m for some integer m." : "a = 2m + 1 for some integer m.",
      `Definition of an ${aWord} number.`, ["ga"]);
    b.step("sb", bEven ? "b = 2n for some integer n." : "b = 2n + 1 for some integer n.",
      `Definition of an ${bWord} number.`, ["gb"]);
    const aExpr = aEven ? "2m" : "2m + 1";
    const bExpr = bEven ? "2n" : "2n + 1";
    b.step("ssum", `a + b = ${aExpr} + ${bExpr}.`, "Substitute the expressions for a and b.", ["sa", "sb"]);

    // Simplify + factor to reveal parity.
    const resultEven = aEven === bEven; // even+even or odd+odd -> even
    if (resultEven) {
      // both even: 2m+2n = 2(m+n); both odd: 2m+1+2n+1 = 2m+2n+2 = 2(m+n+1)
      const inner = aEven ? "m + n" : "m + n + 1";
      b.step("sfac", `a + b = 2(${inner}).`, "Combine like terms and factor out 2.", ["ssum"]);
      b.goal("goal", "a + b is even.", "Definition of even: it equals 2 times an integer.", ["sfac"]);
    } else {
      // even + odd: 2m + 2n + 1 = 2(m+n) + 1
      b.step("sfac", "a + b = 2(m + n) + 1.", "Combine like terms and group as 2·(integer) + 1.", ["ssum"]);
      b.goal("goal", "a + b is odd.", "Definition of odd: it equals 2 times an integer, plus 1.", ["sfac"]);
    }

    if (opts.distractors >= 1) {
      b.distractor("a + b = 2m + 2n (dropping the +1 terms).",
        "Substitution error: the +1 terms cannot just be dropped.", ["sa", "sb"]);
    }
    if (opts.distractors >= 2) {
      b.distractor(`a · b is ${resultEven ? "odd" : "even"}.`,
        "Irrelevant claim about the product, not the sum being asked about.", []);
    }

    const goalWord = resultEven ? "even" : "odd";
    return assemble(rng, b, {
      promptText: buildPrompt(`a + b is ${goalWord}`),
      goalStatement: `a + b is ${goalWord}.`,
      givensText: `a is ${aWord} and b is ${bWord}`,
      domain: "number-property",
      variant: `parity-${v}`,
      skillTags
    });
  }

  // product-even: a is even -> a·b is even for any integer b.
  b.given("ga", "a is an even number.");
  b.given("gb", "b is an integer.");
  b.step("sa", "a = 2m for some integer m.", "Definition of an even number.", ["ga"]);
  b.step("sprod", "a · b = (2m) · b = 2(mb).", "Substitute a = 2m and factor out 2.", ["sa", "gb"]);
  b.goal("goal", "a · b is even.", "Definition of even: it equals 2 times an integer (here, m·b).", ["sprod"]);

  if (opts.distractors >= 1) {
    b.distractor("a · b = 2m + b.", "Algebra error: (2m)·b is 2mb, not 2m + b.", ["sa", "gb"]);
  }
  if (opts.distractors >= 2) {
    b.distractor("b is even.", "Unsupported: b was only assumed to be an integer, not even.", ["gb"]);
  }

  return assemble(rng, b, {
    promptText: buildPrompt("a · b is even"),
    goalStatement: "a · b is even.",
    givensText: "a is even and b is any integer",
    domain: "number-property",
    variant: "parity-product-even",
    skillTags
  });
}

// ===== Domain 4: Geometry angle proofs — reuse Angle Chase vocabulary =====

function genGeometry(rng: Rng, opts: { variant: "vertical" | "complement-x" | "supplement-x"; distractors: number }): GenResult {
  const b = new ProofBuilder();
  const skillTags = ["proof", "argument_structure", "geometry", "angles", "justification"];

  if (opts.variant === "vertical") {
    // Prove vertical angles equal: two lines cross, ∠1 & ∠3 vertical.
    b.given("g1", "∠1 and ∠2 form a linear pair (they lie on a straight line).");
    b.given("g2", "∠2 and ∠3 form a linear pair (they lie on a straight line).");
    b.step("s1", "∠1 + ∠2 = 180°.", "Linear Pair Postulate (angles on a line sum to 180°).", ["g1"]);
    b.step("s2", "∠2 + ∠3 = 180°.", "Linear Pair Postulate (angles on a line sum to 180°).", ["g2"]);
    b.step("s3", "∠1 + ∠2 = ∠2 + ∠3.", "Both sums equal 180°, so set them equal (substitution).", ["s1", "s2"]);
    b.goal("goal", "∠1 = ∠3.", "Subtract ∠2 from both sides.", ["s3"]);

    if (opts.distractors >= 1) {
      b.distractor("∠1 + ∠3 = 180°.", "Wrong pairing: ∠1 and ∠3 are vertical, not a linear pair.", ["g1"]);
    }
    if (opts.distractors >= 2) {
      b.distractor("∠1 = ∠2.", "Adjacent angles in a linear pair are supplementary, not necessarily equal.", ["s1"]);
    }

    return assemble(rng, b, {
      promptText: buildPrompt("∠1 = ∠3"),
      goalStatement: "∠1 = ∠3.",
      givensText: "two lines crossing so that ∠1–∠2 and ∠2–∠3 are linear pairs",
      domain: "geometry",
      variant: "geometry-vertical",
      skillTags
    });
  }

  // complement-x / supplement-x: solve for x with an angle relationship.
  const complementary = opts.variant === "complement-x";
  const total = complementary ? 90 : 180;
  const rel = complementary ? "complementary" : "supplementary";
  const relSum = complementary ? "90°" : "180°";
  const coeff = rng.int(2, 4);
  // choose x so that coeff*x < total and (total - coeff*x) is a positive integer angle
  const maxX = Math.floor((total - 5) / coeff);
  const x = rng.int(3, Math.max(3, maxX));
  const known = total - coeff * x; // measure of second angle
  const safeKnown = known;

  b.given("g1", `∠A and ∠B are ${rel} angles.`);
  b.given("g2", `∠A = ${coeffTerm(coeff, "x")}°.`);
  b.given("g3", `∠B = ${safeKnown}°.`);
  b.step("s1", `∠A + ∠B = ${relSum}.`, `Definition of ${rel} angles.`, ["g1"]);
  b.step("s2", `${coeffTerm(coeff, "x")} + ${safeKnown} = ${total}.`, "Substitute the given angle measures.", ["s1", "g2", "g3"]);
  b.step("s3", `${coeffTerm(coeff, "x")} = ${total - safeKnown}.`, `Subtract ${safeKnown} from both sides.`, ["s2"]);
  const xVal = (total - safeKnown) / coeff;
  b.goal("goal", `x = ${xVal}.`, `Divide both sides by ${coeff}.`, ["s3"]);

  if (opts.distractors >= 1) {
    b.distractor(`${coeffTerm(coeff, "x")} = ${total + safeKnown}.`, `Add ${safeKnown} to both sides.`, ["s2"]);
  }
  if (opts.distractors >= 2) {
    b.distractor(`∠A + ∠B = ${complementary ? "180°" : "90°"}.`, `Mixed up ${rel} with the other relationship.`, ["g1"]);
  }

  const validXVal = Number.isInteger(xVal) && xVal > 0 && safeKnown > 0 && safeKnown < total;

  const result = assemble(rng, b, {
    promptText: buildPrompt(`x = ${xVal}`),
    goalStatement: `x = ${xVal}.`,
    givensText: `∠A and ∠B are ${rel}, with ∠A = ${coeffTerm(coeff, "x")}° and ∠B = ${safeKnown}°`,
    domain: "geometry",
    variant: `geometry-${opts.variant}`,
    skillTags
  });
  // fold arithmetic sanity into selfCheck
  return { ...result, selfCheck: result.selfCheck && validXVal };
}

function buildPrompt(goal: string): string {
  return `Assemble a valid proof of: ${goal}. Click the statement blocks in the correct order — start from the givens and add each statement only once every statement its justification depends on is already in your proof. Leave out any block whose reasoning does not actually follow.`;
}

// ===== Difficulty dispatch =====

function generatePuzzleData(rng: Rng, difficulty: number): GenResult {
  const d = Math.max(1, Math.min(6, Math.round(difficulty)));
  const branch = rng.int(0, 1);
  switch (d) {
    case 1:
      return branch === 0
        ? genAlgebra(rng, { threeStep: false, distractors: 0 })
        : genLogic(rng, { links: 2, distractors: 0 });
    case 2:
      return branch === 0
        ? genAlgebra(rng, { threeStep: false, distractors: 1 })
        : genLogic(rng, { links: 2, distractors: 1 });
    case 3:
      return branch === 0
        ? genAlgebra(rng, { threeStep: true, distractors: 1 })
        : genParity(rng, { variant: "sum-even", distractors: 1 });
    case 4:
      return branch === 0
        ? genParity(rng, { variant: rng.pick(["sum-odd", "sum-mixed"] as ParityVariant[]), distractors: 2 })
        : genGeometry(rng, { variant: "vertical", distractors: 1 });
    case 5:
      return branch === 0
        ? genGeometry(rng, { variant: rng.pick(["complement-x", "supplement-x"]) as "complement-x" | "supplement-x", distractors: 2 })
        : genParity(rng, { variant: "product-even", distractors: 2 });
    default:
      return branch === 0
        ? genGeometry(rng, { variant: "vertical", distractors: 2 })
        : genAlgebra(rng, { threeStep: true, distractors: 2 });
  }
}

// ===== Hint ladder =====

function buildHintsFromResult(
  givensText: string,
  goalStatement: string,
  chain: ChainStep[],
  firstStep: { statement: string; reason: string } | null
): string[] {
  const hint1 = `You are trying to prove: ${goalStatement} You are given ${givensText}. Every block you add must be justified only by the givens and blocks you have already placed — and some blocks are distractors whose reasoning does not actually follow, so leave those out.`;

  const hint2 = firstStep
    ? `Start from the givens. The first statement you can establish using only the givens is "${firstStep.statement}" — justified by: ${firstStep.reason}`
    : "Look for the statement that follows directly from the givens alone.";

  const remaining = chain.slice(1);
  const hint3 = firstStep
    ? `Place "${firstStep.statement}" first (${firstStep.reason}).` +
      (remaining.length
        ? " Then continue in dependency order: " +
          remaining.map((c) => `"${c.statement}" (${c.reason})`).join(" → ") +
          "."
        : "")
    : `Follow the chain: ${chain.map((c) => `"${c.statement}" (${c.reason})`).join(" → ")}.`;

  return [hint1, hint2, hint3];
}

// ===== Grader =====

function parseOrder(answer: string): string[] | null {
  const raw = String(answer ?? "").trim();
  if (raw === "") return null;
  // Preferred: JSON array of ids.
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) return parsed;
      return null;
    } catch {
      return null;
    }
  }
  // Fallback: comma / whitespace separated ids.
  const parts = raw.split(/[\s,]+/).filter((s) => s.length > 0);
  return parts.length ? parts : null;
}

// ===== Plugin =====

export const proofBlocksPlugin: GameTypePlugin = {
  id: "proof-blocks",
  name: "Proof Blocks",
  minGrade: 6,
  maxGrade: 10,
  description:
    "Assemble a valid deductive proof by ordering statement blocks from the givens to the goal, where each step's justification must follow from statements already established. Excludes plausible-but-invalid distractor blocks. Domains: algebra equation-solving, if-then logic chains, number-property (parity) proofs, and geometry angle proofs.",

  generate(input) {
    const rng = new Rng(input.seed);
    const result = generatePuzzleData(rng, input.difficulty);

    return {
      gameTypeId: "proof-blocks",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: { text: result.promptText },
      data: {
        variant: result.variant,
        domain: result.domain,
        goalStatement: result.goalStatement,
        givensText: result.givensText,
        goalId: result.goalId,
        blocks: result.blocks,
        canonicalOrder: result.canonicalOrder,
        chain: result.chain,
        selfCheck: result.selfCheck
      },
      metadata: {
        // Independent steps (e.g. two "definition of even" lines) make several
        // topological orders valid, so we grade structurally rather than by a
        // single canonical string, and do not expect a unique solution.
        expectUniqueSolution: false,
        skillTags: result.skillTags
      }
    };
  },

  // Returns one canonical (construction-order) topological ordering. Because the
  // grader validates any dependency-respecting order structurally, this single
  // canonical solution is guaranteed to pass gradeAnswer (checked by the gate).
  solve(candidate: PuzzleCandidate): string[] {
    const order = candidate.data.canonicalOrder as string[] | undefined;
    if (!Array.isArray(order) || order.length === 0) return [];
    return [JSON.stringify(order)];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues: ValidationIssue[] = [];
    const blocks = candidate.data.blocks as Block[] | undefined;
    const canonicalOrder = candidate.data.canonicalOrder as string[] | undefined;
    const goalId = candidate.data.goalId as string | undefined;
    const chain = candidate.data.chain as ChainStep[] | undefined;

    if (!Array.isArray(blocks) || blocks.length < 3) {
      issues.push({ code: "no_blocks", message: "Puzzle must have at least 3 statement blocks." });
      return { ok: false, issues };
    }

    const byId = new Map<string, Block>();
    let dupId = false;
    for (const blk of blocks) {
      if (!blk || typeof blk.id !== "string" || typeof blk.statement !== "string" || blk.statement.trim() === "") {
        issues.push({ code: "bad_block", message: "A block is missing an id or statement." });
        return { ok: false, issues };
      }
      if (byId.has(blk.id)) dupId = true;
      byId.set(blk.id, blk);
    }
    if (dupId) issues.push({ code: "dup_block_id", message: "Duplicate block ids." });

    const proofBlocks = blocks.filter((b) => b.kind !== "distractor");
    const distractors = blocks.filter((b) => b.kind === "distractor");

    if (!Array.isArray(canonicalOrder) || canonicalOrder.length === 0) {
      issues.push({ code: "no_canonical", message: "Canonical order missing." });
      return { ok: false, issues };
    }

    // canonicalOrder must be exactly the set of non-distractor ids.
    const proofIds = new Set(proofBlocks.map((b) => b.id));
    const orderSet = new Set(canonicalOrder);
    if (orderSet.size !== canonicalOrder.length) {
      issues.push({ code: "canonical_dup", message: "Canonical order has duplicate ids." });
    }
    if (orderSet.size !== proofIds.size || [...proofIds].some((id) => !orderSet.has(id))) {
      issues.push({ code: "canonical_mismatch", message: "Canonical order does not match the non-distractor block set." });
    }

    // No proof (non-distractor) block may depend on a distractor.
    const distractorIds = new Set(distractors.map((b) => b.id));
    for (const pb of proofBlocks) {
      for (const dep of pb.deps || []) {
        if (distractorIds.has(dep)) {
          issues.push({ code: "proof_depends_on_distractor", message: `Block ${pb.id} depends on distractor ${dep}.` });
          break;
        }
        if (!byId.has(dep)) {
          issues.push({ code: "dangling_dep", message: `Block ${pb.id} depends on unknown ${dep}.` });
          break;
        }
      }
    }

    // Structural proof validity (deps precede, goal is sink, all nodes needed).
    if (!goalId || !proofIds.has(goalId)) {
      issues.push({ code: "bad_goal", message: "Goal id missing or not a proof block." });
    } else if (!verifyProof(proofBlocks, canonicalOrder, goalId)) {
      issues.push({ code: "invalid_proof_structure", message: "Canonical proof structure is not valid." });
    }

    if (!Array.isArray(chain) || chain.length === 0) {
      issues.push({ code: "no_chain", message: "Hint chain missing." });
    }

    if (candidate.data.selfCheck !== true) {
      issues.push({ code: "self_check_failed", message: "Generator self-check failed." });
    }

    return { ok: issues.length === 0, issues };
  },

  // Structural grader: accepts ANY dependency-respecting ordering of exactly the
  // non-distractor blocks. Rejects orderings that (a) include a distractor,
  // (b) omit a required block / stop short of the goal, (c) place a block before
  // one of its prerequisites, or (d) repeat / invent a block id.
  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const blocks = candidate.data.blocks as Block[] | undefined;
    if (!Array.isArray(blocks) || blocks.length === 0) return false;

    const byId = new Map(blocks.map((b) => [b.id, b]));
    const validIds = new Set(blocks.filter((b) => b.kind !== "distractor").map((b) => b.id));

    const submitted = parseOrder(answer);
    if (!submitted || submitted.length === 0) return false;

    // No unknown ids, no duplicates.
    const seen = new Set<string>();
    for (const id of submitted) {
      const blk = byId.get(id);
      if (!blk) return false;
      if (seen.has(id)) return false;
      seen.add(id);
    }

    // Must use exactly the non-distractor set (rejects distractors + missing steps).
    if (submitted.length !== validIds.size) return false;
    for (const id of submitted) {
      const blk = byId.get(id) as Block;
      if (blk.kind === "distractor" || !validIds.has(id)) return false;
    }

    // Every prerequisite must appear strictly earlier.
    const pos = new Map<string, number>();
    submitted.forEach((id, i) => pos.set(id, i));
    for (const id of submitted) {
      const blk = byId.get(id) as Block;
      for (const dep of blk.deps || []) {
        const dp = pos.get(dep);
        if (dp === undefined || dp >= (pos.get(id) as number)) return false;
      }
    }

    return true;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const chain = (candidate.data.chain as ChainStep[]) || [];
    const givensText = String(candidate.data.givensText ?? "the starting statements");
    const goalStatement = String(candidate.data.goalStatement ?? "the goal");
    const firstStep = chain.length ? { statement: chain[0].statement, reason: chain[0].reason } : null;
    return buildHintsFromResult(givensText, goalStatement, chain, firstStep);
  }
};
