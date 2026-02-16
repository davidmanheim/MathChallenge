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
    const a = randInt(rng, 1, Math.max(2, value - 1));
    const b = value - a;
    const c = value + randInt(rng, 1, 8);
    const d = c - value;
    return [`${a} + ${b}`, `${c} - ${d}`];
  }

  if (difficulty <= 2) {
    const a = randInt(rng, 2, 9);
    const b = Math.max(1, Math.floor(value / a));
    const prod = a * b;
    const exprA = `${a} x ${b}`;
    const exprB = prod === value ? `${value * 2} / 2` : `${value + 9} - 9`;
    return [exprA, exprB];
  }

  if (difficulty <= 3) {
    const add = randInt(rng, 1, 6);
    const mul = randInt(rng, 2, 4);
    const left = Math.max(1, Math.floor(value / mul) - add);
    const exprA = `(${left} + ${add}) x ${mul}`;
    const exprB = `${value + 12} - 12`;
    return [exprA, exprB];
  }

  if (difficulty <= 4) {
    const denom = randInt(rng, 2, 8);
    const num = value * denom;
    const decimal = (value + 0.25).toFixed(2);
    const exprA = `${num}/${denom}`;
    const exprB = `${decimal} - 0.25`;
    return [exprA, exprB];
  }

  if (difficulty <= 5) {
    const square = value * value;
    const exprA = `sqrt(${square})`;
    const exprB = `${value + 2} x 1 - 2`;
    return [exprA, exprB];
  }

  const x = randInt(rng, 2, 9);
  const coeff = randInt(rng, 2, 5);
  const v = coeff * x;
  const exprA = `${coeff}x when x=${x}`;
  const exprB = `${v - 3} + 3`;
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

function buildCandidate(seed: number, difficulty: number): {
  cards: Card[];
  answer: string;
  pairCount: number;
} {
  const rng = makeRng(seed + difficulty * 97);
  const pairCount = pairsForDifficulty(difficulty);
  const values = new Set<number>();

  while (values.size < pairCount) {
    const v =
      difficulty <= 3
        ? randInt(rng, 5, 40)
        : difficulty <= 5
          ? randInt(rng, 6, 30)
          : randInt(rng, 8, 45);
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
    const built = buildCandidate(input.seed, input.difficulty);
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
