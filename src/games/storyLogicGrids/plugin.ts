import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { GradeBand, PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type CategoryTemplate = {
  id: string;
  label: string;
  values: string[];
};

type StoryTemplate = {
  id: string;
  title: string;
  intro: string;
  roles: string[];
  categories: CategoryTemplate[];
};

type LogicClue = {
  type: "is" | "not";
  role: string;
  categoryId: string;
  value: string;
  text: string;
};

type PuzzleData = {
  title: string;
  intro: string;
  roles: string[];
  categories: CategoryTemplate[];
  clues: LogicClue[];
  solution: Record<string, Record<string, string>>;
  expectedAnswer: string;
  difficultyLabel: string;
};

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

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function loadTemplates(): StoryTemplate[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, "templates.yaml"), "utf8");
  const parsed = JSON.parse(raw) as StoryTemplate[];
  return parsed;
}

const templates = loadTemplates();

function configFor(difficulty: number, gradeBand: GradeBand): {
  roleCount: number;
  categoryCount: number;
  directClueBias: number;
  label: string;
} {
  const gradeFloor = Number(String(gradeBand).split("-")[0] || "1");
  const d = Math.max(1, Math.min(6, Math.floor(difficulty)));
  if (gradeFloor <= 2 && d <= 2) {
    return { roleCount: 3, categoryCount: 2, directClueBias: 3, label: "Early Logic" };
  }
  if (d <= 1) return { roleCount: 3, categoryCount: 2, directClueBias: 3, label: "Easy" };
  if (d <= 2) return { roleCount: 3, categoryCount: 3, directClueBias: 2, label: "Easy" };
  if (d <= 3) return { roleCount: 4, categoryCount: 3, directClueBias: 2, label: "Medium" };
  if (d <= 4) return { roleCount: 4, categoryCount: 4, directClueBias: 1, label: "Medium" };
  if (d <= 5) return { roleCount: 5, categoryCount: 3, directClueBias: 1, label: "Challenge" };
  return { roleCount: 5, categoryCount: 4, directClueBias: 1, label: "Challenge" };
}

function canonicalAnswer(solution: Record<string, Record<string, string>>): string {
  const normalized: Record<string, Record<string, string>> = {};
  for (const role of Object.keys(solution).sort()) {
    normalized[role] = {};
    for (const category of Object.keys(solution[role]).sort()) {
      normalized[role][category] = solution[role][category];
    }
  }
  return JSON.stringify(normalized);
}

function renderClue(
  type: "is" | "not",
  role: string,
  category: CategoryTemplate,
  value: string,
  rng: Rng
): string {
  const isTemplates = [
    `${role} has ${value} for ${category.label}.`,
    `The ${category.label} for ${role} is ${value}.`,
    `${role}'s ${category.label} is ${value}.`
  ];
  const notTemplates = [
    `${role} does not have ${value} for ${category.label}.`,
    `The ${category.label} for ${role} is not ${value}.`,
    `${role}'s ${category.label} is not ${value}.`
  ];
  return rng.pick(type === "is" ? isTemplates : notTemplates);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

function validPermutationsForCategory(
  roles: string[],
  category: CategoryTemplate,
  clues: LogicClue[]
): string[][] {
  const relevant = clues.filter((c) => c.categoryId === category.id);
  const roleIndex = new Map(roles.map((role, idx) => [role, idx]));
  const values = category.values.slice(0, roles.length);
  return permutations(values).filter((perm) => {
    for (const clue of relevant) {
      const idx = roleIndex.get(clue.role);
      if (idx === undefined) return false;
      if (clue.type === "is" && perm[idx] !== clue.value) return false;
      if (clue.type === "not" && perm[idx] === clue.value) return false;
    }
    return true;
  });
}

function isUniquelySolved(roles: string[], categories: CategoryTemplate[], clues: LogicClue[]): boolean {
  for (const category of categories) {
    if (validPermutationsForCategory(roles, category, clues).length !== 1) return false;
  }
  return true;
}

function generateClues(
  roles: string[],
  categories: CategoryTemplate[],
  solution: Record<string, Record<string, string>>,
  rng: Rng,
  directClueBias: number
): LogicClue[] {
  const clues: LogicClue[] = [];

  for (const category of categories) {
    const candidates: LogicClue[] = [];
    const values = category.values.slice(0, roles.length);
    for (const role of roles) {
      const actual = solution[role][category.id];
      candidates.push({
        type: "is",
        role,
        categoryId: category.id,
        value: actual,
        text: renderClue("is", role, category, actual, rng)
      });
      for (const value of values) {
        if (value === actual) continue;
        candidates.push({
          type: "not",
          role,
          categoryId: category.id,
          value,
          text: renderClue("not", role, category, value, rng)
        });
      }
    }

    const direct = shuffle(rng, candidates.filter((c) => c.type === "is"));
    const indirect = shuffle(rng, candidates.filter((c) => c.type === "not"));
    const ordered = [
      ...direct.slice(0, Math.min(directClueBias, direct.length)),
      ...indirect,
      ...direct.slice(Math.min(directClueBias, direct.length))
    ];

    const categoryClues: LogicClue[] = [];
    for (const clue of ordered) {
      categoryClues.push(clue);
      const testClues = [...clues, ...categoryClues];
      if (validPermutationsForCategory(roles, category, testClues).length === 1) break;
    }
    clues.push(...categoryClues);
  }

  return shuffle(rng, clues);
}

function buildPuzzle(seed: number, difficulty: number, gradeBand: GradeBand): PuzzleData {
  const rng = new Rng(seed + difficulty * 1009);
  const cfg = configFor(difficulty, gradeBand);
  const template = templates[Math.abs(seed) % templates.length];
  const roles = shuffle(rng, template.roles).slice(0, cfg.roleCount);
  const categories = shuffle(rng, template.categories).slice(0, cfg.categoryCount).map((category) => ({
    ...category,
    values: shuffle(rng, category.values).slice(0, cfg.roleCount)
  }));

  const solution: Record<string, Record<string, string>> = {};
  for (const role of roles) solution[role] = {};
  for (const category of categories) {
    const assigned = shuffle(rng, category.values);
    for (let i = 0; i < roles.length; i += 1) {
      solution[roles[i]][category.id] = assigned[i];
    }
  }

  const clues = generateClues(roles, categories, solution, rng, cfg.directClueBias);

  return {
    title: template.title,
    intro: template.intro,
    roles,
    categories,
    clues,
    solution,
    expectedAnswer: canonicalAnswer(solution),
    difficultyLabel: cfg.label
  };
}

function normalizeAnswer(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const normalized: Record<string, Record<string, string>> = {};
    for (const [role, value] of Object.entries(parsed as Record<string, unknown>).sort()) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      normalized[role] = {};
      for (const [category, answerValue] of Object.entries(value as Record<string, unknown>).sort()) {
        normalized[role][category] = String(answerValue);
      }
    }
    return JSON.stringify(normalized);
  } catch {
    return null;
  }
}

