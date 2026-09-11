// =============================================================================
// POST /api/products/upload
// Seller bulk-upload endpoint. Accepts a product's raw image (already
// uploaded to Supabase Storage by the client — see seller portal upload
// component) plus basic seller-entered fields, creates the product +
// product_image rows, then KICKS OFF the AI pipeline asynchronously by
// creating ai_processing_jobs rows and invoking /api/ai/process-job for
// each. Kept as separate calls (rather than one long request) so a slow or
// failed AI call never blocks the upload response, and so failures are
// individually retriable from the admin dashboard.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { businessId, name, price, categoryId, rawImageUrl, location, dimensions, material, colour, availability } = body || {};

  if (!businessId || !name || !price || !rawImageUrl) {
    return NextResponse.json({ error: "businessId, name, price and rawImageUrl are required" }, { status: 400 });
  }

  // Verify the caller owns this business (defence in depth on top of RLS)
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, owner_id")
    .eq("id", businessId)
    .single();
  if (bizError || !business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorised for this business" }, { status: 403 });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      business_id: businessId,
      category_id: categoryId ?? null,
      name,
      price,
      location: location ?? null,
      dimensions: dimensions ?? null,
      material: material ?? null,
      colour: colour ?? null,
      availability: availability === "customizable" ? "customizable" : "in_stock",
      source_type: "seller_submitted",
      moderation_status: "pending",
      verification_status: "found_online", // upgraded to find_verified once business is verified + product approved
    })
    .select()
    .single();

  if (productError || !product) {
    console.error("[products/upload] product insert error:", productError);
    return NextResponse.json({ error: "Could not create product" }, { status: 500 });
  }

  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .insert({ product_id: product.id, raw_image_url: rawImageUrl, is_primary: true })
    .select()
    .single();

  if (imageError || !image) {
    console.error("[products/upload] image insert error:", imageError);
    return NextResponse.json({ error: "Product created but image record failed" }, { status: 500 });
  }

  // Queue the three AI jobs this image needs. Each is processed by
  // /api/ai/process-job, which the client calls immediately after upload
  // (fire-and-forget from the seller's perspective — the seller portal
  // polls job status to show progress).
  const jobTypes: Array<"vision_analysis" | "image_generation" | "embedding"> = [
    "vision_analysis",
    "image_generation",
    "embedding",
  ];
  const { data: jobs, error: jobsError } = await supabase
    .from("ai_processing_jobs")
    .insert(
      jobTypes.map((job_type) => ({
        product_id: product.id,
        product_image_id: image.id,
        job_type,
        provider: "auto", // resolved to the actual provider at processing time
        status: "pending" as const,
      }))
    )
    .select();

  if (jobsError) console.error("[products/upload] job queue error:", jobsError);

  return NextResponse.json({ product, image, jobs: jobs ?? [] });
}
