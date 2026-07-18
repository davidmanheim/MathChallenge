# New Game Types — Design Document

## Overview

This document specifies 5 puzzle games yet to be implemented, plus preserves the
design specs for 2 games (Mismo, X-Outs) that have already been built.

### Games Not Yet Implemented

| #  | Game             | Grades | Core Math                        | Interaction Model         |
|----|------------------|--------|----------------------------------|---------------------------|
| 1  | Sum Blobs        | 1-4    | Addition, decomposition          | Click cells to grow blobs |
| 2  | Honeycomb Paths  | 1-4    | Addition, number sequences       | Click hexes to trace path |
| 3  | Subtractiles     | 2-5    | Subtraction, negative numbers    | Place tiles on a grid     |
| 4  | Measure Mazes    | 2-5    | Measurement, distance, fractions | Click dots at distance    |
| 5  | Equation Paths   | 3-7    | Order of operations, algebra     | Trace path through grid   |

### Already Implemented (specs preserved for reference)

| #  | Game               | Grades | Status      |
|----|--------------------|--------|-------------|
| 6  | Mismo              | 1-6    | Implemented |
| 7  | X-Outs             | 2-5    | Implemented |
| 8  | Angle Chase Studio | 5-9    | Implemented |

### Pending Removal

**Number Bonds Sprint** — Superseded by Balance Scale (identical underlying math
with better progression). Will be removed once the 5 games above are implemented,
bringing the active catalog to 12.

---

## 1. Sum Blobs

**Source inspiration:** Beast Academy Puzzles (Palmer Mebane)

### Concept
A grid of numbers. The player draws contiguous "blobs" (groups of edge-adjacent
cells) so that every blob sums to a given target. Every cell must belong to
exactly one blob. No overlaps, no leftovers.

### Rules
1. The grid is pre-filled with positive integers.
2. A target sum is displayed (e.g., "Make blobs that each sum to 10").
3. The player clicks/taps cells to assign them to blobs. Adjacent clicked cells
   merge into one blob.
4. Every blob must sum to exactly the target.
5. Every cell must be in exactly one blob.
6. Blobs must be contiguous (connected by shared edges, not diagonals).

### Difficulty Scaling

| Difficulty | Grid Size | Target Sum | Number Range | Notes                     |
|------------|-----------|------------|--------------|---------------------------|
| 1          | 3x3       | 6-10       | 1-5          | Few blobs, obvious splits |
| 2          | 4x4       | 8-12       | 1-6          | More ambiguity            |
| 3          | 4x5       | 10-15      | 1-8          | Larger grid               |
| 4          | 5x5       | 12-18      | 1-9          | Multiple valid partitions |
| 5          | 5x6       | 15-20      | 1-9          | Requires planning ahead   |
| 6          | 6x6       | 15-25      | 1-9          | Expert                    |

### Generation Algorithm
1. Create an empty grid of the target size.
2. Pick a target sum T.
3. Partition the grid into random contiguous regions, each containing 2-5 cells.
4. For each region, generate random positive integers that sum to T.
5. Place those integers in the region's cells.
6. Validate: run the solver to confirm the puzzle is solvable.
7. If the puzzle has too many solutions or is trivial, regenerate.

### Answer Format
List of blobs, where each blob is a set of cell coordinates. Serialized as:
`(r,c),(r,c);(r,c),(r,c),(r,c);...` with semicolons separating blobs.

### Interactive UI
- **Theme:** Warm orange/amber palette. Grid cells are rounded squares.
- **Interaction:** Click a cell to start a new blob (highlighted in a color).
  Click adjacent cells to grow it. Click a cell again to remove it from the blob.
  Toolbar shows blob color swatches; click a swatch to switch active blob.
- **Feedback:** Blob turns green when it hits the target sum. Turns red if it
  exceeds the target. Running sum displayed on each blob.
- **Auto-submit:** When all cells are assigned and every blob is green, auto-check.

### Skill Tags
`addition`, `decomposition`, `spatial_reasoning`, `constraint_satisfaction`

### Hints
1. "Look for cells with large numbers — they have fewer neighbors that can
   complete the target."
2. "The cell at (r, c) with value V needs a neighbor summing to T-V."
3. Reveal one complete blob.

---

## 2. X-Outs

**Source inspiration:** Beast Academy X-Out Puzzles

### Concept
A grid of numbers with target sums for each row and column. Cross out certain
numbers so the remaining numbers in each row and column sum to the targets.

### Rules
1. Grid is pre-filled with positive integers.
2. Each row has a target sum shown on the right.
3. Each column has a target sum shown below.
4. The player crosses out (eliminates) numbers so that:
   - The non-crossed-out numbers in each row sum to that row's target.
   - The non-crossed-out numbers in each column sum to that column's target.
5. The number of cells to cross out is displayed.

### Difficulty Scaling

