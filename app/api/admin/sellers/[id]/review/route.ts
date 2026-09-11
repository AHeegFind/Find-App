// POST /api/admin/sellers/[id]/review
// Admin approves or rejects a seller application. [id] is the
// seller_applications.id. Verifies caller is admin before doing anything.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Explicit return type here is what fixes the "Property 'role' does not
// exist on type 'never'" build error: without it, TypeScript can't prove
// a consistent shape across the function's two return paths and collapses
// inference down to `never`. Naming the type is a one-line fix that stops
// the build from misreading the function's real, always-safe shape.
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
  const { decision, rejectionReason } = body || {};
  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const { data: application, error: appError } = await supabase
    .from("seller_applications")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === "rejected" ? rejectionReason ?? null : null,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (appError || !application) {
    console.error("[admin/sellers/review] update error:", appError);
    return NextResponse.json({ error: "Could not update application" }, { status: 500 });
  }

  const { error: bizError } = await supabase
    .from("businesses")
    .update({
      verification_status: decision === "approved" ? "verified" : "rejected",
      verified_at: decision === "approved" ? new Date().toISOString() : null,
      verified_by: decision === "approved" ? user.id : null,
    })
    .eq("id", application.business_id);

  if (bizError) console.error("[admin/sellers/review] business update error:", bizError);

  if (decision === "approved") {
    await supabase
      .from("products")
      .update({ verification_status: "find_verified" })
      .eq("business_id", application.business_id)
      .eq("moderation_status", "approved");
  }

  return NextResponse.json({ application });
}
