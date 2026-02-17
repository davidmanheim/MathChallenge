import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

// ===== Seeded RNG =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0xf00dface) >>> 0;
  }
  next(): number {
    this.s = (this.s * 1103515245 + 12345) >>> 0;
    return this.s;
  }
  int(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.next() % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// ===== Types =====

type Rect = {
  r: number; // top row
  c: number; // left column
  w: number; // width (columns)
  h: number; // height (rows)
};

type Clue = {
  r: number;
  c: number;
  value: number; // area of the rectangle this cell belongs to
};

// ===== Grid Partitioning =====

// Partition the grid into non-overlapping rectangles covering every cell.
// Strategy: iteratively pick an unassigned cell, try random rectangle sizes
// that fit, assign them. Backtrack if stuck.
function partitionGrid(
  rows: number,
  cols: number,
  rng: Rng
): Rect[] | null {
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(-1)
  );
  const rects: Rect[] = [];

  function findFirstEmpty(): [number, number] | null {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === -1) return [r, c];
      }
    }
    return null;
  }

  function canPlace(rect: Rect, id: number): boolean {
    if (rect.r + rect.h > rows || rect.c + rect.w > cols) return false;
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        if (grid[rect.r + dr][rect.c + dc] !== -1) return false;
      }
    }
    return true;
  }

  function place(rect: Rect, id: number): void {
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        grid[rect.r + dr][rect.c + dc] = id;
      }
    }
  }

  function unplace(rect: Rect): void {
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        grid[rect.r + dr][rect.c + dc] = -1;
      }
    }
  }

  // Generate possible rectangle sizes (area 1 to maxArea)
  function possibleRects(
    r: number,
    c: number,
    maxArea: number
  ): Rect[] {
    const results: Rect[] = [];
    for (let w = 1; w <= Math.min(cols - c, maxArea); w++) {
      for (let h = 1; h <= Math.min(rows - r, maxArea); h++) {
        const area = w * h;
        if (area > maxArea) break;
        if (area < 2 && maxArea >= 2) continue; // avoid too many 1x1
        results.push({ r, c, w, h });
      }
    }
    // Always allow 1x1 as a fallback
    if (results.length === 0) results.push({ r, c, w: 1, h: 1 });
    return results;
  }

  function solve(): boolean {
    const cell = findFirstEmpty();
    if (!cell) return true; // all filled
    const [cr, cc] = cell;

    const maxArea = Math.min(6, rows * cols - rects.length); // reasonable cap
    const candidates = rng.shuffle(possibleRects(cr, cc, maxArea));

    for (const rect of candidates) {
      const id = rects.length;
      if (canPlace(rect, id)) {
        place(rect, id);
        rects.push(rect);
        if (solve()) return true;
        rects.pop();
        unplace(rect);
      }
    }
    return false;
  }

  return solve() ? rects : null;
}

// Place one clue per rectangle: the area value, positioned randomly within the rect
function generateClues(rects: Rect[], rng: Rng): Clue[] {
  return rects.map((rect) => {
    const area = rect.w * rect.h;
    const dr = rng.int(0, rect.h - 1);
    const dc = rng.int(0, rect.w - 1);
    return { r: rect.r + dr, c: rect.c + dc, value: area };
  });
}

// ===== Difficulty Mapping =====

function difficultyParams(difficulty: number): { rows: number; cols: number } {
  if (difficulty <= 1) return { rows: 4, cols: 4 };
  if (difficulty <= 2) return { rows: 5, cols: 5 };
  if (difficulty <= 3) return { rows: 6, cols: 6 };
  if (difficulty <= 4) return { rows: 7, cols: 7 };
  if (difficulty <= 5) return { rows: 8, cols: 8 };
  return { rows: 9, cols: 9 };
}

// ===== Solver =====

