# Win Keeper Log

I want this app to track day-to-day activities that people usually do. They should be able to tell this app that I want to track habits like going for a 30 minutes run every day morning, reading the newspaper, or playing cricket.

Habits need not be daily only: daily, specific days of the week (like weekends), or recurring target frequencies (like twice a week).

Streaks are strict:
- For daily habits, streaks track consecutive daily completions; missing a day resets streak to 0.
- For weekly habits with specific days (e.g. Saturday and Sunday), all required days must be completed in the week, or the streak resets to 0.
- For flexible target counts (e.g. twice a week), count the week as complete once the target count of sessions is logged.
- All data stays strictly on the user device in localStorage, with no account or backend sync.

Design the localStorage module contract first: load, save, the data schema, and what happens when stored data is missing or from an older version. Then build a minimal, accessible UI: a list of habits, a way to mark today done, and a streak display. Keep it production-quality. Please inspect the attached SPEC.md and tasks/plan.md.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://win-keeper-log.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ffa6ac2d-0cbc-4349-9c37-4269bc2f292c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
