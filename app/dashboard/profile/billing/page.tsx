"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarCheck, CreditCard } from "@phosphor-icons/react";
import Sidebar from "../../components/Sidebar";
import BillingHistory from "../../components/BillingHistory";
import ProfileTabs from "../../components/ProfileTabs";
import SubscriptionDetailsCard from "../../components/SubscriptionDetailsCard";
import { captureEvent } from "@/lib/analytics";
import {
  getBillingInvoices,
  getBillingPlans,
  getSubscriptionDetails,
  type BillingInvoice,
  type SubscriptionDetails,
  type User,
} from "@/lib/api";

const amountFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function ProfileBillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const [invoicesFailed, setInvoicesFailed] = useState(false);
  const [extraParentPaise, setExtraParentPaise] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        setUser(null);
      }
    }
    captureEvent("profile_billing_viewed");
  }, []);

  useEffect(() => {
    void getSubscriptionDetails()
      .then(setSubscription)
      .catch((error) => {
        console.warn("[Billing] Failed to load subscription", error);
        setFailed(true);
      });
  }, []);

  // Receipts are only fetched for accounts that have actually been charged —
  // the endpoint calls out to Razorpay, so there is nothing to ask for on a free
  // account, and it is owner-scoped, so a family member riding on someone else's
  // plan would only ever get an empty list back.
  const paying =
    subscription != null && subscription.plan_key !== "free" && subscription.owner !== false;
  useEffect(() => {
    if (!paying) return;
    void getBillingInvoices()
      .then((list) => {
        setInvoices(list);
        setInvoicesFailed(false);
      })
      .catch((error) => {
        console.warn("[Billing] Failed to load invoices", error);
        setInvoicesFailed(true);
      });
  }, [paying]);

  // Add-ons renew alongside the base plan, so the next charge is the sum of
  // both. The price comes from the catalog rather than being hardcoded here.
  const hasExtraParents = (subscription?.extra_parents ?? 0) > 0;
  useEffect(() => {
    if (!hasExtraParents) return;
    void getBillingPlans()
      .then((plans) => setExtraParentPaise(plans.extra_parent?.amount_paise ?? null))
      .catch((error) => console.warn("[Billing] Failed to load plan catalog", error));
  }, [hasExtraParents]);

  const displayName = user?.name?.trim() || "Your profile";
  const initial = displayName.charAt(0).toUpperCase();
  const onIndividualPlan = subscription?.entitled === true && subscription.plan_key === "individual";

  const renewsOn = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  // A renewal date must parse *and* still be ahead of us. An `active` row whose
  // period has already lapsed (a webhook we never received) would otherwise
  // promise a charge on a date that has been and gone.
  const renewalValid = renewsOn != null && !Number.isNaN(renewsOn.getTime()) && renewsOn.getTime() > Date.now();
  // A cancelled plan runs to the end of the period it was paid for and then
  // stops, so there is no next charge to promise. Matches the detail card:
  // our own cancel sets the flag, a Razorpay-side one arrives as a status.
  const cancelled = subscription?.cancel_at_period_end === true || subscription?.status === "cancelled";
  const upcoming = subscription?.active === true && !cancelled && renewalValid;
  const extraParents = subscription?.extra_parents ?? 0;
  // Suppress the total while the add-on price is still loading rather than
  // briefly showing a figure that leaves the add-ons out.
  const upcomingPaise = extraParents > 0
    ? (extraParentPaise == null ? null : (subscription?.amount_paise ?? 0) + extraParents * extraParentPaise)
    : subscription?.amount_paise ?? 0;

  return (
      <div className="db-page">
        <Sidebar />
        <main className="db-main profile-page">
          <header className="profile-page-head">
            <span className="profile-page-avatar">{initial}</span>
            <div>
              <h1>{displayName}</h1>
              <p>Your plan, payments and receipts</p>
            </div>
          </header>

          <ProfileTabs active="billing" />

          {subscription ? (
            <SubscriptionDetailsCard subscription={subscription} source="profile_billing_page" />
          ) : (
            <p className="profile-tab-empty">
              {failed ? "Plan details could not be loaded. Refresh to try again." : "Loading your plan details…"}
            </p>
          )}

          {paying && (
            <section className="payment-history payment-upcoming" aria-label="Upcoming payment">
              <h3><CalendarCheck size={18} weight="duotone" /> Upcoming payment</h3>
              {upcoming ? (
                <ul className="payment-history-list">
                  <li>
                    <div className="payment-history-main">
                      <strong>
                        FamCare {subscription!.plan_key === "family" ? "Family" : "Individual"}
                        {extraParents > 0 && ` + ${extraParents} extra parent${extraParents === 1 ? "" : "s"}`}
                      </strong>
                      <span>Renews on {dateFormatter.format(renewsOn!)}</span>
                    </div>
                    <span className="payment-history-status other">Scheduled</span>
                    <strong className="payment-history-amount">
                      {upcomingPaise == null ? "…" : `₹${amountFormatter.format(upcomingPaise / 100)}`}
                    </strong>
                    <span className="payment-history-link disabled">—</span>
                  </li>
                </ul>
              ) : (
                <p className="payment-history-empty">
                  {cancelled && renewalValid
                    ? `No upcoming payments — your plan ends on ${dateFormatter.format(renewsOn!)}.`
                    : "No upcoming payments scheduled."}
                </p>
              )}
            </section>
          )}

          {paying && <BillingHistory invoices={invoices} failed={invoicesFailed} />}

          <div className="profile-page-links">
            <Link
              href="/dashboard/payments"
              className="profile-page-link"
              onClick={() => captureEvent("profile_tool_clicked", {
                destination: "/dashboard/payments",
                label: onIndividualPlan ? "Upgrade to FamCare Family" : "Plans & billing",
              })}
            >
              <span className="profile-page-link-icon red">
                <CreditCard size={19} weight="bold" />
              </span>
              <span>
                <strong>{onIndividualPlan ? "Upgrade to FamCare Family" : "Plans & billing"}</strong>
                <small>
                  {onIndividualPlan
                    ? "Care for both parents from one dashboard"
                    : "Choose or manage your FamCare plan"}
                </small>
              </span>
              <i aria-hidden="true">›</i>
            </Link>
          </div>
        </main>
      </div>
  );
}
