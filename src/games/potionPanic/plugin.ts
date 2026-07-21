import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type {
  PuzzleCandidate,
  ValidationIssue,
  ValidationResult
} from "../../core/types.ts";

// ===== Potion Panic =====
//
// A fraction-addition / equivalence game. The cauldron represents ONE WHOLE
// (capacity = 1). The puzzle names a target fill fraction of that capacity
// (e.g. "fill to 5/6"). The player is given a set of DISTINCT, reusable jug
// sizes (unit-ish fractions like 1/2, 1/3, 1/4, 1/6, 1/8, 1/12 — a jug can be
// poured as many times as the player likes, like a refillable ladle of that
// size) and must pour a multiset of jugs whose EXACT sum equals the target.
//
// There is usually more than one correct pour-set (e.g. 1/2 + 1/3 = 5/6, but
// so does 1/3 + 1/3 + 1/6), so this game is graded STRUCTURALLY rather than
// against one canonical string: `expectUniqueSolution` is always false, and
// `gradeAnswer` accepts ANY multiset of available jug sizes whose exact
// rational sum equals the target.
//
// ----- Answer format (documented contract) -----
// The submitted answer is a comma-separated multiset of "numerator/denominator"
// tokens, one per pour, order-independent, repeats allowed, e.g.:
//   "1/2,1/3"        (two pours: a 1/2 jug, then a 1/3 jug)
//   "1/6,1/6,1/6"    (the 1/6 jug poured three times)
// Whitespace around tokens/commas is ignored. Every token must exactly match
// (after reduction) one of the puzzle's available jug sizes, and the exact
// sum (computed with integer fraction arithmetic, never floating point) must
// equal the puzzle's target fraction.

// ===== Seeded RNG (xorshift32, avalanche-mixed — same approach as
// numberPaths/angleChaseStudio; NOT a raw seed % span generator) =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0x9e3779b9) >>> 0;
    if (this.s === 0) this.s = 1;
  }
  next(): number {
    this.s ^= this.s << 13;
    this.s ^= this.s >>> 17;
    this.s ^= this.s << 5;
    return (this.s >>> 0);
  }
  int(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[this.next() % arr.length];
  }
}

// ===== Exact fraction arithmetic (never floating point) =====

