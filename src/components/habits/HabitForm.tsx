import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAY_SHORT, WEEK_ORDER } from "@/lib/habits/dates";
import { HABIT_COLORS, type Habit, type HabitCadenceType, type HabitColor, type HabitInput } from "@/lib/habits/types";
import { cn } from "@/lib/utils";

const CADENCES: { value: HabitCadenceType; label: string; hint: string }[] = [
  { value: "daily", label: "Every day", hint: "e.g. morning run" },
  { value: "specific_days", label: "Specific days", hint: "e.g. weekends" },
  { value: "target_frequency", label: "Times per period", hint: "e.g. twice a week" },
];

export function HabitForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Habit | undefined;
  onSubmit: (data: HabitInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [cadence, setCadence] = useState<HabitCadenceType>(initial?.cadenceType ?? "daily");
  const [days, setDays] = useState<number[]>(initial?.specificDays ?? [6, 0]);
  const [count, setCount] = useState(initial?.targetCount ?? 2);
  const [period, setPeriod] = useState<"week" | "month">(initial?.targetPeriod ?? "week");
  const [color, setColor] = useState<HabitColor>(initial?.color ?? "tomato");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError("Give your habit a name.");
    if (cadence === "specific_days" && days.length === 0) return setError("Pick at least one day.");
    const data: HabitInput = { title: t, color, cadenceType: cadence };
    if (cadence === "specific_days") data.specificDays = [...days].sort();
    if (cadence === "target_frequency") {
      data.targetCount = count;
      data.targetPeriod = period;
    }
    onSubmit(data);
  };

  const max = period === "week" ? 7 : 31;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="habit-title">Habit name</Label>
        <Input
          id="habit-title"
          value={title}
          autoFocus
          maxLength={120}
          placeholder="Morning 30-minute run"
          aria-invalid={!!error && !title.trim()}
          aria-describedby={error ? "habit-error" : undefined}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">How often?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CADENCES.map((c) => (
            <label
              key={c.value}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
                cadence === c.value ? "border-primary bg-primary/10" : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="cadence"
                value={c.value}
                checked={cadence === c.value}
                onChange={() => setCadence(c.value)}
                className="sr-only"
              />
              <span className="font-medium">{c.label}</span>
              <span className="text-xs text-muted-foreground">{c.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {cadence === "specific_days" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">On these days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEK_ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  type="button"
                  key={d}
                  aria-pressed={on}
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                  className={cn(
                    "h-11 min-w-11 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {DAY_SHORT[d]}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {cadence === "target_frequency" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border" role="group" aria-label="Times per period">
            <Button type="button" variant="ghost" className="h-11 w-11" aria-label="Fewer" onClick={() => setCount(Math.max(1, count - 1))}>
              −
            </Button>
            <output aria-live="polite" className="w-8 text-center font-semibold tabular-nums">{count}</output>
            <Button type="button" variant="ghost" className="h-11 w-11" aria-label="More" onClick={() => setCount(Math.min(max, count + 1))}>
              +
            </Button>
          </div>
          <span className="text-sm">times per</span>
          <select
            aria-label="Period"
            value={period}
            onChange={(e) => {
              const p = e.target.value as "week" | "month";
              setPeriod(p);
              if (p === "week") setCount(Math.min(count, 7));
            }}
            className="h-11 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {HABIT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "h-11 w-11 rounded-full border-4 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                color === c ? "scale-110 border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: `var(--habit-${c})` }}
            />
          ))}
        </div>
      </fieldset>

      {error && (
        <p id="habit-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 px-6">
          {initial ? "Save changes" : "Add habit"}
        </Button>
      </div>
    </form>
  );
}
