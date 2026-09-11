"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerApplyPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", bio: "", location: "", whatsapp: "", instagram: "", tiktok: "", website: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const resp = await fetch("/api/sellers/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await resp.json();
    setLoading(false);
    if (!resp.ok) { setError(data.error || "Could not submit application"); return; }
    router.push("/seller/dashboard");
  }

  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 500, marginBottom: 6 }}>Sell on Find</div>
      <div style={{ fontSize: 13, color: "var(--ink-secondary)", marginBottom: 28, lineHeight: 1.5 }}>
        Register your business. You can start uploading products right away — a Find team member will verify your business, and verified sellers get the Find Verified badge.
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Business name" required>
          <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Bio">
          <textarea className="input" rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </Field>
        <Field label="Location">
          <input className="input" placeholder="e.g. Nairobi" value={form.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="WhatsApp number">
          <input className="input" placeholder="+254…" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </Field>
        <Field label="Instagram handle">
          <input className="input" placeholder="@yourbrand" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
        </Field>
        <Field label="TikTok handle">
          <input className="input" placeholder="@yourbrand" value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} />
        </Field>
        <Field label="Website">
          <input className="input" placeholder="yourbrand.co.ke" value={form.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field label="Anything else for the review team">
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        {error && <div style={{ fontSize: 12.5, color: "var(--error)" }}>{error}</div>}
        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-sm" style={{ display: "block", marginBottom: 8, color: "var(--ink-secondary)" }}>
        {label}{required && " *"}
      </label>
      {children}
    </div>
  );
}