| Difficulty | Grid Size | Number Range | Cells to X | Notes                         |
|------------|-----------|--------------|------------|-------------------------------|
| 1          | 3x3       | 1-6          | 2-3        | Almost forced; one per row    |
| 2          | 3x4       | 1-8          | 3-4        | Slightly more freedom         |
| 3          | 4x4       | 1-9          | 4-5        | Dual row+col constraint bites |
| 4          | 4x5       | 1-9          | 5-7        | Requires logic chains         |
| 5          | 5x5       | 1-12         | 6-8        | Challenging                   |
| 6          | 5x6       | 1-12         | 8-10       | Expert                        |

### Generation Algorithm
1. Create a grid of random positive integers.
2. Randomly select a subset of cells to be "crossed out."
3. Compute row and column sums of the remaining cells — these become the targets.
4. Verify the solution is unique (run solver).
5. If not unique, adjust numbers or cross-out pattern and retry.

### Answer Format
Set of crossed-out cell coordinates: `(r,c),(r,c),...`

### Interactive UI
- **Theme:** Clean blue/white theme with a ledger/notebook feel.
- **Interaction:** Click a cell to cross it out (red X overlaid, number grayed).
  Click again to un-cross. Row/column sums update live as the player crosses out
  numbers, with color coding: green when sum matches target, red when impossible
  (remaining sum already below target).
- **Auto-submit:** When all row and column sums are green, auto-check.

### Skill Tags
`addition`, `subtraction`, `logic`, `constraint_satisfaction`

### Hints
1. "Find a row or column where only one combination of removals can hit the
   target."
2. "Row R needs to drop by X. Which numbers in that row sum to X?"
3. Reveal one crossed-out cell.

---

## 3. Honeycomb Paths

### Concept
A hexagonal grid where some cells contain numbers and some are empty. The player
traces a path from a start cell to an end cell, stepping through hexes. The
numbers along the path must sum to a given target, or must form a valid counting
sequence.

### Rules
1. A honeycomb (hexagonal) grid is displayed. Each hex either contains a number
   or is empty.
2. Start hex (green border) and end hex (red border) are marked.
3. The player must trace a connected path from start to end, stepping through
   adjacent hexes (each hex has up to 6 neighbors).
4. **Sum mode (d1-3):** The numbers on the path cells must sum to a target value.
5. **Sequence mode (d4-6):** The path must visit numbered cells in ascending
   order (e.g., 1, 2, 3, ..., N), and the path between consecutive numbers
   can pass through empty cells.
6. Each hex may be visited at most once.

### Difficulty Scaling

| Difficulty | Grid Radius | Mode     | Numbers | Notes                       |
|------------|-------------|----------|---------|-----------------------------|
| 1          | 2 (7 hexes) | Sum      | 1-5     | Short paths, small sums     |
| 2          | 2           | Sum      | 1-8     | Slightly harder targets     |
| 3          | 3 (19 hexes)| Sum      | 1-9     | Longer paths, more choices  |
| 4          | 3           | Sequence | 1-6     | Must visit in order         |
| 5          | 4 (37 hexes)| Sequence | 1-8     | Larger grid, trickier paths |
| 6          | 4           | Sequence | 1-10    | Expert navigation           |

### Generation Algorithm
1. Build a hexagonal grid of the given radius.
2. Place a valid path from start to end.
3. Assign numbers to cells along the path that satisfy the target sum or sequence
   constraint.
4. Fill remaining cells with decoy numbers (plausible but leading to dead ends).
5. Validate via solver.

### Answer Format
Ordered list of hex coordinates along the path: `(q,r),(q,r),...` using axial
hex coordinates.

### Interactive UI
- **Theme:** Honeycomb gold/amber on dark brown. Hexes drawn as SVG or canvas
  hexagons with rounded edges.
- **Interaction:** Click the start hex, then click adjacent hexes to extend the
  path. The path draws as a highlighted chain. Click the last hex again to undo
  the last step. Running sum or sequence position displayed.
- **Feedback:** Path glows green when hitting the target. Wrong paths can be
  backed out freely.
- **Auto-submit:** When path reaches the end hex and constraints are met.

### Skill Tags
`addition`, `counting`, `sequences`, `spatial_reasoning`, `path_finding`

### Hints
1. "Try to find a path that avoids the largest numbers if you're over the target."
2. "The shortest path has N steps. Can you hit the target in N steps?"
3. Reveal the first 2-3 cells of the solution path.

---

## 4. Subtractiles

### Concept
A grid puzzle where the player places number tiles into cells so that specific
subtraction relationships hold between adjacent cells. Think of it as a
constraint-satisfaction puzzle built around subtraction and difference.

### Rules
1. A rectangular grid has some cells pre-filled and others empty.
2. A set of number tiles (not yet placed) is shown in a tray.
3. The player drags tiles into empty cells.
4. **Constraint:** Between certain pairs of adjacent cells, a difference value is
   shown on the shared edge. The absolute difference of the two cells must equal
   that value.
