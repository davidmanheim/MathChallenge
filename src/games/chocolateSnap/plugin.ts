import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type {
  PuzzleCandidate,
  ValidationIssue,
  ValidationResult
} from "../../core/types.ts";

// ===== Seeded RNG (avalanche-mixed LCG, same approach as angleChaseStudio /
// countingLab — NOT a `seed % span` pattern, which correlates low bits across
// nearby seeds and collapses variety). =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0x5bd1e995) >>> 0;
  }
  next(): number {
    // Math.imul keeps this a precision-safe 32-bit multiply.
    this.s = (Math.imul(this.s, 1103515245) + 12345) >>> 0;
    return this.s;
  }
  int(min: number, max: number): number {
    // Shift out the low 8 bits before reducing — LCG low bits are short-period
    // and correlated, which is fatal for small-modulus choices.
    return min + ((this.next() >>> 8) % (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[(this.next() >>> 8) % arr.length];
  }
}

// ===== Exact-rational helpers (two INDEPENDENT gcd implementations: one used
// by generation, a structurally different one used only to cross-check in
// validatePuzzle, so a shared bug can't silently pass both). =====

function gcdEuclid(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

// Binary (Stein's) GCD — an algorithmically different route to the same
// answer, used only as an independent cross-check.
function gcdBinary(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  if (a === 0) return b || 1;
  if (b === 0) return a || 1;
  let shift = 0;
  while (((a | b) & 1) === 0) {
    a >>= 1;
    b >>= 1;
    shift++;
  }
  while ((a & 1) === 0) a >>= 1;
  while (b !== 0) {
    while ((b & 1) === 0) b >>= 1;
    if (a > b) [a, b] = [b, a];
    b -= a;
  }
  return (a << shift) || 1;
}

type Fraction = { num: number; den: number };

function reduceFraction(num: number, den: number): Fraction {
  const g = gcdEuclid(num, den);
  return { num: num / g, den: den / g };
}

// ===== Fraction pools per difficulty tier =====

function fractionsForDenoms(denoms: number[]): Fraction[] {
  const out: Fraction[] = [];
  for (const den of denoms) {
    for (let num = 1; num < den; num++) {
      if (gcdEuclid(num, den) === 1) out.push({ num, den });
    }
  }
  return out;
}

const DENOM_SETS: Record<number, number[]> = {
  1: [2, 3, 4],
  2: [2, 3, 4, 5],
  3: [3, 4, 5, 6],
  4: [4, 5, 6, 7],
  5: [4, 5, 6, 7, 8],
  6: [5, 6, 7, 8, 9]
};

const CHOCOLATE_FLAVORS = [
  "milk chocolate",
  "dark chocolate",
  "white chocolate",
  "mint chocolate",
  "hazelnut praline",
  "sea salt caramel",
  "raspberry swirl",
  "orange zest"
];

type Axis = "cols" | "rows";

type GenResult = {
  promptText: string;
  buildingExpression: string;
  pNum: number;
  pDen: number;
  tNum: number;
  tDen: number;
  axisForP: Axis;
  rows: number;
  cols: number;
  overlapCells: number;
  totalCells: number;
  reducedNum: number;
  reducedDen: number;
  requiresSimplification: boolean;
  selfCheck: boolean;
  flavor: string;
  variant: string;
};

// Independent verification: brute-force count the overlap region cell-by-cell
// (rather than trusting the num1*num2 shortcut) and cross-check the reduced
// fraction with a second, structurally different gcd algorithm.
function bruteForceOverlapCells(
  rows: number,
  cols: number,
  axisForP: Axis,
  pNum: number,
  tNum: number
): number {
  // Overlap region is always the top-left pNum x tNum (or tNum x pNum) block,
  // whichever axis carries which fraction — see generate() for the mapping.
  const rowLimit = axisForP === "cols" ? tNum : pNum;
  const colLimit = axisForP === "cols" ? pNum : tNum;
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r < rowLimit && c < colLimit) count++;
    }
  }
  return count;
}

