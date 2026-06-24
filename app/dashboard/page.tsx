"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle, Warning, Sparkle, CaretRight, Info, TrendUp, Minus, X,
  Star, CalendarBlank, CalendarCheck, Trophy, SignOut, UserPlus,
} from "@phosphor-icons/react";
import { Flame, Dumbbell, Footprints } from "lucide-react";
import { FEShoe, FEMeat, FEWheat, FEDroplet, FEMoon, FEFlame, FEChat } from "./components/FluentEmoji";
import {
  getUserLogs,
  getUserSummary,
  getFamilyMembers,
  getMemberSummary,
  logsToWeeklyMetric,
  calculateStreak,
  type User,
  type HealthLog,
  type Summary,
  type FamilyMember,
} from "@/lib/api";
import { scoreTier, computeScore, scoreFromAverages, ScoreRing } from "./components/Score";
import EmptyState from "./components/EmptyState";
import Sidebar from "./components/Sidebar";
import FamilyMemberModal from "./components/FamilyMemberModal";
import AddFamilyModal from "./components/AddFamilyModal";

/** Averages raw logs falling within [minDaysAgo, maxDaysAgo] of today — used to compare this week vs last week. */
function rangeAverages(logs: HealthLog[], minDaysAgo: number, maxDaysAgo: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inRange = logs.filter((l) => {
    const d = new Date(`${l.logged_at}T00:00:00`);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    return diff >= minDaysAgo && diff <= maxDaysAgo;
  });
  if (inRange.length === 0) return null;
  const avg = (key: "steps" | "protein_g" | "calories") =>
    inRange.reduce((sum, l) => sum + (l[key] ?? 0), 0) / inRange.length;
  return { steps: avg("steps"), protein: avg("protein_g"), calories: avg("calories") };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 68, h = 20;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricTile({
  icon, label, color, deepColor, chipBg, stripBg, value, unit, goalText, pct, deltaDown, deltaText, sparkline,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  deepColor: string;
  chipBg: string;
  stripBg: string;
  value: React.ReactNode;
  unit?: string;
  goalText: string;
  pct: number;
  deltaDown: boolean;
  deltaText: string;
  sparkline: number[];
}) {
  return (
    <div className="db-card fo-metric-tile" style={{ display: "flex", flexDirection: "column", padding: "13px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: chipBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: deepColor }}>{label}</span>
        </div>
        <CaretRight size={13} color="#BFC4CE" />
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#1A2744", letterSpacing: "-.5px" }}>{value}</span>
        {unit && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9AA0AD", marginLeft: 3 }}>{unit}</span>}
      </div>
      <p style={{ margin: "1px 0 0", fontSize: 10.5, color: "#9AA0AD", fontWeight: 500 }}>{goalText}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7 }}>
        <div className="db-bar-track" style={{ flex: 1, margin: 0, height: 5 }}>
          <div className="db-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{pct}%</span>
      </div>

      <div style={{
        marginTop: 8, background: stripBg, borderRadius: 10, padding: "6px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: deepColor }}>
          <TrendUp size={12} weight="bold" style={deltaDown ? { transform: "rotate(180deg)" } : undefined} />
          {deltaText}
        </span>
        <Sparkline data={sparkline} color={color} />
      </div>
    </div>
  );
}

function DashboardLoadingScreen() {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const step = p < 50 ? 4 : p < 75 ? 2 : 1;
        return Math.min(p + step, 92);
      });
    }, 180);
    return () => clearInterval(id);
  }, []);

  const orbitIcons = [
    { icon: <FEShoe size={24} />, bg: "#EAFBF0", style: { top: 4, left: 6 } },
    { icon: <FEDroplet size={24} />, bg: "#EAF4FF", style: { top: 4, right: 6 } },
    { icon: <FEFlame size={24} />, bg: "#FFF1E6", style: { bottom: 4, left: 6 } },
    { icon: <FEMoon size={24} />, bg: "#F0EEFF", style: { bottom: 4, right: 6 } },
  ];

  return (
    <div style={{ textAlign: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "relative", width: 220, height: 200, margin: "0 auto" }}>
        <svg width="220" height="200" style={{ position: "absolute", inset: 0 }} viewBox="0 0 220 200">
          <line x1="58" y1="38" x2="98" y2="88" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
          <line x1="162" y1="38" x2="122" y2="88" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
          <line x1="58" y1="162" x2="98" y2="112" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
          <line x1="162" y1="162" x2="122" y2="112" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
        </svg>

        {orbitIcons.map((o, i) => (
          <div key={i} style={{
            position: "absolute", ...o.style,
            width: 50, height: 50, borderRadius: "50%", background: o.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,.06)",
          }}>
            {o.icon}
          </div>
        ))}

        <span style={{ position: "absolute", top: 34, left: 4, fontSize: 13, color: "#FF9F45", animation: "dbSparkle 1.8s ease-in-out infinite" }}>✦</span>
        <span style={{ position: "absolute", top: 34, right: 4, fontSize: 13, color: "#7C6FF7", animation: "dbSparkle 1.8s ease-in-out infinite .4s" }}>✦</span>

        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 84, height: 84, borderRadius: "50%",
          background: "linear-gradient(150deg, #FF8A7A, #E85C5C)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 10px 26px rgba(232,92,92,.35)",
          animation: "dbHeartBeat 1.4s ease-in-out infinite",
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2.2 0 3.7 1.2 4.6 2.5.3.4.9.4 1.2 0C12.7 5.2 14.2 4 16.4 4c4 0 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" fill="white" opacity=".22" />
            <path d="M2 12h4l2-5 3 9 2-6 1.5 2H22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </div>

      <h2 style={{ marginTop: 24, fontSize: 21, fontWeight: 800, color: "#2C2F3A" }}>
        Loading your health dashboard…
      </h2>
      <p style={{ marginTop: 6, fontSize: 13.5, color: "#9AA0AD" }}>
        We&apos;re preparing your insights and latest updates.
      </p>

      <div style={{ marginTop: 22, width: 280, marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ height: 8, borderRadius: 8, background: "#F0EEEF", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 8, width: `${progress}%`,
            background: "linear-gradient(90deg, #FF6B6B, #FF9F45)",
            transition: "width .25s ease",
          }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: "#E85C5C" }}>{progress}%</div>
      </div>
    </div>
  );
}

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

