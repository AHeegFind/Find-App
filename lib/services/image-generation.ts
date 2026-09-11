// =============================================================================
// ImageGenerationService — produces a polished catalogue image from a
// seller's raw product photo. CRITICAL CONSTRAINT: must preserve the actual
// product; only background/lighting/shadow may be altered, never the
// product's shape, colour, or details.
// =============================================================================
import type { ImageGenerationService, GeneratedImageResult, VisionAttributes } from "./types";

/**
 * Photoroom Image Editing API — background removal + AI relighting + AI
 * soft shadow + clean solid backdrop, in a single call. Requires
 * PHOTOROOM_API_KEY (Plus-tier key; the Basic-tier key only supports plain
 * background removal and will reject lighting.mode/shadow.mode params).
 *
 * Uses the GET endpoint with imageUrl, since our raw photos are already
 * hosted in Supabase Storage — no file upload/multipart handling needed.
 *
 * Per Photoroom's own docs, AI Relight and AI Shadows do not alter the
 * product itself (only lighting/shadow/background), which is why we use
 * exactly these two features and avoid AI Beautifier — Beautifier is
 * explicitly documented as able to "re-imagine" the subject, which would
 * violate our "never change the actual product" requirement.
 */
export class PhotoroomImageService implements ImageGenerationService {
  constructor(private apiKey: string) {}

  async generateCatalogueImage(rawImageUrl: string): Promise<GeneratedImageResult> {
    const params = new URLSearchParams({
      imageUrl: rawImageUrl,
      "removeBackground": "true",
      "background.color": "F5EFE3", // matches the app's cream backdrop
      "lighting.mode": "ai.auto",
      "shadow.mode": "ai.soft",
      "padding": "0.12",
      "outputSize": "1200x1200",
    });

    const resp = await fetch(`https://image-api.photoroom.com/v2/edit?${params.toString()}`, {
      method: "GET",
      headers: { "x-api-key": this.apiKey, "Accept": "image/png, application/json" },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Photoroom API error ${resp.status}: ${errText.slice(0, 300)}`);
    }

    // Response is a raw PNG binary. Upload it to Supabase Storage so we
    // have a stable, permanent URL (Photoroom does not host results long-term).
    const imageBuffer = await resp.arrayBuffer();
    const uploadedUrl = await uploadProcessedImage(imageBuffer, rawImageUrl);

    return { imageUrl: uploadedUrl, provider: "photoroom" };
  }
}

/**
 * Uploads a Photoroom-processed image (binary PNG) to the same Supabase
 * Storage bucket seller raw uploads live in, under a "processed/" prefix.
 * Uses the service-role client since this runs server-side inside the AI
 * job processor, not in a user's browser session.
 */
async function uploadProcessedImage(buffer: ArrayBuffer, sourceUrl: string): Promise<string> {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = createServiceClient();
  const fileName = `processed/${crypto.randomUUID()}.png`;

  const { error } = await supabase.storage.from("product-images").upload(fileName, buffer, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(`Could not upload processed image to storage: ${error.message}`);

  const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Mock — returns the raw image unchanged, clearly logged. Used when no
 * PHOTOROOM_API_KEY is configured, so the pipeline (job creation, status
 * tracking, seller approve/regenerate UI) can be exercised without live
 * credentials.
 */
export class MockImageGenerationService implements ImageGenerationService {
  async generateCatalogueImage(rawImageUrl: string): Promise<GeneratedImageResult> {
    console.warn("[ImageGenerationService] No PHOTOROOM_API_KEY configured — returning original image unmodified. Set PHOTOROOM_API_KEY for real background/lighting/shadow processing.");
    return { imageUrl: rawImageUrl, provider: "mock" };
  }
}

export function getImageGenerationService(): ImageGenerationService {
  if (process.env.PHOTOROOM_API_KEY) return new PhotoroomImageService(process.env.PHOTOROOM_API_KEY);
  return new MockImageGenerationService();
}