function buildPuzzle(rng: Rng, difficulty: number): GenResult {
  const d = Math.max(1, Math.min(6, Math.round(difficulty)));
  const denoms = DENOM_SETS[d];
  const fractions = fractionsForDenoms(denoms);

  let pFrac = rng.pick(fractions);
  let tFrac = rng.pick(fractions);

  // At the two hardest tiers, bias toward products that actually need
  // simplifying (per the design's difficulty-scaling spec), without ever
  // failing generation if none turns up within a few tries.
  if (d >= 5) {
    for (let tries = 0; tries < 6; tries++) {
      const g = gcdEuclid(pFrac.num * tFrac.num, pFrac.den * tFrac.den);
      if (g > 1) break;
      pFrac = rng.pick(fractions);
      tFrac = rng.pick(fractions);
    }
  }

  const axisForP: Axis = rng.pick(["cols", "rows"]);
  const flavor = rng.pick(CHOCOLATE_FLAVORS);

  const rows = axisForP === "cols" ? tFrac.den : pFrac.den;
  const cols = axisForP === "cols" ? pFrac.den : tFrac.den;

  const overlapNumerator = pFrac.num * tFrac.num;
  const totalCells = pFrac.den * tFrac.den;
  const { num: reducedNum, den: reducedDen } = reduceFraction(overlapNumerator, totalCells);

  // Independent cross-check #1: brute-force cell counting instead of the
  // num1*num2 shortcut.
  const bruteOverlap = bruteForceOverlapCells(rows, cols, axisForP, pFrac.num, tFrac.num);
  // Independent cross-check #2: a structurally different gcd algorithm.
  const gBinary = gcdBinary(overlapNumerator, totalCells);
  const reducedNumBinary = overlapNumerator / gBinary;
  const reducedDenBinary = totalCells / gBinary;

  const selfCheck =
    bruteOverlap === overlapNumerator &&
    rows * cols === totalCells &&
    reducedNumBinary === reducedNum &&
    reducedDenBinary === reducedDen &&
    reducedNum * totalCells === overlapNumerator * reducedDen &&
    gcdEuclid(reducedNum, reducedDen) === 1;

  const pAxisLabel = axisForP === "cols" ? "columns (left to right)" : "rows (top to bottom)";
  const tAxisLabel = axisForP === "cols" ? "rows (top to bottom)" : "columns (left to right)";

  const promptText =
    `You have a bar of ${flavor}, shown as a ${rows}×${cols} grid (the whole grid = 1 whole bar). ` +
    `First snap off ${pFrac.num}/${pFrac.den} of the bar along the ${pAxisLabel}. ` +
    `Then take ${tFrac.num}/${tFrac.den} of just that snapped-off piece, along the ${tAxisLabel}. ` +
    `What fraction of the WHOLE bar do you end up with? (Enter your answer as a fraction, e.g. "1/2".)`;

  const buildingExpression = `${pFrac.num}/${pFrac.den} → then ${tFrac.num}/${tFrac.den} of that`;

  return {
    promptText,
    buildingExpression,
    pNum: pFrac.num,
    pDen: pFrac.den,
    tNum: tFrac.num,
    tDen: tFrac.den,
    axisForP,
    rows,
    cols,
    overlapCells: overlapNumerator,
    totalCells,
    reducedNum,
    reducedDen,
    requiresSimplification: reducedDen !== totalCells,
    selfCheck,
    flavor,
    variant: `${d}-${pFrac.num}_${pFrac.den}-${tFrac.num}_${tFrac.den}-${axisForP}-${flavor}`
  };
}

// ===== Structural validation helpers =====

function isPosInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

// ===== Plugin =====

