import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GameTypeRegistry } from "./core/registry.ts";
import { generateCheckedPuzzle } from "./core/validation-gate.ts";
import type { GradeBand } from "./core/types.ts";
import { numberBondsPlugin } from "./games/numberBonds/plugin.ts";
import { factorNinjaPlugin } from "./games/factorNinja/plugin.ts";
import { patternTrainPlugin } from "./games/patternTrain/plugin.ts";
import { mismoPlugin } from "./games/mismo/plugin.ts";
import { xOutsPlugin } from "./games/xOuts/plugin.ts";
import { kenkenPlugin } from "./games/kenken/plugin.ts";
import { balanceScalePlugin } from "./games/balanceScale/plugin.ts";
import { shikakuPlugin } from "./games/shikaku/plugin.ts";
import { numberPathsPlugin } from "./games/numberPaths/plugin.ts";
import { storyLogicGridsPlugin } from "./games/storyLogicGrids/plugin.ts";
import { ProfileStore } from "./services/profile-store.ts";
import { ProgressStore } from "./services/progress-store.ts";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = join(__filename, "..", "..");
const publicDir = join(projectRoot, "public");
const profileStore = new ProfileStore();
const progressStore = new ProgressStore();

const registry = new GameTypeRegistry();
registry.register(numberBondsPlugin);
registry.register(patternTrainPlugin);
registry.register(factorNinjaPlugin);
registry.register(mismoPlugin);
registry.register(xOutsPlugin);
registry.register(kenkenPlugin);
registry.register(balanceScalePlugin);
registry.register(shikakuPlugin);
registry.register(numberPathsPlugin);
registry.register(storyLogicGridsPlugin);

const gradeBands: GradeBand[] = ["1-2", "2-3", "3-4", "4-6", "6-8", "8-10"];

function latencyBandForTimeMs(timeMs: number): "fast" | "on_time" | "slow" | "unknown" {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return "unknown";
  if (timeMs <= 15_000) return "fast";
  if (timeMs <= 45_000) return "on_time";
  return "slow";
}

