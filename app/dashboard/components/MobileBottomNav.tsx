"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Pill, ChartLine, UserCircle } from "@phosphor-icons/react";

type MobileBottomNavProps = {
  assistantEnabled: boolean;
};

const primaryItems = [
  { label: "Home", href: "/dashboard/homev2", icon: House },
  { label: "Medication", href: "/dashboard/medications", icon: Pill },
  { label: "Stats", href: "/dashboard/statistics", icon: ChartLine },
];

export const BOTTOM_NAV_ROUTES = [
  "/dashboard",
  "/dashboard/homev2",
  "/dashboard/medications",
  "/dashboard/statistics",
  "/dashboard/profile",
  "/dashboard/health-assistant",
];

export default function MobileBottomNav({ assistantEnabled }: MobileBottomNavProps) {
  const pathname = usePathname();
  const profileActive = pathname === "/dashboard/profile";

  if (!BOTTOM_NAV_ROUTES.includes(pathname)) {
    return null;
  }

  return (
    <nav className="mobile-health-dock" aria-label="Mobile dashboard navigation">
      <div className="mobile-health-dock-main">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.label === "Home" && pathname === "/dashboard");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-health-dock-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span><Icon size={20} weight={active ? "fill" : "bold"} /></span>
              <small>{item.label}</small>
            </Link>
          );
        })}
        <Link
          href="/dashboard/profile"
          className={`mobile-health-dock-item${profileActive ? " active" : ""}`}
          aria-current={profileActive ? "page" : undefined}
        >
          <span><UserCircle size={20} weight={profileActive ? "fill" : "bold"} /></span>
          <small>Profile</small>
        </Link>
      </div>

      {assistantEnabled && (
        <Link
          href="/dashboard/health-assistant"
          className={`mobile-health-ai${pathname === "/dashboard/health-assistant" ? " active" : ""}`}
          aria-label="Open AI health coach"
        >
          <span>
            <img src="/mascot.png" alt="" />
          </span>
          <small>AI Coach</small>
          <em>Beta</em>
        </Link>
      )}
    </nav>
  );
}
