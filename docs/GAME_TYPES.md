# Game Type Catalog (v0.2)

## Design Rules
Each game type includes:
- Grade range
- Generator parameters
- Validation rules
- Hint ladder (nudge -> strategy -> near-solution)
- Plugin implementation conforming to the shared `GameTypePlugin` interface

## Implemented Games

1. **Pattern Train** (Grades 1-3)
   - Complete number patterns with increasing rule depth (additive, multiplicative).
   - Multiple-choice with plausible distractors.

2. **Factor Ninja** (Grades 4-8)
   - Prime factorisation, GCF, and LCM challenges.
   - Interactive splitting UI for prime factors; keypad for GCF/LCM.

3. **Mismo** (Grades 1-6)
   - Match pairs of expressions that evaluate to the same value.
   - Interactive card-pairing with match/miss feedback.

4. **X-Outs** (Grades 2-5)
   - Cross out grid cells so remaining row/column sums match targets.
   - Interactive sum-tracking board with auto-check when constraints are met.

5. **Number Bonds Sprint** (Grades 1-2)
   - Missing-addend practice with easy-level number-line support.
   - Set-based run flow for repeated practice.

## Games In Development

See `NEW_GAMES_DESIGN.md` for full specifications.

6. **Sum Blobs** (Grades 1-4)
   - Draw contiguous blobs on a number grid, each summing to a target.

7. **Honeycomb Paths** (Grades 1-4)
   - Trace a path through a hex grid to hit a target sum or sequence.

8. **Subtractiles** (Grades 2-5)
   - Place number tiles so adjacent-cell differences match edge constraints.

9. **Measure Mazes** (Grades 2-5)
    - Connect dots at exact distances across a grid.

10. **Equation Paths** (Grades 3-7)
    - Trace a path through a number/operator grid to build an expression hitting a target.

## Retired Games

- None in current codebase.

## Content Generation Notes
- Use seeded generation for reproducibility
- Enforce one valid answer unless multi-answer mode is explicit
- Version puzzle templates so old attempts remain interpretable
- Run generator output through a mandatory validation gate before serving:
  - Schema + bounds checks
  - Solvability check via solver
  - Uniqueness check when game requires one answer
  - Prompt/solution consistency check
- If validation fails, regenerate with a new seed; never present unvalidated puzzles to users
