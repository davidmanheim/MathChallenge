import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

// --- math helpers ---

function primeFactors(n: number): number[] {
  const factors: number[] = [];
  let val = Math.abs(n);
  for (let d = 2; d * d <= val; d++) {
    while (val % d === 0) {
      factors.push(d);
      val /= d;
    }
  }
  if (val > 1) factors.push(val);
  return factors;
}

function uniquePrimeFactors(n: number): number[] {
  return [...new Set(primeFactors(n))].sort((a, b) => a - b);
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

// --- seeded number generation ---
//
// A well-mixed PRNG. The previous implementation drew every value as
// `min + |seed| % span`, which had two variety-killing problems:
//   1. consecutive seeds (as the validation gate uses) produced
//      near-consecutive values, and
//   2. when both operands of a pair were derived from the same seed they
//      became functions of `seed % span`, so a whole tier could only ever
//      produce ~span distinct pairs (this is what collapsed the GCF/LCM
//      pools). Drawing each operand from an independent, avalanche-mixed
//      stream fixes both and lets the pools span their full parameter space.

function mix32(x: number): number {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x;
}

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (mix32(seed >>> 0) ^ 0x9e3779b9) >>> 0;
  }
  private next(): number {
    this.s = mix32((this.s + 0x9e3779b9) >>> 0);
    return this.s;
  }
  int(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
}

// Puzzle sub-types by difficulty:
//   1-2  ->  "prime_factors"   : list the prime factorisation
//   3-4  ->  "gcf"             : find the GCF of two numbers
//   5+   ->  "lcm"             : find the LCM of two numbers

type SubType = "prime_factors" | "gcf" | "lcm";

function subTypeForDifficulty(difficulty: number): SubType {
  if (difficulty <= 2) return "prime_factors";
  if (difficulty <= 4) return "gcf";
  return "lcm";
}

// --- quality filters ---

// Numbers whose largest prime factor exceeds this threshold are boring
// to factorise interactively (kid just stares at a big prime).
const MAX_PRIME_FACTOR: Record<number, number> = {
  1: 13,  // difficulty 1: primes only up to 13
  2: 19,  // difficulty 2: allow up to 19
};

function largestPrimeFactor(n: number): number {
  const factors = primeFactors(n);
  return factors[factors.length - 1];
}

function hasSmallPrimeFactors(n: number, difficulty: number): boolean {
  const cap = MAX_PRIME_FACTOR[difficulty] ?? 23;
  return largestPrimeFactor(n) <= cap;
}

// For GCF puzzles, reject trivial GCF=1 pairs (boring answer).
function hasNontrivialGcf(a: number, b: number): boolean {
  return gcd(a, b) > 1;
}

// Medium GCF puzzles should share multiple common factors, not just one prime.
function hasMultipleCommonFactors(a: number, b: number): boolean {
  const g = gcd(a, b);
  if (g < 4) return false;
  return primeFactors(g).length >= 2;
}

// --- generator helpers per sub-type ---

function primeChoicesFor(target: number): number[] {
  const standardPrimes = [2, 3, 5, 7, 11, 13];
  const factors = new Set(primeFactors(target));
  const choices = new Set<number>(standardPrimes);
  for (const f of factors) choices.add(f);
  return [...choices].sort((a, b) => a - b);
}

function generatePrimeFactors(seed: number, difficulty: number) {
  // difficulty 1: number 8-96, difficulty 2: 50-200
  // (d1 widened from 12-50 so the composite-with-small-primes pool clears 40)
  const [lo, hi] = difficulty <= 1 ? [8, 96] : [50, 200];
  const rng = new Rng(seed);
  // Reroll until we land on an interesting composite (>=2 prime factors) whose
  // largest prime is small enough for the tier. Fallback `lo` is a valid
  // composite for both tiers (8 = 2·2·2, 50 = 2·5·5).
  let target = lo;
  for (let i = 0; i < 80; i += 1) {
    const t = rng.int(lo, hi);
    if (primeFactors(t).length >= 2 && hasSmallPrimeFactors(t, difficulty)) {
      target = t;
      break;
    }
  }
  const factors = primeFactors(target);
  const answer = factors.join(" × ");
  return {
    promptText: `Find the complete prime factorisation of ${target}.\nWrite factors from smallest to largest separated by ×  (e.g. 2 × 2 × 3).`,
    data: {
      target,
      subType: "prime_factors" as SubType,
      primeChoices: primeChoicesFor(target)
    },
    answer,
    skillTags: ["prime_factorisation", "divisibility"]
  };
}

