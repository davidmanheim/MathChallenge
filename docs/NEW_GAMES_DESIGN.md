# New Game Types — Design Document

## Overview

This document specifies 8 puzzle games yet to be implemented, plus preserves the
design specs for 5 games (X-Outs, Mismo, Angle Chase Studio, Counting Lab, Proof
Blocks) that have already been built. Section numbers below (`## 1`–`## 13`) are
the doc's own section indices; the `#` columns in the two tables are just row
counters.

### Games Not Yet Implemented

| #  | Game                | Grades | Core Math                                            | Interaction Model              |
|----|---------------------|--------|------------------------------------------------------|--------------------------------|
| 1  | Sum Blobs           | 1-4    | Addition, decomposition                              | Click cells to grow blobs      |
| 2  | Honeycomb Paths     | 1-4    | Addition, number sequences                           | Click hexes to trace path      |
| 3  | Subtractiles        | 2-5    | Subtraction, negative numbers                        | Place tiles on a grid          |
| 4  | Measure Mazes       | 2-5    | Measurement, distance, fractions                     | Click dots at distance         |
| 5  | Equation Paths      | 3-7    | Order of operations, algebra                         | Trace path through grid        |
| 6  | Chance Builder      | 5-9    | Probability, expected value                          | Count a highlighted sample space |
| 7  | Coordinate Quest 2D | 5-9    | Plotting, distance, midpoint, slope, transformations | Click-to-plot on a coordinate grid |
| 8  | Graph Trails        | 6-10   | Euler paths/circuits, parity, graph coloring         | Trace edges of a graph         |

### Already Implemented (specs preserved for reference)

| #  | Game               | Grades | Status      |
|----|--------------------|--------|-------------|
| 9  | Mismo              | 1-6    | Implemented |
| 10 | X-Outs             | 2-5    | Implemented |
| 11 | Angle Chase Studio | 5-10   | Implemented |
| 12 | Counting Lab       | 6-9    | Implemented |
| 13 | Proof Blocks       | 6-10   | Implemented |

### Pending Removal

**Number Bonds Sprint** — Superseded by Balance Scale (identical underlying math
with better progression). Removal was conditioned on the active catalog reaching
12 games; the catalog now has 13 registered plugins, so that condition is met and
removal is **outstanding** — the plugin remains registered pending a separate
decision to remove it.

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
crossing lines, a triangle, two parallel lines cut by a transversal, a
polygon, or, at the hardest tiers, a composite figure such as an isosceles
triangle with an exterior angle, two triangles sharing an angle-bisected
cevian, or a triangle sitting on one of two parallel lines) with some
angles labeled with their degree measure and exactly one angle marked with
"?". The player enters the numeric degree measure of the marked angle.
Unlike a pure answer-fetching drill, every puzzle carries an explicit
deduction chain (1-4 steps, longest at the hardest tiers) that names the
theorem used at each step, so the hint ladder can walk the player through
the actual proof reasoning rather than just revealing the number.

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
| 7          | 8-10  | Isosceles triangle + exterior angle (linear pair → isosceles base angles → triangle sum); triangle sitting on one of two parallel lines (alternate angles → triangle sum) | 2-3 | First composite figures: a new theorem (isosceles base angles) combined with an existing one, and a new figure shape (triangle spanning two parallel lines) that doesn't appear at any earlier tier |
| 8          | 9-10  | Angle bisector splitting a triangle into two triangles that share a cevian (triangle sum → linear pair → angle-bisector equality → triangle sum); isosceles triangle whose two base angles are given as two *different-looking* algebraic expressions that must be set equal and solved before an optional final triangle-sum hop | 3-4 | Deepest chains: multi-triangle composites and a genuine two-expression equation (not a single substitution) — pitched at strong grades 8-10 kids heading toward AMC/AIME-style angle chasing |

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
8. Difficulty 7-8's composite figures are built from the same primitives,
   composed differently: an isosceles triangle is built with
   `triangleApex(beta, beta, ...)`, which is automatically symmetric,
   guaranteeing equal base angles by construction rather than by
   assumption. A shared-cevian figure locates the cevian's foot `D` on the
   base via the angle-bisector length-ratio theorem
   (`BD:DC = AB:AC`, i.e. `D = B + (AB/(AB+AC))·(C−B)`) so the drawn ray
   really is the angle bisector, not just a suggestive sketch. A triangle
   "sitting on" a second parallel line is built by drawing two equal-span
   horizontal segments (one through the base, one through the apex) —
   parallel by construction — and the alternate-interior-angle claim
   between them is exact integer arithmetic (verified independently by
   direct direction/coordinate computation during development, not just
   by the generator's own self-check).



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
`equations`, `isosceles_triangle`, `angle_bisector`

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
election, a committee, a security code, a build-your-own pizza, a round
table, a scrambled word, a sock drawer, ...) is generated from one of
**thirteen** scenario templates spanning ten counting-principle families:
the multiplication counting principle (with and without repetition allowed),
permutations (full and partial), combinations, counting subsets (each item
in-or-out → 2ⁿ), circular permutations, multiset arrangements (words with
repeated letters), counting principles with restrictions (no-repeat,
must-include, adjacency), casework (summing disjoint cases), and an intro
flavor of the pigeonhole principle. Each template draws from several themed
word banks and wide numeric ranges, so every difficulty level yields dozens
of genuinely distinct problems and a full 12-puzzle set never repeats.

Rather than reading the scenario and typing a number, the player **builds the
count on an interactive bench**: filling each choice "slot" by picking an
option, watching the running product/sum grow, making the "does order matter?"
decision physical, or constructing the pigeonhole worst case one item at a
time. The slot/case/pigeonhole structure shows *why* the counting principle
applies (never pre-showing the answer); the player's construction produces
the total, which drops into the answer box for submission.

### Rules
1. Every scenario names concrete, distinct items (people, books, letters,
   digits, toppings, ...) drawn from small themed word banks, never bare
   variables.
2. Exactly one of the ten principle families listed above applies to any
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

Each tier offers **three** variant templates, chosen at random by the seeded
RNG; every template samples a themed word bank and wide numeric ranges, so a
tier yields dozens of distinct structures (measured ~27-154 distinct
variant+diagram structures per tier over 800 seeds, and far more once themed
item names are counted).

