import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type Card = {
  id: number;
  expr: string;
  value: number;
  pairId: number;
};

function hashSeed(seed: number): number {
  let x = (seed | 0) ^ 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function makeRng(seed: number): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pickOne<T>(rng: () => number, options: T[]): T {
  return options[randInt(rng, 0, options.length - 1)];
}

function additionExpr(value: number, rng: () => number, maxTerm = 30): string {
  const minA = Math.max(1, value - maxTerm);
  const maxA = Math.min(maxTerm, value - 1);
  if (minA > maxA) return `${value}`;
  const a = randInt(rng, minA, maxA);
  return `${a} + ${value - a}`;
}

function subtractionExpr(value: number, rng: () => number, maxSub = 20): string {
  const sub = randInt(rng, 1, maxSub);
  return `${value + sub} - ${sub}`;
}

function multiplicationExpr(
  value: number,
  rng: () => number,
  maxFactor: number
): string | null {
  const factors: number[] = [];
  for (let f = 2; f <= maxFactor; f += 1) {
    if (value % f === 0 && value / f > 1) factors.push(f);
  }
  if (factors.length === 0) return null;
  const f = pickOne(rng, factors);
  return `${f} x ${value / f}`;
}

function sqrtExpr(value: number): string {
  return `√(${value * value})`;
}

function mixedMulAddExpr(value: number, rng: () => number, maxMul: number): string | null {
  const mulChoices: number[] = [];
  for (let m = 2; m <= maxMul; m += 1) {
    if (value % m === 0) mulChoices.push(m);
  }
  if (mulChoices.length === 0) return null;
  const mul = pickOne(rng, mulChoices);
  const quotient = value / mul;
  const add = randInt(rng, 1, Math.min(6, Math.max(1, quotient - 1)));
  const base = quotient - add;
  if (base <= 0) return null;
  return `(${base} + ${add}) x ${mul}`;
}

function mixedMulSubExpr(value: number, rng: () => number): string {
  const a = randInt(rng, 2, 9);
  const b = randInt(rng, 2, 12);
  const prod = a * b;
  if (prod <= value) {
    const extra = value - prod;
    return `(${a} x ${b}) + ${extra}`;
  }
  return `(${a} x ${b}) - ${prod - value}`;
}

function shuffleInPlace<T>(rng: () => number, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function pairsForDifficulty(difficulty: number): number {
  if (difficulty <= 1) return 4;
  if (difficulty <= 3) return 5;
  if (difficulty <= 5) return 6;
  return 7;
}

function buildExpressionsForValue(
  value: number,
  difficulty: number,
  rng: () => number
): [string, string] {
  if (difficulty <= 1) {
    // Mix of plain numbers with single-digit addition/subtraction.
    const options = [
      `${value}`,
      additionExpr(value, rng, 9),
      subtractionExpr(value, rng, 9)
    ];
    const exprA = pickOne(rng, options);
    let exprB = pickOne(rng, options);
    if (exprA === exprB) exprB = exprA === `${value}` ? additionExpr(value, rng, 9) : `${value}`;
    return [exprA, exprB];
  }

  if (difficulty <= 2) {
    // Mostly single-digit and small 2-digit arithmetic; multiplication capped at 3.
    const mult = multiplicationExpr(value, rng, 3);
    const options = [
      `${value}`,
      additionExpr(value, rng, 15),
      subtractionExpr(value, rng, 12),
      mult
    ].filter((x): x is string => typeof x === "string");
    const exprA = pickOne(rng, options);
    let exprB = pickOne(rng, options);
    if (exprA === exprB) exprB = exprA === `${value}` ? additionExpr(value, rng, 15) : `${value}`;
    return [exprA, exprB];
  }

  if (difficulty <= 3) {
    // Add simple multiplication and small mixed-operation forms.
    const options = [
      multiplicationExpr(value, rng, 6),
      mixedMulAddExpr(value, rng, 4),
      mixedMulSubExpr(value, rng),
      additionExpr(value, rng, 20),
      subtractionExpr(value, rng, 15)
    ].filter((x): x is string => typeof x === "string");
    const exprA = pickOne(rng, options);
    let exprB = pickOne(rng, options);
    if (exprA === exprB) exprB = additionExpr(value, rng, 20);
    return [exprA, exprB];
  }

  if (difficulty <= 4) {
    const options = [
      multiplicationExpr(value, rng, 8),
      mixedMulAddExpr(value, rng, 6),
      mixedMulSubExpr(value, rng),
      `${value * 2} / 2`,
      `${value * 3} / 3`
    ].filter((x): x is string => typeof x === "string");
    const exprA = pickOne(rng, options);
    let exprB = pickOne(rng, options);
    if (exprA === exprB) exprB = subtractionExpr(value, rng, 20);
    return [exprA, exprB];
  }

  if (difficulty <= 5) {
    const options = [
      sqrtExpr(value),
      multiplicationExpr(value, rng, 10),
      mixedMulAddExpr(value, rng, 8),
      mixedMulSubExpr(value, rng),
      `${value + 12} - 12`,
      `${value * 4} / 4`
    ].filter((x): x is string => typeof x === "string");
    const exprA = pickOne(rng, options);
    let exprB = pickOne(rng, options);
    if (exprA === exprB) exprB = additionExpr(value, rng, 30);
    return [exprA, exprB];
  }

  const options = [
    sqrtExpr(value),
    multiplicationExpr(value, rng, 12),
    mixedMulAddExpr(value, rng, 10),
    mixedMulSubExpr(value, rng),
    `${value * 5} / 5`,
    `(${value + 18}) - 18`
  ].filter((x): x is string => typeof x === "string");
  const exprA = pickOne(rng, options);
  let exprB = pickOne(rng, options);
  if (exprA === exprB) exprB = additionExpr(value, rng, 40);
  return [exprA, exprB];
}

function normalizePairs(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const readFromJson = () => {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return null;
      const pairs: string[] = [];
      for (const p of parsed) {
        if (!Array.isArray(p) || p.length !== 2) return null;
        const a = Number(p[0]);
        const b = Number(p[1]);
        if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
        if (a === b || a < 0 || b < 0) return null;
        const [lo, hi] = a < b ? [a, b] : [b, a];
        pairs.push(`${lo}-${hi}`);
      }
      pairs.sort();
      return pairs.join(",");
    } catch {
      return null;
    }
  };

  const fromJson = readFromJson();
  if (fromJson) return fromJson;

  const cleaned = trimmed.replace(/\s+/g, "");
  const chunks = cleaned.split(/[;,]/).filter(Boolean);
  if (chunks.length === 0) return null;
  const pairs: string[] = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^(\d+)-(\d+)$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === b) return null;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    pairs.push(`${lo}-${hi}`);
  }
  pairs.sort();
  return pairs.join(",");
}

