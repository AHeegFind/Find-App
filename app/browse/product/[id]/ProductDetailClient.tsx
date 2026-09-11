"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProductDetailClient({ product, initiallySaved, isLoggedIn }: { product: any; initiallySaved: boolean; isLoggedIn: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);

  // Log a view once per page load — feeds the seller's analytics dashboard.
  useEffect(() => {
    fetch("/api/products/track-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: product.id, source: "browse" }),
    }).catch(() => {}); // best-effort; a failed view log should never break the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const images: any[] = (product.product_images || []).sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  const primary = images[0];
  const imgUrl = primary?.processed_image_url || primary?.raw_image_url;
  const business = product.businesses;

  async function toggleSave() {
    if (!isLoggedIn) {
      router.push("/auth/login");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (saved) {
      await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", product.id);
      setSaved(false);
    } else {
      await supabase.from("saved_products").insert({ user_id: user.id, product_id: product.id });
      setSaved(true);
    }
    setSaving(false);
  }

  function contactSeller() {
    if (business?.whatsapp) {
      window.open(`https://wa.me/${business.whatsapp.replace(/[^0-9]/g, "")}`, "_blank");
    } else if (business?.instagram) {
      window.open(`https://instagram.com/${business.instagram.replace("@", "")}`, "_blank");
    } else if (business?.website) {
      window.open(business.website.startsWith("http") ? business.website : `https://${business.website}`, "_blank");
    }
  }

  const joinedYear = business?.created_at ? new Date(business.created_at).getFullYear() : null;

  return (
    <div>
      {/* Mobile back/save overlay */}
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 40, padding: 16, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
        <button onClick={() => router.back()} className="top-back-btn" style={{ pointerEvents: "auto" }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <button onClick={toggleSave} disabled={saving} className="top-back-btn" style={{ pointerEvents: "auto", position: "relative" }}>
          <span className={`material-symbols-outlined ${saved ? "filled" : ""}`} style={{ color: saved ? "var(--ink)" : undefined }}>favorite</span>
        </button>
      </div>

      <main style={{ maxWidth: 1440, margin: "0 auto" }}>
        <article>
          {/* Image */}
          <div style={{ width: "100%", aspectRatio: "3/4", position: "relative", overflow: "hidden", background: "var(--surface)" }}>
            {imgUrl && <img src={imgUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(19,19,19,0.9)", backdropFilter: "blur(8px)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              {product.verification_status === "find_verified" ? (
                <>
                  <span className="material-symbols-outlined filled" style={{ color: "var(--ink)", fontSize: 16 }}>verified</span>
                  <span className="label-sm" style={{ color: "var(--ink)" }}>Find Verified</span>
                </>
              ) : (
                <span className="label-sm" style={{ color: "var(--ink-secondary)" }}>Found Online</span>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="wrap" style={{ paddingTop: 32 }}>
            <div style={{ marginBottom: 32 }}>
              <h1 className="font-display" style={{ fontSize: 24, fontWeight: 500, color: "var(--ink)", marginBottom: 8 }}>{product.name}</h1>
              <p style={{ fontSize: 16 }}>{product.currency || "KSh"} {Number(product.price).toLocaleString()}</p>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "24px 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
              {product.source_type === "web_indexed" && product.source_url ? (
                <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                  View original listing
                </a>
              ) : (
                <button onClick={contactSeller} className="btn-primary" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined filled" style={{ fontSize: 18 }}>chat</span>
                  Contact seller
                </button>
              )}
              <button onClick={toggleSave} disabled={saving} className="btn-outline" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                <span className={`material-symbols-outlined ${saved ? "filled" : ""}`} style={{ fontSize: 18, color: saved ? "var(--ink)" : undefined }}>favorite</span>
                {saved ? "Saved" : "Save for later"}
              </button>
            </div>

            {/* Seller card */}
            {business && (
              <div style={{ background: "var(--surface)", borderRadius: 12, padding: 20, border: "1px solid var(--line)", marginBottom: 32 }}>
                <h3 className="label-sm" style={{ marginBottom: 16 }}>{product.source_type === "web_indexed" ? "Found At" : "Crafted By"}</h3>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-container-high)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
                      {business.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{business.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                        {joinedYear ? `Joined ${joinedYear} · ` : ""}{business.location}
                      </div>
                    </div>
                  </div>
                  <a href={`/browse/seller/${business.id}`} className="chip">View profile</a>
                </div>
              </div>
            )}

            {/* Accordion details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {product.description && (
                <details open style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                  <summary className="label-sm" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    Description
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>expand_more</span>
                  </summary>
                  <div className="body-md" style={{ paddingTop: 16, lineHeight: 1.6 }}>{product.description}</div>
                </details>
              )}

              {(product.dimensions || product.material || product.colour) && (
                <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                  <summary className="label-sm" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    Details &amp; Dimensions
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>expand_more</span>
                  </summary>
                  <div className="body-md" style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    {product.material && <p><span style={{ color: "var(--ink)" }}>Material:</span> {product.material}</p>}
                    {product.colour && <p><span style={{ color: "var(--ink)" }}>Colour:</span> {product.colour}</p>}
                    {product.dimensions && <p><span style={{ color: "var(--ink)" }}>Dimensions:</span> {product.dimensions}</p>}
                    <p><span style={{ color: "var(--ink)" }}>Availability:</span> {product.availability === "customizable" ? "Customizable / made to order" : product.availability?.replace("_", " ")}</p>
                  </div>
                </details>
              )}

              <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                <summary className="label-sm" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Location
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>expand_more</span>
                </summary>
                <div className="body-md" style={{ paddingTop: 16, lineHeight: 1.6 }}>{product.location || business?.location || "Not specified"}</div>
              </details>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
