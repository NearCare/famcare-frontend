"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calculator, ChartLine, ChatCircleText, House, Users, FileText, List, Pill, SignOut, Sparkle, X,
} from "@phosphor-icons/react";
import { captureEvent, resetAnalytics } from "@/lib/analytics";
import { getFeatureFlags, type FeatureFlags } from "@/lib/api";
import { clearStoredSession } from "@/lib/session";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function shouldRequireFeatureFlags() {
  if (!IS_PRODUCTION) return false;
  if (typeof window === "undefined") return true;
  return !["localhost", "127.0.0.1"].includes(window.location.hostname);
}

const navItems = [
  { label: "Home",             href: "/dashboard" },
  { label: "Home V2",          href: "/dashboard/homev2", isNew: true },
  { label: "Statistics",       href: "/dashboard/statistics", isNew: true },
  { label: "Family Overview",  href: "/dashboard/family-overview" },
  { label: "Medications",      href: "/dashboard/medications" },
  { label: "Logs",             href: "/dashboard/logs" },
  { label: "Calorie Calculator", href: "/dashboard/calorie-calculator", isNew: true },
  { label: "Health Assistant", href: "/dashboard/health-assistant", isNew: true, featureFlag: "v2" as const },
  { label: "Review",           href: "/dashboard/review" },
];

const NAV_ICONS: Record<string, React.ElementType> = {
  "Home":             House,
  "Home V2":          Sparkle,
  "Statistics":       ChartLine,
  "Family Overview":  Users,
  "Medications":      Pill,
  "Logs":             FileText,
  "Calorie Calculator": Calculator,
  "Health Assistant":  Sparkle,
  "Review":           ChatCircleText,
};

function NavIcon({ name }: { name: string }) {
  const Icon = NAV_ICONS[name] ?? House;
  return <Icon className="ni-icon" size={19} weight="bold" />;
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({ v2: false });
  const pathname = usePathname();
  const requireFeatureFlags = shouldRequireFeatureFlags();

  useEffect(() => {
    getFeatureFlags()
      .then(setFeatureFlags)
      .catch(() => setFeatureFlags({ v2: false }));
  }, []);

  function handleLogout() {
    captureEvent("logout");
    resetAnalytics();
    clearStoredSession({ resetFeatureIntro: true });
    window.location.href = "/login";
  }

  return (
    <>
      <div className="db-mobile-topbar">
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <img src="/famcare-logo.png" alt="" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 8 }} />
          <span>Fam<span style={{ color: "#FF6B6B" }}>Care</span></span>
        </span>
        <button onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
          <List size={22} weight="bold" />
        </button>
      </div>

      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 150 }} />
      )}

      <aside className={`db-sidebar${mobileOpen ? " open" : ""}`}>
        <div className="db-brand">
          <img className="db-brand-mark" src="/famcare-logo.png" alt="" />
          <span className="db-brand-name">Fam<span className="care">Care</span></span>
        </div>

        <nav className="db-nav">
          {navItems.filter((item) => !item.featureFlag || !requireFeatureFlags || featureFlags[item.featureFlag]).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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
            setMobileOpen(false);
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

      {confirmLogoutOpen && (
        <div
          className="db-modal-overlay"
          onClick={() => setConfirmLogoutOpen(false)}
        >
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
        </div>
      )}
    </>
  );
}