export const chocolateSnapPlugin: GameTypePlugin = {
  id: "chocolate-snap",
  name: "Chocolate Snap",
  minGrade: 4,
  maxGrade: 6,
  description:
    "Multiply fractions with the area model: snap off a fraction of a chocolate bar along one axis, then take a fraction of that piece along the other axis. The overlap that lights up is your answer.",

  generate(input) {
    const rng = new Rng(input.seed);
    const result = buildPuzzle(rng, input.difficulty);

    return {
      gameTypeId: "chocolate-snap",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: { text: result.promptText },
      data: {
        variant: result.variant,
        flavor: result.flavor,
        pNum: result.pNum,
        pDen: result.pDen,
        tNum: result.tNum,
        tDen: result.tDen,
        axisForP: result.axisForP,
        rows: result.rows,
        cols: result.cols,
        overlapCells: result.overlapCells,
        totalCells: result.totalCells,
        reducedNum: result.reducedNum,
        reducedDen: result.reducedDen,
        requiresSimplification: result.requiresSimplification,
        buildingExpression: result.buildingExpression,
        selfCheck: result.selfCheck
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: ["fractions", "fraction_multiplication", "area_model", "gcd_simplification"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const num = Number(candidate.data.reducedNum);
    const den = Number(candidate.data.reducedDen);
    if (!isPosInt(num) || !isPosInt(den)) return [];
    return [`${num}/${den}`];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues: ValidationIssue[] = [];
    const d = candidate.data;

    const pNum = Number(d.pNum);
    const pDen = Number(d.pDen);
    const tNum = Number(d.tNum);
    const tDen = Number(d.tDen);
    const rows = Number(d.rows);
    const cols = Number(d.cols);
    const overlapCells = Number(d.overlapCells);
    const totalCells = Number(d.totalCells);
    const reducedNum = Number(d.reducedNum);
    const reducedDen = Number(d.reducedDen);
    const axisForP = d.axisForP;

    if (!isPosInt(pNum) || !isPosInt(pDen) || pNum >= pDen) {
      issues.push({ code: "bad_p_fraction", message: "Piece fraction must be a proper fraction (0 < num < den)." });
    } else if (gcdEuclid(pNum, pDen) !== 1) {
      issues.push({ code: "p_not_reduced", message: "Piece fraction must be given in lowest terms." });
    }

    if (!isPosInt(tNum) || !isPosInt(tDen) || tNum >= tDen) {
      issues.push({ code: "bad_t_fraction", message: "Take fraction must be a proper fraction (0 < num < den)." });
    } else if (gcdEuclid(tNum, tDen) !== 1) {
      issues.push({ code: "t_not_reduced", message: "Take fraction must be given in lowest terms." });
    }

    if (axisForP !== "cols" && axisForP !== "rows") {
      issues.push({ code: "bad_axis", message: `axisForP must be "cols" or "rows", got ${String(axisForP)}.` });
    }

    if (!isPosInt(rows) || !isPosInt(cols)) {
      issues.push({ code: "bad_grid_dims", message: "Grid rows/cols must be positive integers." });
    } else if (axisForP === "cols") {
      if (cols !== pDen || rows !== tDen) {
        issues.push({ code: "grid_dims_mismatch", message: "cols must equal pDen and rows must equal tDen when axisForP is cols." });
      }
    } else if (axisForP === "rows") {
      if (rows !== pDen || cols !== tDen) {
        issues.push({ code: "grid_dims_mismatch", message: "rows must equal pDen and cols must equal tDen when axisForP is rows." });
      }
    }

    if (isPosInt(pNum) && isPosInt(tNum) && overlapCells !== pNum * tNum) {
      issues.push({ code: "overlap_mismatch", message: "overlapCells must equal pNum * tNum." });
    }
    if (isPosInt(pDen) && isPosInt(tDen) && totalCells !== pDen * tDen) {
      issues.push({ code: "total_mismatch", message: "totalCells must equal pDen * tDen." });
    }
    if (isPosInt(rows) && isPosInt(cols) && isPosInt(totalCells) && rows * cols !== totalCells) {
      issues.push({ code: "grid_area_mismatch", message: "rows * cols must equal totalCells." });
    }

    // Independent re-derivation of the reduced fraction (binary gcd + brute
    // force cell count), so a bug shared between generate() and this check
    // can't silently agree with itself.
    if (isPosInt(overlapCells) && isPosInt(totalCells)) {
      const g = gcdBinary(overlapCells, totalCells);
      const expectNum = overlapCells / g;
      const expectDen = totalCells / g;
      if (reducedNum !== expectNum || reducedDen !== expectDen) {
        issues.push({
          code: "reduction_mismatch",
          message: `Independent gcd re-derivation gives ${expectNum}/${expectDen}, candidate has ${reducedNum}/${reducedDen}.`
        });
      }
      if (
        isPosInt(rows) &&
        isPosInt(cols) &&
        isPosInt(pNum) &&
        isPosInt(tNum) &&
        (axisForP === "cols" || axisForP === "rows")
      ) {
        const brute = bruteForceOverlapCells(rows, cols, axisForP as Axis, pNum, tNum);
        if (brute !== overlapCells) {
          issues.push({ code: "brute_force_mismatch", message: `Brute-force cell count ${brute} != overlapCells ${overlapCells}.` });
        }
      }
    }
    if (isPosInt(reducedNum) && isPosInt(reducedDen) && gcdEuclid(reducedNum, reducedDen) !== 1) {
      issues.push({ code: "answer_not_reduced", message: "Final answer fraction is not in lowest terms." });
    }

    if (candidate.data.selfCheck !== true) {
      issues.push({ code: "self_check_failed", message: "Generator self-check failed." });
    }

    if (!candidate.prompt.text || candidate.prompt.text.trim() === "") {
      issues.push({ code: "empty_prompt", message: "Prompt text is required." });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const reducedNum = Number(candidate.data.reducedNum);
    const reducedDen = Number(candidate.data.reducedDen);
    if (!isPosInt(reducedNum) || !isPosInt(reducedDen)) return false;

    const cleaned = String(answer ?? "").trim();
    if (cleaned === "") return false;

    // Exact rational grading only — accept the reduced fraction AND any
    // exactly-equivalent unreduced form (e.g. 6/12 for a 1/2 answer), verified
    // by cross-multiplication (no floats). Reject decimals and anything else.
    const match = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) return false;
    const num = Number(match[1]);
    const den = Number(match[2]);
    if (!isPosInt(num) || !isPosInt(den)) return false;

    return num * reducedDen === reducedNum * den;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const d = candidate.data;
    const pNum = Number(d.pNum);
    const pDen = Number(d.pDen);
    const tNum = Number(d.tNum);
    const tDen = Number(d.tDen);
    const overlapCells = Number(d.overlapCells);
    const totalCells = Number(d.totalCells);
    const reducedNum = Number(d.reducedNum);
    const reducedDen = Number(d.reducedDen);
    const axisForP = d.axisForP === "cols" ? "columns" : "rows";
    const tAxis = d.axisForP === "cols" ? "rows" : "columns";

    const hint1 =
      `Does "of" here mean add or multiply? When you take a fraction of a fraction, ` +
      `you multiply them: multiply the numerators together, and multiply the denominators together.`;

    const hint2 =
      `First shade ${pNum}/${pDen} of the whole bar along the ${axisForP} — that's ${pNum} out of ${pDen} ${axisForP}. ` +
      `Now, within just that shaded piece, take ${tNum}/${tDen} of it along the ${tAxis} — shade ${tNum} out of its ${tDen} ${tAxis}. ` +
      `Count only the cells shaded by BOTH steps (the overlap).`;

    const hint3 =
      `The overlap is ${overlapCells} cells out of ${totalCells} total cells: ${overlapCells}/${totalCells}, ` +
      `which reduces to ${reducedNum}/${reducedDen}. So ${pNum}/${pDen} × ${tNum}/${tDen} = ${reducedNum}/${reducedDen}.`;

    return [hint1, hint2, hint3];
  }
};
