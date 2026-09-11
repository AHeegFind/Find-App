"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const LOCATIONS = ["Nairobi", "Mombasa", "Kilifi", "Machakos", "Kajiado", "Kisumu"];

export default function BrowsePage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [path, setPath] = useState<{ cat?: any; sub?: any } | null>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [promoted, setPromoted] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(80000);
  const [location, setLocation] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  const topCategories = categories.filter((c) => !c.parent_id);
  const subCategories = (parentId: string) => categories.filter((c) => c.parent_id === parentId);
  const showingProducts = query.trim().length > 0 || (path && path.sub);

  useEffect(() => {
    if (!showingProducts) return;
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from("products")
      .select("id, name, price, currency, location, verification_status, availability, category_id, product_images(processed_image_url, raw_image_url, is_primary)")
      .eq("moderation_status", "approved")
      .lte("price", maxPrice)
      .limit(40);

    if (path?.sub) q = q.eq("category_id", path.sub.id);
    if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
    if (location !== "all") q = q.eq("location", location);
    if (verifiedOnly) q = q.eq("verification_status", "find_verified");

    q.then(({ data, error }) => {
      if (error) console.error("[browse] query error:", error);
      setProducts(data || []);
      setLoading(false);
    });

    // Promoted products for this specific subcategory page: live 'promoted'
    // slots whose product belongs to the category being viewed. Only
    // fetched when browsing a real subcategory, not for text search —
    // "promoted on category page" is a category-page-specific placement.
    if (path?.sub) {
      const supabase2 = createClient();
      supabase2
        .from("featured_slots")
        .select(
          "position_tier, products(id, name, price, currency, location, verification_status, availability, category_id, product_images(processed_image_url, raw_image_url, is_primary))"
        )
        .eq("placement_type", "promoted")
        .eq("status", "live")
        .then(({ data: slotData, error: slotError }) => {
          if (slotError) { console.error("[browse] promoted fetch error:", slotError); return; }
          const inThisCategory = (slotData || [])
            .filter((s: any) => s.products?.category_id === path.sub.id)
            .sort((a: any, b: any) => (a.position_tier === "top" ? -1 : 1) - (b.position_tier === "top" ? -1 : 1))
            .map((s: any) => ({ ...s.products, promoted: true }));
          setPromoted(inThisCategory);
        });
    } else {
      setPromoted([]);
    }
  }, [showingProducts, path, query, maxPrice, location, verifiedOnly]);

  return (
    <div className="wrap">
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 500, marginBottom: 6, paddingTop: 8 }}>Browse</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, marginTop: 4 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--ink-secondary)" }}>search</span>
          <input placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ border: "none", outline: "none", background: "none", fontSize: 14, flex: 1, color: "var(--ink)" }} />
        </div>
        <button onClick={() => setShowFilters((v) => !v)} style={{ width: 42, height: 42, border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "var(--ink)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>tune</span>
        </button>
      </div>

      {showFilters && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Max price: KSh {maxPrice.toLocaleString()}</div>
          <input type="range" min={800} max={80000} step={500} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} style={{ width: "100%", marginBottom: 16 }} />
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Location</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setLocation("all")} className={location === "all" ? "chip-active" : "chip"}>All</button>
            {LOCATIONS.map((l) => (
              <button key={l} onClick={() => setLocation(l)} className={location === l ? "chip-active" : "chip"}>{l}</button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            Find Verified only
          </label>
        </div>
      )}

      {!showingProducts && !path && (
        <div>
          {topCategories.map((cat) => (
            <button key={cat.id} onClick={() => setPath({ cat })} style={categoryRowStyle}>
              <div style={{ fontSize: 14.5, fontWeight: 500, textAlign: "left" }}>{cat.label}</div>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--ink-secondary)" }}>chevron_right</span>
            </button>
          ))}
          {topCategories.length === 0 && <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>No categories loaded. Run the category seed migration.</div>}
        </div>
      )}

      {!showingProducts && path?.cat && !path.sub && (
        <div>
          <button onClick={() => setPath(null)} style={breadcrumbStyle}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> {path.cat.label}
          </button>
          {subCategories(path.cat.id).map((sub) => (
            <button key={sub.id} onClick={() => setPath({ cat: path.cat, sub })} style={categoryRowStyle}>
              <div style={{ fontSize: 14.5, fontWeight: 500, textAlign: "left" }}>{sub.label}</div>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--ink-secondary)" }}>chevron_right</span>
            </button>
          ))}
        </div>
      )}

      {showingProducts && (
        <div>
          {path?.sub && (
            <button onClick={() => setPath({ cat: path.cat })} style={breadcrumbStyle}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> {path.sub.label}
            </button>
          )}
          {loading ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", textAlign: "center", padding: 30 }}>Loading…</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 500, marginBottom: 8 }}>No products match</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>Try adjusting your filters.</div>
            </div>
          ) : (
            <div className="grid">
              {[...promoted, ...products.filter((p) => !promoted.some((pr) => pr.id === p.id))].map((p) => {
                const img = p.product_images?.find((i: any) => i.is_primary) || p.product_images?.[0];
                const imgUrl = img?.processed_image_url || img?.raw_image_url;
                return (
                  <a key={p.id} href={`/browse/product/${p.id}`}>
                    <div className="card-img">
                      {imgUrl && <img src={imgUrl} alt={p.name} />}
                      {p.promoted && (
                        <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: "var(--ink)", color: "var(--background)", padding: "3px 7px", borderRadius: 3 }}>
                          Promoted
                        </span>
                      )}
                    </div>
                    <div className="card-price">{p.currency || "KSh"} {Number(p.price).toLocaleString()}{p.availability === "customizable" && <span className="tag-customizable">Customizable</span>}</div>
                    <div className="card-name">{p.name}</div>
                    <div className="card-meta">
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
                      {p.location}
                    </div>
                    {p.verification_status === "find_verified" ? (
                      <span className="badge-verified"><span className="material-symbols-outlined filled" style={{ fontSize: 12 }}>verified</span>Find Verified</span>
                    ) : (
                      <span className="badge-found">Found Online</span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const categoryRowStyle: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "17px 18px", marginBottom: 10, cursor: "pointer", color: "var(--ink)" };
const breadcrumbStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 16, padding: 0 };
