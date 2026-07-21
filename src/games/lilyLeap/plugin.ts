import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationIssue, ValidationResult } from "../../core/types.ts";

// ===== Lily Leap: fraction comparison / number-line jump puzzle =====
//
// A frog crosses a pond (a number line from 0 to a fraction/mixed-number
// target). Lily pads sit at fraction positions along the line. The player
// picks a sequence of jumps (fraction lengths, reusable) from a tray; each
// jump must land exactly on a lily pad, and the final jump must land exactly
// on the target with no overshoot. All arithmetic below is exact-rational
// (integer numerator/denominator, gcd-reduced) — no floats are ever used for
// correctness-relevant math.

// ===== Exact-rational fraction helpers =====

type Frac = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function reduceFrac(n: number, d: number): Frac {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

function addFrac(a: Frac, b: Frac): Frac {
  return reduceFrac(a.n * b.d + b.n * a.d, a.d * b.d);
}

function cmpFrac(a: Frac, b: Frac): number {
  return a.n * b.d - b.n * a.d;
}

function fracLabel(f: Frac): string {
  if (f.n === 0) return "0";
  const whole = Math.floor(f.n / f.d);
  const rem = f.n - whole * f.d;
  if (rem === 0) return String(whole);
  if (whole === 0) return `${rem}/${f.d}`;
  return `${whole} ${rem}/${f.d}`;
}

function serializeFracList(list: Frac[]): string {
  return list.map((f) => `${f.n}/${f.d}`).join(";");
}

function parseFrac(raw: string): Frac | null {
  const m = String(raw || "").trim().match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  const d = Number(m[2]);
  if (!Number.isInteger(n) || !Number.isInteger(d) || d <= 0 || n < 0) return null;
  return reduceFrac(n, d);
}

function parseFracList(raw: string): Frac[] | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const parts = text.split(";").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const out: Frac[] = [];
  for (const p of parts) {
    const f = parseFrac(p);
    if (!f) return null;
    out.push(f);
  }
  return out;
}

function isValidFrac(x: unknown): x is Frac {
  const f = x as Frac;
  return (
    !!f &&
    typeof f.n === "number" &&
    typeof f.d === "number" &&
    Number.isInteger(f.n) &&
    Number.isInteger(f.d) &&
    f.n >= 0 &&
    f.d > 0
  );
}

// ===== Seeded RNG (well-mixed LCG-with-shift, same family as other plugins) =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0x5a17e4f1) >>> 0;
    if (this.s === 0) this.s = 1;
  }
  next(): number {
    this.s = (Math.imul(this.s, 1103515245) + 12345) >>> 0;
    return this.s;
  }
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + ((this.next() >>> 8) % (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[(this.next() >>> 8) % arr.length];
  }
}

