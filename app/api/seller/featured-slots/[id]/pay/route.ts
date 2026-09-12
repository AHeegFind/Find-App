// POST /api/seller/featured-slots/[id]/pay
// Seller confirms payment for an offered featured slot. This route
// verifies the caller owns the underlying product and that the offer
// hasn't expired, then marks the slot paid and schedules it live.
//
// PAYMENT INTEGRATION NOTE: this route does not itself process a real
// payment. Real M-Pesa collection requires Safaricom's Daraja API (STK
// Push), which needs its own developer account and a separate
// integration outside this build's scope. For now: seller pays you
// directly (till/paybill), an admin confirms it happened, and this same
// route is called (manually, or via a future "confirm payment" button)
// to activate the slot. Building real Daraja collection later means
// swapping what triggers this call, not rewriting the logic below.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: slot, error: fetchError } = await supabase
    .from("featured_slots")
    .select("*, products(business_id, businesses(owner_id))")
    .eq("id", params.id)
    .single();

  if (fetchError || !slot) return NextResponse.json({ error: "Featured slot offer not found" }, { status: 404 });

  const ownerId = (slot.products as { businesses?: { owner_id?: string } } | null)?.businesses?.owner_id;
  if (ownerId !== user.id) return NextResponse.json({ error: "Not authorised for this offer" }, { status: 403 });

  if (slot.status !== "offered") {
    return NextResponse.json({ error: `This offer is no longer payable (status: ${slot.status})` }, { status: 409 });
  }
  if (new Date(slot.payment_deadline) < new Date()) {
    await supabase.from("featured_slots").update({ status: "lapsed" }).eq("id", params.id);
    return NextResponse.json({ error: "Payment window has expired" }, { status: 409 });
  }

  const { data: latestInSection } = await supabase
    .from("featured_slots")
    .select("end_date")
    .eq("discover_section", slot.discover_section)
    .in("status", ["paid", "live"])
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const startDate =
    latestInSection?.end_date && new Date(latestInSection.end_date) > now
      ? new Date(latestInSection.end_date)
      : now;
  const endDate = new Date(startDate.getTime() + slot.duration_days * 24 * 60 * 60 * 1000);

  const { data: updated, error: updateError } = await supabase
    .from("featured_slots")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (updateError) {
    console.error("[seller/featured-slots/pay] update error:", updateError);
    return NextResponse.json({ error: "Could not confirm payment" }, { status: 500 });
  }

  return NextResponse.json({ slot: updated });
}
