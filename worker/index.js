/**
 * FMP key proxy for the Dashboard.
 *
 * The dashboard is a static Vite site on GitHub Pages, and Vite inlines every
 * import.meta.env.VITE_* value into the public bundle at build time. A key in a
 * GitHub secret is therefore still readable by anyone who opens the site. This
 * Worker holds the key instead, so it never reaches the browser.
 *
 * The app calls:  <worker>/fmp/api/v3/quote/DVY,IUSG
 * which is forwarded to financialmodelingprep.com with apikey appended here.
 *
 * Setup: add a Secret named FMP_KEY in the Worker's Settings, then Deploy.
 */

const ALLOWED = "https://richacarson.github.io";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED,
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // Browsers always send Origin cross-origin. Allow a missing one so the URL stays
    // testable from a browser tab or curl, but reject any origin that isn't ours.
    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== ALLOWED) {
      return new Response(JSON.stringify({ error: "origin not allowed" }), { status: 403, headers: cors });
    }

    if (!env.FMP_KEY) {
      return new Response(JSON.stringify({ error: "FMP_KEY secret not set" }), { status: 500, headers: cors });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/fmp/")) {
      return new Response(JSON.stringify({ error: "use /fmp/<upstream path>" }), { status: 404, headers: cors });
    }

    const target = new URL("https://financialmodelingprep.com" + url.pathname.slice(4));
    for (const [k, v] of url.searchParams) target.searchParams.set(k, v);
    target.searchParams.set("apikey", env.FMP_KEY);

    let res;
    try {
      res = await fetch(target.toString());
    } catch (e) {
      return new Response(JSON.stringify({ error: "upstream failed" }), { status: 502, headers: cors });
    }

    // Pass the body through, but never echo upstream auth/set-cookie headers back.
    return new Response(res.body, {
      status: res.status,
      headers: { ...cors, "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  },
};
