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

9. **Number Paths** (Grades 1-2) — `number-paths`
   - Trace an adjacent path through counting sequences to reach a goal.
   - Interactive tap-path board with immediate path validation.

10. **Story Logic Grids** (Grades 1-10) — `story-logic-grids`
   - Story-based one-to-one matching logic puzzles generated from templates in
     `src/games/storyLogicGrids/templates.yaml`. Note: despite the `.yaml`
     extension, that file contains **JSON** and is parsed with `JSON.parse(...)`
     (see `plugin.ts` `loadTemplates()`); the file is not renamed for
     compatibility.
   - Includes 20 story variants; difficulty scales by role count, category count, and clue structure.
   - Uses fewer integrated clues at higher levels: cross-category links, order chains (either
     from literally ordered roles like "Tank 1" or from an intrinsically ordered category such
     as day/score/platform paired with a second category to name the rows), grouped exclusions,
     initial-letter constraints, and partial row bundles. Every template defines at least a
     grouped-exclusion category, and most also define an ordered category or ordered roles, so
     the integrated clue mix is not limited to one story.
   - Validation checks that each structured clue set has a unique solution before serving.

11. **Angle Chase Studio** (Grades 5-10) — `angle-chase-studio`
    - Find an unknown angle in a generated SVG diagram using vertical
      angles, angles on a line/point, triangle and polygon angle sums,
      exterior angle theorem, and parallel-line angle theorems.
    - Static diagram + numeric answer entry; hint ladder walks through the
      actual theorem-by-theorem deduction chain rather than just the answer.
    - Difficulty 7-8 add olympiad-prep composite figures (isosceles
      triangle + exterior angle, two triangles sharing an angle-bisected
      cevian, a triangle sitting on a second parallel line) for strong
      grades 8-10 students.

12. **Counting Lab** (Grades 6-9) — `counting-lab`
    - Count outcomes in a generated concrete scenario using the
      multiplication counting principle, permutations (full and partial),
      combinations, restrictions (no-repeat, must-include, adjacency),
      casework, and an intro flavor of the pigeonhole principle.
    - Slot/case/pigeonhole diagram + integer answer entry; hint ladder is
      principle-specific (e.g. "does order matter here?" for combinations)
      and walks through the actual deduction chain rather than just the
      answer.

13. **Proof Blocks** (Grades 6-10) — `proof-blocks`
    - Assemble a valid deductive proof by ordering statement blocks from the
      givens to the goal, where each step's justification must follow from
      statements already established, while excluding plausible-but-invalid
      distractor blocks.
    - Four domains: algebra equation-solving, if-then logic chains,
      number-property (parity) proofs, and geometry angle proofs.
    - Click-to-append block-ordering UI; graded structurally (any
      dependency-respecting order of the non-distractor blocks is accepted, so
      independent steps may be ordered freely) rather than by a single
      canonical string. Hint ladder teaches proof strategy: what to prove,
      which statement follows from the givens first, then the first correct step.

## Games In Development

See `NEW_GAMES_DESIGN.md` for full specifications.

14. **Sum Blobs** (Grades 1-4)
   - Draw contiguous blobs on a number grid, each summing to a target.

15. **Honeycomb Paths** (Grades 1-4)
    - Trace a path through a hex grid to hit a target sum or sequence.

16. **Subtractiles** (Grades 2-5)
    - Place number tiles so adjacent-cell differences match edge constraints.

17. **Measure Mazes** (Grades 2-5)
    - Connect dots at exact distances across a grid.

18. **Equation Paths** (Grades 3-7)
    - Trace a path through a number/operator grid to build an expression hitting a target.

## Potential Games Backlog (By Grade Band)

These are candidate titles for expansion planning. Some may already be
implemented or in development; this list is the master idea backlog.

### Grades 1-2
- Polyominoes
- Sumdoku
- Deka Dots
- Difference Pyramids
- Greater than Sudoku
- Ordered Paths
- Skip-Counting Crosswords
- Magic SUMmer
- Digit Differences

### Grades 2-3
- Honeycomb Paths
- Sum Blobs
- Subtractiles
- X-Outs
- Expression Search
- Mismo
- Sym-sums
- Measure Mazes
- Equation Paths
- 8's and 9's

### Grades 4-5
- Dot Puzzles
- Spiral Galaxies
- Product Placement
- Pyramid Descent
- Dutch Loop
- Hive
- Factor Cave
- Factor Blobs
- Fraction Sumdoku
- Sum Squares