// Verify a solution: given the clues and a set of rects, check that:
// 1. Every rect contains exactly one clue
// 2. Each clue value equals the rect's area
// 3. Rects cover the entire grid without overlap
function verifySolution(
  rows: number,
  cols: number,
  clues: Clue[],
  rects: Rect[]
): boolean {
  // Check full coverage without overlap
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(-1)
  );
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (rect.r < 0 || rect.c < 0 || rect.r + rect.h > rows || rect.c + rect.w > cols)
      return false;
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        if (grid[rect.r + dr][rect.c + dc] !== -1) return false;
        grid[rect.r + dr][rect.c + dc] = i;
      }
    }
  }
  // Check no uncovered cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === -1) return false;
    }
  }

  // Check each rect contains exactly one clue with matching area
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const area = rect.w * rect.h;
    const contained = clues.filter(
      (cl) =>
        cl.r >= rect.r &&
        cl.r < rect.r + rect.h &&
        cl.c >= rect.c &&
        cl.c < rect.c + rect.w
    );
    if (contained.length !== 1) return false;
    if (contained[0].value !== area) return false;
  }

  return true;
}

// Simple backtracking solver for grading/validation
function solveShikaku(
  rows: number,
  cols: number,
  clues: Clue[]
): Rect[] | null {
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(-1)
  );
  const result: Rect[] = [];
  const clueMap = new Map<string, number>();
  for (const cl of clues) {
    clueMap.set(`${cl.r},${cl.c}`, cl.value);
  }

  function findFirstEmpty(): [number, number] | null {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === -1) return [r, c];
      }
    }
    return null;
  }

  function canPlace(rect: Rect): boolean {
    if (rect.r + rect.h > rows || rect.c + rect.w > cols) return false;
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        if (grid[rect.r + dr][rect.c + dc] !== -1) return false;
      }
    }
    return true;
  }

  function place(rect: Rect, id: number): void {
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        grid[rect.r + dr][rect.c + dc] = id;
      }
    }
  }

  function unplace(rect: Rect): void {
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        grid[rect.r + dr][rect.c + dc] = -1;
      }
    }
  }

  // For a candidate rectangle, count clues inside and check constraints
  function rectClues(rect: Rect): Clue[] {
    const found: Clue[] = [];
    for (let dr = 0; dr < rect.h; dr++) {
      for (let dc = 0; dc < rect.w; dc++) {
        const key = `${rect.r + dr},${rect.c + dc}`;
        if (clueMap.has(key)) {
          found.push({ r: rect.r + dr, c: rect.c + dc, value: clueMap.get(key)! });
        }
      }
    }
    return found;
  }

  function solve(): boolean {
    const cell = findFirstEmpty();
    if (!cell) return true;
    const [cr, cc] = cell;

    // Try rectangles of different sizes that start at or include this cell
    for (let w = 1; w <= cols - cc; w++) {
      for (let h = 1; h <= rows - cr; h++) {
        const area = w * h;
        if (area > rows * cols) break;
        const rect: Rect = { r: cr, c: cc, w, h };
        if (!canPlace(rect)) break; // if this height doesn't fit, taller won't either

        const cls = rectClues(rect);
        // Must contain exactly one clue, and its value must match area
        if (cls.length === 1 && cls[0].value === area) {
          const id = result.length;
          place(rect, id);
          result.push(rect);
          if (solve()) return true;
          result.pop();
          unplace(rect);
        }
        // If we already have >1 clue, no taller rect will work either
        if (cls.length > 1) break;
      }
    }
    return false;
  }

  return solve() ? [...result] : null;
}

// ===== Answer Serialisation =====

// Answer format: list of rects as "r,c,w,h" separated by semicolons
function rectsToAnswer(rects: Rect[]): string {
  return rects
    .map((r) => `${r.r},${r.c},${r.w},${r.h}`)
    .sort()
    .join(";");
}

function answerToRects(answer: string): Rect[] | null {
  try {
    const parts = answer.trim().split(";");
    return parts.map((p) => {
      const [r, c, w, h] = p.split(",").map(Number);
      return { r, c, w, h };
    });
  } catch {
    return null;
  }
}

// ===== Plugin =====

