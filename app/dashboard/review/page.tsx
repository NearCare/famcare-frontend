"use client";

import { useMemo, useState } from "react";
import { CheckCircle, ChatCircleText, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import { submitReviewFeedback, type ReviewFeedbackType } from "@/lib/api";

const feedbackTypes: { value: ReviewFeedbackType; label: string; helper: string }[] = [
  { value: "feature", label: "Feature request", helper: "Something you want us to build" },
  { value: "improvement", label: "Improvement", helper: "Something that can feel better" },
  { value: "issue", label: "Issue", helper: "Something broken or confusing" },
  { value: "other", label: "Other", helper: "Anything else on your mind" },
];

export default function ReviewPage() {
  const [type, setType] = useState<ReviewFeedbackType>("feature");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = useMemo(
    () => feedbackTypes.find((item) => item.value === type) ?? feedbackTypes[0],
    [type],
  );
  const trimmed = message.trim();
  const canSubmit = trimmed.length >= 5 && trimmed.length <= 2000 && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await submitReviewFeedback({
        type,
        message: trimmed,
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
      });
      setMessage("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="db-page">
      <Sidebar />
      <main className="db-main">
        <div className="db-topbar">
          <div>
            <h1 className="db-greeting">Review</h1>
            <p className="db-subtitle">Tell us what to build, improve, or fix next.</p>
          </div>
        </div>

        <section className="review-layout" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 18,
          alignItems: "start",
          maxWidth: 1080,
        }}>
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#fff",
              border: "1.5px solid var(--he-card-border)",
              borderRadius: 20,
              boxShadow: "0 12px 32px rgba(31,28,35,.05)",
              padding: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: "var(--he-coral-bg)",
                color: "var(--he-coral-deep)",
                display: "grid",
                placeItems: "center",
                flex: "none",
              }}>
                <ChatCircleText size={22} weight="bold" />
              </div>
              <div>
                <h2 style={{ margin: 0, color: "#1A2744", fontSize: 19, fontWeight: 900 }}>Share feedback</h2>
                <p style={{ margin: "4px 0 0", color: "#8D94A7", fontSize: 13, fontWeight: 700 }}>
                  It goes directly into our tracking sheet.
                </p>
              </div>
            </div>

            <div className="review-type-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 18 }}>
              {feedbackTypes.map((item) => {
                const active = item.value === type;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setType(item.value)}
                    style={{
                      minHeight: 70,
                      border: active ? "1.5px solid var(--he-coral)" : "1.5px solid var(--he-card-border)",
                      borderRadius: 14,
                      background: active ? "var(--he-coral-bg)" : "#FAFAFA",
                      color: active ? "var(--he-coral-deep)" : "#5A6170",
                      cursor: "pointer",
                      padding: 10,
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 900 }}>{item.label}</span>
                    <span style={{ display: "block", marginTop: 4, fontSize: 10.5, lineHeight: 1.35, fontWeight: 700, color: active ? "var(--he-coral-deep)" : "#9AA0AD" }}>
                      {item.helper}
                    </span>
                  </button>
                );
              })}
            </div>

            <label style={{ display: "block", color: "#1A2744", fontSize: 13.5, fontWeight: 900, marginBottom: 8 }}>
              What should we know?
            </label>
            <textarea
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setSuccess(false);
              }}
              placeholder="Example: I want medicine refill reminders, or calories are overestimated for homemade food..."
              rows={9}
              maxLength={2000}
              style={{
                width: "100%",
                resize: "vertical",
                border: "1.5px solid var(--he-card-border)",
                borderRadius: 16,
                outline: "none",
                padding: 15,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                color: "#1A2744",
                lineHeight: 1.6,
                background: "#FAFAFA",
                boxSizing: "border-box",
              }}
            />
            <div className="review-submit-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 10 }}>
              <span style={{ color: trimmed.length > 2000 ? "var(--he-coral-deep)" : "#9AA0AD", fontSize: 12, fontWeight: 800 }}>
                {trimmed.length}/2000
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  height: 44,
                  border: "none",
                  borderRadius: 14,
                  background: canSubmit ? "var(--he-coral)" : "#E7E3EA",
                  color: canSubmit ? "#fff" : "#9AA0AD",
                  padding: "0 18px",
                  fontFamily: "inherit",
                  fontSize: 13.5,
                  fontWeight: 900,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PaperPlaneTilt size={16} weight="bold" />
                {submitting ? "Submitting..." : "Submit review"}
              </button>
            </div>

            {success && (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, color: "var(--he-green-deep)", background: "var(--he-green-bg)", borderRadius: 14, padding: "11px 12px", fontSize: 13, fontWeight: 900 }}>
                <CheckCircle size={17} weight="fill" /> Submitted. We&apos;ll review this.
              </div>
            )}
            {error && (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, color: "var(--he-coral-deep)", background: "var(--he-coral-bg)", borderRadius: 14, padding: "11px 12px", fontSize: 13, fontWeight: 900 }}>
                <WarningCircle size={17} weight="fill" /> {error}
              </div>
            )}
          </form>

          <aside style={{
            background: "linear-gradient(165deg, var(--he-orange-bg), #fff 70%)",
            border: "1.5px solid #FFE1BE",
            borderRadius: 20,
            padding: 20,
            boxShadow: "0 12px 32px rgba(31,28,35,.04)",
          }}>
            <p style={{ margin: 0, color: "#1A2744", fontSize: 16, fontWeight: 900 }}>{selectedType.label}</p>
            <p style={{ margin: "8px 0 0", color: "#777F95", fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>
              Good feedback is specific: what happened, what you expected, and who it affects.
            </p>
            <div style={{ marginTop: 18, borderTop: "1px dashed #FFD7AA", paddingTop: 16, display: "grid", gap: 10 }}>
              {[
                "What were you trying to do?",
                "What felt slow, confusing, or missing?",
                "Would this help you, your parent, or the family admin?",
              ].map((item) => (
                <div key={item} style={{ display: "flex", gap: 9, alignItems: "flex-start", color: "#5A6170", fontSize: 12.5, fontWeight: 800, lineHeight: 1.55 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--he-orange)", flex: "none", marginTop: 7 }} />
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
