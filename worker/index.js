/**
 * API key proxy for the Dashboard.
 *
 * Why this exists: the dashboard is a static Vite site on GitHub Pages, and Vite inlines
 * every `import.meta.env.VITE_*` value into the public JS bundle at build time. A key put
 * in a GitHub secret is protected in the repo and CI logs, but it still ships as a plain
 * string literal in dist/assets/index-*.js, which anyone can read. Routing these calls
 * through this Worker keeps the keys server-side — they never reach the browser.
 *
 * Routes (all preserve the upstream path and query string):
 *   /fmp/*        -> financialmodelingprep.com, apikey appended here
 *   /anthropic/*  -> api.anthropic.com, x-api-key attached here
 *   /yahoo/*      -> query1.finance.yahoo.com, no key — this exists purely to add the
 *                    CORS header Yahoo omits, which is what blocks it from the browser.
 *
 * Deploy: see README.md in this directory.
 */

const UPSTREAM = {
  fmp: { host: "https://financialmodelingprep.com", auth: "query", param: "apikey", secret: "FMP_KEY" },
  anthropic: { host: "https://api.anthropic.com", auth: "header", param: "x-api-key", secret: "ANTHROPIC_KEY" },
  yahoo: { host: "https://query1.finance.yahoo.com", auth: "none" },
};

// Only these origins may use the proxy. An Origin header is trivially forged outside a
// browser, so this is not airtight — but it stops the realistic threat here, which is a
// key scraped out of the public bundle and reused from another site. The key itself never
// leaves the Worker, which is the actual protection.
function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, env) {
  const list = allowedOrigins(env);
  const ok = origin && (list.includes(origin) || list.includes("*"));
  return {
    "Access-Control-Allow-Origin": ok ? origin : list[0] || "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, anthropic-version, anthropic-dangerous-direct-browser-access",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const list = allowedOrigins(env);
    // Browsers always send Origin on cross-origin calls; allow a missing one so the route
    // stays testable with curl, but never allow an origin that is present and unlisted.
    if (origin && !list.includes("*") && !list.includes(origin)) {
      return new Response(JSON.stringify({ error: "origin not allowed" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const [, service, ...rest] = url.pathname.split("/");
    const target = UPSTREAM[service];
    if (!target) {
      return new Response(JSON.stringify({ error: "unknown service", services: Object.keys(UPSTREAM) }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const upstream = new URL(`${target.host}/${rest.join("/")}`);
    for (const [k, v] of url.searchParams) upstream.searchParams.set(k, v);

    const headers = new Headers();
    const ct = request.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);

    if (target.auth === "query") {
      const key = env[target.secret];
      if (!key) return new Response(JSON.stringify({ error: `${target.secret} not configured` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      upstream.searchParams.set(target.param, key);
    } else if (target.auth === "header") {
      const key = env[target.secret];
      if (!key) return new Response(JSON.stringify({ error: `${target.secret} not configured` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      headers.set(target.param, key);
      // Anthropic requires a version; pass the caller's through or default.
      headers.set("anthropic-version", request.headers.get("anthropic-version") || "2023-06-01");
    } else {
      // Yahoo 401s requests without a browser-ish UA.
      headers.set("User-Agent", "Mozilla/5.0 (compatible; DashboardProxy/1.0)");
    }

    let res;
    try {
      res = await fetch(upstream.toString(), {
        method: request.method,
        headers,
        body: request.method === "POST" ? request.body : undefined,
        redirect: "follow",
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "upstream fetch failed", detail: String(e) }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Stream the body through unchanged, but never leak upstream auth/set-cookie headers.
    const out = new Headers(cors);
    const passthrough = ["content-type", "cache-control", "content-encoding"];
    for (const h of passthrough) {
      const v = res.headers.get(h);
      if (v) out.set(h, v);
    }
    return new Response(res.body, { status: res.status, headers: out });
  },
};
