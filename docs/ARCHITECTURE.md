# Architecture Design (v0.2)

Current alpha runtime endpoint: `http://localhost:5678` (fixed port).

## Stack
- Runtime: Node.js with `--experimental-strip-types` (no build step)
- Language: TypeScript (type-stripped at runtime, no separate compilation)
- Frontend: Vanilla HTML + CSS + JS (`public/` directory, served statically)
- Backend: Single-file HTTP server (`src/server.ts`) using `node:http`
- Data: Google Cloud Firestore (`@google-cloud/firestore`) — `profiles` and `attempts` collections
- Styling: Hand-written CSS with per-game themed sections

## Project Structure
```
public/
  index.html         Single-page app shell: login screen (profile tiles) ->
                     hub screen (grade-filtered, strand-grouped game shelves)
                     -> player screen (existing per-game puzzle engine,
                     reused unmodified). All per-game zone markup lives
                     inside the player screen.
  app.js             All client-side logic: the puzzle engine (state,
                     renderPuzzle(), per-game renderers, API calls) plus a
                     shell layer appended at the end of the file (profile
                     tiles, grade-band picker, shelves/strand filtering,
                     difficulty presets, Today's Pick, plain-language
                     progress views). The shell only *drives* the engine —
                     it sets #gameType/#difficulty and calls
                     #newPuzzleBtn.click()/#loginBtn.click() rather than
                     duplicating that logic. A static `gameId -> strand`
                     map (`GAME_META`) groups the 16 games into six themed
                     shelves; there is no server-side category field.
  styles.css         All styles including per-game themes and the shell
                     (login/hub/player/parent-door). Supports light + dark
                     via `prefers-color-scheme`.
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
    profile-store.ts    Firestore-backed profile persistence (`profiles` collection)
    progress-store.ts   Firestore-backed attempt/progress persistence (`attempts` collection)
    json-store.ts       Stale/unused artifact from an earlier local-JSON prototype (not imported anywhere)
docs/
  *.md               Design documents
```

> Persistence is Firestore-only. The `data/` directory and any `data/*.json`
> files are stale leftovers from an earlier local-JSON prototype; they are not
> read or written at runtime.

## Modules
- **Profile Service** (`ProfileStore`)
  - Create/select profile by name + grade band
  - Firestore persistence (`profiles` collection)
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
- `GET  /api/games` — list registered game types
- `POST /api/puzzles/next` — generate a puzzle set (accepts `gameTypeId`, `difficulty`, `setSize`)
- `POST /api/puzzles/hints` — get hint ladder for a puzzle
- `POST /api/attempts` — submit an answer, returns grading result
- `GET  /api/progress?profileId=...` — progress summary for a profile

## Current Game Coverage
13 registered plugins (order matches `registry.register(...)` in `src/server.ts`):
- `number-bonds-sprint` (removal outstanding — the catalog has reached 13, so the
  stated removal condition is met, but the plugin is still registered)
- `pattern-train`
- `factor-ninja`
- `mismo`
- `x-outs`
- `kenken`
- `balance-scale`
- `shikaku`
- `number-paths`
- `story-logic-grids`
- `angle-chase-studio`
- `counting-lab`
- `proof-blocks`

Designed but not yet implemented: 3 newly-spec'd (Chance Builder, Coordinate
Quest 2D, Graph Trails) plus 5 older designs (Sum Blobs, Honeycomb Paths,
Subtractiles, Measure Mazes, Equation Paths). See `NEW_GAMES_DESIGN.md`.

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
