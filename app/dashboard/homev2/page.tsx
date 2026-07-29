"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarBlank,
  CalendarPlus,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Crown,
  ForkKnife,
  Heart,
  Fire,
  Pill,
  Pulse,
  Sparkle,
  Star,
  UsersThree,
  WarningCircle,
  WhatsappLogo,
  X,
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
import BrandMark from "../components/BrandMark";
import V2RouteGate from "../components/V2RouteGate";
import AddFamilyModal from "../components/AddFamilyModal";
import FoodReminderControl from "../components/FoodReminderControl";
import ProfileMenu from "../components/ProfileMenu";
import { computeScore, scoreTier } from "../components/Score";
import {
  backfillYesterdayFood,
  previewYesterdayFood,
  getFamilyMembers,
  getFeatureFlags,
  getFoodReminderPreference,
  getCurrentUser,
  getMemberLogEvents,
  getMemberSummary,
  getBillingPlans,
  getTodayMedicineDoses,
  getUserLogs,
  getUserLogEvents,
  getUserSummary,
  calculateStreak,
  hasLoggedMetric,
  type FamilyMember,
  type FoodReminderPreference,
  type HealthLog,
  type HealthLogEvent,
  type Summary,
  type TodayDose,
  type User as ApiUser,
  type YesterdayFoodPreview,
} from "@/lib/api";
import { captureEvent, identifyUser } from "@/lib/analytics";
import { FAMCARE_WHATSAPP_LINK } from "@/lib/whatsapp";
import { useSubscription } from "@/lib/useSubscription";

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
  targetMissing?: boolean;
  targetCta?: string;
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
  const router = useRouter();
  // Shared with the sidebar wordmark and profile menu, so a fresh upgrade
  // shows up here the moment checkout is confirmed.
  const { usage: monthlyUsage, error: subscriptionError, retry: retrySubscription } = useSubscription();
  const [plusFromPrice, setPlusFromPrice] = useState<string | null>(null);
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
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [showYesterdayLogger, setShowYesterdayLogger] = useState(false);
  const [yesterdayBannerDismissed, setYesterdayBannerDismissed] = useState(false);
  const [yesterdayMessage, setYesterdayMessage] = useState("");
  const [yesterdayPreview, setYesterdayPreview] = useState<YesterdayFoodPreview | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const rangeMenuRef = useRef<HTMLDivElement>(null);
  const streakCalendarRef = useRef<HTMLDivElement>(null);

  // The upsell price comes from the same catalog checkout charges from, so the
  // banner can never advertise a price the payments page no longer honours.
  useEffect(() => {
    if (!monthlyUsage || monthlyUsage.unlimited) return;
    let cancelled = false;
    getBillingPlans()
      .then((data) => {
        if (cancelled || data.plans.length === 0) return;
        const cheapest = Math.min(...data.plans.map((entry) => entry.amount_paise));
        setPlusFromPrice(new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(cheapest / 100));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [monthlyUsage]);

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
    if (!showStreakCalendar) return;
    const onClickOutside = (event: MouseEvent) => {
      if (streakCalendarRef.current && !streakCalendarRef.current.contains(event.target as Node)) {
        setShowStreakCalendar(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowStreakCalendar(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showStreakCalendar]);

  useEffect(() => {
    if (!showYesterdayLogger) return;
    document.body.classList.add("mobile-sheet-open");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !backfillLoading) setShowYesterdayLogger(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("mobile-sheet-open");
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [backfillLoading, showYesterdayLogger]);

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    const authUser = storedUser ? JSON.parse(storedUser) as ApiUser : null;
    const token = localStorage.getItem("auth_token");
    if (!authUser || !token) {
      window.location.href = "/login";
      return;
    }
    setUser(authUser);
    identifyUser(authUser);
    captureEvent("home_v2_viewed", {
      has_calorie_target: Number(authUser.goal_calories) > 0,
      has_protein_target: Number(authUser.goal_protein_g) > 0,
    });
    getCurrentUser(token)
      .then((currentUser) => {
        if (!currentUser) return;
        setUser(currentUser);
        localStorage.setItem("auth_user", JSON.stringify(currentUser));
      })
      .catch(() => {
        // Keep the stored session user when profile refresh is temporarily unavailable.
      });
    getUserLogs(authUser.id, 365)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLogsLoaded(true));
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

    Promise.all([
      getFamilyMembers(token),
      getFeatureFlags(token).catch(() => ({ v2: false })),
    ])
      .then(async ([members, featureFlags]: [FamilyMember[], { v2: boolean }]) => {
        const active = members.filter((m) => m.status === "active");
        const results = await Promise.all(
          active.map(async (member) => {
            const [events, summary, doses, foodPref] = await Promise.all([
              getMemberLogEvents(member.id, token, 7).catch(() => [] as HealthLogEvent[]),
              getMemberSummary(member.id, token).catch(() => null),
              getTodayMedicineDoses(member.id, token).catch(() => [] as TodayDose[]),
              featureFlags.v2
                ? getFoodReminderPreference(token, member.id).catch(() => null)
                : Promise.resolve(null),
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
  const hasCalorieTarget = Number(user?.goal_calories) > 0;
  const hasProteinTarget = Number(user?.goal_protein_g) > 0;
  const hasNutritionTargets = hasCalorieTarget && hasProteinTarget;
  const calorieGoal = hasCalorieTarget ? Number(user?.goal_calories) : 0;
  const proteinGoal = hasProteinTarget ? Math.round(Number(user?.goal_protein_g)) : 0;
  const calories = today?.calories ?? 1580;
  const protein = Math.round(today?.protein_g ?? 86);

  const todayLogCount = useMemo(
    () => logEvents.filter((event) => event.logged_at === todayKey()).length,
    [logEvents]
  );
  const hasLoggedToday = todayLogCount > 0;
  const streak = useMemo(() => calculateStreak(logs), [logs]);
  const loggedDateSet = useMemo(
    () => new Set(logs.filter(hasLoggedMetric).map((log) => log.logged_at)),
    [logs],
  );
  const hasYesterdayLog = loggedDateSet.has(yesterdayKey());
  const currentMonthCalendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingDays = new Date(year, month, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month, day);
      const isoDate = date.toLocaleDateString("en-CA");
      return {
        day,
        isoDate,
        logged: loggedDateSet.has(isoDate),
        future: date > now,
      };
    });
    return {
      label: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      leadingDays,
      days,
      loggedDays: days.filter((day) => day.logged).length,
    };
  }, [loggedDateSet]);

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
          day: chartRange === "month"
            ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            : `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`,
          calories: log.calories ?? 0,
          protein: Math.round(log.protein_g ?? 0),
          isToday: log.logged_at === todayKey(),
        };
      });
  }, [logs, chartRange]);
  const chartTicks = useMemo(() => {
    if (chartRange !== "month" || weeklyChartData.length === 0) return undefined;
    const maxTicks = 7;
    const step = Math.max(1, Math.ceil(weeklyChartData.length / maxTicks));
    const indices: number[] = [];
    for (let i = 0; i < weeklyChartData.length; i += step) indices.push(i);
    const lastIndex = weeklyChartData.length - 1;
    if (indices[indices.length - 1] !== lastIndex) indices.push(lastIndex);
    return indices.map((i) => weeklyChartData[i].day);
  }, [weeklyChartData, chartRange]);
  const calorieAxisMax = useMemo(() => {
    const dataMax = Math.max(0, ...weeklyChartData.map((d) => d.calories));
    return Math.ceil((dataMax * 1.2) / 600) * 600 || 600;
  }, [weeklyChartData]);
  const proteinAxisMax = useMemo(() => {
    const dataMax = Math.max(0, ...weeklyChartData.map((d) => d.protein));
    return Math.ceil((dataMax * 1.2) / 25) * 25 || 25;
  }, [weeklyChartData]);

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
      sublabel: hasCalorieTarget ? `Goal ${calorieGoal.toLocaleString("en-IN")} kcal` : "No calorie target yet",
      progress: percent(calories, calorieGoal),
      targetMissing: !hasCalorieTarget,
      targetCta: "Set calorie target",
      tone: "orange",
      icon: Fire,
    },
    {
      label: "Protein today",
      value: protein.toLocaleString("en-IN"),
      suffix: "g",
      sublabel: hasProteinTarget ? `Goal ${proteinGoal.toLocaleString("en-IN")} g` : "No protein target yet",
      progress: percent(protein, proteinGoal),
      targetMissing: !hasProteinTarget,
      targetCta: "Set protein target",
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
  ], [calorieGoal, calories, hasCalorieTarget, hasProteinTarget, protein, proteinGoal, medicationValue, dosesToday, dosesTaken, selfScore]);

  const renderDayTick = (props: {
    x?: number | string;
    y?: number | string;
    payload?: { value: string };
    index?: number;
  }) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const { payload } = props;
    return (
      <text x={x} y={y + 14} textAnchor="middle" fontSize={11} fontWeight={650} fill="#8A93AC">
        {payload?.value}
      </text>
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

  function closeYesterdayLogger() {
    if (backfillLoading) return;
    setShowYesterdayLogger(false);
    setYesterdayPreview(null);
    setBackfillError(null);
  }

  async function estimateYesterdayFood(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = yesterdayMessage.trim();
    if (message.length < 2 || backfillLoading) {
      setBackfillError("Tell us what you ate yesterday.");
      return;
    }
    const token = localStorage.getItem("auth_token") ?? "";
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setBackfillLoading(true);
    setBackfillError(null);
    try {
      const preview = await previewYesterdayFood(message, token);
      setYesterdayPreview(preview);
      captureEvent("yesterday_backfill_estimated");
    } catch (submitError) {
      setBackfillError(submitError instanceof Error ? submitError.message : "Could not estimate yesterday's food.");
      captureEvent("yesterday_backfill_estimate_failed");
    } finally {
      setBackfillLoading(false);
    }
  }

  async function confirmYesterdayFood() {
    if (!yesterdayPreview || backfillLoading) return;
    const token = localStorage.getItem("auth_token") ?? "";
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setBackfillLoading(true);
    setBackfillError(null);
    try {
      const result = await backfillYesterdayFood(yesterdayPreview, token);
      setLogs((current) => [
        result.log,
        ...current.filter((log) => log.logged_at !== result.log.logged_at),
      ]);
      setLogEvents((current) => [
        result.event,
        ...current.filter((logEvent) => logEvent.id !== result.event.id),
      ]);
      setYesterdayMessage("");
      setYesterdayPreview(null);
      setShowYesterdayLogger(false);
      captureEvent("yesterday_backfill_completed");
    } catch (submitError) {
      setBackfillError(submitError instanceof Error ? submitError.message : "Could not log yesterday's food.");
      captureEvent("yesterday_backfill_failed");
    } finally {
      setBackfillLoading(false);
    }
  }

  return (
    <V2RouteGate>
    <div className="db-page">
      <Sidebar />
      <main className="db-main homev2-main">
        <header className="homev2-topbar">
          <div className="homev2-greeting-row">
            <BrandMark className="homev2-greeting-logo" />
            <h1 className="db-greeting homev2-greeting">
              <span className="homev2-greeting-hello">{greeting()} 👋</span>
              <span className="homev2-greeting-name">{user?.name ?? "there"}</span>
            </h1>
          </div>

          <div className="db-top-actions">
            {user && <FoodReminderControl userId={user.id} />}
            <div className="homev2-streak-wrap" ref={streakCalendarRef}>
              <button
                className={`db-pill homev2-streak-trigger${showStreakCalendar ? " active" : ""}`}
                type="button"
                aria-expanded={showStreakCalendar}
                aria-haspopup="dialog"
                onClick={() => setShowStreakCalendar((visible) => {
                  const nextVisible = !visible;
                  if (nextVisible) captureEvent("streak_calendar_opened");
                  return nextVisible;
                })}
              >
                <Fire size={16} weight="fill" />
                <strong>{streak}</strong>
              </button>

              {showStreakCalendar && (
                <div className="homev2-streak-calendar" role="dialog" aria-label="Monthly logging calendar">
                  <div className="homev2-streak-calendar-head">
                    <div>
                      <span>Logging calendar</span>
                      <h2>{currentMonthCalendar.label}</h2>
                    </div>
                    <span className="homev2-streak-total">
                      <Fire size={13} weight="fill" />
                      {currentMonthCalendar.loggedDays} logged
                    </span>
                  </div>

                  <div className="homev2-calendar-weekdays" aria-hidden="true">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                      <span key={`${day}-${index}`}>{day}</span>
                    ))}
                  </div>

                  <div className="homev2-calendar-grid" role="grid">
                    {Array.from({ length: currentMonthCalendar.leadingDays }, (_, index) => (
                      <span className="homev2-calendar-spacer" key={`spacer-${index}`} aria-hidden="true" />
                    ))}
                    {currentMonthCalendar.days.map((date) => (
                      <div
                        className={`homev2-calendar-day${date.logged ? " logged" : ""}${date.future ? " future" : ""}`}
                        key={date.isoDate}
                        role="gridcell"
                        aria-label={`${date.day} ${currentMonthCalendar.label}: ${date.logged ? "logged" : "not logged"}`}
                      >
                        {date.logged ? <Fire size={17} weight="fill" /> : <span>{date.day}</span>}
                        {date.logged && <small>{date.day}</small>}
                      </div>
                    ))}
                  </div>

                  <p className="homev2-streak-calendar-note">
                    Fire marks a day with at least one health log.
                  </p>
                </div>
              )}
            </div>
            <a
              className="db-pill cta"
              href={FAMCARE_WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              onClick={() => captureEvent("whatsapp_log_clicked", { source: "home_v2_header" })}
            >
              <WhatsappLogo size={15} weight="fill" />
              Log via WhatsApp
            </a>
            <ProfileMenu name={user?.name} />
          </div>
        </header>

        {logsLoaded && !hasYesterdayLog && !yesterdayBannerDismissed && (
          <section className="homev2-backfill-banner" aria-label="Log yesterday's meals">
            <button
              type="button"
              className="homev2-backfill-dismiss"
              onClick={() => {
                setYesterdayBannerDismissed(true);
                captureEvent("yesterday_backfill_banner_dismissed");
              }}
              aria-label="Dismiss"
            >
              <X size={13} weight="bold" />
            </button>
            <span className="homev2-backfill-icon"><CalendarPlus size={22} weight="duotone" /></span>
            <div className="homev2-backfill-copy">
              <div>
                <h2>Missed yesterday&apos;s log?</h2>
              </div>
              <p>Add yesterday&apos;s meals today to keep your streak and weekly insights accurate.</p>
            </div>
            <span className="homev2-backfill-streak">
              <Star size={13} weight="bold" />
              Counts toward streak
            </span>
            <button
              type="button"
              className="homev2-backfill-action"
              onClick={() => {
                setBackfillError(null);
                setYesterdayPreview(null);
                setShowYesterdayLogger(true);
                captureEvent("yesterday_backfill_started");
              }}
            >
              Log yesterday&apos;s meals
            </button>
          </section>
        )}

        <section className="homev2-panel homev2-glance">
          <h2>Today at a glance</h2>
          <div className="homev2-glance-grid">
            {glanceCards.map((card) => {
              const Icon = card.icon;
              const cardContent = (
                <>
                  <div className="homev2-card-head">
                    <span className="homev2-card-icon"><Icon size={21} weight="fill" /></span>
                    <div>
                      <p>{card.label}</p>
                      <strong>{card.value} {card.suffix && <small>{card.suffix}</small>}</strong>
                    </div>
                  </div>
                  {card.targetMissing ? (
                    <div className="homev2-target-card-entry">
                      <span>
                        <Sparkle size={11} weight="fill" />
                        {card.targetCta}
                      </span>
                      <ArrowRight size={13} weight="bold" />
                    </div>
                  ) : (
                    <>
                      <div className="homev2-card-foot">
                        <span>{card.sublabel}</span>
                        <b>{card.progress}%</b>
                      </div>
                      <div className="homev2-progress" aria-hidden="true">
                        <i style={{ width: `${card.progress}%` }} />
                      </div>
                    </>
                  )}
                </>
              );
              return card.targetMissing ? (
                <a
                  className={`homev2-glance-card homev2-target-card ${card.tone}`}
                  href="/dashboard/calorie-calculator"
                  onClick={() => captureEvent("calorie_target_entry_clicked", {
                    source: "home_v2_glance",
                    target_type: card.label.toLowerCase().includes("protein") ? "protein" : "calories",
                  })}
                  key={card.label}
                >
                  {cardContent}
                </a>
              ) : (
                <article className={`homev2-glance-card ${card.tone}`} key={card.label}>
                  {cardContent}
                </article>
              );
            })}
          </div>
        </section>

        {monthlyUsage?.status === "past_due" && (
          <a
            className="homev2-pastdue-banner"
            href="/dashboard/payments"
            onClick={() => captureEvent("billing_entry_clicked", {
              source: "home_v2_past_due",
              current_plan: monthlyUsage.plan_key,
            })}
          >
            <span className="homev2-pastdue-icon" aria-hidden="true">
              <WarningCircle size={20} weight="fill" />
            </span>
            <div>
              <strong>Your last payment didn&apos;t go through</strong>
              <span>Razorpay will retry the renewal automatically. Tap to view your billing status.</span>
            </div>
            <ArrowRight size={15} weight="bold" />
          </a>
        )}

        {subscriptionError && (
          <div className="homev2-pastdue-banner neutral" role="alert">
            <span className="homev2-pastdue-icon" aria-hidden="true">
              <WarningCircle size={20} weight="fill" />
            </span>
            <div>
              <strong>Plan status is temporarily unavailable</strong>
              <span>We won&apos;t show an upgrade or payment warning until it loads correctly.</span>
            </div>
            <button type="button" onClick={() => void retrySubscription()}>Retry</button>
          </div>
        )}

        {monthlyUsage?.plan_key === "free" && monthlyUsage.status !== "past_due" && (
          <a
            className="homev2-plus-banner"
            href="/dashboard/payments"
            aria-label="Explore FamCare Plus plans"
            onClick={() => captureEvent("billing_entry_clicked", {
              source: "home_v2_upgrade_banner",
              current_plan: "free",
            })}
          >
            <span className="homev2-plus-icon" aria-hidden="true">
              <Crown size={20} weight="fill" />
            </span>
            <div className="homev2-plus-copy">
              <span>FamCare Plus</span>
              <h2>Unlock more care for every check-in</h2>
              <p>Get more WhatsApp health logs, AI guidance and reminders for you and your family.</p>
            </div>
            <span className="homev2-plus-price">
              {plusFromPrice ? `Plans from ₹${plusFromPrice}/month` : "See monthly plans"}
            </span>
            <span className="homev2-plus-action">
              Explore Plus
              <ArrowRight size={14} weight="bold" />
            </span>
          </a>
        )}

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
                    <a
                      className="homev2-onboard-cta primary"
                      href="/dashboard/family-overviewv2"
                      onClick={() => captureEvent("family_overview_entry_clicked", { source: "home_v2_onboarding" })}
                    >
                      <UsersThree size={16} weight="bold" />
                      View details
                    </a>
                  ) : (
                    <button className="homev2-onboard-cta primary" type="button" onClick={() => {
                      setShowAddFamily(true);
                      captureEvent("family_member_add_started", { source: "home_v2_onboarding" });
                    }}>
                      <UsersThree size={16} weight="bold" />
                      Add parents
                    </button>
                  )}
                  <button className="homev2-onboard-cta" type="button" onClick={() => {
                    setShowAddFamily(true);
                    captureEvent("family_member_add_started", { source: "home_v2_medication_onboarding" });
                  }}>
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

          <article
            className="homev2-panel homev2-chart-card"
            onClick={() => {
              captureEvent("statistics_entry_clicked", { source: "home_v2_progress_chart" });
              router.push("/dashboard/statistics");
            }}
            style={{ cursor: "pointer" }}
          >
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
              <div
                className="homev2-chart-range-wrap"
                ref={rangeMenuRef}
                style={{ position: "relative" }}
                onClick={(e) => e.stopPropagation()}
              >
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
                        captureEvent("home_progress_range_changed", { range: "week" });
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
                        captureEvent("home_progress_range_changed", { range: "month" });
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

            {!hasNutritionTargets && (
              <a
                className="homev2-chart-target-entry"
                href="/dashboard/calorie-calculator"
                onClick={(event) => {
                  event.stopPropagation();
                  captureEvent("calorie_target_entry_clicked", {
                    source: "home_v2_progress_chart",
                    target_type: !hasCalorieTarget && !hasProteinTarget
                      ? "calories_and_protein"
                      : !hasCalorieTarget ? "calories" : "protein",
                  });
                }}
              >
                <span className="homev2-chart-target-icon">
                  <Sparkle size={16} weight="fill" />
                </span>
                <span>
                  <strong>
                    {!hasCalorieTarget && !hasProteinTarget
                      ? "Set your calorie and protein targets"
                      : !hasCalorieTarget
                        ? "Set your calorie target"
                        : "Set your protein target"}
                  </strong>
                  <small>Get a personal recommendation to make your progress easier to understand.</small>
                </span>
                <span className="homev2-chart-target-action">
                  Calculate targets <ArrowRight size={13} weight="bold" />
                </span>
              </a>
            )}

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
                    ticks={chartTicks}
                    tick={renderDayTick}
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    domain={[0, calorieAxisMax]}
                    tick={{ fontSize: 11, fill: "#2E7BE0", fontWeight: 650 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={34}
                    domain={[0, proteinAxisMax]}
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

        <section className="homev2-panel homev2-family-card homev2-family-card-full">
          <div className="homev2-family-head">
            <h2><UsersThree size={20} weight="fill" className="homev2-family-head-icon" /> Family overview</h2>
            <a
              href="/dashboard/family-overviewv2"
              onClick={() => captureEvent("family_overview_entry_clicked", { source: "home_v2_family_header" })}
            >
              View all family <CaretRight size={12} weight="bold" />
            </a>
          </div>

          <div className="homev2-family-list">
            {familyRows.map((row) => {
              const tier = scoreTier(row.score);
              return (
                <div className="homev2-family-row" key={row.id || row.name}>
                  <div className="homev2-family-identity">
                    <span className="homev2-family-avatar" style={{ background: tier.bg, color: tier.textColor }}>
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="homev2-family-info">
                      <b>{row.isYou ? "You" : row.name}</b>
                    </div>
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
                  <div className="homev2-family-footer">
                    <span className={`homev2-family-status${row.loggedToday ? " ok" : ""}`}>
                      <Clock size={13} weight="fill" />
                      {row.loggedToday ? "Logged today" : "No log yet"}
                    </span>
                    <a
                      className="homev2-family-view"
                      href="/dashboard/family-overviewv2"
                      onClick={() => captureEvent("family_overview_entry_clicked", { source: "home_v2_family_row" })}
                    >
                      View <CaretRight size={12} weight="bold" />
                    </a>
                  </div>
                </div>
              );
            })}
            {familyRows.length <= 1 && (
              <p className="homev2-family-empty">Add a family member to see their health overview here.</p>
            )}
          </div>
        </section>

        <section className="homev2-status-row">
          <article
            className="homev2-status-card"
            onClick={() => {
              captureEvent("health_logs_entry_clicked", { source: "home_v2_logging_status" });
              router.push("/dashboard/logs");
            }}
            style={{ cursor: "pointer" }}
          >
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
            <a
              className="homev2-status-link"
              href="/dashboard/medications"
              onClick={() => captureEvent("medications_entry_clicked", { source: "home_v2_reminders" })}
            >
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
      </main>

      {showAddFamily && (
        <AddFamilyModal
          onClose={() => setShowAddFamily(false)}
          onAdded={() => setShowAddFamily(false)}
        />
      )}

      {showYesterdayLogger && typeof document !== "undefined" && createPortal(
        <div className="homev2-backfill-layer" role="presentation">
          <button
            className="homev2-backfill-backdrop"
            type="button"
            aria-label="Close yesterday's meal logger"
            onClick={closeYesterdayLogger}
          />
          <button
            type="button"
            className="mobile-sheet-close"
            aria-label="Close"
            onClick={closeYesterdayLogger}
          >
            <X size={16} weight="bold" />
          </button>
          <section
            className="homev2-backfill-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yesterday-log-title"
          >
            <header>
              <span><CalendarPlus size={21} weight="duotone" /></span>
              <div>
                <h2 id="yesterday-log-title">
                  {yesterdayPreview ? "Review yesterday's meal" : "Log yesterday's meals"}
                </h2>
                <p>
                  {yesterdayPreview
                    ? "Check the nutrition estimate before adding it."
                    : "We'll estimate calories and protein before anything is saved."}
                </p>
              </div>
              <button
                className="modal-inline-close"
                type="button"
                onClick={closeYesterdayLogger}
                aria-label="Close"
                disabled={backfillLoading}
              >
                <X size={16} weight="bold" />
              </button>
            </header>

            <form onSubmit={estimateYesterdayFood}>
              {!yesterdayPreview ? (
                <>
                  <label htmlFor="yesterday-food-message">What did you eat yesterday?</label>
                  <textarea
                    id="yesterday-food-message"
                    value={yesterdayMessage}
                    onChange={(messageEvent) => {
                      setYesterdayMessage(messageEvent.target.value);
                      setYesterdayPreview(null);
                      setBackfillError(null);
                    }}
                    placeholder="For example: 1 plate biryani and a bowl of curd"
                    maxLength={500}
                    rows={4}
                    autoFocus
                    disabled={backfillLoading}
                  />
                </>
              ) : (
                <div className="homev2-backfill-preview">
                  <div className="homev2-backfill-preview-heading">
                    <span>Meal to add</span>
                    <strong>{yesterdayPreview.message}</strong>
                  </div>
                  <div className="homev2-backfill-preview-metrics" aria-label="Estimated nutrition">
                    <div>
                      <span className="homev2-backfill-preview-metric-icon calories">
                        <Fire size={17} weight="fill" />
                      </span>
                      <p>
                        <span>Estimated calories</span>
                        <strong>~{yesterdayPreview.calories.toLocaleString("en-IN")} <small>kcal</small></strong>
                      </p>
                    </div>
                    <div>
                      <span className="homev2-backfill-preview-metric-icon protein">
                        <ForkKnife size={17} weight="fill" />
                      </span>
                      <p>
                        <span>Estimated protein</span>
                        <strong>
                          {Number.isInteger(yesterdayPreview.protein_g)
                            ? yesterdayPreview.protein_g
                            : yesterdayPreview.protein_g.toFixed(1)}
                          <small>g</small>
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="homev2-backfill-preview-foot">
                    <span><Sparkle size={12} weight="fill" /> Estimated from your food description</span>
                    <span><Fire size={12} weight="fill" /> Counts for yesterday&apos;s streak</span>
                  </div>
                </div>
              )}
              {!yesterdayPreview && (
                <div className="homev2-backfill-hint">
                  <Star size={13} weight="fill" />
                  This entry will count for yesterday and keep your streak accurate.
                </div>
              )}
              {backfillError && <p className="homev2-backfill-error" role="alert">{backfillError}</p>}
              <div className="homev2-backfill-form-actions">
                {yesterdayPreview ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setYesterdayPreview(null);
                        setBackfillError(null);
                      }}
                      disabled={backfillLoading}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={confirmYesterdayFood} disabled={backfillLoading}>
                      {backfillLoading ? <><i /> Adding…</> : "Confirm and add"}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={closeYesterdayLogger} disabled={backfillLoading}>
                      Cancel
                    </button>
                    <button type="submit" disabled={backfillLoading || yesterdayMessage.trim().length < 2}>
                      {backfillLoading ? <><i /> Estimating…</> : "Estimate nutrition"}
                    </button>
                  </>
                )}
              </div>
            </form>
          </section>
        </div>,
        document.body
      )}
    </div>
    </V2RouteGate>
  );
}
