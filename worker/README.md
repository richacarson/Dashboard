# Dashboard API proxy (Cloudflare Worker)

Keeps API keys out of the browser.

## Why

The dashboard is a static Vite site on GitHub Pages. Vite inlines every
`import.meta.env.VITE_*` value into the public JS bundle at build time, so a key stored as
a GitHub secret is still shipped as a plain string in `dist/assets/index-*.js`:

```
Io="your-actual-api-key"     <- readable by anyone who opens the site
```

The repo is public and Pages is enabled, so those keys are harvestable. The app's passcode
gate doesn't help — the bundle downloads before anyone types anything.

This Worker holds the keys server-side and forwards requests, so the browser never sees them.

## Setup (one time, ~5 minutes)

```bash
cd worker
npm install -g wrangler        # if you don't have it
wrangler login                 # opens a browser to authorise

# Store the keys as Worker secrets (encrypted, never in git)
wrangler secret put FMP_KEY            # paste the premium FMP key
wrangler secret put ANTHROPIC_KEY      # paste the Anthropic key

wrangler deploy
```

Deploy prints your URL, e.g. `https://dashboard-api-proxy.<subdomain>.workers.dev`.

Then add it as a repo secret so the app routes through it:

- GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**
- Name: `PROXY_URL`
- Value: the Worker URL (no trailing slash)

The deploy workflow already maps `PROXY_URL` → `VITE_PROXY_URL`. Re-run the deploy.

**If `VITE_PROXY_URL` is unset the app calls the APIs directly, exactly as before** — so
deploying the app change alone is safe, and the proxy activates only once you set it.

## Verify

```bash
# should return quotes
curl "https://<your-worker>.workers.dev/fmp/api/v3/quote/DVY,IUSG"

# should return live Yahoo data (this is the call browsers can't make directly)
curl "https://<your-worker>.workers.dev/yahoo/v8/finance/chart/DVY?range=1d&interval=1m"

# should be rejected
curl -H "Origin: https://evil.example" "https://<your-worker>.workers.dev/fmp/api/v3/quote/DVY"
```

## Rotate the exposed keys

Any key that has already shipped in the public bundle should be considered compromised.
After the proxy is live, rotate them at the provider and update:

- `FMP_KEY` / `ANTHROPIC_KEY` → `wrangler secret put ...` (Worker only)
- Remove `VITE_FMP_KEY` and `VITE_ANTHROPIC_KEY` from the GitHub Actions secrets once no
  direct-call path remains, so they stop being baked into the bundle.

Keys that remain in the bundle for now (Alpaca, Finnhub, FRED) are lower value but can be
moved behind the same Worker later by adding entries to `UPSTREAM` in `index.js`.
`VITE_SUPABASE_ANON_KEY` is designed to be public — leave it, but confirm row-level
security is enabled.

## Cost

Cloudflare's free tier covers 100,000 requests/day. This dashboard polls roughly a few
thousand per day, so it stays free.
