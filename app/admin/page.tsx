"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "applications" | "products" | "featured" | "jobs" | "requests";

const DISCOVER_SECTIONS = ["editors-picks", "unique-finds", "hidden-kenyan-brands", "nairobi-finds", "beautiful-homes", "under-20k"];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("applications");
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [approvedProducts, setApprovedProducts] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [offerForm, setOfferForm] = useState<{ productId: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuthorised(false); return; }
      const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { setAuthorised(false); return; }
      setAuthorised(true);
      loadAll(supabase);
    });
  }, []);

  async function loadAll(supabase: ReturnType<typeof createClient>) {
    const { data: apps } = await supabase
      .from("seller_applications")
      .select("*, businesses(id, name, location, whatsapp, instagram, website)")
      .order("created_at", { ascending: false });
    setApplications(apps || []);

    const { data: prods } = await supabase
      .from("products")
      .select("*, businesses(name), product_images(processed_image_url, raw_image_url, is_primary)")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: false });
    setProducts(prods || []);

    const { data: failedJobs } = await supabase
      .from("ai_processing_jobs")
      .select("*, products(name)")
      .eq("status", "failed")
      .order("created_at", { ascending: false });
    setJobs(failedJobs || []);

    const { data: findRequests } = await supabase
      .from("find_it_requests")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);
    setRequests(findRequests || []);

    const { data: approved } = await supabase
      .from("products")
      .select("id, name, price, currency, businesses(name)")
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })
      .limit(100);
    setApprovedProducts(approved || []);

    const slotsResp = await fetch("/api/admin/featured-slots");
    if (slotsResp.ok) {
      const slotsData = await slotsResp.json();
      setSlots(slotsData.slots || []);
    }
  }

  async function offerSlot(productId: string, params: { placementType: string; discoverSection?: string; keywords?: string[]; tier: "top" | "standard"; price: number }) {
    await fetch("/api/admin/featured-slots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId,
        placementType: params.placementType,
        discoverSection: params.discoverSection,
        keywords: params.keywords,
        positionTier: params.tier,
        price: params.price,
      }),
    });
    setOfferForm(null);
    const supabase = createClient();
    loadAll(supabase);
  }

  async function reviewApplication(applicationId: string, decision: "approved" | "rejected") {
    await fetch(`/api/admin/sellers/${applicationId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const supabase = createClient();
    loadAll(supabase);
  }

  async function reviewProduct(productId: string, decision: "approved" | "rejected") {
    await fetch(`/api/admin/products/${productId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const supabase = createClient();
    loadAll(supabase);
  }

  async function retryJob(jobId: string) {
    await fetch(`/api/admin/jobs/${jobId}/retry`, { method: "POST" });
    const supabase = createClient();
    loadAll(supabase);
  }

  if (authorised === null) return <div className="wrap" style={{ paddingTop: 40, textAlign: "center", color: "var(--ink-secondary)" }}>Loading…</div>;
  if (authorised === false) return <div className="wrap" style={{ paddingTop: 60, textAlign: "center" }}>
    <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 500 }}>Admin access only</div>
  </div>;

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="wordmark" style={{ fontSize: 20 }}>F<span className="q-glyph">?</span>ND Admin</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/api/admin/export?table=businesses" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", border: "1px solid var(--line-faint)", borderRadius: 999, padding: "6px 12px" }}>
            Export businesses
          </a>
          <a href="/api/admin/export?table=products" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", border: "1px solid var(--line-faint)", borderRadius: 999, padding: "6px 12px" }}>
            Export products
          </a>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "12px 20px 0", overflowX: "auto", background: "var(--surface)" }}>
        {(["applications", "products", "featured", "jobs", "requests"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ background: "none", border: "none", padding: "8px 14px", fontSize: 12.5, cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap",
              color: tab === t ? "var(--ink)" : "var(--ink-secondary)", fontWeight: tab === t ? 700 : 500,
              borderBottom: tab === t ? "2px solid var(--ink)" : "2px solid transparent" }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="wrap" style={{ paddingTop: 24 }}>
        {tab === "applications" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {applications.length === 0 && <EmptyNote text="No seller applications yet." />}
            {applications.map((app) => (
              <div key={app.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{app.businesses?.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 3 }}>{app.businesses?.location} · {app.status}</div>
                </div>
                {app.status === "pending" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => reviewApplication(app.id, "approved")} className="chip-active">Approve</button>
                    <button onClick={() => reviewApplication(app.id, "rejected")} className="chip">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "products" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {products.length === 0 && <EmptyNote text="No products pending review." />}
            {products.map((p) => {
              const img = p.product_images?.find((i: any) => i.is_primary) || p.product_images?.[0];
              const imgUrl = img?.processed_image_url || img?.raw_image_url;
              return (
                <div key={p.id} style={rowStyle}>
                  <div style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--surface-container-high)" }}>
                    {imgUrl && <img src={imgUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 3 }}>{p.businesses?.name} · KSh {Number(p.price).toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => reviewProduct(p.id, "approved")} className="chip-active">Approve</button>
                    <button onClick={() => reviewProduct(p.id, "rejected")} className="chip">Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "featured" && (
          <div>
            <div className="section-label">Offer a featured slot</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30 }}>
              {approvedProducts.length === 0 && <EmptyNote text="No approved products yet." />}
              {approvedProducts.map((p) => (
                <div key={p.id} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 3 }}>{p.businesses?.name} · KSh {Number(p.price).toLocaleString()}</div>
                  </div>
                  <button onClick={() => setOfferForm({ productId: p.id })} className="chip-active">Offer slot</button>
                </div>
              ))}
            </div>

            {offerForm && (
              <OfferSlotForm onSubmit={(params) => offerSlot(offerForm.productId, params)} onCancel={() => setOfferForm(null)} />
            )}

            <div className="section-label">All slot offers ({slots.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {slots.length === 0 && <EmptyNote text="No featured slot offers yet." />}
              {slots.map((s) => (
                <div key={s.id} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.products?.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 3 }}>
                      {s.discover_section} · {s.position_tier} · KSh {Number(s.price).toLocaleString()} · {s.duration_days}d
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999,
                    background: s.status === "live" ? "var(--ink)" : "none", color: s.status === "live" ? "var(--background)" : "var(--ink-secondary)",
                    border: s.status === "live" ? "none" : "1px solid var(--line-faint)" }}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "jobs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {jobs.length === 0 && <EmptyNote text="No failed AI jobs." />}
            {jobs.map((j) => (
              <div key={j.id} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{j.products?.name || "Unknown product"} — {j.job_type}</div>
                  <div style={{ fontSize: 11, color: "var(--error)", marginTop: 3 }}>{j.error_message}</div>
                </div>
                <button onClick={() => retryJob(j.id)} className="chip-active">Retry</button>
              </div>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.length === 0 && <EmptyNote text="No open Find it for me requests." />}
            {requests.map((r) => (
              <div key={r.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.item_type || "Unknown item"}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 3 }}>{r.name} · {r.email}{r.whatsapp ? " · " + r.whatsapp : ""} · {(r.detected_tags || []).join(", ")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 };
function EmptyNote({ text }: { text: string }) {
  return <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", padding: "20px 0", textAlign: "center" }}>{text}</div>;
}

const PLACEMENT_TYPES: { key: string; label: string }[] = [
  { key: "discover", label: "Discover shelf" },
  { key: "search_keyword", label: "Sponsored — text search" },
  { key: "search_visual", label: "Sponsored — photo search" },
  { key: "promoted", label: "Promoted on category page" },
];

function OfferSlotForm({ onSubmit, onCancel }: { onSubmit: (params: { placementType: string; discoverSection?: string; keywords?: string[]; tier: "top" | "standard"; price: number }) => void; onCancel: () => void }) {
  const [placementType, setPlacementType] = useState("discover");
  const [section, setSection] = useState(DISCOVER_SECTIONS[0]);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [tier, setTier] = useState<"top" | "standard">("standard");
  const [price, setPrice] = useState("1500");

  const needsSection = placementType === "discover";
  const needsKeywords = placementType === "search_keyword" || placementType === "search_visual";

  function submit() {
    onSubmit({
      placementType,
      discoverSection: needsSection ? section : undefined,
      keywords: needsKeywords ? keywordsInput.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) : undefined,
      tier,
      price: Number(price),
    });
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 16, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="label-sm" style={{ color: "var(--ink-secondary)" }}>Placement type</div>
      <select className="input" value={placementType} onChange={(e) => setPlacementType(e.target.value)}>
        {PLACEMENT_TYPES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>

      {needsSection && (
        <>
          <div className="label-sm" style={{ color: "var(--ink-secondary)" }}>Discover section</div>
          <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
            {DISCOVER_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      )}

      {needsKeywords && (
        <>
          <div className="label-sm" style={{ color: "var(--ink-secondary)" }}>
            Keywords (comma separated — e.g. "sofa, white sofa, living room")
          </div>
          <input className="input" value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} placeholder="sofa, white sofa" />
          <div style={{ fontSize: 10.5, color: "var(--ink-secondary)", lineHeight: 1.5, marginTop: -4 }}>
            This product will be pinned to the top, labelled "Sponsored," whenever a user's {placementType === "search_visual" ? "photo" : "text"} search matches one of these terms.
          </div>
        </>
      )}

      <div className="label-sm" style={{ color: "var(--ink-secondary)" }}>Position</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setTier("standard")} className={tier === "standard" ? "chip-active" : "chip"}>Standard</button>
        <button onClick={() => setTier("top")} className={tier === "top" ? "chip-active" : "chip"}>Top</button>
      </div>
      <div className="label-sm" style={{ color: "var(--ink-secondary)" }}>Price (KSh, 7 days)</div>
      <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} className="btn-primary" style={{ flex: 1 }}>Send offer</button>
        <button onClick={onCancel} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-secondary)", lineHeight: 1.5 }}>
        The seller has 48 hours to pay before this offer lapses automatically.
      </div>
    </div>
  );
}
