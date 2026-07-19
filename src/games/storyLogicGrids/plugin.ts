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
  // consonant + y -> -ies (city -> cities), but vowel + y -> +s (display -> displays, day -> days)
  if (lower.endsWith("y") && !/[aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(lower)) return `${lower}es`;
  if (lower.endsWith("s")) return lower;
  return `${lower}s`;
}

function allNumericValues(values: string[]): boolean {
  return values.length > 0 && values.every((value) => /^\d+(\.\d+)?$/.test(value.trim()));
}

// Ascending-sense comparative for an intrinsically-ordered category: the first
// value is "less" than the second. Numeric categories (platform, number, score)
// read as "lower"; sequential ones (time, day, era, order) read as "earlier".
function orderComparative(category: CategoryTemplate): string {
  return allNumericValues(category.values) ? "lower" : "earlier";
}

// Comparatives for intrinsically-ordered ROLE names (Tank 1..5, Case A..E),
// so an order clue can name the direction the way the row labels actually read.
function orderedRoleWords(roles: string[]): { earlier: string; later: string } {
  const noun = roleNoun(roles);
  if (roles.every((role) => /\d/.test(role))) {
    return { earlier: `a lower-numbered ${noun}`, later: `a higher-numbered ${noun}` };
  }
  return { earlier: `an earlier ${noun}`, later: `a later ${noun}` };
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
  // Prune this column with EVERY single-category constraint touching it — even
  // ones embedded in a multi-category clue (a bundle's "is"/"not", a group's
  // "notAny", an ordered-role "order"). Each conjunct of a clue must hold in any
  // solution, so filtering the column by them independently is sound, and it
  // shrinks the per-column search from n! toward the handful that survive.
  const singleCategoryConstraints: Constraint[] = [];
  for (const clue of clues) {
    for (const constraint of clue.constraints) {
      const ids = constraintCategoryIds(constraint);
      if (ids.length === 1 && ids[0] === category.id) singleCategoryConstraints.push(constraint);
    }
  }
  return permutations(values).filter((perm) => {
    const partial: Assignment = {};
    for (let i = 0; i < roles.length; i += 1) {
      partial[roles[i]] = { [category.id]: perm[i] };
    }
    return singleCategoryConstraints.every((constraint) =>
      constraintPasses(roles, categories, partial, constraint)
    );
  });
}

function applyPerm(roles: string[], assignment: Assignment, categoryId: string, perm: string[]): Assignment {
  const next: Assignment = {};
  for (let i = 0; i < roles.length; i += 1) {
    next[roles[i]] = { ...assignment[roles[i]], [categoryId]: perm[i] };
  }
  return next;
}

