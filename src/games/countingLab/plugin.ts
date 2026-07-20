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

// Pick a random element whose backing pool is large enough to draw `need`
// distinct items; falls back to the widest-pool option if none qualifies.
function pickWithPool<T extends { pool: string[] }>(rng: Rng, themes: T[], need: number): T {
  const ok = themes.filter((t) => t.pool.length >= need);
  if (ok.length > 0) return rng.pick(ok);
  return themes.slice().sort((a, b) => b.pool.length - a.pool.length)[0];
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
  "Ivy", "Jax", "Kira", "Leo", "Mila", "Noah", "Omar", "Pia",
  "Rosa", "Sami", "Tavi", "Uma"
];
const POOL_BOOKS = [
  "The Lighthouse Mystery", "Dragons of Coral Bay", "Race to the Summit",
  "The Clockwork Fox", "Wanderer's Atlas", "Secrets of the Attic",
  "Comet Chasers", "The Last Cartographer"
];
const POOL_SONGS = [
  "Neon Tide", "Paper Planes", "Midnight Garden", "Static Bloom",
  "Golden Hour", "Riverlight", "Echo Park", "Sugar Rush"
];
const POOL_MOVIES = [
  "Robot Rodeo", "The Quiet Comet", "Cave of Whispers", "Sky Pirates",
  "Two Left Feet", "The Marble King", "Frostfall", "Dune Buggy Kids"
];
const POOL_COLORS = [
  "red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"
];

// Multiplication theme pools (each pool has >= 6 distinct options)
const POOL_SOUPS = ["Tomato", "Chicken Noodle", "Miso", "Lentil", "Corn Chowder", "Broccoli Cheddar"];
const POOL_SANDWICHES = ["Turkey", "Veggie", "Ham & Cheese", "Grilled Cheese", "BLT", "Egg Salad"];
const POOL_DESSERTS = ["Cookie", "Brownie", "Fruit Cup", "Pudding", "Cupcake", "Jello"];
const POOL_SHIRTS = ["red", "blue", "green", "yellow", "striped", "plaid"];
const POOL_PANTS = ["jeans", "khakis", "shorts", "sweatpants", "cargo pants", "leggings"];
const POOL_SHOES = ["sneakers", "sandals", "boots", "loafers", "flip-flops", "rain boots"];
const POOL_FLAVORS = ["vanilla", "chocolate", "strawberry", "mint", "cookie dough", "mango"];
const POOL_TOPPINGS = ["sprinkles", "nuts", "cherries", "cookie crumbles", "mini marshmallows", "coconut"];
const POOL_SAUCES = ["chocolate", "caramel", "strawberry", "butterscotch", "hot fudge", "marshmallow"];
const POOL_PIZZA_SIZE = ["small", "medium", "large", "party", "personal", "family"];
const POOL_PIZZA_CRUST = ["thin", "thick", "stuffed", "gluten-free", "cauliflower", "sourdough"];
const POOL_PIZZA_TOP = ["pepperoni", "mushroom", "olives", "peppers", "sausage", "pineapple"];
const POOL_SMOOTHIE_FRUIT = ["banana", "berry", "mango", "peach", "kiwi", "pineapple"];
const POOL_SMOOTHIE_LIQUID = ["milk", "oat milk", "juice", "yogurt", "coconut water", "almond milk"];
const POOL_SMOOTHIE_BOOST = ["honey", "protein", "spinach", "chia", "peanut butter", "oats"];
const POOL_TACO_SHELL = ["soft", "crunchy", "double", "whole-wheat", "corn", "lettuce-wrap"];
const POOL_TACO_PROTEIN = ["chicken", "beef", "beans", "tofu", "fish", "veggie"];
const POOL_TACO_SALSA = ["mild", "medium", "hot", "verde", "mango", "pico"];
const POOL_AVATAR_BODY = ["robot", "cat", "knight", "alien", "wizard", "ninja"];
const POOL_AVATAR_HAT = ["crown", "helmet", "cap", "beanie", "top hat", "visor"];
const POOL_AVATAR_TOOL = ["sword", "shield", "wand", "bow", "hammer", "staff"];
const POOL_BREAKFAST_MAIN = ["pancakes", "waffles", "oatmeal", "eggs", "toast", "yogurt"];
const POOL_BREAKFAST_DRINK = ["milk", "juice", "cocoa", "smoothie", "tea", "water"];
const POOL_BREAKFAST_FRUIT = ["banana", "apple", "berries", "orange", "melon", "grapes"];
const POOL_BACKPACK_COLOR = ["red", "blue", "green", "black", "purple", "gray"];
const POOL_BACKPACK_SIZE = ["mini", "small", "medium", "large", "hiking", "rolling"];
const POOL_BACKPACK_PATCH = ["star", "rocket", "cat", "wave", "bolt", "leaf"];

