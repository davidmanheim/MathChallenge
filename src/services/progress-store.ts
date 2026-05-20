import { randomUUID } from "node:crypto";
import type { Attempt } from "../core/types.ts";
import { readJsonFile, writeJsonFile } from "./json-store.ts";

type ProgressDb = {
  attempts: Attempt[];
};

const DEFAULT_DB: ProgressDb = { attempts: [] };

type Trend = "up" | "stable" | "down";

type AggregateStats = {
  attempts: number;
  correct: number;
  accuracy: number;
  recentAccuracy: number;
  mastery: number;
  trend: Trend;
  streak: number;
  bestStreak: number;
  avgSuccessScore: number;
};

type SkillStats = AggregateStats & {
  games: string[];
};

type MutableAggregate = {
  attempts: number;
  correct: number;
  successSum: number;
  mastery: number;
  streak: number;
  bestStreak: number;
  history: number[];
  correctnessHistory: number[];
};

type MutableSkillAggregate = MutableAggregate & {
  games: Set<string>;
};

function ensureFinite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function emptyAggregate(): MutableAggregate {
  return {
    attempts: 0,
    correct: 0,
    successSum: 0,
    mastery: 0,
    streak: 0,
    bestStreak: 0,
    history: [],
    correctnessHistory: []
  };
}

function emptySkillAggregate(): MutableSkillAggregate {
  return {
    ...emptyAggregate(),
    games: new Set<string>()
  };
}

function scoreFromAttempt(a: Attempt): number {
  if (Number.isFinite(a.successScore)) return clamp01(a.successScore);
  let score = a.isCorrect ? 1 : 0;
  if (a.hintsUsed > 0) score -= Math.min(0.3, a.hintsUsed * 0.08);
  return clamp01(score);
}

function updateAggregate(acc: MutableAggregate, attempt: Attempt): void {
  const score = scoreFromAttempt(attempt);
  acc.attempts += 1;
  if (attempt.isCorrect) {
    acc.correct += 1;
    acc.streak += 1;
    acc.bestStreak = Math.max(acc.bestStreak, acc.streak);
  } else {
    acc.streak = 0;
  }
  acc.successSum += score;
  acc.mastery = acc.attempts === 1 ? score * 100 : acc.mastery * 0.85 + score * 15;
  acc.history.push(score);
  acc.correctnessHistory.push(attempt.isCorrect ? 1 : 0);
}

