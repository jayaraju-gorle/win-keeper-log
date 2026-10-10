import { describe, expect, it } from "vitest";
import { isFeatureEnabled } from "@/lib/flags";
import { CORRUPT_BACKUP_KEY, loadState, saveState, STORAGE_KEY } from "@/lib/habits/storage";
import { completionSet, computeStreak } from "@/lib/habits/streaks";
import type { Habit } from "@/lib/habits/types";

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const habit = (h: Partial<Habit>): Habit => ({
  id: "h", title: "T", cadenceType: "daily", createdAt: "2026-09-01T08:00:00", archived: false, ...h,
});
const streak = (h: Habit, dates: string[], today: string) =>
  computeStreak(h, completionSet("h", dates.map((date) => ({ habitId: "h", date }))), today);

describe("storage contract", () => {
  it("returns empty state when nothing stored", () => {
    expect(loadState(new MemStore(), "2026-10-10").status).toBe("empty");
  });
  it("round-trips saved state", () => {
    const s = new MemStore();
    const { state } = loadState(s, "2026-10-10");
    state.habits.push(habit({}));
    expect(saveState(state, s)).toEqual({ ok: true });
    const r = loadState(s, "2026-10-10");
    expect(r.status).toBe("ok");
    expect(r.state.habits).toHaveLength(1);
  });
  it("backs up corrupt JSON and starts fresh", () => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, "{oops");
    const r = loadState(s, "2026-10-10");
    expect(r.status).toBe("corrupt");
    expect(r.state.habits).toEqual([]);
    expect(s.getItem(CORRUPT_BACKUP_KEY)).toBe("{oops");
  });
  it("migrates unversioned data", () => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, JSON.stringify({ habits: [habit({})], completions: [{ id: "c", habitId: "h", date: "2026-10-09" }] }));
    const r = loadState(s, "2026-10-10");
    expect(r.status).toBe("migrated");
    expect(r.state.version).toBe(1);
    expect(r.state.completions).toHaveLength(1);
  });
  it("marks newer-version data read-only", () => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 2, habits: [], completions: [] }));
    expect(loadState(s, "2026-10-10").readOnly).toBe(true);
  });
  it("drops orphan completions", () => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, habits: [habit({})], completions: [{ id: "c", habitId: "ghost", date: "2026-10-09" }], lastActiveDate: "2026-10-09" }));
    expect(loadState(s, "2026-10-10").state.completions).toHaveLength(0);
  });
});

