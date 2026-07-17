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
  - Name-based profile login + JSON-persisted progress
  - Set-level deduplication (no repeated puzzles within a set)
  - Playable games (10 implemented):
    - `Pattern Train` — interactive multiple-choice pattern puzzles
    - `Mismo` — expression-equivalence card matching
    - `X-Outs` — row/column target-sum cross-out logic grid
    - `Shikaku` — draw rectangles matching area clues on a canvas
    - `KenKen` — Latin square grid with arithmetic cage constraints
    - `Factor Ninja` — interactive prime factorisation + GCF/LCM
    - `Balance Scale` — visual equation solving (find x)
    - `Number Bonds Sprint` — missing-addend practice (pending removal)
    - `Number Paths` — trace an adjacent path through counting sequences
    - `Angle Chase Studio` — find an unknown angle in a generated diagram
      using vertical angles, angle-sum, and parallel-line theorems
  - 5 additional games designed: Sum Blobs, Honeycomb Paths, Subtractiles,
    Measure Mazes, Equation Paths

## Run (Alpha)
1. `npm run dev`
2. Open `http://localhost:5678`

The server always runs on port **5678**.

Data is stored in:
- `data/profiles.json`
- `data/progress.json`
