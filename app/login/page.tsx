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
            { icon: "✅", text: "Verify and access your dashboard" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(232,92,92,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 13, color: "#4A5568" }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Hero illustration */}
        <div style={{ marginTop: "auto", flex: 1, minHeight: 160, maxHeight: 220, display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 380 }}>
            {/* Phone */}
            <rect x="60" y="40" width="70" height="130" rx="12" fill="#fff" stroke="#FFCFC9" strokeWidth="2"/>
            <rect x="68" y="55" width="54" height="80" rx="6" fill="#FFF0EF"/>
            <circle cx="95" cy="155" r="6" fill="#FFCFC9"/>
            {/* WhatsApp icon on phone */}
            <circle cx="95" cy="95" r="18" fill="#25D366"/>
            <path d="M95 80c-8.28 0-15 6.72-15 15 0 2.64.69 5.12 1.89 7.28L80 110l7.97-1.85A14.93 14.93 0 0 0 95 110c8.28 0 15-6.72 15-15s-6.72-15-15-15zm7.5 20.5c-.31.87-1.8 1.66-2.5 1.76-.64.09-1.45.13-2.34-.15-.54-.16-1.23-.38-2.11-.75-3.72-1.6-6.15-5.36-6.34-5.61-.18-.25-1.5-2-.1-3.13.11-.09.22-.14.33-.16.22-.04.44-.04.63-.04.14 0 .3.01.46.5.18.55.62 1.76.67 1.89.06.13.1.28.02.44-.08.17-.12.27-.24.41-.12.14-.25.3-.36.41-.12.11-.24.24-.1.47.14.23.62 1.02 1.33 1.65.91.82 1.68 1.07 1.92 1.19.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.25 1.43z" fill="white"/>
            {/* Chat bubble */}
            <rect x="150" y="30" width="130" height="50" rx="14" fill="#fff" stroke="#E85C5C" strokeWidth="1.5"/>
            <path d="M165 80 L170 95 L185 80" fill="#fff" stroke="#E85C5C" strokeWidth="1.5" strokeLinejoin="round"/>
            <text x="168" y="52" fontSize="9" fill="#1A2744" fontFamily="Arial" fontWeight="600">Aaj 8000 kadam chale</text>
            <text x="168" y="65" fontSize="9" fill="#6B7A9A" fontFamily="Arial">dal chawal + dahi khaya 🥗</text>
            {/* Dashboard card */}
            <rect x="150" y="105" width="190" height="80" rx="14" fill="#fff" stroke="#E8F3FF" strokeWidth="1.5" style={{filter:"drop-shadow(0 4px 12px rgba(74,143,226,.12))"}}/>
            <text x="168" y="126" fontSize="9" fill="#6B7A9A" fontFamily="Arial">Steps Today</text>
            <text x="168" y="143" fontSize="16" fill="#1A2744" fontFamily="Arial" fontWeight="700">8,000</text>
            {/* Mini bar chart */}
            {[20,35,25,50,40,55,45].map((h, i) => (
              <rect key={i} x={285 + i * 8} y={170 - h * 0.5} width="5" height={h * 0.5} rx="2"
                fill={i === 5 ? "#1A2744" : "#BDDEFF"}/>
            ))}
            <text x="168" y="170" fontSize="8" fill="#3EB86A" fontFamily="Arial" fontWeight="600">✓ Goal reached!</text>
            {/* Heart pulse line */}
            <polyline points="50,175 65,175 72,155 79,195 86,160 93,180 100,175 350,175"
              stroke="#E85C5C" strokeWidth="1.5" fill="none" opacity="0.3"/>
          </svg>
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
