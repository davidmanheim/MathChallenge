import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

// ===== Seeded RNG =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0xdeadbeef) >>> 0;
  }
  next(): number {
    this.s = (this.s * 1103515245 + 12345) >>> 0;
    return this.s;
  }
  int(max: number): number {
    return this.next() % max;
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// ===== Latin Square Generator =====

function generateLatinSquare(size: number, rng: Rng): number[][] {
  // Build a base Latin square by shifting rows, then shuffle rows and columns
  const grid: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      row.push(((r + c) % size) + 1);
    }
    grid.push(row);
  }

  // Shuffle rows
  const rowOrder = rng.shuffle([...Array(size).keys()]);
  const shuffledRows = rowOrder.map((r) => grid[r]);

  // Shuffle columns
  const colOrder = rng.shuffle([...Array(size).keys()]);
  const result = shuffledRows.map((row) => colOrder.map((c) => row[c]));

  // Relabel digits randomly
  const labels = rng.shuffle([...Array(size).keys()].map((i) => i + 1));
  return result.map((row) => row.map((v) => labels[v - 1]));
}

// ===== Cage Generation =====

type Cage = {
  cells: [number, number][];
  op: "+" | "-" | "*" | "/";
  target: number;
};

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function neighbors(r: number, c: number, size: number): [number, number][] {
  const result: [number, number][] = [];
  if (r > 0) result.push([r - 1, c]);
  if (r < size - 1) result.push([r + 1, c]);
  if (c > 0) result.push([r, c - 1]);
  if (c < size - 1) result.push([r, c + 1]);
  return result;
}

function generateCages(
  grid: number[][],
  rng: Rng,
  allowedOps: string[]
): Cage[] {
  const size = grid.length;
  const assigned = new Set<string>();
  const cages: Cage[] = [];

  // Randomly order all cells, then greedily build cages
  const allCells: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      allCells.push([r, c]);
    }
  }
  const ordered = rng.shuffle(allCells);

  for (const [r, c] of ordered) {
    if (assigned.has(cellKey(r, c))) continue;

    // Decide cage size: 1-cell (single), 2-cell, or 3-cell
    const roll = rng.int(10);
    let maxCageSize = roll < 2 ? 1 : roll < 7 ? 2 : 3;

    const cells: [number, number][] = [[r, c]];
    assigned.add(cellKey(r, c));

    // Grow the cage by adding random unassigned neighbors
    while (cells.length < maxCageSize) {
      const frontier: [number, number][] = [];
      for (const [cr, cc] of cells) {
        for (const [nr, nc] of neighbors(cr, cc, size)) {
          if (!assigned.has(cellKey(nr, nc))) {
            frontier.push([nr, nc]);
          }
        }
      }
      if (frontier.length === 0) break;
      const pick = frontier[rng.int(frontier.length)];
      cells.push(pick);
      assigned.add(cellKey(pick[0], pick[1]));
    }

    const values = cells.map(([cr, cc]) => grid[cr][cc]);
    const cage = assignOperation(values, cells, rng, allowedOps);
    cages.push(cage);
  }

  return cages;
}

function assignOperation(
  values: number[],
  cells: [number, number][],
  rng: Rng,
  allowedOps: string[]
): Cage {
  if (cells.length === 1) {
    // Single cell: no operation, target is the value
    return { cells, op: "+", target: values[0] };
  }

  if (cells.length === 2) {
    const [a, b] = values;
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    const candidates: { op: "+" | "-" | "*" | "/"; target: number }[] = [];

    if (allowedOps.includes("+")) candidates.push({ op: "+", target: a + b });
    if (allowedOps.includes("-")) candidates.push({ op: "-", target: big - small });
    if (allowedOps.includes("*")) candidates.push({ op: "*", target: a * b });
    if (allowedOps.includes("/") && small > 0 && big % small === 0)
      candidates.push({ op: "/", target: big / small });

    if (candidates.length === 0) candidates.push({ op: "+", target: a + b });
    const pick = candidates[rng.int(candidates.length)];
    return { cells, ...pick };
  }

  // 3+ cells: only + and * make sense
  const candidates: { op: "+" | "*"; target: number }[] = [];
  if (allowedOps.includes("+"))
    candidates.push({ op: "+", target: values.reduce((a, b) => a + b, 0) });
  if (allowedOps.includes("*"))
    candidates.push({ op: "*", target: values.reduce((a, b) => a * b, 1) });

  if (candidates.length === 0)
    candidates.push({ op: "+", target: values.reduce((a, b) => a + b, 0) });
  const pick = candidates[rng.int(candidates.length)];
  return { cells, ...pick };
}

// ===== Solver =====

