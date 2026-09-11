"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>We sent a confirmation link to {email}.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360 }}>
        <div className="wordmark" style={{ fontSize: 30, marginBottom: 6, textAlign: "center" }}>F<span className="q-glyph">?</span>ND</div>
        <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginBottom: 32 }}>Create your account</div>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Full name</label>
        <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ marginBottom: 14 }} />
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Email</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} />
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>Password</label>
        <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 20 }} />
        {error && <div style={{ fontSize: 12.5, color: "#B4432E", marginBottom: 14 }}>{error}</div>}
        <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>{loading ? "Creating…" : "Sign up"}</button>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12.5 }}>
          Already have an account? <a href="/auth/login" style={{ fontWeight: 700, textDecoration: "underline" }}>Log in</a>
        </div>
      </form>
    </div>
  );
}
