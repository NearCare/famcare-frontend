"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChartLine, ChatCircleText, FileText, House, Users, Pill, SignOut, Sparkle, X,
} from "@phosphor-icons/react";
import { captureEvent, resetAnalytics } from "@/lib/analytics";
import { getFeatureFlags, type FeatureFlags } from "@/lib/api";
import { clearStoredSession } from "@/lib/session";
import { bypassV2FeatureFlagLocally } from "@/lib/v2Feature";
import BrandName from "./BrandName";
import MobileBackBar from "./MobileBackBar";
import MobileBottomNav from "./MobileBottomNav";
import ProfileMenu from "./ProfileMenu";

type NavigationItem = {
  label: string;
  href: string;
  isNew?: boolean;
};

const v2NavItems: NavigationItem[] = [
  { label: "Home",             href: "/dashboard/homev2" },
  { label: "Statistics",       href: "/dashboard/statistics", isNew: true },
  { label: "Family Overview",  href: "/dashboard/family-overviewv2" },
  { label: "Medications",      href: "/dashboard/medications" },
  { label: "Health Assistant", href: "/dashboard/health-assistant", isNew: true },
  { label: "Review",           href: "/dashboard/review" },
];

const legacyNavItems: NavigationItem[] = [
  { label: "Home",             href: "/dashboard" },
  { label: "Family Overview",  href: "/dashboard/family-overview" },
  { label: "Medications",      href: "/dashboard/medications" },
  { label: "Logs",             href: "/dashboard/logs" },
  { label: "Review",           href: "/dashboard/review" },
];

const NAV_ICONS: Record<string, React.ElementType> = {
  "Home":             House,
  "Statistics":       ChartLine,
  "Family Overview":  Users,
  "Medications":      Pill,
  "Logs":              FileText,
  "Health Assistant":  Sparkle,
  "Review":           ChatCircleText,
};

function NavIcon({ name }: { name: string }) {
  const Icon = NAV_ICONS[name] ?? House;
  return <Icon className="ni-icon" size={19} weight="bold" />;
}

export default function Sidebar() {
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const localBypass = bypassV2FeatureFlagLocally();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({ v2: localBypass });
  const pathname = usePathname();

  useEffect(() => {
    getFeatureFlags()
      .then(setFeatureFlags)
      .catch(() => setFeatureFlags({ v2: false }));
  }, [localBypass]);

  const v2Enabled = localBypass || featureFlags.v2;
  const navItems = v2Enabled ? v2NavItems : legacyNavItems;

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

  function handleLogout() {
    captureEvent("logout");
    resetAnalytics();
    clearStoredSession({ resetFeatureIntro: true });
    window.location.href = "/login";
  }

  // Home renders its own copy inside the top bar; every other page gets the pinned one.
  const showFloatingProfile = pathname !== "/dashboard/homev2";

  return (
    <>
      {showFloatingProfile && <ProfileMenu floating />}
      <MobileBackBar v2Enabled={v2Enabled} />

      <aside className="db-sidebar">
        <div className="db-brand">
          <img className="db-brand-mark" src="/famcare-logo.png" alt="" />
          <BrandName className="db-brand-name" />
        </div>

        <nav className="db-nav">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`db-nav-item${active ? " active" : ""}`}
              >
                <NavIcon name={item.label} />
                <span className={item.isNew ? "db-nav-label-stack" : "db-nav-label"}>
                  <span className="db-nav-label">{item.label}</span>
                  {item.isNew && <span className="db-new-badge">New</span>}
                </span>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => {
            setConfirmLogoutOpen(true);
          }}
          className="db-nav-item db-logout-item"
        >
          <SignOut className="ni-icon" size={19} weight="bold" />
          <span style={{ flex: 1 }}>Logout</span>
        </button>

        <div className="db-motiv">
          <span className="leaf">🌱</span>
          <h4>Stay consistent,<br />see the change!</h4>
          <p>Small steps today,<br />a healthier tomorrow.</p>
        </div>
      </aside>

      {v2Enabled && (
        <MobileBottomNav
          assistantEnabled
          onLogout={() => setConfirmLogoutOpen(true)}
        />
      )}

      {confirmLogoutOpen && typeof document !== "undefined" && createPortal(
        <div
          className="db-modal-overlay"
          onClick={() => setConfirmLogoutOpen(false)}
        >
          <button
            type="button"
            className="mobile-sheet-close"
            aria-label="Close logout confirmation"
            onClick={() => setConfirmLogoutOpen(false)}
          >
            <X size={16} weight="bold" />
          </button>
          <div
            className="db-modal-sheet db-logout-modal"
            onClick={(e) => e.stopPropagation()}
          >
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
              <button
                type="button"
                className="db-logout-confirm"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
