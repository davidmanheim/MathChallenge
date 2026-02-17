# Adding a New Game Type

## 1) Create a plugin file
Add `src/games/<yourGame>/plugin.ts` implementing `GameTypePlugin`.

Minimum required functions:
- `generate`
- `solve`
- `validatePuzzle`
- `gradeAnswer`
- `buildHints`

## 2) Register the plugin
In `src/server.ts`, import and register it:

```ts
import { yourPlugin } from "./games/yourGame/plugin.ts";
registry.register(yourPlugin);
```

No other core code changes are required for the backend.

For an interactive UI, also add:
- A themed `<div>` container in `public/index.html` (hidden by default)
- CSS styles in `public/styles.css`
- A render function in `public/app.js` dispatched from `renderPuzzle()`

See existing games (e.g., `kenken`, `shikaku`, `mismo`) for reference patterns.

## 3) Validation requirements (mandatory)
Your plugin must ensure:
- Candidate has all required fields and valid numeric/string bounds.
- `solve()` can always find valid solution(s).
- If puzzle is single-answer, mark `expectUniqueSolution: true` and ensure uniqueness.
- `gradeAnswer()` accepts all canonical answers and rejects invalid ones.

## 4) Recommended test checklist
- 100+ generated seeds at each difficulty produce valid puzzles.
- No empty prompt text.
- No unsolvable puzzle.
- Hints progress from nudge to explicit help.
- Answer grading handles whitespace and equivalent numeric forms.

## 5) Content quality rules
- Keep language concise for the target grade.
- Avoid trick wording that is not mathematically purposeful.
- Keep parameter ranges age-appropriate.
- Add skill tags in `metadata.skillTags` for progress analytics.
