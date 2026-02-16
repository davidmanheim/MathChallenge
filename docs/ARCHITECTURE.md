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
  - Deterministic puzzle generation by `(gameType, difficulty, seed)`
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
