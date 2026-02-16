import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type PatternRule = "add" | "multiply";

function buildPuzzle(seed: number, difficulty: number) {
  const rule: PatternRule = seed % 2 === 0 ? "add" : "multiply";
  const start = 2 + (seed % 7);
  const step = rule === "add" ? 1 + (difficulty % 6) : 2 + (difficulty % 3);
  const length = difficulty <= 2 ? 5 : 6;
  const sequence: number[] = [];
  let current = start;

  for (let i = 0; i < length; i += 1) {
    sequence.push(current);
    current = rule === "add" ? current + step : current * step;
  }

  const missingIndex = Math.max(2, length - 2);
  const answer = sequence[missingIndex];
  const masked = [...sequence];
  masked[missingIndex] = -1;

  // Build plausible distractors based on common student mistakes
  const prev = sequence[missingIndex - 1];
  const next = missingIndex + 1 < sequence.length ? sequence[missingIndex + 1] : null;
  const candidates = new Set<number>();

  if (rule === "add") {
    // Off-by-one-step errors
    candidates.add(answer + step);
    candidates.add(Math.max(1, answer - step));
    // Adjacent value confusion
    candidates.add(prev);
    if (next !== null) candidates.add(next);
    // Wrong step (±1 of the step)
    candidates.add(prev + step + 1);
    candidates.add(Math.max(1, prev + step - 1));
    // Double step
    candidates.add(prev + step * 2);
  } else {
    // Multiply: additive confusion (added instead of multiplied)
    candidates.add(prev + step);
    // Wrong multiplier
    candidates.add(prev * (step + 1));
    candidates.add(prev * Math.max(2, step - 1));
    // Adjacent values
    candidates.add(prev);
    if (next !== null) candidates.add(next);
    // Off-by-one of the answer
    candidates.add(answer + step);
    candidates.add(Math.max(1, answer - step));
  }

  // Remove the correct answer and any non-positive values
  candidates.delete(answer);
  const distractorPool = [...candidates].filter((n) => n > 0 && n !== answer);

  // Pick 2 distractors, seeded for determinism
  const pickIndex1 = seed % distractorPool.length;
  const d1 = distractorPool.splice(pickIndex1, 1)[0];
  const pickIndex2 = (seed * 3 + 7) % Math.max(1, distractorPool.length);
  const d2 = distractorPool.length > 0 ? distractorPool[pickIndex2] : Math.max(1, answer + 2);

  // Shuffle the 3 choices using the seed — position varies per puzzle
  const unsorted = [answer, d1, d2];
  const slot = ((seed * 2654435761) >>> 0) % 3; // hash-based starting rotation
  const choices = [...unsorted.slice(slot), ...unsorted.slice(0, slot)];

  return { rule, step, masked, missingIndex, answer, choices };
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

    if (!Array.isArray(seq) || seq.length < 4 || missingIndex <= 0 || missingIndex >= seq.length) {
      return [];
    }

    if (rule === "add") {
      return [String(seq[missingIndex - 1] + step)];
    }
    if (rule === "multiply") {
      return [String(seq[missingIndex - 1] * step)];
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

    if (!Array.isArray(seq) || seq.length < 4) {
      issues.push({ code: "bad_sequence", message: "Masked sequence must have at least 4 entries." });
    }
    if (!Array.isArray(choices) || choices.length < 3) {
      issues.push({ code: "bad_choices", message: "Choices must include at least 3 options." });
    }
    if (!Number.isInteger(missingIndex) || missingIndex < 1 || missingIndex >= seq.length) {
      issues.push({ code: "bad_missing_index", message: "Missing index is out of range." });
    }
    if (!Number.isFinite(step) || step <= 0) {
      issues.push({ code: "bad_step", message: "Pattern step must be > 0." });
    }
    if (!["add", "multiply"].includes(rule)) {
      issues.push({ code: "bad_rule", message: "Pattern rule must be add or multiply." });
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
    const expected = this.solve(candidate)[0];

    if (rule === "add") {
      return [
        "Look at how much each number increases.",
        `Each step adds ${step}.`,
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