function buildCandidate(seed: number, difficulty: number, pairCountOverride?: number): {
  cards: Card[];
  answer: string;
  pairCount: number;
} {
  const rng = makeRng(seed + difficulty * 97);
  const pairCount = Number.isInteger(pairCountOverride)
    ? Math.max(4, Math.min(12, Number(pairCountOverride)))
    : pairsForDifficulty(difficulty);
  const values = new Set<number>();

  while (values.size < pairCount) {
    const v = difficulty <= 1
      ? randInt(rng, 2, 9)
      : difficulty <= 2
        ? randInt(rng, 4, 24)
        : difficulty <= 3
          ? randInt(rng, 6, 40)
          : difficulty <= 4
            ? randInt(rng, 8, 72)
            : difficulty <= 5
              ? randInt(rng, 12, 120)
              : randInt(rng, 18, 180);
    values.add(v);
  }

  const cards: Card[] = [];
  let pairId = 0;
  for (const value of values) {
    const [exprA, exprB] = buildExpressionsForValue(value, difficulty, rng);
    cards.push({ id: cards.length, expr: exprA, value, pairId });
    cards.push({ id: cards.length, expr: exprB, value, pairId });
    pairId += 1;
  }

  shuffleInPlace(rng, cards);
  cards.forEach((card, idx) => {
    card.id = idx;
  });

  const expected: string[] = [];
  const byPair = new Map<number, number[]>();
  for (const card of cards) {
    const list = byPair.get(card.pairId) ?? [];
    list.push(card.id);
    byPair.set(card.pairId, list);
  }
  for (const ids of byPair.values()) {
    const [a, b] = ids[0] < ids[1] ? [ids[0], ids[1]] : [ids[1], ids[0]];
    expected.push(`${a}-${b}`);
  }
  expected.sort();

  return {
    cards,
    answer: expected.join(","),
    pairCount
  };
}

