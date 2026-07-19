# Framework Overview (v0.2)

## Goals
- Make adding new math puzzle types low-friction.
- Keep core APIs stable while game content expands.
- Guarantee no unchecked puzzle is served.

## Core Structure
- `src/core/game-plugin.ts`: shared `GameTypePlugin` interface.
- `src/core/registry.ts`: plugin registration and lookup.
- `src/core/validation-gate.ts`: generation-time validation gate.
- `src/core/types.ts`: shared types (`GradeBand`, `PuzzleCandidate`, etc.).
- `src/games/*/plugin.ts`: one plugin per game type.
- `src/server.ts`: HTTP API and static file serving.
- `src/services/profile-store.ts`: JSON-backed profile persistence.
- `src/services/progress-store.ts`: JSON-backed attempt/progress persistence.

## Plugin Contract
Every game must implement:
- `generate(input)`: create candidate puzzle from `(gradeBand, difficulty, seed)`.
- `solve(candidate)`: return canonical solution(s).
- `validatePuzzle(candidate)`: game-specific shape/invariant checks.
- `gradeAnswer(candidate, answer)`: deterministic grader.
- `buildHints(candidate)`: three-level hint ladder (nudge -> strategy -> near-solution).

Metadata fields:
- `id`, `name`, `minGrade`, `maxGrade`, `description`

### Optional: reasoning prompts (`data.reasoning`)
A plugin MAY attach a `reasoning` object to the `data` field of the candidate it
returns from `generate()`. This declares that the puzzle invites the student to
explain their thinking and/or show a second solving method, and supplies the
prompt text the frontend shows. It is **advisory only** — the base answer and
grading flow is completely unaffected, and correctness NEVER depends on it.

Shape (`ReasoningSupport` in `src/core/types.ts`):
```ts
data: {
  // ...game-specific fields...
  reasoning?: {
    supportsExplanation: boolean;    // show a free-text "explain your reasoning" prompt
    supportsTwoMethod: boolean;      // show a free-text "show a second method" prompt
    explanationPrompt?: string;      // label shown above the explanation textarea
    secondMethodPrompt?: string;     // label shown above the second-method textarea
  }
}
```
Plugins that omit `reasoning` get no reasoning prompt (the default). Adding this
field does NOT affect `validatePuzzle()` — the gate only inspects game-specific
fields. Currently declared by: `balance-scale` (explanation + two-method),
`mismo` (explanation), `kenken` (explanation).

## Generation-Time Safety Gate
`generateCheckedPuzzle()` enforces:
- Base schema checks (non-empty prompt, integer seed, difficulty >= 1).
- Game-specific validation checks via `validatePuzzle()`.
- Solvability (`solve()` must return at least one solution).
- Uniqueness when `expectUniqueSolution === true`.
- Grader consistency (canonical solutions must pass `gradeAnswer()`).

If any check fails, generation retries with a new seed (up to 25 attempts).
No unvalidated puzzle is ever served.

Set-level dedup: `/api/puzzles/next` tracks `JSON.stringify(candidate.data)`
across all puzzles in a set and re-rolls duplicates (up to 50 attempts per slot).

## API (Alpha)
- `POST /api/profiles/login` — create/retrieve profile
- `GET  /api/profiles` — list profiles
- `GET  /api/games` — list registered game types
- `POST /api/puzzles/next` — generate puzzle set (`gameTypeId`, `difficulty`, `setSize`)
- `POST /api/puzzles/hints` — get hints for a puzzle
- `POST /api/attempts` — submit answer, get grading result
- `GET  /api/progress?profileId=...` — progress summary

### `POST /api/attempts` — reasoning capture contract
Request body (existing fields unchanged, two new **optional** fields):
```
{
  profileId: string,
  puzzle: PuzzleCandidate,
  answer: string,
  hintsUsed?: number,
  timeMs?: number,
  explanation?: string,   // OPTIONAL free-text "explain your reasoning" response
  secondMethod?: string   // OPTIONAL free-text "show a second method" response
}
```
Rules:
- Both `explanation` and `secondMethod` are optional. Omitting them makes the
  request byte-for-byte identical to the pre-existing contract (backward compatible).
- The server trims each and caps length at 2000 chars. Non-string values are
  treated as absent (stored as `""`).
- **Captured, never used to grade correctness.** The presence, absence, or
  content of these fields has zero effect on `isCorrect`, `successScore`, hints,
  or any grading. Rubric-based scoring of explanation *quality* is layered on top
  (see `docs/EXPLANATION_RUBRIC.md`): when a non-empty explanation is submitted
  for a reasoning-supporting game, the server computes an additive
  `explanationScore` and returns it under `result.explanationScore`. That score
  is **purely additive encouragement** — it never lowers the correctness result
  or `successScore`, and a blank explanation is always fine.

### Stored attempt record (`Attempt` in `src/core/types.ts`)
Every persisted attempt (in the `attempts` Firestore collection via
`ProgressStore.recordAttempt`) now always includes:
```
explanation: string      // verbatim response, "" when not provided
secondMethod: string     // verbatim response, "" when not provided
hasExplanation: boolean   // trivial presence check: explanation or secondMethod non-empty
```
These are always present (defaulted to `""` / `false`) so downstream consumers
never see `undefined`. `hasExplanation` is a convenience flag only — it is a
non-empty check, NOT any judgement of quality.

## Current Game Coverage
8 registered plugins (see `GAME_TYPES.md` for details):
- `pattern-train`
- `mismo`
- `x-outs`
- `shikaku`
- `kenken`
- `factor-ninja`
- `balance-scale`
- `number-bonds-sprint` (pending removal)

5 additional games designed: Sum Blobs, Honeycomb Paths, Subtractiles,
Measure Mazes, Equation Paths (see `NEW_GAMES_DESIGN.md`).

## Server
- Fixed port: `http://localhost:5678`
- Run: `npm run dev` (uses `node --experimental-strip-types src/server.ts`)
- Static files served from `public/` with MIME types for `.html`, `.css`, `.js`, `.svg`