| Difficulty | Grade | Principle Family (3 variants per tier, chosen at random) | Steps/Cases | Notes |
|------------|-------|------------------------------------------------------------|--------------|-------|
| 1          | 6     | Multiplication principle: 2 independent slots; 3 independent slots; 2 slots with wider counts (9 themed contexts) | 1 | Pure "multiply independent choice counts," no restriction |
| 2          | 6-7   | Full permutation of 3-6 distinct items in a row (`N!`, 5 contexts); multiplication, 3 slots, wider counts; strings **with repetition** allowed (`A^L`) | 1 | Permutation-of-everything vs. repeat-allowed multiplication |
| 3          | 7     | No-repeat restriction (letters, then repeatable digits); partial permutation — choose and arrange K of N (`P(N,K)`, 3 contexts); counting **subsets** (each item in/out → `2^T`) | 1-2 | First restriction; first "choose which K, in order"; subsets |
| 4          | 7-8   | Combination — choose K of N, order doesn't matter (`C(N,K)`, 4 contexts); must-include restriction (`C(N-1,K-1)`); harder subsets (`2^T`, T up to 8) | 2 | Combination debut; must-include; subsets scale-up |
| 5          | 8     | Restricted permutation — a pair must stand adjacent (`2·(N-1)!`); harder combination (wider N,K); **circular** permutation (`(N-1)!`) | 2 | Adjacency via "block" trick; rotations-are-equal |
| 6          | 8-9   | Casework — 2 disjoint cases summed (3 group themes); pigeonhole intro (`(M-1)·C + 1`, 4 item themes, M up to 4); **multiset** word arrangements (`n!/∏rₖ!`) | 2-3 cases/steps | Longest chains; pigeonhole; repeated-letter division |

### Generation Algorithm
1. Pick one of the three variant templates registered for the requested
   difficulty (via `TIER_GENERATORS[d]`), chosen uniformly at random by the
   seeded RNG, then pick a themed word bank for that template. Themes are
   selected pool-size-aware (`pickWithPool`) so a scenario never lists fewer
   concrete items than the count it claims, and the chosen theme key is baked
   into the puzzle `variant` string so themed variants are counted as
   genuinely distinct problems by the server's `JSON.stringify(data)` dedup.
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
- **Rendering:** A DOM-based (non-SVG) *interactive* bench is built
  client-side from the structured `puzzle.data.diagram` payload. Because every
  template emits one of three generic shapes (`chain`, `cases`, `pigeonhole`),
  the frontend needs only one interactive builder per shape, not one per
  scenario template. Each chain `slot` optionally carries an `options: string[]`
  array (real item names for multiplication/subset/repeat-string slots);
  slots without it render generic numbered option chips equal to the slot's
  count. The chain builder is reused inside the cases builder (each case is a
  mini chain reporting its product).
- **Interaction (the "count builder"):** The player actively *constructs* the
  count instead of only typing it:
  - **Chain (multiplication, permutations, combinations, restrictions,
    subsets, circular, repeat-strings):** left-to-right "stations", one per
    slot, each showing its option chips and a "N options" badge. Tapping one
    chip locks that station's factor into a live **running product**
    (`3 × 4 = 12 so far`), making the multiplication principle something you
    manipulate. Shrinking pools (permutations) show as decreasing chip counts.
  - **The "does order matter?" decision is physical:** for grouping templates
    (combinations, must-include, multiset) a card appears after the ordered
    product is built — *"if two builds come out identical, count them once or
    separately?"* Choosing **"count once (÷ k)"** divides out the overcount
    and finalizes; choosing "separately" gives corrective feedback and does
    **not** finalize. This turns permutation-vs-combination into an action.
  - **Cases:** each disjoint case is its own mini-chain bench; the player
    builds each, and a running **sum** adds them (`10 + 6 = 16`).
  - **Pigeonhole:** the player constructs the **worst case** one item at a
    time, tapping color bins (each capped at `M-1`; over-filling is refused
    with a nudge). Once every bin holds `M-1`, a highlighted *"draw one more —
    forces a match!"* button adds the guaranteeing `+1`.
  The interaction never auto-computes the answer out of thin air: nothing
  appears until the player builds it, and a running partial count is the only
  scaffolding. When the build completes, the total drops into the standard
  answer field and a "Submit this count" button appears (the standard answer
  row, with Hint, stays available), reusing the platform's normal
  submit/grade path (`gradeAnswer` still checks an exact comma/whitespace-
  tolerant integer).
- **Legend:** A short caption tells the player to build the count by picking an
  option in each slot (or filling the bins) and watching the running total, and
  that finishing drops the total into the answer box.
- **Auto-advance:** On a correct answer, the standard reinforcement message
  plays and the set advances to the next puzzle, consistent with every other
  game type.

### Skill Tags
`combinatorics`, `counting_principle`, `multiplication_principle`,
`permutations`, `factorial`, `combinations`, `subsets`, `with_repetition`,
`circular_permutation`, `multiset_permutation`, `no_repeat`, `must_include`,
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

## 10. Proof Blocks

**Status:** Implemented (`src/games/proofBlocks/plugin.ts`, gameTypeId `proof-blocks`).

**Source inspiration:** The coverage gap flagged in both `docs/ROADMAP.md` and
`docs/GAME_TYPES.md` — "formal proof / argument structure": kids had little
practice with theorem→claim→justification reasoning. Structurally a cousin of
Angle Chase Studio and Counting Lab (a generated scenario, a recorded
step-by-step chain, and a hint ladder built from that chain), but it departs in
its *answer format* — this is an ordering/selection puzzle over statement
blocks, not a numeric-answer game — so its grader and validation differ.

