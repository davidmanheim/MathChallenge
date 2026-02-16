# Architecture Design (v0.1)

## Stack
- Frontend: Next.js + React + TypeScript
- Backend API: Next.js Route Handlers (`/api/*`)
- ORM: Prisma
- Data: SQLite initially, PostgreSQL-ready schema
- Styling: Tailwind CSS

## Modules
- Profile Service
  - Create/select profile by name
  - Set active profile in lightweight session cookie
- Puzzle Engine
  - Plugin-based registry of game types (`GameTypePlugin`) for extensibility
  - Deterministic puzzle generation by `(gameType, difficulty, seed)`
  - Generation-time verification gate to ensure puzzles are solvable and schema-valid
  - Answer validation and solution generation
- Progress Service
  - Persist attempts and update mastery metrics
  - Streak/badge awarding rules
- Recommendation Service
  - Select next puzzle based on grade band + mastery state
- Parent Dashboard Service
  - Aggregate analytics and assignment controls

## Initial Data Model
`Profile`
- `id`, `displayName`, `gradeBand`, `avatarTheme`, `createdAt`

`GameType`
- `id`, `slug`, `name`, `minGrade`, `maxGrade`, `description`

`Puzzle`
- `id`, `gameTypeId`, `seed`, `difficulty`, `gradeBand`, `promptJson`, `solutionJson`
- `validationState`, `validationErrorsJson`, `validatedAt`

`Attempt`
- `id`, `profileId`, `puzzleId`, `startedAt`, `submittedAt`, `answerJson`
- `isCorrect`, `hintsUsed`, `timeMs`, `scoreAwarded`

`Mastery`
- `id`, `profileId`, `gameTypeId`, `skillTag`, `masteryScore`, `lastUpdatedAt`

`Badge`
- `id`, `profileId`, `badgeType`, `earnedAt`

## API Surface (Draft)
- `POST /api/profiles` create profile
- `GET /api/profiles` list profiles
- `POST /api/session/select-profile` set active profile
- `POST /api/puzzles/next` fetch recommended puzzle
- `POST /api/puzzles/generate` fetch puzzle by type/difficulty
- `POST /api/attempts` submit attempt
- `GET /api/progress/:profileId` progress summary
- `GET /api/parent/dashboard` aggregate analytics

## Extensibility Contract (Draft)
Each puzzle type implements a shared TypeScript interface:
- `metadata`: name, grade range, skill tags
- `generate(input)`: creates a candidate puzzle from seed + difficulty
- `solve(puzzle)`: returns canonical solution(s) used for validation
- `validateAnswer(puzzle, answer)`: grades user responses
- `validatePuzzle(puzzle)`: checks schema and game-specific invariants
- `buildHints(puzzle)`: provides hint ladder

Core engine behavior:
- Register plugins in a `GameTypeRegistry`.
- Route generation/validation/grading through the selected plugin.
- New puzzle types are added by registering a plugin, not by editing core flow.

## Generation-Time Validation Gate
No puzzle may be served until checks pass:
- Structural validation: required fields, schema, bounds, rendering safety
- Solvability validation: solver finds at least one valid solution
- Uniqueness validation: enforce single-solution rules when required
- Consistency validation: prompt, solution, and validator agree

Failure policy:
- Retry generation with a new seed up to a fixed cap.
- If cap is exceeded, log and quarantine the candidate.
- Return only previously validated content or a safe fallback puzzle.

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
