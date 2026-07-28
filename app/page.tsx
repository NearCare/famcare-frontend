"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  House, TrendUp, ForkKnife, Lightning, ClipboardText, Trophy,
  Bell, Gear, CalendarBlank, Fire, Lock, MapPin, Users,
  ChatDots, ChartBar, Heart, UserCircle, Info,
} from "@phosphor-icons/react";
import { FEShoe, FETarget } from "./dashboard/components/FluentEmoji";
import { getCurrentUser } from "@/lib/api";
import { authPath, resolvedAuthDestination } from "@/lib/authRedirect";
import { FAMCARE_WHATSAPP_LINK } from "@/lib/whatsapp";

const LOCAL_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === "true";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://famcarehealth.com/#organization",
      name: "FamCare",
      alternateName: "FamCareHealth",
      url: "https://famcarehealth.com",
      logo: {
        "@type": "ImageObject",
        url: "https://famcarehealth.com/famcare-logo.png",
        width: 512,
        height: 512,
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://famcarehealth.com/#website",
      url: "https://famcarehealth.com",
      name: "FamCare",
      alternateName: "FamCareHealth",
      publisher: {
        "@id": "https://famcarehealth.com/#organization",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://famcarehealth.com/#software",
      name: "FamCare",
      alternateName: "FamCareHealth",
      url: "https://famcarehealth.com",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web, WhatsApp",
      description:
        "WhatsApp-first medicine reminders, dose confirmations, missed-dose alerts, and family adherence summaries for parents.",
      isPartOf: {
        "@id": "https://famcarehealth.com/#website",
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
      },
      audience: {
        "@type": "Audience",
        audienceType: "Family caregivers",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://famcarehealth.com/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can parents use FamCare without installing an app?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. FamCare is designed around WhatsApp so parents can receive reminders and confirm medicine doses without installing another app.",
          },
        },
        {
          "@type": "Question",
          name: "Can children manage medicines for their parents?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Family members can add medicines, view today's schedule, and track dose confirmations for active family members.",
          },
        },
        {
          "@type": "Question",
          name: "Does FamCare provide medical advice?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. FamCare helps families track reminders and adherence. It does not replace prescriptions, doctors, or professional medical advice.",
          },
        },
      ],
    },
  ],
};

function EstimateInfo({ size = 8 }: { size?: number }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visible = open || hovered;

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        setOpen((current) => !current);
      }}
      onBlur={() => setOpen(false)}
      style={{ display: "inline-flex", position: "relative", cursor: "help", color: "#9AA0AD" }}
      tabIndex={0}
      role="button"
      aria-label="Nutrition estimate info"
    >
      <Info size={size} weight="bold" />
      {visible && (
        <span style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 170,
          background: "#1A2744",
          color: "#fff",
          borderRadius: 9,
          padding: "7px 8px",
          zIndex: 80,
          boxShadow: "0 8px 22px rgba(26,20,20,.22)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 8.5,
          fontWeight: 700,
          lineHeight: 1.35,
          whiteSpace: "normal",
          pointerEvents: "none",
        }}>
          <span style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 5, overflow: "hidden" }}>
            <span style={{ display: "block", width: 8, height: 8, background: "#1A2744", transform: "rotate(45deg)", margin: "3px auto 0" }} />
          </span>
          Estimated from meal messages. Values are approximate.
        </span>
      )}
    </span>
  );
}

const useCases = [
  {
    title: "Medicine reminders for parents",
    desc: "Set parent medicine schedules and track taken or missed doses.",
    href: "/medicine-reminders-for-parents",
  },
  {
    title: "WhatsApp medicine reminders",
    desc: "Use a familiar WhatsApp flow for reminders and confirmations.",
    href: "/whatsapp-medicine-reminders",
  },
  {
    title: "Elderly parent care app",
    desc: "Coordinate family care, medicine routines, and weekly updates.",
    href: "/elderly-parent-care-app",
  },
];

