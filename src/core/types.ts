import type { ExplanationScore } from "./explanation-rubric.ts";

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

/**
 * Optional per-puzzle "reasoning prompt" declaration.
 *
 * A plugin MAY attach this object to its generated `candidate.data.reasoning`
 * to tell the frontend that this puzzle invites the student to explain their
 * thinking and/or show a second solving method, and to supply the prompt text
 * to display. It is purely advisory:
 *   - The base answer/grading flow is completely unaffected by its presence.
 *   - Correctness NEVER depends on the explanation or second method.
 *   - Plugins that omit it simply get no reasoning prompt (the default).
 *
 * See `docs/FRAMEWORK.md` ("Reasoning capture") for the full contract.
 */
export type ReasoningSupport = {
  /** Show a free-text "explain your reasoning" prompt for this puzzle. */
  supportsExplanation: boolean;
  /** Show a free-text "show a second method" prompt for this puzzle. */
  supportsTwoMethod: boolean;
  /** Prompt/label shown above the explanation textarea (optional override). */
  explanationPrompt?: string;
  /** Prompt/label shown above the second-method textarea (optional override). */
  secondMethodPrompt?: string;
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
  usedHint: boolean;
  latencyBand: "fast" | "on_time" | "slow" | "unknown";
  successScore: number;
  skillTags: string[];
  // ----- Reasoning capture (optional enrichment; never affects correctness) -----
  // Captured verbatim from the attempt payload. Stored so a follow-up task can
  // score explanation quality against a rubric. NOT graded or scored here.
  /** Free-text "explain your reasoning" response. Empty string when not provided. */
  explanation: string;
  /** Free-text "show a second method" response. Empty string when not provided. */
  secondMethod: string;
  /** Trivial presence check: true if either explanation or secondMethod is non-empty. */
  hasExplanation: boolean;
  /**
   * Optional rubric score for the explanation quality (see
   * `src/core/explanation-rubric.ts` / `docs/EXPLANATION_RUBRIC.md`).
   *
   * Present ONLY when a non-empty explanation was submitted for a game that
   * supports reasoning capture; absent otherwise (so existing stored attempts
   * and the Firestore write path are unaffected — the field is never written as
   * `undefined`). This is purely additive encouragement: it NEVER affects
   * `isCorrect` or `successScore`.
   */
  explanationScore?: ExplanationScore;
};
