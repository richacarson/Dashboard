/**
 * FMP key proxy for the Dashboard.
 *
 * The dashboard is a static Vite site on GitHub Pages, and Vite inlines every
 * import.meta.env.VITE_* value into the public bundle at build time. A key in a
 * GitHub secret is therefore still readable by anyone who opens the site. This
 * Worker holds the key instead, so it never reaches the browser.
 *
 * The app calls:  <worker>/fmp/stable/quote?symbol=DVY
 * which is forwarded to financialmodelingprep.com with apikey appended here.
 *
 * It also opens a WebSocket at <worker>/ws. FMP's socket authenticates with a
 * login frame carrying the API key, which the browser must never hold — so the
 * Worker terminates the browser socket, opens its own upstream socket, and sends
 * the login frame itself. See wsProxy() below.
 *
 * Setup: add a Secret named FMP_KEY in the Worker's Settings, then Deploy.
 */

const ALLOWED = "https://richacarson.github.io";
const FMP_WS = "wss://socket.financialmodelingprep.com";

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

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response(JSON.stringify({ error: "expected websocket upgrade" }), { status: 426, headers: cors });
      }
      return wsProxy(env.FMP_KEY, cors);
    }

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

/**
 * Terminate the browser's WebSocket here and relay it to FMP's, injecting the login
 * frame so the key stays server-side.
 *
 * Two rules on the browser->upstream direction:
 *   - Frames are held until FMP confirms the login, because a subscribe sent before
 *     auth is silently dropped.
 *   - Only subscribe/unsubscribe are relayed. The client has no business sending a
 *     login of its own, and dropping everything else keeps this from becoming an
 *     open relay to FMP's socket for anyone who can reach the Worker.
 */
async function wsProxy(apiKey, cors) {
  let upstream;
  try {
    const res = await fetch(FMP_WS.replace("wss://", "https://"), { headers: { Upgrade: "websocket" } });
    upstream = res.webSocket;
  } catch (e) {
    upstream = null;
  }
  if (!upstream) {
    return new Response(JSON.stringify({ error: "upstream websocket failed" }), { status: 502, headers: cors });
  }
  upstream.accept();

  const [client, browser] = Object.values(new WebSocketPair());
  browser.accept();

  let authed = false;
  const queued = [];

  upstream.addEventListener("message", (e) => {
    if (!authed) {
      try {
        const msg = JSON.parse(typeof e.data === "string" ? e.data : "");
        if (msg?.event === "login" && msg?.data?.status === 200) {
          authed = true;
          for (const m of queued.splice(0)) upstream.send(m);
        }
      } catch {}
    }
    try { browser.send(e.data); } catch {}
  });
  const bye = (code, reason) => { try { browser.close(code, reason); } catch {} };
  upstream.addEventListener("close", (e) => bye(e.code >= 1000 && e.code < 5000 ? e.code : 1011, e.reason || ""));
  upstream.addEventListener("error", () => bye(1011, "upstream error"));

  browser.addEventListener("message", (e) => {
    let msg;
    try { msg = JSON.parse(typeof e.data === "string" ? e.data : ""); } catch { return; }
    if (msg?.event !== "subscribe" && msg?.event !== "unsubscribe") return;
    const frame = JSON.stringify(msg);
    if (authed) { try { upstream.send(frame); } catch {} } else { queued.push(frame); }
  });
  const hangUp = () => { try { upstream.close(1000, "client gone"); } catch {} };
  browser.addEventListener("close", hangUp);
  browser.addEventListener("error", hangUp);

  try { upstream.send(JSON.stringify({ event: "login", data: { apiKey } })); } catch {}

  return new Response(null, { status: 101, webSocket: client });
}
