"use client";

import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle,
  Crown,
  Heart,
  LockKey,
  Receipt,
  ShieldCheck,
  Sparkle,
  UsersThree,
  WhatsappLogo,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import V2RouteGate from "../components/V2RouteGate";
import {
  createSubscriptionCheckout,
  verifySubscriptionCheckout,
  type BillingPlanKey,
  type SubscriptionCheckout,
} from "@/lib/api";

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

const PLAN_DETAILS: Record<
  BillingPlanKey,
  {
    name: string;
    price: number;
    eyebrow: string;
    description: string;
    included: string;
    features: { title: string; description: string }[];
  }
> = {
  individual: {
    name: "Individual plan",
    price: 199,
    eyebrow: "For your own health",
    description: "Smart WhatsApp health tracking for one person.",
    included: "Your account",
    features: [
      { title: "WhatsApp food logs", description: "Log meals by text or photo" },
      { title: "Medication reminders", description: "Stay on time with every dose" },
      { title: "AI health coach", description: "Understand your nutrition trends" },
      { title: "Health insights", description: "See calories, protein and consistency" },
    ],
  },
  family: {
    name: "Family plan",
    price: 499,
    eyebrow: "Most popular",
    description: "Everything you need to stay close to your parents’ health.",
    included: "You + 2 parents",
    features: [
      { title: "Track meals on WhatsApp", description: "Parents log naturally, you see the insights" },
      { title: "Medication reminders", description: "Help everyone stay on schedule" },
      { title: "Family dashboard", description: "See your family’s progress together" },
      { title: "AI health coach", description: "Ask about your family’s nutrition trends" },
    ],
  },
};

const currencyFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const renewalDateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

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
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const plan = PLAN_DETAILS[planKey];
  const formattedPrice = useMemo(
    () => currencyFormatter.format(plan.price),
    [plan.price],
  );

  const successParam = searchParams.get("success");
  const successInfo = useMemo(() => {
    if (successParam !== "1") return null;
    const successPlanKey = (searchParams.get("plan") as BillingPlanKey | null) ?? "family";
    const amountPaise = Number(searchParams.get("amount") ?? "0");
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    return {
      plan: PLAN_DETAILS[successPlanKey] ?? PLAN_DETAILS.family,
      amount: currencyFormatter.format(amountPaise > 0 ? amountPaise / 100 : 0),
      paymentId: searchParams.get("payment_id") ?? "",
      message: searchParams.get("message") ?? "Payment verified. Your plan will activate in a moment.",
      nextRenewal: renewalDateFormatter.format(nextRenewal),
    };
  }, [successParam, searchParams]);

  async function openCheckout() {
    setNotice(null);
    if (!scriptReady || !window.Razorpay) {
      setNotice({ tone: "error", text: "Secure checkout is still loading. Try again in a moment." });
      return;
    }

    setSubmitting(true);
    try {
      const checkout = await createSubscriptionCheckout(planKey);
      launchRazorpay(checkout);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Checkout could not be started.",
      });
      setSubmitting(false);
    }
  }

  function launchRazorpay(checkout: SubscriptionCheckout) {
    if (!window.Razorpay) return;
    const razorpay = new window.Razorpay({
      key: checkout.key_id,
      subscription_id: checkout.subscription_id,
      name: "FamCare",
      description: `${PLAN_DETAILS[checkout.plan_key].name} · monthly subscription`,
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
          const verified = await verifySubscriptionCheckout({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature,
          });
          const params = new URLSearchParams({
            success: "1",
            plan: checkout.plan_key,
            amount: String(checkout.amount_paise),
            payment_id: response.razorpay_payment_id,
            message: verified.message,
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
        }
      },
      modal: {
        ondismiss: () => setSubmitting(false),
      },
    });
    razorpay.on("payment.failed", (response) => {
      setSubmitting(false);
      setNotice({
        tone: "error",
        text: response.error?.description ?? "Payment failed. Please try another payment method.",
      });
    });
    razorpay.open();
  }

  if (successInfo) {
    return (
      <V2RouteGate>
        <div className="db-page">
          <Sidebar />
          <main className="db-main payment-page">
            <header className="payment-page-head">
              <div>
                <span>Plans & billing</span>
                <h1>You're all set!</h1>
                <p>Here's a summary of your subscription and what to do next.</p>
              </div>
            </header>

            <section className="payment-success-grid">
              <div className="payment-success-card">
                <div className="payment-success-icon">
                  <CheckCircle size={48} weight="fill" />
                </div>
                <h2>Payment successful!</h2>
                <p className="payment-success-lede">
                  Your FamCare {successInfo.plan.name} · {successInfo.message}
                </p>

                <div className="payment-success-stats">
                  <div>
                    <span>Payment ID</span>
                    <strong>{successInfo.paymentId || "—"}</strong>
                  </div>
                  <div>
                    <span>Amount paid</span>
                    <strong>₹{successInfo.amount}</strong>
                  </div>
                </div>

                <div className="payment-success-banner">
                  <ShieldCheck size={18} weight="fill" />
                  <div>
                    <strong>Secure payment confirmed</strong>
                    <span>Your payment was processed securely by Razorpay.</span>
                  </div>
                </div>

                <p className="payment-success-heart"><Heart size={14} weight="fill" /> Your family health journey starts now.</p>
              </div>

              <div className="payment-summary-card">
                <h3><Receipt size={18} weight="duotone" /> Payment summary</h3>
                <div className="payment-summary-row"><span>Plan</span><strong>FamCare {successInfo.plan.name}</strong></div>
                <div className="payment-summary-row"><span>Billing cycle</span><strong>Monthly</strong></div>
                <div className="payment-summary-row"><span>Amount</span><strong>₹{successInfo.amount}</strong></div>
                <div className="payment-summary-row total"><span>Total paid</span><strong>₹{successInfo.amount}</strong></div>
                <div className="payment-summary-status">
                  <CheckCircle size={16} weight="fill" /> Payment status <b>Verified</b>
                </div>
                <div className="payment-summary-renewal">
                  <CalendarCheck size={18} weight="duotone" />
                  <div>
                    <strong>Next renewal · {successInfo.nextRenewal}</strong>
                    <span>We'll remind you before your next charge.</span>
                  </div>
                </div>

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
              Individual <small>₹199/mo</small>
            </button>
            <button
              type="button"
              className={planKey === "family" ? "active" : ""}
              onClick={() => setPlanKey("family")}
            >
              Family <small>₹499/mo</small>
            </button>
          </div>

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
                {plan.features.map((feature, index) => (
                  <div key={feature.title}>
                    <span>
                      {index === 0 ? <WhatsappLogo /> : index === 1 ? <CheckCircle /> : index === 2 ? <UsersThree /> : <Sparkle />}
                    </span>
                    <p><strong>{feature.title}</strong><small>{feature.description}</small></p>
                  </div>
                ))}
              </div>

              <div className="payment-plan-price">
                <div>
                  <span>₹</span><strong>{formattedPrice}</strong><small>/ month</small>
                </div>
                <p>Billed monthly · Cancel anytime</p>
                {planKey === "family" && (
                  <div className="payment-extra-parent">
                    <span>Need another family member?</span>
                    <strong>₹149/month each</strong>
                    <small>Added separately after your Family plan is active.</small>
                  </div>
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
