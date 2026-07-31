"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard } from "@phosphor-icons/react";
import Sidebar from "../../components/Sidebar";
import ProfileTabs from "../../components/ProfileTabs";
import SubscriptionDetailsCard from "../../components/SubscriptionDetailsCard";
import V2RouteGate from "../../components/V2RouteGate";
import { captureEvent } from "@/lib/analytics";
import { getSubscriptionDetails, type SubscriptionDetails, type User } from "@/lib/api";

export default function ProfileBillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
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

  const displayName = user?.name?.trim() || "Your profile";
  const initial = displayName.charAt(0).toUpperCase();
  const onIndividualPlan = subscription?.active === true && subscription.plan_key === "individual";

  return (
    <V2RouteGate>
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
    </V2RouteGate>
  );
}
