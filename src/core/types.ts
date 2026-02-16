export type GradeBand =
  | "1-2"
  | "2-3"
  | "3-4"
  | "4-6"
  | "6-8"
  | "8-10";

export type PuzzlePrompt = {
  text: string;
};

export type PuzzleCandidate = {
  gameTypeId: string;
  difficulty: number;
  seed: number;
  gradeBand: GradeBand;
  prompt: PuzzlePrompt;
  data: Record<string, unknown>;
  metadata: {
    expectUniqueSolution: boolean;
    skillTags: string[];
  };
};

export type ValidationIssue = {
  code: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

export type Profile = {
  id: string;
  displayName: string;
  gradeBand: GradeBand;
  createdAt: string;
};

export type Attempt = {
  id: string;
  profileId: string;
  gameTypeId: string;
  puzzleSeed: number;
  difficulty: number;
  submittedAt: string;
  answer: string;
  isCorrect: boolean;
  hintsUsed: number;
  timeMs: number;
};
