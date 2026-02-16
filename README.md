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
  - One playable game: `Number Bonds Sprint`

## Run (Alpha)
1. `npm run dev`
2. Open `http://localhost:3000`

Data is stored in:
- `data/profiles.json`
- `data/progress.json`
