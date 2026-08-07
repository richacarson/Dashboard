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
curl "https://<your-worker>.workers.dev/fmp/stable/batch-quote?symbols=DVY,IUSG"

# should be rejected
curl -H "Origin: https://evil.example" "https://<your-worker>.workers.dev/fmp/stable/quote?symbol=DVY"
```

Note the `/stable/` prefix. FMP retired `/api/v3` for subscriptions started after
2025-08-31, and the retired endpoints answer **HTTP 200** with an `Error Message` body —
so `r.ok` checks pass and parsers just find nothing. Everything here is on `/stable/`.

## WebSocket (`/ws`)

DVY and IUSG don't trade on Alpaca's IEX feed, so they used to be polled while SPY/QQQ/DIA
streamed. `<worker>/ws` gives them a stream too.

FMP authenticates its socket with a login frame carrying the API key, which is exactly the
thing that must not reach the browser. So the Worker terminates the browser's socket, opens
its own upstream socket, and sends the login frame itself. It relays only `subscribe` and
`unsubscribe` frames back upstream — a client can't send its own login, and the Worker
isn't an open relay to FMP's socket. Client frames are queued until FMP confirms the login,
because a subscribe sent before auth is silently dropped.

```bash
# should print an authenticated login response
npx wscat -c "wss://<your-worker>.workers.dev/ws"
```

**Live vs delayed:** FMP gates live streaming quotes behind a user declaration form
(contact marketdata@financialmodelingprep.com). Until that's approved the socket may
deliver delayed data or nothing at all. The app treats the stream as strictly additive: if
no tick arrives for a symbol within 90s the existing poller covers it, exactly as before.

## Rotate the exposed keys

Any key that has already shipped in the public bundle should be considered compromised.
After the proxy is live, rotate them at the provider and update:

- `FMP_KEY` / `ANTHROPIC_KEY` → `wrangler secret put ...` (Worker only)
- Remove `VITE_FMP_KEY` and `VITE_ANTHROPIC_KEY` from the GitHub Actions secrets once no
  direct-call path remains, so they stop being baked into the bundle.

Keys that remain in the bundle for now (Alpaca, Finnhub) are lower value but can be moved
behind the same Worker later. `VITE_FRED_KEY` is gone — the browser reads the yield curve
from FMP with the keyless fredgraph CSV as fallback, and `FRED_API_KEY` is now only used
server-side by `update-calendar.yml`.
`VITE_SUPABASE_ANON_KEY` is designed to be public — leave it, but confirm row-level
security is enabled.

## Cost

Cloudflare's free tier covers 100,000 requests/day. This dashboard polls roughly a few
thousand per day, so it stays free.
