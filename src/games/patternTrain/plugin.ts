import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type PatternRule = "add" | "multiply" | "affine";

type PuzzleBuild = {
  rule: PatternRule;
  step: number;
  factor?: number;
  offset?: number;
  masked: number[];
  missingIndex: number;
  answer: number;
  choices: number[];
};

function makeRng(seed: number): () => number {
  let state = ((seed >>> 0) + 1) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
}

function randInt(next: () => number, min: number, max: number): number {
  if (max <= min) return min;
  const span = max - min + 1;
  // Use upper bits from the LCG output for better spread.
  return min + ((next() >>> 8) % span);
}

function buildPuzzle(seed: number, difficulty: number) {
  const next = makeRng(seed + difficulty * 101);
  const length = difficulty <= 2 ? 5 : difficulty <= 4 ? 6 : difficulty === 5 ? 7 : 6;

  let rule: PatternRule = "add";
  let step = 1;
  let factor: number | undefined;
  let offset: number | undefined;

  if (difficulty <= 1) {
    rule = "add";
    step = randInt(next, 1, 3);
  } else if (difficulty === 2) {
    rule = "add";
    step = randInt(next, -1, 7);
  } else if (difficulty === 3) {
    if (randInt(next, 0, 3) === 0) {
      rule = "multiply";
      factor = randInt(next, 2, 3);
      step = factor;
    } else {
      rule = "add";
      step = randInt(next, -5, 13);
    }
  } else if (difficulty === 4) {
    rule = "multiply";
    factor = randInt(next, 2, 6);
    step = factor;
  } else if (difficulty === 5) {
    rule = "affine";
    factor = randInt(next, 2, 4);
    offset = randInt(next, -6, 8);
    step = offset;
  } else {
    rule = "affine";
    factor = randInt(next, 2, 3);
    offset = randInt(next, -12, 15);
    step = offset;
  }

  let sequence: number[] = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let start = 2;
    if (rule === "add") {
      const minStart = 2 + Math.max(0, -step) * (length - 1);
      const maxStart = difficulty <= 2 ? 20 : 50;
      start = randInt(next, minStart, maxStart);
    } else if (rule === "multiply") {
      start = randInt(next, 2, difficulty <= 4 ? 12 : 18);
    } else {
      start = randInt(next, difficulty <= 5 ? 3 : 2, difficulty <= 5 ? 24 : 16);
    }

    const trial: number[] = [];
    let current = start;
    let valid = true;
    for (let i = 0; i < length; i += 1) {
      trial.push(current);
      if (i === length - 1) break;
      if (rule === "add") {
        current += step;
      } else if (rule === "multiply") {
        current *= factor ?? 2;
      } else {
        current = current * (factor ?? 2) + (offset ?? 0);
      }
      if (!Number.isFinite(current) || current <= 0 || current > 50000) {
        valid = false;
        break;
      }
    }
    if (valid) {
      sequence = trial;
      break;
    }
  }

  if (sequence.length === 0) {
    // Guaranteed safe fallback.
    rule = "add";
    step = 2;
    factor = undefined;
    offset = undefined;
    sequence = [5, 7, 9, 11, 13, 15];
  }

  const missingIndex = Math.max(2, length - 2);
  const answer = sequence[missingIndex];
  const masked = [...sequence];
  masked[missingIndex] = -1;

  // Build plausible distractors based on common student mistakes
  const prev = sequence[missingIndex - 1];
  const nextValue = missingIndex + 1 < sequence.length ? sequence[missingIndex + 1] : null;
  const candidates = new Set<number>();

  if (rule === "add") {
    // Off-by-one-step errors.
    candidates.add(answer + step);
    candidates.add(answer - step);
    // Adjacent value confusion.
    candidates.add(prev);
    if (nextValue !== null) candidates.add(nextValue);
    // Wrong step (+/- 1 of the step).
    candidates.add(prev + step + 1);
    candidates.add(prev + step - 1);
    // Double step.
    candidates.add(prev + step * 2);
  } else if (rule === "multiply") {
    const mul = factor ?? step;
    // Additive confusion (added instead of multiplied).
    candidates.add(prev + mul);
    // Wrong multiplier.
    candidates.add(prev * (mul + 1));
    candidates.add(prev * Math.max(2, mul - 1));
    // Adjacent values.
    candidates.add(prev);
    if (nextValue !== null) candidates.add(nextValue);
    // Off-by-one of the answer.
    candidates.add(answer + mul);
    candidates.add(answer - mul);
  } else {
    const mul = factor ?? 2;
    const add = offset ?? 0;
    // Common confusion: applying only one part of x -> x*mul + add.
    candidates.add(prev * mul);
    candidates.add(prev + add);
    // Wrong factor.
    candidates.add(prev * (mul + 1) + add);
    candidates.add(prev * Math.max(2, mul - 1) + add);
    // Wrong offset direction.
    candidates.add(prev * mul - add);
    // Neighbor confusion.
    candidates.add(prev);
    if (nextValue !== null) candidates.add(nextValue);
  }

  // Remove the correct answer and any non-positive values.
  candidates.delete(answer);
  const distractorPool = [...candidates].filter((n) => n > 0 && n !== answer);

  // Pick 2 distractors, seeded for determinism.
  const fallbackPool = [answer - 1, answer + 1, answer - 2, answer + 2].filter((n) => n > 0);
  const pool = distractorPool.length > 0 ? distractorPool : fallbackPool;
  const pickIndex1 = Math.abs(seed) % pool.length;
  const d1 = pool.splice(pickIndex1, 1)[0];
  const pickIndex2 = (Math.abs(seed) * 3 + 7) % Math.max(1, pool.length);
  const d2 = pool.length > 0 ? pool[pickIndex2] : Math.max(1, answer + 2);

  // Shuffle the 3 choices using the seed.
  const unsorted = [answer, d1, d2];
  const slot = ((seed * 2654435761) >>> 0) % 3; // hash-based starting rotation
  const choices = [...unsorted.slice(slot), ...unsorted.slice(0, slot)];

  const out: PuzzleBuild = { rule, step, masked, missingIndex, answer, choices };
  if (typeof factor === "number") out.factor = factor;
  if (typeof offset === "number") out.offset = offset;
  return out;
}

