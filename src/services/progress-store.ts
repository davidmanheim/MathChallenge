import { randomUUID } from "node:crypto";
import type { Attempt } from "../core/types.ts";
import { readJsonFile, writeJsonFile } from "./json-store.ts";

type ProgressDb = {
  attempts: Attempt[];
};

const DEFAULT_DB: ProgressDb = { attempts: [] };

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
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    byGameType: Record<string, { attempts: number; correct: number }>;
  } {
    const db = readJsonFile<ProgressDb>(this.filePath, DEFAULT_DB);
    const attempts = db.attempts.filter((a) => a.profileId === profileId);

    const byGameType: Record<string, { attempts: number; correct: number }> = {};
    for (const a of attempts) {
      if (!byGameType[a.gameTypeId]) {
        byGameType[a.gameTypeId] = { attempts: 0, correct: 0 };
      }
      byGameType[a.gameTypeId].attempts += 1;
      if (a.isCorrect) byGameType[a.gameTypeId].correct += 1;
    }

    const correctAttempts = attempts.filter((a) => a.isCorrect).length;
    const totalAttempts = attempts.length;
    const accuracy = totalAttempts === 0 ? 0 : correctAttempts / totalAttempts;

    return { totalAttempts, correctAttempts, accuracy, byGameType };
  }
}
