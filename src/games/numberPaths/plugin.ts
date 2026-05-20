import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type Coord = { r: number; c: number };

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
    return this.s >>> 0;
  }
  int(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[this.next() % arr.length];
  }
}

type Config = {
  rows: number;
  cols: number;
  pathLen: number;
  step: number;
  startMin: number;
  startMax: number;
};

function configForDifficulty(difficulty: number): Config {
  if (difficulty <= 1) return { rows: 4, cols: 4, pathLen: 7, step: 1, startMin: 1, startMax: 5 };
  if (difficulty <= 2) return { rows: 4, cols: 4, pathLen: 9, step: 1, startMin: 1, startMax: 8 };
  if (difficulty <= 3) return { rows: 4, cols: 4, pathLen: 9, step: 2, startMin: 1, startMax: 6 };
  if (difficulty <= 4) return { rows: 5, cols: 5, pathLen: 10, step: 2, startMin: 2, startMax: 10 };
  if (difficulty <= 5) return { rows: 5, cols: 5, pathLen: 12, step: 2, startMin: 3, startMax: 12 };
  return { rows: 5, cols: 5, pathLen: 13, step: 3, startMin: 3, startMax: 12 };
}

function neighbors(rows: number, cols: number, cell: Coord): Coord[] {
  const out: Coord[] = [];
  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];
  for (const [dr, dc] of deltas) {
    const r = cell.r + dr;
    const c = cell.c + dc;
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      out.push({ r, c });
    }
  }
  return out;
}

function coordKey(c: Coord): string {
  return `${c.r},${c.c}`;
}

function generatePath(rows: number, cols: number, pathLen: number, rng: Rng): Coord[] {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const path: Coord[] = [];
    const used = new Set<string>();
    const start: Coord = { r: rng.int(0, rows - 1), c: rng.int(0, cols - 1) };
    path.push(start);
    used.add(coordKey(start));

    while (path.length < pathLen) {
      const cur = path[path.length - 1];
      const nextOptions = neighbors(rows, cols, cur).filter((n) => !used.has(coordKey(n)));
      if (nextOptions.length === 0) break;
      const next = rng.pick(nextOptions);
      path.push(next);
      used.add(coordKey(next));
    }

    if (path.length === pathLen) return path;
  }

  // Safe fallback path: simple snake prefix.
  const out: Coord[] = [];
  for (let r = 0; r < rows && out.length < pathLen; r += 1) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols && out.length < pathLen; c += 1) out.push({ r, c });
    } else {
      for (let c = cols - 1; c >= 0 && out.length < pathLen; c -= 1) out.push({ r, c });
    }
  }
  return out;
}

function serialisePath(path: Coord[]): string {
  return path.map((p) => `${p.r},${p.c}`).join(";");
}

function parsePath(raw: string): Coord[] | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const chunks = text.split(";").filter(Boolean);
  if (chunks.length === 0) return null;
  const out: Coord[] = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^(\d+),(\d+)$/);
    if (!m) return null;
    out.push({ r: Number(m[1]), c: Number(m[2]) });
  }
  return out;
}

function samePath(a: Coord[], b: Coord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].r !== b[i].r || a[i].c !== b[i].c) return false;
  }
  return true;
}

export const numberPathsPlugin: GameTypePlugin = {
  id: "number-paths",
  name: "Number Paths",
  minGrade: 1,
  maxGrade: 2,
  description: "Trace a path through consecutive numbers to reach the goal.",

  generate(input) {
    const cfg = configForDifficulty(input.difficulty);
    const rng = new Rng(input.seed);
    const start = rng.int(cfg.startMin, cfg.startMax);
    const path = generatePath(cfg.rows, cfg.cols, cfg.pathLen, rng);
    const target = start + (cfg.pathLen - 1) * cfg.step;

    const pathValues = new Set<number>();
    const grid = Array.from({ length: cfg.rows }, () => Array.from({ length: cfg.cols }, () => 0));
    for (let i = 0; i < path.length; i += 1) {
      const value = start + i * cfg.step;
      pathValues.add(value);
      grid[path[i].r][path[i].c] = value;
    }

    for (let r = 0; r < cfg.rows; r += 1) {
      for (let c = 0; c < cfg.cols; c += 1) {
        if (grid[r][c] !== 0) continue;
        let v = rng.int(Math.max(1, start - 4), target + 8);
        let guard = 0;
        while (pathValues.has(v) && guard < 20) {
          v = rng.int(Math.max(1, start - 4), target + 8);
          guard += 1;
        }
        grid[r][c] = v;
      }
    }

    return {
      gameTypeId: "number-paths",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Tap a path from ${start} to ${target}, counting by ${cfg.step}.`
      },
      data: {
        rows: cfg.rows,
        cols: cfg.cols,
        grid,
        start,
        target,
        step: cfg.step,
        pathLen: cfg.pathLen,
        expectedPath: serialisePath(path)
      },
      metadata: {
        expectUniqueSolution: false,
        skillTags: ["counting", "sequences", "path_planning", "number_sense"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const expected = String(candidate.data.expectedPath || "").trim();
    return expected ? [expected] : [];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const rows = Number(candidate.data.rows);
    const cols = Number(candidate.data.cols);
    const step = Number(candidate.data.step);
    const pathLen = Number(candidate.data.pathLen);
    const grid = candidate.data.grid as number[][];
    const expected = String(candidate.data.expectedPath || "");
    const issues = [];

    if (!Number.isInteger(rows) || rows < 3 || rows > 7) {
      issues.push({ code: "bad_rows", message: "rows must be an integer in [3,7]." });
    }
    if (!Number.isInteger(cols) || cols < 3 || cols > 7) {
      issues.push({ code: "bad_cols", message: "cols must be an integer in [3,7]." });
    }
    if (!Number.isInteger(step) || step < 1 || step > 5) {
      issues.push({ code: "bad_step", message: "step must be integer in [1,5]." });
    }
    if (!Number.isInteger(pathLen) || pathLen < 4) {
      issues.push({ code: "bad_path_len", message: "pathLen must be >= 4." });
    }
    if (!Array.isArray(grid) || grid.length !== rows) {
      issues.push({ code: "bad_grid", message: "grid must match rows." });
    } else if (grid.some((row) => !Array.isArray(row) || row.length !== cols)) {
      issues.push({ code: "bad_grid_shape", message: "every grid row must match cols." });
    }

    const parsed = parsePath(expected);
    if (!parsed || parsed.length !== pathLen) {
      issues.push({ code: "bad_expected_path", message: "expectedPath is missing or wrong length." });
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const expected = parsePath(String(candidate.data.expectedPath || ""));
    const actual = parsePath(answer);
    if (!expected || !actual) return false;
    return samePath(expected, actual);
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const start = Number(candidate.data.start);
    const target = Number(candidate.data.target);
    const step = Number(candidate.data.step);
    return [
      `Start on ${start}.`,
      `Each move must go up by ${step} and touch the previous square side-to-side.`,
      `Finish on ${target}.`
    ];
  }
};

