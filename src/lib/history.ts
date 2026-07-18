"use client";

// Simple localStorage-backed history of generated trainings, validated with
// Zod on read so malformed/legacy data can't crash the app.

import { useSyncExternalStore } from "react";
import { z } from "zod";

const QuestionOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
  order: z.number(),
});

const GeneratedQuestionSchema = z.object({
  order: z.number(),
  question: z.string(),
  correctReason: z.string(),
  timestamp: z.number(),
  options: z.array(QuestionOptionSchema),
});

export const TrainingRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number(),
  markdown: z.string().nullable(),
  questions: z.array(GeneratedQuestionSchema),
});

export type TrainingRecord = z.infer<typeof TrainingRecordSchema>;

const STORAGE_KEY = "vtt.history.v1";
const MAX_ITEMS = 50;
const EMPTY: TrainingRecord[] = [];

const listeners = new Set<() => void>();
// Cached snapshot so useSyncExternalStore gets a stable reference between writes.
let cache: TrainingRecord[] | null = null;

function readFromStorage(): TrainingRecord[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = z.array(TrainingRecordSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): TrainingRecord[] {
  if (cache === null) cache = readFromStorage();
  return cache;
}

function commit(items: TrainingRecord[]): void {
  cache = items;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable — keep the in-memory cache anyway.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null; // invalidate; another tab changed it
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveTraining(record: TrainingRecord): void {
  const next = [record, ...getSnapshot().filter((i) => i.id !== record.id)];
  commit(next.slice(0, MAX_ITEMS));
}

export function deleteTraining(id: string): void {
  commit(getSnapshot().filter((i) => i.id !== id));
}

/** Reactive history list, kept in sync across tabs and in-app writes. */
export function useHistory(): TrainingRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
