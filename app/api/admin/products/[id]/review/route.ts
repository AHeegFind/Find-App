// POST /api/admin/products/[id]/review
// Admin approves or rejects a single product. Approving makes it publicly
// searchable (moderation_status='approved' is what public RLS policies and
// the search route gate on). Also sets verification_status to
// find_verified if the owning business is already verified.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { decision } = body || {};
  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("business_id")
    .eq("id", params.id)
    .single();
  if (productError || !product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  let verificationStatus: "find_verified" | "found_online" = "found_online";
  if (decision === "approved" && product.business_id) {
    const { data: business } = await supabase
      .from("businesses")
      .select("verification_status")
      .eq("id", product.business_id)
      .single();
    if (business?.verification_status === "verified") verificationStatus = "find_verified";
  }

  const { data: updated, error } = await supabase
    .from("products")
    .update({
      moderation_status: decision,
      moderated_by: user.id,
      moderated_at: new Date().toISOString(),
      verification_status: verificationStatus,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("[admin/products/review] update error:", error);
    return NextResponse.json({ error: "Could not update product" }, { status: 500 });
  }

  return NextResponse.json({ product: updated });
}