const POOL_SALAD = ["lettuce", "tomato", "cucumber", "carrot", "peppers", "olives", "cheese", "croutons", "corn", "chickpeas"];
const POOL_SUBSET_TOPPINGS = ["pepperoni", "mushroom", "olives", "peppers", "sausage", "pineapple", "onion", "spinach"];
const POOL_SUBSET_SUNDAE = ["sprinkles", "nuts", "cherries", "cookie crumbles", "marshmallows", "coconut", "caramel", "fudge"];
const POOL_SUBSET_CHARMS = ["star", "rocket", "cat", "wave", "bolt", "leaf", "moon", "gem"];

const ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H"];

const MULTIPLICATION_THEMES: { key: string; noun: string; labels: string[]; pools: string[][] }[] = [
  { key: "lunch", noun: "lunch combo", labels: ["soup", "sandwich", "dessert"], pools: [POOL_SOUPS, POOL_SANDWICHES, POOL_DESSERTS] },
  { key: "outfit", noun: "outfit", labels: ["shirt color", "pants style", "shoe type"], pools: [POOL_SHIRTS, POOL_PANTS, POOL_SHOES] },
  { key: "sundae", noun: "ice cream sundae", labels: ["flavor", "topping", "sauce"], pools: [POOL_FLAVORS, POOL_TOPPINGS, POOL_SAUCES] },
  { key: "pizza", noun: "pizza order", labels: ["size", "crust", "topping"], pools: [POOL_PIZZA_SIZE, POOL_PIZZA_CRUST, POOL_PIZZA_TOP] },
  { key: "smoothie", noun: "smoothie", labels: ["fruit", "liquid", "boost"], pools: [POOL_SMOOTHIE_FRUIT, POOL_SMOOTHIE_LIQUID, POOL_SMOOTHIE_BOOST] },
  { key: "taco", noun: "taco", labels: ["shell", "protein", "salsa"], pools: [POOL_TACO_SHELL, POOL_TACO_PROTEIN, POOL_TACO_SALSA] },
  { key: "avatar", noun: "game avatar", labels: ["body", "hat", "gear"], pools: [POOL_AVATAR_BODY, POOL_AVATAR_HAT, POOL_AVATAR_TOOL] },
  { key: "breakfast", noun: "breakfast plate", labels: ["main", "drink", "fruit"], pools: [POOL_BREAKFAST_MAIN, POOL_BREAKFAST_DRINK, POOL_BREAKFAST_FRUIT] },
  { key: "backpack", noun: "backpack", labels: ["color", "size", "patch"], pools: [POOL_BACKPACK_COLOR, POOL_BACKPACK_SIZE, POOL_BACKPACK_PATCH] }
];

// Full-permutation (arrange ALL items in a row/order) contexts
const PERMUTATION_FULL_THEMES: {
  key: string;
  pool: string[];
  prompt: (items: string[], n: number) => string;
}[] = [
  {
    key: "books",
    pool: POOL_BOOKS,
    prompt: (items, n) => `You have ${n} different books: ${listJoin(items)}. How many different orders can you arrange all ${n} of them on a shelf?`
  },
  {
    key: "photo",
    pool: POOL_NAMES,
    prompt: (items, n) => `${listJoin(items)} — ${n} friends — want to line up in a single row for a photo. How many different lineups (orders) are possible?`
  },
  {
    key: "race",
    pool: POOL_NAMES,
    prompt: (items, n) => `${n} runners — ${listJoin(items)} — finish a race with no ties. How many different finishing orders (1st through ${n}th) are possible?`
  },
  {
    key: "playlist",
    pool: POOL_SONGS,
    prompt: (items, n) => `A playlist has ${n} songs: ${listJoin(items)}. How many different orders can the ${n} songs be played in?`
  },
  {
    key: "parade",
    pool: POOL_MOVIES,
    prompt: (items, n) => `${n} parade floats — ${listJoin(items)} — will roll down the street one after another. How many different orders can they go in?`
  }
];

