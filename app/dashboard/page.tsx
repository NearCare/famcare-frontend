"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  House, TrendUp, CalendarDots, MapPin, FileText,
  Lightning, Bell, Gear, CalendarBlank, CaretRight,
  Check, CheckCircle, Warning, X as PhX, List,
  Users, ChartBar, ClipboardText, Scroll, Sparkle, Target,
} from "@phosphor-icons/react";
import {
  FEDroplet, FEMoon, FESmile,
  FEShoe, FEMeat, FEWheat, FETarget, FEChat,
} from "./components/FluentEmoji";
import {
  getUserLogs,
  getUserSummary,
  getFamilyMembers,
  logsToWeeklySteps,
  type User,
  type HealthLog,
  type Summary,
  type FamilyMember,
} from "@/lib/api";
import EmptyState from "./components/EmptyState";
import AddFamilyModal from "./components/AddFamilyModal";
import FamilyMemberModal from "./components/FamilyMemberModal";

// ── Nav ───────────────────────────────────────────────────────────────────────

const navItems = [
  { label: "Home",             href: "/dashboard", active: true,  soon: false },
  { label: "Progress",         href: "#",          active: false, soon: true  },
  { label: "Appointments",     href: "#",          active: false, soon: true  },
  { label: "Nearby Providers", href: "#",          active: false, soon: true  },
  { label: "Health Records",   href: "#",          active: false, soon: true  },
  { label: "Activity",         href: "#",          active: false, soon: true  },
  { label: "Reminders",        href: "#",          active: false, soon: true  },
  { label: "Settings",         href: "#",          active: false, soon: true  },
];

