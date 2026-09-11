// POST /api/admin/products/[id]/review
// Admin approves or rejects a single product.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AdminCheckResult =
  | { user: { id: string }; error?: undefined }
  | { user?: undefined; error: NextResponse };

async function requireAdmin(supabase: ReturnType<typeof createClient>): Promise<AdminCheckResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: caller } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };

  return { user };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const check = await requireAdmin(supabase);
  if (check.error) return check.error;
  const user = check.user!;

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