// Partial-permutation (choose AND arrange K of N) contexts
const PERMUTATION_PARTIAL_THEMES: {
  key: string;
  pool: string[];
  roles: (k: number) => string[];
  prompt: (members: string[], n: number, k: number, roles: string[]) => string;
}[] = [
  {
    key: "officers",
    pool: POOL_NAMES,
    roles: (k) => ["President", "Vice President", "Secretary", "Treasurer"].slice(0, k),
    prompt: (members, n, k, roles) =>
      `A club has ${n} members: ${listJoin(members)}. They need to elect ${k} different officers — ${listJoin(roles)} — and no member can hold more than one role. How many different ways can these roles be filled?`
  },
  {
    key: "medals",
    pool: POOL_NAMES,
    roles: (k) => ["Gold", "Silver", "Bronze", "4th place"].slice(0, k),
    prompt: (members, n, k, roles) =>
      `${n} swimmers — ${listJoin(members)} — race for ${k} medal spots: ${listJoin(roles)}. Each spot goes to a different swimmer. How many different ways can the ${k} spots be awarded?`
  },
  {
    key: "podium",
    pool: POOL_MOVIES,
    roles: (k) => ["1st", "2nd", "3rd", "4th"].slice(0, k),
    prompt: (members, n, k, roles) =>
      `${n} short films — ${listJoin(members)} — compete for the top ${k} ranked spots (${listJoin(roles)}), all different. How many different rankings of the top ${k} are possible?`
  }
];

// Combination (choose K of N, order does NOT matter) contexts
const COMBINATION_THEMES: {
  key: string;
  pool: string[];
  prompt: (members: string[], n: number, k: number) => string;
}[] = [
  {
    key: "committee",
    pool: POOL_NAMES,
    prompt: (members, n, k) =>
      `A club has ${n} members: ${listJoin(members)}. They want to choose a committee of ${k} people — there are no different roles, everyone on the committee has equal say. How many different committees of ${k} are possible?`
  },
  {
    key: "salad",
    pool: POOL_SALAD,
    prompt: (members, n, k) =>
      `A salad bar offers ${n} ingredients: ${listJoin(members)}. You choose exactly ${k} different ingredients (the order you name them in doesn't matter). How many different ingredient sets are possible?`
  },
  {
    key: "starters",
    pool: POOL_NAMES,
    prompt: (members, n, k) =>
      `A team has ${n} players: ${listJoin(members)}. The coach picks ${k} of them to be starters (all starters are equal — no positions yet). How many different groups of ${k} starters are possible?`
  },
  {
    key: "bookclub",
    pool: POOL_BOOKS,
    prompt: (members, n, k) =>
      `A book club has ${n} books on the shortlist: ${listJoin(members)}. They will read ${k} of them this month (order to be decided later — right now they just pick the set). How many different sets of ${k} books are possible?`
  }
];

const CODE_OPTIONS: { A: number; L: number; D: number }[] = [
  { A: 4, L: 2, D: 1 },
  { A: 4, L: 2, D: 2 },
  { A: 4, L: 3, D: 1 },
  { A: 5, L: 2, D: 1 },
  { A: 5, L: 2, D: 2 },
  { A: 5, L: 3, D: 1 },
  { A: 6, L: 2, D: 1 },
  { A: 6, L: 2, D: 2 },
  { A: 6, L: 3, D: 1 },
  { A: 7, L: 2, D: 1 },
  { A: 8, L: 2, D: 1 }
];

