import type { PuzzleCandidate } from "./types.ts";

/**
 * Deterministic, offline rubric scorer for free-text explanations.
 *
 * ============================ NON-PUNITIVE GUARANTEE ============================
 * This module NEVER touches correctness. It is a pure function of its inputs and
 * returns ONLY non-negative points and encouraging feedback. Nothing here can:
 *   - change `isCorrect`,
 *   - reduce `successScore`,
 *   - gate progress, hints, or rewards negatively,
 *   - or make a kid "lose" anything for a weak (or absent) explanation.
 * A kid who writes nothing gets an empty, neutral result (total 0, no feedback).
 * A kid who writes something can only EARN recognition — the score is purely
 * additive. See `docs/EXPLANATION_RUBRIC.md` for the full contract and caveats.
 *
 * ============================ WHAT THIS CAN / CANNOT DO =========================
 * This is a HEURISTIC PROXY for explanation *effort and shape*, NOT a semantic
 * understanding check. It rewards length, domain vocabulary, references to the
 * puzzle's real numbers, and step/structure markers. It CANNOT verify that the
 * reasoning is actually correct, nor detect a fluent-but-wrong explanation.
 * Treat every score as encouragement, never as a grade of understanding.
 * ==============================================================================
 */

export type RubricDimensionId =
  | "effort"
  | "vocabulary"
  | "quantities"
  | "structure"
  | "secondMethod";

export type DimensionScore = {
  id: RubricDimensionId;
  label: string;
  points: number;
  maxPoints: number;
  /** Short positive badge label, present only when points > 0. */
  badge?: string;
};

export type ExplanationScore = {
  /** Sum of earned points across applicable dimensions (always >= 0). */
  total: number;
  /** Sum of maxPoints across the dimensions that applied to this attempt. */
  maxTotal: number;
  dimensions: DimensionScore[];
  /** Badge labels for every dimension the kid earned (points > 0). */
  badges: string[];
  /** 1-2 short, always-encouraging feedback lines. Empty when nothing was written. */
  feedback: string[];
};

export type ScoreExplanationInput = {
  explanation: string;
  secondMethod: string;
  puzzle: PuzzleCandidate;
  gameTypeId: string;
};

// ---------------------------------------------------------------------------
// Per-game domain vocabulary. These are the words/phrases a good explanation
// for each game tends to use. Skill tags from the puzzle are folded in on top
// of these (see expectedVocab). Multi-word entries are matched as substrings;
// single words are matched on word boundaries so "so" won't fire inside "also".
// ---------------------------------------------------------------------------
const GAME_VOCAB: Record<string, string[]> = {
  "balance-scale": [
    "both sides",
    "isolate",
    "subtract",
    "add",
    "divide",
    "multiply",
    "opposite",
    "inverse",
    "undo",
    "balance",
    "equal",
    "coefficient",
    "distribute",
    "combine",
    "variable",
    "solve"
  ],
  mismo: [
    "equal",
    "equals",
    "equivalent",
    "same",
    "value",
    "add",
    "subtract",
    "multiply",
    "divide",
    "times",
    "sum",
    "both",
    "evaluate",
    "expression"
  ],
  kenken: [
    "row",
    "column",
    "cage",
    "target",
    "sum",
    "add",
    "subtract",
    "multiply",
    "divide",
    "product",
    "unique",
    "only",
    "must",
    "because",
    "constraint",
    "digit",
    "combination"
  ]
};

// Sequence / causal markers that signal multi-step, structured reasoning.
const STRUCTURE_MARKERS: string[] = [
  "first",
  "then",
  "next",
  "after",
  "because",
  "since",
  "so",
  "therefore",
  "finally",
  "start",
  "step"
];

