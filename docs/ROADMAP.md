# Delivery Roadmap (v0.2)

## Phase 0: Design Finalization [DONE]
- Confirmed grade band model and progression policy
- Locked initial data schema
- Finalized game specs

## Phase 1: MVP Platform [DONE]
- TypeScript Node server with `--experimental-strip-types` (no build step)
- Name-based profile login with JSON persistence
- Plugin-based puzzle engine with validation gate
- Set-level deduplication (no repeated puzzles within a set)
- 8 game types implemented:
  - Pattern Train, Mismo, X-Outs, Shikaku, KenKen, Factor Ninja, Balance Scale
  - Number Bonds Sprint (pending removal — superseded by Balance Scale)
- Attempt logging + basic progress tracking
- Interactive themed UIs per game (Factor Ninja orb splitting, KenKen grid,
  Shikaku canvas drawing, Balance Scale visual equation, etc.)

Exit criteria:
- Kids can complete sessions and progress persists [MET]

## Phase 2: Content Expansion [IN PROGRESS]
- 5 additional games designed (see `NEW_GAMES_DESIGN.md`):
  - Sum Blobs, Honeycomb Paths, Subtractiles, Measure Mazes, Equation Paths
- Remove Number Bonds Sprint once remaining games bring active catalog to 12
- Adaptive recommendation tuning
- Better hint quality and worked solutions

### Coverage Expansion Strategy (From Current/Planned Types)
- Extend `Equation Paths` with coordinate/graph variants and function-machine mode.
- Extend `Balance Scale` with inequalities and 2-variable systems.
- Extend `Mismo` / `Expression Search` with explain-your-method checkpoints.
- Extend `KenKen` / `Sumdoku` family with counting/combinatorics overlays.
- Extend `Measure Mazes` with angle and coordinate geometry variants.
- Extend `Shikaku` / `Polyominoes` with perimeter optimization and transformations.
- Extend factor titles (`Factor Ninja`, `Factor Cave`, `F&M Grids`) with modular arithmetic strands.
- Extend ratio/percent titles (`Ratio Rooms`, `Percent Squares`, `Equivalink`) with tables/graphs/data interpretation.

### Gap Areas Requiring New Anchors
- Euclidean geometry proof fluency (angles, similarity, circles)
- Combinatorics and counting principles
- Probability and expected value
- Formal proof-writing and argument structure
- Coordinate geometry and transformation fluency
- Graph theory / discrete structures
- Function thinking (composition, inverse, recursion)
- Data/statistics interpretation and critique

### Next Steps TODO (Highest Leverage First)
1. ~~Finish the **Story Logic Grids clue rewrite** across all 20 templates~~ — done: every
   template now has integrated clues (cross-category links, order chains, grouped exclusions,
   initial-letter constraints, bundles), validated across 1200 generated puzzles.
2. ~~Build **Angle Chase Studio** (geometry/proof anchor)~~ — done, `angle-chase-studio`.
   Follow-up: difficulty is currently capped at 6 (grade 5-9 ceiling); extend with a genuinely
   hard tier (multi-triangle composites, isosceles/exterior-angle chains, denser parallel-line
   transversal chains) for competition-prep-track kids.
3. Build **Counting Lab** (combinatorics/counting anchor).
4. Build **Proof Blocks** (formal reasoning/proof anchor).
5. Design specs for `Chance Builder`, `Coordinate Quest 2D`, and `Graph Trails`.
6. Add "two-method solve" and brief proof prompts to existing algebra/logic games.
7. Define rubric-based scoring for explanation quality (not answer-only).

Exit criteria:
- Full 12-type active catalog usable across grades 1-10

## Phase 2.5: Metagame — Incentives and In-Game Prizes

Design notes for a reward layer that sits on top of the puzzle engine and gives
kids reasons to come back, push through harder content, and build long-term habits.

### Core Principles
- Rewards should reinforce **effort and growth**, not just accuracy. A kid who
  struggles through a hard set and improves deserves more than one who coasts on
  easy puzzles.
