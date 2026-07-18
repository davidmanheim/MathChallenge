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
    this.s = (seed ^ 0x2f1a9c3b) >>> 0;
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
}

// ===== Combinatorics helpers =====

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function permute(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return Math.round(permute(n, k) / factorial(k));
}

function pickNames(rng: Rng, pool: string[], count: number): string[] {
  const copy = [...pool];
  const n = Math.min(count, copy.length);
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = rng.int(0, copy.length - 1);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

function listJoin(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// ===== Word banks =====

const POOL_NAMES = [
  "Ana", "Ben", "Cara", "Deo", "Ella", "Finn", "Gia", "Hugo",
  "Ivy", "Jax", "Kira", "Leo", "Mila", "Noah", "Omar", "Pia"
];
const POOL_BOOKS = [
  "The Lighthouse Mystery", "Dragons of Coral Bay", "Race to the Summit",
  "The Clockwork Fox", "Wanderer's Atlas", "Secrets of the Attic",
  "Comet Chasers", "The Last Cartographer"
];
const POOL_COLORS = [
  "red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"
];
const POOL_SOUPS = ["Tomato", "Chicken Noodle", "Miso", "Lentil", "Corn Chowder", "Broccoli Cheddar"];
const POOL_SANDWICHES = ["Turkey", "Veggie", "Ham & Cheese", "Grilled Cheese", "BLT", "Egg Salad"];
const POOL_DESSERTS = ["Cookie", "Brownie", "Fruit Cup", "Pudding", "Cupcake", "Jello"];
const POOL_SHIRTS = ["red", "blue", "green", "yellow", "striped", "plaid"];
const POOL_PANTS = ["jeans", "khakis", "shorts", "sweatpants", "cargo pants", "leggings"];
const POOL_SHOES = ["sneakers", "sandals", "boots", "loafers", "flip-flops", "rain boots"];
const POOL_FLAVORS = ["vanilla", "chocolate", "strawberry", "mint", "cookie dough", "mango"];
const POOL_TOPPINGS = ["sprinkles", "nuts", "cherries", "cookie crumbles", "mini marshmallows", "coconut"];
const POOL_SAUCES = ["chocolate", "caramel", "strawberry", "butterscotch", "hot fudge", "marshmallow"];
const ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H"];
const OFFICER_ROLES = ["President", "Vice President", "Secretary", "Treasurer"];

const MULTIPLICATION_THEMES: { noun: string; labels: string[]; pools: string[][] }[] = [
  { noun: "lunch combo", labels: ["soup", "sandwich", "dessert"], pools: [POOL_SOUPS, POOL_SANDWICHES, POOL_DESSERTS] },
  { noun: "outfit", labels: ["shirt color", "pants style", "shoe type"], pools: [POOL_SHIRTS, POOL_PANTS, POOL_SHOES] },
  { noun: "ice cream sundae", labels: ["flavor", "topping", "sauce"], pools: [POOL_FLAVORS, POOL_TOPPINGS, POOL_SAUCES] }
];

const PERMUTATION_FULL_THEMES: { noun: "books" | "friends"; pool: string[] }[] = [
  { noun: "books", pool: POOL_BOOKS },
  { noun: "friends", pool: POOL_NAMES }
];

// ===== Diagram + chain shapes =====

type SlotSpec = { label: string; count: number };
type ChainDiagram = { kind: "chain"; slots: SlotSpec[]; divideBy?: number; result: number };
type CaseSpec = { label: string; slots: SlotSpec[]; value: number };
type CasesDiagram = { kind: "cases"; cases: CaseSpec[]; result: number };
type PigeonholeDiagram = {
  kind: "pigeonhole";
  categories: number;
  guaranteeCount: number;
  pullCount: number;
  result: number;
};
type Diagram = ChainDiagram | CasesDiagram | PigeonholeDiagram;

type ChainStep = { principle: string; text: string; resultValue: number };

type Kind =
  | "multiplication"
  | "permutation-full"
  | "permutation-partial"
  | "combination"
  | "restricted"
  | "casework"
  | "pigeonhole";

type GenResult = {
  promptText: string;
  diagram: Diagram;
  answer: number;
  chain: ChainStep[];
  skillTags: string[];
  variant: string;
  kind: Kind;
  selfCheck: boolean;
};

function buildMultiplicationPrompt(noun: string, labels: string[], itemLists: string[][]): string {
  const clauses = labels.map((label, i) => `one ${label} (choices: ${listJoin(itemLists[i])})`);
  return `You're putting together a ${noun}: pick ${clauses.join(", then ")}. How many different ${noun}s are possible?`;
}

// ===== Template 1: Multiplication counting principle (independent slots) =====

function genMultiplication(rng: Rng, slotCount: 2 | 3, maxCount: number): GenResult {
  const theme = rng.pick(MULTIPLICATION_THEMES);
  const labels = theme.labels.slice(0, slotCount);
  const pools = theme.pools.slice(0, slotCount);
  const counts = labels.map((_, i) => rng.int(2, Math.min(maxCount, pools[i].length)));
  const itemLists = pools.map((pool, i) => pickNames(rng, pool, counts[i]));
  const answer = counts.reduce((p, c) => p * c, 1);

  let prodCheck = 1;
  for (const c of counts) prodCheck *= c;

  const chain: ChainStep[] = [
    {
      principle: "Multiplication Counting Principle",
      text: `Each choice is made independently of the others, so multiply the number of options at each step: ${counts.join(" × ")} = ${answer}.`,
      resultValue: answer
    }
  ];

  return {
    promptText: buildMultiplicationPrompt(theme.noun, labels, itemLists),
    diagram: { kind: "chain", slots: labels.map((label, i) => ({ label, count: counts[i] })), result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "counting_principle", "multiplication_principle"],
    variant: `multiplication-${slotCount}-${maxCount}`,
    kind: "multiplication",
    selfCheck: prodCheck === answer
  };
}

// ===== Template 2: Full permutation (arrange all N distinct items) =====

function genPermutationFull(rng: Rng): GenResult {
  const N = rng.int(3, 6);
  const theme = rng.pick(PERMUTATION_FULL_THEMES);
  const items = pickNames(rng, theme.pool, N);
  const answer = factorial(N);
  const descList = listJoin(items);

  const promptText =
    theme.noun === "books"
      ? `You have ${N} different books: ${descList}. How many different orders can you arrange all ${N} of them on a shelf?`
      : `${descList} — ${N} friends — want to line up in a single row for a photo. How many different lineups (orders) are possible?`;

  const factorParts = Array.from({ length: N }, (_, i) => N - i);
  const chain: ChainStep[] = [
    {
      principle: "Permutation (arrange all items)",
      text: `All ${N} items are different and every one gets used, so this is a permutation of all of them: ${factorParts.join(" × ")} = ${N}! = ${answer}.`,
      resultValue: answer
    }
  ];

  return {
    promptText,
    diagram: {
      kind: "chain",
      slots: factorParts.map((c, i) => ({ label: `position ${i + 1}`, count: c })),
      result: answer
    },
    answer,
    chain,
    skillTags: ["combinatorics", "permutations", "factorial"],
    variant: `permutation-full-${N}`,
    kind: "permutation-full",
    selfCheck: factorial(N) === answer
  };
}

// ===== Template 3: Partial permutation (choose and arrange K of N) =====

function genPermutationPartial(rng: Rng): GenResult {
  const N = rng.int(4, 8);
  const K = rng.int(2, Math.min(4, N - 1));
  const members = pickNames(rng, POOL_NAMES, N);
  const roles = OFFICER_ROLES.slice(0, K);
  const answer = permute(N, K);

  const promptText = `A club has ${N} members: ${listJoin(members)}. They need to elect ${K} different officers — ${listJoin(roles)} — and no member can hold more than one role. How many different ways can these roles be filled?`;

  const factorParts = Array.from({ length: K }, (_, i) => N - i);
  const chain: ChainStep[] = [
    {
      principle: "Permutation (choose and arrange)",
      text: `Each role is different, so order matters, and once someone fills a role they're no longer available for the next one: ${factorParts.join(" × ")} = ${answer}.`,
      resultValue: answer
    }
  ];

  return {
    promptText,
    diagram: {
      kind: "chain",
      slots: roles.map((r, i) => ({ label: r, count: factorParts[i] })),
      result: answer
    },
    answer,
    chain,
    skillTags: ["combinatorics", "permutations", "counting_principle"],
    variant: `permutation-partial-${N}-${K}`,
    kind: "permutation-partial",
    selfCheck: permute(N, K) === answer
  };
}

// ===== Template 4: Counting principle with a no-repeat restriction =====

const CODE_OPTIONS: { A: number; L: number; D: number }[] = [
  { A: 4, L: 2, D: 2 },
  { A: 4, L: 3, D: 1 },
  { A: 5, L: 2, D: 2 },
  { A: 5, L: 3, D: 1 },
  { A: 6, L: 2, D: 1 },
  { A: 6, L: 2, D: 2 }
];

function genRestrictedNoRepeat(rng: Rng): GenResult {
  const { A, L, D } = rng.pick(CODE_OPTIONS);
  const letters = ALPHABET.slice(0, A);
  const letterCounts = Array.from({ length: L }, (_, i) => A - i);
  const letterPart = permute(A, L);
  const digitPart = Math.pow(10, D);
  const answer = letterPart * digitPart;

  const promptText = `A security code uses ${L} different letters (no repeats) chosen from {${letters.join(", ")}}, followed by ${D} digit${D > 1 ? "s" : ""} from 0-9 (digits may repeat). How many different codes are possible?`;

  const chain: ChainStep[] = [
    {
      principle: "Counting principle with a no-repeat restriction",
      text: `The letters can't repeat, so the pool shrinks by one each time you pick: ${letterCounts.join(" × ")} = ${letterPart}.`,
      resultValue: letterPart
    },
    {
      principle: "Multiplication Counting Principle",
      text: `The digit${D > 1 ? "s are" : " is"} chosen independently and may repeat, so ${D > 1 ? `each of the ${D} digit slots` : "the digit slot"} has 10 choices: ${Array.from({ length: D }, () => 10).join(" × ")} = ${digitPart}. Multiply the two independent parts together: ${letterPart} × ${digitPart} = ${answer}.`,
      resultValue: answer
    }
  ];

  const slots: SlotSpec[] = [
    ...letterCounts.map((c, i) => ({ label: `letter ${i + 1}`, count: c })),
    ...Array.from({ length: D }, (_, i) => ({ label: `digit ${i + 1}`, count: 10 }))
  ];

  return {
    promptText,
    diagram: { kind: "chain", slots, result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "counting_principle", "no_repeat", "multiplication_principle"],
    variant: `restricted-code-${A}-${L}-${D}`,
    kind: "restricted",
    selfCheck: letterPart * digitPart === answer
  };
}

// ===== Template 5: Combination (choose K of N, order doesn't matter) =====

function genCombination(rng: Rng, hard: boolean): GenResult {
  const N = hard ? rng.int(6, 10) : rng.int(5, 8);
  const K = hard ? rng.int(2, Math.min(5, N - 1)) : rng.int(2, Math.min(4, N - 1));
  const members = pickNames(rng, POOL_NAMES, N);
  const orderedSlots = Array.from({ length: K }, (_, i) => N - i);
  const orderedCount = orderedSlots.reduce((p, c) => p * c, 1);
  const kFact = factorial(K);
  const answer = Math.round(orderedCount / kFact);

  const promptText = `A club has ${N} members: ${listJoin(members)}. They want to choose a committee of ${K} people — there are no different roles, everyone on the committee has equal say. How many different committees of ${K} are possible?`;

  const chain: ChainStep[] = [
    {
      principle: "Ordered count (as if order mattered)",
      text: `First imagine order did matter: the number of ways to pick and arrange ${K} of the ${N} members in order is ${orderedSlots.join(" × ")} = ${orderedCount}.`,
      resultValue: orderedCount
    },
    {
      principle: "Combination (remove the overcounting)",
      text: `But committee order doesn't matter — each group of ${K} people got counted ${K}! = ${kFact} times in that ordered count (once for every order they could've been picked in). Divide to correct: ${orderedCount} ÷ ${kFact} = ${answer}.`,
      resultValue: answer
    }
  ];

  return {
    promptText,
    diagram: {
      kind: "chain",
      slots: orderedSlots.map((c, i) => ({ label: `pick ${i + 1}`, count: c })),
      divideBy: kFact,
      result: answer
    },
    answer,
    chain,
    skillTags: ["combinatorics", "combinations", "counting_principle"],
    variant: `combination-${N}-${K}${hard ? "-hard" : ""}`,
    kind: "combination",
    selfCheck: choose(N, K) === answer
  };
}

// ===== Template 6: Restricted combination (must include a specific item) =====

function genMustInclude(rng: Rng): GenResult {
  const N = rng.int(5, 9);
  const K = rng.int(2, Math.min(4, N - 1));
  const members = pickNames(rng, POOL_NAMES, N);
  const fixed = members[0];
  const remainingPool = N - 1;
  const remainingChoose = K - 1;

  const remainingSlots = Array.from({ length: remainingChoose }, (_, i) => remainingPool - i);
  const orderedRemaining = remainingSlots.reduce((p, c) => p * c, 1);
  const kFact = factorial(remainingChoose);
  const answer = Math.round(orderedRemaining / kFact);

  const promptText = `A team has ${N} players: ${listJoin(members)}. ${fixed} must always be on the roster. They need a game-day roster of ${K} players total (including ${fixed}). How many different rosters are possible?`;

  const step2Text =
    remainingChoose === 1
      ? `Order doesn't matter, but with only one spot left it doesn't change anything: choose 1 from ${remainingPool} = ${answer}.`
      : `Order doesn't matter for who fills the remaining spots. Ordered count: ${remainingSlots.join(" × ")} = ${orderedRemaining}. Divide by ${remainingChoose}! = ${kFact} to remove the ordering: ${orderedRemaining} ÷ ${kFact} = ${answer}.`;

  const chain: ChainStep[] = [
    {
      principle: "Apply the restriction first",
      text: `${fixed}'s spot is already decided, so you only need to choose the other ${remainingChoose} spot${remainingChoose === 1 ? "" : "s"} from the remaining ${remainingPool} players.`,
      resultValue: remainingChoose
    },
    {
      principle: "Combination on the rest",
      text: step2Text,
      resultValue: answer
    }
  ];

  const slots: SlotSpec[] = [
    { label: `${fixed} (fixed)`, count: 1 },
    ...remainingSlots.map((c, i) => ({ label: `remaining pick ${i + 1}`, count: c }))
  ];

  return {
    promptText,
    diagram: { kind: "chain", slots, divideBy: kFact, result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "combinations", "must_include", "counting_principle"],
    variant: `must-include-${N}-${K}`,
    kind: "restricted",
    selfCheck: choose(N - 1, K - 1) === answer
  };
}

// ===== Template 7: Restricted permutation (a specific pair must be adjacent) =====

function genAdjacentPair(rng: Rng): GenResult {
  const N = rng.int(4, 6);
  const friends = pickNames(rng, POOL_NAMES, N);
  const nameA = friends[0];
  const nameB = friends[1];
  const blockCount = factorial(N - 1);
  const answer = 2 * blockCount;

  const promptText = `${listJoin(friends)} — ${N} friends — are lining up in a single row for a photo. ${nameA} and ${nameB} insist on standing right next to each other. How many different lineups satisfy that?`;

  const blockSlots = Array.from({ length: N - 1 }, (_, i) => N - 1 - i);
  const chain: ChainStep[] = [
    {
      principle: "Treat the pair as one block",
      text: `Since ${nameA} and ${nameB} must stand together, glue them into a single block. Now you're arranging ${N - 1} things in a row (the block counts as one item): ${blockSlots.join(" × ")} = ${blockCount}.`,
      resultValue: blockCount
    },
    {
      principle: "Count the orders inside the block",
      text: `Inside the block, ${nameA} and ${nameB} can stand in 2 different orders (${nameA}-${nameB} or ${nameB}-${nameA}). Multiply: ${blockCount} × 2 = ${answer}.`,
      resultValue: answer
    }
  ];

  const slots: SlotSpec[] = [
    ...blockSlots.map((c, i) => ({ label: `block slot ${i + 1}`, count: c })),
    { label: "order within pair", count: 2 }
  ];

  return {
    promptText,
    diagram: { kind: "chain", slots, result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "permutations", "adjacency_restriction", "counting_principle"],
    variant: `adjacent-pair-${N}`,
    kind: "restricted",
    selfCheck: 2 * factorial(N - 1) === answer
  };
}

// ===== Template 8: Casework (sum of disjoint cases) =====

function genCasework(rng: Rng): GenResult {
  const K = rng.pick([2, 3]) as 2 | 3;
  const G = rng.int(K, K + 3);
  const B = rng.int(1, 4);

  const case1GirlsChosen = K - 1;
  const case1GirlsWays = choose(G, case1GirlsChosen);
  const case1 = case1GirlsWays * B;
  const case2 = choose(G, K);
  const answer = case1 + case2;

  const promptText = `A gym class has ${B} boy${B === 1 ? "" : "s"} and ${G} girl${G === 1 ? "" : "s"} available for a project team. They need to form a team of ${K} students with at least ${case1GirlsChosen} girl${case1GirlsChosen === 1 ? "" : "s"} on it. How many different teams are possible?`;

  const chain: ChainStep[] = [
    {
      principle: "Case 1",
      text: `Case 1: exactly ${case1GirlsChosen} girl${case1GirlsChosen === 1 ? "" : "s"} and 1 boy. Choose ${case1GirlsChosen} girl${case1GirlsChosen === 1 ? "" : "s"} from ${G}: C(${G},${case1GirlsChosen}) = ${case1GirlsWays}. Choose 1 boy from ${B}: ${B}. Multiply: ${case1GirlsWays} × ${B} = ${case1}.`,
      resultValue: case1
    },
    {
      principle: "Case 2",
      text: `Case 2: all ${K} girls and 0 boys. Choose ${K} girls from ${G}: C(${G},${K}) = ${case2}.`,
      resultValue: case2
    },
    {
      principle: "Casework (sum the disjoint cases)",
      text: `A team can't be in both cases at once (it has either exactly ${case1GirlsChosen} girl${case1GirlsChosen === 1 ? "" : "s"} or exactly ${K} girls, not both), so add the cases: ${case1} + ${case2} = ${answer}.`,
      resultValue: answer
    }
  ];

  // Independent cross-check via complementary counting: total teams minus
  // teams with fewer than (K-1) girls should equal the direct casework sum.
  const total = choose(B + G, K);
  let tooFew = 0;
  for (let j = 0; j <= K - 2; j++) {
    tooFew += choose(G, j) * choose(B, K - j);
  }
  const crossCheck = total - tooFew;

  const diagram: CasesDiagram = {
    kind: "cases",
    cases: [
      {
        label: `Case 1: ${case1GirlsChosen} girl${case1GirlsChosen === 1 ? "" : "s"} + 1 boy`,
        slots: [
          { label: "girls", count: case1GirlsWays },
          { label: "boys", count: B }
        ],
        value: case1
      },
      {
        label: `Case 2: ${K} girls`,
        slots: [{ label: "girls", count: case2 }],
        value: case2
      }
    ],
    result: answer
  };

  return {
    promptText,
    diagram,
    answer,
    chain,
    skillTags: ["combinatorics", "casework", "combinations", "counting_principle"],
    variant: `casework-${B}-${G}-${K}`,
    kind: "casework",
    selfCheck: case1 + case2 === answer && crossCheck === answer
  };
}

// ===== Template 9: Pigeonhole principle (intro flavor) =====

function genPigeonhole(rng: Rng): GenResult {
  const C = rng.int(3, 6);
  const M = rng.pick([2, 3]) as 2 | 3;
  const worstCase = (M - 1) * C;
  const answer = worstCase + 1;
  const colors = pickNames(rng, POOL_COLORS, C);

  const promptText = `A drawer has plenty of socks in ${C} different colors: ${listJoin(colors)}. Pulling socks out one at a time without looking, what is the smallest number of socks you must pull to guarantee that at least ${M} of them are the same color?`;

  const chain: ChainStep[] = [
    {
      principle: "Consider the worst case",
      text: `Imagine the worst possible luck: you could pull ${M - 1} sock${M - 1 === 1 ? "" : "s"} of every one of the ${C} colors before being forced into a match of ${M}. That's ${M - 1} × ${C} = ${worstCase} socks with no color yet reaching ${M}.`,
      resultValue: worstCase
    },
    {
      principle: "Pigeonhole Principle",
      text: `The very next sock (number ${worstCase + 1}) must match one of the colors you already have ${M - 1} of, giving you ${M} of that color. So you need ${answer} socks to guarantee it.`,
      resultValue: answer
    }
  ];

  const diagram: PigeonholeDiagram = {
    kind: "pigeonhole",
    categories: C,
    guaranteeCount: M,
    pullCount: answer,
    result: answer
  };

  return {
    promptText,
    diagram,
    answer,
    chain,
    skillTags: ["combinatorics", "pigeonhole_principle"],
    variant: `pigeonhole-${C}-${M}`,
    kind: "pigeonhole",
    selfCheck: worstCase + 1 === answer
  };
}

// ===== Difficulty dispatch =====

function generatePuzzleData(rng: Rng, difficulty: number): GenResult {
  const d = Math.max(1, Math.min(6, Math.round(difficulty)));
  const branch = rng.int(0, 1);
  switch (d) {
    case 1:
      return branch === 0 ? genMultiplication(rng, 2, 4) : genMultiplication(rng, 3, 3);
    case 2:
      return branch === 0 ? genPermutationFull(rng) : genMultiplication(rng, 3, 5);
    case 3:
      return branch === 0 ? genRestrictedNoRepeat(rng) : genPermutationPartial(rng);
    case 4:
      return branch === 0 ? genCombination(rng, false) : genMustInclude(rng);
    case 5:
      return branch === 0 ? genAdjacentPair(rng) : genCombination(rng, true);
    default:
      return branch === 0 ? genCasework(rng) : genPigeonhole(rng);
  }
}

// ===== Hint ladder =====

function hint1ForKind(kind: Kind): string {
  switch (kind) {
    case "multiplication":
      return "Are the choices at each step made independently of each other, with no restriction linking them? If so, what operation combines the counts?";
    case "permutation-full":
      return "Does the order you place these items in matter? (Swapping two of them gives a different result.) That's a sign this is a permutation of all the items, not a combination.";
    case "permutation-partial":
      return "Does it matter which item ends up in which specific role or position? If yes, order matters — this is a permutation, and not every item gets used.";
    case "combination":
      return "Does the order you pick these in matter? If picking A then B ends up the same as picking B then A, this is a combination, not a permutation.";
    case "restricted":
      return "Look for a restriction in the wording (something that must happen, must be included, can't repeat, or must stay together). How does that restriction change how many choices are available at each step?";
    case "casework":
      return "Can you split this scenario into a few cases that can't both happen at once? What are they, and how do you combine the counts from each case?";
    case "pigeonhole":
      return "Think about the worst possible luck — how many items could you have and still not be guaranteed what you're looking for? What happens on the very next one?";
    default:
      return "What counting principle applies here — are you multiplying independent choices, arranging things in order, or picking a group where order doesn't matter?";
  }
}

function buildHintsFromChain(kind: Kind, chain: ChainStep[], answer: number): string[] {
  if (chain.length === 0) {
    return ["Think about whether order matters here.", "Apply the counting principle step by step.", `Answer: ${answer}`];
  }
  const hint1 = hint1ForKind(kind);
  const hint2 =
    chain.length === 1
      ? chain[0].text
      : chain
          .slice(0, chain.length - 1)
          .map((c) => c.text)
          .join(" ");
  const hint3 =
    chain.length === 1
      ? `So the total count = ${answer}.`
      : `${chain[chain.length - 1].text} So the total count = ${answer}.`;
  return [hint1, hint2, hint3];
}

// ===== Structural validation helpers =====

function isPosInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function slotsProduct(slots: SlotSpec[]): number | null {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  let p = 1;
  for (const s of slots) {
    if (!s || typeof s.count !== "number" || !Number.isInteger(s.count) || s.count <= 0) return null;
    p *= s.count;
  }
  return p;
}

// ===== Plugin =====

export const countingLabPlugin: GameTypePlugin = {
  id: "counting-lab",
  name: "Counting Lab",
  minGrade: 6,
  maxGrade: 9,
  description:
    "Count outcomes using the multiplication counting principle, permutations, combinations, restrictions, casework, and an intro to the pigeonhole principle. Enter the total count.",

  generate(input) {
    const rng = new Rng(input.seed);
    const result = generatePuzzleData(rng, input.difficulty);

    return {
      gameTypeId: "counting-lab",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: { text: result.promptText },
      data: {
        variant: result.variant,
        kind: result.kind,
        diagram: result.diagram,
        answer: result.answer,
        chain: result.chain,
        selfCheck: result.selfCheck
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: result.skillTags
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const answer = Number(candidate.data.answer);
    if (!Number.isFinite(answer)) return [];
    return [String(answer)];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues: ValidationIssue[] = [];
    const answer = Number(candidate.data.answer);
    const diagram = candidate.data.diagram as Diagram | undefined;
    const chain = candidate.data.chain as ChainStep[] | undefined;

    if (!isPosInt(answer)) {
      issues.push({ code: "bad_answer", message: `Answer ${answer} is not a positive integer.` });
    }

    if (!Array.isArray(chain) || chain.length === 0) {
      issues.push({ code: "no_chain", message: "Reasoning chain missing." });
    } else {
      for (const step of chain) {
        if (!step || typeof step.text !== "string" || step.text.trim() === "" || !Number.isFinite(step.resultValue)) {
          issues.push({ code: "bad_chain_step", message: "Chain step has invalid text or resultValue." });
          break;
        }
      }
    }

    if (!diagram || typeof diagram.kind !== "string") {
      issues.push({ code: "no_diagram", message: "Diagram missing." });
    } else if (diagram.kind === "chain") {
      const prod = slotsProduct(diagram.slots);
      if (prod === null) {
        issues.push({ code: "bad_chain_diagram", message: "Chain diagram has invalid slots." });
      } else {
        const divideBy = diagram.divideBy ?? 1;
        if (!isPosInt(divideBy) || prod % divideBy !== 0 || prod / divideBy !== diagram.result) {
          issues.push({ code: "chain_arithmetic_mismatch", message: "Chain diagram slots don't multiply/divide to the stated result." });
        }
      }
      if (diagram.result !== answer) {
        issues.push({ code: "diagram_answer_mismatch", message: "Diagram result does not match answer." });
      }
    } else if (diagram.kind === "cases") {
      if (!Array.isArray(diagram.cases) || diagram.cases.length < 2) {
        issues.push({ code: "bad_cases_diagram", message: "Cases diagram needs at least 2 disjoint cases." });
      } else {
        let sum = 0;
        for (const c of diagram.cases) {
          const prod = slotsProduct(c.slots);
          if (prod === null || prod !== c.value) {
            issues.push({ code: "case_arithmetic_mismatch", message: "A case's slots don't multiply to its stated value." });
            break;
          }
          sum += c.value;
        }
        if (sum !== diagram.result || diagram.result !== answer) {
          issues.push({ code: "cases_sum_mismatch", message: "Case values don't sum to the stated result/answer." });
        }
      }
    } else if (diagram.kind === "pigeonhole") {
      const { categories, guaranteeCount, pullCount, result } = diagram;
      if (
        !isPosInt(categories) ||
        !isPosInt(guaranteeCount) ||
        guaranteeCount < 2 ||
        (guaranteeCount - 1) * categories + 1 !== pullCount ||
        pullCount !== result ||
        result !== answer
      ) {
        issues.push({ code: "pigeonhole_mismatch", message: "Pigeonhole diagram fields are inconsistent with the answer." });
      }
    } else {
      issues.push({ code: "unknown_diagram_kind", message: `Unknown diagram kind: ${(diagram as any).kind}` });
    }

    if (candidate.data.selfCheck !== true) {
      issues.push({ code: "self_check_failed", message: "Generator self-check failed." });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const expected = Number(candidate.data.answer);
    if (!Number.isFinite(expected)) return false;
    const cleaned = String(answer ?? "").trim().replace(/,/g, "");
    if (cleaned === "") return false;
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return false;
    const val = Number(cleaned);
    if (!Number.isFinite(val)) return false;
    return val === expected;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const kind = (candidate.data.kind as Kind) || "multiplication";
    const chain = (candidate.data.chain as ChainStep[]) || [];
    const answer = Number(candidate.data.answer);
    return buildHintsFromChain(kind, chain, answer);
  }
};