function recentAvg(history: number[], n = 10): number {
  if (history.length === 0) return 0;
  const slice = history.slice(-Math.max(1, n));
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function trendFromHistory(history: number[]): Trend {
  if (history.length < 6) return "stable";
  const window = Math.min(10, Math.floor(history.length / 2));
  if (window < 3) return "stable";
  const recent = history.slice(-window);
  const previous = history.slice(-(window * 2), -window);
  if (previous.length === 0) return "stable";
  const avgRecent = recentAvg(recent, recent.length);
  const avgPrev = recentAvg(previous, previous.length);
  const delta = avgRecent - avgPrev;
  if (delta > 0.05) return "up";
  if (delta < -0.05) return "down";
  return "stable";
}

function finalizeAggregate(acc: MutableAggregate): AggregateStats {
  const attempts = acc.attempts;
  const correct = acc.correct;
  const accuracy = attempts > 0 ? correct / attempts : 0;
  const recentAccuracy = recentAvg(acc.correctnessHistory, 10);
  return {
    attempts,
    correct,
    accuracy,
    recentAccuracy,
    mastery: Number(acc.mastery.toFixed(2)),
    trend: trendFromHistory(acc.history),
    streak: acc.streak,
    bestStreak: acc.bestStreak,
    avgSuccessScore: attempts > 0 ? Number((acc.successSum / attempts).toFixed(3)) : 0
  };
}

export class ProgressStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  recordAttempt(
    attempt: Omit<Attempt, "id" | "submittedAt">
  ): Attempt {
    const db = readJsonFile<ProgressDb>(this.filePath, DEFAULT_DB);
    const saved: Attempt = {
      ...attempt,
      id: randomUUID(),
      submittedAt: new Date().toISOString()
    };
    db.attempts.push(saved);
    writeJsonFile(this.filePath, db);
    return saved;
  }

  getProfileSummary(profileId: string): {
    overview: {
      totalAttempts: number;
      correctAttempts: number;
      accuracy: number;
      avgSuccessScore: number;
      bestStreak: number;
    };
    byGame: Record<string, AggregateStats>;
    byGameLevel: Record<string, Record<string, AggregateStats>>;
    bySkill: Record<string, SkillStats>;
    skillByGame: Record<string, Record<string, AggregateStats>>;
    skillHighlights: {
      topGains: string[];
      needsWork: string[];
      readyToLevel: string[];
    };
    recommendations: {
      focusSkills: string[];
      confidenceSkills: string[];
      stretchSkills: string[];
      message: string;
    };
  } {
    const db = readJsonFile<ProgressDb>(this.filePath, DEFAULT_DB);
    const attempts = db.attempts
      .filter((a) => a.profileId === profileId)
      .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));

    const byGameRaw: Record<string, MutableAggregate> = {};
    const byGameLevelRaw: Record<string, Record<string, MutableAggregate>> = {};
    const bySkillRaw: Record<string, MutableSkillAggregate> = {};
    const skillByGameRaw: Record<string, Record<string, MutableAggregate>> = {};

    for (const a of attempts) {
      const game = a.gameTypeId;
      const level = String(a.difficulty);
      const tags = Array.isArray(a.skillTags) && a.skillTags.length > 0 ? a.skillTags : ["general_math"];

      if (!byGameRaw[game]) byGameRaw[game] = emptyAggregate();
      updateAggregate(byGameRaw[game], a);

      if (!byGameLevelRaw[game]) byGameLevelRaw[game] = {};
      if (!byGameLevelRaw[game][level]) byGameLevelRaw[game][level] = emptyAggregate();
      updateAggregate(byGameLevelRaw[game][level], a);

      if (!skillByGameRaw[game]) skillByGameRaw[game] = {};
      for (const tag of tags) {
        if (!bySkillRaw[tag]) bySkillRaw[tag] = emptySkillAggregate();
        updateAggregate(bySkillRaw[tag], a);
        bySkillRaw[tag].games.add(game);

        if (!skillByGameRaw[game][tag]) skillByGameRaw[game][tag] = emptyAggregate();
        updateAggregate(skillByGameRaw[game][tag], a);
      }
    }

    const correctAttempts = attempts.reduce((sum, a) => sum + (a.isCorrect ? 1 : 0), 0);
    const totalAttempts = attempts.length;
    const accuracy = totalAttempts === 0 ? 0 : correctAttempts / totalAttempts;

    const byGame: Record<string, AggregateStats> = {};
    for (const game of Object.keys(byGameRaw)) {
      byGame[game] = finalizeAggregate(byGameRaw[game]);
    }

    const byGameLevel: Record<string, Record<string, AggregateStats>> = {};
    for (const game of Object.keys(byGameLevelRaw)) {
      byGameLevel[game] = {};
      for (const level of Object.keys(byGameLevelRaw[game])) {
        byGameLevel[game][level] = finalizeAggregate(byGameLevelRaw[game][level]);
      }
    }

    const bySkill: Record<string, SkillStats> = {};
    for (const tag of Object.keys(bySkillRaw)) {
      const finalized = finalizeAggregate(bySkillRaw[tag]);
      bySkill[tag] = {
        ...finalized,
        games: [...bySkillRaw[tag].games].sort()
      };
    }

    const skillByGame: Record<string, Record<string, AggregateStats>> = {};
    for (const game of Object.keys(skillByGameRaw)) {
      skillByGame[game] = {};
      for (const tag of Object.keys(skillByGameRaw[game])) {
        skillByGame[game][tag] = finalizeAggregate(skillByGameRaw[game][tag]);
      }
    }

    const skillEntries = Object.entries(bySkill);
    const topGains = skillEntries
      .filter(([, s]) => s.trend === "up")
      .sort((a, b) => b[1].mastery - a[1].mastery)
      .slice(0, 3)
      .map(([tag, s]) => `${tag} trending up (${Math.round(s.mastery)} mastery)`);

    const needsWork = skillEntries
      .filter(([, s]) => s.attempts >= 3)
      .sort((a, b) => a[1].mastery - b[1].mastery)
      .slice(0, 3)
      .map(([tag, s]) => `${tag} needs reinforcement (${Math.round(s.mastery)} mastery)`);

    const readyToLevel = skillEntries
      .filter(([, s]) => s.attempts >= 5 && s.mastery >= 75 && s.recentAccuracy >= 0.8)
      .sort((a, b) => b[1].mastery - a[1].mastery)
      .slice(0, 3)
      .map(([tag]) => tag);

    const focusSkills = skillEntries
      .filter(([, s]) => s.attempts >= 3 && s.mastery >= 55 && s.mastery < 75)
      .sort((a, b) => b[1].mastery - a[1].mastery)
      .slice(0, 3)
      .map(([tag]) => tag);

    const confidenceSkills = skillEntries
      .filter(([, s]) => s.mastery >= 75)
      .sort((a, b) => b[1].mastery - a[1].mastery)
      .slice(0, 3)
      .map(([tag]) => tag);

    const stretchSkills = skillEntries
      .filter(([, s]) => s.attempts >= 3 && s.mastery < 55)
      .sort((a, b) => a[1].mastery - b[1].mastery)
      .slice(0, 3)
      .map(([tag]) => tag);

    const recommendations = {
      focusSkills,
      confidenceSkills,
      stretchSkills,
      message:
        focusSkills.length > 0
          ? `Focus next on: ${focusSkills.join(", ")}. Keep confidence with ${confidenceSkills[0] ?? "a strong skill"}.`
          : confidenceSkills.length > 0
            ? `Great momentum. Keep sharpening ${confidenceSkills[0]} and stretch into ${stretchSkills[0] ?? "new challenges"}.`
            : "Start with confidence builders and collect a few wins to set baseline mastery."
    };

    const bestStreak = Object.values(byGame).reduce((best, s) => Math.max(best, s.bestStreak), 0);
    const avgSuccessScore = totalAttempts === 0
      ? 0
      : Number(
        (
          attempts.reduce((sum, a) => sum + scoreFromAttempt(a), 0) /
          totalAttempts
        ).toFixed(3)
      );

    return {
      overview: {
        totalAttempts,
        correctAttempts,
        accuracy: ensureFinite(accuracy, 0),
        avgSuccessScore,
        bestStreak
      },
      byGame,
      byGameLevel,
      bySkill,
      skillByGame,
      skillHighlights: {
        topGains,
        needsWork,
        readyToLevel
      },
      recommendations
    };
  }
}
