"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Bell,
  CalendarBlank,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  ForkKnife,
  Heart,
  Fire,
  Pill,
  Pulse,
  Sparkle,
  UsersThree,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  CartesianGrid,
  ComposedChart,
  Area,
  Line,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import Sidebar from "../components/Sidebar";
import AddFamilyModal from "../components/AddFamilyModal";
import FoodReminderControl from "../components/FoodReminderControl";
import { computeScore, scoreTier } from "../components/Score";
import {
  getFamilyMembers,
  getFoodReminderPreference,
  getMemberLogEvents,
  getMemberSummary,
  getTodayMedicineDoses,
  getUserLogs,
  getUserLogEvents,
  getUserSummary,
  type FamilyMember,
  type FoodReminderPreference,
  type HealthLog,
  type HealthLogEvent,
  type Summary,
  type TodayDose,
  type User as ApiUser,
} from "@/lib/api";
import { FAMCARE_WHATSAPP_LINK } from "@/lib/whatsapp";

type NamedLogEvent = { name: string; event: HealthLogEvent };

type FamilyRow = {
  id: number;
  name: string;
  label: string;
  score: number | null;
  loggedToday: boolean;
  lastUpdateLabel: string | null;
  medicationLabel: string;
  medicationOk: boolean;
  remindersActive: boolean | null;
  isYou?: boolean;
};

type GlanceCard = {
  label: string;
  value: string;
  suffix?: string;
  sublabel: string;
  progress: number;
  tone: "orange" | "coral" | "green" | "mint";
  icon: typeof Fire;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function percent(current: number, target: number) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function getTodayLog(logs: HealthLog[]) {
  const key = todayKey();
  return logs.find((log) => log.logged_at === key) ?? logs[0] ?? null;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}

function medicationSummary(doses: TodayDose[]): { label: string; ok: boolean } {
  if (!doses.length) return { label: "No meds", ok: true };
  const missed = doses.filter((d) => d.status === "missed").length;
  if (missed > 0) return { label: "Attention", ok: false };
  const taken = doses.filter((d) => d.status === "taken").length;
  if (taken === doses.length) return { label: "All done", ok: true };
  return { label: "On track", ok: true };
}

const TODAYS_TIPS = [
  "Add more colorful fruits and veggies to your meals for better energy, immunity, and overall well-being.",
  "Stay hydrated — aim for at least 8 glasses of water throughout the day.",
  "A short 10-minute walk after meals can help with digestion and blood sugar levels.",
  "Prioritize protein at breakfast to feel fuller for longer and reduce cravings.",
  "Getting 7-8 hours of sleep supports recovery, mood, and metabolism.",
  "Swap sugary drinks for water, buttermilk, or fresh lime water when possible.",
];

function tipOfTheDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return TODAYS_TIPS[dayOfYear % TODAYS_TIPS.length];
}