// Bounded backtracking solution COUNTER for KenKen. Searches for grids that
// satisfy both the Latin-square and cage constraints, collecting up to `limit`
// distinct solutions and then stopping early. This is what lets the validation
// gate enforce uniqueness: if 2+ solutions exist the gate sees length !== 1 and
// rerolls the seed. (Previously the solver stopped at the first solution, so
// every puzzle looked "unique" and multi-solution puzzles shipped.)
function findKenKenSolutions(
  size: number,
  cages: Cage[],
  limit = 2
): number[][][] {
  const grid: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(0)
  );

  // Map each cell to its cage index for O(1) lookup during search.
  const cellCage: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(-1)
  );
  for (let ci = 0; ci < cages.length; ci++) {
    for (const [r, c] of cages[ci].cells) {
      cellCage[r][c] = ci;
    }
  }

  function cageSatisfied(ci: number): boolean {
    const cage = cages[ci];
    const vals = cage.cells.map(([r, c]) => grid[r][c]);
    if (vals.some((v) => v === 0)) return true; // incomplete — can't check yet

    if (cage.cells.length === 1) return vals[0] === cage.target;

    if (cage.op === "+") return vals.reduce((a, b) => a + b, 0) === cage.target;
    if (cage.op === "*") return vals.reduce((a, b) => a * b, 1) === cage.target;
    if (cage.op === "-") {
      const big = Math.max(...vals);
      const small = Math.min(...vals);
      return big - small === cage.target;
    }
    if (cage.op === "/") {
      const big = Math.max(...vals);
      const small = Math.min(...vals);
      return small > 0 && big / small === cage.target;
    }
    return false;
  }

  function cagePartialOk(ci: number): boolean {
    const cage = cages[ci];
    const vals = cage.cells.map(([r, c]) => grid[r][c]).filter((v) => v > 0);
    if (vals.length === 0) return true;
    const allFilled = vals.length === cage.cells.length;

    if (allFilled) return cageSatisfied(ci);

    // Partial check: additive sum / product shouldn't already exceed target.
    if (cage.op === "+") return vals.reduce((a, b) => a + b, 0) < cage.target;
    if (cage.op === "*") return vals.reduce((a, b) => a * b, 1) <= cage.target;
    return true;
  }

  const solutions: number[][][] = [];

  function search(pos: number): void {
    if (solutions.length >= limit) return; // bounded: stop once we have enough
    if (pos === size * size) {
      solutions.push(grid.map((row) => [...row]));
      return;
    }
    const r = Math.floor(pos / size);
    const c = pos % size;

    for (let v = 1; v <= size; v++) {
      // Latin square check: no duplicate in row or column so far.
      let ok = true;
      for (let i = 0; i < c; i++) if (grid[r][i] === v) { ok = false; break; }
      if (!ok) continue;
      for (let i = 0; i < r; i++) if (grid[i][c] === v) { ok = false; break; }
      if (!ok) continue;

      grid[r][c] = v;
      if (cagePartialOk(cellCage[r][c])) search(pos + 1);
      grid[r][c] = 0;
      if (solutions.length >= limit) return;
    }
  }

  search(0);
  return solutions;
}

// ===== Difficulty Mapping =====

function difficultyParams(difficulty: number): {
  size: number;
  ops: string[];
} {
  if (difficulty <= 1) return { size: 3, ops: ["+"] };
  if (difficulty <= 2) return { size: 4, ops: ["+", "-"] };
  if (difficulty <= 3) return { size: 4, ops: ["+", "-", "*"] };
  if (difficulty <= 4) return { size: 5, ops: ["+", "-", "*"] };
  if (difficulty <= 5) return { size: 5, ops: ["+", "-", "*", "/"] };
  return { size: 6, ops: ["+", "-", "*", "/"] };
}

// ===== Serialisation =====

// Answer format: row-major digits separated by commas, e.g. "1,2,3,2,3,1,3,1,2"
function gridToAnswer(grid: number[][]): string {
  return grid.map((row) => row.join(",")).join(",");
}

function answerToGrid(answer: string, size: number): number[][] | null {
  const nums = answer
    .replace(/\s+/g, "")
    .split(",")
    .map(Number);
  if (nums.length !== size * size) return null;
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > size)) return null;
  const grid: number[][] = [];
  for (let r = 0; r < size; r++) {
    grid.push(nums.slice(r * size, (r + 1) * size));
  }
  return grid;
}

function isValidLatinSquare(grid: number[][], size: number): boolean {
  for (let r = 0; r < size; r++) {
    const rowSet = new Set(grid[r]);
    if (rowSet.size !== size) return false;
  }
  for (let c = 0; c < size; c++) {
    const colSet = new Set<number>();
    for (let r = 0; r < size; r++) colSet.add(grid[r][c]);
    if (colSet.size !== size) return false;
  }
  return true;
}

function allCagesSatisfied(grid: number[][], cages: Cage[]): boolean {
  for (const cage of cages) {
    const vals = cage.cells.map(([r, c]) => grid[r][c]);
    if (cage.cells.length === 1) {
      if (vals[0] !== cage.target) return false;
      continue;
    }
    if (cage.op === "+") {
      if (vals.reduce((a, b) => a + b, 0) !== cage.target) return false;
    } else if (cage.op === "*") {
      if (vals.reduce((a, b) => a * b, 1) !== cage.target) return false;
    } else if (cage.op === "-") {
      if (Math.max(...vals) - Math.min(...vals) !== cage.target) return false;
    } else if (cage.op === "/") {
      const big = Math.max(...vals);
      const small = Math.min(...vals);
      if (small === 0 || big / small !== cage.target) return false;
    }
  }
  return true;
}

