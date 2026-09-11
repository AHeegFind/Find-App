// =============================================================================
// ModerationService — basic safety check before a seller-uploaded image is
// eligible for admin review. Not a substitute for human moderation; a
// coarse automated filter to catch obvious problems early.
// =============================================================================
import type { ModerationService, ModerationResult } from "./types";

export class OpenAIModerationService implements ModerationService {
  constructor(private apiKey: string) {}

  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    const resp = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url: imageUrl } }] }),
    });
    if (!resp.ok) throw new Error(`OpenAI moderation error ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const data = await resp.json();
    const result = data.results[0];
    return {
      approved: !result.flagged,
      reason: result.flagged ? Object.entries(result.categories).filter(([, v]) => v).map(([k]) => k).join(", ") : undefined,
    };
  }
}

export class MockModerationService implements ModerationService {
  async moderateImage(): Promise<ModerationResult> {
    console.warn("[ModerationService] No OPENAI_API_KEY configured — auto-approving. Set OPENAI_API_KEY for real content moderation.");
    return { approved: true };
  }
}

export function getModerationService(): ModerationService {
  if (process.env.OPENAI_API_KEY) return new OpenAIModerationService(process.env.OPENAI_API_KEY);
  return new MockModerationService();
}
