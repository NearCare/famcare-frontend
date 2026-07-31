"use client";

import { CreditCard } from "@phosphor-icons/react";
import { captureEvent } from "@/lib/analytics";
import type { SubscriptionDetails } from "@/lib/api";

const amountFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : dateFormatter.format(parsed);
}

/**
 * Plan, price and renewal for the account's current subscription.
 *
 * Lives on Plans & billing so every billing fact sits on one screen; the
 * `source` prop only labels the analytics event for the upsell link.
 */
export default function SubscriptionDetailsCard({
  subscription,
  source,
}: {
  subscription: SubscriptionDetails;
  source: string;
}) {
  // Two different cancellations reach this card: ours sets cancel_at_period_end
  // and leaves the plan running to the end of the paid period, while one made
  // in the Razorpay dashboard arrives as a cancelled status. Both are "no next
  // renewal" as far as the user is concerned.
  const cancelled = subscription.cancel_at_period_end === true || subscription.status === "cancelled";
  const pastDue = ["past_due", "halted", "pending"].includes(subscription.status);
  // Billing facts belong to anyone who has ever been on a plan, not only to
  // accounts Razorpay currently calls active — a cancelled subscriber still
  // needs to see what they were on and when it ends.
  const hasPlan = subscription.plan_key !== "free";
  const endsOn = formatDate(subscription.current_period_end);

  return (
    <section className="profile-payment-card" aria-label="Payment details">
      <div className="profile-payment-head">
        <span><CreditCard size={18} weight="duotone" /></span>
        <div>
          <h2>{hasPlan ? "FamCare+ subscription" : "Payment"}</h2>
          <p>
            {hasPlan
              ? "Your plan and billing details"
              : "No active subscription on this account"}
          </p>
        </div>
        {hasPlan && (
          <span className={`profile-payment-badge${cancelled ? " cancelled" : pastDue ? " past-due" : ""}`}>
            {cancelled ? "Cancelled" : pastDue ? "Payment due" : "Active"}
          </span>
        )}
      </div>

      {hasPlan ? (
        <>
          <dl className="profile-payment-rows">
            <div>
              <dt>Plan</dt>
              <dd>FamCare {subscription.plan_key === "family" ? "Family" : "Individual"}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>₹{amountFormatter.format(subscription.amount_paise / 100)} / month</dd>
            </div>
            <div>
              <dt>Billing cycle</dt>
              <dd>Monthly</dd>
            </div>
            {formatDate(subscription.paid_at) && (
              <div>
                <dt>Paid on</dt>
                <dd>{formatDate(subscription.paid_at)}</dd>
              </div>
            )}
            {(cancelled || endsOn) && (
              <div>
                <dt>Next renewal</dt>
                <dd>{cancelled ? "Cancelled" : endsOn}</dd>
              </div>
            )}
            {subscription.provider_subscription_id && (
              <div>
                <dt>Subscription ID</dt>
                <dd className="mono">{subscription.provider_subscription_id}</dd>
              </div>
            )}
          </dl>
          {/* The renewal row only says "Cancelled", so the date the plan
              actually stops — which the user has already paid for — is carried
              here instead of being dropped. */}
          {cancelled && (
            <p className="profile-payment-note">
              {endsOn
                ? `This subscription won't renew. You keep FamCare+ until ${endsOn}.`
                : "This subscription won't renew."}
            </p>
          )}
          {pastDue && (
            <p className="profile-payment-note">
              Your renewal is pending. Razorpay will retry it automatically and notify you if your
              payment method needs attention.
            </p>
          )}
        </>
      ) : (
        <a
          className="profile-usage-upgrade"
          href="/dashboard/payments"
          onClick={() => captureEvent("billing_entry_clicked", {
            source,
            current_plan: subscription.plan_key,
          })}
        >
          See FamCare+ plans
        </a>
      )}
    </section>
  );
}
