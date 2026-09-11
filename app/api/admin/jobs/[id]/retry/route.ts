// POST /api/admin/jobs/[id]/retry
// Admin-triggered retry for a failed AI processing job.
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