const DashboardMockup = () => (
  <div style={{
    width: 600,
    flexShrink: 0,
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 8px 48px rgba(26,20,20,.14)",
    border: "1px solid #EDE6E6",
    overflow: "hidden",
    marginTop: 8,
  }}>
    {/* Top bar */}
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 16px",
      background: "linear-gradient(to right,#FFF5F3,#FFFAF9)",
      borderBottom: "1px solid #F0E8E8",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <img src="/famcare-logo.png" alt="" style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 6 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700 }}>Fam<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Care</em></span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600 }}>
        Hello, Priya! 👋 <small style={{ fontSize: 9.5, color: "#6B7A9A", fontWeight: 400, display: "block", marginTop: 1 }}>Here&apos;s your health summary for today.</small>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ background: "#fff", border: "1px solid #EDE6E6", borderRadius: 6, padding: "4px 9px", fontSize: 9, color: "#6B7A9A", display: "flex", alignItems: "center", gap: 4 }}><CalendarBlank size={9} weight="bold" /> Today, {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ▾</div>
        <div style={{ width: 26, height: 26, background: "#fff", border: "1px solid #EDE6E6", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <Bell size={12} weight="bold" color="#6B7A9A" /><div style={{ position: "absolute", top: 4, right: 5, width: 5, height: 5, background: "#E85C5C", borderRadius: "50%", border: "1.5px solid #fff" }}></div>
        </div>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#FFD0C8,#FF9E9E)", fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>P</div>
      </div>
    </div>

    {/* Body */}
    <div style={{ display: "flex", height: 360 }}>
      {/* Sidebar */}
      <div style={{ width: 100, borderRight: "1px solid #F5EEEE", padding: "8px 6px", display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
        {[
          { icon: <House size={10} weight="bold" />, label: "Home", active: true },
          { icon: <TrendUp size={10} weight="bold" />, label: "Progress" },
          { icon: <ForkKnife size={10} weight="bold" />, label: "Meals" },
          { icon: <Lightning size={10} weight="bold" />, label: "Activity" },
          { icon: <ClipboardText size={10} weight="bold" />, label: "Reports" },
          { icon: <Trophy size={10} weight="bold" />, label: "Achievements" },
          { icon: <Bell size={10} weight="bold" />, label: "Reminders" },
          { icon: <Gear size={10} weight="bold" />, label: "Settings" },
        ].map((item) => (
          <div key={item.label} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 7px",
            borderRadius: 6, fontSize: 8.5, fontWeight: item.active ? 600 : 500,
            color: item.active ? "#E85C5C" : "#6B7A9A",
            background: item.active ? "#FFEDEC" : "transparent",
          }}>
            {item.icon} {item.label}
          </div>
        ))}
        <div style={{ background: "linear-gradient(145deg,#FFF5F3,#FFE4DE)", borderRadius: 9, padding: 9, marginTop: "auto" }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>🌿</div>
          <h5 style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.3 }}>Keep going!</h5>
          <p style={{ fontSize: 8, color: "#6B7A9A", marginTop: 2, lineHeight: 1.4 }}>You&apos;re doing amazing.</p>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 9, display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
          {[
            { icon: <ForkKnife size={18} weight="bold" color="#E85C5C" />, label: "Meals Logged", color: "#E85C5C", val: "3", sub: "Today", pct: 100, colorClass: "r" },
            { icon: <FEShoe size={20} />, label: "Steps Today", color: "#4A8FE2", val: "6,842", sub: "Today", pct: 68, colorClass: "b", blue: true },
            { icon: <Fire size={18} weight="bold" color="#F5A623" />, label: "Calories", estimated: true, color: "#F5A623", val: "1,650", sub: "Today", pct: 83, colorClass: "o" },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: stat.blue ? "linear-gradient(145deg,#EBF3FF,#D4E8FF)" : "#fff",
              border: stat.blue ? "none" : "1px solid #F0E8E8",
              borderRadius: 9, padding: "9px 10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ display: "flex", alignItems: "center" }}>{stat.icon}</div>
                <div>
                  <div style={{ fontSize: 7.5, fontWeight: 600, color: stat.color, display: "inline-flex", alignItems: "center", gap: 3 }}>{stat.label}{stat.estimated && <EstimateInfo />}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px", lineHeight: 1.1, marginTop: 2 }}>{stat.val}</div>
                  <div style={{ fontSize: 7.5, color: "#6B7A9A" }}>{stat.sub}</div>
                </div>
              </div>
              <div style={{ height: 3, background: stat.blue ? "rgba(74,143,226,.18)" : "rgba(0,0,0,.08)", borderRadius: 2, marginTop: 7, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: stat.color, width: `${stat.pct}%` }}></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 7, color: "#B0BFCC" }}>
                <span>Goal: {stat.label === "Meals Logged" ? "3 meals" : stat.label === "Steps Today" ? "10,000" : "2,000 kcal"}</span>
                <span style={{ fontWeight: 600, color: "#6B7A9A" }}>{stat.pct}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.85fr", gap: 7 }}>
          {/* Steps bar */}
          <div style={{ background: "#fff", border: "1px solid #F0E8E8", borderRadius: 9, padding: "9px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600 }}>Steps Overview</div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.3px", marginTop: 2 }}>6,842</div>
                <div style={{ fontSize: 7.5, color: "#6B7A9A" }}>average steps</div>
                <div style={{ fontSize: 7.5, fontWeight: 600, color: "#3EB86A", marginTop: 2 }}>↑ 12% vs last week</div>
              </div>
              <div style={{ fontSize: 7.5, color: "#6B7A9A", background: "#F5F0F0", padding: "2px 6px", borderRadius: 8 }}>This Week ▾</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36, marginTop: 5 }}>
              {[40, 22, 56, 68, 95, 62, 30].map((h, i) => (
                <div key={i} style={{ flex: 1, borderRadius: "3px 3px 0 0", background: i === 4 ? "#1A2744" : "#BDDEFF", height: `${h}%` }}></div>
              ))}
            </div>
            <div style={{ display: "flex", marginTop: 3 }}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 6.5, color: "#B0BFCC" }}>{d}</div>
              ))}
            </div>
          </div>

          {/* Meals list */}
          <div style={{ background: "#fff", border: "1px solid #F0E8E8", borderRadius: 9, padding: "9px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600 }}>Meals Today</div>
                <div style={{ fontSize: 7.5, color: "#E85C5C", fontWeight: 600, marginTop: 1 }}>3 / 3 logged</div>
              </div>
              <span style={{ fontSize: 7.5, color: "#E85C5C", fontWeight: 600 }}>View all</span>
            </div>
            {[
              { icon: <ForkKnife size={11} weight="bold" color="#E85C5C" />, name: "Breakfast", sub: "Oatmeal with berries", time: "8:30 AM" },
              { icon: <ForkKnife size={11} weight="bold" color="#E85C5C" />, name: "Lunch", sub: "Brown rice, dal, veggies", time: "1:00 PM" },
              { icon: <ForkKnife size={11} weight="bold" color="#E85C5C" />, name: "Dinner", sub: "Grilled chicken, salad", time: "7:30 PM" },
            ].map((meal) => (
              <div key={meal.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 0", borderBottom: "1px solid #F5EFEF" }}>
                <div style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{meal.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 600 }}>{meal.name}</div>
                  <div style={{ fontSize: 7.5, color: "#6B7A9A" }}>{meal.sub}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 7.5, color: "#6B7A9A" }}>{meal.time}</div>
                  <div style={{ width: 12, height: 12, background: "#E8F8EE", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#3EB86A" }}>✓</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 5, fontSize: 7.5, color: "#E85C5C", fontWeight: 600 }}>➕ Add more via WhatsApp</div>
          </div>

          {/* Activity donut */}
          <div style={{ background: "#fff", border: "1px solid #F0E8E8", borderRadius: 9, padding: "9px 10px" }}>
            <div style={{ fontSize: 9, fontWeight: 600 }}>Activity Summary</div>
            <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 56, marginTop: 3 }}>
              <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="29" cy="29" r="22" fill="none" stroke="#E8F3FF" strokeWidth="7" />
                <circle cx="29" cy="29" r="22" fill="none" stroke="#4A8FE2" strokeWidth="7" strokeDasharray="94 138" strokeLinecap="round" />
              </svg>
              <div style={{ position: "absolute", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>68%</div>
                <div style={{ fontSize: 7.5, color: "#6B7A9A", marginTop: 1 }}>of daily goal</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
              {[
                { color: "#4A8FE2", label: "Steps", val: "6,842 / 10,000" },
                { color: "#F5A623", label: "Active Time", val: "45 / 60 mins" },
                { color: "#E85C5C", label: "Calories", estimated: true, val: "1,650 / 2,000" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#6B7A9A" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: row.color }}></div>
                    {row.label}{row.estimated && <EstimateInfo size={7} />}
                  </div>
                  <div style={{ fontWeight: 600 }}>{row.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <div style={{ background: "#fff", border: "1px solid #F0E8E8", borderRadius: 9, padding: "9px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 9, fontWeight: 600 }}>Your Progress</div>
              <div style={{ fontSize: 7.5, color: "#6B7A9A", background: "#F5F0F0", padding: "2px 6px", borderRadius: 8 }}>This Week ▾</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.3px" }}>7,248</div>
            <div style={{ fontSize: 7.5, color: "#6B7A9A", marginTop: 1 }}>Steps (avg)</div>
            <svg width="100%" height="38" viewBox="0 0 260 38" preserveAspectRatio="none" style={{ marginTop: 6 }}>
              <polyline points="0,33 43,26 86,18 130,22 173,10 216,5 260,13" fill="none" stroke="#4A8FE2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {[0,43,86,130,173,216,260].map((x,i) => {
                const ys = [33,26,18,22,10,5,13];
                return <circle key={i} cx={x} cy={ys[i]} r="3" fill="#4A8FE2" />;
              })}
            </svg>
            <div style={{ display: "flex", marginTop: 3 }}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 6.5, color: "#B0BFCC" }}>{d}</div>
              ))}
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #F0E8E8", borderRadius: 9, padding: "9px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 9, fontWeight: 600 }}>Meals Progress</div>
              <div style={{ fontSize: 7.5, color: "#6B7A9A", background: "#F5F0F0", padding: "2px 6px", borderRadius: 8 }}>This Week ▾</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.3px" }}>2.7</div>
            <div style={{ fontSize: 7.5, color: "#6B7A9A", marginTop: 1 }}>Meals (avg)</div>
            <svg width="100%" height="38" viewBox="0 0 260 38" preserveAspectRatio="none" style={{ marginTop: 6 }}>
              <polyline points="0,30 43,23 86,30 130,12 173,19 216,7 260,15" fill="none" stroke="#E85C5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {[0,43,86,130,173,216,260].map((x,i) => {
                const ys = [30,23,30,12,19,7,15];
                return <circle key={i} cx={x} cy={ys[i]} r="3" fill="#E85C5C" />;
              })}
            </svg>
            <div style={{ display: "flex", marginTop: 3 }}>
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 6.5, color: "#B0BFCC" }}>{d}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CurrentDashboardPreview = () => (
  <div className="lp-current-dashboard" aria-label="Preview of the current FamCare family dashboard">
    <style dangerouslySetInnerHTML={{ __html: `
      .lp-current-dashboard{width:min(620px,100%);height:404px;display:grid;grid-template-columns:126px minmax(0,1fr);overflow:hidden;border:1px solid #ebecef;border-radius:16px;color:#172541;background:#fff;box-shadow:0 18px 55px rgba(29,42,68,.14);font-family:var(--font-jakarta),'Plus Jakarta Sans',sans-serif}
      .lp-current-dashboard-sidebar{display:flex;flex-direction:column;padding:16px 10px 12px;border-right:1px solid #eceef2;background:#fff}
      .lp-current-dashboard-brand{display:flex;align-items:center;gap:6px;padding:0 5px 13px}.lp-current-dashboard-brand img{width:24px;height:24px;object-fit:contain}.lp-current-dashboard-brand strong{font-size:12px;letter-spacing:-.35px}.lp-current-dashboard-brand em{color:#f05d5e;font-style:normal}
      .lp-current-dashboard-nav{display:flex;flex-direction:column;gap:4px}.lp-current-dashboard-nav span{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:9px;color:#667086;font-size:8px;font-weight:700}.lp-current-dashboard-nav span.active{color:#ed5559;background:#fff1f0}
      .lp-current-dashboard-note{display:flex;flex-direction:column;gap:6px;margin-top:auto;padding:12px 9px;border-radius:11px;background:linear-gradient(145deg,#fff4ef,#fff0f1)}.lp-current-dashboard-note span{font-size:17px}.lp-current-dashboard-note strong{max-width:88px;font-size:7.5px;line-height:1.45}
      .lp-current-dashboard-main{min-width:0;padding:15px 14px;background:linear-gradient(180deg,#fff 0%,#fdfcfc 100%)}.lp-current-dashboard-main>header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px}.lp-current-dashboard-main>header>div{display:flex;flex-direction:column;gap:2px}.lp-current-dashboard-main>header strong{font-size:11px;letter-spacing:-.2px}.lp-current-dashboard-main>header small{color:#929aab;font-size:6.5px;font-weight:600}
      .lp-dashboard-whatsapp{padding:7px 10px;border-radius:8px;color:#fff;background:linear-gradient(135deg,#ff6968,#ef4d51);box-shadow:0 5px 13px rgba(239,77,81,.18);font-size:6.5px;font-weight:800;white-space:nowrap}
      .lp-dashboard-glance{padding:10px;border:1px solid #eceef2;border-radius:12px;background:#fff;box-shadow:0 5px 17px rgba(29,42,68,.04)}.lp-dashboard-section-label{display:block;margin-bottom:7px;font-size:8px}.lp-dashboard-glance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .lp-dashboard-glance-card{min-width:0;padding:8px;border:1px solid #edf0f4;border-radius:9px;background:#fff}.lp-dashboard-card-head{display:flex;align-items:center;gap:6px}.lp-dashboard-card-head>span{width:25px;height:25px;display:grid;flex:none;place-items:center;border-radius:50%;background:#fff1ef}.lp-dashboard-card-head>div{min-width:0}.lp-dashboard-card-head small{display:block;overflow:hidden;color:#667086;font-size:5px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.lp-dashboard-card-head strong{display:block;margin-top:2px;font-size:10px;line-height:1;white-space:nowrap}.lp-dashboard-card-head em{font-size:5px;font-style:normal}
      .lp-dashboard-card-detail{display:flex;justify-content:space-between;gap:4px;margin-top:8px;color:#8e97a8;font-size:5px;font-weight:700}.lp-dashboard-card-detail b{font-size:5px}.lp-dashboard-glance-card>i{height:3px;display:block;margin-top:5px;overflow:hidden;border-radius:9px;background:#edf0f3}.lp-dashboard-glance-card>i span{height:100%;display:block;border-radius:inherit;background:#ef5c62}
      .lp-dashboard-lower-grid{display:grid;grid-template-columns:.95fr 1.18fr;gap:8px;margin-top:8px}.lp-dashboard-family-prompt,.lp-dashboard-weekly{min-width:0;height:186px;overflow:hidden;border:1px solid #eceef2;border-radius:12px;background:#fff}
      .lp-dashboard-family-prompt{display:grid;grid-template-columns:43% minmax(0,1fr);align-items:end;padding:12px 9px 10px;background:linear-gradient(145deg,#fff7f3,#fffafa)}.lp-dashboard-family-art{align-self:end;height:112px;overflow:hidden}.lp-dashboard-family-art img{width:118%;height:auto;display:block;transform:translate(-8%,2px)}
      .lp-dashboard-family-prompt>div:last-child{align-self:center;min-width:0}.lp-dashboard-family-prompt small{display:inline-block;padding:3px 6px;border-radius:9px;color:#ef5c62;background:#fff;font-size:5px;font-weight:800}.lp-dashboard-family-prompt strong{display:block;margin-top:5px;font-size:9px;line-height:1.25}.lp-dashboard-family-prompt p{margin-top:5px;color:#768096;font-size:5.5px;font-weight:600;line-height:1.45}.lp-dashboard-family-prompt button{margin-top:7px;padding:6px 10px;border:0;border-radius:7px;color:#fff;background:#ef5c62;font-size:5.5px;font-weight:800}
      .lp-dashboard-weekly{padding:11px 10px 6px}.lp-dashboard-weekly-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.lp-dashboard-weekly-head>strong{font-size:8px}.lp-dashboard-weekly-head>span{display:flex;align-items:center;gap:4px;color:#7c8597;font-size:5px;font-weight:700}.lp-dashboard-weekly-head i{width:8px;height:2px;display:inline-block;border-radius:5px;background:#f58b44}.lp-dashboard-weekly svg{width:100%;height:135px;margin-top:4px}
    ` }} />
    <aside className="lp-current-dashboard-sidebar">
      <div className="lp-current-dashboard-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/famcare-logo.png" alt="" />
        <strong>Fam<em>Care</em></strong>
      </div>

      <div className="lp-current-dashboard-nav">
        <span className="active"><House size={12} weight="fill" /> Home</span>
        <span><TrendUp size={12} weight="bold" /> Statistics</span>
        <span><Users size={12} weight="bold" /> Family overview</span>
        <span><Bell size={12} weight="bold" /> Medications</span>
      </div>

      <div className="lp-current-dashboard-note">
        <span>🌱</span>
        <strong>Small steps, lasting change.</strong>
      </div>
    </aside>

    <div className="lp-current-dashboard-main">
      <header>
        <div>
          <strong>Good morning, Samarth 👋</strong>
          <small>Here&apos;s your family health overview.</small>
        </div>
        <span className="lp-dashboard-whatsapp">◉ Log via WhatsApp</span>
      </header>

      <section className="lp-dashboard-glance">
        <strong className="lp-dashboard-section-label">Today at a glance</strong>
        <div className="lp-dashboard-glance-grid">
          {[
            { className: "calories", icon: <Fire size={13} weight="fill" />, label: "Calories today", value: "1,580", unit: "kcal", detail: "Goal 2,000 kcal", progress: "79%" },
            { className: "protein", icon: <ForkKnife size={13} weight="fill" />, label: "Protein today", value: "86", unit: "g", detail: "Goal 100 g", progress: "86%" },
            { className: "medication", icon: <Bell size={13} weight="fill" />, label: "Medication", value: "On track", unit: "", detail: "2 of 3 taken", progress: "67%" },
            { className: "score", icon: <Heart size={13} weight="fill" />, label: "Health score", value: "78", unit: "/100", detail: "Good", progress: "78%" },
          ].map((item) => (
            <div className={`lp-dashboard-glance-card ${item.className}`} key={item.label}>
              <div className="lp-dashboard-card-head">
                <span>{item.icon}</span>
                <div><small>{item.label}</small><strong>{item.value} <em>{item.unit}</em></strong></div>
              </div>
              <div className="lp-dashboard-card-detail"><small>{item.detail}</small><b>{item.progress}</b></div>
              <i><span style={{ width: item.progress }} /></i>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-dashboard-lower-grid">
        <section className="lp-dashboard-family-prompt">
          <div className="lp-dashboard-family-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/parent_care_illustration.png" alt="" />
          </div>
          <div>
            <small>♥ Let&apos;s get started</small>
            <strong>Add your parents to start caring together</strong>
            <p>View their meals, progress, and medication updates in one place.</p>
            <button type="button">Add parents</button>
          </div>
        </section>

        <section className="lp-dashboard-weekly">
          <div className="lp-dashboard-weekly-head">
            <strong>Weekly progress</strong>
            <span><i /> Calories <i /> Protein</span>
          </div>
          <svg viewBox="0 0 300 112" role="img" aria-label="Weekly calories and protein trend">
            <defs>
              <linearGradient id="lp-calorie-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F58B44" stopOpacity=".18" />
                <stop offset="100%" stopColor="#F58B44" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[28, 54, 80].map((y) => <line key={y} x1="8" y1={y} x2="292" y2={y} stroke="#EEF0F4" strokeWidth="1" />)}
            <path d="M8 76 L54 57 L101 68 L148 42 L195 61 L242 33 L292 45 L292 98 L8 98 Z" fill="url(#lp-calorie-fill)" />
            <polyline points="8,76 54,57 101,68 148,42 195,61 242,33 292,45" fill="none" stroke="#F58B44" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="8,72 54,64 101,82 148,70 195,73 242,52 292,55" fill="none" stroke="#F25E63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
              <text key={day} x={8 + index * 47} y="108" fill="#9AA3B3" fontSize="7" textAnchor={index === 0 ? "start" : index === 6 ? "end" : "middle"}>{day}</text>
            ))}
          </svg>
        </section>
      </div>
    </div>
  </div>
);

