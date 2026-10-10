# Habit Tracker MVP — Implementation Plan (`tasks/plan.md`)

This plan breaks down the `SPEC.md` requirements into small, verifiable, dependency-ordered tasks. Each task includes clear acceptance criteria and verification steps.

---

## Dependency Graph & Implementation Sequence

```
[Task 1: Storage Layer & Types]
        │
        ▼
[Task 2: Core Streak Computation Engine]
        │
        ▼
[Task 3: State Management & CRUD Hook]
        │
        ├─────────────────────────────┐
        ▼                             ▼
[Task 4: Add / Edit Habit UI]   [Task 5: Today Dashboard & Action Toggles]
        │                             │
        └──────────────┬──────────────┘
                       ▼
        [Task 6: Habit Detail & Heatmap Stats]
                       │
                       ▼
        [Task 7: Edge Cases, Quota & Verification]
```

---

## Phase 1: Foundations & Domain Logic

### Task 1: Type Definitions & `localStorage` Persistence Adapter
- **Dependencies:** None.
- **Description:** Implement TypeScript models (`Habit`, `HabitCompletion`, `HabitTrackerState`) and a safe `localStorage` repository module with JSON serialization, schema versioning (`v1`), and fallback for unavailable storage.
- **Acceptance Criteria:**
  - `loadState()` parses and returns `HabitTrackerState` from `localStorage` under key `habit_tracker_data_v1`.
  - Returns empty initial state gracefully if storage is empty or corrupt.
  - `saveState(state)` persists changes atomically to `localStorage`.
- **Verification:** Unit test reading/writing valid mock state, handling corrupt JSON, and checking in-memory fallback.

---

### Task 2: Strict Streak Calculation Engine
- **Dependencies:** Task 1.
- **Description:** Implement pure utility functions to calculate current streak, best streak, and compliance status across all three cadence types.
- **Cadence Rules & Acceptance Criteria:**
  - **Daily (`daily`):**
    - Consecutive calendar days completed up to today or yesterday count toward streak.
    - An uncompleted day prior to today resets current streak to `0`.
  - **Specific Days (`specific_days`):**
    - Evaluated in weekly blocks (e.g., Saturday and Sunday).
    - If any required day in a week is missing, that week fails and streak resets to `0`.
    - Consecutive fully completed weeks increment streak.
  - **Target Frequency (`target_frequency`):**
    - Evaluated per calendar cycle (weekly or monthly).
    - If completions in cycle >= `targetCount`, cycle is successful.
    - If a past cycle failed to reach `targetCount`, streak resets to `0`.
- **Verification:** Pure unit tests covering daily breaks, partial weekend misses (e.g., Saturday done, Sunday missed = 0), and target counts.

---

## Phase 2: State Management & Core User Flows

### Task 3: Reactive State Hook (`useHabitTracker`)
- **Dependencies:** Task 1, Task 2.
- **Description:** Create custom React hook that coordinates state, provides actions, and syncs directly to `localStorage`.
- **Actions Provided:**
  - `addHabit(data)`
  - `updateHabit(id, data)`
  - `archiveHabit(id)`
  - `toggleCompletion(habitId, date)` (allows marking done or undoing for a specific date)
- **Acceptance Criteria:**
  - Calling `toggleCompletion` updates completion records and automatically recomputes streaks.
  - State changes immediately trigger `saveState()`.
- **Verification:** Functional test verifying state transition when toggling habit on/off for today's date.

---

### Task 4: Create & Edit Habit Dialog / Form
- **Dependencies:** Task 3.
- **Description:** Implement modal/sheet UI for adding and editing habits.
- **Form Controls:**
  - Title input with validation (non-empty string).
  - Cadence picker:
    1. Daily
    2. Specific days (interactive day selector: Mon–Sun)
    3. Flexible frequency (stepper input + week/month selector)
  - Color picker chip selector for habit card styling.
- **Acceptance Criteria:**
  - Submitting form validates required fields and calls `addHabit`.
  - Form clears and closes on successful creation.
  - Form supports pre-populating existing habit data in edit mode.
- **Verification:** Manual and component test for creating each of the three cadence types.

---

### Task 5: Today Dashboard & Quick Completion
- **Dependencies:** Task 3, Task 4.
- **Description:** Build main dashboard view displaying active habits, status for today, and quick-toggle completion buttons.
- **Features:**
  - Date header with localized day/date formatting.
  - Filter tabs: "All", "Due Today", "Completed".
  - Habit card components displaying:
    - Habit title and color accent.
    - Cadence tag (e.g., "Daily", "Sat, Sun", or "1/2 this week").
    - Current streak badge (`🔥 X days` or `🔥 Y weeks`).
    - Large, accessible completion toggle with immediate visual feedback.
  - "All Caught Up" celebratory card when all habits due today are completed.
- **Acceptance Criteria:**
  - Toggling updates UI immediately without lag.
  - Due today correctly reflects schedule (e.g., Sunday-only habits don't show due on Monday).
- **Verification:** Verify toggle updates streak badge and visual check state immediately.

---

## Phase 3: Analytics, Edge Cases & Verification

### Task 6: Habit Detail, Heatmap & History View
- **Dependencies:** Task 5.
- **Description:** Detail sheet/modal showing habit history and statistics.
- **Features:**
  - Current streak vs. Best historical streak metrics.
  - Total completion count and completion rate percentage.
  - Interactive mini calendar / weekly grid showing completed days.
  - Edit and Delete / Archive action triggers.
- **Acceptance Criteria:**
  - Accurately renders past completions on calendar grid.
  - Best streak calculation accounts for historical runs.
- **Verification:** Verify past dates accurately map to active days on the calendar grid.

---

### Task 7: Empty States, Error Handling & Device Verification
- **Dependencies:** Task 4, Task 5, Task 6.
- **Description:** Polish transitions, responsive layouts, empty states, and storage error alerts.
- **Acceptance Criteria:**
  - Empty state displays clear call-to-action when 0 habits exist.
  - Handles storage quota full or storage disabled scenarios with a user-facing toast.
  - Responsive down to 360px mobile viewport with minimum 44px touch targets.
- **Verification:** Test in mobile layout simulator and simulate restricted `localStorage` permissions.