function successScoreForAttempt(isCorrect: boolean, hintsUsed: number, latencyBand: string): number {
  let score = isCorrect ? 1 : 0;
  if (hintsUsed > 0) score -= Math.min(0.3, hintsUsed * 0.08);
  if (isCorrect && latencyBand === "fast") score += 0.05;
  if (isCorrect && latencyBand === "slow") score -= 0.05;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function serveStatic(pathname: string, res: ServerResponse): boolean {
  const cleaned = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(publicDir, cleaned);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) return false;

  const ext = extname(filePath);
  const contentType =
    ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".svg"
          ? "image/svg+xml"
          : "application/javascript; charset=utf-8";

  res.writeHead(200, { "Content-Type": contentType });
  res.end(readFileSync(filePath));
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      if (method === "GET" && pathname === "/api/games") {
        return sendJson(
          res,
          200,
          registry.list().map((g) => ({
            id: g.id,
            name: g.name,
            minGrade: g.minGrade,
            maxGrade: g.maxGrade,
            description: g.description
          }))
        );
      }

      if (method === "POST" && pathname === "/api/profiles/login") {
        const body = await readBody(req);
        const name = String(body.name ?? "").trim();
        const gradeBand = String(body.gradeBand ?? "1-2") as GradeBand;
        if (!gradeBands.includes(gradeBand)) {
          return sendJson(res, 400, { error: "Invalid gradeBand." });
        }
        const profile = await profileStore.login(name, gradeBand);
        return sendJson(res, 200, { profile });
      }

      if (method === "GET" && pathname === "/api/progress") {
        const profileId = String(url.searchParams.get("profileId") ?? "");
        if (!profileId) return sendJson(res, 400, { error: "profileId is required." });
        return sendJson(res, 200, await progressStore.getProfileSummary(profileId));
      }

      if (method === "POST" && pathname === "/api/puzzles/next") {
        const body = await readBody(req);
        const gameTypeId = String(body.gameTypeId ?? "");
        const profileId = String(body.profileId ?? "");
        const difficulty = Number(body.difficulty ?? 1);
        const setSizeRaw = Number(body.setSize ?? 1);
        const setSize = Number.isInteger(setSizeRaw)
          ? Math.min(12, Math.max(1, setSizeRaw))
          : 1;
        const profile = await profileStore.get(profileId);
        if (!profile) return sendJson(res, 404, { error: "Profile not found." });
        const plugin = registry.get(gameTypeId);
        const normalizedDifficulty =
          Number.isFinite(difficulty) && difficulty > 0 ? difficulty : 1;
        const isMismo = gameTypeId === "mismo";
        const isXOuts = gameTypeId === "x-outs";
        const pairCount = isMismo
          ? (Number.isInteger(setSizeRaw) ? Math.min(12, Math.max(4, setSizeRaw)) : 5)
          : undefined;
        const boardCount = (isMismo || isXOuts) ? 1 : setSize;
        const puzzles = [];
        const seenKeys = new Set<string>();

        for (let i = 0; i < boardCount; i += 1) {
          // Retry with different seeds until we get a unique puzzle
          let attempts = 0;
          while (attempts < 50) {
            const { candidate, canonicalSolutions } = generateCheckedPuzzle(plugin, {
              gradeBand: profile.gradeBand,
              difficulty: normalizedDifficulty,
              pairCount
            });

            // Build a dedup key from the puzzle's core data
            const key = JSON.stringify(candidate.data);
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              puzzles.push({
                puzzle: candidate,
                hintPreview: plugin.buildHints(candidate)[0],
                canonicalSolutionsCount: canonicalSolutions.length
              });
              break;
            }
            attempts += 1;
          }
        }

        return sendJson(res, 200, {
          puzzleSet: puzzles,
          setSize: boardCount,
          pairCount,
          difficulty: normalizedDifficulty,
          gameTypeId
        });
      }

      if (method === "POST" && pathname === "/api/puzzles/hints") {
        const body = await readBody(req);
        const puzzle = body.puzzle as Record<string, unknown>;
        const gameTypeId = String(puzzle?.gameTypeId ?? "");
        const plugin = registry.get(gameTypeId);
        return sendJson(res, 200, { hints: plugin.buildHints(puzzle as any) });
      }

      if (method === "POST" && pathname === "/api/attempts") {
        const body = await readBody(req);
        const profileId = String(body.profileId ?? "");
        const answer = String(body.answer ?? "");
        const hintsUsed = Number(body.hintsUsed ?? 0);
        const timeMs = Number(body.timeMs ?? 0);
        const puzzle = body.puzzle as Record<string, unknown>;
        const gameTypeId = String(puzzle?.gameTypeId ?? "");
        const seed = Number(puzzle?.seed ?? 0);
        const difficulty = Number(puzzle?.difficulty ?? 1);

        const profile = await profileStore.get(profileId);
        if (!profile) return sendJson(res, 404, { error: "Profile not found." });

        const plugin = registry.get(gameTypeId);
        const isCorrect = plugin.gradeAnswer(puzzle as any, answer);
        const skillTags = Array.isArray((puzzle as any)?.metadata?.skillTags)
          ? (puzzle as any).metadata.skillTags.filter((s: unknown) => typeof s === "string")
          : [];
        const latencyBand = latencyBandForTimeMs(timeMs);
        const normalizedHints = Number.isFinite(hintsUsed) ? Math.max(0, hintsUsed) : 0;
        const successScore = successScoreForAttempt(isCorrect, normalizedHints, latencyBand);
        const beforeSummary = await progressStore.getProfileSummary(profileId);
        const saved = await progressStore.recordAttempt({
          profileId,
          gameTypeId,
          puzzleSeed: seed,
          difficulty,
          answer,
          isCorrect,
          hintsUsed: normalizedHints,
          timeMs: Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0,
          usedHint: normalizedHints > 0,
          latencyBand,
          successScore,
          skillTags
        });
        const afterSummary = await progressStore.getProfileSummary(profileId);
        const beforeSkills = beforeSummary.bySkill || {};
        const afterSkills = afterSummary.bySkill || {};
        const gainedSkills = Object.keys(afterSkills)
          .map((tag) => {
            const prev = beforeSkills[tag]?.mastery ?? 0;
            const next = afterSkills[tag]?.mastery ?? 0;
            return { tag, gain: next - prev };
          })
          .filter((x) => x.gain > 0.01)
          .sort((a, b) => b.gain - a.gain)
          .slice(0, 3)
          .map((x) => `${x.tag} +${x.gain.toFixed(1)}`);

        const levelStats =
          afterSummary.byGameLevel?.[gameTypeId]?.[String(difficulty)];
        const reinforcement = {
          gainedSkills,
          levelProgress: levelStats
            ? `Level ${difficulty} mastery ${Math.round(levelStats.mastery)}%`
            : `Level ${difficulty} tracked`,
          streak:
            afterSummary.byGame?.[gameTypeId]?.streak ??
            0
        };

        return sendJson(res, 200, {
          result: {
            isCorrect,
            hints: plugin.buildHints(puzzle as any),
            reinforcement
          },
          attempt: saved,
          progress: afterSummary
        });
      }

      return sendJson(res, 404, { error: "Not found" });
    }

    if (pathname === "/health") {
      return sendJson(res, 200, { status: "ok" });
    }

    if (!serveStatic(pathname, res)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    sendJson(res, 500, { error: message });
  }
});

const port = Number(process.env.PORT ?? 5678);
server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`MathChallenge running at http://localhost:${port}\n`);
});
