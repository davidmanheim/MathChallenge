import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameTypePlugin } from "../../core/game-plugin.ts";
import type { GradeBand, PuzzleCandidate, ValidationResult } from "../../core/types.ts";

type ValueGroup = {
  id: string;
  label: string;
  values: string[];
};

type CategoryTemplate = {
  id: string;
  label: string;
  values: string[];
  groups?: ValueGroup[];
  ordered?: boolean;
};

type StoryTemplate = {
  id: string;
  title: string;
  intro: string;
  roles: string[];
  categories: CategoryTemplate[];
};

type Assignment = Record<string, Record<string, string>>;

type Constraint =
  | { type: "is"; role: string; categoryId: string; value: string }
  | { type: "not"; role: string; categoryId: string; value: string }
  | { type: "notAny"; role: string; categoryId: string; values: string[] }
  | { type: "initialNot"; role: string; categoryId: string; letters: string[] }
  | { type: "order"; categoryId: string; values: string[]; direction: "ascending" | "descending" }
  | {
      type: "link";
      categoryId: string;
      value: string;
      otherCategoryId: string;
      otherValue: string;
      relation: "is" | "not";
    }
  | {
      type: "categoryOrder";
      identifyCategoryId: string;
      identifyValues: string[];
      orderCategoryId: string;
      direction: "ascending" | "descending";
    };

type LogicClue = {
  kind: "direct" | "negative" | "initial" | "group" | "order" | "link" | "bundle" | "compound";
  text: string;
  constraints: Constraint[];
};

type PuzzleData = {
  title: string;
  intro: string;
  roles: string[];
  categories: CategoryTemplate[];
  clues: LogicClue[];
  solution: Assignment;
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
  return JSON.parse(readFileSync(join(here, "templates.yaml"), "utf8")) as StoryTemplate[];
}

const templates = loadTemplates();

function configFor(difficulty: number, gradeBand: GradeBand): {
  roleCount: number;
  categoryCount: number;
  targetClues: number;
  complexClues: boolean;
  label: string;
} {
  const gradeFloor = Number(String(gradeBand).split("-")[0] || "1");
  const d = Math.max(1, Math.min(6, Math.floor(difficulty)));
  if (gradeFloor <= 2 && d <= 2) {
    return { roleCount: 3, categoryCount: 2, targetClues: 4, complexClues: false, label: "Early Logic" };
  }
  if (d <= 1) return { roleCount: 3, categoryCount: 2, targetClues: 4, complexClues: false, label: "Easy" };
  if (d <= 2) return { roleCount: 3, categoryCount: 3, targetClues: 5, complexClues: true, label: "Easy" };
  if (d <= 3) return { roleCount: 4, categoryCount: 3, targetClues: 6, complexClues: true, label: "Medium" };
  if (d <= 4) return { roleCount: 4, categoryCount: 4, targetClues: 7, complexClues: true, label: "Medium" };
  if (d <= 5) return { roleCount: 5, categoryCount: 3, targetClues: 7, complexClues: true, label: "Challenge" };
  return { roleCount: 5, categoryCount: 4, targetClues: 8, complexClues: true, label: "Challenge" };
}

function canonicalAnswer(solution: Assignment): string {
  const normalized: Assignment = {};
  for (const role of Object.keys(solution).sort()) {
    normalized[role] = {};
    for (const category of Object.keys(solution[role]).sort()) {
      normalized[role][category] = solution[role][category];
    }
  }
  return JSON.stringify(normalized);
}

function firstLetter(value: string): string {
  return value.trim().charAt(0).toUpperCase();
}

function isAlphabeticValue(value: string): boolean {
  return /^[A-Za-z]/.test(value.trim());
}

function joinList(items: string[], conjunction = "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}

function valueLabel(category: CategoryTemplate, value: string): string {
  const label = category.label.toLowerCase();
  if (["keeper", "guide", "helper", "witness", "judge"].includes(category.id)) {
    return `${label} ${value}`;
  }
  return `${value} ${label}`;
}

function isNameLikeCategory(category: CategoryTemplate): boolean {
  return ["keeper", "guide", "helper", "witness", "judge"].includes(category.id);
}

function pluralLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.endsWith("y")) return `${lower.slice(0, -1)}ies`;
  if (lower.endsWith("s")) return lower;
  return `${lower}s`;
}

