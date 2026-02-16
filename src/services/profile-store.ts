import { randomUUID } from "node:crypto";
import type { GradeBand, Profile } from "../core/types.ts";
import { readJsonFile, writeJsonFile } from "./json-store.ts";

type ProfileDb = {
  profiles: Profile[];
};

const DEFAULT_DB: ProfileDb = { profiles: [] };

export class ProfileStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  list(): Profile[] {
    return readJsonFile<ProfileDb>(this.filePath, DEFAULT_DB).profiles;
  }

  login(displayName: string, gradeBand: GradeBand): Profile {
    const normalized = displayName.trim();
    if (!normalized) {
      throw new Error("Display name is required.");
    }

    const db = readJsonFile<ProfileDb>(this.filePath, DEFAULT_DB);
    const existing = db.profiles.find(
      (p) => p.displayName.toLowerCase() === normalized.toLowerCase()
    );
    if (existing) return existing;

    const profile: Profile = {
      id: randomUUID(),
      displayName: normalized,
      gradeBand,
      createdAt: new Date().toISOString()
    };
    db.profiles.push(profile);
    writeJsonFile(this.filePath, db);
    return profile;
  }

  get(profileId: string): Profile | undefined {
    return this.list().find((p) => p.id === profileId);
  }
}