// Subsets (each item independently in-or-out): answer = 2^T
const SUBSET_THEMES: {
  key: string;
  noun: string;
  itemLabel: string;
  pool: string[];
  prompt: (items: string[], t: number, noun: string) => string;
}[] = [
  {
    key: "pizza",
    noun: "pizza",
    itemLabel: "topping",
    pool: POOL_SUBSET_TOPPINGS,
    prompt: (items, t, noun) =>
      `A pizza can have any combination of these ${t} toppings — you may include or skip each one independently (a plain pizza with no toppings counts, and so does one with all ${t}): ${listJoin(items)}. How many different pizzas are possible?`
  },
  {
    key: "sundae",
    noun: "sundae",
    itemLabel: "topping",
    pool: POOL_SUBSET_SUNDAE,
    prompt: (items, t, noun) =>
      `A sundae bar has ${t} toppings: ${listJoin(items)}. Each topping can be added or left off independently (including a plain sundae with none). How many different topping combinations are possible?`
  },
  {
    key: "backpack",
    noun: "keychain set",
    itemLabel: "charm",
    pool: POOL_SUBSET_CHARMS,
    prompt: (items, t, noun) =>
      `You have ${t} different charms to clip onto a backpack: ${listJoin(items)}. Each charm can be on or off independently (none, some, or all). How many different charm arrangements are possible?`
  }
];

// Strings with repetition allowed: answer = A^L
const REPEAT_STRING_THEMES: {
  key: string;
  slotLabel: string;
  prompt: (chars: string[], a: number, l: number) => string;
}[] = [
  {
    key: "letters",
    slotLabel: "letter",
    prompt: (chars, a, l) =>
      `A ${l}-letter password uses letters from {${chars.join(", ")}} and letters MAY repeat. How many different passwords are possible?`
  },
  {
    key: "lock",
    slotLabel: "dial",
    prompt: (chars, a, l) =>
      `A combination lock has ${l} dials, and each dial can show any of the symbols {${chars.join(", ")}} (symbols may repeat across dials). How many different combinations are possible?`
  }
];

// Multiset word arrangements: answer = len! / product(repeat factorials)
const MULTISET_WORDS: { word: string; result: number }[] = [
  { word: "LEVEL", result: 30 },
  { word: "NOON", result: 6 },
  { word: "APPLE", result: 60 },
  { word: "BANANA", result: 60 },
  { word: "LETTER", result: 180 },
  { word: "PEPPER", result: 60 },
  { word: "TATTOO", result: 60 },
  { word: "CANNON", result: 120 },
  { word: "BALLOON", result: 1260 },
  { word: "SUCCESS", result: 420 },
  { word: "MISSING", result: 1260 }
];

// ===== Diagram + chain shapes =====

type SlotSpec = { label: string; count: number; options?: string[] };
type ChainDiagram = { kind: "chain"; slots: SlotSpec[]; divideBy?: number; result: number; grouping?: boolean };
type CaseSpec = { label: string; slots: SlotSpec[]; value: number };
type CasesDiagram = { kind: "cases"; cases: CaseSpec[]; result: number };
type PigeonholeDiagram = {
  kind: "pigeonhole";
  categories: number;
  guaranteeCount: number;
  pullCount: number;
  result: number;
  categoryLabels?: string[];
  itemNoun?: string;
};
type Diagram = ChainDiagram | CasesDiagram | PigeonholeDiagram;

type ChainStep = { principle: string; text: string; resultValue: number };

type Kind =
  | "multiplication"
  | "permutation-full"
  | "permutation-partial"
  | "combination"
  | "restricted"
  | "subsets"
  | "circular"
  | "multiset"
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
    diagram: {
      kind: "chain",
      slots: labels.map((label, i) => ({ label, count: counts[i], options: itemLists[i] })),
      result: answer
    },
    answer,
    chain,
    skillTags: ["combinatorics", "counting_principle", "multiplication_principle"],
    variant: `multiplication-${theme.key}-${slotCount}-${maxCount}`,
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

  const promptText = theme.prompt(items, N);

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
    variant: `permutation-full-${theme.key}-${N}`,
    kind: "permutation-full",
    selfCheck: factorial(N) === answer
  };
}

// ===== Template 3: Partial permutation (choose and arrange K of N) =====

