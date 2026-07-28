"use client";

import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CheckCircle,
  Crown,
  Heart,
  LockKey,
  Receipt,
  ShieldCheck,
  Sparkle,
  SpinnerGap,
  UsersThree,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import V2RouteGate from "../components/V2RouteGate";
import {
  cancelSubscription,
  createExtraParentCheckout,
  createSubscriptionCheckout,
  getBillingPlans,
  getSubscriptionDetails,
  verifySubscriptionCheckout,
  type BillingPlanKey,
  type BillingPlansResponse,
  type SubscriptionCheckout,
  type SubscriptionDetails,
} from "@/lib/api";
import { refreshSubscriptionState } from "@/lib/useSubscription";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  subscription_id?: string;
  name: string;
  description: string;
  image: string;
  prefill: { name: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
};

type RazorpayFailure = {
  error?: {
    description?: string;
  };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

// Icons cycle by feature position — copy/pricing itself always comes from the
// backend's /api/billing/plans catalog so it can never drift from checkout.
const FEATURE_ICONS = [WhatsappLogo, CheckCircle, UsersThree, Sparkle];

const currencyFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const renewalDateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const rupees = (amountPaise: number) => currencyFormatter.format(amountPaise / 100);

// How long to keep polling for the webhook to land before giving up and
// telling the user we're still confirming instead of claiming success.
const RECONCILE_ATTEMPTS = 8;
const RECONCILE_INTERVAL_MS = 3000;

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsPageContent />
    </Suspense>
  );
}