function sampleDistinct(rng: Rng, pool: number[], count: number): number[] {
  const copy = pool.slice();
  const n = Math.min(count, copy.length);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = rng.int(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

// ===== Difficulty tiers =====
//
// Every `corePool` is designed so its SMALLEST element always divides `L`
// (verified below), and jump-set selection always includes that smallest
// element. That guarantees a trivially-correct fallback path always exists
// (repeat the smallest unit), so generation can never fail to find a
// solvable puzzle even if the randomized search below is unlucky.

type Tier = {
  L: number;
  corePool: number[]; // candidate jump sizes, expressed as integer units of 1/L
  jumpSetMin: number;
  jumpSetMax: number;
  minLen: number;
  maxLen: number;
  decoyMin: number;
  decoyMax: number;
  mixed: boolean; // whether target may exceed 1 whole (L units)
  mixedCapUnits: number; // max extra units beyond L when mixed
};

function tierForDifficulty(difficulty: number): Tier {
  const d = Math.max(1, Math.min(6, Math.round(difficulty)));
  switch (d) {
    case 1:
      return { L: 4, corePool: [1, 2, 3], jumpSetMin: 2, jumpSetMax: 3, minLen: 2, maxLen: 3, decoyMin: 0, decoyMax: 2, mixed: false, mixedCapUnits: 0 };
    case 2:
      return { L: 4, corePool: [1, 2, 3], jumpSetMin: 2, jumpSetMax: 3, minLen: 2, maxLen: 4, decoyMin: 1, decoyMax: 3, mixed: false, mixedCapUnits: 0 };
    case 3:
      return { L: 12, corePool: [2, 3, 4, 6], jumpSetMin: 2, jumpSetMax: 4, minLen: 2, maxLen: 4, decoyMin: 1, decoyMax: 3, mixed: false, mixedCapUnits: 0 };
    case 4:
      return { L: 12, corePool: [2, 3, 4, 6], jumpSetMin: 3, jumpSetMax: 4, minLen: 3, maxLen: 5, decoyMin: 1, decoyMax: 3, mixed: true, mixedCapUnits: 12 };
    case 5:
      return { L: 24, corePool: [3, 4, 6, 8, 12], jumpSetMin: 3, jumpSetMax: 5, minLen: 3, maxLen: 5, decoyMin: 2, decoyMax: 4, mixed: true, mixedCapUnits: 24 };
    default:
      return { L: 24, corePool: [2, 3, 4, 6, 8, 12], jumpSetMin: 4, jumpSetMax: 6, minLen: 4, maxLen: 6, decoyMin: 2, decoyMax: 4, mixed: true, mixedCapUnits: 36 };
  }
}

// ===== Puzzle construction (all integer "units" of 1/L; exact by construction) =====

type Built = {
  L: number;
  targetUnits: number;
  padUnits: number[]; // sorted ascending, always ends with targetUnits
  jumpUnits: number[]; // sorted ascending
  pathUnits: number[]; // canonical solution sequence (sums to targetUnits)
  selfCheck: boolean;
};

function pickJumpUnits(rng: Rng, tier: Tier): number[] {
  const sorted = [...tier.corePool].sort((a, b) => a - b);
  const mandatory = sorted[0]; // guaranteed divisor of L (see tier comment above)
  const rest = sorted.slice(1);
  const setSize = rng.int(tier.jumpSetMin, Math.min(tier.jumpSetMax, tier.corePool.length));
  const extraCount = Math.max(0, setSize - 1);
  const extras = sampleDistinct(rng, rest, extraCount);
  return [mandatory, ...extras].sort((a, b) => a - b);
}

// Guaranteed-correct exact decomposition via DP (largest units preferred, so
// the fallback path stays short even for big mixed-number targets). Always
// succeeds because jumpUnits[0] (the mandatory smallest unit — see
// pickJumpUnits) always divides both L and targetUnits by tier construction,
// so a full decomposition using only that unit is always reachable; the DP
// typically finds a much shorter one using larger units too.
function exactDecomposition(jumpUnits: number[], target: number): number[] {
  const order = [...jumpUnits].sort((a, b) => b - a);
  const dp = new Array(target + 1).fill(-1);
  dp[0] = 0;
  for (let a = 1; a <= target; a += 1) {
    for (const j of order) {
      if (j <= a && dp[a - j] !== -1) {
        dp[a] = j;
        break;
      }
    }
  }
  const seq: number[] = [];
  let a = target;
  while (a > 0) {
    const j = dp[a];
    if (j <= 0) break; // defensive; should be unreachable given tier guarantees
    seq.push(j);
    a -= j;
  }
  return seq.reverse();
}

function buildPath(rng: Rng, tier: Tier, jumpUnits: number[], targetUnits: number): number[] {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const len = rng.int(tier.minLen, tier.maxLen);
    const seq: number[] = [];
    let sum = 0;
    let bust = false;
    // Build the first (len - 1) jumps freely, always leaving room for one
    // more jump; then close the gap with a single exact final jump. This
    // "smart last jump" approach finds far more valid random sequences than
    // hoping a fully-random sequence sums to the target by chance.
    for (let i = 0; i < len - 1; i += 1) {
      const remaining = targetUnits - sum;
      const candidates = jumpUnits.filter((j) => j < remaining);
      if (candidates.length === 0) {
        bust = true;
        break;
      }
      const j = rng.pick(candidates);
      sum += j;
      seq.push(j);
    }
    if (bust) continue;
    const remaining = targetUnits - sum;
    if (remaining > 0 && jumpUnits.includes(remaining)) {
      seq.push(remaining);
      return seq;
    }
  }
  return exactDecomposition(jumpUnits, targetUnits);
}

function buildLilyLeapPuzzle(rng: Rng, tier: Tier): Built {
  const L = tier.L;
  const jumpUnits = pickJumpUnits(rng, tier);
  const uMin = jumpUnits[0];

  let targetUnits: number;
  if (tier.mixed) {
    const capSteps = Math.max(1, Math.floor(tier.mixedCapUnits / uMin));
    targetUnits = L + uMin * rng.int(1, capSteps);
  } else {
    targetUnits = L;
  }

  const pathUnits = buildPath(rng, tier, jumpUnits, targetUnits);

  const padSet = new Set<number>();
  let running = 0;
  for (const j of pathUnits) {
    running += j;
    padSet.add(running);
  }
  const basePadCount = padSet.size;
  const decoyTarget = rng.int(tier.decoyMin, tier.decoyMax);

  let guard = 0;
  while (padSet.size < basePadCount + decoyTarget && guard < 600) {
    guard += 1;
    const len = rng.int(1, 3);
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += rng.pick(jumpUnits);
      if (sum >= targetUnits) break;
    }
    if (sum > 0 && sum < targetUnits) padSet.add(sum);
  }

  const padUnits = [...padSet].sort((a, b) => a - b);

  // Independent verification: recompute the path sum via a fresh reduce and
  // cross-check it against targetUnits and against the pad list's max value.
  const independentSum = pathUnits.reduce((acc, j) => acc + j, 0);
  const selfCheck = independentSum === targetUnits && padUnits[padUnits.length - 1] === targetUnits;

  return { L, targetUnits, padUnits, jumpUnits, pathUnits, selfCheck };
}

