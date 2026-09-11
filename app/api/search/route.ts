// =============================================================================
// POST /api/search
// Accepts either { imageUrl } or { text }. Runs the real pipeline:
//   image -> VisionAnalysisService -> tags
//   image|text -> EmbeddingService -> vector
//   vector -> pgvector match_products() RPC -> ranked product ids
//   ids -> full product rows (with business + primary image) from Postgres
// Logs every search to `searches` for the admin "no-result searches" view.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVisionService } from "@/lib/services/vision";
import { getEmbeddingService } from "@/lib/services/embeddings";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || (!body.imageUrl && !body.text)) {
    return NextResponse.json({ error: "Provide either imageUrl or text" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let detectedTags: string[] = [];
  let queryVector: number[];
  let queryType: "image" | "text" = body.imageUrl ? "image" : "text";

  try {
    const embeddingService = getEmbeddingService();

    if (body.imageUrl) {
      const visionService = getVisionService();
      const attributes = await visionService.analyze(body.imageUrl);
      detectedTags = attributes.tags;
      queryVector = await embeddingService.embedImage(body.imageUrl);
    } else {
      detectedTags = body.text.toLowerCase().split(/\s+/).filter(Boolean);
      queryVector = await embeddingService.embedText(body.text);
    }
  } catch (err: any) {
    console.error("[search] AI pipeline error:", err);
    return NextResponse.json(
      { error: "Could not analyse the search input. The AI service may be unavailable.", detail: err.message },
      { status: 502 }
    );
  }

  // Vector similarity search via the match_products() RPC defined in the
  // migration. Falls back gracefully to an empty match list on RPC failure
  // (e.g. pgvector not enabled) rather than throwing the whole request.
  const { data: matches, error: matchError } = await supabase.rpc("match_products", {
    query_embedding: queryVector as unknown as never,
    match_threshold: 0.35,
    match_count: 24,
  });

  if (matchError) {
    console.error("[search] pgvector match error:", matchError);
  }

  const productIds = (matches || []).map((m: any) => m.product_id);
  const similarityById = new Map((matches || []).map((m: any) => [m.product_id, m.similarity]));

  let products: any[] = [];
  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from("products")
      .select(
        `id, name, description, price, currency, location, dimensions, material, colour,
         availability, source_type, source_website, source_url, verification_status,
         product_images (id, processed_image_url, raw_image_url, is_primary),
         businesses (id, name, location, verification_status, whatsapp, instagram, website)`
      )
      .in("id", productIds)
      .eq("moderation_status", "approved");

    if (error) console.error("[search] product fetch error:", error);
    products = (data || [])
      .map((p) => ({ ...p, similarity: similarityById.get(p.id) ?? 0 }))
      .sort((a, b) => b.similarity - a.similarity);
  }

  // Also run a plain text fallback match against search_tags so text search
  // works even before embeddings are populated for older rows, and so
  // image search has a secondary signal if vector match count is low.
  if (detectedTags.length > 0 && products.length < 8) {
    const { data: tagMatches } = await supabase
      .from("products")
      .select(
        `id, name, description, price, currency, location, dimensions, material, colour,
         availability, source_type, source_website, source_url, verification_status,
         product_images (id, processed_image_url, raw_image_url, is_primary),
         businesses (id, name, location, verification_status, whatsapp, instagram, website)`
      )
      .overlaps("search_tags", detectedTags)
      .eq("moderation_status", "approved")
      .limit(24);

    const existingIds = new Set(products.map((p) => p.id));
    for (const p of tagMatches || []) {
      if (!existingIds.has(p.id)) {
        products.push({ ...p, similarity: 0.3 });
        existingIds.add(p.id);
      }
    }
  }

  const buckets = {
    exact: products.filter((p) => p.similarity >= 0.7).slice(0, 4),
    similar: products.filter((p) => p.similarity >= 0.4 && p.similarity < 0.7).slice(0, 8),
    more: products.filter((p) => p.similarity < 0.4).slice(0, 8),
  };
  const totalResults = buckets.exact.length + buckets.similar.length + buckets.more.length;

  // Sponsored results: live search_keyword (text search) or search_visual
  // (image search) slots whose keywords overlap the detected tags get
  // pinned to the very top, labelled, and are NOT counted toward the
  // "no results" empty-state logic below — a sponsored result should
  // never be mistaken for "we found a real match" when the organic
  // search came up empty. Top-tier slots sort before standard-tier.
  const sponsoredPlacementType = queryType === "image" ? "search_visual" : "search_keyword";
  const { data: sponsoredSlots } = await supabase
    .from("featured_slots")
    .select(
      `position_tier, keywords,
       products(id, name, description, price, currency, location, dimensions, material, colour,
         availability, source_type, source_website, source_url, verification_status,
         product_images (id, processed_image_url, raw_image_url, is_primary),
         businesses (id, name, location, verification_status, whatsapp, instagram, website))`
    )
    .eq("placement_type", sponsoredPlacementType)
    .eq("status", "live")
    .overlaps("keywords", detectedTags);

  const sponsored = (sponsoredSlots || [])
    .filter((s) => s.products)
    .sort((a, b) => (a.position_tier === "top" ? -1 : 1) - (b.position_tier === "top" ? -1 : 1))
    .map((s) => ({ ...s.products, sponsored: true }))
    .slice(0, 3);

  // Log the search regardless of outcome — this is what feeds the admin
  // "no-result searches" view so gaps in inventory are visible. Sponsored
  // results are excluded from result_count so a sponsored-only "match"
  // doesn't hide a genuine inventory gap from that report.
  await supabase.from("searches").insert({
    user_id: user?.id ?? null,
    query_type: queryType,
    query_text: body.text ?? null,
    query_image_url: body.imageUrl ?? null,
    detected_tags: detectedTags,
    result_count: totalResults,
  });

  return NextResponse.json({ detectedTags, sponsored, buckets, totalResults });
}