function PaymentsPageContent() {
  const searchParams = useSearchParams();
  const [planKey, setPlanKey] = useState<BillingPlanKey>("family");
  const [plansData, setPlansData] = useState<BillingPlansResponse | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingExtraParent, setSubmittingExtraParent] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [planNotice, setPlanNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBillingPlans()
      .then((data) => { if (!cancelled) setPlansData(data); })
      .catch(() => { if (!cancelled) setPlansError("Plan pricing could not be loaded. Refresh to try again."); });
    return () => { cancelled = true; };
  }, []);

  const refreshSubscription = useCallback(
    () => getSubscriptionDetails().then(setSubscription).catch(() => undefined),
    [],
  );

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const plan = plansData?.plans.find((entry) => entry.plan_key === planKey) ?? null;
  const formattedPrice = plan ? rupees(plan.amount_paise) : null;

  // ── Post-checkout success screen ────────────────────────────────────────
  // The redirect only carries a payment reference and the amount actually
  // charged — never a "verified"/"active" claim. Whether the plan is really
  // active is decided here, live, from the backend on every load.
  const successParam = searchParams.get("success");
  const successKind = searchParams.get("kind") === "extra_parent" ? "extra_parent" : "plan";
  const successPlanKey = (searchParams.get("plan") as BillingPlanKey | null) ?? "family";
  const successAmountPaise = Number(searchParams.get("amount") ?? "0");
  const successPaymentId = searchParams.get("payment_id") ?? "";
  const hasSuccessParams = successParam === "1";

  const [reconcileAttempt, setReconcileAttempt] = useState(0);
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirmed = hasSuccessParams && subscription
    ? successKind === "extra_parent"
      ? (subscription.extra_parents ?? 0) > 0
      : subscription.active && subscription.plan_key === successPlanKey
    : false;

  useEffect(() => {
    if (!hasSuccessParams || confirmed) return;
    if (reconcileAttempt >= RECONCILE_ATTEMPTS) return;
    reconcileTimer.current = setTimeout(() => {
      refreshSubscription().finally(() => setReconcileAttempt((n) => n + 1));
    }, RECONCILE_INTERVAL_MS);
    return () => {
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    };
  }, [hasSuccessParams, confirmed, reconcileAttempt, refreshSubscription]);

  const timedOut = hasSuccessParams && !confirmed && reconcileAttempt >= RECONCILE_ATTEMPTS;

  // The FamCare+ marker (sidebar wordmark, profile menu, Plus upsell banner) is
  // driven by a module-level snapshot that was cached before this payment. Once
  // the plan is genuinely active, invalidate it so every page shows Plus right
  // away — "Go to home" is a client-side navigation and would keep the old one.
  useEffect(() => {
    if (!confirmed) return;
    void refreshSubscriptionState();
  }, [confirmed]);

  const successPlanInfo = useMemo(() => {
    if (!hasSuccessParams) return null;
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    const fallbackAmount = successAmountPaise > 0 ? successAmountPaise : 0;
    const planFromCatalog = plansData?.plans.find((entry) => entry.plan_key === successPlanKey);
    return {
      name: successKind === "extra_parent"
        ? (plansData?.extra_parent.name ?? "Extra parent")
        : (planFromCatalog?.name ?? (successPlanKey === "family" ? "Family plan" : "Individual plan")),
      amount: rupees(subscription && confirmed ? subscription.amount_paise || fallbackAmount : fallbackAmount),
      nextRenewal: subscription?.current_period_end
        ? renewalDateFormatter.format(new Date(subscription.current_period_end))
        : renewalDateFormatter.format(nextRenewal),
    };
  }, [hasSuccessParams, successKind, successPlanKey, successAmountPaise, plansData, subscription, confirmed]);

  async function confirmCancel() {
    setPlanNotice(null);
    setCancelling(true);
    try {
      const result = await cancelSubscription();
      setCancelOpen(false);
      setPlanNotice({ tone: "success", text: result.message });
      await refreshSubscription();
      // Plan stays live until the period ends, so the FamCare+ marker stays too —
      // but extra-parent seats and renewal copy change, so re-read the snapshot.
      void refreshSubscriptionState();
    } catch (error) {
      setPlanNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Your plan could not be cancelled right now.",
      });
    } finally {
      setCancelling(false);
    }
  }

  async function openCheckout() {
    setNotice(null);
    if (!scriptReady || !window.Razorpay) {
      setNotice({ tone: "error", text: "Secure checkout is still loading. Try again in a moment." });
      return;
    }

    setSubmitting(true);
    try {
      const checkout = await createSubscriptionCheckout(planKey);
      launchRazorpay(checkout, `FamCare ${plan?.name ?? "plan"} · monthly subscription`, "plan");
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Checkout could not be started.",
      });
      setSubmitting(false);
    }
  }

  async function openExtraParentCheckout() {
    setNotice(null);
    if (!scriptReady || !window.Razorpay) {
      setNotice({ tone: "error", text: "Secure checkout is still loading. Try again in a moment." });
      return;
    }

    setSubmittingExtraParent(true);
    try {
      const checkout = await createExtraParentCheckout();
      launchRazorpay(checkout, "FamCare extra parent · monthly add-on", "extra_parent");
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Checkout could not be started.",
      });
      setSubmittingExtraParent(false);
    }
  }

  function launchRazorpay(checkout: SubscriptionCheckout, description: string, kind: "plan" | "extra_parent") {
    if (!window.Razorpay) return;
    const razorpay = new window.Razorpay({
      key: checkout.key_id,
      subscription_id: checkout.subscription_id,
      name: "FamCare",
      description,
      image: `${window.location.origin}/famcare-logo.png`,
      prefill: {
        name: checkout.customer_name,
        contact: checkout.customer_phone,
      },
      theme: { color: "#24b76b" },
      handler: async (response) => {
        try {
          if (!response.razorpay_subscription_id) {
            throw new Error("Razorpay did not return a subscription ID.");
          }
          await verifySubscriptionCheckout({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature,
          });
          const params = new URLSearchParams({
            success: "1",
            kind,
            plan: checkout.plan_key,
            amount: String(checkout.amount_paise),
            payment_id: response.razorpay_payment_id,
          });
          window.location.href = `/dashboard/payments?${params.toString()}`;
          return;
        } catch (error) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Payment verification is pending.",
          });
        } finally {
          setSubmitting(false);
          setSubmittingExtraParent(false);
        }
      },
      modal: {
        ondismiss: () => {
          setSubmitting(false);
          setSubmittingExtraParent(false);
        },
      },
    });
    razorpay.on("payment.failed", (response) => {
      setSubmitting(false);
      setSubmittingExtraParent(false);
      setNotice({
        tone: "error",
        text: response.error?.description ?? "Payment failed. Please try another payment method.",
      });
    });
    razorpay.open();
  }

  if (hasSuccessParams) {
    return (
      <V2RouteGate>
        <div className="db-page">
          <Sidebar />
          <main className="db-main payment-page">
            <header className="payment-page-head">
              <div>
                <span>Plans & billing</span>
                <h1>{confirmed ? "You're all set!" : "Almost there…"}</h1>
                <p>
                  {confirmed
                    ? "Here's a summary of your subscription and what to do next."
                    : "We're confirming your payment with Razorpay — this usually takes a few seconds."}
                </p>
              </div>
            </header>

            <section className="payment-success-grid">
              <div className={`payment-success-card${confirmed ? "" : " pending"}`}>
                <div className="payment-success-icon">
                  {confirmed ? <CheckCircle size={48} weight="fill" /> : <SpinnerGap size={40} className="payment-spin" />}
                </div>
                <h2>{confirmed ? "Payment successful!" : "Confirming your payment…"}</h2>
                {confirmed && (
                  <span className="payment-plus-badge">
                    <Crown size={14} weight="fill" />
                    <span className="payment-plus-badge-text">Fam<b>Care</b><sup>+</sup> unlocked</span>
                  </span>
                )}
                <p className="payment-success-lede">
                  {confirmed
                    ? `Your ${successKind === "extra_parent" ? "extra parent add-on" : `FamCare ${successPlanInfo?.name}`} is active.`
                    : timedOut
                      ? "This is taking longer than usual. Your payment is safe — check back here or on Profile → Payment in a few minutes."
                      : "Your payment was received. We're waiting for the bank/Razorpay confirmation to activate your plan."}
                </p>

                <div className="payment-success-stats">
                  <div>
                    <span>Payment ID</span>
                    <strong>{successPaymentId || "—"}</strong>
                  </div>
                  <div>
                    <span>Amount paid</span>
                    <strong>₹{successPlanInfo?.amount}</strong>
                  </div>
                </div>

                <div className={`payment-success-banner${confirmed ? "" : " pending"}`}>
                  {confirmed ? <ShieldCheck size={18} weight="fill" /> : <SpinnerGap size={18} className="payment-spin" />}
                  <div>
                    <strong>{confirmed ? "Secure payment confirmed" : "Waiting for confirmation"}</strong>
                    <span>
                      {confirmed
                        ? "Your payment was processed securely by Razorpay."
                        : "This page checks automatically — no need to refresh."}
                    </span>
                  </div>
                </div>

                {confirmed && (
                  <p className="payment-success-heart"><Heart size={14} weight="fill" /> Your family health journey starts now.</p>
                )}
              </div>

              <div className="payment-summary-card">
                <h3><Receipt size={18} weight="duotone" /> Payment summary</h3>
                <div className="payment-summary-row"><span>Plan</span><strong>{successKind === "extra_parent" ? "Extra parent add-on" : `FamCare ${successPlanInfo?.name}`}</strong></div>
                <div className="payment-summary-row"><span>Billing cycle</span><strong>Monthly</strong></div>
                <div className="payment-summary-row"><span>Amount</span><strong>₹{successPlanInfo?.amount}</strong></div>
                <div className="payment-summary-row total"><span>Total paid</span><strong>₹{successPlanInfo?.amount}</strong></div>
                <div className={`payment-summary-status${confirmed ? "" : " pending"}`}>
                  {confirmed ? <CheckCircle size={16} weight="fill" /> : <SpinnerGap size={16} className="payment-spin" />}
                  Payment status <b>{confirmed ? "Verified" : "Processing"}</b>
                </div>
                {confirmed && (
                  <div className="payment-summary-renewal">
                    <CalendarCheck size={18} weight="duotone" />
                    <div>
                      <strong>Next renewal · {successPlanInfo?.nextRenewal}</strong>
                      <span>We'll remind you before your next charge.</span>
                    </div>
                  </div>
                )}

                <div className="payment-success-close-actions">
                  <Link href="/dashboard/homev2" className="payment-secondary-btn">Close</Link>
                  <Link href="/dashboard/homev2" className="payment-submit">Go to home</Link>
                </div>
              </div>
            </section>
          </main>
        </div>
      </V2RouteGate>
    );
  }

  return (
    <V2RouteGate>
      <div className="db-page">
        <Sidebar />
        <main className="db-main payment-page">
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="afterInteractive"
            onReady={() => setScriptReady(true)}
            onError={() =>
              setNotice({ tone: "error", text: "Secure checkout could not load. Refresh and try again." })
            }
          />

          <header className="payment-page-head">
            <div>
              <span>Plans & billing</span>
              <h1>Care that keeps the whole family connected</h1>
              <p>Choose a monthly plan. Payments and AutoPay are handled securely by Razorpay.</p>
            </div>
          </header>

          {subscription && subscription.plan_key !== "free" && (
            <CurrentPlanCard
              subscription={subscription}
              planName={
                plansData?.plans.find((entry) => entry.plan_key === subscription.plan_key)?.name
                ?? subscription.plan_key
              }
              onCancel={() => setCancelOpen(true)}
            />
          )}

          {planNotice && (
            <div className={`payment-notice ${planNotice.tone}`} role="status">
              {planNotice.tone === "success" ? <CheckCircle size={18} weight="fill" /> : <ShieldCheck size={18} />}
              {planNotice.text}
            </div>
          )}

          <div className="payment-plan-switch" aria-label="Choose a FamCare plan">
            <span
              className={`payment-plan-switch-slider ${planKey === "family" ? "family" : "individual"}`}
              aria-hidden="true"
            />
            <button
              type="button"
              className={planKey === "individual" ? "active" : ""}
              onClick={() => setPlanKey("individual")}
            >
              Individual <small>{planPillPrice(plansData, "individual")}</small>
            </button>
            <button
              type="button"
              className={planKey === "family" ? "active" : ""}
              onClick={() => setPlanKey("family")}
            >
              Family <small>{planPillPrice(plansData, "family")}</small>
            </button>
          </div>

          {plansError && (
            <div className="payment-notice error" role="status">
              <ShieldCheck size={18} />
              {plansError}
            </div>
          )}

          {!plansError && !plan && (
            <div className="payment-plans-loading" role="status" aria-label="Loading plans">
              <SpinnerGap size={22} className="payment-spin" /> Loading plans…
            </div>
          )}

          {plan && (
            <section className="payment-checkout-grid">
              <div className={`payment-plan-card ${planKey}`}>
                <div className="payment-plan-art">
                  <div className="payment-plan-eyebrow">
                    {planKey === "family" ? <Crown size={14} weight="fill" /> : <Heart size={14} weight="fill" />}
                    {plan.eyebrow}
                  </div>
                  <img src="/parent_care_illustration.png" alt="A family caring for their parents together" />
                </div>

                <div className="payment-plan-copy">
                  <span className="payment-plan-brand">Fam<span>Care</span></span>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <div className="payment-included">
                    <UsersThree size={17} weight="duotone" />
                    <span><strong>{plan.included}</strong> included in this subscription</span>
                  </div>
                </div>

                <div className="payment-plan-features">
                  {plan.features.map((feature, index) => {
                    const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
                    return (
                      <div key={feature.title}>
                        <span><Icon /></span>
                        <p><strong>{feature.title}</strong><small>{feature.description}</small></p>
                      </div>
                    );
                  })}
                </div>

                <div className="payment-plan-price">
                  <div>
                    <span>₹</span><strong>{formattedPrice}</strong><small>/ month</small>
                  </div>
                  <p>Billed monthly · Cancel anytime</p>
                  {planKey === "family" && plansData && (
                    <ExtraParentBox
                      extraParentPlan={plansData.extra_parent}
                      subscription={subscription}
                      submitting={submittingExtraParent}
                      onAdd={() => void openExtraParentCheckout()}
                    />
                  )}
                </div>
              </div>

              <div className="payment-action-card">
                <div className="payment-action-heading">
                  <div>
                    <span>Secure checkout</span>
                    <h2>Continue with Razorpay</h2>
                  </div>
                  <span className="payment-razorpay-badge"><LockKey size={15} weight="duotone" /> Razorpay</span>
                </div>

                <div className="payment-method-detail">
                  <span className="payment-method-icon">
                    <LockKey />
                  </span>
                  <div>
                    <h3>Razorpay handles the payment</h3>
                    <p>Its secure checkout will show the available UPI AutoPay, card and other supported options.</p>
                  </div>
                </div>

                <div className="payment-order-summary">
                  <h3>Order summary</h3>
                  <div><span>FamCare {plan.name}</span><strong>₹{formattedPrice}</strong></div>
                  <div><span>Billing cycle</span><strong>Monthly</strong></div>
                  <div className="total"><span>Total due today</span><strong>₹{formattedPrice}</strong></div>
                  <p>Any applicable tax will be shown by Razorpay before you approve payment.</p>
                </div>

                {notice && (
                  <div className={`payment-notice ${notice.tone}`} role="status">
                    {notice.tone === "success" ? <CheckCircle size={18} weight="fill" /> : <ShieldCheck size={18} />}
                    {notice.text}
                  </div>
                )}

                <button
                  type="button"
                  className="payment-submit"
                  disabled={submitting}
                  onClick={() => void openCheckout()}
                >
                  <LockKey size={19} weight="bold" />
                  {submitting ? "Opening Razorpay…" : `Continue with Razorpay · ₹${formattedPrice}`}
                </button>
                <p className="payment-terms">
                  By continuing, you agree to our <Link href="/privacy">Privacy Policy</Link> and recurring monthly billing.
                </p>
              </div>
            </section>
          )}

          {cancelOpen && subscription && (
            <CancelPlanDialog
              planName={
                plansData?.plans.find((entry) => entry.plan_key === subscription.plan_key)?.name
                ?? subscription.plan_key
              }
              periodEnd={
                subscription.current_period_end
                  ? renewalDateFormatter.format(new Date(subscription.current_period_end))
                  : null
              }
              busy={cancelling}
              error={planNotice?.tone === "error" ? planNotice.text : null}
              onDismiss={() => { setCancelOpen(false); setPlanNotice(null); }}
              onConfirm={() => void confirmCancel()}
            />
          )}

          <footer className="payment-trust-row">
            <div><WhatsappLogo size={24} weight="fill" /><span><strong>No new app for parents</strong><small>Just WhatsApp</small></span></div>
            <div><Heart size={24} weight="fill" /><span><strong>Built for real families</strong><small>Simple care, every day</small></span></div>
            <div><ShieldCheck size={24} weight="fill" /><span><strong>Secure monthly payments</strong><small>Protected by Razorpay</small></span></div>
          </footer>
        </main>
      </div>
    </V2RouteGate>
  );
}

