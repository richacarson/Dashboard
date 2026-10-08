#!/usr/bin/env node
/**
 * Catch temporal-dead-zone hazards in React components.
 *
 * A useMemo body runs DURING render, so if it reads a const declared further
 * down the component it throws "Cannot access 'x' before initialization" on the
 * first render and the error boundary swallows the whole app. esbuild compiles
 * such a reference happily — same blind spot that hides undefined identifiers —
 * so the build passing says nothing about this.
 *
 * It happened once: the allocation memos were placed ~150 lines above the refs
 * they read, and took the dashboard down.
 *
 * useCallback is deliberately NOT checked. Its body runs when invoked, by which
 * point every declaration exists, so flagging it is pure noise.
 *
 * Usage:  node scripts/check-render-order.mjs [file ...]
 * Exits non-zero if a hazard is found.
 */
import { readFileSync } from "node:fs";

const files = process.argv.slice(2).length ? process.argv.slice(2) : ["src/App.jsx"];
let failures = 0;

// Strings and comments hold identifiers that are not references; counting
// brackets inside them is also what made an earlier version over-read.
function strip(line) {
  return line
    .replace(/\\./g, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/\/\/.*$/, "");
}

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");

  // Component-scope declarations: two-space indent, const or let.
  const declaredAt = new Map();
  lines.forEach((ln, i) => {
    const m = /^ {2}(?:const|let)\s+(?:\[\s*)?([A-Za-z_$][\w$]*)/.exec(strip(ln));
    if (m && !declaredAt.has(m[1])) declaredAt.set(m[1], i);
  });

  for (let i = 0; i < lines.length; i++) {
    const m = /^ {2}const\s+([A-Za-z_$][\w$]*)\s*=\s*useMemo\(/.exec(strip(lines[i]));
    if (!m) continue;
    const name = m[1];

    // Walk to the matching close paren, counting only outside strings/comments.
    // Starting depth at 0 and breaking when it returns to 0 keeps a one-line
    // useMemo from swallowing the next line, which produced false positives.
    let depth = 0, end = i;
    for (let j = i; j < lines.length; j++) {
      const t = strip(lines[j]);
      for (const ch of t) { if (ch === "(") depth++; else if (ch === ")") depth--; }
      end = j;
      if (depth <= 0) break;
    }

    // The dependency array is a reference list, not executed during render, but
    // anything it names is read in the body anyway — so scanning the whole span
    // is correct and simpler.
    const body = lines.slice(i, end + 1).map(strip).join("\n");
    const seen = new Set();
    for (const [, ident] of body.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (ident === name || seen.has(ident)) continue;
      seen.add(ident);
      const d = declaredAt.get(ident);
      if (d !== undefined && d > i) {
        console.error(
          `${file}:${i + 1}  ${name} reads '${ident}', declared later at line ${d + 1}` +
          `\n    useMemo runs during render — this throws on first render.`
        );
        failures++;
      }
    }
  }
}

if (failures) {
  console.error(`\n${failures} render-order hazard(s). Move the useMemo below what it reads.`);
  process.exit(1);
}
console.log("render-order check: clean");
