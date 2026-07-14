"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Calculator, ChatCircleText, House, Users, FileText, List, Pill, SignOut, X,
} from "@phosphor-icons/react";

const navItems = [
  { label: "Home",             href: "/dashboard" },
  { label: "Family Overview",  href: "/dashboard/family-overview" },
  { label: "Medications",      href: "/dashboard/medications" },
  { label: "Logs",             href: "/dashboard/logs" },
  { label: "Calorie Calculator", href: "/dashboard/calorie-calculator", isNew: true },
  { label: "Review",           href: "/dashboard/review" },
];

const NAV_ICONS: Record<string, React.ElementType> = {
  "Home":             House,
  "Family Overview":  Users,
  "Medications":      Pill,
  "Logs":             FileText,
  "Calorie Calculator": Calculator,
  "Review":           ChatCircleText,
};

function NavIcon({ name }: { name: string }) {
  const Icon = NAV_ICONS[name] ?? House;
  return <Icon className="ni-icon" size={19} weight="bold" />;
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const pathname = usePathname();

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
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
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`db-nav-item${active ? " active" : ""}`}
              >
                <NavIcon name={item.label} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.isNew && <span className="db-new-badge">New</span>}
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
