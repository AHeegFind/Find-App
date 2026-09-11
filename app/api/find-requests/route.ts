// POST /api/find-requests — "Find it for me" capture (name/email/WhatsApp)
// when a search comes up empty or weak. Works for logged-in or anonymous users.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.email || !body.email.includes("@")) {
    return NextResponse.json({ error: "Name and a valid email are required" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("find_it_requests")
    .insert({
      user_id: user?.id ?? null,
      name: body.name,
      email: body.email,
      whatsapp: body.whatsapp ?? null,
      query_image_url: body.queryImageUrl ?? null,
      detected_tags: body.detectedTags ?? [],
      item_type: body.itemType ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[find-requests] insert error:", error);
    return NextResponse.json({ error: "Could not save your request" }, { status: 500 });
  }

  return NextResponse.json({ request: data });
}