function roleNoun(roles: string[]): string {
  const numeric = roles.every((r) => /\d+/.test(r));
  if (numeric && roles.some((r) => /^tank\s+\d+/i.test(r))) return "tank";
  if (numeric) return "slot";
  if (roles.every((r) => /^case\s+/i.test(r))) return "case";
  if (roles.every((r) => /^booth\s+/i.test(r))) return "booth";
  return "row";
}

function hasOrderedRoles(roles: string[]): boolean {
  return roles.every((role) => /\d+/.test(role)) ||
    roles.every((role) => /^case\s+[a-z]$/i.test(role)) ||
    roles.every((role) => /^booth\s+[a-z]$/i.test(role));
}

// Extracts the natural sequence key embedded in an ordered role name
// (e.g. "Tank 3" -> 3, "Case B" -> charCode of "B"), so order clues compare
// the role's real identity rather than its (possibly shuffled) array position.
function roleOrderRank(role: string): number {
  const numMatch = role.match(/(\d+)/);
  if (numMatch) return Number(numMatch[1]);
  const letterMatch = role.match(/([A-Za-z])\s*$/);
  if (letterMatch) return letterMatch[1].toUpperCase().charCodeAt(0);
  return 0;
}

function roleHoldingValue(assignment: Assignment, categoryId: string, value: string): string | undefined {
  return Object.keys(assignment).find((role) => assignment[role]?.[categoryId] === value);
}

