/**
 * Strict streak engine. Pure functions; `today` is injected for testability.
 * Every cadence is reduced to a sequence of "units" (day / week / month):
 *  - a past unit either succeeded or failed (failure breaks the streak);
 *  - the current unit counts if already successful, otherwise it is "pending"
 *    and neither adds to nor breaks the streak — unless it has already failed
 *    (a required weekday earlier this week was missed).
 * Units before the habit was created never break a streak.
 */
import {
  addDays,
  addMonths,
  daysBetween,
  dayOfWeek,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "./dates";
import type { Habit } from "./types";

type UnitStatus = "success" | "failed" | "pending";

export interface StreakInfo {
  current: number;
  best: number;
  unit: "day" | "week" | "month" | "cycle";
}

export interface CycleProgress {
  done: number;
  target: number;
  label: string; // e.g. "this week"
}

function createdKey(habit: Habit): string {
  return toDateKey(new Date(habit.createdAt));
}

function unitOf(habit: Habit): StreakInfo["unit"] {
  if (habit.cadenceType === "daily") return "day";
  if (habit.cadenceType === "target_frequency" && habit.targetPeriod === "month") return "month";
  return "week";
}

function unitStart(unit: StreakInfo["unit"], key: string): string {
  return unit === "day" ? key : unit === "week" ? startOfWeek(key) : startOfMonth(key);
}

function nextUnit(unit: StreakInfo["unit"], start: string, n = 1): string {
  return unit === "day" ? addDays(start, n) : unit === "week" ? addDays(start, 7 * n) : addMonths(start, n);
}

function evaluate(habit: Habit, start: string, done: Set<string>, today: string, created: string): UnitStatus {
  const unit = unitOf(habit);
  const isCurrent = unitStart(unit, today) === start;

  if (habit.cadenceType === "daily") {
    if (done.has(start)) return "success";
    return isCurrent ? "pending" : "failed";
  }

  if (habit.cadenceType === "specific_days") {
    const required = new Set(habit.specificDays ?? []);
    let pending = false;
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      if (!required.has(dayOfWeek(day))) continue;
      if (day < created) continue; // excused: habit didn't exist yet
      if (done.has(day)) continue;
      if (day >= today) pending = true;
      else return "failed";
    }
    return pending ? "pending" : "success";
  }

  // target_frequency
  const end = nextUnit(unit, start);
  let count = 0;
  for (const d of done) if (d >= start && d < end) count++;
  if (count >= (habit.targetCount ?? 1)) return "success";
  return isCurrent ? "pending" : "failed";
}

export function completionSet(habitId: string, completions: { habitId: string; date: string }[]): Set<string> {
  const s = new Set<string>();
  for (const c of completions) if (c.habitId === habitId) s.add(c.date);
  return s;
}

/** Start of the N-day window containing `key`; windows are anchored on the habit's creation date. */
function intervalStart(habit: Habit, key: string): string {
  const n = habit.intervalDays ?? 2;
  const created = createdKey(habit);
  return addDays(created, Math.floor(daysBetween(created, key) / n) * n);
}

/** Interval habits: each N-day window needs at least one completion; the current window is pending until done. */
function computeIntervalStreak(habit: Habit, done: Set<string>, today: string): StreakInfo {
  const n = habit.intervalDays ?? 2;
  let firstKey = createdKey(habit);
  for (const d of done) if (d < firstKey) firstKey = d;
  const current = intervalStart(habit, today);
  let best = 0, run = 0, currentStreak = 0;
  for (let u = intervalStart(habit, firstKey); u <= current; u = addDays(u, n)) {
    const end = addDays(u, n);
    let hit = false;
    for (const d of done) if (d >= u && d < end) { hit = true; break; }
    if (hit) run++;
    else if (u !== current) run = 0;
    best = Math.max(best, run);
    if (u === current) currentStreak = run;
  }
  return { current: currentStreak, best, unit: "cycle" };
}

export function computeStreak(habit: Habit, done: Set<string>, today: string): StreakInfo {
  if (habit.cadenceType === "interval") return computeIntervalStreak(habit, done, today);
  const unit = unitOf(habit);
  const created = createdKey(habit);
  // Treat completions logged before creation (e.g. backfill) as moving the start earlier.
  let firstKey = created;
  for (const d of done) if (d < firstKey) firstKey = d;
  const first = unitStart(unit, firstKey);
  const current = unitStart(unit, today);

  let best = 0;
  let run = 0;
  let currentStreak = 0;
  for (let u = first; u <= current; u = nextUnit(unit, u)) {
    const status = evaluate(habit, u, done, today, firstKey);
    if (status === "success") {
      run++;
    } else if (status === "failed") {
      run = 0;
    }
    // pending (only possible for the current unit) keeps the run as-is
    best = Math.max(best, run);
    if (u === current) currentStreak = run;
  }
  return { current: currentStreak, best, unit };
}

export function isDueToday(habit: Habit, done: Set<string>, today: string): boolean {
  if (habit.cadenceType === "daily") return true;
  if (habit.cadenceType === "specific_days") return (habit.specificDays ?? []).includes(dayOfWeek(today));
  if (habit.cadenceType === "interval") {
    // Due until something is logged in the current N-day window.
    const start = intervalStart(habit, today);
    for (const d of done) if (d >= start && d <= today) return d === today;
    return true;
  }
  // Flexible: due while the cycle target isn't met yet, or if already logged today.
  const p = cycleProgress(habit, done, today);
  return p.done < p.target || done.has(today);
}

export function cycleProgress(habit: Habit, done: Set<string>, today: string): CycleProgress {
  const unit = unitOf(habit);
  const start = unitStart(unit, today);
  const end = nextUnit(unit, start);
  let count = 0;
  for (const d of done) if (d >= start && d < end) count++;
  return {
    done: count,
    target: habit.targetCount ?? 1,
    label: unit === "month" ? "this month" : "this week",
  };
}

export function formatStreak(s: StreakInfo): string {
  const n = s.current;
  return `${n} ${s.unit}${n === 1 ? "" : "s"}`;
}
