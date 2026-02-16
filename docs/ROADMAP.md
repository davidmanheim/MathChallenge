# Delivery Roadmap (v0.1)

## Phase 0: Design Finalization
- Confirm grade band model and progression policy
- Lock initial data schema
- Finalize first 4 game specs

Exit criteria:
- Approved docs and implementation plan

## Phase 1: MVP Platform
- App scaffold (Next.js + TypeScript + Prisma)
- Name-based profile login and session selection
- Puzzle engine base interfaces
- 4 game types implemented
- Attempt logging + basic progress dashboard

Exit criteria:
- Kids can complete sessions and progress persists

## Phase 2: Content Expansion
- Add remaining 8 game types
- Adaptive recommendation tuning
- Better hint quality and worked solutions

Exit criteria:
- Full 12-type catalog usable across grades 1-10

## Phase 3: Parent Tools + Polish
- Parent assignment controls
- Accessibility improvements
- UI/UX polish and animations

Exit criteria:
- Stable family-ready release

## Risks and Mitigations
- Risk: Difficulty curve too steep/inconsistent
  - Mitigation: telemetry-based tuning + manual overrides by grade band
- Risk: Repetitive puzzle feel
  - Mitigation: template variants and parameter diversity checks
- Risk: Progress model too noisy
  - Mitigation: rolling-window mastery with decay and min-attempt thresholds
