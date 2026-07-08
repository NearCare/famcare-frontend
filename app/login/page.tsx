"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { getCurrentUser, sendOtp, verifyOtp } from "@/lib/api";

type Step = "phone" | "otp";

function ButtonLoader({ label }: { label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <span
        aria-hidden="true"
        style={{
          width: 15,
          height: 15,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,.45)",
          borderTopColor: "#fff",
          animation: "loginSpin .8s linear infinite",
          flex: "none",
        }}
      />
      {label}
    </span>
  );
}

function SessionLoader() {
  return (
    <div
      className="login-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(145deg,#FFF8F6 0%,#FFFFFF 52%,#F2FFF8 100%)",
      }}
    >
      <div
        style={{
          width: "min(360px, 100%)",
          borderRadius: 20,
          border: "1px solid #F0E4E4",
          background: "#fff",
          boxShadow: "0 18px 50px rgba(26,20,20,.10)",
          padding: 28,
          textAlign: "center",
        }}
      >
        <img src="/famcare-logo.png" alt="" style={{ width: 54, height: 54, objectFit: "contain", borderRadius: 14 }} />
        <div
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "3px solid rgba(232,92,92,.22)",
            borderTopColor: "#E85C5C",
            animation: "loginSpin .8s linear infinite",
            margin: "18px auto 0",
          }}
        />
        <h1 style={{ margin: "18px 0 6px", fontSize: 22, lineHeight: 1.2, color: "#1A2744" }}>
          Opening your dashboard
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#6B7A9A" }}>
          Checking your saved FamCare session.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/onboarding/name");
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function resumeSavedSession() {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const authUser = await getCurrentUser(token);
        if (cancelled) return;

        if (!authUser) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          setCheckingSession(false);
          return;
        }

        localStorage.setItem("auth_user", JSON.stringify(authUser));
        setRedirecting(true);
        router.replace(authUser.name ? "/dashboard" : "/onboarding/name");
      } catch {
        if (!cancelled) {
          setError("Couldn't check your saved session. Please log in again if the dashboard does not open.");
          setCheckingSession(false);
        }
      }
    }

    resumeSavedSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function startResendTimer() {
    setResendTimer(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Step 1: send OTP ────────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phone.length !== 10) return setError("Please enter a valid 10-digit mobile number");

    // Prepend +91 for India
    const normalized = `+91${phone}`;

    setLoading(true);
    try {
      await sendOtp(normalized);
      setPhone(normalized);
      setStep("otp");
      startResendTimer();
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
    let keepLoading = false;
    try {
      const auth = await verifyOtp(phone, otp.trim());
      // Save session to localStorage
      localStorage.setItem("auth_token", auth.token);
      localStorage.setItem("auth_user", JSON.stringify(auth.user));
      setRedirecting(true);
      keepLoading = true;
      router.replace(auth.user.name ? "/dashboard" : "/onboarding/name");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  }

  const busy = loading || redirecting;

  if (checkingSession || redirecting) return <SessionLoader />;

  return (
    <div className="login-page" style={{ display: "flex", height: "100vh", padding: 20, gap: 20, alignItems: "stretch", overflow: "hidden" }}>

      {/* Left hero */}
      <div className="login-hero" style={{
        flex: 1.25,
        background: "linear-gradient(145deg,#FFF5F3 0%,#FFE8E4 55%,#FFD8D0 100%)",
        borderRadius: 20, padding: "28px 36px 0",
        display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", top: -70, right: -70, width: 220, height: 220, background: "rgba(232,92,92,.07)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: 120, left: -50, width: 160, height: 160, background: "rgba(232,92,92,.05)", borderRadius: "50%" }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
          <img src="/famcare-logo.png" alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 11 }} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>
            Fam<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Care</em>
          </span>
        </div>

        {/* Copy */}
        <div style={{ marginTop: 24, position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-.5px" }}>
            Welcome to<br />
            <em style={{ color: "#E85C5C", fontStyle: "normal" }}>FamCare</em>
          </h1>
          <p style={{ marginTop: 10, fontSize: 13, color: "#6B7A9A", lineHeight: 1.65, maxWidth: 340 }}>
            Set WhatsApp medicine reminders, confirm doses, and keep your family updated from one simple dashboard.
          </p>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 20, position: "relative", zIndex: 1 }}>
          {[
            { icon: "📱", text: "Enter your WhatsApp number" },
            { icon: "💬", text: "Get a one-time code on WhatsApp" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(232,92,92,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 13, color: "#4A5568" }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Hero image — fills remaining space */}
        <div className="login-hero-image" style={{ flex: 1, position: "relative", zIndex: 1, marginTop: 16, borderRadius: "16px 16px 0 0", overflow: "hidden", minHeight: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/family-whatsapp.webp"
            alt="Family using WhatsApp"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block", borderRadius: "16px 16px 0 0" }}
          />
        </div>
      </div>

      {/* Right form */}
      <div className="login-form" style={{
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
                  placeholder="10-digit mobile number"
                  value={phone}
                  maxLength={10}
                  inputMode="numeric"
                  onChange={e => {
                    // Only allow digits, max 10
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(digits);
                    setError("");
                  }}
                  style={{
                    width: "100%", padding: "13px 14px 13px 44px",
                    border: "1.5px solid #EDE6E6", borderRadius: 8,
                    fontSize: 14, fontFamily: "inherit",
                    color: "#1A2744",
                    background: "#FAFAFA", outline: "none", boxSizing: "border-box",
                    transition: "color .2s",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#E85C5C"; e.target.style.background = "#fff"; }}
                  onBlur={e => { e.target.style.borderColor = "#EDE6E6"; e.target.style.background = "#FAFAFA"; }}
                />
                {/* Digit counter */}
                {phone.length > 0 && phone.length < 10 && (
                  <div style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    fontSize: 11, color: "#B0BFCC", fontWeight: 500,
                  }}>
                    {phone.length}/10
                  </div>
                )}
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "#E85C5C", margin: 0 }}>⚠ {error}</p>
              )}

              <button
                type="submit"
                disabled={busy || phone.length !== 10}
                style={{
                  marginTop: 4, width: "100%", padding: 14,
                  background: busy || phone.length !== 10 ? "#F0A0A0" : "#E85C5C", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
                  fontFamily: "inherit", cursor: busy || phone.length !== 10 ? "not-allowed" : "pointer",
                  transition: "background .2s",
                }}
              >
                {loading ? <ButtonLoader label="Sending…" /> : "Get OTP on WhatsApp"}
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
                  ref={otpInputRef}
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
                disabled={busy || otp.length !== 6}
                style={{
                  marginTop: 4, width: "100%", padding: 14,
                  background: busy || otp.length !== 6 ? "#F0A0A0" : "#E85C5C", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
                  fontFamily: "inherit", cursor: busy || otp.length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {redirecting ? <ButtonLoader label="Opening dashboard…" /> : loading ? <ButtonLoader label="Verifying…" /> : "Verify & Log In"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("phone"); setOtp(""); setError(""); setResendTimer(0); if (timerRef.current) clearInterval(timerRef.current); }}
                disabled={busy}
                style={{
                  width: "100%", padding: 13, border: "1.5px solid #EDE6E6", borderRadius: 8,
                  background: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit",
                  color: "#6B7A9A", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .7 : 1,
                }}
              >
                ← Change number
              </button>
            </form>

            {/* Resend */}
            <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#6B7A9A" }}>
              Didn&apos;t receive it?{" "}
              {resendTimer > 0 ? (
                <span style={{ color: "#B0BFCC", fontWeight: 600 }}>
                  Resend in {resendTimer}s
                </span>
              ) : (
                <button
                  onClick={async () => {
                    setError("");
                    setOtp("");
                    setLoading(true);
                    try { await sendOtp(phone); startResendTimer(); }
                    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
                    finally { setLoading(false); }
                  }}
                  disabled={busy}
                  style={{ color: "#E85C5C", fontWeight: 600, background: "none", border: "none", cursor: busy ? "not-allowed" : "pointer", fontSize: 13, padding: 0 }}
                >
                  Resend OTP
                </button>
              )}
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