function generateGcf(seed: number, difficulty: number) {
  // difficulty 3: numbers 12-100, difficulty 4: 50-300
  const [lo, hi] = difficulty <= 3 ? [12, 100] : [50, 300];
  const rng = new Rng(seed);

  // Draw the two operands from INDEPENDENT streams and reroll until they share
  // rich common factors (gcf >= 4 and composite). Operands are canonicalised
  // a < b so mirror pairs aren't counted as separate puzzles.
  let a = lo;
  let b = lo === hi ? lo + 1 : hi;
  for (let i = 0; i < 80; i += 1) {
    const x = rng.int(lo, hi);
    const y = rng.int(lo, hi);
    if (x === y) continue;
    if (hasMultipleCommonFactors(x, y)) {
      a = Math.min(x, y);
      b = Math.max(x, y);
      break;
    }
  }

  const answer = gcd(a, b);
  return {
    promptText: `Find the Greatest Common Factor (GCF) of ${a} and ${b}.`,
    data: {
      a,
      b,
      subType: "gcf" as SubType,
      factorsA: primeFactors(a),
      factorsB: primeFactors(b)
    },
    answer: String(answer),
    skillTags: ["gcf", "divisibility", "number_theory"]
  };
}

function generateLcm(seed: number, difficulty: number) {
  // difficulty 5: numbers 4-30, difficulty 6+: 10-60
  const [lo, hi] = difficulty <= 5 ? [4, 30] : [10, 60];
  const rng = new Rng(seed);

  // Independent streams, canonicalised a < b, and reroll to keep the pair
  // non-trivial: coprime operands make the "LCM" just the product (boring),
  // so require a shared factor (gcd > 1).
  let a = lo;
  let b = lo === hi ? lo + 1 : hi;
  for (let i = 0; i < 80; i += 1) {
    const x = rng.int(lo, hi);
    const y = rng.int(lo, hi);
    if (x === y) continue;
    if (gcd(x, y) > 1) {
      a = Math.min(x, y);
      b = Math.max(x, y);
      break;
    }
  }

  const answer = lcm(a, b);
  return {
    promptText: `Find the Least Common Multiple (LCM) of ${a} and ${b}.`,
    data: {
      a,
      b,
      subType: "lcm" as SubType,
      factorsA: primeFactors(a),
      factorsB: primeFactors(b)
    },
    answer: String(answer),
    skillTags: ["lcm", "multiples", "number_theory"]
  };
}

// --- normalise answer strings for comparison ---

function normalisePrimeAnswer(raw: string): string {
  // accept × or x or * as separators; strip whitespace; sort factors
  const parts = raw
    .replace(/×/g, "*")
    .replace(/x/gi, "*")
    .split("*")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  parts.sort((a, b) => a - b);
  return parts.join(" × ");
}

// --- plugin ---

