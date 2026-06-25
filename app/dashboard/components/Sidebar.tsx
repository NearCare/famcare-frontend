"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  House, Users, TrendUp, CalendarDots, MapPin, FileText,
  Lightning, Bell, Gear, List, Pill,
} from "@phosphor-icons/react";

const navItems = [
  { label: "Home",             href: "/dashboard",                soon: false },
  { label: "Family Overview",  href: "/dashboard/family-overview", soon: false },
  { label: "Medications",      href: "/dashboard/medications",     soon: false },
  { label: "Progress",         href: "#",                          soon: true  },
  { label: "Appointments",     href: "#",                          soon: true  },
  { label: "Nearby Providers", href: "#",                          soon: true  },
  { label: "Health Records",   href: "#",                          soon: true  },
  { label: "Activity",         href: "#",                          soon: true  },
  { label: "Reminders",        href: "#",                          soon: true  },
  { label: "Settings",         href: "#",                          soon: true  },
];

const NAV_ICONS: Record<string, React.ElementType> = {
  "Home":             House,
  "Family Overview":  Users,
  "Medications":      Pill,
  "Progress":         TrendUp,
  "Appointments":     CalendarDots,
  "Nearby Providers": MapPin,
  "Health Records":   FileText,
  "Activity":         Lightning,
  "Reminders":        Bell,
  "Settings":         Gear,
};

function NavIcon({ name }: { name: string }) {
  const Icon = NAV_ICONS[name] ?? House;
  return <Icon className="ni-icon" size={19} weight="bold" />;
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="db-mobile-topbar">
        <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Fam<span style={{ color: "#FF6B6B" }}>Care</span>
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
          <div className="db-brand-mark">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
              <path d="M12 21C12 21 4 14 4 8.5a8 8 0 0116 0C20 14 12 21 12 21z" fill="white" />
              <circle cx="12" cy="8.5" r="3" fill="rgba(255,255,255,0.45)" />
            </svg>
          </div>
          <span className="db-brand-name">Fam<span className="care">Care</span></span>
        </div>

        <nav className="db-nav">
          {navItems.map((item) => {
            const active = !item.soon && pathname === item.href;
            if (item.soon) {
              return (
                <a
                  key={item.label}
                  onClick={(e) => e.preventDefault()}
                  className={`db-nav-item soon${active ? " active" : ""}`}
                >
                  <NavIcon name={item.label} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span className="db-soon-badge">Soon</span>
                </a>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`db-nav-item${active ? " active" : ""}`}
              >
                <NavIcon name={item.label} />
                <span style={{ flex: 1 }}>{item.label}</span>
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
    </>
  );
}
