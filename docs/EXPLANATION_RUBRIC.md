# Explanation-Quality Rubric (v0.1)

This documents the deterministic, offline rubric scorer for the free-text
`explanation` (and, where relevant, `secondMethod`) captured on attempts. It is
implemented as a pure function in `src/core/explanation-rubric.ts`
(`scoreExplanation`) and wired into `POST /api/attempts` in `src/server.ts`.

This layer sits **on top of** the reasoning-capture layer documented in
`docs/FRAMEWORK.md`. Capture stores the text verbatim; this scores its *shape*.

## The non-punitive guarantee (READ THIS FIRST)

Explanation scoring is **purely additive encouragement**. It CANNOT and DOES NOT:

- change `isCorrect`,
- reduce `successScore`,
- block progress or gate rewards negatively,
- or make a kid feel punished for a weak — or absent — explanation.

Concretely:

- The correctness result (`isCorrect`) and `successScore` are computed in
  `src/server.ts` **before** and **completely independent of** any explanation
  scoring. `scoreExplanation` never reads or returns those values.
- A kid who writes nothing gets a neutral, empty result (`total: 0`, no badges,
  no feedback) and the attempt is byte-for-byte identical to the pre-existing
  behavior (the `explanationScore` field isn't even stored).
- Every dimension awards **non-negative** points only. There is no way to lose
  points. Leaving a field blank simply means that dimension doesn't apply — it
  never subtracts.
- The frontend surfaces the result as friendly "badges earned" plus a short
  encouraging note, never as a bare "N/10" grade.

This guarantee is also stated in the header comment of
`src/core/explanation-rubric.ts` and in the wiring comment in `src/server.ts`.

## What it can and cannot detect (honesty about the heuristic)

This is a **heuristic proxy for explanation effort and structure**, NOT a check
of semantic understanding. Because it must be deterministic and offline (no LLM),
it works from computable surface features of the text plus the puzzle context.

It **can** reward:

- writing a real, elaborated response instead of one word,
- using the domain vocabulary appropriate to the game,
- referencing the puzzle's actual numbers,
- signalling ordered, multi-step reasoning with sequence/causal words,
- offering a genuinely different second method.

It **cannot**:

- verify the reasoning is actually correct,
- catch a fluent, well-structured explanation that is wrong,
- understand meaning, paraphrase, or synonyms it wasn't given,
- tell a thoughtful short answer from a terse one (length is a coarse proxy),
- stop a determined kid from "keyword stuffing." (Stuffing raises only the
  vocabulary dimension, capped at 2 points; the structure and quantity
  dimensions still separate genuine step-by-step reasoning from a word salad.)

Treat every score as encouragement to keep explaining, never as an assessment of
whether the child understands.

## The dimensions

Each dimension is scored independently from computable features. Points are
always non-negative. A dimension that "doesn't apply" is simply omitted (it does
not contribute to `maxTotal` and cannot lower the total).

| Dimension | Points | How it is measured |
|-----------|:------:|--------------------|
| **Effort / elaboration** (`effort`) | 0–3 | Word count of the explanation. 0 words → 0; 1–2 → 1; 3–9 → 2; 10+ → 3. |
| **Domain vocabulary** (`vocabulary`) | 0–2 | Distinct expected terms present. The expected set = a curated per-game word list (see below) **plus** words split out of the puzzle's `metadata.skillTags`. Single words match on word boundaries; multi-word phrases (e.g. "both sides") match as substrings. Capped at 2. |
| **References real quantities** (`quantities`) | 0–2 | Distinct "salient" numbers from the puzzle that appear in the explanation (word-boundary matched). Salient numbers are sourced per-game so we don't reward trivially-present values: Balance Scale → the equation display + answer; KenKen → cage targets; Mismo → numbers in the card expressions; fallback → numbers in the prompt text. Capped at 2. |
| **Step / structure markers** (`structure`) | 0–2 | Distinct sequence/causal words present: first, then, next, after, because, since, so, therefore, finally, start, step. Capped at 2. |
| **Distinct second method** (`secondMethod`) | 0–2 | **Applies only** when the puzzle declared `data.reasoning.supportsTwoMethod` AND the kid actually wrote a `secondMethod`. Any genuine attempt → at least 1. A second method that is textually *distinct* from the primary explanation (token Jaccard similarity < 0.5, and at least 2 words) → 2. A near-restatement still keeps its 1 point — it is never punished. When there is no second method, the dimension is omitted entirely. |

`total` is the sum of earned points; `maxTotal` is the sum of `maxPoints` across
only the dimensions that applied. For a game without two-method support (Mismo,
KenKen) `maxTotal` is 9; for Balance Scale, `maxTotal` is 9 without a second
method and 11 with one.

### Per-game vocabulary sets

Sourced in `GAME_VOCAB` in `src/core/explanation-rubric.ts`, then augmented at
runtime with words from each puzzle's `metadata.skillTags`:

- **Balance Scale** (`balance-scale`): both sides, isolate, subtract, add,
  divide, multiply, opposite, inverse, undo, balance, equal, coefficient,
  distribute, combine, variable, solve. Skill tags add: algebra, equations,
  one/multi step equations.
- **Mismo** (`mismo`): equal, equals, equivalent, same, value, add, subtract,
  multiply, divide, times, sum, both, evaluate, expression. Skill tags add:
  equivalence, mental math, arithmetic, expressions.
- **KenKen** (`kenken`): row, column, cage, target, sum, add, subtract,
  multiply, divide, product, unique, only, must, because, constraint, digit,
  combination. Skill tags add: arithmetic, logic, latin square, multiplication,
  division.

New games get scored via the same dimensions; only vocabulary/salient-number
sources are game-specific, with a prompt-text fallback for games not enumerated.

## Output shape (`ExplanationScore`)

```ts
{
  total: number;         // sum of earned points (>= 0)
  maxTotal: number;      // sum of maxPoints for the applicable dimensions
  dimensions: Array<{
    id: "effort" | "vocabulary" | "quantities" | "structure" | "secondMethod";
    label: string;       // human-friendly, doubles as the badge label
    points: number;
    maxPoints: number;
    badge?: string;      // present only when points > 0
  }>;
  badges: string[];      // labels for every earned dimension
  feedback: string[];    // 1-2 short, always-positive lines
}
```

### Feedback rules

Feedback is always encouraging and at most two lines:

1. A **praise** line for the kid's strongest earned dimension (e.g. "Nice — you
   pointed to the actual numbers in the puzzle.").
2. An optional **growth** line — a friendly invitation to try one easy win they
   missed (e.g. 'Next time, try words like "first" and "then" to show the order
   of your steps.'). It is phrased as a suggestion, never a criticism.

## Storage & API

- Stored on the `Attempt` record as optional `explanationScore` (see
  `src/core/types.ts`). The field is written **only** when a score exists, so
  existing stored attempts and the Firestore write path are unaffected and never
  receive `undefined`.
- Returned in the `POST /api/attempts` response under `result.explanationScore`
  (present only when scored), alongside the unchanged `result.isCorrect` and
  reinforcement payload. The frontend renders it as badges + a note.
