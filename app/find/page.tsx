"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Stage = "home" | "uploading" | "analyzing" | "results" | "error";

export default function FindPage() {
  const [stage, setStage] = useState<Stage>("home");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedTags, setDetectedTags] = useState<string[]>([]);
  const [buckets, setBuckets] = useState<{ exact: any[]; similar: any[]; more: any[] }>({ exact: [], similar: [], more: [] });
  const [sponsored, setSponsored] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFindForMe, setShowFindForMe] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setStage("uploading");
    setErrorMessage(null);
    setShowFindForMe(false);

    try {
      const supabase = createClient();
      const path = `queries/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("search-queries").upload(path, file);
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from("search-queries").getPublicUrl(path);

      setStage("analyzing");

      const resp = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: urlData.publicUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Search failed");

      setDetectedTags(data.detectedTags || []);
      setBuckets(data.buckets || { exact: [], similar: [], more: [] });
      setSponsored(data.sponsored || []);
      setStage("results");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Something went wrong analysing this photo.");
      setStage("error");
    }
  }

  function reset() {
    setStage("home"); setPreviewUrl(null); setDetectedTags([]);
    setBuckets({ exact: [], similar: [], more: [] }); setErrorMessage(null); setShowFindForMe(false); setSponsored([]);
    if (cameraRef.current) cameraRef.current.value = "";
    if (uploadRef.current) uploadRef.current.value = "";
  }

  const totalResults = buckets.exact.length + buckets.similar.length + buckets.more.length;

  if (stage === "home") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 22px" }}>
        <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div className="wordmark" style={{ fontSize: 44, marginBottom: 8 }}>
            F<span className="q-glyph">?</span>ND
          </div>
          <p className="font-display" style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.35, marginBottom: 40 }}>
            See something you love?<br />Find it.
          </p>

          <div className="lens-wrap" onClick={() => cameraRef.current?.click()}>
            <div className="lens-ring-outer" />
            <div className="lens-ring-mid" />
            <div className="lens-core">
              <span className="material-symbols-outlined" style={{ color: "var(--background)", fontSize: 40 }}>photo_camera</span>
            </div>
            <div className="lens-glint" />
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
          <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", marginBottom: 22 }}>Tap to take a photo</div>

          <label
            htmlFor="find-upload-input"
            className="btn-outline"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>upload</span> Or upload photo
          </label>
          <input id="find-upload-input" ref={uploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      </div>
    );
  }

  if (stage === "uploading" || stage === "analyzing") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {previewUrl && (
          <img src={previewUrl} alt="" style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", marginBottom: 24, border: "3px solid var(--background)" }} />
        )}
        <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
          {stage === "uploading" ? "Uploading your photo…" : "Finding your match…"}
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="wrap">
        <button onClick={reset} className="top-back-btn" style={{ marginBottom: 20, position: "static" }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 4, padding: "24px 20px", textAlign: "center" }}>
          <div className="font-display" style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Couldn't analyse this photo</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>{errorMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={reset} className="top-back-btn" style={{ position: "static", flexShrink: 0 }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        {previewUrl && <img src={previewUrl} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }} />}
        <div className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>We found this for you</div>
      </div>

      {sponsored.length > 0 && <ResultSection title="Sponsored" items={sponsored} />}
      {buckets.exact.length > 0 && <ResultSection title="Exact / Close Matches" items={buckets.exact} />}
      {buckets.similar.length > 0 && <ResultSection title="Similar Finds" items={buckets.similar} />}
      {buckets.more.length > 0 && <ResultSection title="More Options" items={buckets.more} />}

      {totalResults === 0 && (
        <div style={{ textAlign: "center", padding: "20px 10px 30px" }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No matches yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>Our catalogue is growing every week.</div>
        </div>
      )}

      <button onClick={reset} className="btn-outline" style={{ marginBottom: 30 }}>Search another photo</button>

      <div style={{ borderTop: "1.5px solid var(--line)", paddingTop: 22, textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Trying to find what you're looking for?</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
          Tell us what you want and we'll help track it down.
        </div>
        {!showFindForMe ? (
          <button className="btn-primary" onClick={() => setShowFindForMe(true)}>Find it for me</button>
        ) : (
          <FindItForMeForm queryImageUrl={previewUrl} detectedTags={detectedTags} onClose={() => setShowFindForMe(false)} />
        )}
      </div>
    </div>
  );
}

function FindItForMeForm({ queryImageUrl, detectedTags, onClose }: { queryImageUrl: string | null; detectedTags: string[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !email.includes("@")) {
      setError("Please enter your name and a valid email address.");
      return;
    }
    setError(null);
    try {
      await fetch("/api/find-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, whatsapp, queryImageUrl, detectedTags, itemType: detectedTags[0] }),
      });
      setSent(true);
    } catch (err) {
      console.error("find-request submit failed", err);
      setError("Something went wrong — please try again.");
    }
  }

  if (sent) {
    return (
      <div style={{ fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span className="material-symbols-outlined filled" style={{ fontSize: 18 }}>check_circle</span>
        Thanks — we'll be in touch.
      </div>
    );
  }

  return (
    <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 12 }}>
      <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="tel" placeholder="WhatsApp number (+254…)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
      {error && <div style={{ fontSize: 12, color: "var(--error)" }}>{error}</div>}
      <button className="btn-primary" onClick={submit}>Submit request</button>
    </div>
  );
}

function ResultSection({ title, items }: { title: string; items: any[] }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div className="section-label">{title}</div>
      <div className="grid">{items.map((r) => <ProductCard key={r.id} product={r} />)}</div>
    </div>
  );
}

function ProductCard({ product }: { product: any }) {
  const primaryImage = product.product_images?.find((i: any) => i.is_primary) || product.product_images?.[0];
  const imgUrl = primaryImage?.processed_image_url || primaryImage?.raw_image_url;
  const business = product.businesses;

  const content = (
    <>
      <div className="card-img">
        {imgUrl && <img src={imgUrl} alt={product.name} />}
        {product.sponsored && (
          <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: "var(--ink)", color: "var(--background)", padding: "3px 7px", borderRadius: 3 }}>
            Sponsored
          </span>
        )}
      </div>
      <div className="card-price">
        {product.currency || "KSh"} {Number(product.price).toLocaleString()}
        {product.availability === "customizable" && <span className="tag-customizable">Customizable</span>}
      </div>
      <div className="card-name">{product.name}</div>
      <div className="card-meta">
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>location_on</span>
        {product.location || business?.location}
      </div>
      {product.verification_status === "find_verified" ? (
        <span className="badge-verified"><span className="material-symbols-outlined filled" style={{ fontSize: 12 }}>verified</span>Find Verified</span>
      ) : (
        <span className="badge-found">Found Online</span>
      )}
    </>
  );

  if (product.source_type === "web_indexed" && product.source_url) {
    return <a href={product.source_url} target="_blank" rel="noopener noreferrer">{content}</a>;
  }
  return <a href={`/browse/product/${product.id}`}>{content}</a>;
}
