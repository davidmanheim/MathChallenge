import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type XOutConfig = {
  rows: number;
  cols: number;
  minValue: number;
  maxValue: number;
  xCount: number;
};

function hashSeed(seed: number): number {
  let x = (seed | 0) ^ 0x85ebca6b;
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

function configForDifficulty(difficulty: number): XOutConfig {
  if (difficulty <= 1) {
    return { rows: 3, cols: 3, minValue: 1, maxValue: 6, xCount: 3 };
  }
  if (difficulty <= 2) {
    return { rows: 3, cols: 4, minValue: 1, maxValue: 8, xCount: 4 };
  }
  if (difficulty <= 3) {
    return { rows: 4, cols: 4, minValue: 1, maxValue: 9, xCount: 5 };
  }
  if (difficulty <= 4) {
    return { rows: 4, cols: 5, minValue: 1, maxValue: 9, xCount: 6 };
  }
  if (difficulty <= 5) {
    return { rows: 5, cols: 5, minValue: 1, maxValue: 12, xCount: 7 };
  }
  return { rows: 5, cols: 5, minValue: 2, maxValue: 12, xCount: 8 };
}

function coordKey(row: number, col: number): string {
  return `${row},${col}`;
}

function parseAnswerSet(raw: string): Set<string> | null {
  const trimmed = raw.trim();
  if (!trimmed) return new Set();

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      const set = new Set<string>();
      for (const item of parsed) {
        if (!Array.isArray(item) || item.length !== 2) return null;
        const r = Number(item[0]);
        const c = Number(item[1]);
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0) {
          return null;
        }
        set.add(coordKey(r, c));
      }
      return set;
    }
  } catch {
    // Fall through and parse simple format.
  }

  const compact = trimmed.replace(/\s+/g, "");
  const chunks = compact.includes(";")
    ? compact.split(";").filter(Boolean)
    : compact.match(/\d+,\d+/g) ?? [];
  const set = new Set<string>();
  for (const chunk of chunks) {
    const m = chunk.match(/^(\d+),(\d+)$/);
    if (!m) return null;
    set.add(coordKey(Number(m[1]), Number(m[2])));
  }
  return set;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) {
    if (!b.has(k)) return false;
  }
  return true;
}

function canonicalFromSet(values: Set<string>): string {
  return [...values].sort().join(";");
}

function countSolutions(
  grid: number[][],
  rowRemovedTarget: number[],
  colRemovedTarget: number[],
  xCount: number
): { count: number; firstMask: boolean[] | null } {
  const rows = grid.length;
  const cols = grid[0].length;
  const totalCells = rows * cols;
  const rowNeed = [...rowRemovedTarget];
  const colNeed = [...colRemovedTarget];
  const remainingRow = grid.map((row) => row.reduce((a, b) => a + b, 0));
  const remainingCol = Array.from({ length: cols }, (_, c) =>
    grid.reduce((sum, row) => sum + row[c], 0)
  );
  const mask = new Array<boolean>(totalCells).fill(false);
  let count = 0;
  let firstMask: boolean[] | null = null;

  function feasible(): boolean {
    for (let r = 0; r < rows; r += 1) {
      if (rowNeed[r] < 0 || rowNeed[r] > remainingRow[r]) return false;
    }
    for (let c = 0; c < cols; c += 1) {
      if (colNeed[c] < 0 || colNeed[c] > remainingCol[c]) return false;
    }
    return true;
  }

  function dfs(index: number, used: number): void {
    if (count > 1) return;
    if (index === totalCells) {
      if (used !== xCount) return;
      if (rowNeed.some((n) => n !== 0) || colNeed.some((n) => n !== 0)) return;
      count += 1;
      if (!firstMask) firstMask = [...mask];
      return;
    }

    const cellsLeftAfter = totalCells - index - 1;
    if (used > xCount || used + cellsLeftAfter + 1 < xCount) return;

    const r = Math.floor(index / cols);
    const c = index % cols;
    const value = grid[r][c];

    remainingRow[r] -= value;
    remainingCol[c] -= value;

    // Keep this cell.
    mask[index] = false;
    if (used + cellsLeftAfter >= xCount && feasible()) {
      dfs(index + 1, used);
    }

    // Cross out this cell.
    if (used < xCount && rowNeed[r] >= value && colNeed[c] >= value) {
      rowNeed[r] -= value;
      colNeed[c] -= value;
      mask[index] = true;
      if (used + 1 + cellsLeftAfter >= xCount && feasible()) {
        dfs(index + 1, used + 1);
      }
      rowNeed[r] += value;
      colNeed[c] += value;
      mask[index] = false;
    }

    remainingRow[r] += value;
    remainingCol[c] += value;
  }

  dfs(0, 0);
  return { count, firstMask };
}

