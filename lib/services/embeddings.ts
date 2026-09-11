// =============================================================================
// EmbeddingService implementations — powers vector similarity search.
// pgvector column is declared as vector(512) in the schema; if you swap to a
// provider with a different dimension, update the column definition too.
// =============================================================================
import type { EmbeddingService } from "./types";

/**
 * OpenAI embeddings for TEXT (semantic search), combined with a CLIP-style
 * multimodal model for IMAGE embeddings via Replicate, since OpenAI's
 * embedding API is text-only. This mixed approach is common in production:
 * text and image embeddings usually come from different specialised models.
 */
export class OpenAITextEmbeddingService {
  constructor(private apiKey: string) {}

  async embedText(text: string): Promise<number[]> {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text, dimensions: 512 }),
    });
    if (!resp.ok) throw new Error(`OpenAI embeddings error ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const data = await resp.json();
    return data.data[0].embedding;
  }
}

/**
 * Replicate-hosted CLIP model for IMAGE embeddings. Requires
 * REPLICATE_API_TOKEN. Replicate is used here (rather than calling a
 * provider directly) because CLIP-family models are most commonly deployed
 * this way; swap the `version` hash for any compatible CLIP deployment.
 */
export class ReplicateClipEmbeddingService {
  constructor(private apiToken: string) {}

  async embedImage(imageUrl: string): Promise<number[]> {
    const createResp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Token ${this.apiToken}` },
      body: JSON.stringify({
        // andreasjansson/clip-features — replace with your preferred CLIP
        // deployment's version hash if different.
        version: "75b33f253f7714a281ad3e9b28f63e3232d8ad8e5f6ac36e0e1e4e1f2f1e1c1c",
        input: { inputs: imageUrl },
      }),
    });
    if (!createResp.ok) throw new Error(`Replicate create error ${createResp.status}: ${(await createResp.text()).slice(0, 300)}`);
    const prediction = await createResp.json();

    // Poll until complete (Replicate predictions are async)
    let result = prediction;
    for (let i = 0; i < 30 && result.status !== "succeeded" && result.status !== "failed"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { authorization: `Token ${this.apiToken}` },
      });
      result = await pollResp.json();
    }
    if (result.status !== "succeeded") throw new Error(`Replicate embedding job did not succeed: ${result.status}`);
    // output shape depends on the specific CLIP deployment used
    const vec: number[] = Array.isArray(result.output) ? result.output : result.output?.embedding;
    return vec.slice(0, 512);
  }
}

/** Combines text + image embedding providers into the single interface the app depends on. */
export class CombinedEmbeddingService implements EmbeddingService {
  constructor(
    private textProvider: OpenAITextEmbeddingService | null,
    private imageProvider: ReplicateClipEmbeddingService | null
  ) {}

  async embedText(text: string): Promise<number[]> {
    if (!this.textProvider) return mockEmbedding(text);
    return this.textProvider.embedText(text);
  }

  async embedImage(imageUrl: string): Promise<number[]> {
    if (!this.imageProvider) return mockEmbedding(imageUrl);
    return this.imageProvider.embedImage(imageUrl);
  }
}

/**
 * Deterministic mock embedding — a 512-dim vector seeded from the input
 * string's characters. Not semantically meaningful, but stable (same input
 * -> same vector), so the pgvector similarity search machinery can be
 * exercised end-to-end without live credentials.
 */
function mockEmbedding(seedText: string): number[] {
  console.warn("[EmbeddingService] No embedding API key configured — using deterministic mock embedding. Set OPENAI_API_KEY and REPLICATE_API_TOKEN for real embeddings.");
  const vec = new Array(512).fill(0);
  let seed = 0;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) % 999999;
  for (let i = 0; i < 512; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    vec[i] = (seed / 2147483648) * 2 - 1;
  }
  return vec;
}

export function getEmbeddingService(): EmbeddingService {
  const textProvider = process.env.OPENAI_API_KEY ? new OpenAITextEmbeddingService(process.env.OPENAI_API_KEY) : null;
  const imageProvider = process.env.REPLICATE_API_TOKEN ? new ReplicateClipEmbeddingService(process.env.REPLICATE_API_TOKEN) : null;
  return new CombinedEmbeddingService(textProvider, imageProvider);
}
