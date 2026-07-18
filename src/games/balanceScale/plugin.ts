import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

// ===== Seeded RNG =====

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed ^ 0xcafebabe) >>> 0;
  }
  next(): number {
    this.s = (this.s * 1103515245 + 12345) >>> 0;
    return this.s;
  }
  int(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[this.next() % arr.length];
  }
}

// ===== Equation Types =====

// SubTypes by difficulty:
//   1    -> "one_step_add"     :  x + b = c           (solve for x)
//   2    -> "one_step_mul"     :  a*x = c              (solve for x)
//   3    -> "two_step"         :  a*x + b = c          (solve for x)
//   4    -> "two_step_neg"     :  a*x - b = c  or  c - a*x = b  (may involve negation)
//   5    -> "both_sides"       :  a*x + b = d*x + e    (variables on both sides)
//   6+   -> "multi_step"       :  a*(x + b) = c  or  (a*x + b)/c = d

type SubType =
  | "one_step_add"
  | "one_step_mul"
  | "two_step"
  | "two_step_neg"
  | "both_sides"
  | "multi_step";

function subTypeForDifficulty(d: number): SubType {
  if (d <= 1) return "one_step_add";
  if (d <= 2) return "one_step_mul";
  if (d <= 3) return "two_step";
  if (d <= 4) return "two_step_neg";
  if (d <= 5) return "both_sides";
  return "multi_step";
}

type Equation = {
  subType: SubType;
  display: string; // human-readable equation string
  left: Term[]; // left side terms for visual display
  right: Term[]; // right side terms for visual display
  answer: number; // value of x
};

type Term = {
  type: "variable" | "constant";
  coefficient?: number; // for variable terms: a in a*x
  value?: number; // for constant terms
};

function generateEquation(rng: Rng, difficulty: number): Equation {
  const st = subTypeForDifficulty(difficulty);

  if (st === "one_step_add") {
    // x + b = c, where x is positive, b is positive, c is positive
    const x = rng.int(1, 15);
    const b = rng.int(1, 12);
    const c = x + b;
    return {
      subType: st,
      display: `x + ${b} = ${c}`,
      left: [
        { type: "variable", coefficient: 1 },
        { type: "constant", value: b }
      ],
      right: [{ type: "constant", value: c }],
      answer: x
    };
  }

  if (st === "one_step_mul") {
    // a*x = c
    const x = rng.int(1, 12);
    const a = rng.int(2, 8);
    const c = a * x;
    return {
      subType: st,
      display: `(${a}x) = ${c}`,
      left: [{ type: "variable", coefficient: a }],
      right: [{ type: "constant", value: c }],
      answer: x
    };
  }

  if (st === "two_step") {
    // a*x + b = c
    const x = rng.int(1, 10);
    const a = rng.int(2, 6);
    const b = rng.int(1, 15);
    const c = a * x + b;
    return {
      subType: st,
      display: `(${a}x) + ${b} = ${c}`,
      left: [
        { type: "variable", coefficient: a },
        { type: "constant", value: b }
      ],
      right: [{ type: "constant", value: c }],
      answer: x
    };
  }

  if (st === "two_step_neg") {
    // a*x - b = c (ensure positive answer)
    const x = rng.int(2, 12);
    const a = rng.int(2, 6);
    const b = rng.int(1, Math.min(15, a * x - 1));
    const c = a * x - b;
    return {
      subType: st,
      display: `(${a}x) \u2212 ${b} = ${c}`,
      left: [
        { type: "variable", coefficient: a },
        { type: "constant", value: -b }
      ],
      right: [{ type: "constant", value: c }],
      answer: x
    };
  }

  if (st === "both_sides") {
    // Build a*x + b = d*x + e with a > d, positive x, non-negative b and e
    const x = rng.int(1, 10);
    const a = rng.int(3, 8);
    const d = rng.int(1, a - 1);
    // Pick b >= 1, then compute e = (a-d)*x + b  (always positive)
    const b = rng.int(1, 15);
    const e = (a - d) * x + b;
    return {
      subType: st,
      display: `(${a}x) + ${b} = (${d}x) + ${e}`,
      left: [
        { type: "variable", coefficient: a },
        { type: "constant", value: b }
      ],
      right: [
        { type: "variable", coefficient: d },
        { type: "constant", value: e }
      ],
      answer: x
    };
  }

  // multi_step: a*(x + b) = c
  const x = rng.int(1, 10);
  const a = rng.int(2, 6);
  const b = rng.int(1, 10);
  const c = a * (x + b);
  return {
    subType: st,
    display: `${a}(x + ${b}) = ${c}`,
    left: [
      { type: "variable", coefficient: a },
      { type: "constant", value: a * b }
    ],
    right: [{ type: "constant", value: c }],
    answer: x
  };
}

