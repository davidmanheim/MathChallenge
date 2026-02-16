# Framework Overview (Alpha)

## Goals
- Make adding new math puzzle types low-friction.
- Keep core APIs stable while game content expands.
- Guarantee no unchecked puzzle is served.

## Core Structure
- `src/core/game-plugin.ts`: shared `GameTypePlugin` interface.
- `src/core/registry.ts`: plugin registration and lookup.
- `src/core/validation-gate.ts`: generation-time validation gate.
- `src/games/*`: one folder per game type plugin.
- `src/server.ts`: HTTP API and static app hosting.

## Plugin Contract
Every game must implement:
- `generate(input)`: create candidate puzzle from `(gradeBand, difficulty, seed)`.
- `solve(candidate)`: produce canonical solution(s).
- `validatePuzzle(candidate)`: game-specific shape/invariant checks.
- `gradeAnswer(candidate, answer)`: deterministic grader.
- `buildHints(candidate)`: three-level hint ladder.

## Generation-Time Safety Gate
`generateCheckedPuzzle()` enforces:
- Base schema checks.
- Game-specific validation checks.
- Solvability (`solve()` must return at least one solution).
- Uniqueness when `expectUniqueSolution === true`.
- Grader consistency (canonical solutions must pass `gradeAnswer()`).

If any check fails, generation retries with a new seed. If retries exceed cap, puzzle generation fails and no unvalidated puzzle is returned.

## API (Alpha)
- `POST /api/profiles/login`
- `GET /api/profiles`
- `GET /api/games`
- `POST /api/puzzles/next`
- `POST /api/puzzles/hints`
- `POST /api/attempts`
- `GET /api/progress?profileId=...`

## Current Game Coverage
- `number-bonds-sprint` implemented as reference plugin.
