"use client";

import { useRouter, usePathname } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { BOTTOM_NAV_ROUTES } from "./MobileBottomNav";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/family-overview": "Family Overview",
  "/dashboard/family-overviewv2": "Family Overview",
  "/dashboard/calorie-calculator": "Calorie Calculator",
  "/dashboard/logs": "Logs",
  "/dashboard/review": "Review",
};

function titleFor(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Mobile-only back bar for dashboard pages outside the bottom nav dock —
 * those pages have no other way back to Home on mobile once the floating
 * profile icon (which also only shows on desktop-reachable pages) is gone.
 */
export default function MobileBackBar({ v2Enabled }: { v2Enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  if (BOTTOM_NAV_ROUTES.includes(pathname)) return null;

  const fallbackHref = v2Enabled ? "/dashboard/homev2" : "/dashboard";

  function handleBack() {
    // A same-app history entry lets router.back() preserve scroll/filters;
    // a fresh tab or deep link has nowhere to go back to, so fall back home.
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <div className="mobile-back-bar">
      <button type="button" className="mobile-back-bar-btn" onClick={handleBack} aria-label="Go back">
        <CaretLeft size={18} weight="bold" />
      </button>
      <span className="mobile-back-bar-title">{titleFor(pathname)}</span>
    </div>
  );
}
