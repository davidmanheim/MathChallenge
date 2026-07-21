# MathChallenge

Web-accessible TypeScript math puzzle platform for kids (grades 1-10), with lightweight profile login and adaptive progress tracking.

## Docs
- Product + scope: `docs/PRODUCT.md`
- System architecture: `docs/ARCHITECTURE.md`
- Game catalog: `docs/GAME_TYPES.md`
- New game designs: `docs/NEW_GAMES_DESIGN.md`
- Delivery roadmap: `docs/ROADMAP.md`
- Framework + plugin contract: `docs/FRAMEWORK.md`
- How to add a game type: `docs/ADDING_GAME_TYPES.md`

## Current Status
- Alpha framework implemented:
  - TypeScript Node server (no build step, uses `--experimental-strip-types`)
  - Plugin-based puzzle engine with generation-time validation gate
  - Name-based profile login + Firestore-persisted progress
  - Set-level deduplication (no repeated puzzles within a set)
  - Playable games (15 implemented):
    - `Pattern Train` — interactive multiple-choice pattern puzzles
    - `Mismo` — expression-equivalence card matching
    - `X-Outs` — row/column target-sum cross-out logic grid
    - `Shikaku` — draw rectangles matching area clues on a canvas
    - `KenKen` — Latin square grid with arithmetic cage constraints
    - `Factor Ninja` — interactive prime factorisation + GCF/LCM
    - `Balance Scale` — visual equation solving (find x)
    - `Number Paths` — tap-path counting-sequence puzzles
    - `Story Logic Grids` — story-based one-to-one matching logic puzzles (20 templates)
    - `Angle Chase Studio` — find an unknown angle in a generated diagram using
      vertical angles, angle-sum, and parallel-line theorems
    - `Counting Lab` — count outcomes using the multiplication counting
      principle, permutations, combinations, restrictions, casework, and an
      intro to the pigeonhole principle
    - `Proof Blocks` — assemble a valid deductive proof by ordering statement
      blocks from givens to goal (algebra, if-then logic, parity, and geometry
      angle proofs), excluding invalid distractor blocks
    - `Potion Panic` — pour reusable fractional jugs into a cauldron until it
      holds exactly a target fraction, discovering fraction addition and
      equivalence with unlike denominators; graded structurally since multiple
      pour-sets are usually correct
    - `Chocolate Snap` — multiply fractions with an interactive area model:
      snap off a fraction of a chocolate bar, then take a fraction of that
      piece; the overlap is the answer
    - `Number Bonds Sprint` — missing-addend practice (pending removal)
  - 5 additional games designed (not yet implemented): Sum Blobs, Honeycomb Paths,
    Subtractiles, Measure Mazes, Equation Paths

## Run (Alpha)
1. `npm run dev`
2. Open `http://localhost:5678`

The server always runs on port **5678**.

Data is stored in Google Cloud Firestore (`@google-cloud/firestore`):
- `profiles` collection — player profiles
- `attempts` collection — attempt history and mastery data

(The `data/` directory and any `data/*.json` files are stale leftovers from an
earlier local-JSON prototype and are not used at runtime.)
