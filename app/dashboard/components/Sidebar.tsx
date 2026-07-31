"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLine, ChatCircleText, FileText, House, Users, Pill, Sparkle,
} from "@phosphor-icons/react";
import { captureEvent } from "@/lib/analytics";
import BrandMark from "./BrandMark";
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

const navItems: NavigationItem[] = [
  { label: "Home",             href: "/dashboard" },
  { label: "Statistics",       href: "/dashboard/statistics" },
  { label: "Family Overview",  href: "/dashboard/family-overview" },
  { label: "Medications",      href: "/dashboard/medications" },
  { label: "Health Assistant", href: "/dashboard/health-assistant", isNew: true, isBeta: true },
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
  const pathname = usePathname();

  // Home renders its own copy inside the top bar; every other page gets the pinned one.
  const showFloatingProfile = pathname !== "/dashboard";

  return (
    <>
      {showFloatingProfile && <ProfileMenu floating />}
      <MobileBackBar />

      <aside className="db-sidebar">
        <div className="db-brand">
          <BrandMark className="db-brand-mark" />
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
                onClick={() => captureEvent("dashboard_navigation_clicked", {
                  destination: item.href,
                  label: item.label,
                  source: "desktop_sidebar",
                })}
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

      <MobileBottomNav assistantEnabled />
    </>
  );
}
