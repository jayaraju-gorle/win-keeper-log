# Streakly — Launch Plan (v1)

## 1. Pre-launch checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Unit tests pass (`bun run test`) — 24/24 | PASS |
| 2 | Typecheck clean (`tsgo --noEmit`) | PASS |
| 3 | Lint: 0 errors (6 pre-existing warnings in generated UI kit) | PASS |
| 4 | Browser flow: create habit, mark done, streak updates, reload persists | PASS |
| 5 | Two-tab sync: change in one tab appears in the other | PASS |
| 6 | No XSS sinks: habit text rendered as React text only; colours allow-listed | PASS |
| 7 | Tampered/corrupt storage: bounded dates, deduped ids, single backup slot | PASS |
| 8 | Feature flag `intervalHabits` defaults OFF in production build | PASS (verified in browser) |
| 9 | Unique title/description/OG tags on `/` | PASS |
| 10 | Accessibility: labelled controls, 44px targets, keyboard focus rings | PASS (manual; no automated axe run) |
| 11 | Real-device check on mobile Safari / Android Chrome | OPEN — do before announcing |
| 12 | Placeholder app name "Streakly" confirmed by owner | OPEN |
| 13 | Habit history calendar (in plan) | DEFERRED — not a launch blocker |
| 14 | Text length caps on saved ids / "completedAt" format check | DEFERRED (low severity) |

## 2. Feature flag: `intervalHabits` ("Every few days")

- New habit type `interval`: once every N days (2–14). Streak counts consecutive N-day windows (anchored on the habit's creation date) with at least one completion; the current window is pending until done.
- Flag: `src/lib/flags.ts`, read at build time from `VITE_FF_INTERVAL_HABITS`. Only the exact string `true` turns it on.
- The flag gates **creating** interval habits only. Saved interval habits always load, display, and stay editable, so turning the flag off never loses data.
- Enable: set `VITE_FF_INTERVAL_HABITS=true` in the build environment and redeploy. Disable: remove it and redeploy.

## 3. Deploy plan

### Recommended: Lovable hosting
1. Publish from the editor (Publish → Update). The current build is configured for this.
2. Smoke test the live URL: add a habit, tick it, reload, check the streak.

### Any static host (Netlify, Vercel static, GitHub Pages, S3+CloudFront, Cloudflare Pages)
The project currently builds a server-rendered bundle for an edge worker, not plain files. The app needs no server (all data is in the browser), so it can be static:
1. Switch TanStack Start to SPA / prerender mode for `/` (config change in `vite.config.ts`; verify output contains `index.html` + hashed assets).
2. `bun install && bun run test && bun run build`.
3. Upload the static output folder. Configure fallback to `index.html` for unknown paths.
4. Caching: `index.html` → `Cache-Control: no-cache`; hashed `assets/*` → `public, max-age=31536000, immutable`.
5. Keep the previous build's folder/deploy ID for rollback.
6. Smoke test as above, plus one tab-sync check.

## 4. Rollback

1. **Fastest:** turn the flag off (unset `VITE_FF_INTERVAL_HABITS`) and redeploy — use this if the problem is the new habit type.
2. **Full rollback:** Lovable → restore the previous version from history and Publish; static host → re-activate the previous deploy (Netlify/Vercel "promote previous", or re-upload the kept folder) and invalidate the CDN cache for `index.html`.
3. **Data safety:** user data lives only in each browser. Rolling back to any build **from this one onward** is safe. Rolling back to a build **before the interval type existed** would silently drop interval habits on its next save; only do that if the flag was never turned on in production.
4. Schema version is still 1; no migration to undo.
5. After rollback: repeat the smoke test and confirm existing habits and streaks still show.
