import { randomUUID } from "node:crypto";
import { Firestore } from "@google-cloud/firestore";
import type { GradeBand, Profile } from "../core/types.ts";

const db = new Firestore();
const col = db.collection("profiles");

export class ProfileStore {
  async list(): Promise<Profile[]> {
    const snap = await col.get();
    return snap.docs.map((d) => d.data() as Profile);
  }

  async login(displayName: string, gradeBand: GradeBand): Promise<Profile> {
    const normalized = displayName.trim();
    if (!normalized) throw new Error("Display name is required.");

    const snap = await col
      .where("displayNameLower", "==", normalized.toLowerCase())
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data() as Profile;

    const profile: Profile = {
      id: randomUUID(),
      displayName: normalized,
      gradeBand,
      createdAt: new Date().toISOString(),
    };
    await col.doc(profile.id).set({ ...profile, displayNameLower: normalized.toLowerCase() });
    return profile;
  }

  async get(profileId: string): Promise<Profile | undefined> {
    const doc = await col.doc(profileId).get();
    return doc.exists ? (doc.data() as Profile) : undefined;
  }
}
