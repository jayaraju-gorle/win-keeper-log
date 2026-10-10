import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { toDateKey } from "./dates";
import { createEmptyState, loadState, saveState, STORAGE_KEY, type LoadStatus } from "./storage";
import type { HabitInput, HabitTrackerState } from "./types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function useHabitTracker() {
  const [state, setState] = useState<HabitTrackerState>(() => createEmptyState("1970-01-01"));
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [status, setStatus] = useState<LoadStatus>("empty");
  const readOnly = useRef(false);

  useEffect(() => {
    const t = toDateKey(new Date());
    const res = loadState(undefined, t);
    readOnly.current = res.readOnly;
    setState({ ...res.state, lastActiveDate: t });
    setStatus(res.status);
    setToday(t);
    setReady(true);
    if (res.status === "migrated") saveState({ ...res.state, lastActiveDate: t });
    if (res.status === "corrupt")
      toast.warning("Saved data couldn't be read, so we started fresh. A backup was kept.");
    if (res.status === "unavailable")
      toast.error("Browser storage is blocked. Changes won't be kept after you close this tab.");
    if (res.status === "future")
      toast.warning(
        "Data was saved by a newer version of this app. Viewing only — changes won't be saved.",
      );

    // Roll over at midnight / when the tab regains focus.
    const tick = () => setToday(toDateKey(new Date()));
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);

    // Another tab changed our data: adopt it so this tab doesn't overwrite it with a stale copy.
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage || (e.key !== STORAGE_KEY && e.key !== null))
        return;
      const now = toDateKey(new Date());
      const r = loadState(undefined, now);
      readOnly.current = r.readOnly;
      setState(r.state);
      setStatus(r.status);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const commit = useCallback((updater: (s: HabitTrackerState) => HabitTrackerState) => {
    setState((prev) => {
      const next = updater(prev);
      if (!readOnly.current) {
        const r = saveState(next);
        if (!r.ok)
          toast.error(
            r.reason === "quota"
              ? "Storage is full — this change may not be saved."
              : "Couldn't save to this browser. Changes will be lost when you close the tab.",
            { id: "save-error" },
          );
      }
      return next;
    });
  }, []);

  const addHabit = useCallback(
    (data: HabitInput) =>
      commit((s) => ({
        ...s,
        habits: [
          ...s.habits,
          { ...data, id: newId(), createdAt: new Date().toISOString(), archived: false },
        ],
      })),
    [commit],
  );

  const updateHabit = useCallback(
    (id: string, data: HabitInput) =>
      commit((s) => ({
        ...s,
        habits: s.habits.map((h) =>
          h.id === id ? { id: h.id, createdAt: h.createdAt, archived: h.archived, ...data } : h,
        ),
      })),
    [commit],
  );

  const archiveHabit = useCallback(
    (id: string) =>
      commit((s) => ({
        ...s,
        habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)),
      })),
    [commit],
  );

  const toggleCompletion = useCallback(
    (habitId: string, date: string) =>
      commit((s) => {
        const exists = s.completions.some((c) => c.habitId === habitId && c.date === date);
        return {
          ...s,
          completions: exists
            ? s.completions.filter((c) => !(c.habitId === habitId && c.date === date))
            : [
                ...s.completions,
                { id: newId(), habitId, date, completedAt: new Date().toISOString() },
              ],
        };
      }),
    [commit],
  );

  return { state, ready, today, status, addHabit, updateHabit, archiveHabit, toggleCompletion };
}
