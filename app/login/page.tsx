"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { sendOtp, verifyOtp } from "@/lib/api";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: send OTP ────────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) return setError("Please enter your phone number");

    // Normalise: ensure leading +
    const normalized = phone.trim().startsWith("+") ? phone.trim() : `+${phone.trim()}`;

    setLoading(true);
    try {
      await sendOtp(normalized);
      setPhone(normalized);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP ──────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) return setError("OTP must be 6 digits");

    setLoading(true);
    try {
      const auth = await verifyOtp(phone, otp.trim());
      // Save session to localStorage
      localStorage.setItem("auth_token", auth.token);
      localStorage.setItem("auth_user", JSON.stringify(auth.user));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", padding: 20, gap: 20, alignItems: "stretch" }}>

      {/* Left hero */}
      <div style={{
        flex: 1.25,
        background: "linear-gradient(145deg,#FFF5F3 0%,#FFE8E4 55%,#FFD8D0 100%)",
        borderRadius: 20, padding: "36px 40px 0",
        display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", top: -70, right: -70, width: 220, height: 220, background: "rgba(232,92,92,.07)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: 120, left: -50, width: 160, height: 160, background: "rgba(232,92,92,.05)", borderRadius: "50%" }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
          <div style={{ width: 38, height: 38, background: "#E85C5C", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 17.2C10 17.2 2.5 12.5 2.5 7.5A5 5 0 0 1 10 3.84 5 5 0 0 1 17.5 7.5C17.5 12.5 10 17.2 10 17.2Z" fill="white" />
              <circle cx="10" cy="7.5" r="1.8" fill="#E85C5C" />
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>
            Health<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Ease</em>
          </span>
        </div>

        {/* Copy */}
        <div style={{ marginTop: 52, position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-.5px" }}>
            Welcome to<br />
            <em style={{ color: "#E85C5C", fontStyle: "normal" }}>HealthEase</em>
          </h1>
          <p style={{ marginTop: 14, fontSize: 14, color: "#6B7A9A", lineHeight: 1.7, maxWidth: 340 }}>
            Track appointments, monitor your health journey, and find nearby providers — your complete health companion. ❤️
          </p>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 36, position: "relative", zIndex: 1 }}>
          {[
            { icon: "📱", text: "Enter your WhatsApp number" },
            { icon: "💬", text: "Get a one-time code on WhatsApp" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(232,92,92,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 13, color: "#4A5568" }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Hero image */}
        <div style={{ marginTop: "auto", position: "relative", zIndex: 1, borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/family-whatsapp.png" alt="Family using WhatsApp" style={{ width: "100%", display: "block", borderRadius: "16px 16px 0 0" }} />
        </div>
      </div>

      {/* Right form */}
      <div style={{
        flex: 1, background: "#fff", borderRadius: 20, padding: "52px 44px",
        display: "flex", flexDirection: "column", justifyContent: "center",
        boxShadow: "0 6px 28px rgba(26,20,20,.10)",
      }}>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {(["phone", "otp"] as Step[]).map((s, i) => (
            <div key={s} style={{
              height: 4, flex: 1, borderRadius: 4,
              background: step === s || (i === 0 && step === "otp") ? "#E85C5C" : "#EDE6E6",
              transition: "background .3s",
            }} />
          ))}
        </div>

        {step === "phone" ? (
          <>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.3px" }}>Log in with WhatsApp</h2>
            <p style={{ marginTop: 6, fontSize: 14, color: "#6B7A9A" }}>
              We&apos;ll send a one-time code to your WhatsApp number.
            </p>

            <form onSubmit={handleSendOtp} style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#B0BFCC" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.61a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(""); }}
                  style={{
                    width: "100%", padding: "13px 14px 13px 44px",
                    border: "1.5px solid #EDE6E6", borderRadius: 8,
                    fontSize: 14, fontFamily: "inherit", color: "#1A2744",
                    background: "#FAFAFA", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#E85C5C"; e.target.style.background = "#fff"; }}
                  onBlur={e => { e.target.style.borderColor = "#EDE6E6"; e.target.style.background = "#FAFAFA"; }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "#E85C5C", margin: 0 }}>⚠ {error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4, width: "100%", padding: 14,
                  background: loading ? "#F0A0A0" : "#E85C5C", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
                  fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Sending…" : "Get OTP on WhatsApp"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.3px" }}>Enter your OTP</h2>
            <p style={{ marginTop: 6, fontSize: 14, color: "#6B7A9A" }}>
              We sent a 6-digit code to <strong style={{ color: "#1A2744" }}>{phone}</strong> on WhatsApp.
            </p>

            <form onSubmit={handleVerifyOtp} style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#B0BFCC" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                  autoFocus
                  style={{
                    width: "100%", padding: "13px 14px 13px 44px",
                    border: "1.5px solid #EDE6E6", borderRadius: 8,
                    fontSize: 22, fontFamily: "'Courier New', monospace", letterSpacing: 8,
                    color: "#1A2744", background: "#FAFAFA", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#E85C5C"; e.target.style.background = "#fff"; }}
                  onBlur={e => { e.target.style.borderColor = "#EDE6E6"; e.target.style.background = "#FAFAFA"; }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "#E85C5C", margin: 0 }}>⚠ {error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                style={{
                  marginTop: 4, width: "100%", padding: 14,
                  background: loading || otp.length !== 6 ? "#F0A0A0" : "#E85C5C", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
                  fontFamily: "inherit", cursor: loading || otp.length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Verifying…" : "Verify & Log In"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                style={{
                  width: "100%", padding: 13, border: "1.5px solid #EDE6E6", borderRadius: 8,
                  background: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit",
                  color: "#6B7A9A", cursor: "pointer",
                }}
              >
                ← Change number
              </button>
            </form>

            {/* Resend */}
            <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#6B7A9A" }}>
              Didn&apos;t receive it?{" "}
              <button
                onClick={async () => {
                  setError("");
                  setLoading(true);
                  try { await sendOtp(phone); }
                  catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
                  finally { setLoading(false); }
                }}
                style={{ color: "#E85C5C", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}
              >
                Resend OTP
              </button>
            </p>
          </>
        )}

        <p style={{ marginTop: 28, textAlign: "center", fontSize: 13 }}>
          <Link href="/" style={{ color: "#6B7A9A", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