const RANK_PALETTE = [
  { bg: "var(--he-green-bg)", accent: "var(--he-green)", text: "var(--he-green-deep)", caption: "Great job!" },
  { bg: "var(--he-blue-bg)", accent: "var(--he-blue)", text: "var(--he-blue-deep)", caption: "Doing well!" },
  { bg: "var(--he-orange-bg)", accent: "var(--he-orange)", text: "var(--he-orange-deep)", caption: "Keep it up!" },
  { bg: "var(--he-violet-bg)", accent: "#8B7FE8", text: "#6A5BD0", caption: "Room to improve" },
];

type MemberRow = { member: FamilyMember; summary: Summary | null };

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFamilyCard, setShowFamilyCard] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem("family_card_dismissed");
    if (!dismissed) setShowFamilyCard(true);
  }, []);

  useEffect(() => {
    if (!showAccountMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountMenu]);

  const dismissFamilyCard = () => {
    localStorage.setItem("family_card_dismissed", "1");
    setShowFamilyCard(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const stored = localStorage.getItem("auth_user");
      const authUser: User | null = stored ? JSON.parse(stored) : null;
      if (!authUser) { window.location.href = "/login"; return; }
      if (!authUser.name) { window.location.href = "/onboarding/name"; return; }
      setUser(authUser);
      const token = localStorage.getItem("auth_token") ?? "";
      const [fetchedLogs, fetchedSummary, members] = await Promise.all([
        getUserLogs(authUser.id, 30),
        getUserSummary(authUser.id),
        getFamilyMembers(token).catch((err) => {
          if (err?.message === "Unauthorized") throw err;
          return [] as FamilyMember[];
        }),
      ]);
      setLogs(fetchedLogs);
      setSummary(fetchedSummary);

      const activeMembers = members.filter((m) => m.status === "active");
      const rows = await Promise.all(
        activeMembers.map(async (member) => ({
          member,
          summary: await getMemberSummary(member.id, token).catch(() => null),
        }))
      );
      setMemberRows(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadDashboard();
    })();
  }, [loadDashboard]);

  const weeklySteps = useMemo(() => logsToWeeklyMetric(logs, "steps"), [logs]);
  const streak = useMemo(() => calculateStreak(logs), [logs]);
  const proteinSeries = useMemo(() => logsToWeeklyMetric(logs, "protein_g").map((d) => d.value), [logs]);
  const caloriesSeries = useMemo(() => logsToWeeklyMetric(logs, "calories").map((d) => d.value), [logs]);
  const stepsSeries = useMemo(() => weeklySteps.map((d) => d.value), [weeklySteps]);
  const hasData = !!summary?.last_logged;
  const proteinAvg = summary?.avg_protein_g ?? 0;
  const caloriesAvg = summary?.avg_calories ?? 0;
  const stepsAvg = summary?.avg_steps ?? 0;
  const proteinPct = Math.min(Math.round((proteinAvg / 50) * 100), 100);
  const caloriesPct = Math.min(Math.round((caloriesAvg / 2000) * 100), 100);
  const stepsAvgPct = Math.min(Math.round((stepsAvg / 10000) * 100), 100);

  const todayIST = new Date().toLocaleDateString("en-CA");
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIST = yesterdayDate.toLocaleDateString("en-CA");
  const todaySteps = logs.find((l) => l.logged_at === todayIST)?.steps ?? 0;
  const yesterdaySteps = logs.find((l) => l.logged_at === yesterdayIST)?.steps ?? 0;
  const stepsTodayPct = Math.min(Math.round((todaySteps / 10000) * 100), 100);
  const stepsVsYesterday = todaySteps - yesterdaySteps;

  const stepsPts = hasData ? Math.round(stepsAvgPct * 0.4) : 0;
  const proteinPts = hasData ? Math.round(proteinPct * 0.3) : 0;
  const caloriesPts = hasData ? Math.round(caloriesPct * 0.3) : 0;
  const personalScore = hasData ? stepsPts + proteinPts + caloriesPts : null;
  const personalTier = scoreTier(personalScore);

  const rankedFamily = useMemo(() => {
    const rows = [
      { id: user?.id ?? 0, name: user?.name ?? "You", score: personalScore, isYou: true },
      ...memberRows.map(({ member, summary: memberSummary }) => ({
        id: member.id,
        name: member.name ?? member.label,
        score: computeScore(memberSummary),
        isYou: false,
      })),
    ];
    return rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [user, personalScore, memberRows]);

  const prevWeekAvgs = useMemo(() => rangeAverages(logs, 7, 13), [logs]);
  const prevWeekScore = prevWeekAvgs ? scoreFromAverages(prevWeekAvgs.steps, prevWeekAvgs.protein, prevWeekAvgs.calories) : null;
  const scoreDelta = personalScore !== null && prevWeekScore !== null ? personalScore - prevWeekScore : null;
  const proteinDeltaPct = prevWeekAvgs && prevWeekAvgs.protein > 0
    ? Math.round(((proteinAvg - prevWeekAvgs.protein) / prevWeekAvgs.protein) * 100)
    : null;
  const caloriesDeltaAbs = prevWeekAvgs ? Math.round(caloriesAvg - prevWeekAvgs.calories) : null;

  const daysLoggedThisWeek = useMemo(() => {
    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("en-CA");
    });
    return last7Dates.filter((date) => logs.some((l) => l.logged_at === date)).length;
  }, [logs]);
  const consistencyMessage = daysLoggedThisWeek === 7
    ? "Amazing consistency! 🎉"
    : daysLoggedThisWeek >= 5
    ? "Great job staying consistent!"
    : daysLoggedThisWeek >= 1
    ? "Keep logging to build your streak."
    : "Start logging today to see your trends.";

  const daysGoalMet = weeklySteps.filter((d) => d.value >= 10000).length;
  const bestDay = weeklySteps.reduce((best, d) => (d.value > best.value ? d : best), weeklySteps[0] ?? { label: "—", value: 0 });
  const weeklyCalorieTotal = Math.round(caloriesAvg * 7);

  const weeklyInsights: { icon: React.ReactNode; text: string }[] = [];
  if (daysGoalMet > 0) {
    weeklyInsights.push({ icon: <TrendUp size={15} weight="bold" color="var(--he-green-deep)" />, text: `Great job! You hit your step goal ${daysGoalMet} of 7 days.` });
  }
  if (proteinDeltaPct !== null && proteinDeltaPct !== 0) {
    weeklyInsights.push({ icon: <FEMeat size={15} />, text: `Protein intake ${proteinDeltaPct > 0 ? "improved" : "dropped"} by ${Math.abs(proteinDeltaPct)}% this week.` });
  }
  if (weeklyCalorieTotal > 0) {
    weeklyInsights.push({ icon: <FEFlame size={15} />, text: `You logged ~${weeklyCalorieTotal.toLocaleString()} kcal this week.` });
  }
  weeklyInsights.push({ icon: <FEDroplet size={15} />, text: "Water & sleep tracking is coming soon." });
  if (weeklyInsights.length === 1) {
    weeklyInsights.unshift({ icon: <Warning size={15} weight="bold" color="var(--he-orange-deep)" />, text: "No health data logged yet this week." });
  }

  const motivCopy = personalTier.label === "All good"
    ? { title: "Keep it up!", message: "You're doing great this week. Stay consistent and crush your goals!" }
    : personalTier.label === "Needs attention"
    ? { title: "Almost there!", message: "A few small tweaks this week could make a big difference." }
    : personalTier.label === "Action required"
    ? { title: "Let's turn it around", message: "Send a quick WhatsApp update today to get back on track." }
    : { title: "Get started!", message: "Send your first WhatsApp update to start tracking your health." };

  if (loading) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DashboardLoadingScreen />
        </div>
      </div>
    );
  }

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

  const displayName = user.name ?? "there";
  const avatarLetter = user.name
    ? user.name.charAt(0).toUpperCase()
    : user.phone.slice(-4, -3) || "U";

  return (
    <div className="db-page">
      <Sidebar />

      <div className="db-main">
        <div className="db-topbar">
          <div>
            <h1 className="db-greeting">{getGreeting()}, {displayName}! 👋</h1>
            <p className="db-subtitle">Here&apos;s your health overview for today.</p>
          </div>
          <div className="db-top-actions">
            <div className="db-pill db-topbar-date">
              <CalendarBlank size={15} weight="bold" />
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="db-pill cta">
              <WaIcon size={15} />
              Log via WhatsApp
            </a>
            <div ref={accountMenuRef} style={{ position: "relative" }}>
              <div
                className="db-avatar"
                onClick={() => setShowAccountMenu(v => !v)}
                style={{ cursor: "pointer" }}
              >
                {avatarLetter}
              </div>
              {showAccountMenu && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  background: "#fff", borderRadius: 14, border: "1px solid #ECE7E7",
                  boxShadow: "0 10px 30px rgba(26,20,20,.14)", minWidth: 180,
                  overflow: "hidden", zIndex: 100,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #F2EFEF" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#9AA0AD", marginTop: 2 }}>{user.phone}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 9,
                      padding: "11px 16px", background: "none", border: "none",
                      fontSize: 13.5, fontWeight: 700, color: "#E85C5C", cursor: "pointer",
                      fontFamily: "inherit", textAlign: "left",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF3F2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    <SignOut size={16} weight="bold" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showFamilyCard && memberRows.length === 0 && (
          <div className="db-family-banner" style={{
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
            <div className="db-family-banner-badge" style={{
              position: "absolute", top: 18, right: 24,
              background: "#7C6FF7", color: "#fff", fontSize: 12, fontWeight: 800,
              padding: "5px 14px", borderRadius: 20,
              display: "flex", alignItems: "center", gap: 5,
              boxShadow: "0 3px 12px rgba(124,111,247,0.35)",
            }}>
              ✨ Start here!
            </div>

            <div className="db-family-banner-emoji" style={{
              fontSize: 68, lineHeight: 1, flexShrink: 0,
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.08))",
              userSelect: "none",
            }}>
              👨‍👩‍👦
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#2C2F3A", margin: "0 0 6px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Health is better together!
              </h2>
              <p style={{ fontSize: 14, color: "#5A5F6E", margin: "0 0 20px", lineHeight: 1.6, maxWidth: 440 }}>
                Add your family members to track everyone&apos;s health, set goals together and keep each other motivated.
              </p>
              <div className="db-family-banner-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Link href="/dashboard/family-overview" style={{
                  background: "#7C6FF7", color: "#fff", border: "none", borderRadius: 14,
                  padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: "0 4px 14px rgba(124,111,247,0.35)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif", textDecoration: "none",
                }}>
                  <span style={{ fontSize: 16 }}>+</span> Add Family Member
                </Link>
                <button
                  onClick={dismissFamilyCard}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "#9AA0AD", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Maybe Later
                </button>
              </div>
            </div>

            <div style={{
              position: "absolute", bottom: -30, right: -30, width: 140, height: 140,
              borderRadius: "50%", background: "rgba(124,111,247,0.08)", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: -20, left: 160, width: 80, height: 80,
              borderRadius: "50%", background: "rgba(124,111,247,0.06)", pointerEvents: "none",
            }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 480px", minWidth: 320 }}>
        {memberRows.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2C2F3A", margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Family
              </h2>
              <Link href="/dashboard/family-overview" style={{
                display: "flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 700,
                color: "#7C6FF7", textDecoration: "none",
              }}>
                Manage <CaretRight size={11} weight="bold" />
              </Link>
            </div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 16, overflowX: "auto", padding: "10px 4px 12px" }}>
              {memberRows.map(({ member, summary: memberSummary }) => {
                const score = computeScore(memberSummary);
                const tier = scoreTier(score);
                const avatarLetter = (member.name ?? member.label).charAt(0).toUpperCase();
                return (
                  <div
                    key={member.id}
                    className="fo-member-card"
                    style={{
                      flex: "0 0 300px", minWidth: 300,
                      background:
                        `linear-gradient(165deg, ${tier.bg} 0%, #fff 55%) padding-box, linear-gradient(135deg, ${tier.border}, ${tier.ring}) border-box`,
                      borderRadius: 24, border: "1.5px solid transparent",
                      boxShadow: "0 4px 16px rgba(26,20,20,.05)", padding: "22px 22px 20px",
                    }}
                  >
                    <div style={{
                      position: "absolute", width: 130, height: 130, borderRadius: "50%",
                      top: -54, right: -42, background: tier.ring, opacity: 0.1,
                      filter: "blur(18px)", pointerEvents: "none",
                    }} />
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "relative" }}>
                      <div style={{ display: "flex", gap: 11 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: "50%",
                          background: `linear-gradient(150deg, ${tier.ring}, ${tier.textColor})`,
                          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 16, flexShrink: 0,
                          boxShadow: `0 4px 10px ${tier.ring}55`,
                        }}>
                          {avatarLetter}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#1A2744" }}>{member.name ?? member.label}</p>
                          <p style={{ margin: 0, fontSize: 11.5, color: "#9AA0AD" }}>{member.label}</p>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: tier.bg, color: tier.textColor, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
                            {score !== null && (
                              score >= 40
                                ? <CheckCircle size={13} weight="fill" color={tier.ring} />
                                : <Warning size={13} weight="fill" color={tier.ring} />
                            )}
                            {tier.label}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <ScoreRing score={score} tier={tier} size={68} />
                        <span style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: tier.textColor }}>Score</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 20, textAlign: "center" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "center" }}><Flame size={20} color="#FF9F45" /></div>
                        <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberSummary?.avg_calories != null ? memberSummary.avg_calories.toFixed(0) : "—"}</p>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Cal</p>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "center" }}><Dumbbell size={20} color="#4F9BF5" /></div>
                        <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberSummary?.avg_protein_g != null ? `${memberSummary.avg_protein_g.toFixed(0)}g` : "—"}</p>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Protein</p>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "center" }}><Footprints size={20} color="#20A865" /></div>
                        <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberSummary?.avg_steps != null ? Math.round(memberSummary.avg_steps).toLocaleString() : "—"}</p>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Steps</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedMember(member)}
                      style={{
                        width: "100%", marginTop: 18, padding: "10px 0", border: `1.5px solid ${tier.border}`, borderRadius: 14,
                        background: tier.bg, color: tier.textColor, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      View Details <CaretRight size={13} weight="bold" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => setShowAddFamily(true)}
                className="fo-add-card"
                style={{
                  flex: "0 0 300px", minWidth: 300, alignSelf: "stretch",
                  border: "2px dashed var(--he-coral)", borderRadius: 24,
                  background: "linear-gradient(165deg, var(--he-coral-bg) 0%, #fff 75%)",
                  boxShadow: "0 8px 22px rgba(232,92,92,.14)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 10, padding: "22px 18px", cursor: "pointer", position: "relative", overflow: "hidden",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                <Sparkle size={13} weight="fill" color="var(--he-coral)" style={{ position: "absolute", top: 16, left: 22, opacity: 0.5 }} />
                <Sparkle size={9} weight="fill" color="var(--he-coral)" style={{ position: "absolute", bottom: 22, right: 26, opacity: 0.4 }} />
                <div className="fo-add-pulse-ring">
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%", background: "var(--he-coral)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 20px rgba(232,92,92,.4)", position: "relative", zIndex: 1,
                  }}>
                    <UserPlus size={22} weight="bold" color="#fff" />
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1A2744" }}>Add a family member</p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "#9AA0AD", fontWeight: 500 }}>Track their health too</p>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5, marginTop: 2,
                  background: "var(--he-coral)", color: "#fff", fontSize: 11, fontWeight: 700,
                  padding: "5px 14px", borderRadius: 99,
                }}>
                  Invite now <CaretRight size={11} weight="bold" />
                </span>
              </button>
            </div>
          </div>
        )}
        </div>

        <div style={{ flex: "0 0 360px", minWidth: 300 }}>
            <div className="db-card db-card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13, background: "var(--he-orange-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Trophy size={22} weight="fill" color="var(--he-orange)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1A2744" }}>Family Ranking</p>
                  <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9AA0AD", fontWeight: 500 }}>Based on weekly health score</p>
                </div>
                <Link href="/dashboard/family-overview" style={{
                  display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700,
                  color: "#7C6FF7", textDecoration: "none", flexShrink: 0,
                }}>
                  Manage <CaretRight size={11} weight="bold" />
                </Link>
              </div>

              {rankedFamily.map((row, i) => {
                const palette = RANK_PALETTE[i % RANK_PALETTE.length];
                const medal = ["🥇", "🥈", "🥉"][i];
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "flex", flexDirection: "column", gap: 8,
                      background: palette.bg, borderRadius: 14, padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: i === 0 ? 36 : i === 1 ? 32 : 26, height: i === 0 ? 36 : i === 1 ? 32 : 26,
                        borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: i === 0 ? 24 : i === 1 ? 21 : medal ? 14 : 11, fontWeight: 800,
                        background: medal ? "transparent" : "#fff", color: "#9AA0AD",
                      }}>
                        {medal ?? i + 1}
                      </span>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: palette.accent, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13,
                      }}>
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: 13.5, fontWeight: 800, color: "#1A2744",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {row.name}{row.isYou ? " (You)" : ""}
                        </p>
                        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: palette.text }}>{palette.caption}</p>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#1A2744", flexShrink: 0 }}>
                        {row.score ?? "—"}<span style={{ fontSize: 11, fontWeight: 600, color: "#9AA0AD" }}>/100</span>
                      </span>
                    </div>
                    <div className="db-bar-track" style={{ margin: 0, height: 5 }}>
                      <div className="db-bar-fill" style={{ width: `${row.score ?? 0}%`, background: palette.accent }} />
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="db-card" style={{ flex: "1 1 0", minWidth: 380, padding: "24px 26px 22px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 22 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#1A2744", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Your Weekly Score</span>
              <Info size={15} weight="bold" color="#BFC4CE" />
            </div>

            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                flex: "0 0 200px", paddingRight: 24, borderRight: "1px solid var(--he-hairline)",
              }}>
                <ScoreRing score={personalScore} tier={personalTier} size={140} />
                <span className="db-chip-up" style={{ marginTop: 14, background: personalTier.bg, color: personalTier.textColor }}>
                  {personalTier.label}
                </span>
                {scoreDelta !== null && (
                  <p style={{
                    margin: "10px 0 0", fontSize: 12.5, fontWeight: 700,
                    color: scoreDelta >= 0 ? "var(--he-green-deep)" : "var(--he-coral-deep)",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <TrendUp size={13} weight="bold" style={scoreDelta < 0 ? { transform: "rotate(180deg)" } : undefined} />
                    {Math.abs(scoreDelta)} points vs last week
                  </p>
                )}
              </div>

              <div style={{ flex: "1 1 280px", minWidth: 240 }}>
                <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 800, color: "#1A2744" }}>Score Breakdown</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEShoe size={20} />
                    <span style={{ width: 60, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>Steps</span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: `${(stepsPts / 40) * 100}%`, background: "var(--he-green)" }} /></div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#9AA0AD" }}>{stepsPts}/40</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEMeat size={20} />
                    <span style={{ width: 60, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>Protein</span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: `${(proteinPts / 30) * 100}%`, background: "var(--he-coral)" }} /></div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#9AA0AD" }}>{proteinPts}/30</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEWheat size={20} />
                    <span style={{ width: 60, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>Calories</span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: `${(caloriesPts / 30) * 100}%`, background: "#FFB877" }} /></div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#9AA0AD" }}>{caloriesPts}/30</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEDroplet size={20} />
                    <span style={{ width: 60, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>Water</span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: "30%", background: "#D8E4F0" }} /></div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9AA0AD", background: "#F5F3F8", padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>Soon</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEMoon size={20} />
                    <span style={{ width: 60, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>Sleep</span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: "30%", background: "#DCD7F2" }} /></div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9AA0AD", background: "#F5F3F8", padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>Soon</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--he-hairline)", margin: "22px 0" }} />

            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px" }}>
                <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 800, color: "#1A2744" }}>7-Day Activity</p>
                <div style={{ display: "flex", gap: 10 }}>
                  {weeklySteps.map((d, i) => {
                    const status = d.value === 0 ? "missed" : d.value >= 10000 ? "met" : "partial";
                    const color = status === "met" ? "var(--he-green)" : status === "partial" ? "var(--he-blue)" : "var(--he-coral)";
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9AA0AD" }}>{d.label}</span>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {status === "met" && <CheckCircle size={14} weight="fill" color="#fff" />}
                          {status === "partial" && <Minus size={13} weight="bold" color="#fff" />}
                          {status === "missed" && <X size={12} weight="bold" color="#fff" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 16, fontSize: 11, color: "#9AA0AD", fontWeight: 600, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CheckCircle size={13} weight="fill" color="var(--he-green)" /> Goal met</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Minus size={13} weight="bold" color="var(--he-blue)" /> Partial</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><X size={13} weight="bold" color="var(--he-coral)" /> Missed</span>
                </div>
              </div>

              <div style={{ flex: "1 1 280px", minWidth: 240 }}>
                <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 800, color: "#1A2744" }}>Weekly Insights</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {weeklyInsights.map((ins, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5 }}>
                      <span style={{ flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                      <span style={{ color: "#2C2F3A" }}>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 22, background: "var(--he-green-bg)", borderRadius: 14, padding: "12px 18px",
              display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
              fontSize: 12.5, fontWeight: 700, color: "var(--he-green-deep)",
            }}>
              <span>🏆 Best day: {bestDay.label}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>👟 Most steps: {bestDay.value.toLocaleString()}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>🔥 Logging streak: {streak} {streak === 1 ? "day" : "days"}</span>
            </div>
          </div>

          <div style={{ flex: "1 1 0", minWidth: 300 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <MetricTile
                icon={<FEMeat size={16} />} label="Protein"
                color="var(--he-coral)" deepColor="var(--he-coral-deep)" chipBg="var(--he-coral-bg-2)" stripBg="var(--he-coral-bg)"
                value={proteinAvg ? proteinAvg.toFixed(0) : "—"} unit="g" goalText="of 50 g goal" pct={proteinPct}
                deltaDown={proteinDeltaPct !== null && proteinDeltaPct < 0}
                deltaText={proteinDeltaPct !== null ? `${Math.abs(proteinDeltaPct)}% vs last week` : "No data yet"}
                sparkline={proteinSeries}
              />
              <MetricTile
                icon={<FEWheat size={16} />} label="Calories"
                color="var(--he-orange)" deepColor="var(--he-orange-deep)" chipBg="var(--he-orange-bg-2)" stripBg="var(--he-orange-bg)"
                value={caloriesAvg ? caloriesAvg.toFixed(0) : "—"} unit="kcal" goalText="of 2,000 kcal goal" pct={caloriesPct}
                deltaDown={caloriesDeltaAbs !== null && caloriesDeltaAbs < 0}
                deltaText={caloriesDeltaAbs !== null ? `${Math.abs(caloriesDeltaAbs)} kcal vs last week` : "No data yet"}
                sparkline={caloriesSeries}
              />
              <MetricTile
                icon={<FEShoe size={16} />} label="Steps today"
                color="var(--he-green)" deepColor="var(--he-green-deep)" chipBg="var(--he-green-bg-2)" stripBg="var(--he-green-bg)"
                value={todaySteps ? todaySteps.toLocaleString() : "—"} goalText="of 10,000 steps goal" pct={stepsTodayPct}
                deltaDown={stepsVsYesterday < 0}
                deltaText={`${Math.abs(stepsVsYesterday).toLocaleString()} vs yesterday`}
                sparkline={stepsSeries}
              />
              <MetricTile
                icon={<FEMoon size={16} />} label="Sleep"
                color="#8B7FE8" deepColor="#6A5BD0" chipBg="#E4E0FB" stripBg="var(--he-violet-bg)"
                value="6.5" unit="hrs" goalText="of 7–8 hrs goal · Coming soon" pct={81}
                deltaDown={false}
                deltaText="20 mins vs last week"
                sparkline={[5.8, 6.1, 6.4, 5.9, 6.7, 7.0, 6.5]}
              />
              <MetricTile
                icon={<FEDroplet size={16} />} label="Water"
                color="var(--he-blue)" deepColor="var(--he-blue-deep)" chipBg="var(--he-blue-bg-2)" stripBg="var(--he-blue-bg)"
                value="1.8" unit="L" goalText="of 2.5 L goal · Coming soon" pct={72}
                deltaDown={true}
                deltaText="0.2 L vs last week"
                sparkline={[2.1, 1.9, 2.0, 1.7, 1.6, 1.9, 1.8]}
              />
              <div className="db-card" style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                textAlign: "center", gap: 6, position: "relative", overflow: "hidden", padding: "13px 14px",
                background: "linear-gradient(165deg, var(--he-green-bg) 0%, #fff 65%)",
              }}>
                <Sparkle size={11} weight="fill" color="var(--he-green)" style={{ position: "absolute", top: 14, left: 18, opacity: 0.6 }} />
                <Sparkle size={8} weight="fill" color="var(--he-green)" style={{ position: "absolute", top: 27, left: 30, opacity: 0.4 }} />
                <div style={{
                  width: 42, height: 42, borderRadius: "50%", background: "var(--he-green)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 18px rgba(47,190,118,.35)",
                }}>
                  <Star size={19} weight="fill" color="#fff" />
                </div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: "var(--he-green-deep)" }}>{motivCopy.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#5A5F6E", lineHeight: 1.4, maxWidth: 200 }}>{motivCopy.message}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: "var(--he-blue-bg)", borderRadius: 16, padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <CalendarCheck size={19} weight="bold" color="var(--he-blue-deep)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#1A2744" }}>
                You logged {daysLoggedThisWeek} of 7 days this week
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "#5A5F6E", fontWeight: 500 }}>{consistencyMessage}</p>
            </div>
          </div>
        </div>

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

      {selectedMember && (
        <FamilyMemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}

      {showAddFamily && (
        <AddFamilyModal
          onClose={() => setShowAddFamily(false)}
          onAdded={(member) => setMemberRows((rows) => [...rows, { member, summary: null }])}
        />
      )}
    </div>
  );
}
