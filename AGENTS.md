<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Habit data lives only in browser localStorage via `src/lib/habits/storage.ts` (load/save never throw; version + migrate there) — the app is local-only by spec, no backend.
- Streak logic is pure in `src/lib/habits/streaks.ts` with `today` injected — keeps rules unit-testable and timezone-local.
- Storage is read in `useEffect` (useHabitTracker), never during render — avoids SSR hydration mismatch.
