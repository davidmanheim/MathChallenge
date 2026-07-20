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
  // Pick `n` distinct elements from `pool` (order matters for the result).
  pickDistinct<T>(pool: T[], n: number): T[] {
    return this.shuffle(pool).slice(0, n);
  }
}

// ===== Geometry primitives (diagram payload for geometry-domain proofs) =====
//
// Mirrors angleChaseStudio's diagram model so the frontend can reuse the same
// SVG rendering approach: a set of line segments plus arc "angle marks". Every
// value fed into a diagram is derived from the same numbers used in the proof
// statements, so the figure is geometrically consistent with the proof by
// construction (verified in each generator's selfCheck).

type Pt = { x: number; y: number };
type Seg = { a: Pt; b: Pt };
type AngleMark = {
  vertex: Pt;
  dir1: number; // absolute start direction, degrees CCW from +x
  value: number; // sweep, degrees CCW
  label: string;
  isTarget: boolean;
  isGiven: boolean;
  radius: number;
};
type Diagram = {
  width: number;
  height: number;
  segments: Seg[];
  angleMarks: AngleMark[];
};

function normDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}
function dirPoint(v: Pt, dirDeg: number, dist: number): Pt {
  const rad = (dirDeg * Math.PI) / 180;
  return { x: v.x + dist * Math.cos(rad), y: v.y - dist * Math.sin(rad) };
}
function fullLine(v: Pt, dirDeg: number, halfLen: number): Seg {
  return {
    a: dirPoint(v, dirDeg, halfLen),
    b: dirPoint(v, normDeg(dirDeg + 180), halfLen)
  };
}
function finitePt(p: Pt): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
function diagramFinite(dg: Diagram): boolean {
  if (!dg.segments.length || !dg.angleMarks.length) return false;
  for (const s of dg.segments) if (!finitePt(s.a) || !finitePt(s.b)) return false;
  for (const m of dg.angleMarks) {
    if (!finitePt(m.vertex) || !Number.isFinite(m.dir1) || !Number.isFinite(m.value) || !(m.radius > 0)) {
      return false;
    }
  }
  return true;
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
  diagram?: Diagram; // present only for geometry-domain proofs
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
    diagram?: Diagram;
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

  // Deterministic presentation order (proof nodes in construction order, then
  // distractors). We deliberately do NOT shuffle here: keeping `data` a pure
  // function of the puzzle's structure means two structurally-identical puzzles
  // serialize identically, so the server's per-set JSON.stringify(data) dedup
  // (which re-rolls on a match) becomes effectively structural — guaranteeing a
  // 12-puzzle set has zero repeated problems. The player-facing shuffle happens
  // in the frontend (renderProofBlocks), seeded per puzzle, so the bank still
  // presents blocks in a scrambled order.
  const allBlocks = [...proofBlocks, ...distractorBlocks];

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
    selfCheck,
    diagram: meta.diagram
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

// ===== Word banks / helpers (variable-name pools drive parameter variety) =====

function coeffTerm(k: number, varName = "x"): string {
  if (k === 1) return varName;
  if (k === -1) return `-${varName}`;
  return `${k}${varName}`;
}

// Letters used to name the two numbers in a parity proof (kept disjoint from
// the witness pool so a proof never reuses a letter for two roles).
const NUMBER_VARS = ["a", "b", "c", "d", "p", "q", "r", "s"];
// Letters used for the "= 2·(witness)" integers.
const WITNESS_VARS = ["m", "n", "j", "k", "t", "u"];
// Variable a linear equation is solved for.
const ALG_VARS = ["x", "y", "n", "t", "w", "p", "k", "z", "v", "h"];
// Angle-name schemes (four labels each, in rotational order around a vertex).
const ANGLE_LABEL_SCHEMES = [
  ["∠1", "∠2", "∠3", "∠4"],
  ["∠a", "∠b", "∠c", "∠d"],
  ["∠w", "∠x", "∠y", "∠z"],
  ["∠p", "∠q", "∠r", "∠s"]
];
// Two-angle name pairs for the solve-for-x geometry proofs.
const ANGLE_PAIRS = [
  ["∠A", "∠B"],
  ["∠P", "∠Q"],
  ["∠M", "∠N"],
  ["∠1", "∠2"]
];

// ===== Domain 1: Algebraic equation solving (linear chain) =====

function genAlgebra(rng: Rng, opts: { threeStep: boolean; distractors: number }): GenResult {
  const b = new ProofBuilder();
  const varName = rng.pick(ALG_VARS);
  const skillTags = ["proof", "argument_structure", "algebra", "equations", "justification"];

  if (!opts.threeStep) {
    // a*var + c = r  ->  subtract c, divide by a
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
      promptText: buildPrompt(`${varName} = ${x}`),
      goalStatement: `${varName} = ${x}`,
      givensText: `the equation ${startEq}`,
      domain: "algebra",
      variant: "algebra-2step",
      skillTags
    });
  }

  // 3-step: k(var + p) = r  ->  distribute, subtract, divide
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
    promptText: buildPrompt(`${varName} = ${x}`),
    goalStatement: `${varName} = ${x}`,
    givensText: `the equation ${startEq}`,
    domain: "algebra",
    variant: "algebra-3step",
    skillTags
  });
}