type Frac = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function reduceFrac(f: Frac): Frac {
  const sign = f.d < 0 ? -1 : 1;
  const n = f.n * sign;
  const d = f.d * sign;
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function addFrac(a: Frac, b: Frac): Frac {
  return reduceFrac({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
}

function subFrac(a: Frac, b: Frac): Frac {
  return reduceFrac({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
}

function fracEqual(a: Frac, b: Frac): boolean {
  return a.n * b.d === b.n * a.d;
}

// a <= b
function fracLte(a: Frac, b: Frac): boolean {
  return a.n * b.d <= b.n * a.d;
}

function fracToString(f: Frac): string {
  return `${f.n}/${f.d}`;
}

function unitFrac(d: number): Frac {
  return { n: 1, d };
}

function isProperOrFullFrac(f: unknown): f is Frac {
  if (!f || typeof f !== "object") return false;
  const { n, d } = f as Frac;
  return (
    Number.isInteger(n) &&
    Number.isInteger(d) &&
    n > 0 &&
    d > 0 &&
    n <= d
  );
}

// ===== Difficulty tiers =====

type TierConfig = {
  solutionDenoms: number[];
  pourMin: number;
  pourMax: number;
  jugCountMin: number;
  jugCountMax: number;
  nearFullMin?: Frac; // if set, prefer a target >= this fraction of capacity
};

const TIERS: Record<number, TierConfig> = {
  1: { solutionDenoms: [2, 4], pourMin: 2, pourMax: 2, jugCountMin: 3, jugCountMax: 4 },
  2: { solutionDenoms: [2, 3, 4, 6], pourMin: 2, pourMax: 2, jugCountMin: 4, jugCountMax: 5 },
  3: {
    solutionDenoms: [2, 3, 4, 6, 8],
    pourMin: 2,
    pourMax: 3,
    jugCountMin: 4,
    jugCountMax: 5,
    nearFullMin: { n: 1, d: 2 }
  },
  4: {
    solutionDenoms: [3, 4, 6, 8, 12],
    pourMin: 3,
    pourMax: 3,
    jugCountMin: 5,
    jugCountMax: 6,
    nearFullMin: { n: 2, d: 3 }
  },
  5: {
    solutionDenoms: [2, 3, 4, 6, 8, 12],
    pourMin: 3,
    pourMax: 4,
    jugCountMin: 5,
    jugCountMax: 6,
    nearFullMin: { n: 3, d: 4 }
  },
  6: {
    solutionDenoms: [2, 3, 4, 6, 8, 12],
    pourMin: 3,
    pourMax: 4,
    jugCountMin: 6,
    jugCountMax: 7,
    nearFullMin: { n: 5, d: 6 }
  }
};

const FULL_DENOM_POOL = [2, 3, 4, 5, 6, 8, 10, 12];

function tierFor(difficulty: number): TierConfig {
  const d = Math.max(1, Math.min(6, Math.round(difficulty)));
  return TIERS[d];
}

const POTION_NAMES = [
  "Emerald Fizz",
  "Moonlight Brew",
  "Dragon's Breath Tonic",
  "Shimmering Frost Potion",
  "Golden Courage Elixir",
  "Midnight Whisper Potion",
  "Sunfire Serum",
  "Twilight Bloom Brew",
  "Crystal Echo Potion",
  "Starlight Slumber Draft",
  "Phoenix Ember Tonic",
  "Silver Mist Elixir",
  "Glimmerroot Draught",
  "Wisplight Concoction"
];

// ===== Generation =====

type BuiltSolution = { pours: Frac[]; total: Frac };

function buildSolutionPours(rng: Rng, cfg: TierConfig): BuiltSolution {
  const pourCount =
    cfg.pourMin === cfg.pourMax ? cfg.pourMin : rng.int(cfg.pourMin, cfg.pourMax);

  let fallback: BuiltSolution | null = null;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const pours: Frac[] = [];
    let total: Frac = { n: 0, d: 1 };

    for (let i = 0; i < pourCount; i += 1) {
      let placed = false;
      for (let t = 0; t < cfg.solutionDenoms.length * 3 && !placed; t += 1) {
        const d = rng.pick(cfg.solutionDenoms);
        const candidateTotal = addFrac(total, unitFrac(d));
        if (candidateTotal.n <= candidateTotal.d) {
          total = candidateTotal;
          pours.push(unitFrac(d));
          placed = true;
        }
      }
      if (!placed) break; // no denominator fits without exceeding capacity; stop early
    }

    if (pours.length < 2) continue;

    const meetsNearFull = !cfg.nearFullMin || fracLte(cfg.nearFullMin, total);
    if (meetsNearFull) return { pours, total };

    if (!fallback || total.n * fallback.total.d > fallback.total.n * total.d) {
      fallback = { pours, total };
    }
  }

  return fallback || { pours: [unitFrac(2), unitFrac(4)], total: { n: 3, d: 4 } };
}

function buildJugList(rng: Rng, cfg: TierConfig, solutionPours: Frac[]): Frac[] {
  const jugDenoms = new Set<number>(solutionPours.map((p) => p.d));
  const jugCount =
    cfg.jugCountMin === cfg.jugCountMax
      ? cfg.jugCountMin
      : rng.int(cfg.jugCountMin, cfg.jugCountMax);

  const remaining = FULL_DENOM_POOL.filter((d) => !jugDenoms.has(d));
  while (jugDenoms.size < jugCount && remaining.length > 0) {
    const idx = rng.int(0, remaining.length - 1);
    jugDenoms.add(remaining[idx]);
    remaining.splice(idx, 1);
  }

  return Array.from(jugDenoms)
    .sort((a, b) => a - b)
    .map(unitFrac);
}

type ChainStep = { pour: Frac; runningTotal: Frac };

function buildChain(pours: Frac[]): ChainStep[] {
  let running: Frac = { n: 0, d: 1 };
  return pours.map((p) => {
    running = addFrac(running, p);
    return { pour: p, runningTotal: running };
  });
}

// ===== Plugin =====

export const potionPanicPlugin: GameTypePlugin = {
  id: "potion-panic",
  name: "Potion Panic",
  minGrade: 4,
  maxGrade: 6,
  description:
    "Pour jugs of different fractional sizes into a cauldron to fill it to an exact target fraction — discover fraction addition and equivalence by mixing unlike denominators without overflowing.",

  generate(input) {
    const cfg = tierFor(input.difficulty);
    const rng = new Rng(input.seed);

    const { pours, total } = buildSolutionPours(rng, cfg);
    const jugs = buildJugList(rng, cfg, pours);
    const potionName = rng.pick(POTION_NAMES);
    const targetStr = fracToString(total);
    const chain = buildChain(pours).map((step) => ({
      pour: step.pour,
      pourStr: fracToString(step.pour),
      runningTotal: step.runningTotal,
      runningTotalStr: fracToString(step.runningTotal)
    }));

    return {
      gameTypeId: "potion-panic",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Brew the ${potionName}! Pour jugs into the cauldron until it holds exactly ${targetStr} of its capacity. Pour carefully — going past ${targetStr} overflows, and you'll need to ladle a pour back out.`
      },
      data: {
        potionName,
        target: total,
        targetStr,
        jugs,
        solutionPours: pours,
        chain
      },
      metadata: {
        expectUniqueSolution: false,
        skillTags: [
          "fractions",
          "fraction_addition",
          "unlike_denominators",
          "equivalent_fractions",
          "common_denominators"
        ]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const pours = candidate.data.solutionPours as Frac[] | undefined;
    if (!Array.isArray(pours) || pours.length === 0) return [];
    const sorted = [...pours].sort((a, b) => a.n / a.d - b.n / b.d);
    return [sorted.map(fracToString).join(",")];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues: ValidationIssue[] = [];
    const target = candidate.data.target as Frac | undefined;
    const targetStr = candidate.data.targetStr as string | undefined;
    const jugs = candidate.data.jugs as Frac[] | undefined;
    const pours = candidate.data.solutionPours as Frac[] | undefined;

    if (!target || !isProperOrFullFrac(target)) {
      issues.push({ code: "bad_target", message: "target must be a proper (or whole) fraction." });
    } else if (typeof targetStr !== "string" || targetStr !== fracToString(target)) {
      issues.push({ code: "bad_target_str", message: "targetStr does not match target fraction." });
    }

    let jugsOk = true;
    if (!Array.isArray(jugs) || jugs.length < 2) {
      jugsOk = false;
      issues.push({ code: "bad_jugs", message: "jugs must be an array of at least 2 fractions." });
    } else {
      const seen = new Set<string>();
      for (const j of jugs) {
        if (!isProperOrFullFrac(j)) {
          jugsOk = false;
          issues.push({ code: "bad_jug", message: "Every jug must be a proper (or whole) fraction." });
          break;
        }
        const key = fracToString(reduceFrac(j));
        if (seen.has(key)) {
          jugsOk = false;
          issues.push({ code: "duplicate_jug", message: "Jug list must have distinct fraction values." });
          break;
        }
        seen.add(key);
      }
    }

    if (!Array.isArray(pours) || pours.length < 2) {
      issues.push({ code: "too_few_pours", message: "solutionPours must have at least 2 pours." });
    } else if (jugsOk && target) {
      let sum: Frac = { n: 0, d: 1 };
      let pourIssue = false;
      for (const p of pours) {
        if (!isProperOrFullFrac(p)) {
          pourIssue = true;
          break;
        }
        const matchesJug = (jugs as Frac[]).some((j) => fracEqual(j, p));
        if (!matchesJug) {
          pourIssue = true;
          break;
        }
        sum = addFrac(sum, p);
        if (!fracLte(sum, { n: 1, d: 1 })) {
          pourIssue = true;
          break;
        }
      }
      if (pourIssue) {
        issues.push({ code: "bad_pour", message: "A solution pour is invalid, not an available jug, or overflows." });
      } else if (!fracEqual(sum, target)) {
        issues.push({ code: "sum_mismatch", message: "solutionPours does not sum exactly to target." });
      }
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const jugs = candidate.data.jugs as Frac[] | undefined;
    const target = candidate.data.target as Frac | undefined;
    if (!Array.isArray(jugs) || jugs.length === 0 || !target) return false;

    const raw = String(answer ?? "").trim();
    if (raw === "") return false;

    const tokens = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return false;

    let sum: Frac = { n: 0, d: 1 };
    for (const tok of tokens) {
      const m = tok.match(/^(\d+)\s*\/\s*(\d+)$/);
      if (!m) return false;
      const n = Number(m[1]);
      const d = Number(m[2]);
      if (!Number.isInteger(n) || !Number.isInteger(d) || n <= 0 || d <= 0) return false;
      const frac = reduceFrac({ n, d });
      const matchesJug = jugs.some((j) => fracEqual(j, frac));
      if (!matchesJug) return false;
      sum = addFrac(sum, frac);
    }

    return fracEqual(sum, target);
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const target = candidate.data.target as Frac | undefined;
    const targetStr = (candidate.data.targetStr as string) || (target ? fracToString(target) : "");
    const jugs = (candidate.data.jugs as Frac[]) || [];
    const chain = (candidate.data.chain as { pourStr: string; runningTotal: Frac }[]) || [];

    const jugList = jugs.map(fracToString).join(", ");
    const hint1 = `You need to reach exactly ${targetStr}. Look at your jugs (${jugList}) — which two or three of them share a common denominator that adds up to ${targetStr}?`;

    let hint2 = "Try pouring one jug, then figure out exactly how much more is needed to reach the target.";
    if (chain.length > 0 && target) {
      const first = chain[0];
      const remainder = subFrac(target, first.runningTotal);
      hint2 = `Try pouring the ${first.pourStr} jug first. After that, you still need ${fracToString(remainder)} more to reach ${targetStr} — which jug (or combination) matches that exactly?`;
    }

    const hint3 =
      chain.length > 0
        ? `One way to reach ${targetStr}: pour ${chain.map((c) => c.pourStr).join(", then ")}.`
        : `The target is ${targetStr}.`;

    return [hint1, hint2, hint3];
  }
};
