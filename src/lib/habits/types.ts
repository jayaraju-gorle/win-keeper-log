export type HabitCadenceType = "daily" | "specific_days" | "target_frequency" | "interval";
export type FrequencyPeriod = "week" | "month";

export interface Habit {
  id: string;
  title: string;
  description?: string;
  color?: HabitColor;
  cadenceType: HabitCadenceType;
  /** 0 = Sunday … 6 = Saturday. Required when cadenceType = "specific_days". */
  specificDays?: number[];
  /** Required when cadenceType = "target_frequency". */
  targetCount?: number;
  targetPeriod?: FrequencyPeriod;
  /** Required when cadenceType = "interval": once every N days (2-14). Behind the intervalHabits flag. */
  intervalDays?: number;
  createdAt: string; // ISO 8601
  archived: boolean;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string; // local calendar date "YYYY-MM-DD"
  completedAt: string; // ISO 8601
}

export const SCHEMA_VERSION = 1 as const;

export interface HabitTrackerState {
  version: typeof SCHEMA_VERSION;
  habits: Habit[];
  completions: HabitCompletion[];
  lastActiveDate: string; // "YYYY-MM-DD"
}

export const MIN_INTERVAL_DAYS = 2;
export const MAX_INTERVAL_DAYS = 14;

export const HABIT_COLORS = ["tomato", "moss", "ocean", "plum", "amber", "slate"] as const;
export type HabitColor = (typeof HABIT_COLORS)[number];

export type HabitInput = Pick<
  Habit,
  "title" | "description" | "color" | "cadenceType" | "specificDays" | "targetCount" | "targetPeriod" | "intervalDays"
>;
