import { Check, Flame, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DAY_SHORT, WEEK_ORDER } from "@/lib/habits/dates";
import { cycleProgress, formatStreak, type StreakInfo } from "@/lib/habits/streaks";
import type { Habit } from "@/lib/habits/types";
import { cn } from "@/lib/utils";

function scheduleLabel(habit: Habit, done: Set<string>, today: string) {
  if (habit.cadenceType === "daily") return "Every day";
  if (habit.cadenceType === "specific_days")
    return WEEK_ORDER.filter((d) => habit.specificDays?.includes(d))
      .map((d) => DAY_SHORT[d])
      .join(" & ");
  if (habit.cadenceType === "interval") return `Every ${habit.intervalDays} days`;
  const p = cycleProgress(habit, done, today);
  return `${p.done}/${p.target} ${p.label}`;
}

export function HabitCard({
  habit,
  done,
  today,
  streak,
  dueToday,
  onToggle,
  onEdit,
  onArchive,
}: {
  habit: Habit;
  done: Set<string>;
  today: string;
  streak: StreakInfo;
  dueToday: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const doneToday = done.has(today);
  const color = `var(--habit-${habit.color ?? "slate"})`;

  return (
    <li
      className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition-colors"
      style={{ borderLeft: `6px solid ${color}` }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={doneToday}
        aria-label={`Mark "${habit.title}" done today`}
        onClick={onToggle}
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-90",
          doneToday
            ? "border-transparent text-primary-foreground"
            : "border-border hover:border-foreground/40",
        )}
        style={doneToday ? { backgroundColor: color } : undefined}
      >
        <Check
          className={cn("h-6 w-6 transition-opacity", doneToday ? "opacity-100" : "opacity-0")}
          strokeWidth={3}
        />
      </button>

      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            "truncate font-display text-lg leading-tight",
            doneToday && "text-muted-foreground line-through decoration-2",
          )}
        >
          {habit.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {scheduleLabel(habit, done, today)}
          {!dueToday && !doneToday && " · not due today"}
        </p>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
          streak.current > 0
            ? "bg-accent text-accent-foreground"
            : "bg-muted text-muted-foreground",
        )}
        aria-label={`Current streak ${formatStreak(streak)}, best ${streak.best}`}
        title={`Best: ${streak.best} ${streak.unit}${streak.best === 1 ? "" : "s"}`}
      >
        <Flame className="h-4 w-4" aria-hidden />
        {formatStreak(streak)}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={`Options for ${habit.title}`}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={onArchive} className="text-destructive">
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
