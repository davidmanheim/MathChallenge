import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type LevelProfile = {
  knownMin: number;
  knownMax: number;
  missingMin: number;
  missingMax: number;
};

function levelProfileForDifficulty(difficulty: number): LevelProfile {
  if (difficulty <= 1) {
    return { knownMin: 1, knownMax: 9, missingMin: 1, missingMax: 9 };
  }
  if (difficulty === 2) {
    // Includes some 2-digit answers, but not all.
    return { knownMin: 4, knownMax: 18, missingMin: 7, missingMax: 14 };
  }
  if (difficulty === 3) {
    // Mostly small 2-digit answers.
    return { knownMin: 12, knownMax: 35, missingMin: 8, missingMax: 16 };
  }
  if (difficulty === 4) {
    return { knownMin: 30, knownMax: 120, missingMin: 1, missingMax: 20 };
  }
  if (difficulty === 5) {
    return { knownMin: 70, knownMax: 300, missingMin: 1, missingMax: 20 };
  }
  // Hardest level: 3-digit numbers with differences up to 20.
  return { knownMin: 100, knownMax: 979, missingMin: 1, missingMax: 20 };
}

function valueFromSeed(min: number, max: number, seed: number): number {
  const span = max - min + 1;
  return min + (Math.abs(seed) % span);
}

function missingForDifficulty(difficulty: number, seed: number, profile: LevelProfile): number {
  if (difficulty === 3) {
    // 75% chance of 2-digit answers (10-16), 25% chance of upper single-digit (8-9).
    if (Math.abs(seed) % 4 === 0) {
      return valueFromSeed(8, 9, seed * 11 + 3);
    }
    return valueFromSeed(10, profile.missingMax, seed * 11 + 3);
  }
  return valueFromSeed(profile.missingMin, profile.missingMax, seed * 11 + 3);
}

function difficultyLabel(difficulty: number): string {
  if (difficulty <= 2) return "Easy";
  if (difficulty <= 4) return "Medium";
  return "Challenge";
}

function buildChoices(target: number, known: number, seed: number): number[] {
  const missing = target - known;
  const options = new Set<number>([missing]);
  const deltas = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5];

  for (let i = 0; i < deltas.length && options.size < 4; i += 1) {
    const delta = deltas[(seed + i) % deltas.length];
    const candidate = missing + delta;
    if (candidate >= 0) {
      options.add(candidate);
    }
  }

  let cursor = 0;
  while (options.size < 4) {
    const candidate = (Math.abs(seed) * 13 + cursor * 7) % Math.max(target + 2, 22);
    options.add(candidate);
    cursor += 1;
  }

  const choices = [...options].slice(0, 4);
  const rotate = seed % choices.length;
  return [...choices.slice(rotate), ...choices.slice(0, rotate)];
}

export const numberBondsPlugin: GameTypePlugin = {
  id: "number-bonds-sprint",
  name: "Number Bonds Sprint",
  minGrade: 1,
  maxGrade: 2,
  description: "Find the missing addend to complete a target sum quickly.",

  generate(input) {
    const profile = levelProfileForDifficulty(input.difficulty);
    const known = valueFromSeed(profile.knownMin, profile.knownMax, input.seed * 7 + 1);
    const missing = missingForDifficulty(input.difficulty, input.seed, profile);
    const target = known + missing;
    const linePadding = input.difficulty >= 4 ? 2 : 0;
    const lineMin = input.difficulty >= 4
      ? Math.max(0, Math.min(known, target) - linePadding)
      : 0;
    const lineMax = input.difficulty >= 4
      ? Math.max(known, target) + linePadding
      : target;

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
        known,
        choices: buildChoices(target, known, input.seed),
        inputMode: "buttons",
        showNumberLine: true,
        numberLineMin: lineMin,
        numberLineMax: lineMax,
        difficultyLabel: difficultyLabel(input.difficulty)
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
