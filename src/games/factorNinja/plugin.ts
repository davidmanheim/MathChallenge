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

function seededInt(seed: number, min: number, max: number): number {
  return min + (Math.abs(seed) % (max - min + 1));
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

// --- generator helpers per sub-type ---

function primeChoicesFor(target: number): number[] {
  const standardPrimes = [2, 3, 5, 7, 11, 13];
  const factors = new Set(primeFactors(target));
  const choices = new Set<number>(standardPrimes);
  for (const f of factors) choices.add(f);
  return [...choices].sort((a, b) => a - b);
}

function generatePrimeFactors(seed: number, difficulty: number) {
  // difficulty 1: number 12-50, difficulty 2: 50-200
  const [lo, hi] = difficulty <= 1 ? [12, 50] : [50, 200];
  const target = seededInt(seed, lo, hi);
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
  const a = seededInt(seed, lo, hi);
  const b = seededInt(seed * 7 + 13, lo, hi);
  // ensure they are different
  const bAdjusted = b === a ? a + seededInt(seed * 3, 1, 10) : b;
  const answer = gcd(a, bAdjusted);
  return {
    promptText: `Find the Greatest Common Factor (GCF) of ${a} and ${bAdjusted}.`,
    data: {
      a,
      b: bAdjusted,
      subType: "gcf" as SubType,
      factorsA: primeFactors(a),
      factorsB: primeFactors(bAdjusted)
    },
    answer: String(answer),
    skillTags: ["gcf", "divisibility", "number_theory"]
  };
}

function generateLcm(seed: number, difficulty: number) {
  // difficulty 5: numbers 4-30, difficulty 6+: 10-60
  const [lo, hi] = difficulty <= 5 ? [4, 30] : [10, 60];
  const a = seededInt(seed, lo, hi);
  const b = seededInt(seed * 11 + 7, lo, hi);
  const bAdjusted = b === a ? a + seededInt(seed * 3, 1, 5) : b;
  const answer = lcm(a, bAdjusted);
  return {
    promptText: `Find the Least Common Multiple (LCM) of ${a} and ${bAdjusted}.`,
    data: {
      a,
      b: bAdjusted,
      subType: "lcm" as SubType,
      factorsA: primeFactors(a),
      factorsB: primeFactors(bAdjusted)
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
