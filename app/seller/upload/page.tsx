"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadProductImage } from "@/lib/supabase/storage";

export default function SellerUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", price: "", location: "", dimensions: "", material: "", colour: "", customizable: false });
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  function handleFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please select a product photo"); return; }
    setStatus("uploading");
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
      if (!business) throw new Error("No business found for this account");

      const rawImageUrl = await uploadProductImage(file, business.id);

      const resp = await fetch("/api/products/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          name: form.name,
          price: Number(form.price),
          rawImageUrl,
          location: form.location || null,
          dimensions: form.dimensions || null,
          material: form.material || null,
          colour: form.colour || null,
          availability: form.customizable ? "customizable" : "in_stock",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Upload failed");

      setStatus("processing");

      // Fire the queued AI jobs (vision, image generation, embedding) —
      // sequential so image_generation can read vision's output.
      for (const job of data.jobs || []) {
        await fetch("/api/ai/process-job", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        }).catch((err) => console.error(`Job ${job.id} (${job.job_type}) failed:`, err));
      }

      setStatus("done");
      setTimeout(() => router.push("/seller/dashboard"), 1200);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 500, marginBottom: 24 }}>Upload a product</div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label htmlFor="product-photo" style={{ display: "block", border: "1px dashed var(--line)", borderRadius: 12, padding: preview ? 0 : "32px 20px", textAlign: "center", cursor: "pointer", overflow: "hidden" }}>
          {preview ? (
            <img src={preview} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--ink-secondary)" }}>add_photo_alternate</span>
              <div style={{ fontSize: 13, color: "var(--ink-secondary)", marginTop: 8 }}>Tap to add a product photo</div>
            </>
          )}
          <input id="product-photo" ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>

        <Field label="Product name" required><input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Price (KSh)" required><input className="input" type="number" required value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="Location"><input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="Dimensions"><input className="input" placeholder="e.g. W120 x D80 x H75 cm" value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} /></Field>
        <Field label="Material"><input className="input" value={form.material} onChange={(e) => set("material", e.target.value)} /></Field>
        <Field label="Colour"><input className="input" value={form.colour} onChange={(e) => set("colour", e.target.value)} /></Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={form.customizable} onChange={(e) => setForm((f) => ({ ...f, customizable: e.target.checked }))} />
          Customizable — I can remake this if it sells out
        </label>

        {error && <div style={{ fontSize: 12.5, color: "var(--error)" }}>{error}</div>}

        <button className="btn-primary" type="submit" disabled={status === "uploading" || status === "processing"}>
          {status === "idle" && "Upload product"}
          {status === "uploading" && "Uploading photo…"}
          {status === "processing" && "AI analysing your product…"}
          {status === "done" && "Done — redirecting…"}
          {status === "error" && "Try again"}
        </button>
        <p style={{ fontSize: 11.5, color: "var(--ink-secondary)", lineHeight: 1.5, textAlign: "center" }}>
          After upload, AI will analyse your photo, generate a polished catalogue image, and tag it automatically. Your product enters the review queue once processing finishes.
        </p>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-sm" style={{ display: "block", marginBottom: 8, color: "var(--ink-secondary)" }}>{label}{required && " *"}</label>
      {children}
    </div>
  );
}
