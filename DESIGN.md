# MathChallenge Design Doc (v0.1)

## 1) Product Goal
Build a web-accessible, TypeScript-based math game platform for kids (roughly grades 1-10) that:
- Lets kids "log in" using just their name (no real authentication).
- Tracks progress by child and by game type over time.
- Supports many puzzle styles similar to Beast Academy / competition-math thinking.
- Adapts difficulty to age/grade and performance.

## 2) Users and Core Use Cases
- Kids (primary): pick a game, solve puzzles, see progress, earn streaks/badges.
- Parent/teacher (secondary): create kid profiles, view progress, assign focus areas.

Core flows:
1. Kid enters name -> chooses profile -> starts/resumes a game.
2. System serves age-appropriate generated puzzles.
3. Kid submits answers/hints/skips.
4. System updates mastery, points, and recommendations.
5. Parent dashboard shows strengths, weak spots, and time spent.

## 3) Scope (Phase 1)
In scope:
- Name-based profile login (no password/auth provider).
- 12 game types spanning grades 1-10.
- Difficulty calibration + per-profile progress tracking.
- Hints, worked solutions, and streak/reward loop.
- Parent progress dashboard.

Out of scope (initially):
- Multiplayer live competitions.
- AI free-response grading.
- Native mobile apps.
- Full curriculum mapping by state standards.

## 4) Non-Functional Requirements
- Fast: puzzle load <300ms for generated content after initial page load.
- Safe by design: no chat, no external user-generated content.
- Reliable save state: no lost progress on refresh.
- Simple local deployment + optional cloud deploy.
- Accessibility: keyboard-friendly, dyslexia-friendly font option, high contrast mode.

## 5) Proposed Technical Architecture (TypeScript)
Recommended stack:
- Frontend: `Next.js` + `React` + `TypeScript`.
- UI: `Tailwind CSS` + component library (shadcn or similar).
- Backend/API: Next.js Route Handlers (`/api/*`) in TypeScript.
- DB: `SQLite` for local/small deploy, upgrade path to `PostgreSQL`.
- ORM: `Prisma`.
- Session model: lightweight cookie-based selected profile ID (not secure auth).

High-level modules:
- `Profile Service`: create/select kid profile by name.
- `Game Engine`: puzzle generators + validators + hint generators.
- `Progress Service`: attempt logs, mastery calculation, streaks, badges.
- `Recommendation Service`: picks next puzzle/game by mastery and grade band.
- `Parent Dashboard`: analytics, progress charts, assignment controls.

## 6) Data Model (Initial)
`Profile`
- `id`, `displayName`, `gradeBand`, `createdAt`, `avatarTheme`

`GameType`
- `id`, `slug`, `name`, `minGrade`, `maxGrade`, `description`

`Puzzle`
- `id`, `gameTypeId`, `seed`, `promptJson`, `solutionJson`, `difficulty`, `gradeBand`

`Attempt`
- `id`, `profileId`, `puzzleId`, `startedAt`, `submittedAt`, `answerJson`, `isCorrect`, `hintsUsed`, `timeMs`, `scoreAwarded`

`Mastery`
- `id`, `profileId`, `gameTypeId`, `skillTag`, `masteryScore`, `lastUpdatedAt`

`Badge`
- `id`, `profileId`, `badgeType`, `earnedAt`

## 7) Difficulty and Progression
Difficulty dimensions:
- Number size / arithmetic complexity.
- Step count / reasoning depth.
- Distractor quality.
- Time target.

Adaptive loop:
1. Start from profile grade band.
2. Increase difficulty after 3 strong attempts (high accuracy, low hint use).
3. Decrease temporarily after repeated misses to rebuild confidence.
4. Interleave review puzzles to prevent forgetting.

## 8) Twelve Game Types to Generate
1. **Number Bonds Sprint** (Grades 1-2)
- Fast compose/decompose numbers (e.g., make 10/20/100).
- Skills: mental arithmetic fluency, complements.

2. **Pattern Train** (Grades 1-3)
- Continue visual/number patterns with increasing rule complexity.
- Skills: early algebraic thinking.

3. **Shape Builder** (Grades 1-4)
- Count edges/vertices, compose area via unit squares.
- Skills: geometry basics, spatial reasoning.

4. **Word Problem Detective** (Grades 2-5)
- Short story problems with irrelevant details to filter.
- Skills: model-building, operation choice.

5. **Fraction Kitchen** (Grades 3-6)
- Recipe scaling, equivalent fractions, mixed numbers.
- Skills: fraction sense and operations.

6. **Balance Scale Algebra** (Grades 4-7)
- Keep equations balanced with unknowns.
- Skills: equation intuition before formal algebra.

7. **Factor Ninja** (Grades 4-8)
- Prime factorization, divisibility tests, GCF/LCM race.
- Skills: number theory foundations.

8. **Logic Grid Minis** (Grades 5-9)
- Small deduction grids with clues.
- Skills: constraint reasoning, elimination.

9. **Coordinate Quest** (Grades 5-8)
- Plot points, transformations, slope clues.
- Skills: coordinate geometry and linear intuition.

10. **Combinatorics Lab** (Grades 6-10)
- Counting arrangements, casework, simple probability.
- Skills: systematic counting, combinatorial thinking.

11. **Competition Countdown** (Grades 6-10)
- Timed mixed challenge with AMC/MathCounts flavor.
- Skills: strategy, time management, synthesis.

12. **Proof Sketch Puzzles** (Grades 8-10)
- Choose valid reasoning steps/order for concise justifications.
- Skills: structure of proof, mathematical communication.

## 9) Content Generation Strategy
For each game type, define:
- Parameterized templates (difficulty + seed).
- Constraint checks (ensure exactly one valid answer when required).
- Validator function (exact match, set match, or tolerance rules).
- Hint ladder (3 levels: nudge -> strategy -> near-solution).
- Worked solution builder (step-by-step JSON for UI rendering).

Use deterministic generation:
- Puzzle reproducibility from `(gameType, difficulty, seed)`.
- Easier debugging, fairness, and repeatable assignment.

## 10) UX Outline
Kid Home:
- Big game cards, streak meter, "recommended next" button.
- Low text load for younger grades.

Game Screen:
- Prompt area, scratchpad, hint button, submit, feedback.
- Timer optional per game.

Progress Screen:
- Stars/badges, mastery bars by game type.
- "You improved in..." weekly summary.

Parent Screen:
- Time spent, accuracy trends, hint dependency, assigned practice.

## 11) Safety and Practical Constraints
- No personal data beyond profile name and optional avatar.
- Parent-only control panel can be a local "guardian mode" toggle.
- Clear data export/delete per profile.
- No external messaging/community features.

## 12) Delivery Plan
Phase A (MVP, 2-3 weeks):
- Profile login, 4 game types, attempt tracking, basic dashboard.

Phase B (Expansion, 3-5 weeks):
- Add remaining 8 game types, adaptive difficulty, richer hints.

Phase C (Polish):
- Better animations/accessibility, assignment presets, printable worksheets.

## 13) Open Decisions
- Grade model: strict grade vs broader bands (recommended: bands).
- Deployment target: local-only home server vs cloud URL.
- Parent controls: open or PIN-protected guardian mode.
- Whether to allow limited offline play (PWA).

---

## Suggested MVP Game Set (first build)
1. Number Bonds Sprint
2. Pattern Train
3. Word Problem Detective
4. Factor Ninja

This set gives broad coverage: arithmetic fluency, patterns, problem solving, and number theory.