/**
 * Live plan state on the main billing view: what you're on, whether a renewal
 * failed, and the way out. `past_due` is the important one — without it a failed
 * renewal silently strips FamCare+ with no explanation anywhere.
 */
function CurrentPlanCard({
  subscription,
  planName,
  onCancel,
}: {
  subscription: SubscriptionDetails;
  planName: string;
  onCancel: () => void;
}) {
  // Razorpay reports a failed/retrying charge as "pending" or "halted"; the
  // webhook maps both to a past_due account. Match all three so the warning
  // shows whichever status this endpoint happens to surface.
  const pastDue = ["past_due", "halted", "pending"].includes(subscription.status);
  const ending = subscription.cancel_at_period_end === true;
  const periodEnd = subscription.current_period_end
    ? renewalDateFormatter.format(new Date(subscription.current_period_end))
    : null;

  return (
    <section className={`payment-current-plan${pastDue ? " past-due" : ""}${ending ? " ending" : ""}`}>
      <div className="payment-current-plan-main">
        <span className="payment-current-plan-icon">
          {pastDue ? <WarningCircle size={20} weight="fill" /> : <Crown size={20} weight="fill" />}
        </span>
        <div>
          <span className="payment-current-plan-eyebrow">
            {pastDue ? "Payment needs attention" : ending ? "Plan ending" : "Your current plan"}
          </span>
          <h2>FamCare {planName}</h2>
          <p>
            {pastDue
              ? "Your last renewal didn't go through, so FamCare+ features are paused. Re-subscribe below to restore them."
              : ending
                ? periodEnd
                  ? `Active until ${periodEnd}. It won't renew after that.`
                  : "Active until the end of this billing period. It won't renew after that."
                : periodEnd
                  ? `Renews on ${periodEnd} · ₹${rupees(subscription.amount_paise)}/month`
                  : `₹${rupees(subscription.amount_paise)}/month · Cancel anytime`}
          </p>
        </div>
      </div>

      {subscription.active && !ending && (
        <button type="button" className="payment-cancel-link" onClick={onCancel}>
          Cancel plan
        </button>
      )}
    </section>
  );
}

