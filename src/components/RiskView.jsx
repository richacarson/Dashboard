// src/components/RiskView.jsx
// Risk Sentinel view — shared by BOTH the classic Risk tab and the terminal
// Risk drawer so the two layouts never drift. Reads public/risk-monitor.json
// (fetched by the parent and passed in as riskData/riskLoadDone).

export default function RiskView({ riskData, riskLoadDone, C, isDesktop }) {
  const sevColor = (s) => s === "red" ? C.dn : s === "amber" ? C.warn : C.up;
  const sevSoft = (s) => s === "red" ? C.dnSoft : s === "amber" ? "rgba(217,119,6,0.12)" : C.upSoft;
  const d = riskData;

  if (!riskLoadDone && !d) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
      <div style={{ fontSize: 13, color: C.t4 }}>Loading risk monitor…</div>
    </div>
  );
  if (!d) return (
    <div style={{ textAlign: "center", padding: 48, color: C.t4 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.t3, marginBottom: 6 }}>No risk read yet</div>
      <div style={{ fontSize: 12 }}>The Risk Sentinel writes <code>risk-monitor.json</code> on its next run.</div>
    </div>
  );

  const flags = Array.isArray(d.flags) ? d.flags : [];
  const sevRank = { red: 0, amber: 1, green: 2 };
  const sorted = [...flags].sort((a, b) =>
    (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3)
    || Math.abs(b?.metric?.day_move_pct || 0) - Math.abs(a?.metric?.day_move_pct || 0));
  const pill = (label, n, s) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, background: sevSoft(s), border: `1px solid ${sevColor(s)}33` }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sevColor(s) }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{n ?? 0}</span>
      <span style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>{label}</span>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
      {/* Header */}
      {!isDesktop && <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Defense</div>}
      <div style={{ fontSize: isDesktop ? 20 : 24, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Risk Sentinel</div>
      <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>
        Daily holdings risk read{d.as_of_session ? ` · session ${d.as_of_session}` : ""}{d.generated_at ? ` · updated ${new Date(d.generated_at).toLocaleString()}` : ""}
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {pill("Red", d.summary?.red, "red")}
        {pill("Amber", d.summary?.amber, "amber")}
        {pill("Clear", d.summary?.green, "green")}
        {typeof d.universe_count === "number" && (
          <div style={{ display: "flex", alignItems: "center", padding: "7px 13px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, fontSize: 11, color: C.t3, fontWeight: 600 }}>
            {d.universe_count} names{d.universe_incomplete ? " · partial coverage" : ""}
          </div>
        )}
      </div>

      {/* Headline */}
      {d.summary?.headline && (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: C.t2, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
          {d.summary.headline}
        </div>
      )}

      {/* Roster integrity banner */}
      {d.roster_integrity && d.roster_integrity.ok === false && Array.isArray(d.roster_integrity.issues) && d.roster_integrity.issues.length > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: C.dnSoft, border: `1px solid ${C.dn}55`, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.dn, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Roster integrity</div>
          {d.roster_integrity.issues.map((it, i) => (
            <div key={i} style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.5, marginBottom: 4 }}>
              <strong style={{ color: C.t1 }}>{it.ticker}</strong> — {it.detail}{it.action ? <span style={{ color: C.t3 }}> · {it.action}</span> : null}
            </div>
          ))}
        </div>
      )}

      {/* Flags */}
      {!sorted.length ? (
        <div style={{ textAlign: "center", padding: 36, color: C.t4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.up, marginBottom: 4 }}>Book is calm</div>
          <div style={{ fontSize: 12 }}>No flags raised this run.</div>
        </div>
      ) : sorted.map((f, i) => (
        <div key={f.id || i} style={{ padding: "13px 15px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sevColor(f.severity)}`, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>{f.ticker}</span>
            {f.sleeve && <span style={{ fontSize: 10, color: C.t4, fontWeight: 600 }}>{f.sleeve}</span>}
            {f.category && <span style={{ fontSize: 10, color: C.t3, padding: "2px 8px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.category}</span>}
            {f.status && f.status !== "new" && <span style={{ fontSize: 10, color: C.t4, fontStyle: "italic" }}>{f.status}</span>}
            <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: sevColor(f.severity), textTransform: "uppercase", letterSpacing: 1 }}>{f.severity}</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{f.headline}</div>
          {f.detail && <div style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.5, marginBottom: 6 }}>{f.detail}</div>}
          {f.thesis_link && (
            <div style={{ fontSize: 11.5, color: C.accent, lineHeight: 1.45, marginBottom: 6 }}>
              ↳ Thesis test: {f.thesis_link}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: C.t3 }}>
            {f.metric?.price != null && <span>${Number(f.metric.price).toFixed(2)}</span>}
            {f.metric?.day_move_pct != null && <span style={{ color: f.metric.day_move_pct < 0 ? C.dn : C.up }}>{f.metric.day_move_pct > 0 ? "+" : ""}{f.metric.day_move_pct}%</span>}
            {f.metric?.level_ref && <span>{f.metric.level_ref}</span>}
            {Array.isArray(f.evidence) && f.evidence.map((e, j) => e?.url && (
              <a key={j} href={e.url} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>{e.source || "source"} ↗</a>
            ))}
          </div>
        </div>
      ))}

      {/* Deal watch */}
      {Array.isArray(d.deal_watch) && d.deal_watch.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Deal Watch</div>
          {d.deal_watch.map((dw, i) => (
            <div key={i} style={{ padding: "11px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{dw.ticker}</span>
                <span style={{ fontSize: 11, color: sevColor(dw.severity), fontWeight: 700, textTransform: "uppercase" }}>{dw.status}</span>
                {dw.last_checked && <span style={{ marginLeft: "auto", fontSize: 10, color: C.t4 }}>checked {dw.last_checked}</span>}
              </div>
              {dw.terms && <div style={{ fontSize: 12, color: C.t2 }}>{dw.terms}</div>}
              {dw.gate && <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2 }}>Gate: {dw.gate}</div>}
              {dw.note && <div style={{ fontSize: 11, color: C.t4, marginTop: 2 }}>{dw.note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Levels */}
      {Array.isArray(d.levels) && d.levels.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Active Levels</div>
          {d.levels.map((lv, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, marginBottom: 6, fontSize: 12.5 }}>
              <span style={{ fontWeight: 800, color: C.t1 }}>{lv.ticker}</span>
              <span style={{ color: C.t3 }}>{lv.type} {lv.level}</span>
              {lv.interaction && <span style={{ marginLeft: "auto", color: lv.interaction === "breached" ? C.dn : lv.interaction === "approaching" ? C.warn : C.t4, fontWeight: 700 }}>{lv.interaction}{lv.distance_pct != null ? ` · ${lv.distance_pct}%` : ""}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Calendar */}
      {Array.isArray(d.calendar) && d.calendar.length > 0 && (
        <div style={{ marginTop: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Catalyst Calendar</div>
          {d.calendar.map((ev, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sevColor(ev.severity)}`, marginBottom: 6, fontSize: 12.5 }}>
              <span style={{ fontWeight: 800, color: C.t1 }}>{ev.ticker}</span>
              <span style={{ color: C.t2 }}>{ev.event}</span>
              {ev.date && <span style={{ marginLeft: "auto", color: C.t3 }}>{ev.date}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