describe("strict streaks", () => {
  it("daily: consecutive days count, today pending keeps streak", () => {
    expect(streak(habit({}), ["2026-10-08", "2026-10-09"], "2026-10-10").current).toBe(2);
    expect(streak(habit({}), ["2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10").current).toBe(3);
  });
  it("daily: a missed day resets to 0", () => {
    expect(streak(habit({}), ["2026-10-07", "2026-10-08"], "2026-10-10").current).toBe(0);
  });
  it("specific days: Saturday done, Sunday missed resets to 0", () => {
    const h = habit({ cadenceType: "specific_days", specificDays: [6, 0] });
    // Week of Mon 28 Sep: Sat 3 Oct done, Sun 4 Oct missed. Today Fri 9 Oct.
    expect(streak(h, ["2026-10-03"], "2026-10-09").current).toBe(0);
    expect(streak(h, ["2026-10-03", "2026-10-04"], "2026-10-09").current).toBe(1);
  });
  it("target frequency: week completes once target reached; short week resets", () => {
    const h = habit({ cadenceType: "target_frequency", targetCount: 2, targetPeriod: "week" });
    // Week of 28 Sep: 2 sessions; current week (5 Oct) 2 sessions -> 2
    expect(streak(h, ["2026-09-29", "2026-10-01", "2026-10-06", "2026-10-07"], "2026-10-10").current).toBe(2);
    // Week of 28 Sep only 1 session -> broken; current week done -> 1
    expect(streak(h, ["2026-09-29", "2026-10-06", "2026-10-07"], "2026-10-10").current).toBe(1);
  });
  it("target frequency: Sunday night counts in that week, not the next", () => {
    const h = habit({ cadenceType: "target_frequency", targetCount: 2, targetPeriod: "week", createdAt: "2026-09-28T08:00:00" });
    // Mon 5 Oct today; previous week had Sat+Sun sessions
    expect(streak(h, ["2026-10-03", "2026-10-04"], "2026-10-05").current).toBe(1);
  });
  it("tracks best streak across a break", () => {
    expect(streak(habit({}), ["2026-09-01", "2026-09-02", "2026-09-03", "2026-10-10"], "2026-10-10")).toMatchObject({ current: 1, best: 3 });
  });
});

describe("tampered storage hardening", () => {
  const TODAY = "2026-10-10";
  const store = (data: unknown) => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, completions: [], lastActiveDate: TODAY, ...(data as object) }));
    return s;
  };

  it("drops completions dated before 2000", () => {
    const r = loadState(store({ habits: [habit({})], completions: [{ id: "c", habitId: "h", date: "0001-01-01" }] }), TODAY);
    expect(r.state.completions).toHaveLength(0);
  });
  it("keeps completions dated 2000-01-01", () => {
    const r = loadState(store({ habits: [habit({})], completions: [{ id: "c", habitId: "h", date: "2000-01-01" }] }), TODAY);
    expect(r.state.completions).toHaveLength(1);
  });
  it("drops completions more than one day in the future", () => {
    const r = loadState(store({ habits: [habit({})], completions: [
      { id: "a", habitId: "h", date: "2026-10-11" },
      { id: "b", habitId: "h", date: "2026-10-12" },
    ] }), TODAY);
    expect(r.state.completions.map((c) => c.date)).toEqual(["2026-10-11"]);
  });
  it("drops habits created before 2000", () => {
    const r = loadState(store({ habits: [habit({ createdAt: "0001-01-01T00:00:00" })] }), TODAY);
    expect(r.state.habits).toHaveLength(0);
  });
  it("keeps only the first habit when ids repeat", () => {
    const r = loadState(store({ habits: [habit({ title: "First" }), habit({ title: "Second" })] }), TODAY);
    expect(r.state.habits.map((h) => h.title)).toEqual(["First"]);
  });
  it("keeps one backup slot across repeated corruption", () => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, "{bad1");
    loadState(s, TODAY);
    expect(loadState(s, TODAY).status).toBe("ok");
    s.setItem(STORAGE_KEY, "{bad2");
    loadState(s, TODAY);
    const backups = [...s.m.keys()].filter((k) => k.includes("__corrupt"));
    expect(backups).toEqual([CORRUPT_BACKUP_KEY]);
    expect(s.getItem(CORRUPT_BACKUP_KEY)).toBe("{bad2");
  });
});

describe("interval habits (flagged)", () => {
  const every3 = habit({ cadenceType: "interval", intervalDays: 3, createdAt: "2026-10-01T08:00:00" });
  it("counts consecutive 3-day windows with a completion", () => {
    // windows: 01-03, 04-06, 07-09, 10-12 (current, pending)
    expect(streak(every3, ["2026-10-02", "2026-10-05", "2026-10-09"], "2026-10-10").current).toBe(3);
  });
  it("resets to 0 when a 3-day window is missed", () => {
    expect(streak(every3, ["2026-10-02", "2026-10-09"], "2026-10-10").current).toBe(1);
  });
  it("is dropped on load when intervalDays is outside 2-14", () => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, habits: [habit({ cadenceType: "interval", intervalDays: 30 })], completions: [] }));
    expect(loadState(s, "2026-10-10").state.habits).toHaveLength(0);
  });
  it("still loads with the flag off", () => {
    const s = new MemStore();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, habits: [every3], completions: [] }));
    expect(isFeatureEnabled("intervalHabits", {})).toBe(false);
    expect(loadState(s, "2026-10-10").state.habits).toHaveLength(1);
  });
  it("flag turns on only for the string 'true'", () => {
    expect(isFeatureEnabled("intervalHabits", { intervalHabits: "true" })).toBe(true);
    expect(isFeatureEnabled("intervalHabits", { intervalHabits: "1" })).toBe(false);
  });
});