const WhatsAppProofVisual = () => (
  <div
    className="lp-whatsapp-proof-visual"
    aria-label="Examples of a food log and medication reminder on WhatsApp"
    style={{
      position: "relative",
      width: 270,
      height: 330,
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: "58px 22px 48px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(64,191,112,.13) 0%, rgba(64,191,112,.04) 57%, transparent 72%)",
      }}
    />

    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/whats_app_circle.webp"
      alt=""
      style={{
        position: "absolute",
        width: 156,
        height: 156,
        objectFit: "contain",
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        filter: "drop-shadow(0 14px 24px rgba(44,169,89,.18))",
      }}
    />

    <div
      style={{
        position: "absolute",
        top: 2,
        left: 0,
        width: 168,
        padding: "8px 8px 7px",
        border: "1px solid #E5E9E7",
        borderRadius: 15,
        background: "#fff",
        boxShadow: "0 12px 28px rgba(31,49,67,.13)",
        transform: "rotate(-2deg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 19, height: 19, display: "grid", placeItems: "center", borderRadius: "50%", background: "#E8F8EE", fontSize: 10 }}>🥗</span>
        <strong style={{ color: "#23324B", fontSize: 9 }}>Food logged</strong>
        <span style={{ marginLeft: "auto", color: "#25A55F", fontSize: 8, fontWeight: 800 }}>WhatsApp</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 7.5, lineHeight: 1.35 }}>
        <span style={{ alignSelf: "flex-end", maxWidth: 137, padding: "7px 8px", borderRadius: "9px 9px 3px 9px", color: "#244434", background: "#DCF8C6" }}>
          Aaj 2 roti, dal, chawal khaya 💪
        </span>
        <span style={{ maxWidth: 139, padding: "7px 8px", borderRadius: "9px 9px 9px 3px", color: "#30405B", background: "#F5F6F7" }}>
          Logged! ✅<br />
          <strong>650 kcal · 28g protein</strong>
        </span>
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 177,
        padding: 10,
        border: "1px solid #E5E9E7",
        borderRadius: 15,
        background: "#fff",
        boxShadow: "0 12px 28px rgba(31,49,67,.13)",
        transform: "rotate(2deg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        <span style={{ width: 19, height: 19, display: "grid", placeItems: "center", borderRadius: "50%", background: "#FFF0EF", fontSize: 10 }}>💊</span>
        <strong style={{ color: "#23324B", fontSize: 9 }}>Medicine reminder</strong>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 8, lineHeight: 1.35 }}>
        <span style={{ maxWidth: 134, padding: "7px 8px", borderRadius: "9px 9px 9px 3px", color: "#30405B", background: "#F5F6F7" }}>
          Time for your 8:00 PM medicine 💊
        </span>
        <span style={{ alignSelf: "flex-end", padding: "6px 8px", borderRadius: "9px 9px 3px 9px", color: "#244434", background: "#DCF8C6" }}>
          Taken ✅
        </span>
        <span style={{ maxWidth: 138, padding: "7px 8px", borderRadius: "9px 9px 9px 3px", color: "#30405B", background: "#F5F6F7" }}>
          Great—your family is updated.
        </span>
      </div>
    </div>
  </div>
);

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (LOCAL_AUTH_BYPASS) {
      localStorage.setItem("auth_token", "local-dashboard-session");
      localStorage.setItem("auth_user", JSON.stringify({
        id: 1,
        phone: "+919999999999",
        name: "Local Test User",
        goal_steps: 8000,
        goal_protein_g: 90,
        goal_calories: 2100,
        goal_sleep_hours: 8,
        created_at: new Date().toISOString(),
      }));
      void resolvedAuthDestination("local-dashboard-session").then((destination) => {
        window.location.replace(destination);
      });
    }
  }, []);

  useEffect(() => {
    if (LOCAL_AUTH_BYPASS) return;
    let cancelled = false;

    async function resumeSavedSession() {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const authUser = await getCurrentUser(token);
        if (cancelled) return;

        if (!authUser) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          return;
        }

        localStorage.setItem("auth_user", JSON.stringify(authUser));
        const destination = await resolvedAuthDestination(token);
        router.replace(authUser.name ? destination : authPath("/onboarding/name", destination));
      } catch {
        // Preserve the saved session during temporary network/backend failures.
        // getCurrentUser returns null for an actual 401/403, handled above.
      }
    }

    resumeSavedSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (LOCAL_AUTH_BYPASS) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#fff", color: "#6B7A9A", fontSize: 14,
      }}>
        Opening dashboard…
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Nav */}
      <nav className="lp-nav" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 56px", height: 64, borderBottom: "1px solid #F5EEEE",
        background: "#fff", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <img src="/famcare-logo.png" alt="" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 10 }} />
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px" }}>
            Fam<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Care</em>
          </span>
        </div>
        <div className="lp-nav-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/login" style={{
            padding: "8px 20px", border: "1.5px solid #EDE6E6", borderRadius: 8,
            fontSize: 13.5, fontWeight: 600, color: "#1A2744", background: "#fff",
          }}>Log in</Link>
          <Link href="/login" style={{
            padding: "9px 20px", background: "#E85C5C", color: "#fff", border: "none",
            borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero" style={{
        display: "flex", alignItems: "center", padding: "48px 60px",
        gap: 28, overflow: "hidden", flex: 1,
      }}>
        {/* Left */}
        <div className="lp-hero-left" style={{ flex: "0 0 480px", position: "relative" }}>
          <svg style={{ position: "absolute", top: 100, right: -10, pointerEvents: "none", opacity: 0.09 }}
            width="200" height="180" viewBox="0 0 200 180" fill="none">
            <path d="M100 160C100 160 10 108 10 52C10 26 30 6 56 6C73 6 88 16 100 32C112 16 127 6 144 6C170 6 190 26 190 52C190 108 100 160 100 160Z" stroke="#E85C5C" strokeWidth="2.5" />
          </svg>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7, background: "#F0FFF6",
            color: "#239A50", fontSize: 12, fontWeight: 600, padding: "5px 13px",
            borderRadius: 20, marginBottom: 22,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22,4 12,14.01 9,11.01" />
            </svg>
            WhatsApp-first care for Indian families
          </div>

          <h1 className="lp-hero-title" style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-1.5px" }}>
            <span style={{ color: "#1A2744" }}>Stay close to your parents&apos; health,</span><br />
            <span style={{ color: "#E85C5C" }}>even from afar</span>
          </h1>

          <div className="lp-mobile-whatsapp-proof" style={{ display: "none" }}>
            <WhatsAppProofVisual />
          </div>

          <p style={{ fontSize: 15, color: "#6B7A9A", lineHeight: 1.78, marginTop: 18, maxWidth: 410 }}>
            Parents can log meals and confirm medicine reminders on WhatsApp, while you stay updated from anywhere.
          </p>

          <div className="lp-hero-cta" style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30 }}>
            <Link href="/login" style={{
              padding: "14px 30px", background: "#E85C5C", color: "#fff", border: "none",
              borderRadius: 8, fontSize: 15, fontWeight: 700,
              boxShadow: "0 4px 18px rgba(232,92,92,.32)",
            }}>Get Started for Free</Link>
          </div>

          <div className="lp-hero-badges" style={{ display: "flex", gap: 20, marginTop: 32 }}>
            {[
              { bg: "#EBF3FF", icon: <Lock size={13} weight="bold" color="#4A8FE2" />, title: "Private & Secure", desc: "Your data is always\nsafe with us" },
              { bg: "#E8F8EE", icon: <MapPin size={13} weight="bold" color="#3EB86A" />, title: "WhatsApp First", desc: "No new app for\nparents" },
              { bg: "#FFEDEC", icon: <Users size={13} weight="bold" color="#E85C5C" />, title: "For Caregivers", desc: "Track medicines\nas a family" },
            ].map((t) => (
              <div key={t.title} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: t.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 2,
                }}>{t.icon}</div>
                <div>
                  <strong style={{ fontSize: 12.5, fontWeight: 700, display: "block" }}>{t.title}</strong>
                  <span style={{ fontSize: 11, color: "#6B7A9A", display: "block", marginTop: 2, lineHeight: 1.4 }}>
                    {t.desc.split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center — WhatsApp circle */}
        <div className="lp-hero-circle" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <WhatsAppProofVisual />
        </div>

        {/* Right — mockup */}
        <div className="lp-hero-mockup" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CurrentDashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="lp-features-section" style={{ background: "#FFF8F7", padding: "52px 60px 60px" }}>
        <div style={{
          fontSize: 22, fontWeight: 700, textAlign: "center", color: "#1A2744",
          marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#E85C5C" strokeWidth="1.5">
            <path d="M10 17s-7-4.5-7-9a5 5 0 0 1 7-4.58A5 5 0 0 1 17 8c0 4.5-7 9-7 9z" />
          </svg>
          Everything families need to manage medicines
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#E85C5C" strokeWidth="1.5">
            <path d="M10 17s-7-4.5-7-9a5 5 0 0 1 7-4.58A5 5 0 0 1 17 8c0 4.5-7 9-7 9z" />
          </svg>
        </div>
        <div className="lp-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[
            { bg: "#E6F9EE", icon: <ChatDots size={22} weight="bold" color="#3EB86A" />, title: "WhatsApp Reminders", desc: "Send medicine reminders at the right dose time without another app." },
            { bg: "#FFEDEC", icon: <ChartBar size={22} weight="bold" color="#E85C5C" />, title: "Dose Confirmation", desc: "Parents can confirm when a medicine is taken so the family stays updated." },
            { bg: "#EBF3FF", icon: <FETarget size={22} />, title: "Missed-Dose Alerts", desc: "Caregivers can see when a dose is not confirmed on time." },
            { bg: "#FFF8E0", icon: <Trophy size={22} weight="bold" color="#F5A623" />, title: "Adherence Reports", desc: "See daily and weekly medicine adherence summaries for family members." },
            { bg: "#F0EEFF", icon: <Lock size={22} weight="bold" color="#7C6FF7" />, title: "Secure & Private", desc: "Family health data is handled carefully and never sold." },
          ].map((f) => (
            <div key={f.title} style={{
              background: "#fff", borderRadius: 14, padding: "20px 14px", textAlign: "center",
              boxShadow: "0 2px 12px rgba(26,20,20,.07)", border: "1px solid #F0E8E8",
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: "50%", background: f.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px",
              }}>{f.icon}</div>
              <h4 style={{ fontSize: 13, fontWeight: 700 }}>{f.title}</h4>
              <p style={{ fontSize: 11, color: "#6B7A9A", lineHeight: 1.65, marginTop: 5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Family section */}
      <section className="lp-family-section" style={{ padding: "60px 60px", background: "#fff" }}>
        <div className="lp-family-box" style={{
          display: "flex", alignItems: "center", gap: 56,
          background: "linear-gradient(135deg,#FFF5F3 0%,#FFE8E4 100%)",
          borderRadius: 24, padding: "48px 52px", overflow: "hidden", position: "relative",
        }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, background: "rgba(232,92,92,.06)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: -40, left: 380, width: 180, height: 180, background: "rgba(232,92,92,.04)", borderRadius: "50%" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7, background: "#FFEDEC",
              color: "#E85C5C", fontSize: 12, fontWeight: 600, padding: "5px 13px",
              borderRadius: 20, marginBottom: 18,
            }}>
              <Heart size={12} weight="bold" /> Built for Indian families
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-.5px", color: "#1A2744" }}>
              Health tracking that<br />
              <span style={{ color: "#E85C5C" }}>fits your parent&apos;s routine</span>
            </h2>
            <p style={{ fontSize: 15, color: "#6B7A9A", lineHeight: 1.75, marginTop: 16, maxWidth: 380 }}>
              Parents can use WhatsApp for reminders and confirmations, while caregivers get a simple dashboard for medicines, family health logs, and missed-dose updates.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
              {[
                { icon: <ChatDots size={16} weight="bold" color="#E85C5C" />, text: "Medicine reminders can reach parents on WhatsApp" },
                { icon: <UserCircle size={16} weight="bold" color="#E85C5C" />, text: "Children can manage medicines for active family members" },
                { icon: <ChartBar size={16} weight="bold" color="#E85C5C" />, text: "Daily dose status and adherence stay visible to caregivers" },
              ].map((item) => (
                <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(26,20,20,.08)", flexShrink: 0,
                  }}>{item.icon}</div>
                  <span style={{ fontSize: 14, color: "#4A5568", fontWeight: 500 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <Link href="/login" style={{
              display: "inline-block", marginTop: 32, padding: "13px 28px",
              background: "#E85C5C", color: "#fff", borderRadius: 8,
              fontSize: 14, fontWeight: 700, boxShadow: "0 4px 14px rgba(232,92,92,.3)",
            }}>Get Started Free →</Link>
          </div>

          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", position: "relative", zIndex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="lp-family-img"
              src="/family_walking.webp"
              alt="Family health"
              style={{
                width: 480, borderRadius: 20,
                boxShadow: "0 12px 48px rgba(26,20,20,.14)",
              }}
            />
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="lp-use-cases-section" style={{ padding: "0 60px 58px", background: "#fff" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 20 }}>
            <div>
              <p style={{ margin: 0, color: "#E85C5C", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                Use cases
              </p>
              <h2 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 700, color: "#1A2744", letterSpacing: "-.4px" }}>
                Built for real family care moments
              </h2>
            </div>
            <p style={{ margin: 0, maxWidth: 380, color: "#6B7A9A", fontSize: 13.5, lineHeight: 1.7 }}>
              Explore how FamCare helps with parent medicine reminders, WhatsApp confirmations, and elderly care coordination.
            </p>
          </div>
          <div className="lp-use-cases-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {useCases.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block", border: "1px solid #F0E8E8", borderRadius: 12,
                  padding: 20, background: "#FFFCFB", color: "#1A2744",
                  boxShadow: "0 2px 12px rgba(26,20,20,.05)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{item.title}</h3>
                <p style={{ margin: "8px 0 14px", color: "#6B7A9A", fontSize: 13, lineHeight: 1.65 }}>{item.desc}</p>
                <span style={{ color: "#E85C5C", fontSize: 13, fontWeight: 800 }}>Read more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "8px 60px 56px", background: "#fff" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, textAlign: "center", color: "#1A2744", letterSpacing: "-.4px" }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
            {[
              {
                question: "Can parents use FamCare without installing an app?",
                answer: "Yes. FamCare is designed around WhatsApp so parents can receive medicine reminders and confirm doses without learning a new app.",
              },
              {
                question: "Can children manage medicines for their parents?",
                answer: "Yes. Children or caregivers can add medicines for active family members, view today's schedule, and track whether doses were confirmed.",
              },
              {
                question: "Does FamCare replace a doctor or prescription?",
                answer: "No. FamCare is for reminders, tracking, and family coordination. Nutrition values are estimates, and you should always follow the doctor's prescription and medical advice.",
              },
            ].map((item) => (
              <div key={item.question} style={{ border: "1px solid #F0E8E8", borderRadius: 12, padding: "18px 20px", background: "#FFFCFB" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1A2744" }}>{item.question}</h3>
                <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#6B7A9A", lineHeight: 1.7 }}>{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bar */}
      <div className="lp-cta-bar" style={{
        background: "linear-gradient(135deg,#FFF0EE,#FFE4DE)",
        margin: "0 56px 56px", borderRadius: 16, padding: "22px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42, background: "#E85C5C", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 17.2C10 17.2 2.5 12.5 2.5 7.5A5 5 0 0 1 10 3.84 5 5 0 0 1 17.5 7.5C17.5 12.5 10 17.2 10 17.2Z" fill="white" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Start tracking your parent&apos;s medicines today</h3>
            <p style={{ fontSize: 12.5, color: "#6B7A9A", marginTop: 2 }}>Set reminders, confirm doses, and keep the family updated.</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/login" style={{
            padding: "12px 28px", background: "#E85C5C", color: "#fff", border: "none",
            borderRadius: 8, fontSize: 14, fontWeight: 700,
            boxShadow: "0 4px 14px rgba(232,92,92,.3)",
          }}>Get Started for Free</Link>
        </div>
      </div>

      {/* Footer */}
      <div className="lp-footer" style={{
        borderTop: "1px solid #F5EEEE", padding: "20px 56px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fff",
      }}>
        <span style={{ fontSize: 13, color: "#6B7A9A" }}>© 2026 FamCare (famcarehealth.com). All rights reserved.</span>
        <div className="lp-footer-links" style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
          {useCases.map((item) => (
            <Link key={item.href} href={item.href} style={{ fontSize: 13, color: "#6B7A9A", textDecoration: "none" }}>
              {item.title}
            </Link>
          ))}
          <Link href="/privacy" style={{ fontSize: 13, color: "#6B7A9A", textDecoration: "none" }}>Privacy Policy</Link>
          <a href={FAMCARE_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#6B7A9A", textDecoration: "none" }}>Contact</a>
        </div>
      </div>
    </div>
  );
}