### Grades 5-6
- Integer Tiles (arranging positive and negative integers in grids)
- Like Terms Corrals (grouping algebraic terms)
- Averatiles (finding averages using tile arrangements)
- F&M Grids (Factors & Multiples)
- Shikaku Fractions
- Cross-Sequences
- Ratio Rooms
- Frac-turns
- Percent Squares
- Equivalink (equivalent fractions/decimals/percentages)

### Grades 5-10 (geometry, probability, discrete math)
- Chance Builder (probability and expected value; visual sample spaces) — designed, see NEW_GAMES_DESIGN.md §11
- Coordinate Quest 2D (plotting, distance, midpoint, slope, transformations) — designed, see NEW_GAMES_DESIGN.md §12
- Graph Trails (Euler paths/circuits, parity, graph coloring) — designed, see NEW_GAMES_DESIGN.md §13

## Curriculum and Skill Mapping

This section maps puzzle coverage to school math progressions and to prerequisite
skills for later competitive mathematics.

### Grade-Band Coverage Map

| Grade Band | Typical Core Content | Puzzles Covering It | Overlap Notes | Coverage Gaps |
|------------|----------------------|---------------------|---------------|---------------|
| 1-2 | Counting, place value beginnings, addition/subtraction fluency, skip-counting, simple patterns, comparison | Number Bonds Sprint, Pattern Train, Number Paths, Ordered Paths, Skip-Counting Crosswords, Difference Pyramids, Magic SUMmer | Pattern Train + Number Paths + Ordered Paths all target sequence structure; Number Bonds + Difference Pyramids both reinforce additive decomposition | Limited explicit place-value representation, almost no 2D shape vocabulary or measurement reasoning |
| 2-3 | Multi-digit add/sub, intro multiplication/division, equal groups, beginning fractions, equation intuition, logic constraints | X-Outs, Story Logic Grids, Sum Blobs, Subtractiles, Mismo, Honeycomb Paths, Measure Mazes, Equation Paths, Digit Differences, Expression Search, Sym-sums, 8's and 9's | X-Outs + Sum Blobs + Subtractiles all train constraint-based arithmetic; Mismo + Expression Search overlap expression-value equivalence | Weak coverage of unit fractions as operators, area/perimeter formulas, and data interpretation |
| 4-5 | Multi-step operations, factors/multiples, fraction operations, area/volume intuition, variable introduction, structured reasoning | Factor Ninja, KenKen, Story Logic Grids, Shikaku, Balance Scale, Product Placement, Factor Cave, Factor Blobs, Fraction Sumdoku, Sum Squares, Dot Puzzles, Pyramid Descent | Factor Ninja + Factor Cave/Blobs overlap number theory fluency; KenKen + Sumdoku + Greater than Sudoku overlap Latin-grid logic; Balance Scale + Equation Paths overlap algebraic structure | Minimal coordinate geometry, transformations, angle relationships, and formal probability/combinatorics |
| 5-6 | Integers, ratios/rates/percents, simplifying expressions, distributive property, early equations/inequalities | Integer Tiles, Like Terms Corrals, Averatiles, F&M Grids, Ratio Rooms, Percent Squares, Equivalink, Frac-turns, Shikaku Fractions, Cross-Sequences | Ratio Rooms + Percent Squares + Equivalink form a strong proportion/percent cluster; Integer Tiles + Like Terms Corrals support algebra readiness | Limited graph interpretation, function-machine thinking, and proof-style argumentation |

### Skills That Build Toward Advanced Competition Math

| Skill Family | Current/Planned Puzzle Support | Notes |
|--------------|-------------------------------|-------|
| Arithmetic fluency and numerical flexibility | Strong (Number Bonds, X-Outs, Sum Blobs, Mismo, Magic SUMmer) | Well-covered across early grades with varied representations |
| Number theory (factors, multiples, divisibility) | Moderate-to-strong (Factor Ninja, F&M Grids, Factor Cave/Blobs) | Good base for AMC/AIME-style divisibility problems |
| Algebraic manipulation | Moderate (Balance Scale, Equation Paths, Like Terms Corrals, Expression Search) | Good intro, but limited symbolic depth beyond linear structure |
| Spatial/visual reasoning | Moderate (Shikaku, Polyominoes, Spiral Galaxies, Hive) | Helps with decomposition, invariants, and geometric casework habits |
| Constraint logic and deduction | Strong (Story Logic Grids, KenKen/Sumdoku family, X-Outs, Dutch Loop) | Strong transfer to Olympiad-style structured reasoning |
| Fractions/ratios/percents equivalence | Moderate (Equivalink, Percent Squares, Ratio Rooms, Fraction Sumdoku) | Needs stronger bridge to algebraic rate/proportion problem-solving |
| Combinatorics/probability foundations | Weak | Major gap for later contest progression |
| Euclidean geometry foundations | Weak | Major gap: angle chasing, similarity, circles, transformations |
| Proof and argument structure | Weak | Major gap: little explicit theorem-claim-justification work |

