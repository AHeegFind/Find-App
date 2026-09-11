// GET /api/admin/export — one-click CSV export of businesses + products,
// for the manual weekly backup habit described in the README. Admin-only.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const which = req.nextUrl.searchParams.get("table") || "products";

  if (which === "businesses") {
    const { data } = await supabase.from("businesses").select("*").order("created_at");
    return new NextResponse(toCsv(data || []), {
      headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="find-businesses-${new Date().toISOString().slice(0, 10)}.csv"` },
    });
  }

  const { data } = await supabase
    .from("products")
    .select("id, name, price, currency, location, dimensions, material, colour, availability, verification_status, moderation_status, business_id, created_at")
    .order("created_at");
  return new NextResponse(toCsv(data || []), {
    headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="find-products-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