function buildPuzzle(seed: number, difficulty: number): {
  grid: number[][];
  rowTargets: number[];
  colTargets: number[];
  xCount: number;
  answerSet: Set<string>;
} {
  const cfg = configForDifficulty(difficulty);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rng = makeRng(seed + attempt * 7919 + difficulty * 31);
    const grid = Array.from({ length: cfg.rows }, () =>
      Array.from({ length: cfg.cols }, () => randInt(rng, cfg.minValue, cfg.maxValue))
    );

    const allIndices = Array.from({ length: cfg.rows * cfg.cols }, (_, i) => i);
    for (let i = allIndices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
    }
    const chosen = new Set(allIndices.slice(0, cfg.xCount));
    const answerSet = new Set<string>();
    const rowTotals = grid.map((row) => row.reduce((a, b) => a + b, 0));
    const colTotals = Array.from({ length: cfg.cols }, (_, c) =>
      grid.reduce((sum, row) => sum + row[c], 0)
    );
    const rowRemoved = new Array<number>(cfg.rows).fill(0);
    const colRemoved = new Array<number>(cfg.cols).fill(0);

    for (const idx of chosen) {
      const r = Math.floor(idx / cfg.cols);
      const c = idx % cfg.cols;
      rowRemoved[r] += grid[r][c];
      colRemoved[c] += grid[r][c];
      answerSet.add(coordKey(r, c));
    }

    const rowTargets = rowTotals.map((sum, r) => sum - rowRemoved[r]);
    const colTargets = colTotals.map((sum, c) => sum - colRemoved[c]);
    const solved = countSolutions(grid, rowRemoved, colRemoved, cfg.xCount);

    if (solved.count === 1) {
      return {
        grid,
        rowTargets,
        colTargets,
        xCount: cfg.xCount,
        answerSet
      };
    }
  }

  // Fallback deterministic puzzle.
  const grid = [
    [2, 4, 5],
    [3, 6, 1],
    [7, 2, 4]
  ];
  const answerSet = new Set<string>(["0,1", "1,2", "2,0"]);
  const rowTargets = [7, 9, 6];
  const colTargets = [5, 8, 9];
  return {
    grid,
    rowTargets,
    colTargets,
    xCount: 3,
    answerSet
  };
}

export const xOutsPlugin: GameTypePlugin = {
  id: "x-outs",
  name: "X-Outs",
  minGrade: 2,
  maxGrade: 5,
  description: "Cross out numbers so row and column sums match the targets.",

  generate(input) {
    const built = buildPuzzle(input.seed, input.difficulty);
    const difficultyLabel =
      input.difficulty <= 2
        ? "Easy"
        : input.difficulty <= 4
          ? "Medium"
          : "Challenge";
    const rows = built.grid.length;
    const cols = built.grid[0].length;

    return {
      gameTypeId: "x-outs",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Cross out exactly ${built.xCount} cells so each row and column hits its target sum.`
      },
      data: {
        grid: built.grid,
        rowTargets: built.rowTargets,
        colTargets: built.colTargets,
        rows,
        cols,
        xCount: built.xCount,
        expectedCrosses: canonicalFromSet(built.answerSet),
        difficultyLabel
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: ["addition", "subtraction", "logic", "constraint_satisfaction"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const expected = String(candidate.data.expectedCrosses ?? "").trim();
    return expected ? [expected] : [];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const grid = candidate.data.grid as number[][];
    const rowTargets = candidate.data.rowTargets as number[];
    const colTargets = candidate.data.colTargets as number[];
    const xCount = Number(candidate.data.xCount);
    const expectedRaw = String(candidate.data.expectedCrosses ?? "");
    const issues = [];

    if (!Array.isArray(grid) || grid.length < 3 || !Array.isArray(grid[0])) {
      issues.push({
        code: "bad_grid",
        message: "Grid must be a 2D array with at least 3 rows."
      });
      return { ok: false, issues };
    }

    const cols = grid[0].length;
    if (cols < 3) {
      issues.push({
        code: "bad_cols",
        message: "Grid must have at least 3 columns."
      });
    }
    for (const row of grid) {
      if (!Array.isArray(row) || row.length !== cols) {
        issues.push({
          code: "ragged_grid",
          message: "Grid rows must all have equal length."
        });
        break;
      }
      for (const n of row) {
        if (!Number.isInteger(n) || n <= 0) {
          issues.push({
            code: "bad_cell",
            message: "Grid cells must be positive integers."
          });
          break;
        }
      }
    }

    if (!Array.isArray(rowTargets) || rowTargets.length !== grid.length) {
      issues.push({
        code: "bad_row_targets",
        message: "rowTargets length must match row count."
      });
    }
    if (!Array.isArray(colTargets) || colTargets.length !== cols) {
      issues.push({
        code: "bad_col_targets",
        message: "colTargets length must match column count."
      });
    }
    if (!Number.isInteger(xCount) || xCount < 1 || xCount >= grid.length * cols) {
      issues.push({
        code: "bad_x_count",
        message: "xCount must be a valid integer count of crossed-out cells."
      });
    }

    const expectedSet = parseAnswerSet(expectedRaw);
    if (!expectedSet) {
      issues.push({
        code: "bad_expected",
        message: "expectedCrosses is malformed."
      });
    } else if (expectedSet.size !== xCount) {
      issues.push({
        code: "expected_size_mismatch",
        message: "expectedCrosses size must equal xCount."
      });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const expected = parseAnswerSet(String(candidate.data.expectedCrosses ?? ""));
    const actual = parseAnswerSet(answer);
    return Boolean(expected && actual && sameSet(expected, actual));
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const grid = candidate.data.grid as number[][];
    const rowTargets = candidate.data.rowTargets as number[];
    const expected = parseAnswerSet(String(candidate.data.expectedCrosses ?? ""));
    const rowSums = grid.map((row) => row.reduce((a, b) => a + b, 0));
    let bestRow = 0;
    let biggestDrop = -1;
    for (let r = 0; r < rowSums.length; r += 1) {
      const drop = rowSums[r] - rowTargets[r];
      if (drop > biggestDrop) {
        biggestDrop = drop;
        bestRow = r;
      }
    }

    let revealed = "(0,0)";
    if (expected && expected.size > 0) {
      revealed = [...expected][0];
      revealed = `(${revealed})`;
    }

    return [
      "Find a row or column where only one set of cross-outs can hit the target.",
      `Row ${bestRow + 1} must remove ${biggestDrop} total points.`,
      `One crossed cell is at ${revealed}.`
    ];
  }
};
