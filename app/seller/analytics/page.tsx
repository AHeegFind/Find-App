"use client";
import { useEffect, useState } from "react";

export default function SellerAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/seller/analytics")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Could not load analytics");
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="wrap" style={{ paddingTop: 40, textAlign: "center", color: "var(--ink-secondary)" }}>Loading…</div>;
  if (error) return <div className="wrap" style={{ paddingTop: 40, textAlign: "center" }}><div style={{ fontSize: 13, color: "var(--error)" }}>{error}</div></div>;

  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Analytics</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", marginBottom: 24 }}>Last 30 days, across all your products.</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 30 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 18, textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, fontWeight: 600 }}>{data.totalViews}</div>
          <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 4 }}>Total views</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 18, textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, fontWeight: 600 }}>{data.totalSaves}</div>
          <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 4 }}>Total saves</div>
        </div>
      </div>

      <div className="section-label">Your products, by views</div>
      {data.byProduct.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", padding: "10px 0 30px" }}>No views yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 30 }}>
          {data.byProduct.map((p: any, i: number) => (
            <div key={p.productId} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
              {i === 0 && p.views > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: "var(--ink)", color: "var(--background)", padding: "3px 7px", borderRadius: 3 }}>
                  Top
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                {p.views} view{p.views === 1 ? "" : "s"} · {p.saves} save{p.saves === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-label">What people were searching for</div>
      {data.topSearchTerms.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", padding: "10px 0" }}>Not enough search activity yet to show trends.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {data.topSearchTerms.map((t: any, i: number) => (
            <span key={i} className="chip" style={{ cursor: "default" }}>
              {t.term} <span style={{ opacity: 0.6, marginLeft: 4 }}>×{t.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