### Concept
The player is given a set of statement "blocks." Some are **givens** (a
starting set with no justification), some are candidate **steps** (each a
statement plus a named justification/rule), one is the **goal**, and some are
**distractors** (plausible-but-invalid statements — a wrong justification, an
algebra slip, an irrelevant claim, or a logical fallacy such as affirming the
converse). The player assembles a correct proof by ordering the blocks into a
valid chain from the givens to the goal, where each step's justification only
uses statements already established earlier in the chain — and must *exclude*
every distractor. Four content domains are implemented: algebraic
equation-solving (each line justified by "distributive property", "subtract N
from both sides", "divide both sides by N", ... proving `x = value`); if-then
logic chains (modus ponens along a chain of conditionals); number-property
parity proofs ("the sum of two evens is even", "even + odd is odd", "an even
times any integer is even", ... via the definition-of-even/odd substitution
argument); and geometry angle proofs (reusing Angle Chase Studio's theorem
vocabulary — "Linear Pair Postulate", "vertical angles" — to prove two angles
equal or solve for `x` with justification).

### Rules
1. A proof node is a **given** (deps = none, reason "Given"), a **step** (a
   statement justified by a named rule, depending on one or more earlier
   nodes), or the single **goal** node (the sink). Distractor blocks are never
   part of any valid proof.
2. The proof forms a DAG: every non-given node's justification references the
   ids of the earlier statements it follows from. The goal is the unique sink,
   and — by construction — every non-distractor block is an ancestor of the
   goal (no proof block is dead weight), so a correct answer must use *all* the
   non-distractor blocks.
3. Algebraic and logic-chain proofs at low difficulty are **linear** (each step
   depends on the previous, unique valid order). Parity and geometry proofs at
   higher difficulty **branch**: e.g. the two "definition of even" lines
   (`a = 2m`, `b = 2n`) each depend only on their own given, so they are
   independent and may be placed in either order. This makes multiple
   topological orders valid — which is why the grader validates *structurally*
   rather than string-matching a single canonical order.
4. The player submits an **ordered list of block ids** (the proof sequence). A
   submission is correct iff it (a) contains exactly the non-distractor set (no
   distractor included, none missing), (b) has no duplicate/invented ids, and
   (c) respects every dependency (each block's prerequisites all appear strictly
   earlier). This exactly rejects the four canonical error modes: using a step
   before its prerequisite, including a distractor, stopping short of the goal,
   and repeating a block.
5. Because independent steps yield several valid orders, `expectUniqueSolution`
   is **false**; `solve()` returns one canonical (construction-order) topological
   ordering, which the structural grader is guaranteed to accept.

### Grading Approach (canonical-order vs. structural-validity)
**Structural validity** was chosen over canonical-string comparison. This is the
mathematically honest option (independent steps genuinely have no required
relative order) and, per the platform's own guidance, the cleaner one to get
right: the grader *checks that the submitted order is a valid proof* rather than
comparing against a stored string. The tradeoff — the grader is slightly more
code than an equality check — is worth it: a canonical-string grader would
wrongly reject a student who established `b = 2n` before `a = 2m`, teaching a
false lesson about proof order. `solve()` still returns a single canonical
ordering so the validation gate's solvability and grader-consistency checks pass
(the gate only requires that every returned canonical solution grades as
correct, which it does).

### Difficulty Scaling

| Difficulty | Grade | Domain (2 variants per tier, chosen at random) | Structure | Distractors | Notes |
|------------|-------|-------------------------------------------------|-----------|-------------|-------|
| 1          | 6     | Algebra 2-step (`ax + c = r`); logic 2-link if-then chain | Linear | 0 | Pure "what order do these go in" — no distractors yet |
| 2          | 6-7   | Algebra 2-step; logic 2-link chain | Linear | 1 | First distractor (wrong-inverse-operation / converse error) |
| 3          | 7     | Algebra 3-step (`k(x+p) = r`: distribute → subtract → divide); parity "sum of two evens is even" | Linear / branching | 1 | First branching DAG (two independent definition steps) |
| 4          | 7-8   | Parity "sum of two odds"/"even + odd"; geometry "vertical angles are equal" | Branching | 1-2 | Branching in both domains |
| 5          | 8-9   | Geometry solve-for-x (complementary/supplementary + substitution); parity "even × integer is even" | Branching | 2 | Longer chains, 2 distractors |
| 6          | 9-10  | Geometry vertical-angles (2 distractors); algebra 3-step (2 distractors) | Branching / linear | 2 | Maximum distractor load |

### Generation Algorithm
1. Pick the difficulty tier's two domain variants and flip the seeded coin
   between them, exactly as Angle Chase Studio / Counting Lab dispatch.
2. A `ProofBuilder` accumulates proof nodes in a natural, dependency-respecting
   insertion order (`given` / `step` / `goal`); it throws if a node references a
   dep not yet added, so a malformed generator fails loudly rather than emitting
   a bad puzzle. Distractors are added separately with a plausible statement and
   a (deliberately invalid) justification.
3. The assembler assigns ids, derives the **canonical order** directly from the
   builder's insertion order (topologically valid by construction), records the
   derivation **chain** (steps + goal, for hints), and **shuffles** all blocks
   (proof nodes + distractors) with a Fisher-Yates draw for presentation.
4. Every generator computes a structural `selfCheck` via `verifyProof()`, which
   re-verifies: deps precede in the canonical order; exactly one goal, which is
   the last node; ≥1 given and ≥1 step; and the goal's reverse-dependency
   closure covers every proof node (no dead weight). Geometry solve-for-x folds
   an extra arithmetic check (integer, positive `x`; second angle in range) into
   `selfCheck`. Because ranges are constructed to always be valid, `generate()`
   never throws.
5. `validatePuzzle()` independently re-checks the served payload: ≥3 blocks,
   no duplicate/empty ids, the canonical order equals exactly the non-distractor
   set, no proof block depends on a distractor or a dangling id, the goal is a
   real proof block, `verifyProof()` passes, the hint chain is non-empty, and
   `selfCheck` is true.

### Answer Format
A JSON array of block ids in proof order, e.g. `["ga","gb","sa","sb","ssum",
"sfac","goal"]` (a whitespace/comma-separated list of ids is also accepted by
the grader as a fallback). The grader validates the order structurally (set
equality against the non-distractor blocks + dependency-respecting order); it
does not compare against a single stored string, so any topologically valid
ordering is accepted.

### Interactive UI
- **Theme:** Deep indigo/violet "logic workshop" panel — distinct from Angle
  Chase Studio's blueprint indigo and Counting Lab's teal lab. Given blocks are
  tinted green, the goal block magenta, ordinary steps violet.
- **Layout:** A goal banner ("Prove: …") over two columns: an **Available
  blocks** bank (all blocks, shuffled) and **Your proof** (the ordered sequence
  being assembled). Collapses to a single column under 640px.
- **Interaction:** Click-to-append — tapping a bank block moves it into the
  proof column at the end. Each placed block shows its position number and has
  ↑ / ↓ reorder buttons and a × remove button (a click-to-append-then-reorder
  model, simpler than full drag-and-drop, as the platform allows). Each block
  chip displays its statement and its justification ("because: …") so the
  reasoning is always visible. A "Check Proof" button submits; "Clear" empties
  the proof.
- **Submit:** Follows the Story Logic Grids pattern — builds the id array into
  the hidden answer field, POSTs to `/api/attempts`, and on success shows a
  banner and auto-advances; on failure it explains the three things to check
  (no distractors, dependency order, reaching the goal) without revealing the
  answer.

### Skill Tags
`proof`, `argument_structure`, `justification`, plus domain-specific tags:
`algebra` / `equations`; `logic` / `if_then` / `modus_ponens`;
`number_properties` / `parity`; `geometry` / `angles`.

### Hints
Built from the recorded chain, teaching proof *strategy* rather than the answer:
1. **Nudge** — restates what is being proved and what is given, and reminds the
   player that every block must be justified only by blocks already placed and
   that some blocks are distractors to leave out.
2. **Strategy** — identifies which statement can be established first using only
   the givens, and names its justification.
3. **Near-solution** — reveals the first correct step, then lists the remaining
   steps in dependency order with their justifications.

---

## 11. Chance Builder

**Status:** Designed (not yet implemented).

**Source inspiration:** The probability/expected-value coverage gap called out
in `docs/GAME_TYPES.md` ("Combinatorics/probability foundations — Weak. Major
gap") and `docs/ROADMAP.md` — no existing game touches probability at all.
Structurally mirrors Angle Chase Studio and Counting Lab: a generated concrete
scenario, a recorded step-by-step deduction chain, and a hint ladder built
directly from that chain rather than hand-written per puzzle.

### Concept
A concrete, visual random experiment (a spinner, one or two dice, a coin, a
handful of coloured balls in an urn, or a small deck of cards) is generated
from one of six scenario templates. The player is asked for the probability of
a described event, or — at the top tier — the expected value of a simple
payoff game. The key design commitment is that **the sample space is drawn, not
just described**: the diagram shows every equally-likely outcome (each spinner
sector, each die face, each ball), with the favourable outcomes highlighted, so
a kid can literally count "favourable out of total" instead of manipulating
fractions abstractly. Every puzzle carries an explicit deduction chain (count
total outcomes -> count favourable -> combine / take complement / weight by
payoff) that names the probability principle used at each step, so the hint
ladder walks the actual reasoning.

### Rules
1. Every scenario is built as an explicit set of **equally-likely atomic
   outcomes** (see Generation Algorithm), so every probability is an exact
   rational `favourable / total` and every expected value is an exact rational
   `sum-of-payoffs / total`. Unequal-looking spinners are subdivided into equal
   unit sectors internally so this invariant always holds.
2. The event is described in plain, concrete language tied to the drawing
   (e.g. "the spinner lands on a red sector", "the two dice sum to 7", "you draw
   a face card"), and the favourable atomic outcomes are highlighted in the
   diagram.
3. The player submits a single value. For probability questions the answer may
   be given as a **fraction, a decimal, or a percent** — all three are accepted
   (see Answer Format), because forcing one representation would penalise a
   student who understands the ratio but prefers a different form. For
   expected-value questions the answer is a single number (fraction or decimal).
4. Probabilities are always in `[0, 1]`; the "impossible" (0) and "certain" (1)
   edge events are allowed and are useful at the low tiers.
5. Every puzzle has exactly one correct *value* (`expectUniqueSolution: true`);
   the multiple accepted string forms all normalise to that one value, so
   uniqueness is over the numeric value, not the string.

### Difficulty Scaling

| Difficulty | Grade | Principle Family (2 variants per tier, chosen at random) | Steps | Notes |
|------------|-------|-----------------------------------------------------------|-------|-------|
| 1          | 5     | Single-event probability, equal outcomes: spinner with equal sectors; one fair die | 1 | Pure `favourable / total`; small counts, answer often a "nice" fraction |
| 2          | 5-6   | Single-event with grouped/unequal favourable outcomes: unequal-sector spinner (integer sector sizes); urn of coloured balls, one draw | 1 | Favourable set is a subset that must be counted, not read off |
| 3          | 6-7   | Complementary events: `P(not A) = 1 - P(A)`, "at least one" phrased as "not none" on a single draw; single card draw from a small deck | 1-2 | Introduces the complement rule |
| 4          | 7     | Compound **independent** events (AND, multiply): two spins, two dice, or coin-then-die; `P(A and B) = P(A)·P(B)` | 2 | First product rule; sample space is the Cartesian product |
| 5          | 7-8   | Compound events with OR / mutually-exclusive add and complement combined: two dice sum/difference events; `P(A or B) = P(A) + P(B)` for disjoint A, B | 2-3 | Distinguishes "and" vs "or"; some chains end with a complement |
| 6          | 8-9   | Expected value of a simple payoff game: spinner or single die where each outcome carries a win/lose payoff; `EV = Σ payoffᵢ / total` | 2-3 | Newest concept; answer may be a non-terminating decimal (see Answer Format) |

### Generation Algorithm
1. Pick one of the two scenario templates for the requested difficulty and flip
   a coin (via the seeded RNG) between the two variants, exactly as Angle Chase
   Studio and Counting Lab dispatch between two families per tier.
2. Build the ground truth as an explicit array of equally-likely atomic
   outcomes:
   - **Spinner (equal sectors):** `k` sectors, each one outcome.
   - **Spinner (unequal sectors):** each labelled region has an integer weight;
     subdivide into that many unit sectors so all atoms are equally likely and
     `total = Σ weights`.
   - **One die:** outcomes `1..6`. **Two dice:** the 36 ordered pairs. **Coin:**
     `{H, T}`; **two coins / coin+die:** the Cartesian product.
   - **Urn:** a multiset of coloured balls; one draw = one atom per ball.
   - **Cards:** a small generated deck (e.g. 12-20 cards with suit/rank/colour
     attributes), one atom per card.
3. Define the event as a predicate over atoms (colour == red, sum == 7, value
   is even, "not blue", etc.). Count `favourable` = atoms satisfying it.
   Compound AND/OR events compose two predicates over the product space.
4. Compute the answer:
   - Probability = `reduce(favourable, total)` (a reduced fraction, plus its
     decimal).
   - Complement = `reduce(total - favourable, total)`.
   - Expected value: attach an integer payoff to each atom and compute
     `reduce(Σ payoff, total)`.
5. Record an ordered, principle-named deduction chain with the real numbers
   substituted in (e.g. "36 equally-likely rolls in total -> 6 of them sum to 7
   -> P = 6/36 = 1/6"), stored in `candidate.data.chain` and reused verbatim by
   `buildHints()`.
6. Build a generic diagram payload keyed by `kind`
   (`"spinner"` — sector labels + colours + which are favourable; `"dice"` —
   one or two dice plus, for two dice, the highlighted cells of the 6×6 outcome
   grid; `"coins"`; `"urn"` — coloured-ball counts; `"cards"` — a small card
   grid; `"payoff-spinner"` / `"payoff-die"` — as spinner/die but each outcome
   also carries its payoff). The frontend renders one generic drawer per `kind`;
   no per-template drawing code.
7. Because every scenario is range-constructed from small integer counts, every
   downstream count is automatically valid — no retry loop is needed and
   `generate()` never throws (following Counting Lab rather than Angle Chase
   Studio). A `selfCheck` boolean re-derives the answer a second way
   (e.g. probability via complement should equal `1 − P(event)`; EV recomputed
   by grouping equal payoffs) as a guard.
8. `validatePuzzle()` re-derives the answer directly from the raw diagram
   primitives using generic arithmetic — count highlighted atoms over total
   atoms, or sum payoffs over total — independent of the template-specific
   predicate code, and checks the reasoning chain is non-empty, the probability
   lies in `[0, 1]`, and `selfCheck` passed.

### Answer Format
A single probability or expected-value number. The grader normalises before
comparing, and accepts three equivalent forms so representation preference is
never penalised:
- **Fraction** — `3/8`, and also unreduced forms like `6/16` (compared by
  cross-multiplication, so any equivalent fraction matches exactly).
- **Decimal** — `0.375` (accepted within a tolerance of `0.01`, so a student's
  `0.33` matches `1/3` but `0.3` does not).
- **Percent** — `37.5%` or `37.5 percent` (the `%`/`percent` suffix is stripped,
  the number is divided by 100, then compared as a decimal within `0.01`).

The grader first tries an exact rational parse (fraction or integer) for an
exact match, then falls back to the decimal/percent tolerance path. Expected
values follow the same rules, except an EV such as `7/3` is genuinely
non-terminating: the **exact fraction** `7/3` matches exactly, and the decimal
`2.33` matches via the `0.01` tolerance — the spec deliberately accepts both
rather than dictating a rounding rule, so a student who reasons in fractions and
one who reasons in decimals are both graded correct. `expectUniqueSolution:
true` (uniqueness is over the normalised numeric value).

### Interactive UI
- **Theme:** Deep plum/violet "game-show" background with warm gold accents,
  distinct from Angle Chase Studio's indigo blueprint and Counting Lab's teal
  lab. Spinners drawn as SVG pie charts, dice as pip squares, urns as a jar of
  coloured circles, cards as small rounded rectangles.
- **Rendering:** A generic SVG (spinner/dice/cards) or DOM (urn) diagram is
  built client-side from `puzzle.data.diagram`; favourable atoms glow gold while
  the rest are dimmed, so the "favourable out of total" ratio is visible before
  any arithmetic. One renderer per `kind`.
- **Interaction:** The player reads the diagram and types the answer into the
  existing generic answer field, then presses Submit (or Enter) — matching the
  platform's standard "diagram + entry" pattern (Angle Chase Studio, Counting
  Lab) rather than introducing a new widget. An optional affordance lets the
  player click atoms to tally them; the count is a scratch aid only and is not
  the submitted answer.
- **Legend:** A caption under the diagram states the accepted answer forms
  ("answer as a fraction, decimal, or percent") and, for EV puzzles, that the
  answer is the average payoff per play.
- **Auto-advance:** On a correct answer the standard reinforcement message plays
  and the set advances, consistent with every other game type.

### Skill Tags
`probability`, `sample_space`, `favourable_outcomes`, `equally_likely`,
`complementary_events`, `compound_events`, `independent_events`,
`mutually_exclusive`, `expected_value`, `fractions`, `ratio`

### Hints
The hint ladder is generated directly from the puzzle's recorded principle
family and deduction chain rather than being hand-written per puzzle:
1. **Nudge** — a principle-specific framing question ("how many equally-likely
   outcomes are there in total?"; for compound events "do both things have to
   happen, or just one?"; for EV "what does each outcome win or lose, and how
   likely is each?") without doing arithmetic.
2. **Strategy** — walks through every step except the last, with the real
   numbers substituted in (e.g. "there are 36 equally-likely rolls, and 6 of
   them sum to 7").
3. **Near-solution** — states the final step and the resulting value explicitly
   (e.g. "so P = 6/36 = 1/6 ≈ 0.17").

---

## 12. Coordinate Quest 2D

**Status:** Designed (not yet implemented).

**Source inspiration:** The coordinate-geometry gap named in `docs/GAME_TYPES.md`
("Coordinate plane reasoning (slope, distance formula intuition,
transformations)" under Content Not Yet Covered) and `docs/ROADMAP.md`. Reuses
the platform's diagram-plus-answer pattern, adding a click-to-plot interaction
mode for tasks whose natural answer is a location on the grid.

### Concept
A Cartesian grid with labelled, scaled axes is drawn. Depending on the task
family, the player either **reads** information off the grid (name a marked
point's coordinates, find a midpoint, a distance, or a slope) or **acts** on the
grid (plot a point at named coordinates, or apply a transformation to a shape
and place/report the image). Difficulty scales smoothly from "plot (3, 4) in the
first quadrant" up to "reflect this triangle over the line y = x and give the
image coordinates". Because the answer type varies by task family, the spec
pins down exactly what the grader accepts for each.

### Rules
1. All source points have **integer** coordinates within the grid's range;
   generation additionally guarantees the *expected answer* is clean for its
   task (integer or half-integer midpoints, integer or 2-decimal distances,
   rational slopes — see Generation Algorithm).
2. The task types are: **read-coordinates**, **plot-point**, **midpoint**,
   **distance**, **slope**, **transform-point**, and **transform-polygon**
   (translation, reflection over an axis or `y = x`, and rotation of 90/180/270°
   about the origin).
3. Answers are submitted per task type (see Answer Format): a coordinate pair, a
   number, a slope value (including the "undefined" vertical case), or — for a
   transformed polygon — the set of image vertices.
4. Single-answer tasks set `expectUniqueSolution: true`. The
   `transform-polygon` task is also uniquely determined *as a set* of vertices,
   and is graded by set equality (see Answer Format) so vertex order is not
   penalised.
5. Grid orientation is standard: x increases right, y increases up; the origin
   and axis ticks are always drawn and labelled.

### Difficulty Scaling

| Difficulty | Grade | Task Family (2 variants per tier, chosen at random) | Grid Range | Notes |
|------------|-------|------------------------------------------------------|------------|-------|
| 1          | 5     | Read the coordinates of one marked point; plot one named point — both first-quadrant only | `0..10` | Positive integers only; introduces (x, y) order |
| 2          | 5-6   | Read / plot a point in any of the four quadrants (negatives), incl. points on an axis | `-6..6` | Signed coordinates; axis points test the "0" coordinate |
| 3          | 6-7   | Midpoint of two points; distance along a horizontal or vertical segment | `-8..8` | Midpoint may be a half-integer; distance is a simple count |
| 4          | 7     | Distance via a right triangle (Pythagorean, integer result, e.g. 3-4-5); reflect a single point over the x- or y-axis | `-10..10` | First diagonal distance; first transformation (sign flip) |
| 5          | 7-8   | Slope between two lattice points; translate a triangle by a vector; reflect a triangle over an axis | `-10..10` | Slope as rise/run; first multi-vertex transform |
| 6          | 8-9   | Rotate a triangle 90/180/270° about the origin; reflect a triangle over `y = x`; distance with a non-integer (irrational) result reported to 2 dp | `-10..10` | Hardest transforms; first deliberately non-integer distance |

### Generation Algorithm
1. Pick one of the two task-family templates for the requested difficulty and
   flip a coin (via the seeded RNG) between the two variants.
2. Choose the grid range for the tier and sample integer source coordinates
   within it, enforcing task-specific niceness:
   - **midpoint:** pick both points with the same parity per axis when an
     integer midpoint is wanted, or allow mixed parity to produce a clean
     half-integer (`x.5`) — never worse than one decimal place.
   - **distance (d3-4):** draw the leg lengths from a small table of Pythagorean
     triples (3-4-5, 6-8-10, 5-12-13, ...) or axis-aligned segments so the
     result is a whole number.
   - **distance (d6):** allow any two points, accept an irrational result and
     store both the exact value and its 2-dp rounding.
   - **slope:** ensure `x₁ ≠ x₂` for a defined slope, or deliberately set
     `x₁ = x₂` for the "undefined" case; reduce `Δy/Δx`.
   - **transforms:** sample a small triangle (3 non-collinear lattice points)
     whose image stays inside the grid range.
3. Compute the canonical answer by direct formula:
   - midpoint `((x₁+x₂)/2, (y₁+y₂)/2)`; distance `√((Δx)²+(Δy)²)`; slope
     `Δy/Δx` (reduced fraction, or `undefined`).
   - translate by `(dx, dy)`: `(x+dx, y+dy)`. Reflect: x-axis `(x, −y)`, y-axis
     `(−x, y)`, `y = x` `(y, x)`. Rotate about origin: 90° CCW `(−y, x)`, 180°
     `(−x, −y)`, 270° CCW `(y, −x)`.
4. Record an ordered, technique-named deduction chain with the real numbers
   substituted in (e.g. "horizontal leg = |7 − 2| = 5, vertical leg =
   |6 − 2| = 4, distance = √(5² + 4²) = √41 ≈ 6.40"), stored in
   `candidate.data.chain` and reused verbatim by `buildHints()`.
5. Build a generic diagram payload: `{ range, axisLabels, points[], segments[],
   polygons[], clickable }`, where each `point`/`polygon` carries a label,
   colour, and role (`given` vs `target`), and `clickable` flags plot/transform
   tasks where the player places markers. One generic SVG renderer covers all
   task families.
6. Because every configuration is range-constructed to be valid, `generate()`
   never throws; a `selfCheck` boolean re-verifies the answer a second way
   (e.g. a transform's image is re-derived by matrix application and compared to
   the formula result; a midpoint is re-checked as `p₁ + ½(p₂ − p₁)`).
7. `validatePuzzle()` re-derives the answer from the raw point coordinates using
   generic geometry independent of the template code, checks every drawn point
   lies within `range`, the reasoning chain is non-empty, and `selfCheck`
   passed.

### Answer Format
The accepted form depends on task type; the grader dispatches on
`candidate.data.taskType`:
- **read-coordinates / plot-point / midpoint / transform-point:** a coordinate
  pair. The grader strips spaces and optional parentheses, so `(3,4)`, `3,4`,
  and `(3, 4)` all match; components are compared numerically (half-integers
  like `2.5` allowed for midpoints).
- **distance:** a number. Accepted as an exact integer (d3-4), or as a decimal
  within a tolerance of `0.01` (d6, where the true value is irrational and the
  expected form is 2-dp). Because a general distance is irrational, the spec
  fixes the accepted form as the 2-dp decimal rather than requiring students to
  type a radical; a reduced-radical parser (`√41`, `sqrt(41)`) is an optional
  bonus, not required for a correct grade.
- **slope:** a value accepted as a reduced or unreduced fraction (`3/2`, `6/4`),
  a decimal within `0.01` (`1.5`), or an integer; the vertical case accepts
  `undefined`, `none`, or `vertical` (case-insensitive), and a horizontal line's
  slope is `0`.
- **transform-polygon:** the **set of image vertices**. Graded by set equality
  (each expected image vertex must appear once in the submission and vice
  versa), *not* as an ordered list — a polygon's image is uniquely determined as
  a set, and requiring a particular vertex order would penalise a correct answer
  written in a different order. This is the same "grade structurally, since
  multiple string forms are equally correct" reasoning Counting Lab and Angle
  Chase Studio use for their single answers, applied to a set-valued answer.

`expectUniqueSolution: true` for all task types (the polygon image is unique as
a set).

### Interactive UI
- **Theme:** Slate graph-paper background with a lime/green "cartographer quest"
  accent; axes and gridlines in muted slate, marked points as small flag/star
  glyphs, target points/shapes glowing green. Distinct from the indigo, teal,
  and plum themes of the other three most recent games.
- **Rendering:** One generic SVG grid renderer draws axes, ticks, gridlines, and
  every `point`/`segment`/`polygon` from `puzzle.data.diagram`, colour-coded by
  `given` vs `target` role.
- **Interaction (two modes):**
  - *Read / compute tasks* (read-coordinates, midpoint, distance, slope): the
    player types the answer into the existing generic answer field.
  - *Place tasks* (plot-point, transform-point, transform-polygon): the grid is
    clickable; clicking snaps a marker to the nearest lattice intersection. For
    a polygon transform the player places one marker per image vertex; markers
    can be dragged or cleared. The placed lattice coordinates become the
    submitted answer, so the same grader path is used whether the player clicked
    or typed.
- **Feedback:** Hovering a lattice point shows its coordinates as a tooltip
  (a "reading ruler"), helping students connect a location to its (x, y) label.
- **Auto-submit:** Plot tasks auto-check once the required number of markers is
  placed; typed tasks submit on Enter — consistent with the platform default.

### Skill Tags
`coordinate_geometry`, `cartesian_plane`, `plotting_points`,
`reading_coordinates`, `quadrants`, `midpoint`, `distance_formula`, `slope`,
`transformations`, `translation`, `reflection`, `rotation`,
`pythagorean_theorem`

### Hints
The hint ladder is generated directly from the puzzle's recorded technique and
deduction chain rather than being hand-written per puzzle:
1. **Nudge** — names the technique without arithmetic ("count how far apart the
   points are horizontally and vertically, then think of a right triangle"; for
   a reflection "how does reflecting over the y-axis change the sign of each
   coordinate?").
2. **Strategy** — walks through every step except the last with real numbers
   (e.g. "horizontal leg = 5, vertical leg = 4").
3. **Near-solution** — states the final step and the answer explicitly (e.g.
   "distance = √(25 + 16) = √41 ≈ 6.40", or "so the image of A(2, 3) is
   A′(3, 2)").

---

## 13. Graph Trails

**Status:** Designed (not yet implemented).

**Source inspiration:** The discrete-math / graph-theory gap in
`docs/GAME_TYPES.md` ("Intro graph theory (paths, cycles, parity)" in the
grades 6-8 competition-prep list; "Graph theory/discrete math" in the
gap-driven list) and `docs/ROADMAP.md`. This is the classic "can you draw it
without lifting your pen / without repeating an edge?" family (Euler paths and
circuits) plus an introduction to proper graph colouring.

### Concept
A node-and-edge graph is drawn (nodes as labelled circles, edges as lines).
Depending on the task family the player answers a **structural question** about
the graph (a vertex's degree, how many odd-degree vertices there are, whether an
Euler trail/circuit exists, the fewest colours needed) or **acts on the graph**
(trace an Euler trail edge by edge, or properly colour the nodes). The unifying
idea is parity and reachability: an Euler trail exists iff the graph is
connected and has exactly 0 or 2 odd-degree vertices, and that odd-vertex count
is something a kid can literally tally on the drawing.

### Rules
1. Graphs are simple (no self-loops; at most one edge between a pair of nodes),
   undirected, and — for every task that needs it — connected. Each node has a
   fixed 2D layout position for rendering.
2. Task families: **degree** (report a named vertex's degree), **odd-count**
   (how many vertices have odd degree), **euler-decision** (does an Euler
   trail/circuit exist, and which — answered yes/no plus, at higher tiers, a
   short "path" vs "circuit" choice), **euler-trace** (interactively draw an
   Euler trail), **chromatic-number** (fewest colours for a proper colouring),
   and **proper-colouring** (interactively colour the nodes).
3. **Uniqueness differs by family and is stated per task:**
   - **degree, odd-count, euler-decision, chromatic-number** have a single
     correct value -> `expectUniqueSolution: true`.
   - **euler-trace** and **proper-colouring** have *many* valid solutions, so
     they are graded **structurally** (the submission is checked against the
     defining properties, not against one canonical answer) and set
     `expectUniqueSolution: false`. This is the deliberate design choice: a
     graph colouring or an Euler trail has no canonical form, so grading the
     properties is both correct and fair. The uniquely-determined *numeric*
     companions (chromatic number, odd-vertex count) are the unique-answer
     variants that live in the same game.
4. Interactive tasks are always generated to be feasible (an Euler trail exists;
   a proper colouring within the stated colour budget exists), verified by the
   solver before serving.

### Difficulty Scaling

| Difficulty | Grade | Task Family (2 variants per tier, chosen at random) | Graph Size | Notes |
|------------|-------|------------------------------------------------------|------------|-------|
| 1          | 6     | Degree of a named vertex; is there a path between two named vertices (connectivity yes/no) | 4-5 nodes | Vocabulary: vertex, edge, degree, connected |
| 2          | 6-7   | Count the odd-degree vertices (numeric); degree of a vertex on a denser graph | 5-6 nodes | Parity tally, the key Euler prerequisite |
| 3          | 7     | Euler decision (yes/no): does a trail exist without repeating an edge; classic shapes (house, envelope) | 5-7 nodes | Applies the 0-or-2-odd-vertices rule |
| 4          | 7-8   | Euler-trace: draw a full Euler trail (graph guaranteed to have one) | 6-8 nodes | First interactive tracing; structural grading |
| 5          | 8-9   | Chromatic number (numeric, answer 2 or 3); proper 2-colouring of a bipartite graph (interactive) | 6-8 nodes | Introduces colouring; bipartite = 2-colourable |
| 6          | 9-10  | Proper colouring with the fewest colours (interactive, answer needs 3); Euler decision distinguishing path vs circuit | 7-9 nodes | Hardest: 3-colouring and the trail-vs-circuit distinction |

### Generation Algorithm
1. Pick one of the two task-family templates for the requested difficulty and
   flip a coin (via the seeded RNG) between the two variants.
2. Build a connected simple graph: place `N` nodes on a circle or small grid for
   a clean layout, then add edges. Guarantee connectivity with a union-find
   spanning tree first, then add extra random edges up to a tier-dependent
   density. Store node positions for rendering.
3. Shape the graph to the task:
   - **euler-decision (yes case) / euler-trace:** adjust edges until the
     odd-degree count is exactly 0 (circuit) or 2 (open trail) — e.g. pair up
     surplus odd vertices by toggling an edge between them — while keeping the
     graph connected. For the "no" case, target 4+ odd vertices.
   - **chromatic-number / proper-colouring:** to force chromatic number 2,
     generate a bipartite graph (2-colour the layout, only add edges across the
     partition). To force 3, additionally plant an odd cycle (which is not
     2-colourable) and keep the graph small enough that 3 colours still suffice.
   - **degree / odd-count / connectivity:** any connected graph of the tier's
     size; pick the queried vertex or vertex pair.
4. Solve for the canonical value/solution:
   - degree and odd-count: direct from the degree sequence.
   - euler-decision: connected AND `oddCount ∈ {0, 2}`; classify as circuit
     (0 odd), open trail (2 odd), or none.
   - euler-trace canonical trail: **Hierholzer's algorithm** returns one valid
     Euler trail (used for the near-solution hint and the grader-consistency
     check).
   - chromatic number: since graphs are small (≤ 9 nodes), compute exactly by
     trying `k = 1, 2, 3, …` and testing k-colourability with a backtracking
     search; the first feasible `k` is the answer.
   - proper-colouring canonical: the backtracking search returns one valid
     colouring within the budget.
5. Record an ordered, principle-named deduction chain with real numbers
   substituted in (e.g. "3 vertices have odd degree (B, D, E); an Euler trail
   needs 0 or 2 odd vertices; 3 is neither, so it cannot be drawn without
   repeating an edge"), stored in `candidate.data.chain` and reused verbatim by
   `buildHints()`.
6. Build a generic diagram payload: `{ nodes: [{id, label, x, y}], edges:
   [{a, b}], taskType, palette? }`, plus `query` fields (the named vertex/pair
   for degree/connectivity, the colour budget for colouring). One generic SVG
   renderer draws nodes and edges for every family; colouring tasks additionally
   render the `palette`.
7. Small graph sizes keep the backtracking colour search and the Euler
   construction cheap, so `generate()` retries only on the rare degenerate draw
   (e.g. an accidentally disconnected graph) — bounded like Angle Chase Studio's
   retry loop — and falls back to a hand-checked graph for the tier if retries
   are exhausted, so it never throws.
8. `validatePuzzle()` recomputes the degree sequence, connectivity (BFS/DFS),
   odd-vertex count, and — for colouring — re-runs the exact chromatic-number
   search from the raw `nodes`/`edges`, independent of the template code; it
   confirms interactive tasks are actually feasible (Hierholzer succeeds; a
   colouring within budget exists), the reasoning chain is non-empty, and the
   canonical solution passes `gradeAnswer()` (the gate's grader-consistency
   check).

### Answer Format
The grader dispatches on `candidate.data.taskType`:
- **degree / odd-count / chromatic-number:** a single non-negative integer
  (whitespace stripped, exact match).
- **euler-decision / connectivity:** a yes/no token — `yes`/`no`, `y`/`n`,
  `true`/`false` (case-insensitive). The path-vs-circuit variant (d6) accepts a
  second token, `path` or `circuit`, graded against the classification.
- **euler-trace:** an ordered list of vertex labels forming the walk (e.g.
  `A-B-C-A-D`, hyphen- or comma-separated). Graded **structurally**: (a) each
  consecutive pair is joined by an edge that exists, (b) every edge of the graph
  is used exactly once, and (c) no edge is reused — i.e. it is a valid Euler
  trail. Any trail satisfying these passes; there is no canonical target.
- **proper-colouring:** a map from vertex label to colour (e.g.
  `A:1,B:2,C:1,…`, or the colour indices the UI produced). Graded
  **structurally**: (a) every vertex is coloured, (b) no edge joins two
  same-coloured vertices (proper), and (c) the number of distinct colours used
  is ≤ the stated budget `k`. Any colouring meeting these passes.

For the two structurally-graded families `expectUniqueSolution: false`; all
others `true`. The reasoning (stated in Rules) is that trails and colourings are
inherently non-canonical, so grading their defining properties is both correct
and fair, while the numeric companions keep a unique-answer path in the same
game.

### Interactive UI
- **Theme:** Midnight-navy "constellation / circuit-board" background with cyan
  nodes and magenta accents, glowing edges — distinct from the indigo, teal,
  plum, and slate-green themes of the other recent games.
- **Rendering:** One generic SVG renderer draws nodes (labelled circles) and
  edges (lines) from `puzzle.data.diagram`; colouring tasks render a small
  colour palette beside the graph.
- **Interaction (by family):**
  - *degree / odd-count / chromatic-number:* type the integer.
  - *euler-decision / connectivity:* Yes/No buttons (plus Path/Circuit buttons
    on the d6 variant).
  - *euler-trace:* the player clicks nodes in sequence (or clicks edges); each
    traversed edge highlights green and is "consumed", and the running walk is
    shown; an undo/clear control backs out mistakes. The completed walk is the
    submitted answer.
  - *proper-colouring:* click a node, then click a palette colour to fill it; an
    edge flashes red whenever its two endpoints share a colour, giving immediate
    "is this proper?" feedback, and a live counter shows colours used vs the
    budget.
- **Feedback:** edges consumed by an Euler trace turn green; colour conflicts
  flash red; a structural check runs continuously so the player sees progress.
- **Auto-submit:** euler-trace auto-checks when every edge has been used;
  proper-colouring auto-checks when all nodes are coloured with no conflicts;
  numeric/decision tasks submit on Enter or button press.

### Skill Tags
`graph_theory`, `discrete_math`, `vertices_edges`, `degree`, `parity`,
`connectivity`, `euler_path`, `euler_circuit`, `cycles`, `graph_coloring`,
`chromatic_number`, `bipartite`

### Hints
The hint ladder is generated directly from the puzzle's recorded principle
family and deduction chain rather than being hand-written per puzzle:
1. **Nudge** — names the relevant idea without arithmetic ("count how many edges
   meet at each vertex — an Euler trail cares about which counts are odd"; for
   colouring "look for a group of nodes that are all connected to each other —
   they all need different colours").
2. **Strategy** — walks through every step except the last with real numbers
   (e.g. "vertices B, D, and E each have odd degree, so there are 3 odd
   vertices").
3. **Near-solution** — states the final step and the answer explicitly (e.g.
   "an Euler trail needs 0 or 2 odd vertices, and 3 is neither, so the answer is
   no"; or reveals the first few edges of a valid Hierholzer trail).

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
2. ~~**Counting Lab** (counting principles/combinatorics anchor)~~ — implemented, see section 9 above.
3. ~~**Proof Blocks** (argument structure and proof-writing anchor)~~ — implemented, see section 10 above.
4. ~~**Chance Builder** (probability and expected value)~~ — spec written, see section 11 above.
5. ~~**Coordinate Quest 2D** (slope/distance/transformations)~~ — spec written, see section 12 above.
6. ~~**Graph Trails** (paths, cycles, parity, coloring)~~ — spec written, see section 13 above.

## Shared Implementation Notes

- All games use the standard `GameTypePlugin` interface (generate, solve,
  validatePuzzle, gradeAnswer, buildHints).
- All use seeded RNG for reproducibility.
- All pass through the validation gate before serving.
- Each game gets a themed zone div in `index.html`, themed CSS, and a render
  function dispatched from `renderPuzzle()` in `app.js`.
- Auto-submit on completion is the standard pattern — minimize explicit "submit"
  button clicks for a smoother play experience.
