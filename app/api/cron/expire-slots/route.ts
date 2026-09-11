// GET /api/cron/expire-slots
// Scheduled job: activates 'paid' slots whose start_date has arrived
// (flips them to 'live'), and calls the DB function that expires 'live'
// slots past end_date and lapses unpaid 'offered' slots past their
// deadline. Wire this to run every 15-60 minutes via Vercel Cron (see
// vercel.json) or any external scheduler hitting this URL.
//
// Protect with CRON_SECRET so this can't be triggered by randoms hitting
// the URL — Vercel Cron sends this automatically when configured.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Activate paid slots whose scheduled start has arrived
  const { data: toActivate, error: activateFetchError } = await supabase
    .from("featured_slots")
    .select("id")
    .eq("status", "paid")
    .lte("start_date", new Date().toISOString());

  if (activateFetchError) {
    console.error("[cron/expire-slots] fetch-to-activate error:", activateFetchError);
  }

  let activatedCount = 0;
  if (toActivate && toActivate.length > 0) {
    const { error: activateError } = await supabase
      .from("featured_slots")
      .update({ status: "live" })
      .in("id", toActivate.map((s) => s.id));
    if (activateError) console.error("[cron/expire-slots] activate error:", activateError);
    else activatedCount = toActivate.length;
  }

  // Expire live slots past end_date, lapse unpaid offers past deadline
  const { error: expireError } = await supabase.rpc("expire_featured_slots");
  if (expireError) console.error("[cron/expire-slots] expire_featured_slots RPC error:", expireError);

  return NextResponse.json({ activated: activatedCount, ranAt: new Date().toISOString() });
}
