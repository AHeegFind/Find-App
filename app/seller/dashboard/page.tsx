"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SellerDashboard() {
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [offeredSlots, setOfferedSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: biz } = await supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle();
    setBusiness(biz);

    if (biz) {
      const { data: prods } = await supabase
        .from("products")
        .select("*, product_images(id, raw_image_url, processed_image_url, is_primary, approved), ai_processing_jobs(id, job_type, status, error_message)")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: false });
      setProducts(prods || []);

      const productIds = (prods || []).map((p) => p.id);
      if (productIds.length > 0) {
        const { data: slots } = await supabase
          .from("featured_slots")
          .select("*, products(name)")
          .in("product_id", productIds)
          .eq("status", "offered")
          .order("payment_deadline", { ascending: true });
        setOfferedSlots(slots || []);
      }
    }
    setLoading(false);
  }

  async function paySlot(slotId: string) {
    setPayingId(slotId);
    const resp = await fetch(`/api/seller/featured-slots/${slotId}/pay`, { method: "POST" });
    setPayingId(null);
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      alert(data.error || "Could not confirm payment. Please contact Find support.");
      return;
    }
    load();
  }

  if (loading) return <div className="wrap" style={{ paddingTop: 40, textAlign: "center", color: "var(--ink-secondary)" }}>Loading…</div>;

  if (!business) {
    return (
      <div className="wrap" style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 500, marginBottom: 10 }}>No business registered yet</div>
        <a href="/seller/apply" className="btn-primary" style={{ display: "inline-block" }}>Register your business</a>
      </div>
    );
  }

  const statusLabel: Record<string, string> = { unverified: "Unverified", pending: "Pending review", verified: "Verified", rejected: "Rejected", suspended: "Suspended" };

  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 500 }}>{business.name}</div>
          <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 4 }}>{business.location}</div>
        </div>
        <span className={business.verification_status === "verified" ? "badge-verified" : "badge-found"}>
          {statusLabel[business.verification_status]}
        </span>
      </div>

      {offeredSlots.length > 0 && (
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {offeredSlots.map((s) => (
            <div key={s.id} style={{ background: "var(--ink)", color: "var(--background)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>You've been selected to feature</div>
              <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 10, lineHeight: 1.5 }}>
                "{s.products?.name}" in {s.discover_section} for {s.duration_days} days — KSh {Number(s.price).toLocaleString()}.
                Pay by {new Date(s.payment_deadline).toLocaleDateString()} or the offer lapses.
              </div>
              <button
                onClick={() => paySlot(s.id)}
                disabled={payingId === s.id}
                style={{ background: "var(--background)", color: "var(--ink)", border: "none", borderRadius: 999, padding: "10px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
              >
                {payingId === s.id ? "Confirming…" : "Pay & go live"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <a href="/seller/upload" className="btn-primary" style={{ flex: 1, textAlign: "center" }}>
          + Upload new product
        </a>
        <a href="/seller/analytics" className="btn-outline" style={{ flex: 1, textAlign: "center" }}>
          Analytics
        </a>
      </div>

      <div className="section-label">Your products ({products.length})</div>
      {products.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", padding: "10px 0" }}>No products yet. Upload your first one above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {products.map((p) => {
            const img = p.product_images?.find((i: any) => i.is_primary) || p.product_images?.[0];
            const imgUrl = img?.processed_image_url || img?.raw_image_url;
            const jobs = p.ai_processing_jobs || [];
            const anyFailed = jobs.some((j: any) => j.status === "failed");
            const anyProcessing = jobs.some((j: any) => j.status === "pending" || j.status === "processing");
            return (
              <div key={p.id} style={{ display: "flex", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "var(--surface-container-high)" }}>
                  {imgUrl && <img src={imgUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-secondary)", marginTop: 2 }}>
                    {p.currency || "KSh"} {Number(p.price).toLocaleString()}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: p.moderation_status === "approved" ? "rgba(226,167,143,0.12)" : "var(--surface-container-high)", color: p.moderation_status === "approved" ? "var(--ink)" : "var(--ink-secondary)" }}>
                      {p.moderation_status}
                    </span>
                    {anyProcessing && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--surface-container-high)", color: "var(--ink-secondary)" }}>AI processing…</span>}
                    {anyFailed && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(255,180,171,0.15)", color: "var(--error)" }}>AI job failed</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
