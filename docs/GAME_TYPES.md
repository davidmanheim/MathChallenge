# Game Type Catalog (v0.1)

## Design Rules
Each game type includes:
- Grade range
- Generator parameters
- Validation rules
- Hint ladder (nudge -> strategy -> near-solution)
- Worked solution renderer

## 12 Game Types
1. Number Bonds Sprint (Grades 1-2)
- Compose/decompose numbers quickly.

2. Pattern Train (Grades 1-3)
- Complete number/shape patterns with increasing rule depth.

3. Shape Builder (Grades 1-4)
- Count edges/vertices and compose simple area/perimeter.

4. Word Problem Detective (Grades 2-5)
- Story problems with relevant/irrelevant details.

5. Fraction Kitchen (Grades 3-6)
- Scaling recipes, equivalent fractions, mixed numbers.

6. Balance Scale Algebra (Grades 4-7)
- Equation balance puzzles with unknowns.

7. Factor Ninja (Grades 4-8)
- Prime factors, divisibility, GCF/LCM challenges.

8. Logic Grid Minis (Grades 5-9)
- Small deduction grids with constrained clues.

9. Coordinate Quest (Grades 5-8)
- Plotting, transformations, slope and line intuition.

10. Combinatorics Lab (Grades 6-10)
- Counting, casework, and basic probability.

11. Competition Countdown (Grades 6-10)
- Timed mixed challenge set in contest style.

12. Proof Sketch Puzzles (Grades 8-10)
- Sequence valid reasoning steps for concise proofs.

## MVP Launch Set
- Number Bonds Sprint
- Pattern Train
- Word Problem Detective
- Factor Ninja

## Content Generation Notes
- Use seeded generation for reproducibility
- Enforce one valid answer unless multi-answer mode is explicit
- Version puzzle templates so old attempts remain interpretable