function formatEventTime(event: HealthLogEvent) {
  const eventDate = new Date(event.created_at);
  const time = eventDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (event.logged_at === todayKey()) return `Today, ${time}`;
  if (event.logged_at === yesterdayKey()) return `Yesterday, ${time}`;
  return eventDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function HomeV2Page() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [logEvents, setLogEvents] = useState<HealthLogEvent[]>([]);
  const [memberLatestEvents, setMemberLatestEvents] = useState<NamedLogEvent[]>([]);
  const [familyMemberRows, setFamilyMemberRows] = useState<FamilyRow[]>([]);
  const [selfScore, setSelfScore] = useState<number | null>(null);
  const [selfDoses, setSelfDoses] = useState<TodayDose[]>([]);
  const [selfFoodPref, setSelfFoodPref] = useState<FoodReminderPreference | null>(null);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [chartRange, setChartRange] = useState<"week" | "month">("week");
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const rangeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showRangeMenu) return;
    const onClickOutside = (event: MouseEvent) => {
      if (rangeMenuRef.current && !rangeMenuRef.current.contains(event.target as Node)) {
        setShowRangeMenu(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showRangeMenu]);

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    const authUser = storedUser ? JSON.parse(storedUser) as ApiUser : null;
    const token = localStorage.getItem("auth_token");
    if (!authUser || !token) {
      window.location.href = "/login";
      return;
    }
    setUser(authUser);
    getUserLogs(authUser.id, 31)
      .then(setLogs)
      .catch(() => setLogs([]));
    getUserLogEvents(authUser.id, 7)
      .then(setLogEvents)
      .catch(() => setLogEvents([]));
    getUserSummary(authUser.id)
      .then((summary: Summary | null) => setSelfScore(computeScore(summary)))
      .catch(() => setSelfScore(null));
    getTodayMedicineDoses(authUser.id, token)
      .then(setSelfDoses)
      .catch(() => setSelfDoses([]));
    getFoodReminderPreference(token)
      .then(setSelfFoodPref)
      .catch(() => setSelfFoodPref(null));

    getFamilyMembers(token)
      .then(async (members: FamilyMember[]) => {
        const active = members.filter((m) => m.status === "active");
        const results = await Promise.all(
          active.map(async (member) => {
            const [events, summary, doses, foodPref] = await Promise.all([
              getMemberLogEvents(member.id, token, 7).catch(() => [] as HealthLogEvent[]),
              getMemberSummary(member.id, token).catch(() => null),
              getTodayMedicineDoses(member.id, token).catch(() => [] as TodayDose[]),
              getFoodReminderPreference(token, member.id).catch(() => null),
            ]);
            const latest = events.length
              ? events.reduce((a, b) => (a.created_at > b.created_at ? a : b))
              : null;
            const name = member.name?.trim() || member.label;
            return { id: member.id, name, label: member.label, latest, summary, doses, foodPref };
          })
        );
        setMemberLatestEvents(
          results
            .filter((r): r is typeof r & { latest: HealthLogEvent } => r.latest !== null)
            .map((r) => ({ name: r.name, event: r.latest }))
        );
        setFamilyMemberRows(
          results.map((r) => {
            const medication = medicationSummary(r.doses);
            return {
              id: r.id,
              name: r.name,
              label: r.label,
              score: computeScore(r.summary),
              loggedToday: r.latest?.logged_at === todayKey(),
              lastUpdateLabel: r.latest ? formatEventTime(r.latest) : null,
              medicationLabel: medication.label,
              medicationOk: medication.ok,
              remindersActive: r.foodPref?.enabled ?? null,
            };
          })
        );
      })
      .catch(() => {
        setMemberLatestEvents([]);
        setFamilyMemberRows([]);
      });
  }, []);

  const today = getTodayLog(logs);
  const calorieGoal = user?.goal_calories ?? 2000;
  const proteinGoal = Math.round(user?.goal_protein_g ?? 100);
  const calories = today?.calories ?? 1580;
  const protein = Math.round(today?.protein_g ?? 86);

  const todayLogCount = useMemo(
    () => logEvents.filter((event) => event.logged_at === todayKey()).length,
    [logEvents]
  );
  const hasLoggedToday = todayLogCount > 0;

  const latestActivity = useMemo(() => {
    const candidates: NamedLogEvent[] = [
      ...logEvents.map((event) => ({ name: "You", event })),
      ...memberLatestEvents,
    ];
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => (a.event.created_at > b.event.created_at ? a : b));
  }, [logEvents, memberLatestEvents]);

  const latestActivityLabel = useMemo(() => {
    if (!latestActivity) return null;
    const eventDate = new Date(latestActivity.event.created_at);
    const isToday = latestActivity.event.logged_at === todayKey();
    const when = isToday
      ? eventDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
      : eventDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `${latestActivity.name} · ${when}`;
  }, [latestActivity]);

  const selfLastEvent = useMemo(() => {
    if (!logEvents.length) return null;
    return logEvents.reduce((a, b) => (a.created_at > b.created_at ? a : b));
  }, [logEvents]);

  const selfMedication = useMemo(() => medicationSummary(selfDoses), [selfDoses]);

  const familyRows: FamilyRow[] = useMemo(() => {
    const rows: FamilyRow[] = [
      {
        id: user?.id ?? 0,
        name: "You",
        label: "You",
        score: selfScore,
        loggedToday: hasLoggedToday,
        lastUpdateLabel: selfLastEvent ? formatEventTime(selfLastEvent) : null,
        medicationLabel: selfMedication.label,
        medicationOk: selfMedication.ok,
        remindersActive: selfFoodPref?.enabled ?? null,
        isYou: true,
      },
      ...familyMemberRows,
    ];
    return rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [user, selfScore, hasLoggedToday, selfLastEvent, selfMedication, selfFoodPref, familyMemberRows]);

  const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyChartData = useMemo(() => {
    const windowSize = chartRange === "month" ? 30 : 7;
    return [...logs]
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .slice(-windowSize)
      .map((log) => {
        const d = new Date(`${log.logged_at}T00:00:00`);
        return {
          day: chartRange === "month" ? `${d.getDate()}` : `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`,
          calories: log.calories ?? 0,
          protein: Math.round(log.protein_g ?? 0),
          isToday: log.logged_at === todayKey(),
        };
      });
  }, [logs, chartRange]);
  const chartTickInterval = chartRange === "month" ? Math.max(0, Math.ceil(weeklyChartData.length / 7) - 1) : 0;

  const dosesToday = selfDoses.length;
  const dosesTaken = useMemo(() => selfDoses.filter((d) => d.status === "taken").length, [selfDoses]);
  const dosesMissed = useMemo(() => selfDoses.filter((d) => d.status === "missed").length, [selfDoses]);
  const medicationValue = dosesToday === 0
    ? "No meds"
    : dosesMissed > 0
    ? "Attention"
    : dosesTaken === dosesToday
    ? "All done"
    : "On track";

  const upcomingReminders = useMemo(() => {
    type ReminderItem = { key: string; icon: typeof Fire; tone: "orange" | "coral"; label: string; time: Date; timeLabel: string };
    const now = new Date();
    const items: ReminderItem[] = [];
    if (selfFoodPref) {
      for (const meal of selfFoodPref.meals) {
        if (!meal.enabled) continue;
        const timeStr = meal.time.slice(0, 5);
        const mealDate = new Date(`${todayKey()}T${timeStr}:00`);
        if (mealDate.getTime() <= now.getTime()) continue;
        items.push({
          key: `food-${meal.slot}`,
          icon: ForkKnife,
          tone: "orange",
          label: meal.label.charAt(0).toUpperCase() + meal.label.slice(1),
          time: mealDate,
          timeLabel: `Today, ${mealDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`,
        });
      }
    }
    for (const dose of selfDoses) {
      if (dose.status !== "upcoming" && dose.status !== "due") continue;
      const doseDate = new Date(dose.scheduled_for);
      items.push({
        key: `dose-${dose.id}`,
        icon: Pill,
        tone: "coral",
        label: dose.medicine.name,
        time: doseDate,
        timeLabel: `Today, ${doseDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`,
      });
    }
    return items.sort((a, b) => a.time.getTime() - b.time.getTime()).slice(0, 2);
  }, [selfFoodPref, selfDoses]);

  const glanceCards: GlanceCard[] = useMemo(() => [
    {
      label: "Calories today",
      value: calories.toLocaleString("en-IN"),
      suffix: "kcal",
      sublabel: `Goal ${calorieGoal.toLocaleString("en-IN")} kcal`,
      progress: percent(calories, calorieGoal),
      tone: "orange",
      icon: Fire,
    },
    {
      label: "Protein today",
      value: protein.toLocaleString("en-IN"),
      suffix: "g",
      sublabel: `Goal ${proteinGoal.toLocaleString("en-IN")} g`,
      progress: percent(protein, proteinGoal),
      tone: "coral",
      icon: Heart,
    },
    {
      label: "Medication status",
      value: medicationValue,
      sublabel: dosesToday ? `${dosesTaken} of ${dosesToday} taken` : "No doses scheduled",
      progress: dosesToday ? percent(dosesTaken, dosesToday) : 0,
      tone: "green",
      icon: Pill,
    },
    {
      label: "Health score",
      value: selfScore !== null ? String(selfScore) : "—",
      suffix: "/100",
      sublabel: scoreTier(selfScore).label,
      progress: selfScore ?? 0,
      tone: "mint",
      icon: Heart,
    },
  ], [calorieGoal, calories, protein, proteinGoal, medicationValue, dosesToday, dosesTaken, selfScore]);

  const renderDayTick = (props: {
    x?: number | string;
    y?: number | string;
    payload?: { value: string };
    index?: number;
  }) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const { payload, index = 0 } = props;
    const isToday = weeklyChartData[index]?.isToday;
    if (!isToday) {
      return (
        <text x={x} y={y + 14} textAnchor="middle" fontSize={11} fontWeight={650} fill="#8A93AC">
          {payload?.value}
        </text>
      );
    }
    return (
      <g>
        <rect x={x - 28} y={y - 2} width={56} height={20} rx={10} fill="#FFEAE8" />
        <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fontWeight={800} fill="#FF4F4F">
          {payload?.value}
        </text>
      </g>
    );
  };

  const renderChartTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!props.active || !props.payload?.length) return null;
    const byKey = new Map<string, (typeof props.payload)[number]>();
    for (const entry of props.payload) {
      const key = String(entry.dataKey ?? "");
      if (!key) continue;
      const existing = byKey.get(key);
      // Prefer the entry with a real stroke color (the Line) over the
      // invisible decorative Area, which also uses this dataKey but has stroke:"none".
      if (!existing || (!existing.color && entry.color)) {
        byKey.set(key, entry);
      }
    }
    const rows = Array.from(byKey.values());
    return (
      <div style={{ background: "#fff", border: "1px solid #EAEDF4", borderRadius: 12, padding: "8px 12px", fontSize: 12, boxShadow: "0 10px 24px rgba(23,36,67,.08)" }}>
        <div style={{ fontWeight: 800, color: "#16233F", marginBottom: 4 }}>{props.label}</div>
        {rows.map((entry) => (
          <div key={String(entry.dataKey)} style={{ color: entry.color, fontWeight: 700 }}>
            {String(entry.dataKey)}: {entry.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="db-page">
      <Sidebar />
      <main className="db-main homev2-main">
        <header className="homev2-topbar">
          <div>
            <h1 className="db-greeting">{greeting()}, {user?.name ?? "there"}! 👋</h1>
            <p className="db-subtitle">Here&apos;s your health overview for today.</p>
          </div>

          <div className="db-top-actions">
            {user && <FoodReminderControl userId={user.id} />}
            <a className="db-pill cta" href={FAMCARE_WHATSAPP_LINK} target="_blank" rel="noreferrer">
              <WhatsappLogo size={15} weight="fill" />
              Log via WhatsApp
            </a>
            <button className="db-avatar homev2-profile-button" type="button" aria-label="Open profile menu">
              {(user?.name ?? "S").charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        <section className="homev2-panel homev2-glance">
          <h2>Today at a glance</h2>
          <div className="homev2-glance-grid">
            {glanceCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className={`homev2-glance-card ${card.tone}`} key={card.label}>
                  <div className="homev2-card-head">
                    <span className="homev2-card-icon"><Icon size={21} weight="fill" /></span>
                    <div>
                      <p>{card.label}</p>
                      <strong>{card.value} {card.suffix && <small>{card.suffix}</small>}</strong>
                    </div>
                  </div>
                  <div className="homev2-card-foot">
                    <span>{card.sublabel}</span>
                    <b>{card.progress}%</b>
                  </div>
                  <div className="homev2-progress" aria-hidden="true">
                    <i style={{ width: `${card.progress}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="homev2-hero-row">
          <article className="homev2-panel homev2-onboard">
            <div className="homev2-onboard-top">
              <div className="homev2-onboard-art">
                <Image
                  src="/parent_care_illustration.png"
                  alt="Family caring together"
                  width={375}
                  height={215}
                  priority
                />
              </div>

              <div className="homev2-onboard-body">
                <span className="homev2-onboard-tag">
                  <Heart size={12} weight="fill" />
                  Let&apos;s get started
                </span>
                <h2>Add your parents to start caring together</h2>
                <p>
                  Your parents can send meals and health updates on WhatsApp.
                  You can view their food logs, progress, and medications from your dashboard.
                </p>

                <div className="homev2-onboard-actions">
                  {familyMemberRows.length > 0 ? (
                    <a className="homev2-onboard-cta primary" href="/dashboard/family-overview">
                      <UsersThree size={16} weight="bold" />
                      View details
                    </a>
                  ) : (
                    <button className="homev2-onboard-cta primary" type="button" onClick={() => setShowAddFamily(true)}>
                      <UsersThree size={16} weight="bold" />
                      Add parents
                    </button>
                  )}
                  <button className="homev2-onboard-cta" type="button" onClick={() => setShowAddFamily(true)}>
                    <Pulse size={16} weight="bold" />
                    Add parent medications
                  </button>
                </div>
              </div>
            </div>

            <ol className="homev2-onboard-steps">
              {familyMemberRows.length > 0 ? (
                <>
                  <li>
                    <span className="homev2-onboard-step-icon"><Pill size={15} weight="fill" /></span>
                    <span>1. Add medications</span>
                  </li>
                  <CaretRight size={13} weight="bold" className="homev2-onboard-step-arrow" />
                  <li>
                    <span className="homev2-onboard-step-icon"><Bell size={15} weight="fill" /></span>
                    <span>2. They get reminders</span>
                  </li>
                  <CaretRight size={13} weight="bold" className="homev2-onboard-step-arrow" />
                  <li>
                    <span className="homev2-onboard-step-icon"><CheckCircle size={15} weight="fill" /></span>
                    <span>3. You track adherence</span>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span className="homev2-onboard-step-icon"><UsersThree size={15} weight="fill" /></span>
                    <span>1. Add parents</span>
                  </li>
                  <CaretRight size={13} weight="bold" className="homev2-onboard-step-arrow" />
                  <li>
                    <span className="homev2-onboard-step-icon"><WhatsappLogo size={15} weight="fill" /></span>
                    <span>2. They send meals</span>
                  </li>
                  <CaretRight size={13} weight="bold" className="homev2-onboard-step-arrow" />
                  <li>
                    <span className="homev2-onboard-step-icon"><Pulse size={15} weight="fill" /></span>
                    <span>3. You monitor health &amp; meds</span>
                  </li>
                </>
              )}
            </ol>
          </article>

          <article className="homev2-panel homev2-chart-card">
            <div className="homev2-chart-head">
              <h2>{chartRange === "month" ? "Monthly" : "Weekly"} progress</h2>
              <div className="homev2-chart-legend">
                <span className="homev2-legend-item">
                  <i className="orange" />
                  Calories (kcal)
                </span>
                <span className="homev2-legend-item">
                  <i className="coral" />
                  Protein (g)
                </span>
              </div>
              <div className="homev2-chart-range-wrap" ref={rangeMenuRef} style={{ position: "relative" }}>
                <button
                  className="homev2-chart-range"
                  type="button"
                  onClick={() => setShowRangeMenu((v) => !v)}
                >
                  {chartRange === "month" ? "This month" : "This week"} <CaretDown size={11} weight="bold" />
                </button>
                {showRangeMenu && (
                  <div
                    className="homev2-chart-range-menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      zIndex: 20,
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 130,
                      padding: 6,
                      border: "1px solid #EAEDF4",
                      borderRadius: 12,
                      background: "#FFFFFF",
                      boxShadow: "0 12px 28px rgba(23,36,67,.12)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setChartRange("week");
                        setShowRangeMenu(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        border: "none",
                        borderRadius: 8,
                        background: chartRange === "week" ? "#FFEEED" : "transparent",
                        color: chartRange === "week" ? "#FF4F4F" : "#16233F",
                        fontSize: 12.5,
                        fontWeight: chartRange === "week" ? 750 : 650,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      This week
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChartRange("month");
                        setShowRangeMenu(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        border: "none",
                        borderRadius: 8,
                        background: chartRange === "month" ? "#FFEEED" : "transparent",
                        color: chartRange === "month" ? "#FF4F4F" : "#16233F",
                        fontSize: 12.5,
                        fontWeight: chartRange === "month" ? 750 : 650,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      This month
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="homev2-chart-body">
              <ResponsiveContainer width="100%" height={172}>
                <ComposedChart data={weeklyChartData} margin={{ top: 12, right: 6, left: -6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2E7BE0" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#2E7BE0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#EEF1F6" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    interval={chartTickInterval}
                    tick={renderDayTick}
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.2) / 600) * 600]}
                    tick={{ fontSize: 11, fill: "#2E7BE0", fontWeight: 650 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={34}
                    domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.2) / 25) * 25]}
                    tick={{ fontSize: 11, fill: "#FF4F4F", fontWeight: 650 }}
                  />
                  <ReTooltip content={renderChartTooltip} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="calories"
                    stroke="none"
                    fill="url(#weeklyFill)"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="calories"
                    stroke="#2E7BE0"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#fff", stroke: "#2E7BE0", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="protein"
                    stroke="#FF4F4F"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#fff", stroke: "#FF4F4F", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="homev2-status-row">
          <article className="homev2-status-card">
            <div className="homev2-status-head">
              <CheckCircle size={16} weight="fill" className="ok" />
              <h3>Logging status</h3>
            </div>
            <p className="homev2-status-headline">
              {hasLoggedToday ? "You're all set for today!" : "No logs yet today"}
            </p>
            <div className="homev2-status-rows">
              <div>
                <span>All meals logged</span>
                <b>{todayLogCount} of 3</b>
              </div>
              <div>
                <span>Last logged by</span>
                <b>{latestActivityLabel ?? "—"}</b>
              </div>
            </div>
            <div className="homev2-status-glyph">
              <Image src="/whatsapp_phone_illustration.png" alt="" width={90} height={105} />
            </div>
          </article>

          <article className="homev2-status-card homev2-reminder-card">
            <div className="homev2-status-head">
              <Bell size={17} weight="regular" />
              <h3>Next reminders</h3>
            </div>
            <ul className="homev2-reminder-list">
              {upcomingReminders.length ? upcomingReminders.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <span className={`homev2-reminder-icon ${item.tone}`}><Icon size={14} weight="fill" /></span>
                    <div>
                      <b>{item.label}</b>
                      <span>{item.timeLabel}</span>
                    </div>
                    <em className={item.tone}>Upcoming</em>
                  </li>
                );
              }) : (
                <li className="homev2-reminder-empty">No upcoming reminders today.</li>
              )}
            </ul>
            <a className="homev2-status-link" href="/dashboard/medications">
              View all reminders <ArrowRight size={13} weight="bold" />
            </a>
          </article>

          <article className="homev2-status-card homev2-tip-card">
            <div className="homev2-status-head">
              <Sparkle size={17} weight="fill" />
              <h3>Today&apos;s tip</h3>
            </div>
            <p>{tipOfTheDay()}</p>
            <div className="homev2-tip-glyph">
              <Image src="/wellness_leaf_illustration.png" alt="" width={140} height={115} />
            </div>
          </article>
        </section>

        <section className="homev2-panel homev2-family-card homev2-family-card-full">
          <div className="homev2-family-head">
            <h2><UsersThree size={20} weight="fill" className="homev2-family-head-icon" /> Family overview</h2>
            <a href="/dashboard/family-overview">
              View all family <CaretRight size={12} weight="bold" />
            </a>
          </div>

          <div className="homev2-family-list">
            {familyRows.map((row) => {
              const tier = scoreTier(row.score);
              return (
                <div className="homev2-family-row" key={row.id || row.name}>
                  <span className="homev2-family-avatar" style={{ background: tier.bg, color: tier.textColor }}>
                    {row.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="homev2-family-info">
                    <b>{row.isYou ? "You" : row.name}</b>
                    <span>{row.isYou ? "You" : row.label}</span>
                  </div>
                  <div className="homev2-family-meta">
                    <span className="homev2-family-meta-item">
                      <CheckCircle size={15} weight="fill" className={row.medicationOk ? "ok" : "coral"} />
                      Medication: {row.medicationLabel}
                    </span>
                    <i className="homev2-family-meta-divider" />
                    <span className="homev2-family-meta-item">
                      <Bell size={15} weight="fill" className={row.remindersActive ? "coral" : ""} />
                      Reminders: {row.remindersActive === null ? "—" : row.remindersActive ? "Active" : "Off"}
                    </span>
                    <i className="homev2-family-meta-divider" />
                    <span className="homev2-family-meta-item">
                      <CalendarBlank size={15} weight="regular" />
                      Last update: {row.lastUpdateLabel ?? "—"}
                    </span>
                  </div>
                  <span className={`homev2-family-status${row.loggedToday ? " ok" : ""}`}>
                    <Clock size={13} weight="fill" />
                    {row.loggedToday ? "Logged today" : "No log yet"}
                  </span>
                  <a className="homev2-family-view" href="/dashboard/family-overview">
                    View <CaretRight size={12} weight="bold" />
                  </a>
                </div>
              );
            })}
            {familyRows.length <= 1 && (
              <p className="homev2-family-empty">Add a family member to see their health overview here.</p>
            )}
          </div>
        </section>
      </main>

      {showAddFamily && (
        <AddFamilyModal
          onClose={() => setShowAddFamily(false)}
          onAdded={() => setShowAddFamily(false)}
        />
      )}
    </div>
  );
}
