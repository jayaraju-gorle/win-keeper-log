# Habit Tracker MVP — Specification (SPEC.md)

## 1. Overview & Objectives
A minimalist, zero-friction habit tracker running entirely client-side in modern web browsers. It empowers individuals to cultivate daily and recurring habits with strict accountability, instant responsiveness, and zero data leaving their device.

### Core Objectives
- **Zero Friction:** Immediate access without authentication, onboarding walls, or setup friction.
- **Privacy First (Local-Only):** All data persists exclusively in browser `localStorage`. No cloud backend, tracking, or network calls.
- **Strict Accountability:** Streaks are earned and strictly preserved. Missing a scheduled cadence resets the streak to zero without soft grace windows.
- **Flexible Cadences:** Support for daily habits, specific-day weekly schedules (e.g., Sat & Sun), and target-count cycles (e.g., 2x per week).

---

## 2. Explicit Non-Goals (Out of Scope for MVP)
- User accounts, authentication, or multi-device cloud synchronization.
- Push notifications, background reminders, or system tray badges.
- Social sharing, friend activity feeds, or community leaderboards.
- Complex hierarchical habit dependencies or sub-tasks.
- Server-side analytics, external integrations, or third-party webhooks.

---

## 3. Data Model & `localStorage` Schema

Data will be stored under the primary key: `habit_tracker_data_v1`.

### TypeScript Interface Definitions

```typescript
export type HabitCadenceType = 
  | 'daily'            // Must be completed every single day
  | 'specific_days'   // Specific days of the week (e.g., [0, 6] for Sun & Sat)
  | 'target_frequency'; // X times per week or month (e.g., 2 times per week)

export type FrequencyPeriod = 'week' | 'month';

export interface Habit {
  id: string;                      // UUID or nanoid
  title: string;                   // E.g., "Morning 30-min run"
  description?: string;            // Optional extra context or notes
  color?: string;                  // Hex or Tailwind color token for visual tags
  cadenceType: HabitCadenceType;
  
  // Specific day constraints (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  specificDays?: number[];         
  
  // Target frequency constraints (e.g., 2 times per 'week')
  targetCount?: number;            
  targetPeriod?: FrequencyPeriod;  
  
  createdAt: string;               // ISO 8601 string (e.g., "2026-10-09T14:15:00.000Z")
  archived: boolean;               // Soft delete / archive flag
}

export interface HabitCompletion {
  id: string;                      // Unique completion log ID
  habitId: string;                 // References Habit.id
  date: string;                    // Normalized calendar date string: "YYYY-MM-DD"
  completedAt: string;             // ISO 8601 timestamp of logging action
}

export interface HabitTrackerState {
  version: 1;
  habits: Habit[];
  completions: HabitCompletion[];
  lastActiveDate: string;          // "YYYY-MM-DD" for day-rollover validation
}
```

---

## 4. Streak Calculation & Invalidation Rules

Streaks represent continuous compliance with a habit's declared schedule. A single missed cycle breaks the streak immediately.

### 4.1 Daily Habits (`daily`)
- **Completion Rule:** Must be completed once every calendar day ("YYYY-MM-DD" local time).
- **Streak Evaluation:**
  - Count consecutive calendar days backwards starting from today (if completed) or yesterday.
  - If yesterday was uncompleted and today is still pending, current streak remains intact until the day ends.
  - If yesterday was uncompleted and today was not completed before midnight, streak resets to `0`.
  - Once reset, a completion today starts streak at `1`.

### 4.2 Specific Days Habits (`specific_days`)
- **Example:** "Play cricket on Saturday and Sunday".
- **Completion Rule:** Every designated day in that week must have a completion logged.
- **Streak Unit:** Measured in **consecutive completed weeks**.
- **Streak Evaluation:**
  - If a week requires [Saturday, Sunday], both days must have logs.
  - Missing any scheduled day in a week invalidates that entire week.
  - If the previous week failed to complete all required days, the week streak resets to `0`.

### 4.3 Target Frequency Habits (`target_frequency`)
- **Example:** "Go swimming twice a week" (flexible days).
- **Completion Rule:** A cycle is marked complete as soon as total completions within the calendar period reach `targetCount`.
- **Streak Unit:** Measured in **consecutive completed cycles** (weeks or months).
- **Cycle Definition:**
  - **Weekly:** Monday 00:00:00 to Sunday 23:59:59 (ISO week).
  - **Monthly:** 1st of month to last calendar day of month.
- **Streak Evaluation:**
  - If the previous cycle's completion count was less than `targetCount`, the streak resets to `0`.

---

## 5. Core Screens & UI States

### Screen 1: Today Dashboard (Primary View)
- **Header:** Current date, brief motivational greeting, total active habits count.
- **Habit Cards List:**
  - Habit title and visual badge/tag.
  - Schedule indicator (e.g., "Daily", "Sat & Sun", or "Progress: 1/2 this week").
  - Current streak pill (e.g., `🔥 14 days` or `🔥 4 weeks`).
  - Action button: Large, satisfying checkbox / toggle button to mark done for today.
- **Filtering & Views:**
  - Quick filter tabs: "All", "Due Today", "Completed".

### Screen 2: Create / Edit Habit Modal
- Form inputs:
  - Habit Name (input field, required).
  - Cadence Selector (Radio / segmented controls):
    1. *Every day*
    2. *Specific days of the week* (Monday through Sunday toggles)
    3. *Flexible frequency* (Counter stepper: "X times per" + dropdown: "week" / "month")
  - Accent Color picker (palette of accessible color tokens).
  - Save / Cancel buttons.

### Screen 3: Habit Detail & History View
- Calendar heatmap / week-grid showing completed days.
- Best streak vs. Current streak metrics.
- Action to Edit habit details or Archive/Delete.

### UI States
- **Empty State:** Friendly graphic with "No habits yet. Create your first habit to start your streak!"
- **All Caught Up State:** Celebratory banner when all habits due today are completed.
- **Persistence Error State:** Warning toast if browser `localStorage` quota is exceeded or inaccessible (e.g., private browsing storage lockouts).

---

## 6. Testing & Verification Strategy

1. **Local Storage Persistence Tests:**
   - Verify reading and writing to `localStorage` across page reloads.
   - Test data migration fallback if corrupted or empty data is encountered.
2. **Streak Computation Logic Tests:**
   - Daily streak increment on consecutive days.
   - Daily streak reset to 0 after an uncompleted calendar day.
   - Specific days: Full week requirement (e.g., Saturday done + Sunday missed = 0 week streak).
   - Target frequency: Completion count check at boundary of week rollover (Sunday night into Monday).
3. **Time & Date Rollover Tests:**
   - Verify day boundaries respect the user's local device timezone.
   - Verify behavior when logging today vs. viewing historical completions.
4. **UI Responsiveness & Accessibility:**
   - Touch targets >= 44px for easy mobile toggling.
   - Keyboard accessible checkboxes and modal controls.
