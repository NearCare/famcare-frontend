"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChartLine, ChatCircleText, FileText, House, Users, Pill, Sparkle,
} from "@phosphor-icons/react";
import { getFeatureFlags, type FeatureFlags } from "@/lib/api";
import { bypassV2FeatureFlagLocally } from "@/lib/v2Feature";
import { useSubscription } from "@/lib/useSubscription";
import BrandName from "./BrandName";
import MobileBackBar from "./MobileBackBar";
import MobileBottomNav from "./MobileBottomNav";
import ProfileMenu from "./ProfileMenu";

type NavigationItem = {
  label: string;
  href: string;
  isNew?: boolean;
  isBeta?: boolean;
};

const v2NavItems: NavigationItem[] = [
  { label: "Home",             href: "/dashboard/homev2" },
  { label: "Statistics",       href: "/dashboard/statistics" },
  { label: "Family Overview",  href: "/dashboard/family-overviewv2" },
  { label: "Medications",      href: "/dashboard/medications" },
  { label: "Health Assistant", href: "/dashboard/health-assistant", isNew: true, isBeta: true },
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
  const localBypass = bypassV2FeatureFlagLocally();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({ v2: localBypass });
  const pathname = usePathname();
  const { isSubscribed } = useSubscription();

  useEffect(() => {
    getFeatureFlags()
      .then(setFeatureFlags)
      .catch(() => setFeatureFlags({ v2: false }));
  }, [localBypass]);

  const v2Enabled = localBypass || featureFlags.v2;
  const navItems = v2Enabled ? v2NavItems : legacyNavItems;

  // Home renders its own copy inside the top bar; every other page gets the pinned one.
  const showFloatingProfile = pathname !== "/dashboard/homev2";

  return (
    <>
      {showFloatingProfile && <ProfileMenu floating />}
      <MobileBackBar v2Enabled={v2Enabled} />

      <aside className="db-sidebar">
        <div className="db-brand">
          <img
            className={`db-brand-mark${isSubscribed ? " plus" : ""}`}
            src={isSubscribed ? "/famcareplus.png" : "/famcare-logo.png"}
            alt=""
          />
          <BrandName className="db-brand-name" />
        </div>

        <nav className="db-nav">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const showStack = item.isNew || item.isBeta;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`db-nav-item${active ? " active" : ""}`}
              >
                <NavIcon name={item.label} />
                {showStack ? (
                  <span className="db-nav-label-stack">
                    <span className="db-nav-label-row">
                      <span className="db-nav-label">{item.label}</span>
                      {item.isBeta && <span className="db-beta-badge">Beta</span>}
                    </span>
                    {item.isNew && <span className="db-new-badge">New</span>}
                  </span>
                ) : (
                  <span className="db-nav-label">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="db-motiv">
          <span className="leaf">🌱</span>
          <h4>Stay consistent,<br />see the change!</h4>
          <p>Small steps today,<br />a healthier tomorrow.</p>
        </div>
      </aside>

      {v2Enabled && <MobileBottomNav assistantEnabled />}
    </>
  );
}
