// POST /api/admin/jobs/[id]/retry
// Admin-triggered retry for a failed AI processing job. Verifies admin role,
// resets job status, then delegates to the same processor the original
// upload used, so retry logic never diverges from the primary path.
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

  await supabase.from("ai_processing_jobs").update({ status: "pending", error_message: null }).eq("id", params.id);

  const origin = req.nextUrl.origin;
  const processResp = await fetch(`${origin}/api/ai/process-job`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: params.id }),
  });
  const result = await processResp.json();

  return NextResponse.json(result, { status: processResp.status });
}
