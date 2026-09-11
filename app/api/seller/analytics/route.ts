// GET /api/seller/analytics
// Plain counting/grouping of already-logged events — no AI involved.
// Returns, for the calling seller's own products only:
//   - total views (last 30 days) and per-product breakdown
//   - total saves (favourites) per product
//   - search terms that led to views of this seller's products
//   - which of their products got the most views (their "top product")
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account" }, { status: 404 });

  const { data: products } = await supabase.from("products").select("id, name").eq("business_id", business.id);
  const productIds = (products || []).map((p) => p.id);
  if (productIds.length === 0) {
    return NextResponse.json({ totalViews: 0, totalSaves: 0, byProduct: [], topSearchTerms: [] });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: views } = await supabase
    .from("product_views")
    .select("product_id, created_at")
    .in("product_id", productIds)
    .gte("created_at", thirtyDaysAgo);

  const { data: saves } = await supabase
    .from("saved_products")
    .select("product_id")
    .in("product_id", productIds);

  const viewCountByProduct = new Map<string, number>();
  for (const v of views || []) viewCountByProduct.set(v.product_id, (viewCountByProduct.get(v.product_id) || 0) + 1);

  const saveCountByProduct = new Map<string, number>();
  for (const s of saves || []) saveCountByProduct.set(s.product_id, (saveCountByProduct.get(s.product_id) || 0) + 1);

  const byProduct = (products || [])
    .map((p) => ({
      productId: p.id,
      name: p.name,
      views: viewCountByProduct.get(p.id) || 0,
      saves: saveCountByProduct.get(p.id) || 0,
    }))
    .sort((a, b) => b.views - a.views);

  // Search terms: pull recent searches whose detected_tags overlap this
  // seller's products' search_tags, as a proxy for "what were people
  // looking for when they found (or almost found) your products."
  const { data: sellerProducts } = await supabase.from("products").select("search_tags").in("id", productIds);
  const relevantTags = new Set((sellerProducts || []).flatMap((p) => p.search_tags || []));

  const { data: recentSearches } = await supabase
    .from("searches")
    .select("query_text, detected_tags")
    .gte("created_at", thirtyDaysAgo)
    .limit(500);

  const termCounts = new Map<string, number>();
  for (const s of recentSearches || []) {
    const tags = s.detected_tags || [];
    const overlaps = tags.some((t: string) => relevantTags.has(t));
    if (overlaps) {
      const label = s.query_text || tags.slice(0, 3).join(", ");
      if (label) termCounts.set(label, (termCounts.get(label) || 0) + 1);
    }
  }
  const topSearchTerms = Array.from(termCounts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalViews = Array.from(viewCountByProduct.values()).reduce((a, b) => a + b, 0);
  const totalSaves = Array.from(saveCountByProduct.values()).reduce((a, b) => a + b, 0);

  return NextResponse.json({ totalViews, totalSaves, byProduct, topSearchTerms });
}