const DIMENSION_LABELS: Record<RubricDimensionId, string> = {
  effort: "Explained your thinking",
  vocabulary: "Used math words",
  quantities: "Used the real numbers",
  structure: "Showed your steps",
  secondMethod: "Found a second way"
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary, case-insensitive test for a single word. */
function containsWord(haystackLower: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word.toLowerCase())}\\b`).test(haystackLower);
}

/** Distinct lowercase tokens (>= 3 chars) — used for second-method distinctness. */
function tokenSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3) out.add(raw);
  }
  return out;
}

/**
 * The "salient" numbers a good explanation might cite — sourced from the puzzle
 * so we reward referencing the ACTUAL quantities, not arbitrary digits. Per-game
 * so we avoid trivially-present values (e.g. every KenKen cell is 1..size); a
 * generic fallback reads the prompt text for any game without a specific rule.
 */
function salientNumbers(puzzle: PuzzleCandidate, gameTypeId: string): Set<string> {
  const texts: string[] = [];
  const data = (puzzle?.data ?? {}) as Record<string, unknown>;
  if (puzzle?.prompt?.text) texts.push(String(puzzle.prompt.text));

  if (gameTypeId === "balance-scale") {
    if (data.display != null) texts.push(String(data.display));
    if (data.answer != null) texts.push(String(data.answer));
  } else if (gameTypeId === "kenken") {
    const cages = Array.isArray(data.cages) ? (data.cages as any[]) : [];
    for (const c of cages) if (c && c.target != null) texts.push(String(c.target));
  } else if (gameTypeId === "mismo") {
    const cards = Array.isArray(data.cards) ? (data.cards as any[]) : [];
    for (const c of cards) if (c && c.expr != null) texts.push(String(c.expr));
  }

  const nums = new Set<string>();
  for (const t of texts) {
    const matches = t.match(/\d+/g);
    if (matches) for (const n of matches) nums.add(n);
  }
  return nums;
}

/** Expected vocabulary = curated per-game list + words split from skill tags. */
function expectedVocab(puzzle: PuzzleCandidate, gameTypeId: string): string[] {
  const base = GAME_VOCAB[gameTypeId] ?? [];
  const tags = Array.isArray(puzzle?.metadata?.skillTags)
    ? puzzle.metadata.skillTags
    : [];
  const tagWords = tags
    .flatMap((t) => String(t).split(/[_\s]+/))
    .filter((w) => w.length >= 3);
  return Array.from(new Set([...base, ...tagWords].map((w) => w.toLowerCase())));
}

/** Whether this puzzle invited a second solving method. */
function supportsTwoMethod(puzzle: PuzzleCandidate): boolean {
  const reasoning = (puzzle?.data as Record<string, unknown> | undefined)?.reasoning as
    | { supportsTwoMethod?: unknown }
    | undefined;
  return Boolean(reasoning?.supportsTwoMethod);
}

// ---------------------------------------------------------------------------
// The scorer. Pure function of its inputs (no I/O), so it is trivially testable.
// ---------------------------------------------------------------------------
export function scoreExplanation(input: ScoreExplanationInput): ExplanationScore {
  const explanation = (input.explanation ?? "").trim();
  const secondMethod = (input.secondMethod ?? "").trim();
  const puzzle = input.puzzle;
  const gameTypeId = input.gameTypeId ?? puzzle?.gameTypeId ?? "";

  const dimensions: DimensionScore[] = [];

  // Nothing written at all -> neutral, empty result. Never punitive.
  if (explanation.length === 0 && secondMethod.length === 0) {
    return { total: 0, maxTotal: 0, dimensions: [], badges: [], feedback: [] };
  }

  const lower = explanation.toLowerCase();
  const words = explanation.length ? explanation.split(/\s+/).filter(Boolean) : [];

  // --- Dimension 1: Effort / elaboration (0-3), by word count. ---
  let effort = 0;
  if (words.length >= 10) effort = 3;
  else if (words.length >= 3) effort = 2;
  else if (words.length >= 1) effort = 1;
  dimensions.push(mkDim("effort", effort, 3));

  // --- Dimension 2: Domain vocabulary (0-2), distinct expected terms used. ---
  const vocab = expectedVocab(puzzle, gameTypeId);
  let vocabHits = 0;
  for (const term of vocab) {
    const hit = term.includes(" ") ? lower.includes(term) : containsWord(lower, term);
    if (hit) vocabHits += 1;
    if (vocabHits >= 2) break;
  }
  dimensions.push(mkDim("vocabulary", Math.min(2, vocabHits), 2));

  // --- Dimension 3: References the puzzle's actual numbers (0-2). ---
  const nums = salientNumbers(puzzle, gameTypeId);
  let numHits = 0;
  for (const n of nums) {
    if (containsWord(lower, n)) numHits += 1;
    if (numHits >= 2) break;
  }
  dimensions.push(mkDim("quantities", Math.min(2, numHits), 2));

  // --- Dimension 4: Step / structure markers (0-2). ---
  let structureHits = 0;
  for (const m of STRUCTURE_MARKERS) {
    if (containsWord(lower, m)) structureHits += 1;
    if (structureHits >= 2) break;
  }
  dimensions.push(mkDim("structure", Math.min(2, structureHits), 2));

  // --- Dimension 5: Distinct second method (0-2). Only when the puzzle invited
  // one AND the kid actually wrote one. Absent second method never subtracts:
  // the dimension simply doesn't apply (excluded from maxTotal). ---
  if (supportsTwoMethod(puzzle) && secondMethod.length > 0) {
    const secondWords = secondMethod.split(/\s+/).filter(Boolean);
    let secondPts = 1; // any genuine attempt earns at least 1
    if (secondWords.length >= 2) {
      const a = tokenSet(explanation);
      const b = tokenSet(secondMethod);
      const union = new Set([...a, ...b]);
      let inter = 0;
      for (const t of b) if (a.has(t)) inter += 1;
      const jaccard = union.size === 0 ? 0 : inter / union.size;
      // Distinct from the primary explanation (not just a restatement) -> full credit.
      if (jaccard < 0.5) secondPts = 2;
    }
    dimensions.push(mkDim("secondMethod", secondPts, 2));
  }

  const total = dimensions.reduce((s, d) => s + d.points, 0);
  const maxTotal = dimensions.reduce((s, d) => s + d.maxPoints, 0);
  const badges = dimensions.filter((d) => d.points > 0).map((d) => d.label);
  const feedback = buildFeedback(dimensions);

  return { total, maxTotal, dimensions, badges, feedback };
}

function mkDim(id: RubricDimensionId, points: number, maxPoints: number): DimensionScore {
  const dim: DimensionScore = { id, label: DIMENSION_LABELS[id], points, maxPoints };
  if (points > 0) dim.badge = DIMENSION_LABELS[id];
  return dim;
}

/**
 * Build 1-2 short, ALWAYS-positive feedback lines: one praising the kid's
 * strongest earned dimension, and (optionally) one gentle, growth-oriented
 * suggestion phrased as an invitation — never a criticism.
 */
function buildFeedback(dimensions: DimensionScore[]): string[] {
  const pts = (id: RubricDimensionId) =>
    dimensions.find((d) => d.id === id)?.points ?? 0;
  const applies = (id: RubricDimensionId) => dimensions.some((d) => d.id === id);

  const out: string[] = [];

  // Praise line — pick the most impressive thing they did.
  if (pts("secondMethod") >= 2) {
    out.push("Awesome — you showed a whole second way to solve it!");
  } else if (pts("structure") > 0 && pts("quantities") > 0) {
    out.push("Nice work — you walked through your steps and used the real numbers.");
  } else if (pts("quantities") > 0) {
    out.push("Nice — you pointed to the actual numbers in the puzzle.");
  } else if (pts("structure") > 0) {
    out.push("Great — you walked through your steps in order.");
  } else if (pts("vocabulary") > 0) {
    out.push("You used real math words to explain it — nice.");
  } else {
    out.push("Thanks for explaining your thinking!");
  }

  // Growth line — one friendly "try next" for an easy win they missed.
  // Ordered by highest learning value. Always optional and encouraging.
  if (pts("structure") === 0) {
    out.push('Next time, try words like "first" and "then" to show the order of your steps.');
  } else if (pts("quantities") === 0) {
    out.push("You could name the actual numbers you worked with to make it even clearer.");
  } else if (pts("vocabulary") === 0) {
    out.push("Try naming the math idea you used, too.");
  } else if (applies("secondMethod") && pts("secondMethod") < 2) {
    out.push("Could you find a totally different way to get the same answer?");
  }

  return out.slice(0, 2);
}