export const mismoPlugin: GameTypePlugin = {
  id: "mismo",
  name: "Mismo",
  minGrade: 1,
  maxGrade: 6,
  description: "Match expression cards that evaluate to the same value.",

  generate(input) {
    const built = buildCandidate(input.seed, input.difficulty, input.pairCount);
    const difficultyLabel =
      input.difficulty <= 2
        ? "Easy"
        : input.difficulty <= 4
          ? "Medium"
          : "Challenge";

    return {
      gameTypeId: "mismo",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Match equivalent expressions. Find ${built.pairCount} pairs.`
      },
      data: {
        cards: built.cards.map((c) => ({ id: c.id, expr: c.expr })),
        pairCount: built.pairCount,
        expectedPairs: built.answer,
        difficultyLabel
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: ["equivalence", "mental_math", "arithmetic", "expressions"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const expected = String(candidate.data.expectedPairs ?? "").trim();
    return expected ? [expected] : [];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const cards = candidate.data.cards as Array<{ id: number; expr: string }>;
    const pairCount = Number(candidate.data.pairCount);
    const expected = String(candidate.data.expectedPairs ?? "");
    const issues = [];

    if (!Array.isArray(cards) || cards.length < 8 || cards.length % 2 !== 0) {
      issues.push({
        code: "bad_cards",
        message: "Cards must be an even-length array with at least 8 cards."
      });
    } else {
      const ids = new Set<number>();
      for (const card of cards) {
        if (!Number.isInteger(card.id) || typeof card.expr !== "string" || card.expr.trim().length === 0) {
          issues.push({
            code: "bad_card",
            message: "Each card must include integer id and expression text."
          });
          break;
        }
        ids.add(card.id);
      }
      if (ids.size !== cards.length) {
        issues.push({
          code: "duplicate_ids",
          message: "Card IDs must be unique."
        });
      }
    }

    if (!Number.isInteger(pairCount) || pairCount < 4) {
      issues.push({
        code: "bad_pair_count",
        message: "pairCount must be an integer >= 4."
      });
    }

    const normalized = normalizePairs(expected);
    if (!normalized) {
      issues.push({
        code: "bad_expected_pairs",
        message: "expectedPairs is missing or malformed."
      });
    } else if (pairCount > 0 && normalized.split(",").length !== pairCount) {
      issues.push({
        code: "pair_count_mismatch",
        message: "expectedPairs length must match pairCount."
      });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const expected = normalizePairs(String(candidate.data.expectedPairs ?? ""));
    const actual = normalizePairs(answer);
    return Boolean(expected && actual && expected === actual);
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const cards = candidate.data.cards as Array<{ id: number; expr: string }>;
    const expected = normalizePairs(String(candidate.data.expectedPairs ?? ""));
    const firstPair = expected?.split(",")[0] ?? "";
    const [aStr, bStr] = firstPair.split("-");
    const a = Number(aStr);
    const b = Number(bStr);
    const cardA = cards.find((c) => c.id === a)?.expr ?? "card A";
    const cardB = cards.find((c) => c.id === b)?.expr ?? "card B";

    return [
      "Start with expressions that look quickest to evaluate, then match by value.",
      `If one expression equals 12, search for another card that also equals 12.`,
      `One guaranteed pair is: "${cardA}" and "${cardB}".`
    ];
  }
};