export const factorNinjaPlugin: GameTypePlugin = {
  id: "factor-ninja",
  name: "Factor Ninja",
  minGrade: 4,
  maxGrade: 8,
  description:
    "Prime factorisation, divisibility tests, and GCF/LCM challenges.",

  generate(input) {
    const st = subTypeForDifficulty(input.difficulty);
    let promptText: string;
    let data: Record<string, unknown>;
    let skillTags: string[];

    if (st === "prime_factors") {
      const g = generatePrimeFactors(input.seed, input.difficulty);
      promptText = g.promptText;
      data = g.data;
      skillTags = g.skillTags;
    } else if (st === "gcf") {
      const g = generateGcf(input.seed, input.difficulty);
      promptText = g.promptText;
      data = g.data;
      skillTags = g.skillTags;
    } else {
      const g = generateLcm(input.seed, input.difficulty);
      promptText = g.promptText;
      data = g.data;
      skillTags = g.skillTags;
    }

    return {
      gameTypeId: "factor-ninja",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: { text: promptText },
      data,
      metadata: {
        expectUniqueSolution: true,
        skillTags
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const st = candidate.data.subType as SubType;
    if (st === "prime_factors") {
      const target = Number(candidate.data.target);
      const factors = primeFactors(target);
      return [factors.join(" × ")];
    }
    if (st === "gcf") {
      const a = Number(candidate.data.a);
      const b = Number(candidate.data.b);
      return [String(gcd(a, b))];
    }
    if (st === "lcm") {
      const a = Number(candidate.data.a);
      const b = Number(candidate.data.b);
      return [String(lcm(a, b))];
    }
    return [];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues = [];
    const st = candidate.data.subType as SubType;

    if (!["prime_factors", "gcf", "lcm"].includes(st)) {
      issues.push({
        code: "unknown_subtype",
        message: `Unknown factor-ninja subType: ${st}`
      });
      return { ok: false, issues };
    }

    if (st === "prime_factors") {
      const target = Number(candidate.data.target);
      if (!Number.isInteger(target) || target < 2) {
        issues.push({
          code: "invalid_target",
          message: "Target must be an integer >= 2."
        });
      } else if (!hasSmallPrimeFactors(target, candidate.difficulty)) {
        issues.push({
          code: "large_prime",
          message: `Target ${target} has a prime factor too large for difficulty ${candidate.difficulty}.`
        });
      } else if (primeFactors(target).length < 2) {
        // Reject primes themselves — nothing to "split"
        issues.push({
          code: "is_prime",
          message: `Target ${target} is prime — not interesting to factorise.`
        });
      }
    } else {
      const a = Number(candidate.data.a);
      const b = Number(candidate.data.b);
      if (!Number.isInteger(a) || a < 2) {
        issues.push({ code: "invalid_a", message: "a must be integer >= 2." });
      }
      if (!Number.isInteger(b) || b < 2) {
        issues.push({ code: "invalid_b", message: "b must be integer >= 2." });
      }
      if (a === b) {
        issues.push({
          code: "same_values",
          message: "a and b must be different."
        });
      }
      if (st === "gcf" && Number.isInteger(a) && Number.isInteger(b) && !hasNontrivialGcf(a, b)) {
        issues.push({
          code: "trivial_gcf",
          message: "GCF is 1 — not an interesting problem."
        });
      }
      if (
        st === "gcf" &&
        candidate.difficulty <= 4 &&
        Number.isInteger(a) &&
        Number.isInteger(b) &&
        !hasMultipleCommonFactors(a, b)
      ) {
        issues.push({
          code: "thin_common_factors",
          message: "Medium GCF puzzles should include multiple common factors."
        });
      }
      if (
        st === "lcm" &&
        Number.isInteger(a) &&
        Number.isInteger(b) &&
        gcd(a, b) === 1
      ) {
        issues.push({
          code: "trivial_lcm",
          message: "LCM of coprime numbers is just their product — not interesting."
        });
      }
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const st = candidate.data.subType as SubType;

    if (st === "prime_factors") {
      const target = Number(candidate.data.target);
      const expected = primeFactors(target).join(" × ");
      return normalisePrimeAnswer(answer) === expected;
    }

    // GCF and LCM: simple integer comparison
    const trimmed = answer.trim();
    if (!/^\d+$/.test(trimmed)) return false;
    const userNum = Number(trimmed);

    if (st === "gcf") {
      return userNum === gcd(Number(candidate.data.a), Number(candidate.data.b));
    }
    if (st === "lcm") {
      return userNum === lcm(Number(candidate.data.a), Number(candidate.data.b));
    }
    return false;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const st = candidate.data.subType as SubType;

    if (st === "prime_factors") {
      const target = Number(candidate.data.target);
      const factors = primeFactors(target);
      const smallest = factors[0];
      return [
        `Start by checking if ${target} is divisible by the smallest primes: 2, 3, 5, 7...`,
        `The smallest prime factor is ${smallest}. Divide ${target} by ${smallest} and keep going.`,
        `The prime factorisation is ${factors.join(" × ")}.`
      ];
    }

    if (st === "gcf") {
      const a = Number(candidate.data.a);
      const b = Number(candidate.data.b);
      const answer = gcd(a, b);
      const factorsA = uniquePrimeFactors(a).join(", ");
      const factorsB = uniquePrimeFactors(b).join(", ");
      return [
        `Find the prime factors of both ${a} and ${b}, then pick the ones they share.`,
        `Prime factors of ${a}: ${factorsA}. Prime factors of ${b}: ${factorsB}.`,
        `The GCF is ${answer}.`
      ];
    }

    // LCM
    const a = Number(candidate.data.a);
    const b = Number(candidate.data.b);
    const answer = lcm(a, b);
    return [
      `Find the GCF of ${a} and ${b} first, then use: LCM = (${a} × ${b}) ÷ GCF.`,
      `The GCF of ${a} and ${b} is ${gcd(a, b)}.`,
      `The LCM is ${answer}.`
    ];
  }
};