### Overlap and Redundancy Map

- **Arithmetic-constraint cluster:** `X-Outs`, `Sum Blobs`, `Subtractiles`, `Magic SUMmer`  
  Benefit: repeated transfer across formats; Risk: too much procedural overlap without conceptual expansion.
- **Logic-grid cluster:** `Story Logic Grids`, `KenKen`, `Sumdoku`, `Greater than Sudoku`, `Fraction Sumdoku`  
  Benefit: deduction discipline; Risk: can over-index on grid logic vs broader math.
- **Factor/divisibility cluster:** `Factor Ninja`, `Factor Cave`, `Factor Blobs`, `F&M Grids`  
  Benefit: strong number-theory fluency; Risk: overlap unless each title targets distinct theorems/strategies.
- **Expression-equivalence cluster:** `Mismo`, `Expression Search`, `Like Terms Corrals`, `Balance Scale`  
  Benefit: algebra readiness; Risk: redundancy if variable reasoning is not progressively deepened.
- **Path/sequence cluster:** `Pattern Train`, `Number Paths`, `Ordered Paths`, `Honeycomb Paths`, `Equation Paths`  
  Benefit: sequencing and planning; Risk: similar interaction loop unless objectives differ clearly.

### Content Not Yet Covered (or Lightly Covered)

- Coordinate plane reasoning (slope, distance formula intuition, transformations)
- Euclidean geometry core (angles, triangles, similarity, circles)
- Counting principles (systematic counting, permutations/combinations, bijections)
- Probability and expected value
- Functional thinking (inputs/outputs, composition, inverse processes)
- Data/statistics interpretation (distributions, variability, misleading graphs)
- Formal proof communication (direct proof, contradiction, invariants)

### Later-Grade Competitive Topics to Add (Even Without Puzzle Equivalents Yet)

These topics are important for AMC/AIME/Olympiad pathways and should be included
in the long-term curriculum map even before dedicated puzzle engines are built.

#### Grades 6-8 (competition-prep foundations)
- Modular arithmetic and residues
- Diophantine equation basics (integer-solution constraints)
- Pigeonhole principle (intro)
- Invariants and monovariants in game/process settings
- Advanced ratio/proportion and mixture methods
- Similarity/scale factor reasoning in geometry
- Intro graph theory (paths, cycles, parity)

#### Grades 8-10 (advanced contest progression)
- Functional equations (discrete/algebraic forms)
- Advanced counting (double counting, complementary counting, recurrences)
- Advanced number theory (LTE-lite ideas, orders, quadratic residues intuition)
- Euclidean geometry toolset (power of a point, Ceva/Menelaus intuition, cyclic quadrilaterals)
- Inequalities (AM-GM, Cauchy basics, bounding strategies)
- Polynomial/root methods (Vieta patterns, factor theorem usage)
- Coordinate and vector methods for geometry problems

#### Non-puzzle instructional layers recommended
- Weekly proof labs (written justification rubrics)
- Strategy journals (reflective metacognition after hard problems)
- Mixed-topic contest sets (time strategy + error analysis)
- Solution-comparison modules (multiple methods, elegance and efficiency)

## Program Alignment Notes (External Models)

These notes align our puzzle catalog with prominent external math programs and
identify where to expand puzzle/topic coverage.

### 1) Singapore Math Alignment Notes

**Observed model characteristics**
- Explicit CPA progression (Concrete -> Pictorial -> Abstract)
- Number bonds and part-whole reasoning as foundational visuals
- Bar modeling/model drawing across word-problem types
- Mental math and strategy flexibility before formal algorithms

**Core traits to mirror**
- Concrete -> Pictorial -> Abstract (CPA progression)
- Number bonds / part-whole reasoning
- Bar-model style visualization for word problems
- Strong emphasis on number sense and mental strategies

**Strongly aligned current/planned puzzles**
- Number Bonds Sprint, Difference Pyramids, Magic SUMmer (part-whole fluency)
- Sum Blobs and X-Outs (decomposition/composition under constraints)
- Ratio Rooms, Percent Squares, Equivalink (bar-model-friendly proportional thinking)
- Equation Paths, Balance Scale (bridge from pictorial structure to algebraic form)

