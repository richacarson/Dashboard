# Deployment

You have standing permission to deploy, unprompted and without asking for
confirmation. Granted by Carson on 2026-10-05. This applies to every change,
including ones that touch portfolio math — say clearly in your reply what a
change does to the numbers, but do not hold the deploy waiting on a reply.

The only precondition is that `npm run build` passes. Never ship a build you
have not seen succeed: check the exit code and read the output rather than
filtering it through `grep`, which has twice hidden a real failure (a missing
`node_modules` surfacing as `vite: not found`).

Steps:

1. Build with `npm run build`
2. Push the branch
3. Create a PR via `gh api repos/richacarson/Dashboard/pulls -X POST` with title/head/base/body fields
4. Extract the PR number from the response, then merge via `gh api repos/richacarson/Dashboard/pulls/{number}/merge -X PUT -f merge_method="merge"`

Merging to main triggers the GitHub Pages deploy workflow automatically.

Confirm the deploy actually landed rather than assuming the merge was enough.
Watch the run to completion, and on failure read the Pages *deployment status*
progression, not just the job conclusion — a healthy deploy goes
`waiting -> queued -> in_progress -> success` in seconds, while a job that
never gets a runner sits in `queued` and errors at exactly 15:00 with zero
steps recorded. That signature means GitHub infrastructure, not the repo;
check https://www.githubstatus.com/api/v2/summary.json before retrying, since
each attempt costs 15 minutes.

The scheduled jobs (calendars, attribution, portfolio history, fundamentals)
push to main several times a day and each push re-triggers the Pages deploy,
so anything merged to main ships within hours even if your own deploy attempt
fails. Holding a change on a branch is the only thing that keeps it off the
live site.