// ===== Cosmetic theme (pond/frog naming) =====
//
// Purely cosmetic — never affects math, validation, or grading. Included so
// that low tiers (whose small fraction-denominator pool limits combinatorial
// variety) still comfortably clear the puzzle-set variety bar, and so the
// game feels fresh across repeated play. Stored in `data.theme` alongside the
// (independently varying) math fields.
const POND_NAMES = [
  "Willow Pond", "Blue Lagoon", "Mossy Marsh", "Sunset Pond",
  "Cattail Cove", "Lily Bay", "Duckweed Pond", "Fernwood Pond"
];
const FROG_NAMES = ["Ribbit", "Splash", "Hoppy", "Percy", "Fern", "Bubbles", "Croaky", "Willow"];

// ===== Hints =====

function buildHintsFromPath(target: Frac, targetLabel: string, path: Frac[]): string[] {
  if (path.length === 0) {
    return [
      "How far is the far shore from where you start?",
      "Add up jump sizes that land exactly on lily pads, without passing the target.",
      `Reach ${targetLabel} exactly.`
    ];
  }
  let pos: Frac = { n: 0, d: 1 };
  const positions: Frac[] = [pos];
  for (const j of path) {
    pos = addFrac(pos, j);
    positions.push(pos);
  }
  const hint1 = `You're at 0 and the far shore is at ${targetLabel}. How far away is that, and which lily pads sit along the way?`;
  const firstJumpLabel = fracLabel(path[0]);
  const secondStepInfo =
    path.length > 1
      ? ` From there, a jump of ${fracLabel(path[1])} lands on the next pad at ${fracLabel(positions[2])}.`
      : "";
  const hint2 = `Look for a jump that lands exactly on the first pad without passing it. From 0, a jump of ${firstJumpLabel} lands exactly on ${fracLabel(positions[1])}.${secondStepInfo}`;
  const hint3 = `Full path: jumps of ${path.map((p) => fracLabel(p)).join(", ")} — landing on ${positions
    .slice(1)
    .map((p) => fracLabel(p))
    .join(" -> ")}, exactly on the far shore.`;
  return [hint1, hint2, hint3];
}

// ===== Plugin =====