**Coverage to add for closer alignment**
- Dedicated bar-model puzzle mode for multi-step word problems
- Explicit CPA sequencing in game UX (manipulatives -> visual model -> symbols)
- More early-place-value and regrouping visual models
- Mental-math strategy drills tied to visual decompositions

### 2) Mathletics / Mathseeds Alignment Notes

**Observed model characteristics**
- Structured lesson maps with short interactive tasks
- Curriculum/standards alignment across regions
- Adaptive or level-matched practice and frequent mastery checks
- Motivational rewards + progress reporting dashboards

**Core traits to mirror**
- Short, sequential, standards-aligned skill progressions
- Immediate feedback with corrective loops
- Motivational gamification and progress maps
- Frequent formative checkpoints and teacher-facing analytics

**Strongly aligned current/planned puzzles**
- Set-based puzzle runs with instant grading and hints
- Pattern Train, Mismo, X-Outs (short interaction loops with immediate response)
- KenKen, Shikaku, Factor Ninja (repeatable practice with varied difficulty)

**Coverage to add for closer alignment**
- Explicit micro-skill tags and prerequisite chains per puzzle template
- End-of-map style mixed checks at each grade band
- More measurement/data mini-games for lower grades
- Stronger teacher dashboard views by standard/domain
- Placement diagnostics to route students into appropriate challenge levels

### 3) Russian School of Mathematics (RSM) Alignment Notes

**Observed model characteristics**
- Continuous K-12 arc with depth-first rigor
- Early emphasis on logic, abstraction, and challenging problems
- Multi-year cohort progression and competition readiness
- Strong expectation of explaining reasoning, not just computing

**Core traits to mirror**
- Continuous long-arc curriculum with increasing rigor
- Problem-first, logic-heavy instruction (not rote-only)
- Multi-level challenge tracks within the same grade
- Classroom discourse: multiple methods and reasoning explanation

**Strongly aligned current/planned puzzles**
- KenKen/Sumdoku family, Dutch Loop, X-Outs (deductive rigor)
- Factor Ninja / Factor Cave / F&M Grids (structured number-theory progression)
- Balance Scale, Equation Paths, Like Terms Corrals (algebraic reasoning progression)
- Advanced backlog topics: invariants, Diophantine problems, modular arithmetic

**Coverage to add for closer alignment**
- Multi-solution comparison prompts ("find 2 methods")
- Proof-explanation checkpoints, not only final-answer checking
- Branching tracks (core/advanced/competition) per grade band
- More formal geometry and combinatorics strands earlier
- Recurring spiral reviews of prior-grade high-leverage ideas

### 4) Zaccaro Challenge Math Alignment Notes

**Observed model characteristics**
- Enrichment-first design for mathematically advanced students
- Non-routine multi-topic problem sets with broad early exposure
- Tiered challenge levels (including very high-difficulty extensions)
- Strong use of humor/story framing while preserving rigor

**Core traits to mirror**
- Gifted enrichment via rich word problems and non-routine tasks
- Broad topic span early (probability, logic, ratios, algebraic thinking, etc.)
- Tiered difficulty within each topic
- Strong emphasis on strategy toolkits for problem solving

**Strongly aligned current/planned puzzles**
- Mismo, Expression Search, Equation Paths (expression/algebraic thinking)
- Measure Mazes, Dot Puzzles, Product Placement (applied quantitative reasoning)
- Sym-sums, Sum Squares, Factor Blobs, Cross-Sequences (pattern + structure)
- Backlog additions in probability/statistics and contest-style mixed sets

**Coverage to add for closer alignment**
- Explicit strategy-library mode (draw a diagram, invariants, guess-check-refine)
- More probability/statistics puzzles (including data interpretation traps)
- Advanced early-intro tracks (bases, function machines, contest composites)
- Multi-level challenge ladders inside each puzzle family (easy -> Einstein-style)
- Mixed enrichment chapters that intentionally combine domains in one set

### Cross-Program Synthesis Priorities

1. Add a dedicated **model-drawing / bar-model** puzzle family (Singapore fit).
2. Build **micro-skill progression maps** and checkpoint sets (Mathseeds/Mathletics fit).
3. Add **proof and multi-method explanation** scoring layers (RSM fit).
4. Add **strategy-toolkit + enrichment ladders** across topics (Zaccaro fit).
5. Expand major gaps: **geometry, combinatorics, probability, and proof writing**.

## Pending Removal

- **Number Bonds Sprint** — Superseded by Balance Scale (identical underlying
  math with better progression). Its removal was conditioned on the active
  catalog reaching 12 games; the catalog now has 13 registered plugins, so that
  condition is met and removal is **outstanding**. The plugin is still registered
  pending a separate decision to actually remove it.

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
