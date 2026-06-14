"use client";
import { useState } from "react";
import { X, Users, UserCheck, WarningCircle, DeviceMobile } from "@phosphor-icons/react";
import { FESmartphone } from "./FluentEmoji";
import { inviteFamilyMember, type FamilyMember } from "@/lib/api";

type Step = "details" | "sent";

interface Props {
  onClose: () => void;
  onAdded: (member: FamilyMember) => void;
}

export default function AddFamilyModal({ onClose, onAdded }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [type, setType] = useState<"family" | "friend">("family");
  const [label, setLabel] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentMember, setSentMember] = useState<FamilyMember | null>(null);

  const phone = `+91${rawPhone}`;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!label.trim()) return setError("Please enter a name or label");
    if (rawPhone.length !== 10) return setError("Enter a valid 10-digit number");

    const token = localStorage.getItem("auth_token") ?? "";
    setLoading(true);
    try {
      const member = await inviteFamilyMember(phone, label.trim(), type, token);
      setSentMember(member);
      onAdded(member);
      setStep("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

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
          width: "100%", maxWidth: 440,
          padding: "32px 36px 28px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          position: "relative",
        }}
      >
        {/* Close */}
        <button onClick={onClose} style={{ ...closeBtnStyle, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} weight="bold" /></button>

        {/* Progress */}
        <div style={{ display: "flex", gap: 5, marginBottom: 28 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 4,
              background: i <= (step === "sent" ? 1 : 0) ? "#7C6FF7" : "#EDE8FF",
              transition: "background .3s",
            }} />
          ))}
        </div>

        {/* ── Step 1: details ── */}
        {step === "details" && (
          <>
            <h2 style={headingStyle}>Add a family member</h2>
            <p style={subStyle}>
              They&apos;ll get a WhatsApp message and just need to reply <strong>YES</strong> to join.
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
                  {t === "family"
                    ? <><Users size={15} weight="bold" style={{ verticalAlign: "middle", marginRight: 5 }} />Family</>
                    : <><UserCheck size={15} weight="bold" style={{ verticalAlign: "middle", marginRight: 5 }} />Friend</>}
                </button>
              ))}
            </div>

            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div>
                <label style={labelStyle}>Name / Label</label>
                <input
                  type="text"
                  placeholder='e.g. "Dad", "Mom", "Best Friend"'
                  value={label}
                  onChange={e => { setLabel(e.target.value); setError(""); }}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "#7C6FF7"}
                  onBlur={e => e.target.style.borderColor = "#E8E4F5"}
                />
              </div>

              <div>
                <label style={labelStyle}>WhatsApp Number</label>
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

              {error && <p style={{ fontSize: 12.5, color: "#E85C5C", margin: 0, display: "flex", alignItems: "center", gap: 5 }}><WarningCircle size={14} weight="bold" />{error}</p>}

              <button type="submit" disabled={loading} style={primaryBtnStyle(loading)}>
                {loading ? "Sending…" : "Send WhatsApp Invite →"}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: invite sent ── */}
        {step === "sent" && (
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}><FESmartphone size={64} /></div>
            <h2 style={{ ...headingStyle, marginBottom: 8 }}>Invite sent!</h2>
            <p style={{ fontSize: 13.5, color: "#7A8099", lineHeight: 1.65, margin: "0 0 6px" }}>
              A WhatsApp message was sent to{" "}
              <strong style={{ color: "#2C2F3A" }}>{phone}</strong>.
            </p>
            <p style={{ fontSize: 13.5, color: "#7A8099", lineHeight: 1.65, margin: "0 0 24px" }}>
              Once <strong style={{ color: "#2C2F3A" }}>{sentMember?.label}</strong> replies{" "}
              <strong style={{ color: "#7C6FF7" }}>YES</strong>, they&apos;ll appear active on your dashboard.
            </p>

            {/* Preview of what dad gets */}
            <div style={{
              background: "#F4F1FF", borderRadius: 14, padding: "14px 16px",
              textAlign: "left", marginBottom: 22,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9AA0AD", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                WhatsApp message preview
              </div>
              <p style={{ fontSize: 12.5, color: "#4A4560", lineHeight: 1.6, margin: 0 }}>
                <em>wants to track your health on <strong>NearCare</strong> 🌱</em><br />
                Reply <strong>YES</strong> to join and start logging your health together!
              </p>
            </div>

            <button onClick={onClose} style={primaryBtnStyle(false)}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 800, color: "#2C2F3A",
  margin: "0 0 6px", fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const subStyle: React.CSSProperties = {
  fontSize: 13.5, color: "#7A8099", margin: "0 0 20px", lineHeight: 1.55,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#5A5F6E",
  display: "block", marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  border: "1.5px solid #E8E4F5", borderRadius: 11,
  fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', sans-serif",
  color: "#2C2F3A", background: "#FAFAFA", outline: "none",
  boxSizing: "border-box", transition: "border-color .2s",
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute", top: 18, right: 18,
  background: "#F5F3F8", border: "none", borderRadius: 10,
  width: 32, height: 32, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 16, color: "#5A5F6E",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "12px 0", borderRadius: 11,
    border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#C9C3F0" : "#7C6FF7",
    color: "#fff", fontWeight: 800, fontSize: 14,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "background .2s",
  };
}