const NAV_ICONS: Record<string, React.ElementType> = {
  "Home":             House,
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

// ── Charts ────────────────────────────────────────────────────────────────────

function StepsChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={164}>
      <LineChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#F0EEF0" strokeDasharray="3 3" />
        <XAxis dataKey="label" axisLine={false} tickLine={false}
          tick={{ fontSize: 11, fill: "#9AA0AD", fontFamily: "Plus Jakarta Sans" }} />
        <YAxis axisLine={false} tickLine={false}
          tick={{ fontSize: 10, fill: "#9AA0AD" }}
          tickFormatter={(v: number) => v >= 1000 ? v / 1000 + "k" : String(v)} />
        <ReTooltip
          cursor={{ stroke: "#FF6B6B", strokeWidth: 1, strokeDasharray: "4 3" }}
          contentStyle={{ background: "#fff", border: "1px solid #EDE6E6", borderRadius: 10, fontSize: 12, fontFamily: "Plus Jakarta Sans", boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }}
          labelStyle={{ color: "#9AA0AD", fontSize: 11, fontWeight: 600 }}
          itemStyle={{ color: "#FF6B6B", fontWeight: 700 }}
          formatter={(v) => [(Number(v) || 0).toLocaleString() + " steps", ""]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#FF6B6B"
          strokeWidth={2.5}
          dot={{ fill: "#FF6B6B", stroke: "#fff", strokeWidth: 2, r: 4 }}
          activeDot={{ fill: "#FF6B6B", stroke: "#fff", strokeWidth: 2, r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TripleDonut({ stepPct, proteinPct, carbsPct }: {
  stepPct: number; proteinPct: number; carbsPct: number;
}) {
  const size = 152;
  const cx = size / 2, cy = size / 2;
  const rings = [
    { r: 64, stroke: "#FF6B6B", track: "#FFE7E6", pct: stepPct },
    { r: 49, stroke: "#2FBE76", track: "#EAFBF0", pct: proteinPct },
    { r: 34, stroke: "#FF9F45", track: "#FFF4E8", pct: carbsPct },
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map(({ r, stroke, track, pct }) => {
        const c = 2 * Math.PI * r;
        const dash = (pct / 100) * c;
        return (
          <g key={r}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={10} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray .6s ease" }}
            />
          </g>
        );
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800"
        fill="#2C2F3A" fontFamily="Plus Jakarta Sans, sans-serif">
        {stepPct}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9"
        fill="#9AA0AD" fontFamily="Plus Jakarta Sans, sans-serif">
        step goal
      </text>
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skel({ w = "100%", h = 20, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F5EEEE 25%,#EFE8E8 50%,#F5EEEE 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const WA_LINK = "https://wa.me/14155238886";

const WaIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const CheckMark = () => <Check size={12} weight="bold" color="white" />;

// ── Dashboard page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFamilyCard, setShowFamilyCard] = useState(false);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem("family_card_dismissed");
    if (!dismissed) setShowFamilyCard(true);
  }, []);

  const dismissFamilyCard = () => {
    localStorage.setItem("family_card_dismissed", "1");
    setShowFamilyCard(false);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const stored = localStorage.getItem("auth_user");
        const authUser: User | null = stored ? JSON.parse(stored) : null;
        if (!authUser) { window.location.href = "/login"; return; }
        setUser(authUser);
        const token = localStorage.getItem("auth_token") ?? "";
        const [fetchedLogs, fetchedSummary, fetchedMembers] = await Promise.all([
          getUserLogs(authUser.id, 7),
          getUserSummary(authUser.id),
          getFamilyMembers(token).catch((err) => {
            if (err?.message === "Unauthorized") throw err;
            return [] as FamilyMember[];
          }),
        ]);
        setLogs(fetchedLogs);
        setSummary(fetchedSummary);
        setFamilyMembers(fetchedMembers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weeklySteps  = useMemo(() => logsToWeeklySteps(logs), [logs]);
  const avgSteps     = summary?.avg_steps ?? 0;
  const stepGoalPct  = Math.min(Math.round((avgSteps / 10000) * 100), 100);
  const todayIST     = new Date().toLocaleDateString("en-CA");
  const todayLog     = logs.find((l) => l.logged_at === todayIST);
  const todaySteps   = todayLog?.steps ?? 0;
  const todayStepPct = Math.min(Math.round((todaySteps / 10000) * 100), 100);
  const proteinAvg   = summary?.avg_protein_g ?? 0;
  const carbsAvg     = summary?.avg_carbs_g ?? 0;
  const proteinPct   = Math.min(Math.round((proteinAvg / 50) * 100), 100);
  const carbsPct     = Math.min(Math.round((carbsAvg / 200) * 100), 100);
  const goalHits     = summary?.step_goal_hits ?? 0;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main">
          <div style={{ marginBottom: 4 }}><Skel h={32} w={320} r={8} /></div>
          <div><Skel h={18} w={220} r={6} /></div>
          <div className="db-kpi-row" style={{ marginTop: 4 }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="db-kpi k-blue">
                <Skel h={30} w={30} r={10} />
                <div style={{ marginTop: 14 }}><Skel h={38} w={110} r={6} /></div>
                <div style={{ marginTop: 12 }}><Skel h={7} r={4} /></div>
                <div style={{ marginTop: 8 }}><Skel h={14} w={140} r={4} /></div>
              </div>
            ))}
          </div>
          <div className="db-grid">
            <Skel h={320} r={22} />
            <Skel h={320} r={22} />
            <Skel h={320} r={22} />
          </div>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#2C2F3A", marginBottom: 8 }}>Something went wrong</h3>
            <p style={{ fontSize: 14, color: "#5A5F6E", maxWidth: 340, lineHeight: 1.7 }}>
              We couldn&apos;t load your health data. Please try refreshing the page.
            </p>
            <button onClick={() => window.location.reload()}
              style={{ marginTop: 18, padding: "11px 28px", background: "#FF6B6B", color: "#fff", border: "none", borderRadius: 13, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!user || logs.length === 0) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main">
          <EmptyState userName={user?.name ?? undefined} />
        </div>
      </div>
    );
  }

  // ── Full dashboard ──────────────────────────────────────────────────────────
  const displayName  = user.name ?? "there";
  const avatarLetter = user.name
    ? user.name.charAt(0).toUpperCase()
    : user.phone.slice(-4, -3) || "U";

  // Dynamic AI insights based on real data
  const insights: { type: "good" | "warn"; text: React.ReactNode }[] = [];
  if (goalHits >= 5) {
    insights.push({ type: "good", text: <><b>Incredible week!</b> You hit your 10k step goal {goalHits} out of 7 days — that&apos;s elite consistency.</> });
  } else if (goalHits >= 3) {
    insights.push({ type: "good", text: <><b>{goalHits} days hit goal</b> this week. You&apos;re in great stride — push for one more tomorrow!</> });
  } else if (goalHits > 0) {
    insights.push({ type: "warn", text: <><b>Step goal hit {goalHits}×.</b> Aim for at least 3 days this week — even a 15-min walk counts.</> });
  }
  if (proteinAvg > 0 && proteinPct < 70) {
    insights.push({ type: "warn", text: <><b>Protein below target.</b> Averaging {proteinAvg.toFixed(0)}g vs 50g daily goal. Add eggs, dal, or nuts!</> });
  } else if (proteinAvg >= 50) {
    insights.push({ type: "good", text: <><b>Great protein intake!</b> {proteinAvg.toFixed(0)}g/day avg supports muscle recovery and energy.</> });
  }
  if (insights.length === 0) {
    insights.push({ type: "good", text: <><b>Dashboard is live!</b> Keep logging on WhatsApp and your trends will grow here.</> });
  }

  return (
    <div className="db-page">
      <Sidebar />

      <div className="db-main">
        {/* ── Topbar ── */}
        <div className="db-topbar">
          <div>
            <h1 className="db-greeting">{getGreeting()}, {displayName}! 👋</h1>
            <p className="db-subtitle">Here&apos;s your health overview for today.</p>
          </div>
          <div className="db-top-actions">
            <div className="db-pill">
              <CalendarBlank size={15} weight="bold" />
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="db-pill cta">
              <WaIcon size={15} />
              Log via WhatsApp
            </a>
            <div className="db-avatar">{avatarLetter}</div>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div className="db-kpi-row">
          <div className="db-kpi k-coral">
            <div className="db-kpi-top">
              <div className="db-kpi-ic" style={{ background: "#FFD5D5" }}><FEShoe size={20} /></div>
              <span className="db-kpi-label">Steps Today</span>
            </div>
            <div className="db-kpi-val">
              {todaySteps >= 1000
                ? <>{(todaySteps / 1000).toFixed(1)}<span className="unit">k</span></>
                : (todaySteps || "—")}
            </div>
            <div className="db-bar-track">
              <div className="db-bar-fill" style={{ width: `${todayStepPct}%`, background: "#FF6B6B" }} />
            </div>
            <div className="db-kpi-sub">{todayStepPct}% of 10,000 step goal</div>
          </div>

          <div className="db-kpi k-blue">
            <div className="db-kpi-top">
              <div className="db-kpi-ic" style={{ background: "#EAF4FF" }}><FEMeat size={20} /></div>
              <span className="db-kpi-label">Avg Protein</span>
            </div>
            <div className="db-kpi-val">
              {proteinAvg ? <>{proteinAvg.toFixed(0)}<span className="unit">g</span></> : "—"}
            </div>
            <div className="db-bar-track">
              <div className="db-bar-fill" style={{ width: `${proteinPct}%`, background: "#4F9BF5" }} />
            </div>
            <div className="db-kpi-sub">{proteinPct}% of 50g goal · 7-day avg</div>
          </div>

          <div className="db-kpi k-orange">
            <div className="db-kpi-top">
              <div className="db-kpi-ic" style={{ background: "#FFE9D2" }}><FEWheat size={20} /></div>
              <span className="db-kpi-label">Avg Carbs</span>
            </div>
            <div className="db-kpi-val">
              {carbsAvg ? <>{carbsAvg.toFixed(0)}<span className="unit">g</span></> : "—"}
            </div>
            <div className="db-bar-track">
              <div className="db-bar-fill" style={{ width: `${carbsPct}%`, background: "#FF9F45" }} />
            </div>
            <div className="db-kpi-sub">{carbsPct}% of 200g goal · 7-day avg</div>
          </div>

          <div className="db-kpi k-green">
            <div className="db-kpi-top">
              <div className="db-kpi-ic" style={{ background: "#D8F5E4" }}><FETarget size={20} /></div>
              <span className="db-kpi-label">Goal Hits</span>
            </div>
            <div className="db-kpi-val">
              {goalHits}<span className="unit">/ 7</span>
            </div>
            <div className="db-bar-track">
              <div className="db-bar-fill" style={{ width: `${(goalHits / 7) * 100}%`, background: "#2FBE76" }} />
            </div>
            <div className="db-kpi-sub">Days step goal hit this week</div>
          </div>
        </div>

        {/* ── Family card ── */}
        {showFamilyCard && (
          <div style={{
            position: "relative",
            background: "linear-gradient(135deg, #EEF0FF 0%, #F5F0FF 60%, #FFF0FA 100%)",
            border: "1.5px solid #DDD8FF",
            borderRadius: 22,
            padding: "28px 32px",
            display: "flex",
            alignItems: "center",
            gap: 28,
            overflow: "hidden",
          }}>
            {/* "Start here!" bubble */}
            <div style={{
              position: "absolute",
              top: 18,
              right: 24,
              background: "#7C6FF7",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              padding: "5px 14px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow: "0 3px 12px rgba(124,111,247,0.35)",
            }}>
              ✨ Start here!
            </div>

            {/* Illustration */}
            <div style={{
              fontSize: 68,
              lineHeight: 1,
              flexShrink: 0,
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.08))",
              userSelect: "none",
            }}>
              👨‍👩‍👦
            </div>

            {/* Text + actions */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#2C2F3A", margin: "0 0 6px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Health is better together!
              </h2>
              <p style={{ fontSize: 14, color: "#5A5F6E", margin: "0 0 20px", lineHeight: 1.6, maxWidth: 440 }}>
                Add your family members to track everyone&apos;s health, set goals together and keep each other motivated.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button style={{
                  background: "#7C6FF7",
                  color: "#fff",
                  border: "none",
                  borderRadius: 14,
                  padding: "11px 22px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  boxShadow: "0 4px 14px rgba(124,111,247,0.35)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                  onClick={() => setShowAddFamily(true)}
                >
                  <span style={{ fontSize: 16 }}>+</span> Add Family Member
                </button>
                <button
                  onClick={dismissFamilyCard}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "#9AA0AD", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Maybe Later
                </button>
              </div>
            </div>

            {/* Decorative blobs */}
            <div style={{
              position: "absolute",
              bottom: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: "rgba(124,111,247,0.08)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute",
              top: -20,
              left: 160,
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(124,111,247,0.06)",
              pointerEvents: "none",
            }} />
          </div>
        )}

        {/* ── 3-column grid ── */}
        <div className="db-grid">

          {/* Col 1 — Steps chart + WhatsApp CTA */}
          <div className="db-col">
            <div className="db-card db-card-pad">
              <div className="db-card-h">
                <div className="db-card-title"><ChartBar size={16} weight="bold" /> Steps Overview</div>
                <div className="db-mini-sel">This Week</div>
              </div>
              <div className="db-steps-big">
                {avgSteps ? avgSteps.toLocaleString() : "—"}
              </div>
              <div className="db-steps-avg">7-day average steps</div>
              {goalHits > 0 && (
                <div className="db-chip-up">
                  🎯 {goalHits} day{goalHits !== 1 ? "s" : ""} hit goal
                </div>
              )}
              <div style={{ position: "relative", height: 164, marginTop: 16 }}>
                <StepsChart data={weeklySteps} />
              </div>
            </div>

            <div className="db-card db-card-pad">
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="db-wa-btn">
                <div className="db-wa-ic"><WaIcon size={16} /></div>
                <span>Log today&apos;s health via WhatsApp</span>
                <CaretRight size={16} weight="bold" style={{ marginLeft: "auto", color: "#20A865", flexShrink: 0 }} />
              </a>
            </div>
          </div>

          {/* Col 2 — Today's log + Recent logs */}
          <div className="db-col">
            <div className="db-card db-card-pad">
              <div className="db-card-h" style={{ marginBottom: 4 }}>
                <div className="db-card-title"><ClipboardText size={16} weight="bold" /> Today&apos;s Log</div>
              </div>

              <div className="db-sum-row">
                <div className="db-sum-ic" style={{ background: "#FFE7E6" }}><FEShoe size={22} /></div>
                <span className="db-sum-label">Steps</span>
                <div className="db-sum-val">
                  {todaySteps ? todaySteps.toLocaleString() : "—"}
                  {todayStepPct >= 100 && (
                    <div className="db-check"><CheckMark /></div>
                  )}
                </div>
              </div>

              <div className="db-sum-row">
                <div className="db-sum-ic" style={{ background: "#EAF4FF" }}><FEMeat size={22} /></div>
                <span className="db-sum-label">Protein</span>
                <div className="db-sum-val">
                  {todayLog?.protein_g != null ? `${todayLog.protein_g.toFixed(0)}g` : "—"}
                  {todayLog?.protein_g != null && todayLog.protein_g >= 50 && (
                    <div className="db-check"><CheckMark /></div>
                  )}
                </div>
              </div>

              <div className="db-sum-row">
                <div className="db-sum-ic" style={{ background: "#FFF4E8" }}><FEWheat size={22} /></div>
                <span className="db-sum-label">Carbs</span>
                <div className="db-sum-val">
                  {todayLog?.carbs_g != null ? `${todayLog.carbs_g.toFixed(0)}g` : "—"}
                </div>
              </div>

              {todayLog?.raw_message && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "#F7F6F8", borderRadius: 12, fontSize: 12.5, color: "#5A5F6E", lineHeight: 1.45 }}>
                  💬 &ldquo;{todayLog.raw_message}&rdquo;
                </div>
              )}
            </div>

            <div className="db-card db-card-pad">
              <div className="db-card-h" style={{ marginBottom: 12 }}>
                <div className="db-card-title"><Scroll size={16} weight="bold" /> Recent Logs</div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#FF6B6B", background: "#FFF3F2", padding: "3px 9px", borderRadius: 20 }}>7 days</span>
              </div>
              {logs.slice(0, 4).map((log) => (
                <div key={log.id} className="db-log-row">
                  <div className="db-log-ic" style={{ background: "#FFF3F2", display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardText size={17} weight="bold" color="#FF8A7A" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>
                      {log.steps != null ? `${log.steps.toLocaleString()} steps` : "No steps logged"}
                    </div>
                    <div style={{ fontSize: 11, color: "#9AA0AD", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.raw_message ?? (
                        [
                          log.protein_g != null ? `protein ${log.protein_g.toFixed(0)}g` : null,
                          log.carbs_g != null ? `carbs ${log.carbs_g.toFixed(0)}g` : null,
                        ].filter(Boolean).join(" · ") || "No details"
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#9AA0AD" }}>
                      {new Date(log.logged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                    <div style={{ marginTop: 3, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#EAFBF0", color: "#20A865", display: "inline-block" }}>
                      Logged
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Col 3 — Activity donut + AI insights */}
          <div className="db-col">
            <div className="db-card db-card-pad">
              <div className="db-card-h" style={{ marginBottom: 8 }}>
                <div className="db-card-title"><Target size={16} weight="bold" /> Activity</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                <TripleDonut stepPct={stepGoalPct} proteinPct={proteinPct} carbsPct={carbsPct} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
                {([
                  { color: "#FF6B6B", label: "Steps",   val: `${avgSteps ? avgSteps.toLocaleString() : "—"} / 10k` },
                  { color: "#2FBE76", label: "Protein", val: `${proteinAvg ? proteinAvg.toFixed(0) : "—"}g / 50g` },
                  { color: "#FF9F45", label: "Carbs",   val: `${carbsAvg ? carbsAvg.toFixed(0) : "—"}g / 200g` },
                ] as const).map((row) => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#5A5F6E" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />
                      {row.label}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>{row.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="db-card db-card-pad">
              <div className="db-card-h" style={{ marginBottom: 12 }}>
                <div className="db-card-title"><Sparkle size={16} weight="bold" /> AI Insights</div>
              </div>
              {insights.slice(0, 2).map((ins, i) => (
                <div key={i} className={`db-ai-card ${ins.type}`}>
                  <div className="db-ai-dot">
                    {ins.type === "good"
                      ? <CheckCircle size={14} weight="bold" color="white" />
                      : <Warning size={14} weight="bold" color="white" />}
                  </div>
                  <p>{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Wellness widgets ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
          <div className="db-widget w-water">
            <div className="db-w-emoji"><FEDroplet size={34} /></div>
            <div>
              <div className="db-w-label">Water Intake</div>
              <div className="db-w-val">—<span className="unit"> L</span></div>
              <div className="db-w-tag">Coming soon</div>
            </div>
            <div className="db-w-art">🌊</div>
          </div>
          <div className="db-widget w-sleep">
            <div className="db-w-emoji"><FEMoon size={34} /></div>
            <div>
              <div className="db-w-label">Sleep</div>
              <div className="db-w-val">—<span className="unit"> hrs</span></div>
              <div className="db-w-tag">Coming soon</div>
            </div>
            <div className="db-w-art">🌙</div>
          </div>
          <div className="db-widget w-mood">
            <div className="db-w-emoji"><FESmile size={34} /></div>
            <div>
              <div className="db-w-label">Mood</div>
              <div className="db-w-val">—</div>
              <div className="db-w-tag">Coming soon</div>
            </div>
            <div className="db-w-art">⭐</div>
          </div>
        </div>

        {/* ── Family members ── */}
        {familyMembers.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2C2F3A", margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 7 }}>
                <Users size={17} weight="bold" color="#7C6FF7" /> Family &amp; Friends
              </h2>
              <button
                onClick={() => setShowAddFamily(true)}
                style={{ background: "#F0EEFF", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, color: "#7C6FF7", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                + Add
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {familyMembers.map(member => {
                const isPending = member.status === "pending";
                const accentColor = member.type === "family" ? "#7C6FF7" : "#FF9F45";
                const accentBg    = member.type === "family" ? "#F0EEFF"  : "#FFF4E8";
                return (
                  <button
                    key={member.id}
                    onClick={() => !isPending && setSelectedMember(member)}
                    style={{
                      background: isPending ? "#FAFAFA" : "#fff",
                      border: `1.5px solid ${isPending ? "#E8E4F5" : "#EDE8FF"}`,
                      borderRadius: 16, padding: "16px 14px",
                      cursor: isPending ? "default" : "pointer",
                      textAlign: "left", opacity: isPending ? 0.8 : 1,
                      transition: "box-shadow .2s, border-color .2s",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                    onMouseEnter={e => { if (!isPending) { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(124,111,247,0.15)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#C4B8FF"; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; (e.currentTarget as HTMLButtonElement).style.borderColor = isPending ? "#E8E4F5" : "#EDE8FF"; }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: accentBg, color: accentColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, fontWeight: 800, marginBottom: 10,
                      filter: isPending ? "grayscale(0.4)" : "none",
                    }}>
                      {(member.name ?? member.label).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 2 }}>
                      {member.name ?? member.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#9AA0AD" }}>{member.label}</div>
                    <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, display: "inline-block",
                      color: isPending ? "#9AA0AD" : accentColor,
                      background: isPending ? "#F0EEF5" : accentBg,
                    }}>
                      {isPending ? "⏳ Awaiting YES" : member.type}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bottom banner ── */}
        <div className="db-banner">
          <div className="db-banner-ic" style={{ display: "grid", placeItems: "center" }}><FEChat size={30} /></div>
          <div>
            <h3>Track your health in seconds</h3>
            <p>Send a WhatsApp message with steps, meals, or any update — your dashboard fills in automatically.</p>
          </div>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            className="db-pill cta"
            style={{ marginLeft: "auto", height: 46, padding: "0 22px", fontSize: 14, flexShrink: 0 }}>
            <WaIcon size={16} />
            Open WhatsApp
          </a>
        </div>

        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <Link href="/" style={{ fontSize: 12, color: "#9AA0AD", fontWeight: 500 }}>← Back to home</Link>
        </div>
      </div>

      {showAddFamily && (
        <AddFamilyModal
          onClose={() => setShowAddFamily(false)}
          onAdded={(member) => setFamilyMembers(prev => [member, ...prev.filter(m => m.id !== member.id)])}
        />
      )}

      {selectedMember && (
        <FamilyMemberModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="db-mobile-topbar">
        <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Near<span style={{ color: "#FF6B6B" }}>Care</span>
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
          <span className="db-brand-name">Near<span className="care">Care</span></span>
        </div>

        <nav className="db-nav">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.soon ? undefined : item.href}
              onClick={item.soon
                ? (e) => e.preventDefault()
                : () => setMobileOpen(false)}
              className={`db-nav-item${item.active ? " active" : ""}${item.soon ? " soon" : ""}`}
            >
              <NavIcon name={item.label} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.soon && <span className="db-soon-badge">Soon</span>}
            </a>
          ))}
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
