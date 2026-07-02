"use client";
import { useEffect, useRef, useState } from "react";
import { X, Users, UserCheck, WarningCircle } from "@phosphor-icons/react";
import { FESmartphone } from "./FluentEmoji";
import { inviteFamilyMember, getFamilyMembers, type FamilyMember } from "@/lib/api";

type Step = "details" | "sent" | "success";

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface Props {
  onClose: () => void;
  onAdded: (member: FamilyMember) => void;
  onActivated?: () => void;
}

export default function AddFamilyModal({ onClose, onAdded, onActivated }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [type, setType] = useState<"family" | "friend">("family");
  const [label, setLabel] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentMember, setSentMember] = useState<FamilyMember | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Poll for the family member replying YES, then animate to success and refresh the dashboard.
  useEffect(() => {
    if (step !== "sent" || !sentMember) return;

    const token = localStorage.getItem("auth_token") ?? "";
    const startedAt = Date.now();

    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      try {
        const members = await getFamilyMembers(token);
        const updated = members.find(m => m.id === sentMember.id);
        if (updated?.status === "active") {
          if (pollRef.current) clearInterval(pollRef.current);
          setSentMember(updated);
          onAdded(updated);
          setStep("success");
          onActivated?.();
        }
      } catch {
        // ignore transient polling errors, keep retrying
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, sentMember?.id, onAdded, onActivated]);

  // Auto-close shortly after the success animation plays.
  useEffect(() => {
    if (step !== "success") return;
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [step, onClose]);

  return (
    <div
      onClick={onClose}
      className="db-modal-overlay"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="db-modal-sheet"
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
        <div style={{ display: "flex", gap: 5, marginBottom: 28, paddingRight: 64 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 4,
              background: i <= (step === "details" ? 0 : step === "sent" ? 1 : 2) ? "#7C6FF7" : "#EDE8FF",
              transition: "background .3s",
            }} />
          ))}
        </div>

        {/* ── Step 1: details ── */}
        {step === "details" && (
          <>
            <h2 style={headingStyle}>Add a family member</h2>
            <p style={subStyle}>
              They&apos;ll get a WhatsApp invite and can reply <strong>YES</strong> to join.
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
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  {t === "family"
                    ? <><Users size={15} weight="bold" /><span>Family</span></>
                    : <><UserCheck size={15} weight="bold" /><span>Friend</span></>}
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
              A WhatsApp invite was sent to <strong style={{ color: "#2C2F3A" }}>{phone}</strong>.
            </p>
            <p style={{ fontSize: 13.5, color: "#7A8099", lineHeight: 1.65, margin: "0 0 24px" }}>
              Once {sentMember?.label} replies <strong style={{ color: "#7C6FF7" }}>YES</strong>,
              they&apos;ll appear active on your dashboard.
            </p>

            {/* Message preview */}
            <div style={{
              background: "#F4F1FF", borderRadius: 14, padding: "14px 16px",
              textAlign: "left", marginBottom: 22,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9AA0AD", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                WhatsApp message preview
              </div>
              <p style={{ fontSize: 12.5, color: "#4A4560", lineHeight: 1.6, margin: 0 }}>
                <strong>FamCare request:</strong> Your name wants to add you as a family member.
                Reply <strong>YES</strong> to accept, or ignore if unknown.
              </p>
            </div>

            {/* Waiting state — polling for the YES reply */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              marginBottom: 10, color: "#7C6FF7", fontSize: 12.5, fontWeight: 700,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: "#7C6FF7",
                display: "inline-block", animation: "dbWaitPulse 1.1s ease-in-out infinite",
              }} />
              Waiting for {sentMember?.label} to reply…
            </div>
            <p style={{ fontSize: 12.5, color: "#7A8099", lineHeight: 1.55, margin: "0 0 18px" }}>
              After they accept the request, refresh this page once to see their updated status.
            </p>

            <button onClick={onClose} style={primaryBtnStyle(false)}>Done</button>
          </div>
        )}

        {/* ── Step 3: activated ── */}
        {step === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
            <div style={{
              display: "flex", justifyContent: "center", marginBottom: 18,
              animation: "dbSuccessPop .5s cubic-bezier(.34,1.56,.64,1)",
            }}>
              <div style={{
                width: 76, height: 76, borderRadius: "50%",
                background: "#E9F9EF", display: "grid", placeItems: "center",
              }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4 10-10" stroke="#2FBE76" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray="24" strokeDashoffset="24"
                    style={{ animation: "dbCheckDraw .45s .15s ease-out forwards" }} />
                </svg>
              </div>
            </div>
            <h2 style={{ ...headingStyle, marginBottom: 8 }}>
              {sentMember?.label} is in! 🎉
            </h2>
            <p style={{ fontSize: 13.5, color: "#7A8099", lineHeight: 1.65, margin: "0 0 4px" }}>
              They replied <strong style={{ color: "#2FBE76" }}>YES</strong> and are now active on your dashboard.
            </p>
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
