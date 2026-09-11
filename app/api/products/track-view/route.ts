// POST /api/products/track-view — fire-and-forget view logging, called
// from the client whenever a product card or detail page is actually
// rendered to a user. Intentionally minimal: no auth requirement (views
// from anonymous browsers count too), no response body needed by the caller.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("product_views").insert({
    product_id: body.productId,
    user_id: user?.id ?? null,
    source: ["browse", "discover", "search_image", "search_text"].includes(body.source) ? body.source : "browse",
  });

  return NextResponse.json({ ok: true });
}
