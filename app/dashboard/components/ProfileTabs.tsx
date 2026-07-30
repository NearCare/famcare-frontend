"use client";

import Link from "next/link";

const TABS = [
  { label: "Profile", href: "/dashboard/profile" },
  { label: "Plan & billing", href: "/dashboard/profile/billing" },
] as const;

/**
 * Page-level navigation shared by the profile and billing screens. Rendered on
 * both so the pair reads as one section with two tabs rather than two routes
 * that happen to link to each other.
 */
export default function ProfileTabs({ active }: { active: "profile" | "billing" }) {
  return (
    <nav className="profile-tabs" aria-label="Profile sections">
      {TABS.map((tab) => {
        const isActive = (tab.href.endsWith("/billing") ? "billing" : "profile") === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={isActive ? "active" : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