function genPermutationPartial(rng: Rng): GenResult {
  const N = rng.int(4, 8);
  const K = rng.int(2, Math.min(4, N - 1));
  const theme = rng.pick(PERMUTATION_PARTIAL_THEMES);
  const members = pickNames(rng, theme.pool, N);
  const roles = theme.roles(K);
  const answer = permute(N, K);

  const promptText = theme.prompt(members, N, K, roles);

  const factorParts = Array.from({ length: K }, (_, i) => N - i);
  const chain: ChainStep[] = [
    {
      principle: "Permutation (choose and arrange)",
      text: `Each spot is different, so order matters, and once someone fills a spot they're no longer available for the next one: ${factorParts.join(" × ")} = ${answer}.`,
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
    variant: `permutation-partial-${theme.key}-${N}-${K}`,
    kind: "permutation-partial",
    selfCheck: permute(N, K) === answer
  };
}

// ===== Template 4: Counting principle with a no-repeat restriction =====

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
  const theme = pickWithPool(rng, COMBINATION_THEMES, N);
  const members = pickNames(rng, theme.pool, N);
  const orderedSlots = Array.from({ length: K }, (_, i) => N - i);
  const orderedCount = orderedSlots.reduce((p, c) => p * c, 1);
  const kFact = factorial(K);
  const answer = Math.round(orderedCount / kFact);

  const promptText = theme.prompt(members, N, K);

  const chain: ChainStep[] = [
    {
      principle: "Ordered count (as if order mattered)",
      text: `First imagine order did matter: the number of ways to pick and arrange ${K} of the ${N} in order is ${orderedSlots.join(" × ")} = ${orderedCount}.`,
      resultValue: orderedCount
    },
    {
      principle: "Combination (remove the overcounting)",
      text: `But order doesn't matter here — each group of ${K} got counted ${K}! = ${kFact} times in that ordered count (once for every order it could've been picked in). Divide to correct: ${orderedCount} ÷ ${kFact} = ${answer}.`,
      resultValue: answer
    }
  ];

  return {
    promptText,
    diagram: {
      kind: "chain",
      slots: orderedSlots.map((c, i) => ({ label: `pick ${i + 1}`, count: c })),
      divideBy: kFact,
      grouping: true,
      result: answer
    },
    answer,
    chain,
    skillTags: ["combinatorics", "combinations", "counting_principle"],
    variant: `combination-${theme.key}-${N}-${K}${hard ? "-hard" : ""}`,
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
    diagram: { kind: "chain", slots, divideBy: kFact, grouping: remainingChoose > 1, result: answer },
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
  const N = rng.int(4, 7);
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

const CASEWORK_THEMES: { key: string; groupA: string; groupB: string; itemNoun: string }[] = [
  { key: "class", groupA: "boy", groupB: "girl", itemNoun: "students" },
  { key: "pets", groupA: "cat", groupB: "dog", itemNoun: "pets" },
  { key: "garden", groupA: "flower", groupB: "veggie", itemNoun: "plants" }
];

function genCasework(rng: Rng): GenResult {
  const K = rng.pick([2, 3]) as 2 | 3;
  const G = rng.int(K, K + 3);
  const B = rng.int(1, 4);
  const theme = rng.pick(CASEWORK_THEMES);

  const case1GirlsChosen = K - 1;
  const case1GirlsWays = choose(G, case1GirlsChosen);
  const case1 = case1GirlsWays * B;
  const case2 = choose(G, K);
  const answer = case1 + case2;

  const gA = (n: number) => `${n} ${theme.groupA}${n === 1 ? "" : "s"}`;
  const gB = (n: number) => `${n} ${theme.groupB}${n === 1 ? "" : "s"}`;

  const promptText = `A group has ${gA(B)} and ${gB(G)} available for a team. They need a team of ${K} ${theme.itemNoun} with at least ${gB(case1GirlsChosen)} on it. How many different teams are possible?`;

  const chain: ChainStep[] = [
    {
      principle: "Case 1",
      text: `Case 1: exactly ${gB(case1GirlsChosen)} and 1 ${theme.groupA}. Choose ${case1GirlsChosen} ${theme.groupB}${case1GirlsChosen === 1 ? "" : "s"} from ${G}: C(${G},${case1GirlsChosen}) = ${case1GirlsWays}. Choose 1 ${theme.groupA} from ${B}: ${B}. Multiply: ${case1GirlsWays} × ${B} = ${case1}.`,
      resultValue: case1
    },
    {
      principle: "Case 2",
      text: `Case 2: all ${K} ${theme.groupB}s and 0 ${theme.groupA}s. Choose ${K} ${theme.groupB}s from ${G}: C(${G},${K}) = ${case2}.`,
      resultValue: case2
    },
    {
      principle: "Casework (sum the disjoint cases)",
      text: `A team can't be in both cases at once (it has either exactly ${gB(case1GirlsChosen)} or exactly ${K} ${theme.groupB}s, not both), so add the cases: ${case1} + ${case2} = ${answer}.`,
      resultValue: answer
    }
  ];

  // Independent cross-check via complementary counting: total teams minus
  // teams with fewer than (K-1) B-group members should equal the direct sum.
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
        label: `Case 1: ${gB(case1GirlsChosen)} + 1 ${theme.groupA}`,
        slots: [
          { label: `${theme.groupB}s`, count: case1GirlsWays },
          { label: `${theme.groupA}s`, count: B }
        ],
        value: case1
      },
      {
        label: `Case 2: ${K} ${theme.groupB}s`,
        slots: [{ label: `${theme.groupB}s`, count: case2 }],
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
    variant: `casework-${theme.key}-${B}-${G}-${K}`,
    kind: "casework",
    selfCheck: case1 + case2 === answer && crossCheck === answer
  };
}

// ===== Template 9: Pigeonhole principle (intro flavor) =====

const PIGEONHOLE_THEMES: { key: string; container: string; itemNoun: string; pool: string[] }[] = [
  { key: "socks", container: "drawer", itemNoun: "socks", pool: POOL_COLORS },
  { key: "marbles", container: "bag", itemNoun: "marbles", pool: POOL_COLORS },
  { key: "crayons", container: "box", itemNoun: "crayons", pool: POOL_COLORS },
  { key: "gloves", container: "bin", itemNoun: "gloves", pool: POOL_COLORS }
];

function genPigeonhole(rng: Rng): GenResult {
  const C = rng.int(3, 6);
  const M = rng.pick([2, 3, 4]) as 2 | 3 | 4;
  const worstCase = (M - 1) * C;
  const answer = worstCase + 1;
  const theme = rng.pick(PIGEONHOLE_THEMES);
  const colors = pickNames(rng, theme.pool, C);

  const promptText = `A ${theme.container} has plenty of ${theme.itemNoun} in ${C} different colors: ${listJoin(colors)}. Pulling ${theme.itemNoun} out one at a time without looking, what is the smallest number you must pull to guarantee that at least ${M} of them are the same color?`;

  const chain: ChainStep[] = [
    {
      principle: "Consider the worst case",
      text: `Imagine the worst possible luck: you could pull ${M - 1} ${theme.itemNoun.replace(/s$/, "")}${M - 1 === 1 ? "" : "s"} of every one of the ${C} colors before being forced into a match of ${M}. That's ${M - 1} × ${C} = ${worstCase} ${theme.itemNoun} with no color yet reaching ${M}.`,
      resultValue: worstCase
    },
    {
      principle: "Pigeonhole Principle",
      text: `The very next one (number ${worstCase + 1}) must match one of the colors you already have ${M - 1} of, giving you ${M} of that color. So you need ${answer} ${theme.itemNoun} to guarantee it.`,
      resultValue: answer
    }
  ];

  const diagram: PigeonholeDiagram = {
    kind: "pigeonhole",
    categories: C,
    guaranteeCount: M,
    pullCount: answer,
    result: answer,
    categoryLabels: colors,
    itemNoun: theme.itemNoun
  };

  return {
    promptText,
    diagram,
    answer,
    chain,
    skillTags: ["combinatorics", "pigeonhole_principle"],
    variant: `pigeonhole-${theme.key}-${C}-${M}`,
    kind: "pigeonhole",
    selfCheck: worstCase + 1 === answer
  };
}

// ===== Template 10 (NEW): Counting subsets — each item independently in or out (2^T) =====

function genSubsets(rng: Rng, hard: boolean): GenResult {
  const T = hard ? rng.int(6, 8) : rng.int(3, 5);
  const theme = pickWithPool(rng, SUBSET_THEMES, T);
  const items = pickNames(rng, theme.pool, T);
  const answer = Math.pow(2, T);

  const promptText = theme.prompt(items, T, theme.noun);

  const factorParts = Array.from({ length: T }, () => 2);
  const chain: ChainStep[] = [
    {
      principle: "Each item is an independent in/out choice",
      text: `Every one of the ${T} ${theme.itemLabel}s is decided independently: it's either included or not — 2 choices each. Because the choices don't affect one another, multiply: ${factorParts.join(" × ")} = 2^${T} = ${answer}.`,
      resultValue: answer
    }
  ];

  const slots: SlotSpec[] = items.map((it) => ({
    label: `${it}?`,
    count: 2,
    options: ["include", "skip"]
  }));

  return {
    promptText,
    diagram: { kind: "chain", slots, result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "counting_principle", "subsets", "multiplication_principle"],
    variant: `subsets-${theme.key}-${T}`,
    kind: "subsets",
    selfCheck: Math.pow(2, T) === answer
  };
}

// ===== Template 11 (NEW): Strings with repetition allowed (A^L) =====

function genRepeatString(rng: Rng): GenResult {
  const theme = rng.pick(REPEAT_STRING_THEMES);
  // Keep A^L in a kid-checkable range (<= ~1300).
  const combos: { A: number; L: number }[] = [
    { A: 3, L: 3 }, { A: 3, L: 4 }, { A: 4, L: 3 }, { A: 4, L: 4 },
    { A: 5, L: 3 }, { A: 5, L: 4 }, { A: 6, L: 3 }, { A: 6, L: 4 },
    { A: 7, L: 3 }, { A: 2, L: 5 }, { A: 3, L: 5 }
  ];
  const { A, L } = rng.pick(combos);
  const chars = ALPHABET.slice(0, A);
  const answer = Math.pow(A, L);

  const promptText = theme.prompt(chars, A, L);

  const factorParts = Array.from({ length: L }, () => A);
  const chain: ChainStep[] = [
    {
      principle: "Multiplication with repetition allowed",
      text: `Repeats are allowed, so every slot has the full ${A} choices no matter what the other slots hold. Multiply ${A} by itself ${L} times: ${factorParts.join(" × ")} = ${A}^${L} = ${answer}.`,
      resultValue: answer
    }
  ];

  const slots: SlotSpec[] = Array.from({ length: L }, (_, i) => ({
    label: `${theme.slotLabel} ${i + 1}`,
    count: A,
    options: chars
  }));

  return {
    promptText,
    diagram: { kind: "chain", slots, result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "counting_principle", "with_repetition", "multiplication_principle"],
    variant: `repeat-string-${theme.key}-${A}-${L}`,
    kind: "restricted",
    selfCheck: Math.pow(A, L) === answer
  };
}

// ===== Template 12 (NEW): Circular permutation ((N-1)!) =====

const CIRCULAR_THEMES: { key: string; pool: string[]; noun: string; container: string }[] = [
  { key: "table", pool: POOL_NAMES, noun: "friends", container: "round table" },
  { key: "campfire", pool: POOL_NAMES, noun: "campers", container: "circle around a campfire" },
  { key: "carousel", pool: POOL_NAMES, noun: "riders", container: "carousel" }
];

function genCircular(rng: Rng): GenResult {
  const theme = rng.pick(CIRCULAR_THEMES);
  const N = rng.int(4, 7);
  const people = pickNames(rng, theme.pool, N);
  const answer = factorial(N - 1);

  const promptText = `${N} ${theme.noun} — ${listJoin(people)} — sit around a ${theme.container}. Two seatings count as the SAME if one is just a rotation of the other (everyone shifts the same number of seats). How many genuinely different seatings are there?`;

  const factorParts = Array.from({ length: N - 1 }, (_, i) => N - 1 - i);
  const chain: ChainStep[] = [
    {
      principle: "Anchor one person to remove rotations",
      text: `Because rotations look the same, seat one person first as a fixed anchor. That uses up the "which rotation" freedom.`,
      resultValue: N - 1
    },
    {
      principle: "Arrange the rest in order around the circle",
      text: `The remaining ${N - 1} people fill the other seats in order relative to the anchor: ${factorParts.join(" × ")} = (${N}-1)! = ${answer}.`,
      resultValue: answer
    }
  ];

  const slots: SlotSpec[] = factorParts.map((c, i) => ({
    label: `seat ${i + 2} (from anchor)`,
    count: c
  }));

  return {
    promptText,
    diagram: { kind: "chain", slots, result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "permutations", "circular_permutation", "factorial"],
    variant: `circular-${theme.key}-${N}`,
    kind: "circular",
    selfCheck: factorial(N - 1) === answer
  };
}

// ===== Template 13 (NEW): Multiset arrangements (word with repeated letters) =====

function letterCounts(word: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of word) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

function genMultiset(rng: Rng): GenResult {
  const entry = rng.pick(MULTISET_WORDS);
  const word = entry.word;
  const n = word.length;
  const counts = letterCounts(word);
  const nFact = factorial(n);
  let divideBy = 1;
  const repeatParts: string[] = [];
  for (const [ch, c] of counts) {
    if (c > 1) {
      divideBy *= factorial(c);
      repeatParts.push(`${ch}×${c} → ${c}!`);
    }
  }
  const answer = Math.round(nFact / divideBy);

  const promptText = `How many different arrangements (orderings of all the letters) can be made from the letters of the word "${word}"? Rearrangements that swap two identical letters look the same and should NOT be counted separately.`;

  const factorParts = Array.from({ length: n }, (_, i) => n - i);
  const chain: ChainStep[] = [
    {
      principle: "Arrange as if all letters were different",
      text: `Pretend all ${n} letters are distinct: that's ${factorParts.join(" × ")} = ${n}! = ${nFact} orderings.`,
      resultValue: nFact
    },
    {
      principle: "Remove duplicate arrangements from repeated letters",
      text: `But repeated letters (${repeatParts.join(", ")}) can be swapped without changing the word, so each real arrangement got counted ${divideBy} times. Divide: ${nFact} ÷ ${divideBy} = ${answer}.`,
      resultValue: answer
    }
  ];

  const slots: SlotSpec[] = factorParts.map((c, i) => ({ label: `position ${i + 1}`, count: c }));

  return {
    promptText,
    diagram: { kind: "chain", slots, divideBy, grouping: true, result: answer },
    answer,
    chain,
    skillTags: ["combinatorics", "permutations", "multiset_permutation", "counting_principle"],
    variant: `multiset-${word}`,
    kind: "multiset",
    selfCheck: Math.round(nFact / divideBy) === answer && entry.result === answer
  };
}

// ===== Difficulty dispatch =====

type Gen = (rng: Rng) => GenResult;

const TIER_GENERATORS: Record<number, Gen[]> = {
  1: [
    (r) => genMultiplication(r, 2, 4),
    (r) => genMultiplication(r, 3, 3),
    (r) => genMultiplication(r, 2, 5)
  ],
  2: [
    (r) => genPermutationFull(r),
    (r) => genMultiplication(r, 3, 5),
    (r) => genRepeatString(r)
  ],
  3: [
    (r) => genRestrictedNoRepeat(r),
    (r) => genPermutationPartial(r),
    (r) => genSubsets(r, false)
  ],
  4: [
    (r) => genCombination(r, false),
    (r) => genMustInclude(r),
    (r) => genSubsets(r, true)
  ],
  5: [
    (r) => genAdjacentPair(r),
    (r) => genCombination(r, true),
    (r) => genCircular(r)
  ],
  6: [
    (r) => genCasework(r),
    (r) => genPigeonhole(r),
    (r) => genMultiset(r)
  ]
};

function generatePuzzleData(rng: Rng, difficulty: number): GenResult {
  const d = Math.max(1, Math.min(6, Math.round(difficulty)));
  const gens = TIER_GENERATORS[d];
  const idx = rng.int(0, gens.length - 1);
  return gens[idx](rng);
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
    case "subsets":
      return "Think about one item at a time: is it in or out? Each item is an independent yes/no choice. How do independent choices combine?";
    case "circular":
      return "Seatings that are just rotations of each other count as the same. What can you fix in place first to get rid of the rotation double-counting?";
    case "multiset":
      return "Start by pretending every letter is unique. Then think about how many times each real arrangement got counted because identical letters can swap.";
    case "restricted":
      return "Look for a restriction in the wording (something that must happen, must be included, can't repeat, may repeat, or must stay together). How does that change how many choices are available at each step?";
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
    "Build the count with an interactive slot/case/pigeonhole bench: multiplication counting principle, permutations, combinations, subsets, restrictions, circular and multiset arrangements, casework, and the pigeonhole principle. Construct the count, then enter the total.",

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
