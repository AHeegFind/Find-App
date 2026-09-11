// =============================================================================
// AI SERVICE LAYER — shared types
// Every AI capability the app needs is defined as an interface here. Concrete
// providers (Anthropic, OpenAI, Replicate, etc.) implement these interfaces.
// Routes and other app code depend ONLY on these interfaces, never on a
// specific provider's SDK — swapping providers means changing one factory
// function, not touching call sites.
// =============================================================================

export interface VisionAttributes {
  itemType: string;
  description: string;
  tags: string[];
  colour?: string;
  material?: string;
  style?: string;
  confidence: number; // 0-1, how confident the model is in this reading
}

export interface VisionAnalysisService {
  /** Analyse a product photo and extract structured attributes. */
  analyze(imageUrl: string): Promise<VisionAttributes>;
}

export interface GeneratedImageResult {
  imageUrl: string;
  provider: string;
}

export interface ImageGenerationService {
  /**
   * Produce a polished, consistent catalogue-style image from a seller's
   * raw product photo. Must preserve the actual product (no hallucinated
   * redesign) — background/lighting/framing only.
   */
  generateCatalogueImage(rawImageUrl: string, attributes: VisionAttributes): Promise<GeneratedImageResult>;
}

export interface EmbeddingService {
  /** Return a fixed-length vector embedding for an image. */
  embedImage(imageUrl: string): Promise<number[]>;
  /** Return a fixed-length vector embedding for text (semantic search). */
  embedText(text: string): Promise<number[]>;
}

export interface ModerationResult {
  approved: boolean;
  reason?: string;
}

export interface ModerationService {
  moderateImage(imageUrl: string): Promise<ModerationResult>;
}

export type AIJobType = "vision_analysis" | "image_generation" | "embedding" | "moderation";
export type AIJobStatus = "pending" | "processing" | "succeeded" | "failed";