- Avoid pay-to-win or pay-to-skip mechanics entirely. Every reward is earnable
  through play.
- Prizes should be **visible but not distracting** — they enhance the experience
  without pulling focus from the math itself.

### Reward Currencies (potential)
- **Stars**: earned per correct answer. Bonus stars for streak length, no-hint
  solves, and first-try accuracy. Spent on cosmetic unlocks.
- **Mastery Badges**: awarded when a skill tag reaches a mastery threshold (e.g.
  80% over 20+ attempts). Displayed on profile. Cannot be lost, but can tarnish
  if mastery decays below threshold (visual cue to revisit).
- **Themed rank tokens**: per-game progression tier. Ties the reward identity to
  each game's theme. Factor Ninja belts, KenKen stars, Shikaku architect ranks,
  Balance Scale judge tiers, etc.

### Incentive Structures to Explore
1. **Daily Challenge**: one curated puzzle per day across all unlocked games.
   Completing it earns a calendar stamp. 7 consecutive stamps unlock a bonus
   reward. Teaches consistency.
2. **Streak Multiplier**: consecutive correct answers in a set multiply star
   earnings (x1, x1.5, x2, x2.5, cap at x3). Resets on wrong answer. Teaches
   focus and care.
3. **Difficulty Dare**: system occasionally offers a puzzle 1 level above the
   kid's current band. Worth triple stars if solved, no penalty if failed.
   Teaches growth mindset.
4. **Set Completion Bonus**: finishing an entire set (e.g. 5/5 correct) awards a
   loot-box-style random cosmetic. Even partial completion (3/5) gives a smaller
   reward. Teaches persistence.
5. **Skill Tree / Map**: visual progression map per game type. Nodes unlock as
   mastery grows. Each node could reveal a fun math fact, a new avatar item, or
   a themed background. Gives a sense of journey.

### Cosmetic Prize Ideas (no gameplay advantage)
- Avatar accessories (hats, colors, badges displayed on profile)
- Puzzle theme skins (e.g. space theme for KenKen, underwater for Pattern Train)
- Custom victory animations unlockable per game
- Profile frames and title banners ("Prime Slayer", "Pattern Master")
- Collectible cards showing math facts or famous mathematicians

### Anti-Patterns to Avoid
- No leaderboards comparing kids to each other — this discourages struggling
  learners. Personal-best tracking is fine.
- No timers as a default pressure mechanic. Optional speed-run mode for kids who
  want it, but never required.
- No punishment for wrong answers beyond not earning bonus rewards. The base
  experience should feel safe to fail in.
- No real-money purchases. If parents want to gift bonus cosmetics, that could
  be a parental-dashboard feature, not an in-app store.

### Implementation Considerations
- Reward state stored per profile alongside progress data. New fields in
  `ProgressStore` or a dedicated `RewardStore`.
- Star balance, badge list, and cosmetic inventory as JSON blobs.
- Frontend: reward toast/animation layer that triggers after `submitCurrent()`
  on correct answers. Small and non-blocking.
- Daily challenge: server picks a seed-of-the-day per game type. Same puzzle for
  all kids on the same day (community feel without competition).
- Badge checks run after each attempt as a post-processing hook — if mastery
  crosses threshold, emit a badge-earned event.

### Open Questions
- How many stars should a single puzzle be worth at baseline? Need playtesting.
- Should cosmetics be per-profile or per-device (family sharing)?
- How to handle kids who reset profiles to re-earn rewards?
- Is there value in a "gift a star" mechanic between sibling profiles?

## Phase 3: Parent Tools + Polish
- Parent assignment controls
- Accessibility improvements
- UI/UX polish and animations

Exit criteria:
- Stable family-ready release

## Risks and Mitigations
- Risk: Difficulty curve too steep/inconsistent
  - Mitigation: telemetry-based tuning + manual overrides by grade band
- Risk: Repetitive puzzle feel
  - Mitigation: template variants, parameter diversity checks, set-level dedup
- Risk: Progress model too noisy
  - Mitigation: rolling-window mastery with decay and min-attempt thresholds
