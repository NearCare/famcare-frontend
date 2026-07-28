"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CreditCard, SignOut, UserCircle, X } from "@phosphor-icons/react";
import { captureEvent, resetAnalytics } from "@/lib/analytics";
import { clearStoredSession } from "@/lib/session";
import { useSubscription } from "@/lib/useSubscription";

const MENU_LINKS = [
  { label: "Profile", description: "Account and health tools", href: "/dashboard/profile", icon: UserCircle },
  { label: "Payment", description: "Plan, billing and receipts", href: "/dashboard/payments", icon: CreditCard },
] as const;

export default function ProfileMenu({
  name,
  floating = false,
}: {
  name?: string | null;
  /** Pins the trigger to the top-right of the viewport (used on pages without their own top bar). */
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [storedName, setStoredName] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { isSubscribed, planKey } = useSubscription();

  // Pages that don't already track the user (e.g. the sidebar-mounted copy) fall back to the session.
  useEffect(() => {
    if (name) return;
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) setStoredName((JSON.parse(raw) as { name?: string }).name ?? null);
    } catch {
      setStoredName(null);
    }
  }, [name]);

  const displayName = name ?? storedName;
  const initial = (displayName ?? "S").charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

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

  return (
    <div className={`homev2-profile-wrap${floating ? " floating" : ""}`} ref={wrapRef}>
      <button
        className={`db-avatar homev2-profile-button${open ? " active" : ""}`}
        type="button"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((visible) => !visible)}
      >
        {initial}
      </button>

      {open && (
        <div className="profile-menu" role="menu" aria-label="Profile menu">
          <div className="profile-menu-head">
            <span className="profile-menu-avatar">{initial}</span>
            <div>
              <strong>{displayName?.trim() || "Your profile"}</strong>
              <small>
                {isSubscribed
                  ? `FamCare+ · ${planKey === "family" ? "Family" : "Individual"} plan`
                  : "Free plan"}
              </small>
            </div>
          </div>

          {MENU_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="profile-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Icon size={18} weight="duotone" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            className="profile-menu-item danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmLogoutOpen(true);
            }}
          >
            <SignOut size={18} weight="duotone" />
            <span>
              <strong>Logout</strong>
              <small>Sign out of this device</small>
            </span>
          </button>
        </div>
      )}

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
          <div className="db-modal-sheet db-logout-modal" onClick={(event) => event.stopPropagation()}>
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
