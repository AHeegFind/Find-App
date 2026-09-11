// =============================================================================
// VisionAnalysisService implementations
// =============================================================================
import type { VisionAnalysisService, VisionAttributes } from "./types";

/**
 * Anthropic Claude vision implementation.
 * Requires ANTHROPIC_API_KEY. Uses the Messages API with an image block.
 */
export class AnthropicVisionService implements VisionAnalysisService {
  constructor(private apiKey: string) {}

  async analyze(imageUrl: string): Promise<VisionAttributes> {
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) throw new Error(`Could not fetch image at ${imageUrl}: ${imageResp.status}`);
    const contentType = imageResp.headers.get("content-type") || "image/jpeg";
    const buffer = await imageResp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: contentType, data: base64 } },
              {
                type: "text",
                text: `Analyse this product photo for an e-commerce catalogue. Respond with ONLY raw JSON, no markdown fences:
{
  "item_type": "short noun phrase, e.g. 'floor lamp'",
  "description": "one sentence describing what you see",
  "tags": ["5-8 lowercase single/two-word search tags covering category, colour, material, style"],
  "colour": "primary colour, or null",
  "material": "primary material, or null",
  "style": "one style descriptor, or null",
  "confidence": 0.0-1.0
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic vision API error ${resp.status}: ${errText.slice(0, 300)}`);
    }

    const data = await resp.json();
    const textBlock = (data.content || []).find((b: any) => b.type === "text");
    if (!textBlock) throw new Error("Anthropic vision response had no text block");

    const clean = textBlock.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      itemType: parsed.item_type,
      description: parsed.description,
      tags: parsed.tags || [],
      colour: parsed.colour || undefined,
      material: parsed.material || undefined,
      style: parsed.style || undefined,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
    };
  }
}

/**
 * OpenAI GPT-4o vision implementation, provided as an alternate provider so
 * the app is not locked to a single vendor. Requires OPENAI_API_KEY.
 */
export class OpenAIVisionService implements VisionAnalysisService {
  constructor(private apiKey: string) {}

  async analyze(imageUrl: string): Promise<VisionAttributes> {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse this product photo for an e-commerce catalogue. Respond with JSON only:
{"item_type": "...", "description": "...", "tags": ["..."], "colour": "...", "material": "...", "style": "...", "confidence": 0.0}`,
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI vision API error ${resp.status}: ${errText.slice(0, 300)}`);
    }

    const data = await resp.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      itemType: parsed.item_type,
      description: parsed.description,
      tags: parsed.tags || [],
      colour: parsed.colour || undefined,
      material: parsed.material || undefined,
      style: parsed.style || undefined,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
    };
  }
}

/**
 * Deterministic mock — used automatically when no vision API key is
 * configured, so the rest of the app (routes, UI, DB writes) can be
 * exercised end-to-end without live credentials. NEVER used if a real key
 * is present. Clearly logs that it's a mock so this is never mistaken for
 * a real analysis in production.
 */
export class MockVisionService implements VisionAnalysisService {
  async analyze(imageUrl: string): Promise<VisionAttributes> {
    console.warn("[VisionAnalysisService] No API key configured — using MockVisionService. Set ANTHROPIC_API_KEY or OPENAI_API_KEY for real analysis.");
    let seed = 0;
    for (const ch of imageUrl) seed += ch.charCodeAt(0);
    const kinds = [
      { type: "floor lamp", tags: ["lamp", "floor lamp", "white", "metal", "minimalist"], colour: "white", material: "metal", style: "minimalist" },
      { type: "accent chair", tags: ["chair", "accent chair", "cream", "boucle", "curved"], colour: "cream", material: "boucle", style: "curved" },
      { type: "vase", tags: ["vase", "ceramic", "terracotta", "decor"], colour: "terracotta", material: "ceramic", style: "earthy" },
      { type: "dress", tags: ["dress", "cotton", "print", "midi"], colour: "multicolour", material: "cotton", style: "printed" },
    ];
    const chosen = kinds[seed % kinds.length];
    return {
      itemType: chosen.type,
      description: `[MOCK] A ${chosen.colour} ${chosen.type}, ${chosen.material} material.`,
      tags: chosen.tags,
      colour: chosen.colour,
      material: chosen.material,
      style: chosen.style,
      confidence: 0.5,
    };
  }
}

/** Factory — picks the first available provider based on configured env vars. */
export function getVisionService(): VisionAnalysisService {
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicVisionService(process.env.ANTHROPIC_API_KEY);
  if (process.env.OPENAI_API_KEY) return new OpenAIVisionService(process.env.OPENAI_API_KEY);
  return new MockVisionService();
}