// ===== Domain 2: Logic if-then chains (modus ponens) =====

const LOGIC_STORIES: { facts: string[]; chain: string[] }[] = [
  { facts: ["it is raining"], chain: ["the game is cancelled", "we watch a movie at home", "we make popcorn"] },
  { facts: ["the alarm rings"], chain: ["the doors lock", "the guard is alerted", "the report is filed"] },
  { facts: ["Maya finishes her homework"], chain: ["she can play outside", "she feels happy", "she sleeps well"] },
  { facts: ["the seeds get water"], chain: ["the plants grow", "the garden blooms", "the bees visit"] },
  { facts: ["the battery is charged"], chain: ["the robot turns on", "it starts cleaning", "the floor gets tidy"] },
  { facts: ["the bread is left out"], chain: ["it goes stale", "the birds are fed", "the birds return tomorrow"] },
  { facts: ["Sam scores the goal"], chain: ["the team wins", "the fans cheer", "the coach smiles"] },
  { facts: ["the river floods"], chain: ["the bridge closes", "traffic is diverted", "the trip takes longer"] },
  { facts: ["the oven is preheated"], chain: ["the cake bakes", "the kitchen smells sweet", "everyone gathers"] },
  { facts: ["the sun sets"], chain: ["the street lamps switch on", "the shops close", "the town grows quiet"] },
  { facts: ["Priya practices daily"], chain: ["she masters the song", "she joins the recital", "her family is proud"] },
  { facts: ["the volcano erupts"], chain: ["ash fills the sky", "the flights are grounded", "the tourists wait"] },
  { facts: ["the code compiles"], chain: ["the tests run", "the build passes", "the app ships"] },
  { facts: ["it snows overnight"], chain: ["school is closed", "the children sled", "the cocoa is poured"] },
  { facts: ["the tide comes in"], chain: ["the sandcastle washes away", "the beach empties", "the gulls settle"] },
  { facts: ["the magnet is switched on"], chain: ["the iron filings line up", "the pattern appears", "the class takes notes"] }
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

type ParityWord = "even" | "odd";
type ParityMode = "additive-even" | "additive-odd" | "product";

// Factored form + result parity for (v1 op v2) given the two operand parities.
function factorParity(
  w1: string,
  w2: string,
  p1: ParityWord,
  p2: ParityWord,
  op: "+" | "−"
): { factored: string; resultWord: ParityWord } {
  const same = p1 === p2;
  const resultWord: ParityWord = same ? "even" : "odd";
  let factored: string;
  if (op === "+") {
    if (p1 === "even" && p2 === "even") factored = `2(${w1} + ${w2})`;
    else if (p1 === "odd" && p2 === "odd") factored = `2(${w1} + ${w2} + 1)`;
    else factored = `2(${w1} + ${w2}) + 1`;
  } else {
    if (same) factored = `2(${w1} − ${w2})`;
    else if (p1 === "even") factored = `2(${w1} − ${w2} − 1) + 1`;
    else factored = `2(${w1} − ${w2}) + 1`;
  }
  return { factored, resultWord };
}

const PARITY_SKILLS = ["proof", "argument_structure", "number_properties", "parity", "justification"];

// Two-variable additive parity proof (7 nodes, branching: the two definition
// steps are independent). `wantEven` selects the pedagogy tier: even result
// (even±even, odd±odd) vs. odd result (even±odd, odd±even).
function genParityAdditive(rng: Rng, wantEven: boolean, distractors: number): GenResult {
  const b = new ProofBuilder();
  const [v1, v2] = rng.pickDistinct(NUMBER_VARS, 2);
  const [w1, w2] = rng.pickDistinct(WITNESS_VARS, 2);
  const op = rng.pick(["+", "−"] as ("+" | "−")[]);
  // Choose operand parities consistent with the desired result parity.
  const evenPairs: [ParityWord, ParityWord][] = [["even", "even"], ["odd", "odd"]];
  const oddPairs: [ParityWord, ParityWord][] = [["even", "odd"], ["odd", "even"]];
  const [p1, p2] = rng.pick(wantEven ? evenPairs : oddPairs);

  const e1 = p1 === "even" ? `2${w1}` : `2${w1} + 1`;
  const e2 = p2 === "even" ? `2${w2}` : `2${w2} + 1`;
  const opWord = op === "+" ? "sum" : "difference";

  b.given("ga", `${v1} is an ${p1} number.`);
  b.given("gb", `${v2} is an ${p2} number.`);
  b.step("sa", `${v1} = ${e1} for some integer ${w1}.`, `Definition of an ${p1} number.`, ["ga"]);
  b.step("sb", `${v2} = ${e2} for some integer ${w2}.`, `Definition of an ${p2} number.`, ["gb"]);
  b.step("scomb", `${v1} ${op} ${v2} = (${e1}) ${op} (${e2}).`, `Substitute the expressions for ${v1} and ${v2}.`, ["sa", "sb"]);

  const { factored, resultWord } = factorParity(w1, w2, p1, p2, op);
  const factorReason =
    resultWord === "even"
      ? "Combine like terms and factor out 2."
      : "Combine like terms and group as 2·(integer) + 1.";
  b.step("sfac", `${v1} ${op} ${v2} = ${factored}.`, factorReason, ["scomb"]);
  const goalReason =
    resultWord === "even"
      ? "Definition of even: it equals 2 times an integer."
      : "Definition of odd: it equals 2 times an integer, plus 1.";
  b.goal("goal", `${v1} ${op} ${v2} is ${resultWord}.`, goalReason, ["sfac"]);

  if (distractors >= 1) {
    // Wrong combine step: add or drop a stray +1.
    if (resultWord === "even") {
      b.distractor(`${v1} ${op} ${v2} = 2(${w1} ${op} ${w2}) + 1.`, "Arithmetic slip: an extra +1 was introduced when combining.", ["scomb"]);
    } else {
      b.distractor(`${v1} ${op} ${v2} = 2(${w1} ${op} ${w2}).`, "Substitution error: the +1 term cannot just be dropped.", ["scomb"]);
    }
  }
  if (distractors >= 2) {
    b.distractor(`${v1} · ${v2} is ${resultWord === "even" ? "odd" : "even"}.`, `Irrelevant claim about the product, not the ${opWord} being asked about.`, []);
  }

  return assemble(rng, b, {
    promptText: buildPrompt(`${v1} ${op} ${v2} is ${resultWord}`),
    goalStatement: `${v1} ${op} ${v2} is ${resultWord}.`,
    givensText: `${v1} is ${p1} and ${v2} is ${p2}`,
    domain: "number-property",
    variant: `parity-add-${p1}-${p2}-${op === "+" ? "sum" : "diff"}`,
    skillTags: PARITY_SKILLS
  });
}

// Product parity proof. product-even: an even times any integer is even
// (5 nodes, mostly linear). product-odd: odd times odd is odd (6 nodes,
// branching). `wantOdd` selects between them.
function genParityProduct(rng: Rng, wantOdd: boolean, distractors: number): GenResult {
  const b = new ProofBuilder();
  const [v1, v2] = rng.pickDistinct(NUMBER_VARS, 2);
  const [w1, w2] = rng.pickDistinct(WITNESS_VARS, 2);

  if (!wantOdd) {
    b.given("ga", `${v1} is an even number.`);
    b.given("gb", `${v2} is an integer.`);
    b.step("sa", `${v1} = 2${w1} for some integer ${w1}.`, "Definition of an even number.", ["ga"]);
    b.step("sprod", `${v1} · ${v2} = (2${w1}) · ${v2} = 2(${w1}${v2}).`, `Substitute ${v1} = 2${w1} and factor out 2.`, ["sa", "gb"]);
    b.goal("goal", `${v1} · ${v2} is even.`, `Definition of even: it equals 2 times an integer (here, ${w1}${v2}).`, ["sprod"]);

    if (distractors >= 1) {
      b.distractor(`${v1} · ${v2} = 2${w1} + ${v2}.`, `Algebra error: (2${w1})·${v2} is 2${w1}${v2}, not 2${w1} + ${v2}.`, ["sa", "gb"]);
    }
    if (distractors >= 2) {
      b.distractor(`${v2} is even.`, `Unsupported: ${v2} was only assumed to be an integer, not even.`, ["gb"]);
    }

    return assemble(rng, b, {
      promptText: buildPrompt(`${v1} · ${v2} is even`),
      goalStatement: `${v1} · ${v2} is even.`,
      givensText: `${v1} is even and ${v2} is any integer`,
      domain: "number-property",
      variant: "parity-product-even",
      skillTags: PARITY_SKILLS
    });
  }

  // odd × odd is odd
  b.given("ga", `${v1} is an odd number.`);
  b.given("gb", `${v2} is an odd number.`);
  b.step("sa", `${v1} = 2${w1} + 1 for some integer ${w1}.`, "Definition of an odd number.", ["ga"]);
  b.step("sb", `${v2} = 2${w2} + 1 for some integer ${w2}.`, "Definition of an odd number.", ["gb"]);
  b.step("sprod", `${v1} · ${v2} = (2${w1} + 1)(2${w2} + 1) = 4${w1}${w2} + 2${w1} + 2${w2} + 1.`, `Substitute and expand the product.`, ["sa", "sb"]);
  b.step("sfac", `${v1} · ${v2} = 2(2${w1}${w2} + ${w1} + ${w2}) + 1.`, "Factor 2 out of every term except the +1.", ["sprod"]);
  b.goal("goal", `${v1} · ${v2} is odd.`, "Definition of odd: it equals 2 times an integer, plus 1.", ["sfac"]);

  if (distractors >= 1) {
    b.distractor(`${v1} · ${v2} is even.`, "Wrong: an odd number times an odd number is odd, not even.", ["sfac"]);
  }
  if (distractors >= 2) {
    b.distractor(`${v1} · ${v2} = 4${w1}${w2} + 1.`, `Dropped the 2${w1} + 2${w2} middle terms when expanding.`, ["sprod"]);
  }

  return assemble(rng, b, {
    promptText: buildPrompt(`${v1} · ${v2} is odd`),
    goalStatement: `${v1} · ${v2} is odd.`,
    givensText: `${v1} is odd and ${v2} is odd`,
    domain: "number-property",
    variant: "parity-product-odd",
    skillTags: PARITY_SKILLS
  });
}

function genParity(rng: Rng, opts: { mode: ParityMode; distractors: number }): GenResult {
  if (opts.mode === "additive-even") return genParityAdditive(rng, true, opts.distractors);
  if (opts.mode === "additive-odd") return genParityAdditive(rng, false, opts.distractors);
  // product: mix even and odd product proofs for variety.
  return genParityProduct(rng, rng.pick([true, false]), opts.distractors);
}

// ===== Domain 4: Geometry angle proofs (with a rendered diagram) =====

const GEO_SKILLS = ["proof", "argument_structure", "geometry", "angles", "justification"];

// Build the diagram for a two-crossing-lines configuration. `da` is the acute
// crossing angle; the four regions in rotational order from the +x axis are
// [da, 180−da, da, 180−da], so opposite regions are genuinely equal (vertical
// angles) — consistent with the proof. `labels` names them in that order;
// `givenIdx`/`targetIdx` pick which arcs are highlighted.
function crossingDiagram(
  da: number,
  labels: string[],
  givenIdx: number,
  targetIdx: number
): Diagram {
  const V: Pt = { x: 220, y: 150 };
  const halfLen = 140;
  const dirs = [0, da, 180, normDeg(180 + da)];
  const values = [da, 180 - da, da, 180 - da];
  const segments: Seg[] = [fullLine(V, 0, halfLen), fullLine(V, da, halfLen)];
  const angleMarks: AngleMark[] = values.map((v, i) => ({
    vertex: V,
    dir1: dirs[i],
    value: v,
    label: labels[i],
    isTarget: i === targetIdx,
    isGiven: i === givenIdx,
    radius: 34
  }));
  return { width: 440, height: 300, segments, angleMarks };
}

// Vertical-angles proof. Two lines cross; opposite ("vertical") angles A and C
// are proven equal. `measured` mode gives A a numeric measure and derives C's.
function genGeometryVertical(rng: Rng, distractors: number): GenResult {
  const b = new ProofBuilder();
  const schemeIdx = rng.int(0, ANGLE_LABEL_SCHEMES.length - 1);
  const scheme = ANGLE_LABEL_SCHEMES[schemeIdx];
  const i0 = rng.pick([0, 1]); // 0 -> prove L0=L2 (middle L1); 1 -> prove L1=L3 (middle L2)
  const A = scheme[i0];
  const B = scheme[(i0 + 1) % 4];
  const C = scheme[(i0 + 2) % 4];
  const measured = rng.pick([true, false]);

  // Diagram crossing angle. For measured mode it equals A's measure so the
  // figure is literally to scale. For abstract mode it is derived
  // deterministically from the (structural) scheme/pair choice rather than
  // rolled independently, so structurally-identical puzzles serialize
  // identically (see the dedup note in assemble()).
  let m = 0;
  let da: number;
  if (measured) {
    m = rng.int(25, 155);
    if (m === 90) m = 91;
    // A is region i0. Region 0 has value da; region 1 has value 180−da. Choose
    // da so that A's drawn value equals m, keeping the figure to scale.
    da = i0 === 0 ? m : 180 - m;
  } else {
    da = 42 + i0 * 9 + schemeIdx * 3; // deterministic acute angle in [42, 72]
  }

  b.given("g1", `${A} and ${B} form a linear pair (their outer sides lie on a straight line).`);
  b.given("g2", `${B} and ${C} form a linear pair (their outer sides lie on a straight line).`);

  if (measured) {
    b.given("g3", `${A} = ${m}°.`);
    b.step("s1", `${A} + ${B} = 180°.`, "Linear Pair Postulate (angles on a line sum to 180°).", ["g1"]);
    b.step("s2", `${B} = ${180 - m}°.`, `Substitute ${A} = ${m}° into ${A} + ${B} = 180° and subtract.`, ["s1", "g3"]);
    b.step("s3", `${B} + ${C} = 180°.`, "Linear Pair Postulate (angles on a line sum to 180°).", ["g2"]);
    b.goal("goal", `${C} = ${m}°.`, `Substitute ${B} = ${180 - m}° into ${B} + ${C} = 180° and subtract.`, ["s3", "s2"]);

    if (distractors >= 1) {
      b.distractor(`${A} + ${C} = 180°.`, `Wrong pairing: ${A} and ${C} are vertical angles, not a linear pair.`, ["g1"]);
    }
    if (distractors >= 2) {
      b.distractor(`${C} = ${180 - m}°.`, `Confused the vertical angle with its supplement.`, ["s2"]);
    }
  } else {
    b.step("s1", `${A} + ${B} = 180°.`, "Linear Pair Postulate (angles on a line sum to 180°).", ["g1"]);
    b.step("s2", `${B} + ${C} = 180°.`, "Linear Pair Postulate (angles on a line sum to 180°).", ["g2"]);
    b.step("s3", `${A} + ${B} = ${B} + ${C}.`, "Both sums equal 180°, so set them equal (substitution).", ["s1", "s2"]);
    b.goal("goal", `${A} = ${C}.`, `Subtract ${B} from both sides.`, ["s3"]);

    if (distractors >= 1) {
      b.distractor(`${A} + ${C} = 180°.`, `Wrong pairing: ${A} and ${C} are vertical angles, not a linear pair.`, ["g1"]);
    }
    if (distractors >= 2) {
      b.distractor(`${A} = ${B}.`, "Adjacent angles in a linear pair are supplementary, not necessarily equal.", ["s1"]);
    }
  }

  const givenIdx = i0; // A's region
  const targetIdx = (i0 + 2) % 4; // C's region
  const diagram = crossingDiagram(da, scheme, givenIdx, targetIdx);

  const goalStatement = measured ? `${C} = ${m}°.` : `${A} = ${C}.`;
  const givensText = measured
    ? `two lines crossing so that ${A}=${m}°, with ${A}–${B} and ${B}–${C} forming linear pairs`
    : `two lines crossing so that ${A}–${B} and ${B}–${C} are linear pairs`;

  const arithmeticOk = !measured || (m > 0 && m < 180 && m !== 90 && 180 - m > 0);
  const geomOk = Math.abs((da + (180 - da) + da + (180 - da)) - 360) < 1e-9 && diagramFinite(diagram);

  const result = assemble(rng, b, {
    promptText: buildPrompt(goalStatement, true),
    goalStatement,
    givensText,
    domain: "geometry",
    variant: measured ? "geometry-vertical-measured" : "geometry-vertical",
    skillTags: GEO_SKILLS,
    diagram
  });
  return { ...result, selfCheck: result.selfCheck && arithmeticOk && geomOk };
}

// Solve-for-x with a complementary/supplementary angle pair, plus a diagram of
// the two adjacent angles.
function genGeometrySolveX(rng: Rng, complementary: boolean, distractors: number): GenResult {
  const b = new ProofBuilder();
  const total = complementary ? 90 : 180;
  const rel = complementary ? "complementary" : "supplementary";
  const relSum = complementary ? "90°" : "180°";
  const [nA, nB] = rng.pick(ANGLE_PAIRS);
  const coeff = rng.int(2, 4);
  const maxX = Math.floor((total - 10) / coeff);
  const xVal = rng.int(2, Math.max(2, maxX));
  const realA = coeff * xVal;
  const known = total - realA;

  b.given("g1", `${nA} and ${nB} are ${rel} angles.`);
  b.given("g2", `${nA} = ${coeffTerm(coeff, "x")}°.`);
  b.given("g3", `${nB} = ${known}°.`);
  b.step("s1", `${nA} + ${nB} = ${relSum}.`, `Definition of ${rel} angles.`, ["g1"]);
  b.step("s2", `${coeffTerm(coeff, "x")} + ${known} = ${total}.`, "Substitute the given angle measures.", ["s1", "g2", "g3"]);
  b.step("s3", `${coeffTerm(coeff, "x")} = ${total - known}.`, `Subtract ${known} from both sides.`, ["s2"]);
  b.goal("goal", `x = ${xVal}.`, `Divide both sides by ${coeff}.`, ["s3"]);

  if (distractors >= 1) {
    b.distractor(`${coeffTerm(coeff, "x")} = ${total + known}.`, `Add ${known} to both sides.`, ["s2"]);
  }
  if (distractors >= 2) {
    b.distractor(`${nA} + ${nB} = ${complementary ? "180°" : "90°"}.`, `Mixed up ${rel} with the other relationship.`, ["g1"]);
  }

  // Diagram: two adjacent angles at V. Supplementary -> a straight line split
  // by one ray; complementary -> a right angle split by one ray.
  const V: Pt = { x: 210, y: 205 };
  const halfLen = 150;
  const segments: Seg[] = complementary
    ? [
        { a: V, b: dirPoint(V, 0, halfLen) },
        { a: V, b: dirPoint(V, 90, halfLen) },
        { a: V, b: dirPoint(V, realA, halfLen) }
      ]
    : [fullLine(V, 0, halfLen), { a: V, b: dirPoint(V, realA, halfLen) }];
  const angleMarks: AngleMark[] = [
    { vertex: V, dir1: 0, value: realA, label: `${coeffTerm(coeff, "x")}°`, isTarget: true, isGiven: false, radius: 40 },
    { vertex: V, dir1: realA, value: known, label: `${known}°`, isTarget: false, isGiven: true, radius: 40 }
  ];
  const diagram: Diagram = { width: 420, height: 260, segments, angleMarks };

  const arithmeticOk =
    Number.isInteger(xVal) && xVal > 0 && known > 0 && known < total && realA > 0 && realA < total;
  const geomOk = diagramFinite(diagram);

  const result = assemble(rng, b, {
    promptText: buildPrompt(`x = ${xVal}`, true),
    goalStatement: `x = ${xVal}.`,
    givensText: `${nA} and ${nB} are ${rel}, with ${nA} = ${coeffTerm(coeff, "x")}° and ${nB} = ${known}°`,
    domain: "geometry",
    variant: `geometry-${complementary ? "complement" : "supplement"}-x`,
    skillTags: GEO_SKILLS,
    diagram
  });
  return { ...result, selfCheck: result.selfCheck && arithmeticOk && geomOk };
}

function genGeometry(rng: Rng, opts: { family: "vertical" | "solve-x"; distractors: number }): GenResult {
  if (opts.family === "vertical") return genGeometryVertical(rng, opts.distractors);
  return genGeometrySolveX(rng, rng.pick([true, false]), opts.distractors);
}

function buildPrompt(goal: string, withFigure = false): string {
  const figure = withFigure
    ? " Use the figure above to see how the angles are arranged."
    : "";
  return `Assemble a valid proof of: ${goal}. Click the statement blocks in the correct order — start from the givens and add each statement only once every statement its justification depends on is already in your proof. Leave out any block whose reasoning does not actually follow.${figure}`;
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
        : genParity(rng, { mode: "additive-even", distractors: 1 });
    case 4:
      return branch === 0
        ? genParity(rng, { mode: "additive-odd", distractors: 2 })
        : genGeometry(rng, { family: "vertical", distractors: 1 });
    case 5:
      return branch === 0
        ? genGeometry(rng, { family: "solve-x", distractors: 2 })
        : genParity(rng, { mode: "product", distractors: 2 });
    default:
      return branch === 0
        ? genGeometry(rng, { family: "vertical", distractors: 2 })
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
        selfCheck: result.selfCheck,
        // Geometry-domain proofs carry a figure; other domains omit it.
        ...(result.diagram ? { diagram: result.diagram } : {})
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

    // Geometry proofs must carry a well-formed diagram; other domains must not.
    const diagram = candidate.data.diagram as Diagram | undefined;
    if (candidate.data.domain === "geometry") {
      if (!diagram || !diagramFinite(diagram)) {
        issues.push({ code: "bad_diagram", message: "Geometry proof is missing a valid diagram." });
      }
    } else if (diagram) {
      issues.push({ code: "unexpected_diagram", message: "Non-geometry proof should not carry a diagram." });
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
