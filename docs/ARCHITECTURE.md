# Architecture Design (v0.2)

Current alpha runtime endpoint: `http://localhost:5678` (fixed port).

## Stack
- Runtime: Node.js with `--experimental-strip-types` (no build step)
- Language: TypeScript (type-stripped at runtime, no separate compilation)
- Frontend: Vanilla HTML + CSS + JS (`public/` directory, served statically)
- Backend: Single-file HTTP server (`src/server.ts`) using `node:http`
- Data: JSON files on disk (`data/profiles.json`, `data/progress.json`)
- Styling: Hand-written CSS with per-game themed sections

## Project Structure
```
public/
  index.html         Single-page app shell
  app.js             All client-side logic (game renderers, API calls, state)
  styles.css         All styles including per-game themes
src/
  server.ts          HTTP server, API routes, static file serving
  core/
    game-plugin.ts   GameTypePlugin interface
    registry.ts      Plugin registration and lookup
    types.ts         Shared types (GradeBand, PuzzleCandidate, etc.)
    validation-gate.ts  Generation-time validation pipeline
  games/
    <gameId>/plugin.ts  One plugin per game type
  services/
    profile-store.ts    JSON-backed profile persistence
    progress-store.ts   JSON-backed attempt and progress persistence
data/
  profiles.json      Player profiles
  progress.json      Attempt history and mastery data
docs/
  *.md               Design documents
```

## Modules
- **Profile Service** (`ProfileStore`)
  - Create/select profile by name + grade band
  - JSON file persistence
- **Puzzle Engine**
  - Plugin-based registry of game types (`GameTypePlugin`)
  - Deterministic puzzle generation by `(gameType, difficulty, seed)`
  - Generation-time validation gate ensures puzzles are solvable and well-formed
  - Answer grading and solution generation
- **Progress Service** (`ProgressStore`)
  - Persist attempts and compute per-game, per-skill mastery metrics
- **Static File Server**
  - Serves `public/` with correct MIME types (HTML, CSS, JS, SVG)

## Plugin Contract
Every game must implement:
- `generate(input)`: create candidate puzzle from `(gradeBand, difficulty, seed)`
- `solve(candidate)`: produce canonical solution(s)
- `validatePuzzle(candidate)`: game-specific shape/invariant checks
- `gradeAnswer(candidate, answer)`: deterministic grader
- `buildHints(candidate)`: three-level hint ladder

See `ADDING_GAME_TYPES.md` for the full guide.

## Generation-Time Validation Gate
`generateCheckedPuzzle()` enforces:
- Base schema checks (non-empty prompt, valid seed, difficulty >= 1)
- Game-specific validation via `validatePuzzle()`
- Solvability (`solve()` must return at least one solution)
- Uniqueness when `expectUniqueSolution === true`
- Grader consistency (canonical solutions must pass `gradeAnswer()`)

Failure policy: retry with incremented seed up to 25 attempts. Never serve
unvalidated puzzles.

Set-level deduplication: the `/api/puzzles/next` endpoint tracks seen puzzle
data within a set and re-rolls duplicates.

## API Surface
- `POST /api/profiles/login` — create or retrieve profile by name + grade band
- `GET  /api/profiles` — list all profiles
- `GET  /api/games` — list registered game types
- `POST /api/puzzles/next` — generate a puzzle set (accepts `gameTypeId`, `difficulty`, `setSize`)
- `POST /api/puzzles/hints` — get hint ladder for a puzzle
- `POST /api/attempts` — submit an answer, returns grading result
- `GET  /api/progress?profileId=...` — progress summary for a profile

## Current Game Coverage
8 registered plugins:
- `number-bonds-sprint` (pending removal)
- `pattern-train`
- `factor-ninja`
- `mismo`
- `x-outs`
- `kenken`
- `balance-scale`
- `shikaku`

5 additional games designed but not yet implemented (see `NEW_GAMES_DESIGN.md`).

## Difficulty Model
Inputs:
- Profile grade band
- Recent correctness
- Hint usage
- Solve time percentile

Policy:
- Promote after sustained strong performance
- Temporary downshift after repeated misses
- Mix in spaced review puzzles