5. All tiles must be placed. Each tile is used exactly once.

### Difficulty Scaling

| Difficulty | Grid Size | Tile Range | Constraints | Notes                          |
|------------|-----------|------------|-------------|--------------------------------|
| 1          | 2x3       | 1-6        | 3-4 edges   | Few tiles, mostly forced       |
| 2          | 2x4       | 1-8        | 4-5 edges   | Slightly more freedom          |
| 3          | 3x3       | 1-9        | 5-7 edges   | 2D constraints start to bite   |
| 4          | 3x4       | 1-12       | 7-9 edges   | Requires chains of reasoning   |
| 5          | 4x4       | 1-12       | 8-11 edges  | Challenging                    |
| 6          | 4x5       | 1-15       | 10-14 edges | Expert                         |

### Generation Algorithm
1. Create a grid and fill all cells with numbers from the tile set.
2. Compute absolute differences on selected edges between adjacent cells.
3. Remove some cell values to create the blanks (keeping enough pre-filled cells
   to make the puzzle solvable but not trivial).
4. The removed values become the tile tray.
5. Validate uniqueness via backtracking solver.

### Answer Format
Grid values as comma-separated row-major: `v1,v2,...,vN`

### Interactive UI
- **Theme:** Cool teal/slate palette. Grid cells with visible edge annotations
  showing the required differences.
- **Interaction:** Tile tray at the bottom. Drag a tile into an empty cell (or
  click tile then click cell). Edge differences shown as small numbers on the
  borders between cells. Placed tiles can be dragged back to the tray.
- **Feedback:** When a tile is placed, adjacent difference constraints are checked
  immediately — green check or red X on the edge. All greens + all tiles placed
  triggers auto-check.
- **Auto-submit:** When all cells filled and all visible constraints satisfied.

### Skill Tags
`subtraction`, `absolute_value`, `logic`, `constraint_satisfaction`

### Hints
1. "Look for a cell with only one empty neighbor and a difference constraint —
   that tile is forced."
2. "The cell at (r, c) must differ from its neighbor by D. Only tile T works."
3. Reveal one tile placement.

---

## 5. Mismo

### Concept
"Mismo" means "same" in Spanish. This is a matching/equivalence puzzle: the
player is shown a set of mathematical expressions and must pair them up so that
each pair evaluates to the same value. It's like a math memory/matching game
but all cards are face-up — the challenge is recognizing equivalence across
different representations.

### Rules
1. A set of cards is displayed, each showing a mathematical expression.
2. Every card has exactly one match (another card with the same value).
3. The player clicks two cards to pair them.
4. Paired cards are removed (or grayed out).
5. The game is complete when all cards are paired.
6. No timer by default, but expressions get harder to evaluate mentally at higher
   difficulties.

### Expression Types by Difficulty

| Difficulty | Expressions                                        | Example Pairs              |
|------------|----------------------------------------------------|----------------------------|
| 1          | Simple addition/subtraction within 20               | `3 + 4` = `9 - 2`         |
| 2          | Multiplication facts, simple division               | `6 × 3` = `9 + 9`         |
| 3          | Mixed operations, parentheses                       | `(4 + 1) × 3` = `20 - 5`  |
| 4          | Fractions, decimals                                 | `1/2` = `0.5`, `3/4` = `0.75` |
| 5          | Exponents, roots                                    | `2³` = `4 + 4`, `√16` = `8/2` |
| 6          | Variables, expressions with x                        | `2x` when x=3 = `6`, algebraic equivalence |

### Generation Algorithm
1. Generate N target values (4-8 pairs depending on difficulty).
2. For each target value, generate two different expressions that evaluate to it.
3. Ensure no two target values are the same (each pair is unambiguous).
4. Shuffle all cards randomly.

### Answer Format
List of paired card indices: `(i,j),(i,j),...`

### Interactive UI
- **Theme:** Vibrant purple/magenta with card-flip aesthetic. Cards are rounded
  rectangles with math expressions in clean typography.
- **Interaction:** Click first card (highlights with glow), click second card to
  attempt a pair. If values match, both cards animate out with a satisfying pop.
  If not, both cards shake and de-select.
- **Progress:** Paired count shown (e.g., "3 of 6 pairs found").
- **Auto-submit:** When all pairs are matched.

### Skill Tags
`equivalence`, `mental_math`, `arithmetic`, `fractions`, `expressions`

### Hints
1. "Try evaluating the smallest-looking expressions first to find easy pairs."
2. "The expression [X] evaluates to [V]. Can you find its match?"
3. Reveal one pair.

---

## 6. Measure Mazes

**Source inspiration:** Beast Academy Measure Mazes

