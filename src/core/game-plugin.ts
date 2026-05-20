import type {
  GradeBand,
  PuzzleCandidate,
  ValidationResult
} from "./types.ts";

export type GenerateInput = {
  gradeBand: GradeBand;
  difficulty: number;
  seed: number;
  pairCount?: number;
};

export type PuzzleValidationContext = {
  candidate: PuzzleCandidate;
};

export type GameTypePlugin = {
  id: string;
  name: string;
  minGrade: number;
  maxGrade: number;
  description: string;
  generate(input: GenerateInput): PuzzleCandidate;
  solve(candidate: PuzzleCandidate): string[];
  validatePuzzle(candidate: PuzzleCandidate): ValidationResult;
  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean;
  buildHints(candidate: PuzzleCandidate): string[];
};
