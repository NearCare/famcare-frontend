"use client";

import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CheckCircle,
  Clock,
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
  getBillingInvoices,
  getBillingPlans,
  getCheckoutStatus,
  getSubscriptionDetails,
  verifySubscriptionCheckout,
  type BillingPlanKey,
  type BillingInvoice,
  type BillingPlansResponse,
  type CheckoutStatus,
  type SubscriptionCheckout,
  type SubscriptionDetails,
} from "@/lib/api";
import { captureEvent } from "@/lib/analytics";
import { refreshSubscriptionState, useSubscription } from "@/lib/useSubscription";

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
const RECONCILE_ATTEMPTS = 6;
const RECONCILE_INTERVAL_MS = 5000;

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsPageContent />
    </Suspense>
  );
}

function PaymentsPageContent() {
  const searchParams = useSearchParams();
  const { isSubscribed } = useSubscription();
  const [planKey, setPlanKey] = useState<BillingPlanKey>("family");
  const [plansData, setPlansData] = useState<BillingPlansResponse | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingExtraParent, setSubmittingExtraParent] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [planNotice, setPlanNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const [invoicesError, setInvoicesError] = useState(false);
  const pageViewTracked = useRef(false);
  const confirmationTracked = useRef(false);
  const timeoutTracked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getBillingPlans()
      .then((data) => { if (!cancelled) setPlansData(data); })
      .catch(() => { if (!cancelled) setPlansError("Plan pricing could not be loaded. Refresh to try again."); });
    return () => { cancelled = true; };
  }, []);

  const refreshSubscription = useCallback(async () => {
    try {
      const details = await getSubscriptionDetails();
      setSubscription(details);
      setSubscriptionError(null);
      return details;
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : "Plan status could not be loaded.");
      return undefined;
    } finally {
      setSubscriptionLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  // Only accounts that have actually been billed have receipts to show.
  const hasBillingHistory = subscription != null && subscription.plan_key !== "free";
  useEffect(() => {
    if (!hasBillingHistory) return;
    let cancelled = false;
    getBillingInvoices()
      .then((rows) => { if (!cancelled) setInvoices(rows); })
      .catch(() => { if (!cancelled) setInvoicesError(true); });
    return () => { cancelled = true; };
  }, [hasBillingHistory]);

  const currentPlanKey = subscription?.plan_key ?? "free";
  const individualSubscriber = subscriptionLoaded && currentPlanKey === "individual";
  const familySubscriber = subscriptionLoaded && currentPlanKey === "family";
  const displayPlanKey: BillingPlanKey = individualSubscriber ? "family" : planKey;
  const plan = familySubscriber
    ? null
    : plansData?.plans.find((entry) => entry.plan_key === displayPlanKey) ?? null;
  const formattedPrice = plan ? rupees(plan.amount_paise) : null;

  useEffect(() => {
    if (individualSubscriber) setPlanKey("family");
  }, [individualSubscriber]);

  // ── Post-checkout success screen ────────────────────────────────────────
  // The URL carries only the opaque Razorpay subscription id. All displayed
  // plan, amount and payment data comes from the authenticated backend record.
  const checkoutSubscriptionId = searchParams.get("checkout") ?? "";
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const [checkoutStatusError, setCheckoutStatusError] = useState<string | null>(null);

  const hasSuccessParams = checkoutSubscriptionId.length > 0;

  useEffect(() => {
    if (!subscriptionLoaded || pageViewTracked.current) return;
    pageViewTracked.current = true;
    captureEvent("billing_page_viewed", {
      current_plan: currentPlanKey,
      has_active_subscription: subscription?.active === true,
      checkout_confirmation: hasSuccessParams,
    });
  }, [currentPlanKey, hasSuccessParams, subscription?.active, subscriptionLoaded]);

  const [reconcileAttempt, setReconcileAttempt] = useState(0);
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirmed = checkoutStatus?.active === true || checkoutStatus?.scheduled === true;

  useEffect(() => {
    if (!hasSuccessParams || confirmed) return;
    if (reconcileAttempt >= RECONCILE_ATTEMPTS) return;
    reconcileTimer.current = setTimeout(() => {
      Promise.all([
        refreshSubscription(),
        getCheckoutStatus(checkoutSubscriptionId)
          .then((status) => {
            setCheckoutStatus(status);
            setCheckoutStatusError(null);
          })
          .catch((error) => {
            setCheckoutStatusError(error instanceof Error ? error.message : "Checkout status could not be loaded.");
          }),
      ]).finally(() => setReconcileAttempt((n) => n + 1));
    }, RECONCILE_INTERVAL_MS);
    return () => {
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    };
  }, [hasSuccessParams, confirmed, reconcileAttempt, refreshSubscription, checkoutSubscriptionId]);

  // A mid-poll error is not terminal — the next tick may still succeed — so the
  // outcome is only decided once the 30s window closes. From there the screen
  // lands on exactly one of three fixed states instead of spinning forever.
  const pollingExhausted = reconcileAttempt >= RECONCILE_ATTEMPTS;
  const timedOut = hasSuccessParams && !confirmed && pollingExhausted;
  const errored = timedOut && checkoutStatusError != null;
  const stalled = timedOut && !errored;
  const polling = hasSuccessParams && !confirmed && !timedOut;

  // The FamCare+ marker (sidebar wordmark, profile menu, Plus upsell banner) is
  // driven by a module-level snapshot that was cached before this payment. Once
  // the plan is genuinely active, invalidate it so every page shows Plus right
  // away — "Go to home" is a client-side navigation and would keep the old one.
  useEffect(() => {
    if (!confirmed) return;
    if (!confirmationTracked.current) {
      confirmationTracked.current = true;
      captureEvent("subscription_checkout_confirmed", {
        plan_key: checkoutStatus?.plan_key ?? null,
        checkout_kind: checkoutStatus?.kind ?? null,
        scheduled: checkoutStatus?.scheduled === true,
      });
    }
    void refreshSubscriptionState();
  }, [checkoutStatus?.kind, checkoutStatus?.plan_key, checkoutStatus?.scheduled, confirmed]);

  useEffect(() => {
    if (!timedOut || timeoutTracked.current) return;
    timeoutTracked.current = true;
    captureEvent("subscription_checkout_confirmation_timed_out");
  }, [timedOut]);

  const successPlanInfo = useMemo(() => {
    if (!hasSuccessParams) return null;
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    const verifiedPlanKey = checkoutStatus?.plan_key ?? "family";
    const planFromCatalog = plansData?.plans.find((entry) => entry.plan_key === verifiedPlanKey);
    return {
      name: checkoutStatus?.kind === "extra_parent"
        ? (plansData?.extra_parent.name ?? "Extra parent")
        : (planFromCatalog?.name ?? (verifiedPlanKey === "family" ? "Family plan" : "Individual plan")),
      amount: checkoutStatus ? rupees(checkoutStatus.amount_paise) : "—",
      nextRenewal: checkoutStatus?.current_period_end
        ? renewalDateFormatter.format(new Date(checkoutStatus.current_period_end))
        : renewalDateFormatter.format(nextRenewal),
    };
  }, [hasSuccessParams, plansData, checkoutStatus]);

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
      captureEvent("subscription_cancellation_scheduled", {
        plan_key: subscription?.plan_key ?? null,
      });
    } catch (error) {
      setPlanNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Your plan could not be cancelled right now.",
      });
      captureEvent("subscription_cancellation_failed", {
        plan_key: subscription?.plan_key ?? null,
      });
    } finally {
      setCancelling(false);
    }
  }

  async function openCheckout() {
    setNotice(null);
    captureEvent("subscription_checkout_started", {
      plan_key: displayPlanKey,
      checkout_kind: "base",
    });
    if (!scriptReady || !window.Razorpay) {
      setNotice({ tone: "error", text: "Secure checkout is still loading. Try again in a moment." });
      captureEvent("subscription_checkout_blocked", {
        plan_key: displayPlanKey,
        reason: "razorpay_not_ready",
      });
      return;
    }

    setSubmitting(true);
    try {
      const checkout = await createSubscriptionCheckout(displayPlanKey);
      captureEvent("subscription_checkout_created", {
        plan_key: displayPlanKey,
        checkout_kind: "base",
      });
      launchRazorpay(checkout, `FamCare ${plan?.name ?? "plan"} · monthly subscription`);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Checkout could not be started.",
      });
      captureEvent("subscription_checkout_creation_failed", {
        plan_key: displayPlanKey,
        checkout_kind: "base",
      });
      setSubmitting(false);
    }
  }

  async function openExtraParentCheckout() {
    setNotice(null);
    captureEvent("subscription_checkout_started", {
      plan_key: "extra_parent",
      checkout_kind: "extra_parent",
    });
    if (!scriptReady || !window.Razorpay) {
      setNotice({ tone: "error", text: "Secure checkout is still loading. Try again in a moment." });
      captureEvent("subscription_checkout_blocked", {
        plan_key: "extra_parent",
        reason: "razorpay_not_ready",
      });
      return;
    }

    setSubmittingExtraParent(true);
    try {
      const checkout = await createExtraParentCheckout();
      captureEvent("subscription_checkout_created", {
        plan_key: "extra_parent",
        checkout_kind: "extra_parent",
      });
      launchRazorpay(checkout, "FamCare extra parent · monthly add-on");
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Checkout could not be started.",
      });
      captureEvent("subscription_checkout_creation_failed", {
        plan_key: "extra_parent",
        checkout_kind: "extra_parent",
      });
      setSubmittingExtraParent(false);
    }
  }

  function launchRazorpay(
    checkout: SubscriptionCheckout,
    description: string,
  ) {
    if (!window.Razorpay) return;
    const checkoutKind = checkout.plan_key === "extra_parent" ? "extra_parent" : "base";
    const razorpay = new window.Razorpay({
      key: checkout.key_id,
      subscription_id: checkout.subscription_id,
      name: "FamCare",
      description,
      image: `${window.location.origin}/${isSubscribed ? "famcareplus.png" : "famcare-logo.png"}`,
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
          captureEvent("subscription_payment_verified", {
            plan_key: checkout.plan_key,
            checkout_kind: checkoutKind,
          });
          const params = new URLSearchParams({ checkout: response.razorpay_subscription_id });
          window.location.href = `/dashboard/payments?${params.toString()}`;
          return;
        } catch (error) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Payment verification is pending.",
          });
          captureEvent("subscription_payment_verification_failed", {
            plan_key: checkout.plan_key,
            checkout_kind: checkoutKind,
          });
        } finally {
          setSubmitting(false);
          setSubmittingExtraParent(false);
        }
      },
      modal: {
        ondismiss: () => {
          captureEvent("subscription_checkout_dismissed", {
            plan_key: checkout.plan_key,
            checkout_kind: checkoutKind,
          });
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
      captureEvent("subscription_payment_failed", {
        plan_key: checkout.plan_key,
        checkout_kind: checkoutKind,
      });
    });
    captureEvent("subscription_checkout_opened", {
      plan_key: checkout.plan_key,
      checkout_kind: checkoutKind,
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
                <h1>{confirmed ? "You're all set!" : errored ? "Let's try that again" : "Almost there…"}</h1>
                <p>
                  {confirmed
                    ? "Here's a summary of your subscription and what to do next."
                    : errored
                      ? "We couldn't confirm this payment with Razorpay. No plan change has been applied."
                      : "We're confirming your payment with Razorpay — this usually takes a few seconds."}
                </p>
              </div>
            </header>

            <section className="payment-success-grid">
              <div className={`payment-success-card${confirmed ? "" : errored ? " error" : " pending"}`}>
                <div className="payment-success-icon">
                  {confirmed
                    ? <CheckCircle size={48} weight="fill" />
                    : errored
                      ? <WarningCircle size={46} weight="fill" />
                      : stalled
                        ? <Clock size={44} weight="duotone" />
                        : <SpinnerGap size={40} className="payment-spin" />}
                </div>
                <h2>
                  {confirmed
                    ? (checkoutStatus?.scheduled ? "Upgrade scheduled!" : "Payment successful!")
                    : errored
                      ? "Payment not confirmed"
                      : stalled
                        ? "Payment under process"
                        : "Confirming your payment…"}
                </h2>
                {confirmed && (
                  <span className="payment-plus-badge">
                    <img className="payment-plus-badge-logo" src="/famcareplus.png" alt="" />
                    <span className="payment-plus-badge-text">Fam<b>Care</b><sup>+</sup> <i>unlocked</i></span>
                  </span>
                )}
                <p className="payment-success-lede">
                  {confirmed
                    ? checkoutStatus?.scheduled
                      ? `Your FamCare ${successPlanInfo?.name} upgrade is scheduled for the end of your current billing period.`
                      : `Your ${checkoutStatus?.kind === "extra_parent" ? "extra parent add-on" : `FamCare ${successPlanInfo?.name}`} is active.`
                    : errored
                      ? `${checkoutStatusError} If money left your account it will be refunded automatically — contact us on WhatsApp if it isn't.`
                      : stalled
                        ? "This is taking longer than usual. Your payment is safe — check back here or on Profile → Payment in a few minutes."
                        : "Your payment was received. We're waiting for the bank/Razorpay confirmation to activate your plan."}
                </p>

                <div className="payment-success-stats">
                  <div>
                    <span>Payment ID</span>
                    <strong>{polling ? <LoadingDots /> : checkoutStatus?.payment_id || "Confirming…"}</strong>
                  </div>
                  <div>
                    <span>Monthly plan price</span>
                    <strong>{polling ? <LoadingDots /> : `₹${successPlanInfo?.amount}`}</strong>
                  </div>
                </div>

                {confirmed && (
                  <p className="payment-success-heart"><Heart size={14} weight="fill" /> Your family health journey starts now.</p>
                )}
              </div>

              <div className="payment-summary-card">
                <h3><Receipt size={18} weight="duotone" /> Payment summary</h3>
                <div className="payment-summary-row"><span>Plan</span><strong>{checkoutStatus?.kind === "extra_parent" ? "Extra parent add-on" : `FamCare ${successPlanInfo?.name}`}</strong></div>
                <div className="payment-summary-row"><span>Billing cycle</span><strong>Monthly</strong></div>
                <div className="payment-summary-row"><span>Amount</span><strong>₹{successPlanInfo?.amount}</strong></div>
                <div className="payment-summary-row total">
                  <span>Recurring price</span>
                  <strong>₹{successPlanInfo?.amount}</strong>
                </div>
                {confirmed && (
                  <div className="payment-summary-renewal">
                    <CalendarCheck size={18} weight="duotone" />
                    <div>
                      <strong>{checkoutStatus?.scheduled ? "Family plan starts" : "Next renewal"} · {successPlanInfo?.nextRenewal}</strong>
                      <span>We'll remind you before your next charge.</span>
                    </div>
                  </div>
                )}

                {/* Leaving mid-poll drops the reconcile loop, so offer no exit
                    until the 30s window has resolved one way or the other. */}
                {polling ? (
                  <p className="payment-hold-note">
                    Hang tight — don&apos;t refresh or hit back. We&apos;re almost there.
                  </p>
                ) : (
                  <div className="payment-success-close-actions">
                    <Link href="/dashboard/homev2" className="payment-secondary-btn">Close</Link>
                    <Link href="/dashboard/homev2" className="payment-submit">Go to home</Link>
                  </div>
                )}
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
              <h1>
                {familySubscriber
                  ? "Make room for one more parent"
                  : individualSubscriber
                    ? "Bring your family into FamCare"
                    : "Care that keeps the whole family connected"}
              </h1>
              <p>
                {familySubscriber
                  ? "Your Family plan is active. Add another parent whenever your family needs it."
                  : individualSubscriber
                    ? "Upgrade to Family to care for two parents from the same dashboard."
                    : "Choose a monthly plan. Payments and AutoPay are handled securely by Razorpay."}
              </p>
            </div>

            {subscription && subscription.plan_key !== "free" && (
              <CurrentPlanCard
                subscription={subscription}
                planName={
                  plansData?.plans.find((entry) => entry.plan_key === subscription.plan_key)?.name
                  ?? subscription.plan_key
                }
                onCancel={() => {
                  setCancelOpen(true);
                  captureEvent("subscription_cancellation_opened", {
                    plan_key: subscription.plan_key,
                  });
                }}
              />
            )}
          </header>

          {planNotice && (
            <div className={`payment-notice ${planNotice.tone}`} role="status">
              {planNotice.tone === "success" ? <CheckCircle size={18} weight="fill" /> : <ShieldCheck size={18} />}
              {planNotice.text}
            </div>
          )}

          {subscriptionLoaded && subscriptionError && (
            <div className="payment-notice error payment-load-error" role="alert">
              <WarningCircle size={18} weight="fill" />
              <span>{subscriptionError}</span>
              <button type="button" onClick={() => void refreshSubscription()}>Retry</button>
            </div>
          )}

          {subscriptionLoaded && !individualSubscriber && !familySubscriber && (
            <div className="payment-plan-switch" aria-label="Choose a FamCare plan">
              <span
                className={`payment-plan-switch-slider ${planKey === "family" ? "family" : "individual"}`}
                aria-hidden="true"
              />
              <button
                type="button"
                className={planKey === "individual" ? "active" : ""}
                onClick={() => {
                  setPlanKey("individual");
                  captureEvent("billing_plan_selected", { plan_key: "individual" });
                }}
              >
                Individual <small>{planPillPrice(plansData, "individual")}</small>
              </button>
              <button
                type="button"
                className={planKey === "family" ? "active" : ""}
                onClick={() => {
                  setPlanKey("family");
                  captureEvent("billing_plan_selected", { plan_key: "family" });
                }}
              >
                Family <small>{planPillPrice(plansData, "family")}</small>
              </button>
            </div>
          )}

          {plansError && (
            <div className="payment-notice error" role="status">
              <ShieldCheck size={18} />
              {plansError}
            </div>
          )}

          {!plansError && !subscriptionError && (!plansData || !subscriptionLoaded) && (
            <div className="payment-plans-loading" role="status" aria-label="Loading plans">
              <SpinnerGap size={22} className="payment-spin" /> Loading plans…
            </div>
          )}

          {subscriptionLoaded && plan && (
            <section className="payment-checkout-grid">
              <div className={`payment-plan-card ${displayPlanKey}`}>
                <div className="payment-plan-art">
                  <div className="payment-plan-eyebrow">
                    {displayPlanKey === "family" ? <Crown size={14} weight="fill" /> : <Heart size={14} weight="fill" />}
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
                  {displayPlanKey === "family" && plansData && (
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
                    <span>{notice.text}</span>
                    {notice.tone === "error" && (
                      <button type="button" onClick={() => void openCheckout()}>Try again</button>
                    )}
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

          {subscriptionLoaded && familySubscriber && plansData && (
            <FamilyAddOnView
              extraParentPlan={plansData.extra_parent}
              extraParents={subscription?.extra_parents ?? 0}
              submitting={submittingExtraParent}
              notice={notice}
              onAdd={() => void openExtraParentCheckout()}
            />
          )}

          {hasBillingHistory && (
            <BillingHistory invoices={invoices} failed={invoicesError} />
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
    <section className={`payment-current-plan compact${pastDue ? " past-due" : ""}${ending ? " ending" : ""}`}>
      <div className="payment-current-plan-main">
        <span className={`payment-current-plan-icon${pastDue ? "" : " has-mark"}`}>
          {pastDue
            ? <WarningCircle size={20} weight="fill" />
            : <span className="payment-current-plan-mark">Fam<b>Care</b><sup>+</sup></span>}
        </span>
        <div>
          <span className="payment-current-plan-eyebrow">
            {pastDue ? "Payment needs attention" : ending ? "Plan ending" : "Your current plan"}
          </span>
          <h2>FamCare {planName}</h2>
          <p>
            {pastDue
              ? "Your renewal is pending. Razorpay will retry it automatically and notify you if your payment method needs attention."
              : ending
                ? periodEnd
                  ? `Active until ${periodEnd}. It won't renew after that.`
                  : "Active until the end of this billing period. It won't renew after that."
                : periodEnd
                  ? `Renews on ${periodEnd} · ₹${rupees(subscription.amount_paise)}/month`
                  : `₹${rupees(subscription.amount_paise)}/month`}
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

/**
 * Receipts, straight from Razorpay. Each row links to Razorpay's own hosted
 * invoice page rather than a receipt we render ourselves, so what the user
 * downloads always matches what they were actually charged.
 */
function BillingHistory({ invoices, failed }: { invoices: BillingInvoice[] | null; failed: boolean }) {
  return (
    <section className="payment-history">
      <h3><Receipt size={18} weight="duotone" /> Billing history</h3>

      {failed ? (
        <p className="payment-history-empty">
          Your billing history could not be loaded right now. Refresh to try again.
        </p>
      ) : invoices === null ? (
        <p className="payment-history-empty">
          <SpinnerGap size={18} className="payment-spin" /> Loading receipts…
        </p>
      ) : invoices.length === 0 ? (
        <p className="payment-history-empty">
          No receipts yet. Your first one appears here once a payment is collected.
        </p>
      ) : (
        <ul className="payment-history-list">
          {invoices.map((invoice) => {
            const when = invoice.paid_at ?? invoice.issued_at;
            return (
              <li key={invoice.id}>
                <div className="payment-history-main">
                  <strong>{invoice.description}</strong>
                  <span>{when ? renewalDateFormatter.format(new Date(when)) : "Date pending"}</span>
                </div>
                <span className={`payment-history-status ${invoice.status === "paid" ? "paid" : "other"}`}>
                  {invoice.status === "paid" ? "Paid" : invoice.status.replace(/_/g, " ")}
                </span>
                <strong className="payment-history-amount">₹{rupees(invoice.amount_paise)}</strong>
                {invoice.receipt_url ? (
                  <a
                    className="payment-history-link"
                    href={invoice.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Receipt
                  </a>
                ) : (
                  <span className="payment-history-link disabled">—</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function planPillPrice(plansData: BillingPlansResponse | null, key: BillingPlanKey): string {
  const found = plansData?.plans.find((entry) => entry.plan_key === key);
  return found ? `₹${rupees(found.amount_paise)}/mo` : "…";
}

function FamilyAddOnView({
  extraParentPlan,
  extraParents,
  submitting,
  notice,
  onAdd,
}: {
  extraParentPlan: NonNullable<BillingPlansResponse["extra_parent"]>;
  extraParents: number;
  submitting: boolean;
  notice: { tone: "success" | "error"; text: string } | null;
  onAdd: () => void;
}) {
  return (
    <section className="payment-family-addon-view">
      <div className="payment-family-addon-art" aria-hidden="true">
        <img src="/parent_care_illustration.png" alt="" />
        <span><UsersThree size={18} weight="fill" /> Family plan</span>
      </div>
      <div className="payment-family-addon-copy">
        <span className="payment-plan-brand">Fam<span>Care</span></span>
        <h2>Add another parent</h2>
        <p>
          Give one more family member their own WhatsApp logs, reminders and place in your family dashboard.
        </p>
        <div className="payment-family-addon-meta">
          <span><CheckCircle size={16} weight="fill" /> Separate health profile</span>
          <span><CheckCircle size={16} weight="fill" /> Food and medication reminders</span>
          <span><CheckCircle size={16} weight="fill" /> Included in family insights</span>
        </div>
        {extraParents > 0 && (
          <div className="payment-family-addon-count">
            {extraParents} extra parent{extraParents === 1 ? "" : "s"} already added
          </div>
        )}
      </div>
      <div className="payment-family-addon-action">
        <span>Extra family member</span>
        <strong>₹{rupees(extraParentPlan.amount_paise)}<small>/month</small></strong>
        <p>Separate recurring add-on. Cancel with your Family plan.</p>
        {notice && (
          <div className={`payment-notice ${notice.tone}`} role="status">
            {notice.tone === "success" ? <CheckCircle size={18} weight="fill" /> : <ShieldCheck size={18} />}
            <span>{notice.text}</span>
            {notice.tone === "error" && (
              <button type="button" onClick={onAdd}>Try again</button>
            )}
          </div>
        )}
        <button type="button" className="payment-submit" disabled={submitting} onClick={onAdd}>
          <LockKey size={18} weight="bold" />
          {submitting ? "Opening Razorpay…" : `Add parent · ₹${rupees(extraParentPlan.amount_paise)}/month`}
        </button>
        <small>Secure monthly AutoPay through Razorpay</small>
      </div>
    </section>
  );
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

/** Placeholder for values still being fetched — three dots pulsing in sequence. */
function LoadingDots() {
  return (
    <span className="payment-dots" role="status" aria-label="Loading">
      <i /><i /><i />
    </span>
  );
}

