// =============================================================================
// POST /api/ai/process-job
// Processes a single ai_processing_jobs row: runs the matching service,
// writes the result back onto the product/product_image, and updates job
// status. Idempotent-ish: safe to call again on a failed job (that's how
// admin "retry" works) — it re-reads current state rather than assuming.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getVisionService } from "@/lib/services/vision";
import { getImageGenerationService } from "@/lib/services/image-generation";
import { getEmbeddingService } from "@/lib/services/embeddings";
import { getModerationService } from "@/lib/services/moderation";

export async function POST(req: NextRequest) {
  const { jobId } = await req.json().catch(() => ({}));
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  // Service-role client: this route is called both by the uploading seller's
  // session and by the admin "retry" button, and it needs to write AI
  // results onto products/images regardless of RLS ownership checks that
  // are already enforced upstream (upload route checks business ownership;
  // admin route checks admin role before calling this).
  const supabase = createServiceClient();

  const { data: job, error: jobFetchError } = await supabase
    .from("ai_processing_jobs")
    .select("*, product_images(*)")
    .eq("id", jobId)
    .single();

  if (jobFetchError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await supabase.from("ai_processing_jobs").update({ status: "processing", attempts: job.attempts + 1 }).eq("id", jobId);

  try {
    const image = job.product_images;
    if (!image) throw new Error("Job has no associated product_image");

    let output: Record<string, unknown> = {};
    let provider = "unknown";

    if (job.job_type === "vision_analysis") {
      const service = getVisionService();
      const attributes = await service.analyze(image.raw_image_url);
      provider = service.constructor.name;
      output = attributes as unknown as Record<string, unknown>;

      await supabase
        .from("product_images")
        .update({ vision_labels: attributes as any })
        .eq("id", image.id);

      await supabase
        .from("products")
        .update({
          description: attributes.description,
          colour: attributes.colour ?? null,
          material: attributes.material ?? null,
          search_tags: attributes.tags,
        })
        .eq("id", job.product_id);
    } else if (job.job_type === "image_generation") {
      const service = getImageGenerationService();
      // Vision job should run first to provide attributes; if it hasn't,
      // proceed with an empty-attributes fallback rather than blocking.
      const { data: visionJob } = await supabase
        .from("ai_processing_jobs")
        .select("output")
        .eq("product_image_id", image.id)
        .eq("job_type", "vision_analysis")
        .eq("status", "succeeded")
        .maybeSingle();

      const attributes = (visionJob?.output as any) ?? { itemType: "", description: "", tags: [], confidence: 0.5 };
      const result = await service.generateCatalogueImage(image.raw_image_url, attributes);
      provider = result.provider;
      output = result as unknown as Record<string, unknown>;

      await supabase.from("product_images").update({ processed_image_url: result.imageUrl }).eq("id", image.id);

      // Run moderation on the processed image before it's eligible for
      // seller approval / admin review.
      const moderation = await getModerationService().moderateImage(result.imageUrl);
      await supabase.from("product_images").update({ approved: moderation.approved }).eq("id", image.id);
    } else if (job.job_type === "embedding") {
      const service = getEmbeddingService();
      const vector = await service.embedImage(image.processed_image_url || image.raw_image_url);
      provider = "embedding-service";
      output = { dimensions: vector.length };

      await supabase.from("product_images").update({ embedding: vector as any }).eq("id", image.id);
    } else if (job.job_type === "moderation") {
      const service = getModerationService();
      const result = await service.moderateImage(image.processed_image_url || image.raw_image_url);
      provider = "moderation-service";
      output = result as unknown as Record<string, unknown>;
      await supabase.from("product_images").update({ approved: result.approved }).eq("id", image.id);
    }

    await supabase
      .from("ai_processing_jobs")
      .update({ status: "succeeded", provider, output })
      .eq("id", jobId);

    return NextResponse.json({ success: true, output });
  } catch (err: any) {
    console.error(`[ai/process-job] job ${jobId} (${job.job_type}) failed:`, err);
    await supabase
      .from("ai_processing_jobs")
      .update({ status: "failed", error_message: err.message?.slice(0, 500) })
      .eq("id", jobId);
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
