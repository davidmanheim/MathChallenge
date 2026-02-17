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