// ===== Plugin =====

export const kenkenPlugin: GameTypePlugin = {
  id: "kenken",
  name: "KenKen",
  minGrade: 1,
  maxGrade: 8,
  description:
    "Fill the grid so each row and column has unique digits, and caged cells combine to hit their target using the given operation.",

  generate(input) {
    const { size, ops } = difficultyParams(input.difficulty);
    const rng = new Rng(input.seed);
    const solution = generateLatinSquare(size, rng);
    const cages = generateCages(solution, rng, ops);

    // Serialise cages for the client
    const cageData = cages.map((cage) => ({
      cells: cage.cells,
      op: cage.cells.length === 1 ? "" : cage.op,
      target: cage.target
    }));

    return {
      gameTypeId: "kenken",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Fill the ${size}\u00d7${size} grid. Each row and column uses digits 1\u2013${size} exactly once. Caged cells must combine to hit the target.`
      },
      data: {
        size,
        cages: cageData,
        solution: gridToAnswer(solution),
        // Optional reasoning prompt (see docs/FRAMEWORK.md "Reasoning capture").
        // Advisory only — never affects grading.
        reasoning: {
          supportsExplanation: true,
          supportsTwoMethod: false,
          explanationPrompt:
            "Choose one cell and justify why it must be that number (which row, column, or cage rule forces it)."
        }
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: [
          "arithmetic",
          "logic",
          "latin_square",
          ...(ops.includes("*") ? ["multiplication"] : []),
          ...(ops.includes("/") ? ["division"] : [])
        ]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const size = Number(candidate.data.size);
    const cages = (candidate.data.cages as any[]).map((c) => ({
      cells: c.cells as [number, number][],
      op: (c.op || "+") as "+" | "-" | "*" | "/",
      target: c.target as number
    }));

    // Return up to 2 solutions so the validation gate can enforce uniqueness:
    // a puzzle with 2+ consistent completions yields length !== 1 and is
    // rerolled. Each returned grid is genuinely consistent with the cages, so
    // it also passes the gate's grader-consistency check.
    const results = findKenKenSolutions(size, cages, 2);
    return results.map(gridToAnswer);
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues = [];
    const size = Number(candidate.data.size);
    if (!Number.isInteger(size) || size < 3 || size > 9) {
      issues.push({ code: "bad_size", message: "Grid size must be 3-9." });
    }

    const cages = candidate.data.cages as any[];
    if (!Array.isArray(cages) || cages.length === 0) {
      issues.push({ code: "no_cages", message: "Must have at least one cage." });
    }

    // Verify all cells are covered exactly once
    const covered = new Set<string>();
    for (const cage of cages) {
      for (const [r, c] of cage.cells) {
        const key = `${r},${c}`;
        if (covered.has(key)) {
          issues.push({
            code: "overlap",
            message: `Cell ${key} is in multiple cages.`
          });
        }
        covered.add(key);
      }
    }
    if (covered.size !== size * size) {
      issues.push({
        code: "incomplete_coverage",
        message: "Cages do not cover all cells."
      });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const size = Number(candidate.data.size);
    const grid = answerToGrid(answer, size);
    if (!grid) return false;
    if (!isValidLatinSquare(grid, size)) return false;

    const cages = (candidate.data.cages as any[]).map((c) => ({
      cells: c.cells as [number, number][],
      op: (c.op || "+") as "+" | "-" | "*" | "/",
      target: c.target as number
    }));

    return allCagesSatisfied(grid, cages);
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const size = Number(candidate.data.size);
    const cages = candidate.data.cages as any[];

    // Find single-cell cages (freebies)
    const singles = cages.filter((c: any) => c.cells.length === 1);
    const singleHint =
      singles.length > 0
        ? `Start with the single-cell cages \u2014 they tell you the answer directly. There are ${singles.length} of them.`
        : "Look for cages with only one possible combination of digits.";

    // Find a 2-cell cage with subtraction or division (constrained)
    const twoCell = cages.find(
      (c: any) => c.cells.length === 2 && (c.op === "-" || c.op === "/")
    );
    const twoHint = twoCell
      ? `The ${twoCell.op === "-" ? "subtraction" : "division"} cage with target ${twoCell.target} has very few options. Try listing them.`
      : `Look for 2-cell cages \u2014 they have fewer possible digit combos.`;

    // Solution reveal
    const solStr = String(candidate.data.solution);
    const solGrid = answerToGrid(solStr, size);
    const firstRow = solGrid ? solGrid[0].join(", ") : "???";

    return [
      singleHint,
      twoHint,
      `The first row of the solution is: ${firstRow}.`
    ];
  }
};
