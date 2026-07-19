# Product Design (v0.1)

## Goal
Build a web-based, TypeScript-first math puzzle experience for kids in grades 1-10 with:
- Name-only profile login (no password/auth provider)
- Personalized progression tracking
- Competition-style and puzzle-style math content

## Users
- Kid user: solve puzzles, earn progress, pick games
- Parent/guardian: monitor progress, assign focus areas

## Core Flows
1. Kid selects profile by name.
2. Kid chooses a game or taps recommended next challenge.
3. System serves generated puzzle with hints and feedback.
4. Attempt updates mastery and recommendation model.
5. Parent dashboard shows trends and weak areas.

## Functional Requirements
- Manage local profiles (create/select/delete)
- Serve generated puzzles by game type and grade band
- Validate answers and provide hint ladders
- Support an extensible game-type plugin model so new puzzle types can be added without changing core app logic
- Run generation-time quality checks (solvable + well-formed) before any puzzle is eligible for delivery
- Track attempts, time, hint use, and accuracy
- Compute mastery per game/skill tag
- Parent view of progress and assignments

## Non-Functional Requirements
- Fast UI response and puzzle generation
- Simple deployment path (local first, cloud optional)
- Accessibility for younger learners
- Safe-by-design, no open chat or external community features
- Never serve unchecked content: puzzle delivery must be gated on successful validation

## Scope
In scope:
- Single household/classroom deployment
- Game types: 13 implemented (including Number Bonds Sprint, whose removal is now
  outstanding — see `docs/GAME_TYPES.md`) plus 8 designed but not yet implemented
  (3 newly-spec'd: Chance Builder, Coordinate Quest 2D, Graph Trails; and 5 older:
  Sum Blobs, Honeycomb Paths, Subtractiles, Measure Mazes, Equation Paths)
- Adaptive difficulty
- Metagame incentives and cosmetic rewards (designed, not yet implemented)
- Coverage expansion plan for advanced strands:
  - Extend existing/planned games first (algebra/ratio/logic/measurement variants)
  - Add new anchors for gaps (geometry proof, combinatorics, proof-writing)

Out of scope (phase 1):
- Secure authentication
- Live multiplayer
- AI-graded long free response
