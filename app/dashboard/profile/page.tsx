"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calculator,
  ChatCircleText,
  FileText,
  Gauge,
  SignOut,
  Users,
  X,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import ProfileTabs from "../components/ProfileTabs";
import { captureEvent, resetAnalytics } from "@/lib/analytics";
import { clearStoredSession } from "@/lib/session";
import {
  getMonthlyUsage,
  type MonthlyUsageSnapshot,
  type User,
} from "@/lib/api";

const profileLinks = [
  {
    label: "Family overview",
    description: "See everyone’s health in one place",
    href: "/dashboard/family-overviewv2",
    icon: Users,
    tone: "green",
  },
  {
    label: "Calorie calculator",
    description: "Set calorie and protein targets",
    href: "/dashboard/calorie-calculator",
    icon: Calculator,
    tone: "orange",
  },
  {
    label: "Health logs",
    description: "Review your logged meals and nutrition",
    href: "/dashboard/logs",
    icon: FileText,
    tone: "blue",
  },
] as const;

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<MonthlyUsageSnapshot | null>(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    if (!storedUser) return;
    try {
      setUser(JSON.parse(storedUser) as User);
      captureEvent("profile_viewed");
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void getMonthlyUsage()
      .then(setUsage)
      .catch((error) => console.warn("[Profile] Failed to load monthly usage", error));
  }, []);

  function handleLogout() {
    captureEvent("logout");
    resetAnalytics();
    clearStoredSession({ resetFeatureIntro: true });
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!confirmLogoutOpen) return;
    document.body.classList.add("mobile-sheet-open");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("mobile-sheet-open");
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmLogoutOpen]);

  const displayName = user?.name?.trim() || "Your profile";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="db-page">
      <Sidebar />
      <main className="db-main profile-page">
        <header className="profile-page-head">
          <span className="profile-page-avatar">{initial}</span>
          <div>
            <h1>{displayName}</h1>
            <p>Account, family and health tools</p>
          </div>
        </header>

        <ProfileTabs active="profile" />

        {/* Free accounts only: these meters exist to show how much of the free
            allowance is left. Paid plans are uncapped, so the card would just
            be four bars that can never fill. */}
        {usage && !usage.unlimited && (
          <section className="profile-usage-card" aria-label="Monthly free usage">
            <div className="profile-usage-head">
              <span><Gauge size={18} weight="duotone" /></span>
              <div>
                <h2>Free usage this month</h2>
                <p>Shared across your family account</p>
              </div>
            </div>
            <div className="profile-usage-list">
              {usage.items.map((item) => (
                <div className="profile-usage-item" key={item.key}>
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.used} / {item.limit}</strong>
                  </div>
                  <i aria-hidden="true">
                    <b style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                  </i>
                </div>
              ))}
            </div>
            {usage.items.some((item) => item.used >= item.warning_at) && (
              <a
                className="profile-usage-upgrade"
                href="/dashboard/payments"
                onClick={() => captureEvent("billing_entry_clicked", {
                  source: "profile_usage_limit",
                  current_plan: usage.plan_key,
                })}
              >
                Upgrade FamCare
              </a>
            )}
          </section>
        )}

        <div className="profile-page-links">
          {profileLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="profile-page-link"
                onClick={() => captureEvent("profile_tool_clicked", {
                  destination: item.href,
                  label: item.label,
                })}
              >
                <span className={`profile-page-link-icon ${item.tone}`}>
                  <Icon size={19} weight="bold" />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <i aria-hidden="true">›</i>
              </Link>
            );
          })}
        </div>

        <div className="profile-page-spacer" aria-hidden="true" />

        <div className="profile-page-links">
          <Link
            href="/dashboard/review"
            className="profile-page-link"
            onClick={() => captureEvent("profile_tool_clicked", {
              destination: "/dashboard/review",
              label: "Feedback for FamCare",
            })}
          >
            <span className="profile-page-link-icon violet">
              <ChatCircleText size={19} weight="bold" />
            </span>
            <span>
              <strong>Feedback for FamCare</strong>
              <small>Share feedback about your experience</small>
            </span>
            <i aria-hidden="true">›</i>
          </Link>
        </div>

        <button
          type="button"
          className="profile-page-logout"
          onClick={() => setConfirmLogoutOpen(true)}
        >
          <SignOut size={18} weight="bold" />
          Log out
        </button>
      </main>

      {confirmLogoutOpen && typeof document !== "undefined" && createPortal(
        <div className="db-modal-overlay" onClick={() => setConfirmLogoutOpen(false)}>
          <button
            type="button"
            className="mobile-sheet-close"
            aria-label="Close logout confirmation"
            onClick={() => setConfirmLogoutOpen(false)}
          >
            <X size={16} weight="bold" />
          </button>
          <div className="db-modal-sheet db-logout-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close logout confirmation"
              className="db-logout-modal-close"
              onClick={() => setConfirmLogoutOpen(false)}
            >
              <X size={15} weight="bold" />
            </button>
            <div className="db-logout-modal-icon">
              <SignOut size={24} weight="bold" />
            </div>
            <h2>Log out?</h2>
            <p>You&apos;ll need to verify your WhatsApp number again to access the dashboard.</p>
            <div className="db-logout-modal-actions">
              <button
                type="button"
                className="db-logout-cancel"
                onClick={() => setConfirmLogoutOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="db-logout-confirm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