### Concept
A set of points (dots) scattered on a grid. The player must connect them in order,
but each connection must be exactly a given distance. The player must figure out
which dot is the correct distance away from the current position.

### Rules
1. A grid of dots is shown. Each dot is at a grid intersection.
2. A starting dot is marked.
3. A sequence of distances is given (e.g., "3, 4, 5, 3").
4. The player must connect dots in sequence: from the start dot, find a dot that
   is exactly the first distance away, then from there find a dot exactly the
   second distance away, and so on.
5. **Distance type by difficulty:**
   - d1-2: Taxicab distance (count grid steps horizontally + vertically)
   - d3-4: Euclidean distance on grid (e.g., distance 5 = a 3-4-5 right triangle)
   - d5-6: Euclidean distance with decimals or square roots shown
6. Each dot may be used at most once.
7. Not all dots need to be used (some are decoys).

### Difficulty Scaling

| Difficulty | Grid Size | Dots | Steps | Distance Type | Notes              |
|------------|-----------|------|-------|---------------|--------------------|
| 1          | 6x6       | 6-8  | 3-4   | Taxicab       | Few dots, obvious  |
| 2          | 8x8       | 8-10 | 4-5   | Taxicab       | More decoys        |
| 3          | 8x8       | 8-10 | 4-5   | Euclidean     | 3-4-5 triangles    |
| 4          | 10x10     | 10-12| 5-6   | Euclidean     | Multiple Pythagorean triples |
| 5          | 10x10     | 12-14| 6-7   | Euclidean+    | Distances may repeat |
| 6          | 12x12     | 14-16| 7-8   | Euclidean+    | Expert, many decoys |

### Generation Algorithm
1. Place the starting dot on the grid.
2. For each step, compute the target distance and place a dot at that exact
   distance (choosing a valid grid point).
3. Place decoy dots at various positions that are NOT the correct distance for
   any step in the sequence (or are correct distances but for the wrong step).
4. Record the solution path.
5. Validate via solver.

### Answer Format
Ordered list of dot indices or coordinates: `(x,y),(x,y),...`

### Interactive UI
- **Theme:** Parchment/map aesthetic with compass-rose decorations. Grid shown
  as faint dotted lines. Active dots shown as solid circles.
- **Interaction:** Click a dot to connect it to the current endpoint. A line draws
  between them. The distance is shown on the line. If the distance matches the
  current target, the line turns green and locks in. If not, the line turns red
  and retracts. A "ruler" tooltip follows the mouse showing the distance to the
  hovered dot.
- **Distance list:** Shown as a sequence with the current target highlighted.
  Completed distances are checked off.
- **Auto-submit:** When the last distance in the sequence is matched.

### Skill Tags
`measurement`, `distance`, `pythagorean_theorem`, `coordinate_geometry`,
`spatial_reasoning`

### Hints
1. "Count the grid steps: how many right and how many up/down to each nearby dot?"
2. "From your current dot, the target distance is D. Look for dots that are D
   steps away (taxicab) or use the Pythagorean theorem."
3. Reveal the next dot in the path.

---

## 7. Equation Paths

### Concept
A rectangular grid where each cell contains either a number or an arithmetic
operator. The player traces a path from the top-left to the bottom-right,
collecting numbers and operators to build a mathematical expression. The
expression must evaluate to a given target value.

### Rules
1. A grid of cells, each containing a number (integer) or an operator (+, -, ×).
2. Start at the top-left cell (always a number).
3. End at the bottom-right cell (always a number).
4. The player may only move right or down (no backtracking).
5. The path alternates: number, operator, number, operator, ..., number.
6. The expression formed by the path must evaluate to the target value.
7. **Evaluation:** Left-to-right by default at d1-3 (no order-of-operations
   complexity). Standard order of operations at d4-6.

### Difficulty Scaling

| Difficulty | Grid Size | Numbers | Operators | Evaluation     | Notes               |
|------------|-----------|---------|-----------|----------------|----------------------|
| 1          | 3x3       | 1-9     | + only    | Left-to-right  | Simple addition path |
| 2          | 3x5       | 1-9     | +, -      | Left-to-right  | Add subtraction      |
| 3          | 4x5       | 1-12    | +, -, ×   | Left-to-right  | Multiplication added |
| 4          | 4x5       | 1-12    | +, -, ×   | Standard PEMDAS| Order of operations  |
| 5          | 5x7       | 1-15    | +, -, ×, ÷| Standard PEMDAS| Division added      |
| 6          | 5x7       | 1-20    | +, -, ×, ÷| Standard PEMDAS| Expert targets      |

### Generation Algorithm
1. Generate a valid path from top-left to bottom-right (only right/down moves).
2. Assign numbers and operators to cells along the path so the expression
   evaluates to the target.
3. Fill off-path cells with plausible numbers and operators (decoys that lead to
   different totals).
4. Validate: ensure exactly one path yields the target.

