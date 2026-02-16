# MathChallenge

Web-accessible TypeScript math puzzle platform for kids (grades 1-10), with lightweight profile login and adaptive progress tracking.

## Docs
- Product + scope: `docs/PRODUCT.md`
- System architecture: `docs/ARCHITECTURE.md`
- Game catalog: `docs/GAME_TYPES.md`
- Delivery roadmap: `docs/ROADMAP.md`
- Framework + plugin contract: `docs/FRAMEWORK.md`
- How to add a game type: `docs/ADDING_GAME_TYPES.md`
- Original combined draft: `DESIGN.md`

## Current Status
- Alpha framework implemented:
  - TypeScript Node server
  - Plugin-based puzzle engine with validation gate
  - Name-based profile login + persisted progress
  - Playable games:
    - `Number Bonds Sprint` (set-based run, easy-level number line)
    - `Pattern Train` (interactive multiple-choice pattern puzzles)
    - `Factor Ninja` (interactive prime factors + GCF/LCM modes)
    - `Mismo` (interactive expression-equivalence card matching)
    - `X-Outs` (interactive row/column target-sum cross-out logic grid)

## Run (Alpha)
1. `npm run dev`
2. Open `http://localhost:5678`

The server always runs on port **5678**.

Data is stored in:
- `data/profiles.json`
- `data/progress.json`
