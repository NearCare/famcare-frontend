"use client";
import { useState } from "react";
import { inviteFamilyMember, verifyFamilyOtp, type FamilyMember } from "@/lib/api";

type Step = "details" | "otp" | "success";

interface Props {
  onClose: () => void;
  onAdded: (member: FamilyMember) => void;
}

export default function AddFamilyModal({ onClose, onAdded }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [type, setType] = useState<"family" | "friend">("family");
  const [label, setLabel] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedMember, setAddedMember] = useState<FamilyMember | null>(null);

  const phone = `+91${rawPhone}`;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!label.trim()) return setError("Please enter a name or label");
    if (rawPhone.length !== 10) return setError("Enter a valid 10-digit number");

    const token = localStorage.getItem("auth_token") ?? "";
    setLoading(true);
    try {
      await inviteFamilyMember(phone, label.trim(), type, token);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit OTP");

    const token = localStorage.getItem("auth_token") ?? "";
    setLoading(true);
    try {
      const member = await verifyFamilyOtp(phone, otp, label.trim(), type, token);
      setAddedMember(member);
      setStep("success");
      onAdded(member);
      setTimeout(onClose, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setOtp("");
    const token = localStorage.getItem("auth_token") ?? "";
    try {
      await inviteFamilyMember(phone, label.trim(), type, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    }
  }

  const stepIndex = { details: 0, otp: 1, success: 2 }[step];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 22,
          width: "100%", maxWidth: 460,
          padding: "32px 36px 28px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 18, right: 18,
            background: "#F5F3F8", border: "none", borderRadius: 10,
            width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#5A5F6E",
          }}
        >
          ✕
        </button>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 4,
              background: i <= stepIndex ? "#7C6FF7" : "#EDE8FF",
              transition: "background .3s",
            }} />
          ))}
        </div>

        {/* ── Step 1: details ── */}
        {step === "details" && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#2C2F3A", margin: "0 0 4px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Add a family member
            </h2>
            <p style={{ fontSize: 13.5, color: "#7A8099", margin: "0 0 22px", lineHeight: 1.5 }}>
              We&apos;ll send an OTP to their WhatsApp to confirm.
            </p>

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {(["family", "friend"] as const).map(t => (
                <button key={t} onClick={() => setType(t)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${type === t ? "#7C6FF7" : "#E8E4F5"}`,
                  background: type === t ? "#F0EEFF" : "#FAFAFA",
                  color: type === t ? "#7C6FF7" : "#9AA0AD",
                  fontWeight: 700, fontSize: 13.5,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "all .2s",
                }}>
                  {t === "family" ? "👨‍👩‍👦 Family" : "👫 Friend"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#5A5F6E", display: "block", marginBottom: 5 }}>
                  Name / Label
                </label>
                <input
                  type="text"
                  placeholder='e.g. "Dad", "Wife", "Best Friend"'
                  value={label}
                  onChange={e => { setLabel(e.target.value); setError(""); }}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "#7C6FF7"}
                  onBlur={e => e.target.style.borderColor = "#E8E4F5"}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#5A5F6E", display: "block", marginBottom: 5 }}>
                  WhatsApp Number
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    fontSize: 13.5, fontWeight: 700, color: "#7A8099",
                  }}>+91</div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit number"
                    maxLength={10}
                    value={rawPhone}
                    onChange={e => { setRawPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                    style={{ ...inputStyle, paddingLeft: 42 }}
                    onFocus={e => e.target.style.borderColor = "#7C6FF7"}
                    onBlur={e => e.target.style.borderColor = "#E8E4F5"}
                  />
                </div>
              </div>

              {error && <p style={{ fontSize: 12.5, color: "#E85C5C", margin: 0 }}>⚠ {error}</p>}

              <button type="submit" disabled={loading} style={primaryBtn("#7C6FF7", loading)}>
                {loading ? "Sending OTP…" : "Send OTP →"}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: OTP ── */}
        {step === "otp" && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#2C2F3A", margin: "0 0 4px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Verify OTP
            </h2>
            <p style={{ fontSize: 13.5, color: "#7A8099", margin: "0 0 22px", lineHeight: 1.5 }}>
              Enter the 6-digit code sent to <strong style={{ color: "#2C2F3A" }}>{phone}</strong> on WhatsApp.
            </p>

            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                value={otp}
                autoFocus
                onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                style={{
                  ...inputStyle,
                  fontSize: 26, letterSpacing: 10, textAlign: "center",
                  fontFamily: "'Courier New', monospace",
                }}
                onFocus={e => e.target.style.borderColor = "#7C6FF7"}
                onBlur={e => e.target.style.borderColor = "#E8E4F5"}
              />

              {error && <p style={{ fontSize: 12.5, color: "#E85C5C", margin: 0 }}>⚠ {error}</p>}

              <button type="submit" disabled={loading || otp.length !== 6} style={primaryBtn("#7C6FF7", loading || otp.length !== 6)}>
                {loading ? "Verifying…" : "Verify & Add Member"}
              </button>

              <button type="button" onClick={() => { setStep("details"); setOtp(""); setError(""); }}
                style={{ background: "none", border: "1.5px solid #E8E4F5", borderRadius: 11, padding: "11px 0", cursor: "pointer", fontSize: 13.5, color: "#7A8099", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>
                ← Go back
              </button>
            </form>

            <p style={{ marginTop: 16, textAlign: "center", fontSize: 12.5, color: "#9AA0AD" }}>
              Didn&apos;t receive it?{" "}
              <button onClick={handleResend} style={{ color: "#7C6FF7", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 12.5, padding: 0, fontFamily: "inherit" }}>
                Resend OTP
              </button>
            </p>
          </>
        )}

        {/* ── Step 3: success ── */}
        {step === "success" && (
          <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#2C2F3A", margin: "0 0 8px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {addedMember?.label ?? "Member"} added!
            </h2>
            <p style={{ fontSize: 13.5, color: "#7A8099", margin: 0, lineHeight: 1.6 }}>
              You can now track their health from your dashboard.
            </p>
            <div style={{ marginTop: 20, height: 4, borderRadius: 4, background: "#F0EEFF", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#7C6FF7", borderRadius: 4, animation: "shrink 2.2s linear forwards" }} />
            </div>
            <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  border: "1.5px solid #E8E4F5", borderRadius: 11,
  fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "#2C2F3A", background: "#FAFAFA", outline: "none",
  boxSizing: "border-box", transition: "border-color .2s",
};

function primaryBtn(color: string, disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 0", borderRadius: 11, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#C9C3F0" : color,
    color: "#fff", fontWeight: 800, fontSize: 14,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "background .2s",
  };
}