### Answer Format
Ordered list of cell coordinates forming the path: `(r,c),(r,c),...`

### Interactive UI
- **Theme:** Dark green "chalkboard" aesthetic with chalk-white text and colored
  path highlighting.
- **Interaction:** Click cells to extend the path (only right or down from
  current position). The expression builds live at the top: `3 + 5 × 2 = ?`.
  Running result shown. Click the last cell to undo.
- **Constraints:** Only valid next cells (right or down, alternating number/op)
  are clickable; others are dimmed.
- **Auto-submit:** When path reaches the bottom-right cell and expression equals
  the target.

### Skill Tags
`arithmetic`, `order_of_operations`, `expressions`, `path_finding`,
`strategic_thinking`

### Hints
1. "The target is T. Try to find a path that uses multiplication to reach larger
   numbers efficiently."
2. "From your current position, going right gives [X], going down gives [Y]."
3. Reveal the first 3 cells of the solution path.

---

## 8. Angle Chase Studio

**Status:** Implemented (`src/games/angleChaseStudio/plugin.ts`, gameTypeId `angle-chase-studio`).

**Source inspiration:** Classic "angle chasing" worksheets and olympiad-prep
angle-relationship drills — the geometry counterpart to Balance Scale's
algebra-chasing.

### Concept
A static SVG diagram shows a geometric figure (a line split by rays, two
crossing lines, a triangle, two parallel lines cut by a transversal, or a
polygon) with some angles labeled with their degree measure and exactly one
angle marked with "?". The player enters the numeric degree measure of the
marked angle. Unlike a pure answer-fetching drill, every puzzle carries an
explicit deduction chain (1-3 steps) that names the theorem used at each
step, so the hint ladder can walk the player through the actual proof
reasoning rather than just revealing the number.

### Rules
1. The diagram is generated from one of several angle-relationship
   templates (see Generation Algorithm).
2. Every angle used in the underlying construction is a positive integer
   number of degrees, and the full geometric configuration is drawn to
   scale (except polygons, which use a simplified — not to scale — regular
   layout, clearly labeled as such in the prompt).
3. Exactly one angle is hidden (marked "?"); all others needed to solve it
   are shown as plain numbers or, at difficulty 4+, simple linear
   expressions in `x` (e.g. `2x°`, `(x + 15)°`).
4. The player submits a single number (degrees). Extra text like `°` or
   `degrees` is accepted and ignored by the grader.
5. Every puzzle has exactly one correct numeric answer
   (`expectUniqueSolution: true`).

### Difficulty Scaling

| Difficulty | Grade | Theorem Family (2 variants per tier, chosen at random) | Deduction Steps | Notes |
|------------|-------|----------------------------------------------------------|------------------|-------|
| 1          | 5     | Vertical angles / linear pair at a single crossing; angles on a line (2 parts) | 1 | Direct application of one theorem |
| 2          | 5-6   | Angles on a line (3 parts); angles around a point (3 parts, sum 360°) | 1 (more arithmetic) | Two knowns combined, not just one |
| 3          | 6-7   | Triangle angle sum (basic); angles around a point (4 parts) | 1 | Introduces the triangle-sum theorem |
| 4          | 7     | Triangle angle sum with algebraic expressions (solve for x, then substitute); parallel lines — corresponding angles (1 hop) | 2 | First algebra-in-geometry and first parallel-line theorem |
| 5          | 7-8   | Parallel lines — alternate/co-interior angles (2 hops: same-point + cross-point); exterior angle theorem (triangle sum + linear pair) | 2 | Composed theorem chains |
| 6          | 8-9   | Parallel lines hardest chain (3 hops); polygon interior angle sum `(n−2)×180°`, n = 5-8 | 2-3 | Longest chains; newest theorem (polygons) |

### Generation Algorithm
1. Pick a template pair for the requested difficulty and flip a coin (via
   the seeded RNG) between the two variants.
2. Build the underlying geometric ground truth first — e.g. for two
   crossing lines, pick one acute angle `a` (20°-160°) and derive all 4
   region values (`a`, `180-a`, `a`, `180-a`) via `computeRegions()`, a
   generic helper that partitions the ray directions around a vertex into
   consecutive gaps. For a triangle, pick two integer angles and derive the
   third via `180 - a - b`. For a polygon with `n` sides, distribute
   `(n-2)×180°` across `n` random-ish angles.
3. For "parallel lines cut by a transversal," both intersection points use
   the *same* 4 ray directions (0°, 180°, `a`, `a+180°`) because the lines
   are parallel and the transversal is one straight line — so corresponding
   angles are trivially equal by construction, and alternate/co-interior
   angle relationships fall out as a *composition* of one same-point hop
   (vertical or linear-pair) with one cross-point hop (corresponding),
   which is also how these theorems are proved in a textbook.
