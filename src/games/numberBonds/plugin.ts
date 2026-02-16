import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

function targetRangeForDifficulty(difficulty: number): [number, number] {
  if (difficulty <= 2) return [10, 20];
  if (difficulty <= 4) return [20, 100];
  return [100, 500];
}

export const numberBondsPlugin: GameTypePlugin = {
  id: "number-bonds-sprint",
  name: "Number Bonds Sprint",
  minGrade: 1,
  maxGrade: 2,
  description: "Find the missing addend to complete a target sum quickly.",

  generate(input) {
    const [minTarget, maxTarget] = targetRangeForDifficulty(input.difficulty);
    const spread = maxTarget - minTarget + 1;
    const target = minTarget + (input.seed % spread);

    const minKnown = Math.max(1, Math.floor(target * 0.2));
    const maxKnown = Math.max(minKnown, target - 1);
    const knownSpread = maxKnown - minKnown + 1;
    const known = minKnown + ((input.seed * 7) % knownSpread);

    return {
      gameTypeId: "number-bonds-sprint",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `${known} + ? = ${target}`
      },
      data: {
        target,
        known
      },
      metadata: {
        expectUniqueSolution: true,
        skillTags: ["addition", "number_bonds", "mental_math"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const target = Number(candidate.data.target);
    const known = Number(candidate.data.known);
    const missing = target - known;
    if (!Number.isFinite(missing)) return [];
    return [String(missing)];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const target = Number(candidate.data.target);
    const known = Number(candidate.data.known);
    const issues = [];

    if (!Number.isInteger(target) || target <= 1) {
      issues.push({
        code: "invalid_target",
        message: "Target must be an integer > 1."
      });
    }
    if (!Number.isInteger(known) || known < 1 || known >= target) {
      issues.push({
        code: "invalid_known",
        message: "Known addend must be >= 1 and less than target."
      });
    }

    return {
      ok: issues.length === 0,
      issues
    };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const normalized = answer.trim();
    if (!/^-?\d+$/.test(normalized)) return false;
    const n = Number(normalized);
    const target = Number(candidate.data.target);
    const known = Number(candidate.data.known);
    return known + n === target;
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const target = Number(candidate.data.target);
    const known = Number(candidate.data.known);
    const missing = target - known;
    return [
      `Think: what number plus ${known} equals ${target}?`,
      `Try counting up from ${known} to ${target}.`,
      `The missing number is ${missing}.`
    ];
  }
};
