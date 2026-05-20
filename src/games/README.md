# Game Plugins

Each folder in `src/games/` contains a `plugin.ts` file exporting one `GameTypePlugin`.

See `docs/ADDING_GAME_TYPES.md` for the full guide on creating new plugins.

## Implemented Plugins

| Folder          | Plugin ID              | Grades | Description                            |
|-----------------|------------------------|--------|----------------------------------------|
| `patternTrain`  | `pattern-train`        | 1-3    | Number pattern completion              |
| `mismo`         | `mismo`                | 1-6    | Expression equivalence matching        |
| `xOuts`         | `x-outs`               | 2-5    | Cross-out grid with row/column targets |
| `shikaku`       | `shikaku`              | 3-7    | Rectangle area partition puzzle        |
| `kenken`        | `kenken`               | 1-8    | Latin square with arithmetic cages     |
| `factorNinja`   | `factor-ninja`         | 4-8    | Prime factors, GCF, LCM               |
| `balanceScale`  | `balance-scale`        | 4-8    | Equation solving (find x)              |
| `numberBonds`   | `number-bonds-sprint`  | 1-2    | Missing addend (pending removal)       |
| `numberPaths`   | `number-paths`         | 1-2    | Trace consecutive number paths          |
