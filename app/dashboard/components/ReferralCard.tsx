"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Gift, ShareNetwork, Sparkle } from "@phosphor-icons/react";
import { captureEvent } from "@/lib/analytics";
import { getReferralSummary, type ReferralSummary } from "@/lib/api";

const SHARE_GREETING =
  "Hi 👋 I’ve been using FamCare to track meals, medicines and family health through WhatsApp. You can try it using my referral link:";

function formatRewardDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReferralCard({ placement = "dashboard" }: { placement?: "dashboard" | "sidebar" }) {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async (fresh = false) => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setSummary(await getReferralSummary({ fresh }));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSummary(false); }, [loadSummary]);

  const referralUrl = useMemo(() => {
    if (!summary || typeof window === "undefined") return "";
    return `${window.location.origin}/login?ref=${encodeURIComponent(summary.code)}`;
  }, [summary]);

  const rewardDate = formatRewardDate(summary?.reward_ends_at ?? null);
  const rewardPlan = summary?.reward_plan_key === "family" ? "Family" : "Individual";
  const rewardEligible = summary?.eligible !== false;

  async function copyFallback(fullMessage: string) {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setShareFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      captureEvent("referral_message_copied", { source: `${placement}_referral_card` });
    } catch {
      setShareFailed(true);
    }
  }

  async function shareReferral() {
    if (!summary || !referralUrl) {
      if (!loading) await loadSummary(true);
      return;
    }
    const fullMessage = `${SHARE_GREETING}\n${referralUrl}`;
    captureEvent("referral_card_clicked", {
      source: placement,
      joined: summary.joined,
      qualified: summary.qualified,
      reward_eligible: summary.eligible,
    });

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Try FamCare with me",
          text: SHARE_GREETING,
          url: referralUrl,
        });
        captureEvent("referral_native_share_completed", { source: `${placement}_referral_card` });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }
    await copyFallback(fullMessage);
  }

  return (
    <button
      className={`homev2-referral-card ${placement}-referral-card`}
      type="button"
      onClick={() => void shareReferral()}
      disabled={loading}
      aria-label="Share your FamCare referral link"
    >
      <span className="homev2-referral-orbit" aria-hidden="true" />
      <span className="homev2-referral-sparkles" aria-hidden="true">✦ · ✧</span>
      <span className="homev2-referral-icon" aria-hidden="true"><Gift size={28} weight="duotone" /></span>
      <span className="homev2-referral-copy">
        <span className="homev2-referral-tag">
          <Sparkle size={11} weight="fill" /> {rewardEligible ? "Refer & unlock" : "Share FamCare"}
        </span>
        <strong>{rewardEligible ? "Give FamCare. Get a month free." : "Care is better together."}</strong>
        <small>
          {loadFailed
            ? "Your referral link couldn’t load. Tap to try again."
            : !rewardEligible
              ? "Invite someone you care about to try FamCare."
              : rewardDate
            ? `${rewardPlan} access unlocked until ${rewardDate}. Refer again to extend it.`
            : "When a friend subscribes, you unlock 30 days of the same plan."}
        </small>
      </span>
      <span className="homev2-referral-action">
        {loading
          ? "Getting link…"
          : loadFailed
            ? "Try again"
            : copied
              ? "Message copied"
              : shareFailed
                ? "Sharing unavailable"
                : "Invite someone"}
        {copied ? <Sparkle size={14} weight="fill" /> : <ShareNetwork size={16} weight="bold" />}
      </span>
      <ArrowRight className="homev2-referral-arrow" size={15} weight="bold" aria-hidden="true" />
    </button>
  );
}
