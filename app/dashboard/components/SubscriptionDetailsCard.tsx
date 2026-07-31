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
  return (
    <section className="profile-payment-card" aria-label="Payment details">
      <div className="profile-payment-head">
        <span><CreditCard size={18} weight="duotone" /></span>
        <div>
          <h2>{subscription.active ? "FamCare+ subscription" : "Payment"}</h2>
          <p>
            {subscription.active
              ? "Your plan and billing details"
              : "No active subscription on this account"}
          </p>
        </div>
        {subscription.active && <span className="profile-payment-badge">Active</span>}
      </div>

      {subscription.active ? (
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
            {formatDate(subscription.current_period_end) && (
              <div>
                <dt>{subscription.cancel_at_period_end ? "Ends on" : "Next renewal"}</dt>
                <dd>{formatDate(subscription.current_period_end)}</dd>
              </div>
            )}
            {subscription.provider_subscription_id && (
              <div>
                <dt>Subscription ID</dt>
                <dd className="mono">{subscription.provider_subscription_id}</dd>
              </div>
            )}
          </dl>
          {subscription.cancel_at_period_end && (
            <p className="profile-payment-note">
              This subscription is set to cancel at the end of the current period.
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