4. Hide one angle as the target; keep the rest as "given." Record the
   ordered list of theorem-named deduction steps used to go from the given
   angle(s) to the target — this list is stored directly in
   `candidate.data.chain` and reused verbatim by `buildHints()`.
5. Compute real (x, y) coordinates for every point in the figure using
   trigonometry (or, for polygons only, a regular n-gon layout used purely
   for a legible sketch) so the diagram is genuinely consistent with the
   labeled values.
6. Each generator internally retries (up to ~60-100 times) if a random
   draw produces a degenerate or out-of-range configuration, and falls
   back to a known-good hardcoded configuration if retries are exhausted,
   so `generate()` itself never throws.
7. `validatePuzzle()` re-checks structural invariants (finite diagram
   coordinates, at least one given and one target angle mark, non-empty
   deduction chain, answer strictly between 0° and 360°) plus a
   generator-computed `selfCheck` boolean that re-verifies the template's
   arithmetic invariant (angles actually sum to 180°/360°/`(n-2)×180°`,
   or the algebraic/exterior-angle equation actually balances).

### Answer Format
A single number of degrees, e.g. `70` or `70°` (the grader strips `°`,
`deg`, and `degrees` and compares numerically with a small tolerance).

### Interactive UI
- **Theme:** Deep indigo/navy "blueprint" background, evoking a geometry
  notebook page. Lines in light blue, the given angle's arc in cyan, the
  target angle's arc in glowing amber/gold with a drop-shadow highlight.
- **Rendering:** A generated SVG diagram (lines/segments + arc markers with
  degree labels) is rendered client-side from the structured
  `puzzle.data.diagram` payload — no per-template drawing code is needed in
  the frontend, since every template emits the same generic
  `{segments, angleMarks}` shape.
- **Interaction:** The player reads the diagram and types the numeric
  answer into the existing generic answer field, then presses Submit (or
  Enter) — matching the platform's standard "diagram + numeric entry"
  pattern rather than introducing a new input widget.
- **Legend:** A small color-key under the diagram reminds the player which
  arc is "given" (cyan) and which one to solve for (amber).
- **Auto-advance:** On a correct answer, the standard reinforcement message
  plays and the set advances to the next puzzle, consistent with every
  other game type.

### Skill Tags
`geometry`, `angles`, `angle_chasing`, `vertical_angles`, `linear_pair`,
`angles_on_a_line`, `angles_around_a_point`, `triangle_angle_sum`,
`exterior_angle_theorem`, `parallel_lines`, `corresponding_angles`,
`alternate_angles`, `co_interior_angles`, `polygon_angle_sum`, `algebra`,
`equations`

