import { describe, expect, it } from "vitest";
import { loadState, saveState, STORAGE_KEY } from "./storage";
import { completionSet, computeStreak } from "./streaks";
import type { Habit } from "./types";

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
    expect([...s.m.keys()].some((k) => k.startsWith(`${STORAGE_KEY}__corrupt_`))).toBe(true);
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
