// POST /api/admin/featured-slots — admin offers a product a featured slot.
// This is the curation gate: only admin-approved products can ever reach
// payment, so "featured" always means editorially chosen, never
// highest-bidder. Creates the offer with a payment deadline; the seller
// then has that window to pay via /api/seller/featured-slots/[id]/pay.
//
// GET /api/admin/featured-slots — list all slots (any status) for the
// admin dashboard's Featured tab.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const { data: caller } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  return { user };
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { error } = await requireAdmin(supabase);
  if (error) return error;

  const { data, error: fetchError } = await supabase
    .from("featured_slots")
    .select("*, products(id, name, price, currency, businesses(name))")
    .order("created_at", { ascending: false });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  return NextResponse.json({ slots: data });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { user, error } = await requireAdmin(supabase);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { productId, placementType, discoverSection, keywords, positionTier, price, durationDays, paymentWindowHours } = body || {};

  const type = placementType || "discover";
  if (!productId || !price) {
    return NextResponse.json({ error: "productId and price are required" }, { status: 400 });
  }
  if (type === "discover" && !discoverSection) {
    return NextResponse.json({ error: "discoverSection is required for discover placements" }, { status: 400 });
  }
  if ((type === "search_keyword" || type === "search_visual") && (!keywords || keywords.length === 0)) {
    return NextResponse.json({ error: "At least one keyword is required for search placements" }, { status: 400 });
  }

  const deadline = new Date(Date.now() + (paymentWindowHours ?? 48) * 60 * 60 * 1000);

  const { data: slot, error: insertError } = await supabase
    .from("featured_slots")
    .insert({
      product_id: productId,
      placement_type: type,
      discover_section: type === "discover" ? discoverSection : null,
      keywords: type === "search_keyword" || type === "search_visual" ? keywords : [],
      position_tier: positionTier === "top" ? "top" : "standard",
      price,
      duration_days: durationDays ?? 7,
      payment_deadline: deadline.toISOString(),
      status: "offered",
      created_by: user!.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[admin/featured-slots] insert error:", insertError);
    return NextResponse.json({ error: "Could not create featured slot offer" }, { status: 500 });
  }

  return NextResponse.json({ slot });
}
