# Deployment

When asked to deploy, handle the full deployment process — don't ask the user to do it. Steps:

1. Build with `npm run build`
2. Push the branch
3. Create a PR via `gh api repos/richacarson/Dashboard/pulls -X POST` with title/head/base/body fields
4. Extract the PR number from the response, then merge via `gh api repos/richacarson/Dashboard/pulls/{number}/merge -X PUT -f merge_method="merge"`

Merging to main triggers the GitHub Pages deploy workflow automatically.