// ===== Plugin =====

export const balanceScalePlugin: GameTypePlugin = {
  id: "balance-scale",
  name: "Balance Scale",
  minGrade: 4,
  maxGrade: 8,
  description:
    "Solve equations by keeping the scale balanced. Find the value of x that makes both sides equal.",

  generate(input) {
    const rng = new Rng(input.seed);
    const eq = generateEquation(rng, input.difficulty);

    return {
      gameTypeId: "balance-scale",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Solve for x:\n${eq.display}`
      },
      data: {
        subType: eq.subType,
        display: eq.display,
        left: eq.left,
        right: eq.right,
        answer: eq.answer,
        // Optional reasoning prompt (see docs/FRAMEWORK.md "Reasoning capture").
        // Advisory only — never affects grading.
        reasoning: {
          supportsExplanation: true,
          supportsTwoMethod: true,
          explanationPrompt:
            "Explain the steps you took to get x by itself.",
          secondMethodPrompt:
            "Can you find x a different way? (e.g. by inspection/guess-and-check instead of algebra, or the reverse)"
        }
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: [
          "algebra",
          "equations",
          eq.subType === "one_step_add" || eq.subType === "one_step_mul"
            ? "one_step_equations"
            : "multi_step_equations"
        ]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const answer = Number(candidate.data.answer);
    if (!Number.isFinite(answer)) return [];
    return [String(answer)];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues = [];
    const answer = Number(candidate.data.answer);
    const display = String(candidate.data.display ?? "");
    const left = candidate.data.left as Term[];
    const right = candidate.data.right as Term[];

    if (!Number.isInteger(answer)) {
      issues.push({
        code: "non_integer_answer",
        message: "Answer must be an integer."
      });
    }
    if (answer < 0) {
      issues.push({
        code: "negative_answer",
        message: "Answer should be non-negative for this age group."
      });
    }
    if (!display || display.length === 0) {
      issues.push({
        code: "empty_display",
        message: "Equation display string is required."
      });
    }
    if (!Array.isArray(left) || !Array.isArray(right)) {
      issues.push({
        code: "bad_terms",
        message: "Left and right term arrays required."
      });
    }

    // Verify the answer actually satisfies the equation
    if (Array.isArray(left) && Array.isArray(right)) {
      const evalSide = (terms: Term[], x: number) =>
        terms.reduce((sum, t) => {
          if (t.type === "variable") return sum + (t.coefficient ?? 1) * x;
          return sum + (t.value ?? 0);
        }, 0);
      const lv = evalSide(left, answer);
      const rv = evalSide(right, answer);
      if (lv !== rv) {
        issues.push({
          code: "inconsistent_answer",
          message: `x=${answer} gives left=${lv}, right=${rv}. Sides don't match.`
        });
      }
    }

    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const trimmed = answer.trim().replace(/^x\s*=\s*/, "");
    if (!/^-?\d+$/.test(trimmed)) return false;
    return Number(trimmed) === Number(candidate.data.answer);
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const st = String(candidate.data.subType) as SubType;
    const answer = Number(candidate.data.answer);
    const display = String(candidate.data.display);

    if (st === "one_step_add") {
      return [
        "To isolate x, do the opposite operation to both sides.",
        `Subtract the number from both sides of: ${display}`,
        `x = ${answer}`
      ];
    }
    if (st === "one_step_mul") {
      return [
        "x is being multiplied. What's the opposite of multiplication?",
        `Divide both sides by the coefficient of x.`,
        `x = ${answer}`
      ];
    }
    if (st === "two_step" || st === "two_step_neg") {
      return [
        "Two steps: first undo addition/subtraction, then undo multiplication.",
        `After the first step, you should have something like ?x = ?.`,
        `x = ${answer}`
      ];
    }
    if (st === "both_sides") {
      return [
        "Collect all x terms on one side and all numbers on the other.",
        `Move the x terms by subtracting the smaller coefficient from both sides.`,
        `x = ${answer}`
      ];
    }
    return [
      "Distribute first, then solve the two-step equation.",
      `After distributing, simplify and isolate x.`,
      `x = ${answer}`
    ];
  }
};