export const patternTrainPlugin: GameTypePlugin = {
  id: "pattern-train",
  name: "Pattern Train",
  minGrade: 1,
  maxGrade: 3,
  description: "Find the missing number in a pattern and pick the right carriage.",

  generate(input) {
    const p = buildPuzzle(input.seed, input.difficulty);
    return {
      gameTypeId: "pattern-train",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `Fill the missing train car number: ${p.masked
          .map((n) => (n === -1 ? "?" : String(n)))
          .join(" , ")}`
      },
      data: {
        rule: p.rule,
        step: p.step,
        factor: p.factor,
        offset: p.offset,
        missingIndex: p.missingIndex,
        sequenceMasked: p.masked,
        choices: p.choices
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: ["patterns", "sequence_rules", "early_algebra"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const seq = candidate.data.sequenceMasked as number[];
    const missingIndex = Number(candidate.data.missingIndex);
    const step = Number(candidate.data.step);
    const rule = String(candidate.data.rule);
    const factor = Number(candidate.data.factor);
    const offset = Number(candidate.data.offset);

    if (!Array.isArray(seq) || seq.length < 4 || missingIndex <= 0 || missingIndex >= seq.length) {
      return [];
    }

    if (rule === "add") {
      return [String(seq[missingIndex - 1] + step)];
    }
    if (rule === "multiply") {
      return [String(seq[missingIndex - 1] * step)];
    }
    if (rule === "affine") {
      if (!Number.isFinite(factor) || factor <= 1 || !Number.isFinite(offset)) return [];
      return [String(seq[missingIndex - 1] * factor + offset)];
    }
    return [];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const issues = [];
    const seq = candidate.data.sequenceMasked as number[];
    const choices = candidate.data.choices as number[];
    const missingIndex = Number(candidate.data.missingIndex);
    const step = Number(candidate.data.step);
    const rule = String(candidate.data.rule);
    const factor = Number(candidate.data.factor);
    const offset = Number(candidate.data.offset);

    if (!Array.isArray(seq) || seq.length < 4) {
      issues.push({ code: "bad_sequence", message: "Masked sequence must have at least 4 entries." });
    }
    if (!Array.isArray(choices) || choices.length < 3) {
      issues.push({ code: "bad_choices", message: "Choices must include at least 3 options." });
    }
    if (!Number.isInteger(missingIndex) || missingIndex < 1 || missingIndex >= seq.length) {
      issues.push({ code: "bad_missing_index", message: "Missing index is out of range." });
    }
    if (!["add", "multiply", "affine"].includes(rule)) {
      issues.push({ code: "bad_rule", message: "Pattern rule must be add, multiply, or affine." });
    }
    if (rule === "add" && !Number.isFinite(step)) {
      issues.push({ code: "bad_step", message: "Add pattern step must be numeric." });
    }
    if (rule === "multiply" && (!Number.isFinite(step) || step <= 1)) {
      issues.push({ code: "bad_step", message: "Multiply pattern step must be > 1." });
    }
    if (rule === "affine") {
      if (!Number.isFinite(factor) || factor <= 1) {
        issues.push({ code: "bad_factor", message: "Affine factor must be > 1." });
      }
      if (!Number.isFinite(offset)) {
        issues.push({ code: "bad_offset", message: "Affine offset must be numeric." });
      }
    }
    if (seq[missingIndex] !== -1) {
      issues.push({ code: "missing_not_masked", message: "Missing slot must be masked as -1." });
    }
    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const expected = this.solve(candidate)[0];
    return answer.trim() === expected;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const rule = String(candidate.data.rule);
    const step = Number(candidate.data.step);
    const factor = Number(candidate.data.factor);
    const offset = Number(candidate.data.offset);
    const expected = this.solve(candidate)[0];

    if (rule === "add") {
      return [
        "Look at how much each number changes each step.",
        `Each step adds ${step}.`,
        `The missing number is ${expected}.`
      ];
    }
    if (rule === "affine") {
      return [
        "Each step does two moves: multiply, then shift.",
        `Use x -> (x * ${factor}) + ${offset}.`,
        `The missing number is ${expected}.`
      ];
    }
    return [
      "Check how each number scales to the next one.",
      `Each step multiplies by ${step}.`,
      `The missing number is ${expected}.`
    ];
  }
};
