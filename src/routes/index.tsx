import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HabitCard } from "@/components/habits/HabitCard";
import { HabitForm } from "@/components/habits/HabitForm";
import { parseDateKey } from "@/lib/habits/dates";
import { completionSet, computeStreak, isDueToday } from "@/lib/habits/streaks";
import type { Habit } from "@/lib/habits/types";
import { useHabitTracker } from "@/lib/habits/useHabitTracker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Streakly — Private habit tracker" },
      { name: "description", content: "Track daily, weekly and flexible habits with strict streaks. Everything stays on your device." },
      { property: "og:title", content: "Streakly — Private habit tracker" },
      { property: "og:description", content: "Strict streaks for daily, weekend and twice-a-week habits. No account, no cloud." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Filter = "all" | "due" | "done";

function Index() {
  const { state, ready, today, addHabit, updateHabit, archiveHabit, toggleCompletion } = useHabitTracker();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Habit | "new" | null>(null);

  const rows = useMemo(() => {
    if (!today) return [];
    return state.habits
      .filter((h) => !h.archived)
      .map((habit) => {
        const done = completionSet(habit.id, state.completions);
        return { habit, done, streak: computeStreak(habit, done, today), due: isDueToday(habit, done, today) };
      });
  }, [state, today]);

  const visible = rows.filter((r) =>
    filter === "all" ? true : filter === "due" ? r.due && !r.done.has(today) : r.done.has(today),
  );
  const dueRows = rows.filter((r) => r.due);
  const allCaughtUp = dueRows.length > 0 && dueRows.every((r) => r.done.has(today));

  const dateLabel = today
    ? parseDateKey(today).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
    : "";

  const counts: Record<Filter, number> = {
    all: rows.length,
    due: rows.filter((r) => r.due && !r.done.has(today)).length,
    done: rows.filter((r) => r.done.has(today)).length,
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24 pt-10 sm:px-6">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-primary">{dateLabel || "\u00a0"}</p>
          <h1 className="mt-1 font-display text-4xl leading-none sm:text-5xl">Today</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready ? `${rows.length} active habit${rows.length === 1 ? "" : "s"} · saved on this device only` : "Loading…"}
          </p>
        </div>
        <Button onClick={() => setEditing("new")} className="h-11 gap-2 rounded-full px-5">
          <Plus className="h-4 w-4" aria-hidden /> New habit
        </Button>
      </header>

      {ready && rows.length > 0 && (
        <div role="tablist" aria-label="Filter habits" className="mb-5 inline-flex rounded-full bg-muted p-1">
          {(["all", "due", "done"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : f === "due" ? "Due today" : "Completed"}{" "}
              <span className="tabular-nums opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {allCaughtUp && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl bg-accent p-4 text-accent-foreground">
          <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
          <p className="font-medium">All caught up for today. Streaks safe!</p>
        </div>
      )}

      {ready && rows.length === 0 && (
        <section className="rounded-3xl border-2 border-dashed p-10 text-center">
          <p className="font-display text-2xl">No habits yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Create your first habit to start your streak — a morning run, reading the paper, weekend cricket.
          </p>
          <Button onClick={() => setEditing("new")} className="mt-6 h-11 rounded-full px-6">
            Create a habit
          </Button>
        </section>
      )}

      {ready && rows.length > 0 && visible.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">Nothing here.</p>
      )}

      <ul className="space-y-3" aria-live="polite">
        {visible.map(({ habit, done, streak, due }) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            done={done}
            today={today}
            streak={streak}
            dueToday={due}
            onToggle={() => toggleCompletion(habit.id, today)}
            onEdit={() => setEditing(habit)}
            onArchive={() => {
              archiveHabit(habit.id);
              toast(`Archived "${habit.title}"`);
            }}
          />
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{editing === "new" ? "New habit" : "Edit habit"}</DialogTitle>
            <DialogDescription>Streaks are strict: miss a scheduled day or cycle and it resets to zero.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <HabitForm
              initial={editing === "new" ? undefined : editing}
              onCancel={() => setEditing(null)}
              onSubmit={(data) => {
                if (editing === "new") addHabit(data);
                else updateHabit(editing.id, data);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