export const storyLogicGridsPlugin: GameTypePlugin = {
  id: "story-logic-grids",
  name: "Story Logic Grids",
  minGrade: 1,
  maxGrade: 10,
  description: "Solve story-based one-to-one matching logic grid puzzles.",

  generate(input) {
    const built = buildPuzzle(input.seed, input.difficulty, input.gradeBand);
    return {
      gameTypeId: "story-logic-grids",
      difficulty: input.difficulty,
      seed: input.seed,
      gradeBand: input.gradeBand,
      prompt: {
        text: `${built.title}: ${built.intro}`
      },
      data: built,
      metadata: {
        expectUniqueSolution: true,
        skillTags: ["logic", "deduction", "classification", "reading_comprehension"]
      }
    };
  },

  solve(candidate: PuzzleCandidate): string[] {
    const data = candidate.data as unknown as PuzzleData;
    if (!Array.isArray(data.roles) || !Array.isArray(data.categories) || !Array.isArray(data.clues)) {
      return [];
    }
    if (!isUniquelySolved(data.roles, data.categories, data.clues)) return [];
    const expected = String(data.expectedAnswer || "").trim();
    return expected ? [expected] : [];
  },

  validatePuzzle(candidate: PuzzleCandidate): ValidationResult {
    const data = candidate.data as unknown as PuzzleData;
    const issues = [];
    if (candidate.gameTypeId !== "story-logic-grids") {
      issues.push({ code: "bad_game_type", message: "Wrong gameTypeId." });
    }
    if (!data.title || !data.intro) {
      issues.push({ code: "missing_story", message: "Story title and intro are required." });
    }
    if (!Array.isArray(data.roles) || data.roles.length < 3 || data.roles.length > 5) {
      issues.push({ code: "bad_roles", message: "roles must contain 3 to 5 names." });
    }
    if (!Array.isArray(data.categories) || data.categories.length < 2 || data.categories.length > 4) {
      issues.push({ code: "bad_categories", message: "categories must contain 2 to 4 entries." });
    }
    if (!Array.isArray(data.clues) || data.clues.length < 1) {
      issues.push({ code: "bad_clues", message: "clues are required." });
    }
    if (!normalizeAnswer(String(data.expectedAnswer || ""))) {
      issues.push({ code: "bad_expected_answer", message: "expectedAnswer must be canonical JSON." });
    }
    if (issues.length === 0 && !isUniquelySolved(data.roles, data.categories, data.clues)) {
      issues.push({ code: "not_unique", message: "Clues must force exactly one solution per category." });
    }
    return { ok: issues.length === 0, issues };
  },

  gradeAnswer(candidate: PuzzleCandidate, answer: string): boolean {
    const expected = normalizeAnswer(String(candidate.data.expectedAnswer || ""));
    const actual = normalizeAnswer(answer);
    return Boolean(expected && actual && expected === actual);
  },

  buildHints(candidate: PuzzleCandidate): string[] {
    const data = candidate.data as unknown as PuzzleData;
    const firstCategory = data.categories?.[0];
    const firstRole = data.roles?.[0];
    const solvedValue = firstRole && firstCategory ? data.solution?.[firstRole]?.[firstCategory.id] : "";
    const directClue = data.clues?.find((c) => c.type === "is")?.text;
    return [
      "Start with clues that say exactly what a person has, then mark that value unavailable for the others.",
      directClue || "Use each value exactly once in each category.",
      firstRole && firstCategory && solvedValue
        ? `${firstRole}'s ${firstCategory.label} is ${solvedValue}.`
        : "Each row should have one choice from every category."
    ];
  }
};
