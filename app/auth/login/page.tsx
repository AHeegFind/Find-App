"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/find");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360 }}>
        <div className="wordmark" style={{ fontSize: 30, marginBottom: 6, textAlign: "center" }}>F<span className="q-glyph">?</span>ND</div>
        <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginBottom: 32 }}>Log in to your account</div>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Email</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} />
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Password</label>
        <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 20 }} />
        {error && <div style={{ fontSize: 12.5, color: "#B4432E", marginBottom: 14 }}>{error}</div>}
        <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>{loading ? "Logging in…" : "Log in"}</button>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12.5 }}>
          No account? <a href="/auth/signup" style={{ fontWeight: 700, textDecoration: "underline" }}>Sign up</a>
        </div>
      </form>
    </div>
  );
}