function categoryValueRank(categories: CategoryTemplate[], categoryId: string, value: string | undefined): number {
  if (value === undefined) return -1;
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return -1;
  return category.values.indexOf(value);
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

function constraintCategoryIds(constraint: Constraint): string[] {
  if (constraint.type === "link") return [constraint.categoryId, constraint.otherCategoryId];
  if (constraint.type === "categoryOrder") return [constraint.identifyCategoryId, constraint.orderCategoryId];
  return [constraint.categoryId];
}

function constraintReady(assignment: Assignment, constraint: Constraint): boolean {
  for (const categoryId of constraintCategoryIds(constraint)) {
    if (constraint.type === "order") {
      for (const value of constraint.values) {
        let found = false;
        for (const role of Object.keys(assignment)) {
          if (assignment[role]?.[categoryId] === value) found = true;
        }
        if (!found) return false;
      }
    } else if (constraint.type === "link") {
      const role = Object.keys(assignment).find((candidateRole) =>
        assignment[candidateRole]?.[constraint.categoryId] === constraint.value
      );
      if (!role) return false;
      if (assignment[role]?.[constraint.otherCategoryId] === undefined) return false;
    } else if (constraint.type === "categoryOrder") {
      for (const value of constraint.identifyValues) {
        const role = roleHoldingValue(assignment, constraint.identifyCategoryId, value);
        if (!role) return false;
        if (assignment[role]?.[constraint.orderCategoryId] === undefined) return false;
      }
    } else if (assignment[constraint.role]?.[categoryId] === undefined) {
      return false;
    }
  }
  return true;
}

function constraintPasses(
  roles: string[],
  categories: CategoryTemplate[],
  assignment: Assignment,
  constraint: Constraint
): boolean {
  if (!constraintReady(assignment, constraint)) return true;
  if (constraint.type === "is") {
    return assignment[constraint.role]?.[constraint.categoryId] === constraint.value;
  }
  if (constraint.type === "not") {
    return assignment[constraint.role]?.[constraint.categoryId] !== constraint.value;
  }
  if (constraint.type === "notAny") {
    const value = assignment[constraint.role]?.[constraint.categoryId];
    return !constraint.values.includes(value);
  }
  if (constraint.type === "initialNot") {
    const value = assignment[constraint.role]?.[constraint.categoryId] ?? "";
    return !constraint.letters.includes(firstLetter(value));
  }
  if (constraint.type === "link") {
    const role = Object.keys(assignment).find((candidateRole) =>
      assignment[candidateRole]?.[constraint.categoryId] === constraint.value
    );
    if (!role) return true;
    const actual = assignment[role]?.[constraint.otherCategoryId];
    return constraint.relation === "is"
      ? actual === constraint.otherValue
      : actual !== constraint.otherValue;
  }
  if (constraint.type === "categoryOrder") {
    const ranks = constraint.identifyValues.map((value) => {
      const role = roleHoldingValue(assignment, constraint.identifyCategoryId, value);
      return categoryValueRank(categories, constraint.orderCategoryId, role ? assignment[role]?.[constraint.orderCategoryId] : undefined);
    });
    if (ranks.some((rank) => rank < 0)) return true;
    for (let i = 1; i < ranks.length; i += 1) {
      if (constraint.direction === "ascending" && !(ranks[i - 1] < ranks[i])) return false;
      if (constraint.direction === "descending" && !(ranks[i - 1] > ranks[i])) return false;
    }
    return true;
  }

  const positions = constraint.values.map((value) => {
    const role = roleHoldingValue(assignment, constraint.categoryId, value);
    return role ? roleOrderRank(role) : -1;
  });
  if (positions.some((pos) => pos < 0)) return true;
  for (let i = 1; i < positions.length; i += 1) {
    if (constraint.direction === "ascending" && !(positions[i - 1] < positions[i])) return false;
    if (constraint.direction === "descending" && !(positions[i - 1] > positions[i])) return false;
  }
  return true;
}

function cluePasses(
  roles: string[],
  categories: CategoryTemplate[],
  assignment: Assignment,
  clue: LogicClue
): boolean {
  return clue.constraints.every((constraint) => constraintPasses(roles, categories, assignment, constraint));
}

function candidatePermutations(
  roles: string[],
  categories: CategoryTemplate[],
  category: CategoryTemplate,
  clues: LogicClue[]
): string[][] {
  const values = category.values.slice(0, roles.length);
  const simpleClues = clues.filter((clue) =>
    clue.constraints.every((constraint) => {
      const ids = constraintCategoryIds(constraint);
      return ids.length === 1 && ids[0] === category.id;
    })
  );
  return permutations(values).filter((perm) => {
    const partial: Assignment = {};
    for (let i = 0; i < roles.length; i += 1) {
      partial[roles[i]] = { [category.id]: perm[i] };
    }
    return simpleClues.every((clue) => cluePasses(roles, categories, partial, clue));
  });
}

function solveAssignments(
  roles: string[],
  categories: CategoryTemplate[],
  clues: LogicClue[],
  limit = 2
): Assignment[] {
  const options = categories
    .map((category) => ({ category, perms: candidatePermutations(roles, categories, category, clues) }))
    .sort((a, b) => a.perms.length - b.perms.length);
  const solutions: Assignment[] = [];

  function backtrack(index: number, assignment: Assignment): void {
    if (solutions.length >= limit) return;
    if (index === options.length) {
      if (clues.every((clue) => cluePasses(roles, categories, assignment, clue))) {
        solutions.push(JSON.parse(JSON.stringify(assignment)) as Assignment);
      }
      return;
    }

    const { category, perms } = options[index];
    for (const perm of perms) {
      const next: Assignment = JSON.parse(JSON.stringify(assignment)) as Assignment;
      for (let i = 0; i < roles.length; i += 1) {
        next[roles[i]] = { ...(next[roles[i]] ?? {}), [category.id]: perm[i] };
      }
      if (clues.every((clue) => cluePasses(roles, categories, next, clue))) {
        backtrack(index + 1, next);
      }
      if (solutions.length >= limit) return;
    }
  }

  const empty: Assignment = {};
  for (const role of roles) empty[role] = {};
  backtrack(0, empty);
  return solutions;
}

function clueKey(clue: LogicClue): string {
  return JSON.stringify(clue.constraints);
}

function directText(role: string, category: CategoryTemplate, value: string, rng: Rng): string {
  return rng.pick([
    `${role}'s ${category.label} is ${value}.`,
    `The ${category.label} for ${role} is ${value}.`
  ]);
}

function negativeText(role: string, category: CategoryTemplate, value: string, rng: Rng): string {
  return rng.pick([
    `${role}'s ${category.label} is not ${value}.`,
    `The ${category.label} for ${role} is not ${value}.`
  ]);
}

function buildCandidateClues(
  roles: string[],
  categories: CategoryTemplate[],
  solution: Assignment,
  rng: Rng,
  complexClues: boolean
): LogicClue[] {
  const out: LogicClue[] = [];
  const noun = roleNoun(roles);

  for (const category of categories) {
    const values = category.values.slice(0, roles.length);
    for (const role of roles) {
      const actual = solution[role][category.id];
      out.push({
        kind: "direct",
        text: directText(role, category, actual, rng),
        constraints: [{ type: "is", role, categoryId: category.id, value: actual }]
      });

      for (const value of values) {
        if (value === actual) continue;
        out.push({
          kind: "negative",
          text: negativeText(role, category, value, rng),
          constraints: [{ type: "not", role, categoryId: category.id, value }]
        });
      }
    }

    if (!complexClues) continue;

    if (hasOrderedRoles(roles)) {
      const roleOrderClues = values
        .map((value) => {
          const role = roles.find((r) => solution[r][category.id] === value);
          return role ? { value, rank: roleOrderRank(role) } : null;
        })
        .filter((entry): entry is { value: string; rank: number } => entry !== null)
        .sort((a, b) => b.rank - a.rank);
      for (let i = 0; i + 2 < roleOrderClues.length; i += 1) {
        const chain = roleOrderClues.slice(i, i + 3);
        out.push({
          kind: "order",
          text: `The ${valueLabel(category, chain[0].value)} is in a higher-numbered ${noun} than ${chain[1].value}, which is higher-numbered than ${chain[2].value}.`,
          constraints: [{
            type: "order",
            categoryId: category.id,
            values: chain.map((entry) => entry.value).reverse(),
            direction: "ascending"
          }]
        });
      }
    } else if (category.ordered) {
      // For templates whose roles are plain names (no embedded numbering), an
      // intrinsically-ordered category (day, score, platform, ...) still lets
      // us build an integrated order chain, naming the roles via a *different*
      // category's value so the clue actually conveys information.
      const orderRankOf = (role: string): number => category.values.indexOf(solution[role][category.id]);
      for (const identifyCategory of categories) {
        if (identifyCategory.id === category.id) continue;
        const identifyValues = identifyCategory.values.slice(0, roles.length);
        const chainEntries = identifyValues
          .map((value) => {
            const role = roles.find((r) => solution[r][identifyCategory.id] === value);
            return role ? { value, rank: orderRankOf(role) } : null;
          })
          .filter((entry): entry is { value: string; rank: number } => entry !== null)
          .sort((a, b) => a.rank - b.rank);
        for (let i = 0; i + 2 < chainEntries.length; i += 1) {
          const chain = chainEntries.slice(i, i + 3);
          out.push({
            kind: "order",
            text: `The ${noun} with ${valueLabel(identifyCategory, chain[0].value)} comes before the ${noun} with ${chain[1].value} in ${category.label}, which comes before the ${noun} with ${chain[2].value}.`,
            constraints: [{
              type: "categoryOrder",
              identifyCategoryId: identifyCategory.id,
              identifyValues: chain.map((entry) => entry.value),
              orderCategoryId: category.id,
              direction: "ascending"
            }]
          });
        }
      }
    }

    const groups = category.groups ?? [];
    for (const group of groups) {
      const eligible = roles.filter((role) => !group.values.includes(solution[role][category.id]));
      for (const selected of [eligible.slice(0, 2), eligible.slice(-2)].filter((x) => x.length >= 2)) {
        out.push({
          kind: "group",
          text: `The ${pluralLabel(category.label)} in ${joinList(selected)} are not ${group.label}.`,
          constraints: selected.map((role) => ({
            type: "notAny",
            role,
            categoryId: category.id,
            values: group.values
          }))
        });
      }
    }

    const alphabeticValues = isNameLikeCategory(category) ? values.filter(isAlphabeticValue) : [];
    const initialCounts = new Map<string, number>();
    for (const value of alphabeticValues) {
      const letter = firstLetter(value);
      initialCounts.set(letter, (initialCounts.get(letter) ?? 0) + 1);
    }
    const letters = [...initialCounts.keys()].filter((letter) => (initialCounts.get(letter) ?? 0) > 1);
    for (const role of roles) {
      const actualLetter = firstLetter(solution[role][category.id]);
      const excluded = shuffle(rng, letters.filter((letter) => letter !== actualLetter))
        .sort((a, b) => (initialCounts.get(b) ?? 0) - (initialCounts.get(a) ?? 0))
        .slice(0, 2);
      if (excluded.length > 0 && alphabeticValues.some((value) => excluded.includes(firstLetter(value)))) {
        out.push({
          kind: "initial",
          text: `The first letter of ${role}'s ${category.label} is not ${joinList(excluded, "or")}.`,
          constraints: [{ type: "initialNot", role, categoryId: category.id, letters: excluded }]
        });
      }
    }
  }

  if (complexClues) {
    for (const role of roles) {
      const pickedCategories = shuffle(rng, categories);
      const directCategories = pickedCategories.slice(0, Math.min(2, categories.length));
      const negativeCategory = pickedCategories.find((category) => !directCategories.includes(category));
      const parts = directCategories.map((category) =>
        `${category.label} is ${solution[role][category.id]}`
      );
      const constraints: Constraint[] = directCategories.map((category) => ({
        type: "is",
        role,
        categoryId: category.id,
        value: solution[role][category.id]
      }));
      if (negativeCategory) {
        const wrongValue = rng.pick(negativeCategory.values.filter((value) =>
          value !== solution[role][negativeCategory.id]
        ));
        parts.push(`${negativeCategory.label} is not ${wrongValue}`);
        constraints.push({
          type: "not",
          role,
          categoryId: negativeCategory.id,
          value: wrongValue
        });
      }
      out.push({
        kind: "bundle",
        text: `For ${role}, ${joinList(parts)}.`,
        constraints
      });
    }

    for (let i = 0; i < categories.length; i += 1) {
      for (let j = 0; j < categories.length; j += 1) {
        if (i === j) continue;
        const a = categories[i];
        const b = categories[j];
        for (const role of roles) {
          const aValue = solution[role][a.id];
          const bValue = solution[role][b.id];
          out.push({
            kind: "link",
            text: `The ${valueLabel(a, aValue)} goes with ${bValue} for ${b.label}.`,
            constraints: [{
              type: "link",
              categoryId: a.id,
              value: aValue,
              otherCategoryId: b.id,
              otherValue: bValue,
              relation: "is"
            }]
          });

          const wrongValues = shuffle(rng, b.values.filter((value) => value !== bValue)).slice(0, 2);
          for (const wrongValue of wrongValues) {
            out.push({
              kind: "link",
              text: `The ${valueLabel(a, aValue)} does not go with ${wrongValue} for ${b.label}.`,
              constraints: [{
                type: "link",
                categoryId: a.id,
                value: aValue,
                otherCategoryId: b.id,
                otherValue: wrongValue,
                relation: "not"
              }]
            });
          }
        }
      }
    }

    const facts = out.filter((clue) =>
      clue.kind === "direct" || clue.kind === "negative" || clue.kind === "link"
    );
    for (let i = 0; i < Math.min(roles.length * categories.length, facts.length - 1); i += 1) {
      const a = facts[i];
      const b = facts[facts.length - 1 - i];
      if (clueKey(a) === clueKey(b)) continue;
      const aText = a.text.replace(/\.$/, "");
      const bText = b.text.replace(/\.$/, "");
      out.push({
        kind: "compound",
        text: `${aText}, and ${bText}.`,
        constraints: [...a.constraints, ...b.constraints]
      });
    }
  }

  const unique = new Map<string, LogicClue>();
  for (const clue of shuffle(rng, out)) unique.set(clueKey(clue), clue);
  return [...unique.values()];
}

function cluePriority(clue: LogicClue): number {
  const base = clue.constraints.length * 2;
  if (clue.kind === "order") return base + 8;
  if (clue.kind === "initial") return base + 12;
  if (clue.kind === "group") return base + 8;
  if (clue.kind === "link") return base + 7;
  if (clue.kind === "bundle") return base + 6;
  if (clue.kind === "compound") return base + 6;
  if (clue.kind === "negative") return base - 1;
  return base;
}

function generateClues(
  roles: string[],
  categories: CategoryTemplate[],
  solution: Assignment,
  rng: Rng,
  targetClues: number,
  complexClues: boolean
): LogicClue[] {
  const allCandidates = buildCandidateClues(roles, categories, solution, rng, complexClues)
    .sort((a, b) => cluePriority(b) - cluePriority(a));
  const selected: LogicClue[] = [];
  const minCluesBeforeStop = complexClues
    ? Math.max(3, Math.floor(targetClues * 0.65))
    : targetClues;

  for (const candidate of allCandidates) {
    selected.push(candidate);
    if (
      selected.length >= minCluesBeforeStop &&
      solveAssignments(roles, categories, selected, 2).length === 1
    ) {
      break;
    }
  }

  const minimized = [...selected];
  for (let i = minimized.length - 1; i >= 0; i -= 1) {
    const test = minimized.filter((_, idx) => idx !== i);
    if (test.length > 0 && solveAssignments(roles, categories, test, 2).length === 1) {
      minimized.splice(i, 1);
    }
  }

  return shuffle(rng, minimized);
}

function buildPuzzle(seed: number, difficulty: number, gradeBand: GradeBand): PuzzleData {
  const rng = new Rng(seed + difficulty * 1009);
  const cfg = configFor(difficulty, gradeBand);
  const template = templates[Math.abs(seed) % templates.length];
  const roles = shuffle(rng, template.roles).slice(0, cfg.roleCount);
  const categories = shuffle(rng, template.categories).slice(0, cfg.categoryCount).map((category) => {
    const naturalIndex = new Map(category.values.map((value, index) => [value, index]));
    const picked = shuffle(rng, category.values).slice(0, cfg.roleCount);
    // Ordered categories (day, score, platform, ...) keep their true natural
    // sequence at runtime, even though a random subset of values is used, so
    // that order-chain clues can rely on relative position being meaningful.
    const values = category.ordered
      ? picked.sort((a, b) => (naturalIndex.get(a) ?? 0) - (naturalIndex.get(b) ?? 0))
      : picked;
    return {
      ...category,
      values,
      groups: (category.groups ?? []).map((group) => ({
        ...group,
        values: group.values.filter((value) => values.includes(value))
      }))
    };
  });

  const solution: Assignment = {};
  for (const role of roles) solution[role] = {};
  for (const category of categories) {
    const assigned = shuffle(rng, category.values);
    for (let i = 0; i < roles.length; i += 1) {
      solution[roles[i]][category.id] = assigned[i];
    }
  }

  const clues = generateClues(
    roles,
    categories,
    solution,
    rng,
    cfg.targetClues,
    cfg.complexClues
  );

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
    const normalized: Assignment = {};
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

function validateClueShape(clue: LogicClue): boolean {
  return Boolean(
    clue &&
    typeof clue.text === "string" &&
    clue.text.trim().length > 0 &&
    Array.isArray(clue.constraints) &&
    clue.constraints.length > 0
  );
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
    return solveAssignments(data.roles, data.categories, data.clues, 2).map(canonicalAnswer);
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
    if (!Array.isArray(data.clues) || data.clues.length < 1 || !data.clues.every(validateClueShape)) {
      issues.push({ code: "bad_clues", message: "clues with structured constraints are required." });
    }
    if (!normalizeAnswer(String(data.expectedAnswer || ""))) {
      issues.push({ code: "bad_expected_answer", message: "expectedAnswer must be canonical JSON." });
    }
    if (issues.length === 0) {
      const solutions = solveAssignments(data.roles, data.categories, data.clues, 2);
      if (solutions.length !== 1) {
        issues.push({ code: "not_unique", message: "Clues must force exactly one solution." });
      } else if (canonicalAnswer(solutions[0]) !== normalizeAnswer(String(data.expectedAnswer || ""))) {
        issues.push({ code: "solution_mismatch", message: "Structured clues solve to a different answer." });
      }
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
    const orderClue = data.clues?.find((c) => c.kind === "order")?.text;
    const firstCategory = data.categories?.[0];
    const firstRole = data.roles?.[0];
    const solvedValue = firstRole && firstCategory ? data.solution?.[firstRole]?.[firstCategory.id] : "";
    return [
      "Treat each sentence as one or more marks on the grid; a comma or 'and' often carries a second constraint.",
      orderClue || "Use each value exactly once in each category, then combine exclusions across rows.",
      firstRole && firstCategory && solvedValue
        ? `${firstRole}'s ${firstCategory.label} is ${solvedValue}.`
        : "Each row should have one choice from every category."
    ];
  }
};
