/**
 * localStorage persistence contract
 * ---------------------------------
 * Key:      STORAGE_KEY ("habit_tracker_data_v1"). Value: JSON HabitTrackerState.
 *
 * loadState(storage?, today?) -> LoadResult  (never throws)
 *   status "ok"          valid v1 data
 *   status "empty"       nothing stored -> fresh empty state
 *   status "migrated"    older/unversioned shape upgraded to v1 (caller should save)
 *   status "corrupt"     unparseable or wrong shape -> raw value copied to a backup
 *                        key (`${STORAGE_KEY}__corrupt_<timestamp>`), fresh state returned
 *   status "future"      written by a newer app version -> data loaded best-effort but
 *                        readOnly = true so we never overwrite it with a downgraded shape
 *   status "unavailable" localStorage missing/blocked -> in-memory state only
 *   Individual malformed habits/completions are dropped; orphaned and duplicate
 *   (habitId,date) completions are removed.
 *
 * saveState(state, storage?) -> SaveResult  (never throws)
 *   { ok: true } or { ok: false, reason: "quota" | "unavailable" | "unknown" }
 *   A single setItem call, so a write is all-or-nothing.
 */
import { isDateKey, toDateKey } from "./dates";
import {
  HABIT_COLORS,
  SCHEMA_VERSION,
  type Habit,
  type HabitCompletion,
  type HabitTrackerState,
} from "./types";

export const STORAGE_KEY = "habit_tracker_data_v1";

export type LoadStatus = "ok" | "empty" | "migrated" | "corrupt" | "future" | "unavailable";
export interface LoadResult {
  state: HabitTrackerState;
  status: LoadStatus;
  readOnly: boolean;
}
export type SaveResult = { ok: true } | { ok: false; reason: "quota" | "unavailable" | "unknown" };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createEmptyState(today: string = toDateKey(new Date())): HabitTrackerState {
  return { version: SCHEMA_VERSION, habits: [], completions: [], lastActiveDate: today };
}

function getStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__habit_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

type Loose = Partial<
  Record<
    | "id" | "title" | "description" | "color" | "cadenceType" | "specificDays" | "targetCount"
    | "targetPeriod" | "createdAt" | "archived" | "habitId" | "date" | "completedAt"
    | "version" | "habits" | "completions" | "lastActiveDate",
    unknown
  >
>;
const isObj = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function sanitizeHabit(raw: unknown): Habit | null {
  if (!isObj(raw)) return null;
  const { id, title, cadenceType, createdAt } = raw;
  if (typeof id !== "string" || !id) return null;
  if (typeof title !== "string" || !title.trim()) return null;
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) return null;
  const habit: Habit = {
    id,
    title: title.trim().slice(0, 120),
    cadenceType: "daily",
    createdAt,
    archived: raw.archived === true,
  };
  if (typeof raw.description === "string" && raw.description.trim())
    habit.description = raw.description.trim().slice(0, 500);
  if (typeof raw.color === "string" && (HABIT_COLORS as readonly string[]).includes(raw.color))
    habit.color = raw.color as Habit["color"];

  if (cadenceType === "specific_days") {
    const days = Array.isArray(raw.specificDays)
      ? [...new Set(raw.specificDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
      : [];
    if (days.length === 0) return null;
    habit.cadenceType = "specific_days";
    habit.specificDays = days;
  } else if (cadenceType === "target_frequency") {
    const count = raw.targetCount;
    const period = raw.targetPeriod;
    if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > 31) return null;
    if (period !== "week" && period !== "month") return null;
    habit.cadenceType = "target_frequency";
    habit.targetCount = count as number;
    habit.targetPeriod = period;
  } else if (cadenceType !== "daily") {
    return null;
  }
  return habit;
}

function sanitizeCompletion(raw: unknown): HabitCompletion | null {
  if (!isObj(raw)) return null;
  const { id, habitId, date, completedAt } = raw;
  if (typeof id !== "string" || typeof habitId !== "string" || !isDateKey(date)) return null;
  return {
    id,
    habitId,
    date,
    completedAt: typeof completedAt === "string" ? completedAt : new Date().toISOString(),
  };
}

function sanitizeCollections(habitsRaw: unknown[], completionsRaw: unknown[]) {
  const habits = habitsRaw.map(sanitizeHabit).filter((h): h is Habit => h !== null);
  const ids = new Set(habits.map((h) => h.id));
  const seen = new Set<string>();
  const completions: HabitCompletion[] = [];
  for (const c of completionsRaw.map(sanitizeCompletion)) {
    if (!c || !ids.has(c.habitId)) continue;
    const k = `${c.habitId}|${c.date}`;
    if (seen.has(k)) continue;
    seen.add(k);
    completions.push(c);
  }
  return { habits, completions };
}

/** Upgrade older shapes to v1. Returns null when the shape is unrecognisable. */
export function migrate(raw: unknown, today: string): HabitTrackerState | null {
  // Pre-versioned prototype shape: { habits: [...], completions?: [...] } or a bare array of habits.
  const legacy = Array.isArray(raw) ? { habits: raw } : raw;
  if (!isObj(legacy) || !Array.isArray(legacy.habits)) return null;
  const { habits, completions } = sanitizeCollections(
    legacy.habits,
    Array.isArray(legacy.completions) ? legacy.completions : [],
  );
  return { version: SCHEMA_VERSION, habits, completions, lastActiveDate: today };
}

export function loadState(
  storage: StorageLike | null = getStorage(),
  today: string = toDateKey(new Date()),
): LoadResult {
  if (!storage) return { state: createEmptyState(today), status: "unavailable", readOnly: false };

  let rawText: string | null;
  try {
    rawText = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: createEmptyState(today), status: "unavailable", readOnly: false };
  }
  if (rawText === null || rawText === "") {
    return { state: createEmptyState(today), status: "empty", readOnly: false };
  }

  const corrupt = (): LoadResult => {
    try {
      storage.setItem(`${STORAGE_KEY}__corrupt_${Date.now()}`, rawText as string);
    } catch {
      /* best effort backup */
    }
    return { state: createEmptyState(today), status: "corrupt", readOnly: false };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return corrupt();
  }

  const version = isObj(parsed) ? parsed.version : undefined;

  if (version === SCHEMA_VERSION && isObj(parsed)) {
    if (!Array.isArray(parsed.habits) || !Array.isArray(parsed.completions)) return corrupt();
    const { habits, completions } = sanitizeCollections(parsed.habits, parsed.completions);
    const lastActiveDate = isDateKey(parsed.lastActiveDate) ? parsed.lastActiveDate : today;
    return {
      state: { version: SCHEMA_VERSION, habits, completions, lastActiveDate },
      status: "ok",
      readOnly: false,
    };
  }

  if (typeof version === "number" && version > SCHEMA_VERSION) {
    const best = migrate(parsed, today);
    return { state: best ?? createEmptyState(today), status: "future", readOnly: true };
  }

  const migrated = migrate(parsed, today);
  if (!migrated) return corrupt();
  return { state: migrated, status: "migrated", readOnly: false };
}

export function saveState(
  state: HabitTrackerState,
  storage: StorageLike | null = getStorage(),
): SaveResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED")
      return { ok: false, reason: "quota" };
    if (name === "SecurityError") return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "unknown" };
  }
}