### Hints
The hint ladder is generated directly from the puzzle's recorded deduction
chain rather than being hand-written per puzzle:
1. **Nudge** — names the geometric relationship(s) needed (e.g. "vertical
   angles," or, for multi-step puzzles, the full chain of theorem names)
   without doing any arithmetic.
2. **Strategy** — walks through every step except the last, with the
   actual numbers substituted in (e.g. "the given angle and the next angle
   we need lie on a straight line together, so that angle = 180 − 42 =
   138°").
3. **Near-solution** — states the final deduction step and the resulting
   numeric answer explicitly.

---

## 9. Counting Lab

**Status:** Implemented (`src/games/countingLab/plugin.ts`, gameTypeId `counting-lab`).

**Source inspiration:** The coverage gap identified in `docs/ROADMAP.md` — no
existing game exercised combinatorics/counting principles, a prerequisite
skill family for later AMC/AIME-style contest-math counting problems.
Structurally mirrors Angle Chase Studio: a generated concrete scenario, a
recorded principle-by-principle deduction chain, and a hint ladder built
directly from that chain rather than hand-written per puzzle.

### Concept
A concrete, countable scenario (an outfit combo, a shelf of books, a club
election, a committee, a security code, a sock drawer, ...) is generated
from one of nine scenario templates spanning seven counting-principle
families: the multiplication counting principle, permutations (full and
partial), combinations, counting principles with restrictions (no-repeat,
must-include, adjacency), casework (summing disjoint cases), and an intro
flavor of the pigeonhole principle. A slot/case/pigeonhole diagram shows the
scenario's raw structure (choice counts per step, or per-case category
sizes, or category count) — never the computed answer — so the player can
see *why* the counting principle applies, not just look up a formula. The
player enters the single integer total count.

### Rules
1. Every scenario names concrete, distinct items (people, books, letters,
   digits, toppings, ...) drawn from small themed word banks, never bare
   variables.
2. Exactly one of the seven principle families listed above applies to any
   given puzzle; the diagram and hint ladder are keyed to that family so the
   support a player gets is technique-specific (e.g. a combination puzzle's
   first hint asks "does order matter here?", not a generic nudge).
3. All generated counts are kept small enough to be sanity-checked by a
   grade 6-9 kid: item pools stay in the 2-10 range and no template can
   produce a final answer over a few thousand (concretely, every template's
   internal numeric ranges are hand-bounded so the worst case across all
   difficulties tops out under ~3,000 — no raw `10!`-style factorial blowups).
4. The player submits a single non-negative integer; commas and surrounding
   whitespace are accepted and stripped by the grader, but the value must
   match exactly (no numeric-tolerance fuzzing, since counts are exact).
5. Every puzzle has exactly one correct integer answer
   (`expectUniqueSolution: true`).

### Difficulty Scaling

| Difficulty | Grade | Principle Family (2 variants per tier, chosen at random) | Steps/Cases | Notes |
|------------|-------|------------------------------------------------------------|--------------|-------|
| 1          | 6     | Multiplication principle, 2 independent slots; multiplication principle, 3 independent slots | 1 | Pure "multiply independent choice counts," no restriction |
| 2          | 6-7   | Full permutation of 3-6 distinct items in a row (`N!`); multiplication principle, 3 slots with wider counts | 1 | Introduces the permutation-of-everything idea |
| 3          | 7     | Counting principle with a no-repeat restriction (letters, then independent repeatable digits); partial permutation — choose and arrange K of N (`P(N,K)`) | 1-2 | First restriction; first "choose which K, in order" |
| 4          | 7-8   | Combination — choose K of N, order doesn't matter (`C(N,K)`, contrasted explicitly against permutation); restricted combination — a specific item must be included (`C(N-1,K-1)`) | 2 | Combination debut; must-include restriction |
| 5          | 8     | Restricted permutation — a specific pair must stand adjacent (`2·(N-1)!`); harder combination (wider N, K range) | 2 | Adjacency restriction via "block" trick |
| 6          | 8-9   | Casework — split into 2 disjoint cases (by sub-group composition) and sum; pigeonhole principle intro — smallest pull to guarantee a match (`(M-1)·C + 1`) | 2-3 cases/steps | Longest reasoning chains; newest principle (pigeonhole) |

### Generation Algorithm
1. Pick one of the two principle-family templates for the requested
   difficulty and flip a coin (via the seeded RNG) between its two variants,
   exactly as `angleChaseStudio` dispatches between two theorem-family
   templates per tier.
2. Build the scenario's ground truth directly from small integer ranges
   chosen so every downstream constraint is automatically satisfiable — no
   retry loop is needed (unlike `angleChaseStudio`'s continuous geometry,
   integer counting scenarios can be range-constructed to always be valid).
   For example: casework picks the team size `K` first, then draws the girl
   count `G` from `[K, K+3]` and boy count `B` from `[1, 4]`, guaranteeing
   both cases (`C(G,K-1)·B` and `C(G,K)`) are always well-defined.
3. Pick a themed word bank (people names, book titles, food/outfit
   categories, colors, letters) and sample concrete, distinct item names via
   a Fisher-Yates-style draw-without-replacement helper, so the same item
   never appears twice in one scenario.
4. Compute the true count via the applicable principle(s) — `factorial`,
   `permute(n,k) = n·(n-1)·...·(n-k+1)`, and `choose(n,k) = permute(n,k) /
   k!` are the only primitives; every template composes them (optionally
   with a second multiplication for independent parts, a division for
   removing an ordering overcount, or a sum across disjoint cases).
5. Record an ordered, principle-named deduction chain (1-3 steps) with the
   real numbers substituted in — this list is stored in
   `candidate.data.chain` and reused verbatim by `buildHints()`.
6. Build a generic diagram payload keyed by `kind` (`"chain"` — an ordered
   list of `{label, count}` slots optionally divided by a factor;
   `"cases"` — 2+ labeled sub-chains with per-case values; `"pigeonhole"` —
   a category count and a guarantee target) that shows the *scenario's raw
   structure*, not the computed answer, so the frontend can render one
   generic diagram renderer per `kind` rather than one drawer per template.
7. Each generator also computes an internal `selfCheck` boolean by
   re-deriving the same arithmetic invariant a second way (e.g. casework
   additionally cross-checks its two-case sum against a complementary-
   counting computation: total teams minus "too few girls" teams). Because
   every generator's numeric ranges are constructed to always be valid,
   `generate()` never throws and never needs a fallback configuration.
8. `validatePuzzle()` re-derives the answer from the raw diagram primitives
   using generic arithmetic (multiply the chain's slots, divide by
   `divideBy`, or sum the cases' values, or apply the pigeonhole formula to
   `categories`/`guaranteeCount`) — independent of the domain-specific
   `permute`/`choose` helpers `generate()` used — plus checks that the
   reasoning chain is non-empty and the generator's own `selfCheck` passed.

### Answer Format
A single non-negative integer, e.g. `70` or `1,680` (the grader strips
commas and whitespace and requires an exact integer match — no tolerance,
since these are exact counts).

### Interactive UI
- **Theme:** Deep teal/emerald "lab" background evoking a science-lab
  notebook page, contrasting with Angle Chase Studio's indigo "blueprint"
  theme. Slot boxes render as rounded "beaker" shapes in teal with glowing
  amber operator symbols (`×`, `÷`, `+`) between them.
- **Rendering:** A DOM-based (non-SVG) diagram is built client-side from the
  structured `puzzle.data.diagram` payload. Because every template emits one
  of three generic shapes (`chain`, `cases`, `pigeonhole`), the frontend
  needs only one renderer per shape, not one per scenario template — the
  same "generic payload, generic renderer" pattern `angleChaseStudio` uses
  for its SVG diagram, just rendered as styled `<div>`s instead of an SVG,
  since a slot/case row doesn't need true geometric drawing.
- **Interaction:** The player reads the scenario and diagram, then types the
  integer answer into the existing generic answer field and presses Submit
  (or Enter) — matching the platform's standard pattern rather than
  introducing a new input widget.
- **Legend:** A short caption under the diagram reminds the player the
  diagram shows the scenario's structure (the numbers to combine), not the
  final count — they still have to do the multiply/divide/sum themselves.
- **Auto-advance:** On a correct answer, the standard reinforcement message
  plays and the set advances to the next puzzle, consistent with every other
  game type.

### Skill Tags
`combinatorics`, `counting_principle`, `multiplication_principle`,
`permutations`, `factorial`, `combinations`, `no_repeat`, `must_include`,
`adjacency_restriction`, `casework`, `pigeonhole_principle`

### Hints
The hint ladder is generated directly from the puzzle's recorded principle
family and deduction chain rather than being hand-written per puzzle:
1. **Nudge** — a principle-family-specific framing question (e.g. for
   combinations: "does the order you pick these in matter?"; for casework:
   "can you split this into a few cases that can't both happen at once?")
   that points the player at *which* technique applies, without doing any
   arithmetic.
2. **Strategy** — walks through every step except the last, with the actual
   numbers substituted in (e.g. "Case 1: exactly 1 girl and 1 boy... =
   8. Case 2: all 2 girls... = 6.").
3. **Near-solution** — states the final deduction step and the resulting
   integer answer explicitly.

---

## Implementation Priority

Recommended implementation order based on complexity and impact:

1. **Mismo** — Simplest generation, wide grade range, immediately engaging
2. **X-Outs** — Well-defined constraints, clean generation algorithm
3. **Sum Blobs** — Beast Academy flagship, very satisfying interaction
4. **Equation Paths** — Novel interaction, teaches order of operations
5. **Subtractiles** — Clean constraint puzzle, good subtraction practice
6. **Honeycomb Paths** — Requires hex grid rendering (more UI work)
7. **Measure Mazes** — Requires distance computation + ruler tool (most UI work)

## Extension Path for Existing/Planned Games

Use these upgrades before creating entirely new engines when possible:

- `Equation Paths`: add coordinate-grid and function-machine variants.
- `Balance Scale`: add inequality chains and two-variable system boards.
- `Mismo` / `Expression Search`: require strategy tags and short method explanations.
- `KenKen` / `Sumdoku` family: add combinatorics modes ("count possible completions").
- `Measure Mazes`: add angle-target and coordinate-transformation variants.
- `Shikaku` / `Polyominoes`: add perimeter-min/max and transformation constraints.
- Factor titles (`Factor Ninja`, `Factor Cave`, `F&M Grids`): add modular arithmetic.
- Ratio/percent titles (`Ratio Rooms`, `Percent Squares`, `Equivalink`): add data table and graph interpretation overlays.

## Gap-Driven New Game Types (Needed Beyond Extensions)

Current/planned catalog still under-covers:
- Euclidean geometry proof topics
- Combinatorics/probability
- Formal proof construction
- Coordinate geometry
- Graph theory/discrete math
- Function thinking
- Statistics/data literacy

## Next-Step Design TODO (Highest Leverage)

1. ~~**Angle Chase Studio** (geometry + proof reasoning anchor)~~ — implemented, see section 8 above.
2. **Counting Lab** (counting principles/combinatorics anchor)
3. **Proof Blocks** (argument structure and proof-writing anchor)
4. **Chance Builder** (probability and expected value)
5. **Coordinate Quest 2D** (slope/distance/transformations)
6. **Graph Trails** (paths, cycles, parity, coloring)

## Shared Implementation Notes

- All games use the standard `GameTypePlugin` interface (generate, solve,
  validatePuzzle, gradeAnswer, buildHints).
- All use seeded RNG for reproducibility.
- All pass through the validation gate before serving.
- Each game gets a themed zone div in `index.html`, themed CSS, and a render
  function dispatched from `renderPuzzle()` in `app.js`.
- Auto-submit on completion is the standard pattern — minimize explicit "submit"
  button clicks for a smoother play experience.