function CancelPlanDialog({
  planName,
  periodEnd,
  busy,
  error,
  onDismiss,
  onConfirm,
}: {
  planName: string;
  periodEnd: string | null;
  busy: boolean;
  /** Shown inside the dialog — a notice behind the backdrop is unreadable. */
  error: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="payment-modal-backdrop" role="dialog" aria-modal="true" aria-label="Cancel your plan">
      <div className="payment-modal">
        <h2>Cancel FamCare {planName}?</h2>
        <p>
          {periodEnd
            ? `You'll keep every FamCare+ feature until ${periodEnd}. After that your plan stops renewing and the account returns to the free tier.`
            : "You'll keep every FamCare+ feature until the end of the period you've already paid for. After that your plan stops renewing."}
        </p>
        <p className="payment-modal-note">
          Your parents' logs and history stay exactly where they are — nothing is deleted.
        </p>
        {error && (
          <div className="payment-notice error" role="alert">
            <ShieldCheck size={18} />
            {error}
          </div>
        )}

        <div className="payment-modal-actions">
          <button type="button" className="payment-secondary-btn" onClick={onDismiss} disabled={busy}>
            Keep my plan
          </button>
          <button type="button" className="payment-danger-btn" onClick={onConfirm} disabled={busy}>
            {busy ? "Cancelling…" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function planPillPrice(plansData: BillingPlansResponse | null, key: BillingPlanKey): string {
  const found = plansData?.plans.find((entry) => entry.plan_key === key);
  return found ? `₹${rupees(found.amount_paise)}/mo` : "…";
}

function ExtraParentBox({
  extraParentPlan,
  subscription,
  submitting,
  onAdd,
}: {
  extraParentPlan: NonNullable<BillingPlansResponse["extra_parent"]>;
  subscription: SubscriptionDetails | null;
  submitting: boolean;
  onAdd: () => void;
}) {
  const familyActive = subscription?.active && subscription.plan_key === "family";
  const extraParents = subscription?.extra_parents ?? 0;

  if (!familyActive) {
    return (
      <div className="payment-extra-parent">
        <span>Need another parent?</span>
        <strong>₹{rupees(extraParentPlan.amount_paise)}/month each</strong>
        <small>Added separately after your Family plan is active.</small>
      </div>
    );
  }

  return (
    <div className="payment-extra-parent actionable">
      <span>{extraParents > 0 ? `${extraParents} extra parent${extraParents > 1 ? "s" : ""} added` : "Need another parent?"}</span>
      <strong>₹{rupees(extraParentPlan.amount_paise)}/month each</strong>
      <button type="button" className="payment-extra-parent-btn" disabled={submitting} onClick={onAdd}>
        {submitting ? "Opening Razorpay…" : "Add another parent"}
      </button>
    </div>
  );
}
