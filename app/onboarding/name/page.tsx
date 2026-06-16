"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updateUserName, type User } from "@/lib/api";

export default function OnboardingNamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const stored = localStorage.getItem("auth_user");
    const user: User | null = stored ? JSON.parse(stored) : null;

    if (!token || !user) { router.replace("/login"); return; }
    if (user.name) { router.replace("/dashboard"); return; }

    setReady(true);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) return setError("Please enter your name");

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token") ?? "";
      const stored = localStorage.getItem("auth_user");
      const user: User | null = stored ? JSON.parse(stored) : null;
      if (!user) { router.replace("/login"); return; }

      const updated = await updateUserName(user.id, trimmed, token);
      localStorage.setItem("auth_user", JSON.stringify(updated));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <div style={{ display: "flex", height: "100vh", padding: 20, alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: "52px 44px",
        boxShadow: "0 6px 28px rgba(26,20,20,.10)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>👋</div>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.3px", margin: 0 }}>What should we call you?</h2>
        <p style={{ marginTop: 6, fontSize: 14, color: "#6B7A9A" }}>
          This helps your family recognize you on NearCare.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            maxLength={60}
            autoFocus
            onChange={e => { setName(e.target.value); setError(""); }}
            style={{
              width: "100%", padding: "13px 14px",
              border: "1.5px solid #EDE6E6", borderRadius: 8,
              fontSize: 16, fontFamily: "inherit",
              color: "#1A2744", background: "#FAFAFA", outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => { e.target.style.borderColor = "#E85C5C"; e.target.style.background = "#fff"; }}
            onBlur={e => { e.target.style.borderColor = "#EDE6E6"; e.target.style.background = "#FAFAFA"; }}
          />

          {error && (
            <p style={{ fontSize: 13, color: "#E85C5C", margin: 0 }}>⚠ {error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              marginTop: 4, width: "100%", padding: 14,
              background: loading || !name.trim() ? "#F0A0A0" : "#E85C5C", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
              fontFamily: "inherit", cursor: loading || !name.trim() ? "not-allowed" : "pointer",
              transition: "background .2s",
            }}
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