function solveAssignments(
  roles: string[],
  categories: CategoryTemplate[],
  clues: LogicClue[],
  limit = 2
): Assignment[] {
  // Base per-column domains, already pruned by single-column constraints.
  const baseDomains = new Map<string, string[][]>();
  for (const category of categories) {
    baseDomains.set(category.id, candidatePermutations(roles, categories, category, clues));
  }
  const solutions: Assignment[] = [];
  const assigned = new Set<string>();

  // Perms of a still-unassigned column that stay consistent with everything
  // placed so far — this is where link/order clues across columns finally bite,
  // collapsing the domain instead of waiting until the whole grid is filled.
  const consistentPerms = (category: CategoryTemplate, assignment: Assignment): string[][] =>
    (baseDomains.get(category.id) ?? []).filter((perm) => {
      const next = applyPerm(roles, assignment, category.id, perm);
      return clues.every((clue) => cluePasses(roles, categories, next, clue));
    });

  function backtrack(assignment: Assignment): void {
    if (solutions.length >= limit) return;
    if (assigned.size === categories.length) {
      solutions.push(assignment);
      return;
    }
    // Most-constrained-column-first: pick the unassigned column with the fewest
    // surviving perms, which keeps the branching factor near its minimum.
    let bestCategory: CategoryTemplate | null = null;
    let bestPerms: string[][] | null = null;
    for (const category of categories) {
      if (assigned.has(category.id)) continue;
      const perms = consistentPerms(category, assignment);
      if (perms.length === 0) return; // dead end, backtrack
      if (bestPerms === null || perms.length < bestPerms.length) {
        bestCategory = category;
        bestPerms = perms;
      }
    }
    if (!bestCategory || !bestPerms) return;

    assigned.add(bestCategory.id);
    for (const perm of bestPerms) {
      backtrack(applyPerm(roles, assignment, bestCategory.id, perm));
      if (solutions.length >= limit) break;
    }
    assigned.delete(bestCategory.id);
  }

  const empty: Assignment = {};
  for (const role of roles) empty[role] = {};
  backtrack(empty);
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

// A cross-category "link" clue ties two attribute-values to the same row
// ("The cottage home goes with the 9 AM visit time."). Using valueLabel on both
// sides keeps the story flavor and — crucially — never leans on jargon like
// "for <Category>"; the sentence stands on its own.
function linkText(
  a: CategoryTemplate,
  aValue: string,
  b: CategoryTemplate,
  bValue: string,
  relation: "is" | "not"
): string {
  const connector = relation === "is" ? "goes with" : "does not go with";
  return `The ${valueLabel(a, aValue)} ${connector} the ${valueLabel(b, bValue)}.`;
}

function buildCandidateClues(
  roles: string[],
  categories: CategoryTemplate[],
  solution: Assignment,
  rng: Rng,
  complexClues: boolean
): LogicClue[] {
  const out: LogicClue[] = [];

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

    // Grouped exclusions. The group's members are enumerated in-line so the
    // solver never has to guess which values count as (e.g.) a "cold side".
    const groups = (category.groups ?? []).filter((group) => group.values.length > 0);
    for (const group of groups) {
      const eligible = roles.filter((role) => !group.values.includes(solution[role][category.id]));
      const inGroup = roles.length - eligible.length;
      if (inGroup === 0) continue; // no chosen value is in the group -> vacuous
      const pairs = [eligible.slice(0, 2), eligible.slice(-2)]
        .filter((pair) => pair.length >= 2)
        .filter((pair, idx, arr) => idx === 0 || pair.join("|") !== arr[0].join("|"));
      for (const selected of pairs) {
        const owners = joinList(selected.map((role) => `${role}'s`));
        const members = joinList(group.values, "or");
        out.push({
          kind: "group",
          text: `${owners} ${pluralLabel(category.label)} are not ${group.label} (not ${members}).`,
          constraints: selected.map((role) => ({
            type: "notAny",
            role,
            categoryId: category.id,
            values: group.values
          }))
        });
      }
    }

    if (!complexClues) continue;

    // Order chains. Two sources: roles that are intrinsically sequenced
    // (Tank 1..5, Case A..E) and categories flagged `ordered`. Either way the
    // clue names its ordered dimension and its direction in plain words.
    if (hasOrderedRoles(roles)) {
      const words = orderedRoleWords(roles);
      const ranked = values
        .map((value) => {
          const role = roles.find((r) => solution[r][category.id] === value);
          return role ? { value, rank: roleOrderRank(role) } : null;
        })
        .filter((entry): entry is { value: string; rank: number } => entry !== null)
        .sort((a, b) => a.rank - b.rank);
      for (let i = 0; i + 1 < ranked.length; i += 1) {
        const pair = ranked.slice(i, i + 2);
        out.push({
          kind: "order",
          text: `The ${valueLabel(category, pair[0].value)} is in ${words.earlier} than the ${valueLabel(category, pair[1].value)}.`,
          constraints: [{
            type: "order",
            categoryId: category.id,
            values: pair.map((entry) => entry.value),
            direction: "ascending"
          }]
        });
      }
      for (let i = 0; i + 2 < ranked.length; i += 1) {
        const chain = ranked.slice(i, i + 3);
        out.push({
          kind: "order",
          text: `The ${valueLabel(category, chain[0].value)} is in ${words.earlier} than the ${valueLabel(category, chain[1].value)}, which is in ${words.earlier} than the ${valueLabel(category, chain[2].value)}.`,
          constraints: [{
            type: "order",
            categoryId: category.id,
            values: chain.map((entry) => entry.value),
            direction: "ascending"
          }]
        });
      }
    } else if (category.ordered) {
      // Roles are plain names, so we rank them by an intrinsically-ordered
      // category and name each row by a *different* category's value. The clue
      // states the ordered dimension (this category's label) and the direction
      // ("earlier"/"lower"), so a child can act on it without any convention.
      const comparative = orderComparative(category);
      const orderRankOf = (role: string): number => category.values.indexOf(solution[role][category.id]);
      for (const identifyCategory of categories) {
        if (identifyCategory.id === category.id) continue;
        const identifyValues = identifyCategory.values.slice(0, roles.length);
        const ranked = identifyValues
          .map((value) => {
            const role = roles.find((r) => solution[r][identifyCategory.id] === value);
            return role ? { value, rank: orderRankOf(role) } : null;
          })
          .filter((entry): entry is { value: string; rank: number } => entry !== null)
          .sort((a, b) => a.rank - b.rank);
        for (let i = 0; i + 1 < ranked.length; i += 1) {
          const pair = ranked.slice(i, i + 2);
          out.push({
            kind: "order",
            text: `The ${valueLabel(identifyCategory, pair[0].value)}'s ${category.label} is ${comparative} than the ${valueLabel(identifyCategory, pair[1].value)}'s ${category.label}.`,
            constraints: [{
              type: "categoryOrder",
              identifyCategoryId: identifyCategory.id,
              identifyValues: pair.map((entry) => entry.value),
              orderCategoryId: category.id,
              direction: "ascending"
            }]
          });
        }
        for (let i = 0; i + 2 < ranked.length; i += 1) {
          const chain = ranked.slice(i, i + 3);
          out.push({
            kind: "order",
            text: `The ${valueLabel(identifyCategory, chain[0].value)}'s ${category.label} is ${comparative} than the ${valueLabel(identifyCategory, chain[1].value)}'s, which is ${comparative} than the ${valueLabel(identifyCategory, chain[2].value)}'s.`,
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

  // Cross-category link clues (one direction per pair to avoid near-duplicates).
  // Available at every difficulty: a link is the classic, self-contained logic
  // clue and keeps even easy puzzles from being a wall of "X is not Y".
  for (let i = 0; i < categories.length; i += 1) {
    for (let j = i + 1; j < categories.length; j += 1) {
      const a = categories[i];
      const b = categories[j];
      for (const role of roles) {
        const aValue = solution[role][a.id];
        const bValue = solution[role][b.id];
        out.push({
          kind: "link",
          text: linkText(a, aValue, b, bValue, "is"),
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
            text: linkText(a, aValue, b, wrongValue, "not"),
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

  if (complexClues) {
    // Same-row combo clues. Every part of a combo is about ONE row, so unrelated
    // facts never get glued together, and at most one part is a positive so the
    // clue can't hand over most of a row at once.
    for (const role of roles) {
      const picked = shuffle(rng, categories).slice(0, Math.min(3, Math.max(2, categories.length - 1)));
      // positiveIndex === picked.length means "no positive part": all negatives.
      const positiveIndex = rng.int(0, picked.length);
      const parts: string[] = [];
      const constraints: Constraint[] = [];
      picked.forEach((category, idx) => {
        if (idx === positiveIndex) {
          parts.push(`the ${category.label} is ${solution[role][category.id]}`);
          constraints.push({ type: "is", role, categoryId: category.id, value: solution[role][category.id] });
        } else {
          const wrong = rng.pick(category.values.filter((value) => value !== solution[role][category.id]));
          parts.push(`the ${category.label} is not ${wrong}`);
          constraints.push({ type: "not", role, categoryId: category.id, value: wrong });
        }
      });
      const usePossessive = rng.int(0, 1) === 0;
      const text = usePossessive
        ? `${role}'s row: ${joinList(parts)}.`
        : `For ${role}, ${joinList(parts)}.`;
      out.push({ kind: usePossessive ? "compound" : "bundle", text, constraints });
    }

    // Same-column combo clues. Every part is a fact about ONE category across a
    // few rows — just as related as a same-row combo — again with at most one
    // positive part so the column isn't handed over wholesale.
    for (const category of categories) {
      const chosenRoles = shuffle(rng, roles).slice(0, Math.min(3, Math.max(2, roles.length - 1)));
      const positiveIndex = rng.int(0, chosenRoles.length);
      const parts: string[] = [];
      const constraints: Constraint[] = [];
      chosenRoles.forEach((role, idx) => {
        if (idx === positiveIndex) {
          parts.push(`${role}'s is ${solution[role][category.id]}`);
          constraints.push({ type: "is", role, categoryId: category.id, value: solution[role][category.id] });
        } else {
          const wrong = rng.pick(category.values.filter((value) => value !== solution[role][category.id]));
          parts.push(`${role}'s is not ${wrong}`);
          constraints.push({ type: "not", role, categoryId: category.id, value: wrong });
        }
      });
      out.push({ kind: "compound", text: `For the ${category.label}, ${joinList(parts)}.`, constraints });
    }
  }

  const unique = new Map<string, LogicClue>();
  for (const clue of shuffle(rng, out)) unique.set(clueKey(clue), clue);
  return [...unique.values()];
}

// Ranks clue *kinds* for the round-robin that assembles the clue set. Strong,
// self-contained clues (links pin a pairing; combos/groups narrow things) come
// first. Direct "given" clues are handled separately (see generateClues) so
// their placement can depend on difficulty. This only sets ordering; the clue
// count is still driven by what it takes to force a unique solution.
function kindPriority(kind: LogicClue["kind"]): number {
  switch (kind) {
    case "link": return 95;
    case "bundle": return 88;
    case "compound": return 86;
    case "group": return 80;
    case "order": return 70;
    case "initial": return 62;
    case "negative": return 50;
    case "direct": return 10;
    default: return 40;
  }
}

function generateClues(
  roles: string[],
  categories: CategoryTemplate[],
  solution: Assignment,
  rng: Rng,
  targetClues: number,
  complexClues: boolean
): LogicClue[] {
  const candidates = buildCandidateClues(roles, categories, solution, rng, complexClues);
  const allDirects = shuffle(rng, candidates.filter((clue) => clue.kind === "direct"));

  // Direct "given" clues are welcome as anchors — a concrete starting fact is
  // genuinely helpful, especially on easy puzzles — but capped so they can
  // never hand over enough cells to remove the deduction. Any directs beyond
  // the cap are held in reserve to guarantee a unique solution is reachable.
  const directCap = complexClues ? 2 : Math.max(2, roles.length - 1);
  const directPool = allDirects.slice(0, directCap);
  const directReserve = allDirects.slice(directCap);

  // Interleave candidates by kind (round-robin), so the clue set pulls a variety
  // of clue types instead of, say, five order chains in a row.
  const buckets = new Map<string, LogicClue[]>();
  for (const clue of shuffle(rng, candidates)) {
    if (clue.kind === "direct") continue;
    (buckets.get(clue.kind) ?? buckets.set(clue.kind, []).get(clue.kind)!).push(clue);
  }
  if (directPool.length > 0) buckets.set("direct", directPool);

  // Easy puzzles surface a couple of givens early (helpful anchors); harder
  // puzzles keep them late so the deduction-rich clues drive the solve.
  const priorityOf = (kind: string): number =>
    kind === "direct" ? (complexClues ? 20 : 92) : kindPriority(kind as LogicClue["kind"]);
  const kindOrder = [...buckets.keys()].sort((a, b) => priorityOf(b) - priorityOf(a));

  const rich: LogicClue[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const kind of kindOrder) {
      const bucket = buckets.get(kind)!;
      if (bucket.length > 0) {
        rich.push(bucket.shift()!);
        progressed = true;
      }
    }
  }

  const minClues = complexClues ? Math.max(3, Math.floor(targetClues * 0.6)) : Math.max(3, targetClues - 1);

  const selected: LogicClue[] = [];
  const isUnique = (): boolean => solveAssignments(roles, categories, selected, 2).length === 1;

  // Phase 1: assemble from the interleaved pool (deduction-rich clues plus the
  // capped anchor givens).
  for (const candidate of rich) {
    if (selected.length >= minClues && isUnique()) break;
    selected.push(candidate);
  }
  // Phase 2: if the capped pool still can't pin the solution, add reserve givens
  // until it does. Guaranteed to terminate — the full direct set fixes every cell.
  if (!isUnique()) {
    for (const candidate of directReserve) {
      selected.push(candidate);
      if (isUnique()) break;
    }
  }

  // Minimize: drop any clue whose removal still leaves a unique solution. On
  // easy puzzles the anchor givens are kept even when technically removable, so
  // young solvers still get their concrete starting facts.
  const minimized = [...selected];
  for (let i = minimized.length - 1; i >= 0; i -= 1) {
    if (!complexClues && minimized[i].kind === "direct") continue;
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
    const clues = Array.isArray(data.clues) ? data.clues : [];
    const roles = Array.isArray(data.roles) ? data.roles : [];
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const solution = data.solution ?? {};

    // Cells that some clue states outright (a positive "is"): these are the
    // toeholds. Everything else has to be deduced.
    const given = new Set<string>();
    for (const clue of clues) {
      for (const constraint of clue.constraints) {
        if (constraint.type === "is") given.add(`${constraint.role}|${constraint.categoryId}`);
      }
    }

    // Hint 1: a concrete starting move for THIS puzzle. Prefer a clue that
    // pins a cell directly; fall back to the first clue.
    const anchor =
      clues.find((c) => c.kind === "direct") ||
      clues.find((c) => c.constraints.some((x) => x.type === "is")) ||
      clues[0];
    const anchorPins = Boolean(anchor && anchor.constraints.some((x) => x.type === "is"));
    const hint1 = anchor
      ? anchorPins
        ? `Start with "${anchor.text}" Fill that cell in first, then cross the same value out of the other rows.`
        : `Start with "${anchor.text}" Cross that option off, which narrows what the other rows can be.`
      : "Give each row exactly one value from every column, and use each value once.";

    // Hint 2: a second, different clue that narrows things by elimination.
    const relational = clues.find(
      (c) => c !== anchor && ["link", "order", "group", "negative", "initial"].includes(c.kind)
    ) || clues.find((c) => c !== anchor);
    const hint2 = relational
      ? `Now use "${relational.text}" Cross out every cell it rules out, then see what is forced.`
      : "Cross out the cells your clues forbid; when a row has one choice left, it must be the answer.";

    // Hint 3: reveal one DERIVED cell (solved but never stated by a clue).
    let derived = "";
    for (const role of roles) {
      for (const category of categories) {
        if (!given.has(`${role}|${category.id}`) && solution[role]?.[category.id]) {
          derived = `Working it through, ${role}'s ${category.label} must be ${solution[role][category.id]}.`;
          break;
        }
      }
      if (derived) break;
    }
    return [
      hint1,
      hint2,
      derived || "Each row ends with exactly one value from every column — fill the last cells by elimination."
    ];
  }
};