export const shikakuPlugin: GameTypePlugin = {
  id: "shikaku",
  name: "Shikaku",
  minGrade: 3,
  maxGrade: 7,
  description:
    "Divide the grid into rectangles. Each rectangle must contain exactly one number, and that number must equal the rectangle's area.",

  generate(input) {
    const { rows, cols } = difficultyParams(input.difficulty);
    const rng = new Rng(input.seed);
    const rects = partitionGrid(rows, cols, rng);
    if (!rects) throw new Error("Failed to partition grid");
    const clues = generateClues(rects, rng);

    return {
      gameTypeId: "shikaku",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Divide the ${rows}\u00d7${cols} grid into rectangles. Each rectangle contains exactly one number equal to its area.`
      },
      data: {
        rows,
        cols,
        clues,
        solution: rectsToAnswer(rects)
      },
      metadata: {
        expectUniqueSolution: false, // Shikaku can have multiple valid solutions
        skillTags: ["area", "factors", "spatial_reasoning", "logic"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const rows = Number(candidate.data.rows);
    const cols = Number(candidate.data.cols);
    const clues = candidate.data.clues as Clue[];

    const result = solveShikaku(rows, cols, clues);
    if (!result) return [];
    return [rectsToAnswer(result)];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues = [];
    const rows = Number(candidate.data.rows);
    const cols = Number(candidate.data.cols);
    const clues = candidate.data.clues as Clue[];

    if (!Number.isInteger(rows) || rows < 2 || rows > 12) {
      issues.push({ code: "bad_rows", message: "Rows must be 2-12." });
    }
    if (!Number.isInteger(cols) || cols < 2 || cols > 12) {
      issues.push({ code: "bad_cols", message: "Cols must be 2-12." });
    }
    if (!Array.isArray(clues) || clues.length === 0) {
      issues.push({ code: "no_clues", message: "Must have at least one clue." });
    }

    // Verify clues are in bounds and have valid area values
    if (Array.isArray(clues)) {
      for (const cl of clues) {
        if (cl.r < 0 || cl.r >= rows || cl.c < 0 || cl.c >= cols) {
          issues.push({
            code: "clue_oob",
            message: `Clue at (${cl.r},${cl.c}) is out of bounds.`
          });
        }
        if (cl.value < 1 || cl.value > rows * cols) {
          issues.push({
            code: "bad_clue_value",
            message: `Clue value ${cl.value} is out of range.`
          });
        }
      }

      // Sum of clue values must equal grid area
      const totalArea = clues.reduce((sum, cl) => sum + cl.value, 0);
      if (totalArea !== rows * cols) {
        issues.push({
          code: "area_mismatch",
          message: `Clue areas sum to ${totalArea} but grid has ${rows * cols} cells.`
        });
      }
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const rows = Number(candidate.data.rows);
    const cols = Number(candidate.data.cols);
    const clues = candidate.data.clues as Clue[];
    const rects = answerToRects(answer);
    if (!rects) return false;
    return verifySolution(rows, cols, clues, rects);
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const clues = candidate.data.clues as Clue[];

    // Find a clue with value 1 (must be 1x1)
    const oneClue = clues.find((cl) => cl.value === 1);
    const hint1 = oneClue
      ? `The number 1 at (${oneClue.r + 1}, ${oneClue.c + 1}) must be a 1\u00d71 rectangle \u2014 it's already done!`
      : "Start with the largest numbers \u2014 they have fewer possible rectangle shapes.";

    // Find a clue that's prime (only one possible rectangle shape)
    const primeClue = clues.find((cl) => {
      const v = cl.value;
      if (v < 2) return false;
      for (let d = 2; d * d <= v; d++) {
        if (v % d === 0) return false;
      }
      return true;
    });
    const hint2 = primeClue
      ? `The number ${primeClue.value} at (${primeClue.r + 1}, ${primeClue.c + 1}) is prime \u2014 it can only be a 1\u00d7${primeClue.value} or ${primeClue.value}\u00d71 rectangle.`
      : "Look for numbers with only one or two factor pairs \u2014 they're the most constrained.";

    // Partial solution reveal
    const solStr = String(candidate.data.solution);
    const solRects = answerToRects(solStr);
    const hint3 = solRects && solRects.length > 0
      ? `One rectangle starts at row ${solRects[0].r + 1}, column ${solRects[0].c + 1} and is ${solRects[0].w}\u00d7${solRects[0].h}.`
      : "Try placing rectangles for the most constrained clues first.";

    return [hint1, hint2, hint3];
  }
};
