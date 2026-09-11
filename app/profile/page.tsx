"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [savedProducts, setSavedProducts] = useState<any[]>([]);
  const [searches, setSearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      setUser(user);

      const { data: profileRow } = await supabase.from("users").select("*").eq("id", user.id).single();
      setProfile(profileRow);

      const { data: saved } = await supabase
        .from("saved_products")
        .select("products(id, name, price, currency, location, verification_status, product_images(processed_image_url, raw_image_url, is_primary))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setSavedProducts((saved || []).map((s: any) => s.products).filter(Boolean));

      const { data: history } = await supabase
        .from("searches")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setSearches(history || []);

      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (loading) return <div className="wrap" style={{ paddingTop: 40, textAlign: "center", color: "var(--ink-secondary)" }}>Loading…</div>;

  if (!user) {
    return (
      <div className="wrap" style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 500, marginBottom: 10 }}>You're not logged in</div>
        <div style={{ fontSize: 13, color: "var(--ink-secondary)", marginBottom: 24 }}>Log in to save products and see your search history.</div>
        <a href="/auth/login" className="btn-primary" style={{ display: "inline-block" }}>Log in</a>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, paddingTop: 8 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span className="material-symbols-outlined filled" style={{ color: "var(--background)", fontSize: 24 }}>person</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 500 }}>{profile?.full_name || user.email}</div>
          <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>{user.email}</div>
        </div>
        <button onClick={handleLogout} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 999, padding: "8px 14px", fontSize: 12, color: "var(--ink-secondary)", cursor: "pointer" }}>
          Log out
        </button>
      </div>

      {profile?.role === "consumer" && (
        <a href="/seller/apply" style={{ display: "block", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", marginBottom: 28 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 3 }}>Sell on Find</div>
          <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Register your business and list your products</div>
        </a>
      )}
      {profile?.role === "seller" && (
        <a href="/seller/dashboard" style={{ display: "block", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", marginBottom: 28 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 3 }}>Seller dashboard</div>
          <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Manage your products and catalogue</div>
        </a>
      )}
      {profile?.role === "admin" && (
        <a href="/admin" style={{ display: "block", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", marginBottom: 28 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 3 }}>Admin dashboard</div>
          <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>Review sellers and products</div>
        </a>
      )}

      <div className="section-label">
        <span className="material-symbols-outlined filled" style={{ fontSize: 13, verticalAlign: -2, marginRight: 5 }}>favorite</span>
        Saved ({savedProducts.length})
      </div>
      {savedProducts.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", padding: "10px 0 24px" }}>Tap the heart on any item to save it here.</div>
      ) : (
        <div className="grid" style={{ marginBottom: 32 }}>
          {savedProducts.map((p) => {
            const img = p.product_images?.find((i: any) => i.is_primary) || p.product_images?.[0];
            const imgUrl = img?.processed_image_url || img?.raw_image_url;
            return (
              <a key={p.id} href={`/browse/product/${p.id}`}>
                <div className="card-img">{imgUrl && <img src={imgUrl} alt={p.name} />}</div>
                <div className="card-price">{p.currency || "KSh"} {Number(p.price).toLocaleString()}</div>
                <div className="card-name">{p.name}</div>
              </a>
            );
          })}
        </div>
      )}

      <div className="section-label">Search history ({searches.length})</div>
      {searches.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", padding: "10px 0" }}>Your past photo and text searches show up here.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {searches.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
              {s.query_image_url ? (
                <img src={s.query_image_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--surface-container-high)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.query_text || (s.detected_tags || []).slice(0, 2).join(", ") || "Photo search"}</div>
                <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 2 }}>{s.result_count} result{s.result_count === 1 ? "" : "s"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
