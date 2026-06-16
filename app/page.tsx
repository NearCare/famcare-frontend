"use client";
import Link from "next/link";
import {
  House, TrendUp, ForkKnife, Lightning, ClipboardText, Trophy,
  Bell, Gear, CalendarBlank, Fire, Lock, MapPin, Users,
  ChatDots, ChartBar, Target, Heart, UserCircle,
} from "@phosphor-icons/react";
import { FEShoe, FETarget } from "./dashboard/components/FluentEmoji";

const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <path d="M10 17.2C10 17.2 2.5 12.5 2.5 7.5A5 5 0 0 1 10 3.84 5 5 0 0 1 17.5 7.5C17.5 12.5 10 17.2 10 17.2Z" fill="white" />
    <circle cx="10" cy="7.5" r="1.8" fill="#E85C5C" />
  </svg>
);

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
        <div style={{
          width: 22, height: 22, background: "#E85C5C", borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <path d="M10 17.2C10 17.2 2.5 12.5 2.5 7.5A5 5 0 0 1 10 3.84 5 5 0 0 1 17.5 7.5C17.5 12.5 10 17.2 10 17.2Z" fill="white" />
          </svg>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700 }}>Health<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Ease</em></span>
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
            { icon: <Fire size={18} weight="bold" color="#F5A623" />, label: "Calories Burned", color: "#F5A623", val: "1,650", sub: "Today", pct: 83, colorClass: "o" },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: stat.blue ? "linear-gradient(145deg,#EBF3FF,#D4E8FF)" : "#fff",
              border: stat.blue ? "none" : "1px solid #F0E8E8",
              borderRadius: 9, padding: "9px 10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ display: "flex", alignItems: "center" }}>{stat.icon}</div>
                <div>
                  <div style={{ fontSize: 7.5, fontWeight: 600, color: stat.color }}>{stat.label}</div>
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
                { color: "#E85C5C", label: "Calories", val: "1,650 / 2,000" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#6B7A9A" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: row.color }}></div>
                    {row.label}
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

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 56px", height: 64, borderBottom: "1px solid #F5EEEE",
        background: "#fff", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 36, height: 36, background: "#E85C5C", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <HeartIcon />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px" }}>
            Health<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Ease</em>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
      <section style={{
        display: "flex", alignItems: "center", padding: "48px 60px",
        gap: 28, overflow: "hidden", flex: 1,
      }}>
        {/* Left */}
        <div style={{ flex: "0 0 480px", position: "relative" }}>
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
            Trusted by 10,000+ families
          </div>

          <h1 style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-1.5px" }}>
            <span style={{ color: "#1A2744" }}>Simple. Smart.</span><br />
            <span style={{ color: "#E85C5C" }}>Better Health,<br />Every Day.</span>
          </h1>

          <p style={{ fontSize: 15, color: "#6B7A9A", lineHeight: 1.78, marginTop: 18, maxWidth: 390 }}>
            Track appointments, steps and daily wellness habits. See your progress in beautiful charts and stay motivated together as a family.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30 }}>
            <Link href="/login" style={{
              padding: "14px 30px", background: "#E85C5C", color: "#fff", border: "none",
              borderRadius: 8, fontSize: 15, fontWeight: 700,
              boxShadow: "0 4px 18px rgba(232,92,92,.32)",
            }}>Get Started for Free</Link>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              style={{
                display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
                fontSize: 14, fontWeight: 600, color: "#6B7A9A", cursor: "pointer",
              }}>
              <div style={{
                width: 32, height: 32, background: "#fff", borderRadius: "50%",
                boxShadow: "0 2px 12px rgba(26,20,20,.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="9" height="11" viewBox="0 0 10 12" fill="none">
                  <path d="M1 1l8 5-8 5V1z" fill="#1A2744" />
                </svg>
              </div>
              See how it works
            </button>
          </div>

          <div style={{ display: "flex", gap: 20, marginTop: 32 }}>
            {[
              { bg: "#EBF3FF", icon: <Lock size={13} weight="bold" color="#4A8FE2" />, title: "Private & Secure", desc: "Your data is always\nsafe with us" },
              { bg: "#E8F8EE", icon: <MapPin size={13} weight="bold" color="#3EB86A" />, title: "Nearby Providers", desc: "Find clinics and\ndoctors near you" },
              { bg: "#FFEDEC", icon: <Users size={13} weight="bold" color="#E85C5C" />, title: "For the Whole Family", desc: "Healthy habits,\ntogether" },
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/whats_app_circle.png" alt="Log health via WhatsApp" style={{ width: 280, height: 280, objectFit: "contain" }} />
        </div>

        {/* Right — mockup */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DashboardMockup />
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ background: "#FFF8F7", padding: "52px 60px 60px" }}>
        <div style={{
          fontSize: 22, fontWeight: 700, textAlign: "center", color: "#1A2744",
          marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#E85C5C" strokeWidth="1.5">
            <path d="M10 17s-7-4.5-7-9a5 5 0 0 1 7-4.58A5 5 0 0 1 17 8c0 4.5-7 9-7 9z" />
          </svg>
          Everything you need to build healthy habits
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#E85C5C" strokeWidth="1.5">
            <path d="M10 17s-7-4.5-7-9a5 5 0 0 1 7-4.58A5 5 0 0 1 17 8c0 4.5-7 9-7 9z" />
          </svg>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[
            { bg: "#E6F9EE", icon: <ChatDots size={22} weight="bold" color="#3EB86A" />, title: "Track Health", desc: "Log vitals, steps and appointments easily from anywhere, anytime." },
            { bg: "#FFEDEC", icon: <ChartBar size={22} weight="bold" color="#E85C5C" />, title: "Beautiful Insights", desc: "Visualize your progress with easy-to-understand charts and summaries." },
            { bg: "#EBF3FF", icon: <FETarget size={22} />, title: "Set Goals", desc: "Set daily goals for steps, meals and activity. We'll help you stay on track." },
            { bg: "#FFF8E0", icon: <Trophy size={22} weight="bold" color="#F5A623" />, title: "Celebrate Progress", desc: "Earn achievements and stay motivated every step of the way." },
            { bg: "#F0EEFF", icon: <Lock size={22} weight="bold" color="#7C6FF7" />, title: "Secure & Private", desc: "Your data is encrypted and never shared with anyone." },
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
      <section style={{ padding: "60px 60px", background: "#fff" }}>
        <div style={{
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
              <span style={{ color: "#E85C5C" }}>fits your family&apos;s life</span>
            </h2>
            <p style={{ fontSize: 15, color: "#6B7A9A", lineHeight: 1.75, marginTop: 16, maxWidth: 380 }}>
              No app to download. No form to fill. Just send a casual message on WhatsApp — in Hindi or English — and we&apos;ll take care of the rest.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
              {[
                { icon: <ChatDots size={16} weight="bold" color="#E85C5C" />, text: "Works in Hindi, English or both mixed" },
                { icon: <UserCircle size={16} weight="bold" color="#E85C5C" />, text: "Designed for parents who don't use apps" },
                { icon: <ChartBar size={16} weight="bold" color="#E85C5C" />, text: "You see the dashboard, they just WhatsApp" },
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
              src="/family_walking.png"
              alt="Family health"
              style={{
                width: 480, borderRadius: 20,
                boxShadow: "0 12px 48px rgba(26,20,20,.14)",
              }}
            />
          </div>
        </div>
      </section>

      {/* CTA bar */}
      <div style={{
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
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Start your health journey today!</h3>
            <p style={{ fontSize: 12.5, color: "#6B7A9A", marginTop: 2 }}>It&apos;s free, simple and it works.</p>
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
      <div style={{
        borderTop: "1px solid #F5EEEE", padding: "20px 56px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fff",
      }}>
        <span style={{ fontSize: 13, color: "#6B7A9A" }}>© 2026 NearCare. All rights reserved.</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/privacy" style={{ fontSize: 13, color: "#6B7A9A", textDecoration: "none" }}>Privacy Policy</Link>
          <a href="https://wa.me/14155238886" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#6B7A9A", textDecoration: "none" }}>Contact</a>
        </div>
      </div>
    </div>
  );
}
