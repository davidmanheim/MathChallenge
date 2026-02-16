import type { GameTypePlugin, GenerateInput } from "./game-plugin.ts";
import type { PuzzleCandidate, ValidationIssue } from "./types.ts";

type GateResult = {
  candidate: PuzzleCandidate;
  canonicalSolutions: string[];
};

function baseValidate(candidate: PuzzleCandidate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!candidate.prompt?.text || candidate.prompt.text.trim().length === 0) {
    issues.push({ code: "empty_prompt", message: "Prompt text is required." });
  }
  if (!Number.isInteger(candidate.seed)) {
    issues.push({ code: "bad_seed", message: "Seed must be an integer." });
  }
  if (!Number.isFinite(candidate.difficulty) || candidate.difficulty < 1) {
    issues.push({
      code: "bad_difficulty",
      message: "Difficulty must be >= 1."
    });
  }
  return issues;
}

function assertConsistency(
  plugin: GameTypePlugin,
  candidate: PuzzleCandidate,
  solutions: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const solution of solutions) {
    if (!plugin.gradeAnswer(candidate, solution)) {
      issues.push({
        code: "grader_inconsistent",
        message: "A canonical solution did not pass the answer grader."
      });
      break;
    }
  }
  return issues;
}

export function generateCheckedPuzzle(
  plugin: GameTypePlugin,
  input: Omit<GenerateInput, "seed"> & { seedStart?: number },
  maxAttempts = 25
): GateResult {
  const firstSeed = Number.isInteger(input.seedStart)
    ? (input.seedStart as number)
    : Math.floor(Math.random() * 10_000_000);

  for (let i = 0; i < maxAttempts; i += 1) {
    const seed = firstSeed + i;
    const candidate = plugin.generate({ ...input, seed });

    const issues = [...baseValidate(candidate)];
    const pluginValidation = plugin.validatePuzzle(candidate);
    if (!pluginValidation.ok) {
      issues.push(...pluginValidation.issues);
    }

    const solutions = plugin.solve(candidate);
    if (solutions.length === 0) {
      issues.push({
        code: "unsolvable",
        message: "Solver found zero solutions."
      });
    }
    if (candidate.metadata.expectUniqueSolution && solutions.length !== 1) {
      issues.push({
        code: "not_unique",
        message: "Expected exactly one solution."
      });
    }
    issues.push(...assertConsistency(plugin, candidate, solutions));

    if (issues.length === 0) {
      return { candidate, canonicalSolutions: solutions };
    }
  }

  throw new Error(
    `Validation gate failed: unable to generate checked puzzle for ${plugin.id} within ${maxAttempts} attempts`
  );
}
