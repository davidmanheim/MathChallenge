# Game Type Catalog (v0.3)

## Design Rules
Each game type includes:
- Grade range
- Generator parameters
- Validation rules
- Hint ladder (nudge -> strategy -> near-solution)
- Plugin implementation conforming to the shared `GameTypePlugin` interface

## Implemented Games

1. **Pattern Train** (Grades 1-3) — `pattern-train`
   - Complete number patterns with increasing rule depth (additive, multiplicative).
   - Multiple-choice with plausible distractors in randomized positions.

2. **Mismo** (Grades 1-6) — `mismo`
   - Match pairs of expressions that evaluate to the same value.
   - Interactive card-pairing with match/miss feedback.

3. **X-Outs** (Grades 2-5) — `x-outs`
   - Cross out grid cells so remaining row/column sums match targets.
   - Interactive sum-tracking board with auto-check when constraints are met.

4. **Shikaku** (Grades 3-7) — `shikaku`
   - Divide a grid into rectangles matching area clues.
   - Click-drag rectangle drawing on canvas; auto-checks on full coverage.

5. **KenKen** (Grades 1-8) — `kenken`
   - Latin square grid with arithmetic cage constraints.
   - Scales from 3x3 addition-only to 6x6 with all four operations.

6. **Factor Ninja** (Grades 4-8) — `factor-ninja`
   - Prime factorisation, GCF, and LCM challenges.
   - Interactive orb-splitting UI for prime factors; keypad for GCF/LCM.

7. **Balance Scale** (Grades 4-8) — `balance-scale`
   - Solve equations by finding x. Visual balance scale metaphor.
   - One-step through multi-step and variables on both sides.

8. **Number Bonds Sprint** (Grades 1-2) — `number-bonds-sprint`
   - Missing-addend practice with number-line support.
   - Scheduled for removal (superseded by Balance Scale).

## Games In Development

See `NEW_GAMES_DESIGN.md` for full specifications.

9. **Sum Blobs** (Grades 1-4)
   - Draw contiguous blobs on a number grid, each summing to a target.

10. **Honeycomb Paths** (Grades 1-4)
    - Trace a path through a hex grid to hit a target sum or sequence.

11. **Subtractiles** (Grades 2-5)
    - Place number tiles so adjacent-cell differences match edge constraints.

12. **Measure Mazes** (Grades 2-5)
    - Connect dots at exact distances across a grid.

13. **Equation Paths** (Grades 3-7)
    - Trace a path through a number/operator grid to build an expression hitting a target.

## Pending Removal

- **Number Bonds Sprint** — Superseded by Balance Scale (identical underlying
  math with better progression). Will be removed once the remaining 5 games
  above are implemented, bringing the active catalog to 12.

## Content Generation Notes
- Use seeded generation for reproducibility
- Enforce one valid answer unless multi-answer mode is explicit
- Run generator output through a mandatory validation gate before serving:
  - Schema + bounds checks
  - Solvability check via solver
  - Uniqueness check when game requires one answer
  - Prompt/solution consistency check
- If validation fails, regenerate with a new seed; never present unvalidated puzzles to users
- Deduplication: puzzle sets check `JSON.stringify(candidate.data)` to avoid
  repeating the same question within a single set