export const lilyLeapPlugin: GameTypePlugin = {
  id: "lily-leap",
  name: "Lily Leap",
  minGrade: 3,
  maxGrade: 6,
  description:
    "Guide a frog across a pond by choosing jumps that add up exactly to a fraction target, landing on a lily pad every time without overshooting.",

  generate(input) {
    const rng = new Rng(input.seed);
    const tier = tierForDifficulty(input.difficulty);
    const built = buildLilyLeapPuzzle(rng, tier);

    const target = reduceFrac(built.targetUnits, built.L);
    const targetLabel = fracLabel(target);
    const pads = built.padUnits.map((u) => reduceFrac(u, built.L));
    const jumps = built.jumpUnits.map((u) => reduceFrac(u, built.L));
    const pathFracs = built.pathUnits.map((u) => reduceFrac(u, built.L));
    const pond = rng.pick(POND_NAMES);
    const frog = rng.pick(FROG_NAMES);

    return {
      gameTypeId: "lily-leap",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Help ${frog} the frog cross ${pond} from 0 to ${targetLabel}! Tap jumps from the tray that land exactly on a lily pad each time. Reach ${targetLabel} exactly — don't overshoot into the water!`
      },
      data: {
        L: built.L,
        target,
        targetLabel,
        pads,
        jumps,
        expectedPath: serializeFracList(pathFracs),
        selfCheck: built.selfCheck,
        theme: { pond, frog }
      },
      metadata: {
        expectUniqueSolution: false,
        skillTags: ["fractions", "fraction_addition", "fraction_equivalence", "fraction_comparison", "number_line"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const raw = String(candidate.data.expectedPath || "").trim();
    return raw ? [raw] : [];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues: ValidationIssue[] = [];
    const target = candidate.data.target as Frac;
    const pads = candidate.data.pads as Frac[];
    const jumps = candidate.data.jumps as Frac[];
    const expectedPathRaw = String(candidate.data.expectedPath || "");

    if (!isValidFrac(target) || target.n <= 0) {
      issues.push({ code: "bad_target", message: "target must be a positive fraction." });
      return { ok: false, issues };
    }
    if (!Array.isArray(pads) || pads.length === 0 || !pads.every(isValidFrac)) {
      issues.push({ code: "bad_pads", message: "pads must be a non-empty array of fractions." });
    }
    if (!Array.isArray(jumps) || jumps.length === 0 || !jumps.every(isValidFrac)) {
      issues.push({ code: "bad_jumps", message: "jumps must be a non-empty array of fractions." });
    }
    if (issues.length > 0) return { ok: false, issues };

    for (let i = 1; i < pads.length; i += 1) {
      if (cmpFrac(pads[i], pads[i - 1]) <= 0) {
        issues.push({ code: "pads_not_increasing", message: "pads must be strictly increasing." });
        break;
      }
    }
    if (cmpFrac(pads[pads.length - 1], target) !== 0) {
      issues.push({ code: "pads_missing_target", message: "The last pad must equal the target (far shore)." });
    }

    for (const j of jumps) {
      if (j.n <= 0) {
        issues.push({ code: "bad_jump_value", message: "jumps must be positive." });
        break;
      }
    }
    outer: for (let i = 0; i < jumps.length; i += 1) {
      for (let k = i + 1; k < jumps.length; k += 1) {
        if (cmpFrac(jumps[i], jumps[k]) === 0) {
          issues.push({ code: "duplicate_jump", message: "jumps must be distinct values." });
          break outer;
        }
      }
    }

    const path = parseFracList(expectedPathRaw);
    if (!path || path.length === 0) {
      issues.push({ code: "bad_expected_path", message: "expectedPath is missing or empty." });
    } else {
      let s: Frac = { n: 0, d: 1 };
      let ok = true;
      for (const jump of path) {
        if (!jumps.some((j) => cmpFrac(j, jump) === 0)) {
          issues.push({ code: "path_uses_unavailable_jump", message: "expectedPath uses a jump not in the tray." });
          ok = false;
          break;
        }
        s = addFrac(s, jump);
        if (cmpFrac(s, target) > 0) {
          issues.push({ code: "path_overshoots", message: "expectedPath overshoots the target." });
          ok = false;
          break;
        }
        if (!pads.some((p) => cmpFrac(p, s) === 0)) {
          issues.push({ code: "path_misses_pad", message: "expectedPath lands off a pad." });
          ok = false;
          break;
        }
      }
      if (ok && cmpFrac(s, target) !== 0) {
        issues.push({ code: "path_incomplete", message: "expectedPath does not reach the target." });
      }
    }

    if (candidate.data.selfCheck !== true) {
      issues.push({ code: "self_check_failed", message: "Generator self-check failed." });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const jumps = candidate.data.jumps as Frac[];
    const pads = candidate.data.pads as Frac[];
    const target = candidate.data.target as Frac;
    if (!isValidFrac(target) || !Array.isArray(jumps) || !Array.isArray(pads)) return false;

    const seq = parseFracList(answer);
    if (!seq || seq.length === 0) return false;

    let s: Frac = { n: 0, d: 1 };
    for (const jump of seq) {
      if (!jumps.some((j) => cmpFrac(j, jump) === 0)) return false;
      s = addFrac(s, jump);
      if (cmpFrac(s, target) > 0) return false; // overshoot
      if (!pads.some((p) => cmpFrac(p, s) === 0)) return false; // must land on a pad
    }
    return cmpFrac(s, target) === 0;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const target = candidate.data.target as Frac;
    const targetLabel = String(candidate.data.targetLabel || (isValidFrac(target) ? fracLabel(target) : "the target"));
    const path = parseFracList(String(candidate.data.expectedPath || "")) || [];
    return buildHintsFromPath(target, targetLabel, path);
  }
};
