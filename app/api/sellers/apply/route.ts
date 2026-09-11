// POST /api/sellers/apply
// Creates (or reuses) a business record for the current user and files a
// verification application against it. The business exists immediately
// (unverified) so the seller can start uploading products right away;
// verification_status gates whether products can reach "find_verified".
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { name, bio, location, whatsapp, instagram, tiktok, website, notes, supportingLinks } = body || {};
  if (!name) return NextResponse.json({ error: "Business name is required" }, { status: 400 });

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({
      owner_id: user.id,
      name,
      bio: bio ?? null,
      location: location ?? null,
      whatsapp: whatsapp ?? null,
      instagram: instagram ?? null,
      tiktok: tiktok ?? null,
      website: website ?? null,
      verification_status: "pending",
    })
    .select()
    .single();

  if (bizError || !business) {
    console.error("[sellers/apply] business insert error:", bizError);
    return NextResponse.json({ error: "Could not create business" }, { status: 500 });
  }

  // Promote the user's role to seller so seller-portal UI unlocks immediately.
  await supabase.from("users").update({ role: "seller" }).eq("id", user.id);

  const { data: application, error: appError } = await supabase
    .from("seller_applications")
    .insert({
      business_id: business.id,
      applicant_id: user.id,
      business_registration_notes: notes ?? null,
      supporting_links: supportingLinks ?? [],
      status: "pending",
    })
    .select()
    .single();

  if (appError) {
    console.error("[sellers/apply] application insert error:", appError);
    return NextResponse.json({ error: "Business created but application failed" }, { status: 500 });
  }

  return NextResponse.json({ business, application });
}
