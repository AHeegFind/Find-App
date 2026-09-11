import { createClient } from "@/lib/supabase/server";

const SHELVES = [
  { key: "editors-picks", label: "Editor's Picks" },
  { key: "unique-finds", label: "Unique Finds" },
  { key: "hidden-kenyan-brands", label: "Hidden Kenyan Brands" },
  { key: "nairobi-finds", label: "Nairobi Finds" },
  { key: "beautiful-homes", label: "Beautiful Homes" },
  { key: "under-20k", label: "Under KSh 20,000" },
];

const PRODUCT_FIELDS = "id, name, price, currency, location, verification_status, product_images(processed_image_url, raw_image_url, is_primary)";

export default async function DiscoverPage() {
  const supabase = createClient();

  const shelvesWithProducts = await Promise.all(
    SHELVES.map(async (shelf) => {
      // Paid, currently-live featured slots for this shelf, top tier first —
      // this is what a seller's payment actually buys: priority ordering
      // within a curated shelf, never a spot that wasn't editorially chosen.
      const { data: slots } = await supabase
        .from("featured_slots")
        .select(`position_tier, products(${PRODUCT_FIELDS})`)
        .eq("discover_section", shelf.key)
        .eq("status", "live")
        .order("position_tier", { ascending: true }); // 'standard' < 'top' alphabetically is wrong; handled below

      const topFirst = (slots || []).sort((a, b) => (a.position_tier === "top" ? -1 : 1) - (b.position_tier === "top" ? -1 : 1));
      const featuredProducts = topFirst.map((s) => s.products).filter(Boolean);
      const featuredIds = new Set(featuredProducts.map((p: any) => p.id));

      // Fill remaining shelf space with free editorial picks (discover_sections),
      // excluding anything already shown via a paid slot.
      const remaining = Math.max(0, 10 - featuredProducts.length);
      let editorialProducts: any[] = [];
      if (remaining > 0) {
        const { data } = await supabase
          .from("products")
          .select(PRODUCT_FIELDS)
          .contains("discover_sections", [shelf.key])
          .eq("moderation_status", "approved")
          .limit(remaining + featuredIds.size); // over-fetch slightly to allow for exclusion filtering
        editorialProducts = (data || []).filter((p: any) => !featuredIds.has(p.id)).slice(0, remaining);
      }

      return { ...shelf, products: [...featuredProducts, ...editorialProducts], featuredCount: featuredProducts.length };
    })
  );

  return (
    <div className="wrap">
      <div style={{ marginBottom: 28, paddingTop: 8 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 500, marginBottom: 6 }}>Discover</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>Curated by the Find team. The best of what's in Kenya right now.</div>
      </div>

      {shelvesWithProducts.every((s) => s.products.length === 0) && (
        <div style={{ textAlign: "center", padding: "40px 10px" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 500, marginBottom: 8 }}>No editorial picks yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>Feature products from the admin dashboard to populate Discover shelves.</div>
        </div>
      )}

      {shelvesWithProducts.map((shelf) =>
        shelf.products.length === 0 ? null : (
          <div key={shelf.key} style={{ marginBottom: 32 }}>
            <div className="section-label">{shelf.label}</div>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4, marginRight: -16 }}>
              {shelf.products.map((p: any, i: number) => {
                const img = p.product_images?.find((im: any) => im.is_primary) || p.product_images?.[0];
                const imgUrl = img?.processed_image_url || img?.raw_image_url;
                const isFeatured = i < shelf.featuredCount;
                return (
                  <a key={p.id} href={`/browse/product/${p.id}`} style={{ minWidth: 152, maxWidth: 152, position: "relative" }}>
                    <div className="card-img" style={{ aspectRatio: "1/1" }}>
                      {imgUrl && <img src={imgUrl} alt={p.name} />}
                      {isFeatured && (
                        <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: "var(--ink)", color: "var(--background)", padding: "3px 7px", borderRadius: 3 }}>
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="card-price">{p.currency || "KSh"} {Number(p.price).toLocaleString()}</div>
                    <div className="card-name">{p.name}</div>
                  </a>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
