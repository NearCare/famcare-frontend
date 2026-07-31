"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  CalendarBlank,
  CaretDown,
  Fire,
  ForkKnife,
  Heart,
  Sparkle,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  Cell,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import Sidebar from "../components/Sidebar";
import { FEProtein } from "../components/FluentEmoji";
import {
  getFamilyMembers,
  getMemberFoodPatterns,
  getMemberLogs,
  getUserFoodPatterns,
  getUserLogs,
  type FamilyMember,
  type FoodPatterns,
  type HealthLog,
  type User as ApiUser,
} from "@/lib/api";
import { captureEvent, identifyUser } from "@/lib/analytics";

type RangeKey = "7d" | "30d" | "3m" | "custom";

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "3m": 90, custom: 30 };
const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "3m", label: "3 months" },
  { key: "custom", label: "Custom" },
];
const FOOD_PATTERN_COLORS = ["#FF8216", "#FF5260", "#7B5CFF", "#35BE83", "#4E91F4", "#D8DCE7"];

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clampPct(value: number | null, target: number) {
  if (value === null || target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function consistencyTier(pct: number) {
  if (pct >= 90) return "Excellent";
  if (pct >= 75) return "Good";
  if (pct >= 50) return "Fair";
  return "Low";
}

function toISODate(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function daysBetween(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatDailyDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const chartRowStyle: CSSProperties = {
  marginTop: -6,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};
const chartCardStyle: CSSProperties = {
  padding: "16px 18px",
  border: "1px solid #EAEDF4",
  borderRadius: 18,
  background: "rgba(255, 255, 255, .86)",
  boxShadow: "0 18px 48px rgba(23, 36, 67, .05)",
  minWidth: 0,
};
const chartHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 14,
};
const chartTitleStyle: CSSProperties = {
  margin: 0,
  color: "#16233F",
  fontSize: 14.5,
  fontWeight: 850,
  letterSpacing: -.2,
};
const chartGoalTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11.5,
  fontWeight: 700,
};
function GoalSwatch({ color }: { color: string }) {
  return (
    <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
      <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
    </svg>
  );
}
function makeTrendTooltip(unit: string) {
  return function TrendTooltip(props: TooltipContentProps<ValueType, NameType>) {
    if (!props.active || !props.payload?.length) return null;
    const entry = props.payload.find((p) => p.color) ?? props.payload[0];
    if (entry.value === null || entry.value === undefined) return null;
    return (
      <div style={{ background: "#fff", border: "1px solid #EAEDF4", borderRadius: 12, padding: "8px 12px", fontSize: 12, boxShadow: "0 10px 24px rgba(23,36,67,.08)" }}>
        <div style={{ fontWeight: 800, color: "#16233F", marginBottom: 4 }}>{props.label}</div>
        <div style={{ color: entry.color, fontWeight: 700 }}>{String(entry.value)} {unit}</div>
      </div>
    );
  };
}

export default function StatisticsPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number>(0);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [foodPatterns, setFoodPatterns] = useState<FoodPatterns | null>(null);
  const [foodPatternsLoading, setFoodPatternsLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [isMobilePicker, setIsMobilePicker] = useState(false);
  const memberMenuRef = useRef<HTMLDivElement>(null);
  const customPickerRef = useRef<HTMLDivElement>(null);
  const customPickerSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobilePicker(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!showCustomPicker) return;
    document.body.classList.add("mobile-sheet-open");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("mobile-sheet-open");
      document.body.style.overflow = previousOverflow;
    };
  }, [showCustomPicker]);

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
    captureEvent("statistics_viewed", {
      range: "30d",
      subject_type: "self",
    });
    getFamilyMembers(token)
      .then((members) => setFamilyMembers(members.filter((member) => member.status === "active")))
      .catch(() => setFamilyMembers([]));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!user || !token) return;
    if (range === "custom") {
      if (!customStart || !customEnd) {
        setFoodPatternsLoading(false);
        return;
      }
      setFoodPatternsLoading(true);
      const days = daysBetween(customStart, customEnd);
      const logsRequest = selectedMemberId === 0
        ? getUserLogs(user.id, days)
        : getMemberLogs(selectedMemberId, token, days);
      const patternsRequest = selectedMemberId === 0
        ? getUserFoodPatterns(user.id, days, customStart, customEnd)
        : getMemberFoodPatterns(selectedMemberId, token, days, customStart, customEnd);
      logsRequest
        .then((allLogs) => setLogs(allLogs.filter((log) => log.logged_at >= customStart && log.logged_at <= customEnd)))
        .catch(() => setLogs([]));
      patternsRequest
        .then(setFoodPatterns)
        .catch(() => setFoodPatterns(null))
        .finally(() => setFoodPatternsLoading(false));
      return;
    }
    setFoodPatternsLoading(true);
    const days = RANGE_DAYS[range];
    const logsRequest = selectedMemberId === 0
      ? getUserLogs(user.id, days)
      : getMemberLogs(selectedMemberId, token, days);
    const patternsRequest = selectedMemberId === 0
      ? getUserFoodPatterns(user.id, days)
      : getMemberFoodPatterns(selectedMemberId, token, days);
    logsRequest.then(setLogs).catch(() => setLogs([]));
    patternsRequest
      .then(setFoodPatterns)
      .catch(() => setFoodPatterns(null))
      .finally(() => setFoodPatternsLoading(false));
  }, [user, selectedMemberId, range, customStart, customEnd]);

  useEffect(() => {
    if (!showMemberMenu) return;
    const onClickOutside = (event: MouseEvent) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(event.target as Node)) {
        setShowMemberMenu(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showMemberMenu]);

  useEffect(() => {
    if (!showCustomPicker) return;
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTabs = customPickerRef.current?.contains(target);
      const insideSheet = customPickerSheetRef.current?.contains(target);
      if (!insideTabs && !insideSheet) {
        setShowCustomPicker(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showCustomPicker]);

  const selectedMember = useMemo(
    () => familyMembers.find((member) => member.id === selectedMemberId) ?? null,
    [familyMembers, selectedMemberId],
  );
  const selectedName = selectedMemberId === 0
    ? (user?.name ?? "You")
    : (selectedMember?.name?.trim() || selectedMember?.label || "Member");
  const rangeDays = range === "custom" && customStart && customEnd
    ? daysBetween(customStart, customEnd)
    : RANGE_DAYS[range];

  const avgCalories = useMemo(
    () => average(logs.map((log) => log.calories).filter((value): value is number => value !== null)),
    [logs],
  );
  const avgProtein = useMemo(
    () => average(logs.map((log) => log.protein_g).filter((value): value is number => value !== null)),
    [logs],
  );
  const calorieGoal = user?.goal_calories ?? 2000;
  const proteinGoal = Math.round(user?.goal_protein_g ?? 100);
  const isSelfView = selectedMemberId === 0;
  const hasCalorieTarget = !isSelfView || Number(user?.goal_calories) > 0;
  const hasProteinTarget = !isSelfView || Number(user?.goal_protein_g) > 0;
  const loggedDays = new Set(logs.map((log) => log.logged_at)).size;
  const consistencyPct = Math.min(100, Math.round((loggedDays / rangeDays) * 100));

  const caloriePct = clampPct(avgCalories, calorieGoal);
  const proteinPct = clampPct(avgProtein, proteinGoal);
  const rangeIndex = Math.max(0, RANGE_LABELS.findIndex((rangeOption) => rangeOption.key === range));

  const chartData = useMemo(
    () => [...logs]
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map((log) => ({
        dateLabel: formatShortDate(log.logged_at),
        calories: log.calories,
        protein: log.protein_g,
        sleep: log.sleep_hours,
      })),
    [logs],
  );
  const chartTicks = useMemo(() => {
    if (chartData.length === 0) return undefined;
    const maxTicks = 7;
    const step = Math.max(1, Math.ceil(chartData.length / maxTicks));
    const indices: number[] = [];
    for (let i = 0; i < chartData.length; i += step) indices.push(i);
    const lastIndex = chartData.length - 1;
    if (indices[indices.length - 1] !== lastIndex) indices.push(lastIndex);
    return indices.map((i) => chartData[i].dateLabel);
  }, [chartData]);
  const caloriesTooltip = useMemo(() => makeTrendTooltip("kcal"), []);
  const proteinTooltip = useMemo(() => makeTrendTooltip("g"), []);
  const calorieAxisMax = useMemo(() => {
    const dataMax = Math.max(0, ...chartData.map((d) => d.calories ?? 0));
    return Math.round(Math.max(dataMax, calorieGoal) * 1.2);
  }, [chartData, calorieGoal]);
  const proteinAxisMax = useMemo(() => {
    const dataMax = Math.max(0, ...chartData.map((d) => d.protein ?? 0));
    return Math.round(Math.max(dataMax, proteinGoal) * 1.2);
  }, [chartData, proteinGoal]);
  const dailyRows = useMemo(
    () => [...logs]
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
      .slice(0, 6),
    [logs],
  );
  const totalFoodLogs = foodPatterns?.total_food_logs
    ?? foodPatterns?.top_foods.reduce((sum, food) => sum + food.log_count, 0)
    ?? 0;
  const foodPatternChartData = useMemo(() => {
    if (!foodPatterns) return [];
    const topItems = foodPatterns.top_foods.map((food) => ({
      name: food.food_name,
      value: food.log_count,
    }));
    const shownLogs = topItems.reduce((sum, food) => sum + food.value, 0);
    const otherLogs = Math.max(0, totalFoodLogs - shownLogs);
    return otherLogs > 0
      ? [...topItems, { name: "Other foods", value: otherLogs }]
      : topItems;
  }, [foodPatterns, totalFoodLogs]);

  return (
    <div className="db-page">
      <Sidebar />
      <main className="db-main stats-main">
        <header className="stats-header">
          <div>
            <h1 className="stats-title">Statistics</h1>
            <p className="stats-subtitle">Explore your health data and trends over time.</p>
          </div>

          <div className="stats-header-controls">
            <div className="stats-member-wrap" ref={memberMenuRef}>
              <button
                type="button"
                className="stats-member-trigger"
                onClick={() => setShowMemberMenu((visible) => !visible)}
              >
                <span className="stats-member-avatar">{selectedName.charAt(0).toUpperCase()}</span>
                {selectedName}
                <CaretDown size={12} weight="bold" />
              </button>
              {showMemberMenu && (
                <div className="stats-member-menu">
                  <button
                    type="button"
                    className={selectedMemberId === 0 ? "active" : ""}
                    onClick={() => {
                      setSelectedMemberId(0);
                      setShowMemberMenu(false);
                      captureEvent("statistics_subject_changed", { subject_type: "self" });
                    }}
                  >
                    {user?.name ?? "You"}
                  </button>
                  {familyMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className={selectedMemberId === member.id ? "active" : ""}
                      onClick={() => {
                        setSelectedMemberId(member.id);
                        setShowMemberMenu(false);
                        captureEvent("statistics_subject_changed", { subject_type: "family" });
                      }}
                    >
                      {member.name?.trim() || member.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="stats-range-wrap" ref={customPickerRef}>
              <div
                className="stats-range-tabs"
                style={{ "--stats-active-index": rangeIndex } as CSSProperties}
              >
                <span className="stats-range-pill" aria-hidden="true" />
                {RANGE_LABELS.map((rangeOption) => (
                  <button
                    key={rangeOption.key}
                    type="button"
                    className={range === rangeOption.key ? "active" : ""}
                    onClick={() => {
                      if (rangeOption.key === "custom") {
                        setDraftStart(customStart ?? toISODate(new Date(Date.now() - 29 * 86_400_000)));
                        setDraftEnd(customEnd ?? toISODate(new Date()));
                        setShowCustomPicker(true);
                        setRange("custom");
                        return;
                      }
                      setShowCustomPicker(false);
                      setRange(rangeOption.key);
                      captureEvent("statistics_range_changed", { range: rangeOption.key });
                    }}
                  >
                    {rangeOption.key === "custom" && range === "custom" && customStart && customEnd
                      ? `${formatShortDate(customStart)} – ${formatShortDate(customEnd)}`
                      : rangeOption.label}
                    {rangeOption.key === "custom" && <CalendarBlank size={13} weight="bold" />}
                  </button>
                ))}
              </div>

              {showCustomPicker && (() => {
                const pickerBody = (
                  <div className="stats-custom-picker" ref={customPickerSheetRef}>
                    <div className="stats-custom-picker-row">
                      <label>
                        Start date
                        <input
                          type="date"
                          value={draftStart}
                          max={draftEnd || undefined}
                          onChange={(e) => setDraftStart(e.target.value)}
                        />
                      </label>
                      <label>
                        End date
                        <input
                          type="date"
                          value={draftEnd}
                          min={draftStart || undefined}
                          max={toISODate(new Date())}
                          onChange={(e) => setDraftEnd(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="stats-custom-picker-actions">
                      <button type="button" onClick={() => setShowCustomPicker(false)}>Cancel</button>
                      <button
                        type="button"
                        className="primary"
                        disabled={!draftStart || !draftEnd || draftStart > draftEnd}
                        onClick={() => {
                          setCustomStart(draftStart);
                          setCustomEnd(draftEnd);
                          setRange("custom");
                          setShowCustomPicker(false);
                          captureEvent("statistics_range_changed", {
                            range: "custom",
                            custom_days: daysBetween(draftStart, draftEnd),
                          });
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                );
                if (isMobilePicker && typeof document !== "undefined") {
                  return createPortal(
                    <div className="mobile-sheet-layer">
                      <button
                        type="button"
                        className="mobile-sheet-backdrop"
                        aria-label="Close"
                        onClick={() => setShowCustomPicker(false)}
                      />
                      <button
                        type="button"
                        className="mobile-sheet-close"
                        aria-label="Close"
                        onClick={() => setShowCustomPicker(false)}
                      >
                        <X size={16} weight="bold" />
                      </button>
                      {pickerBody}
                    </div>,
                    document.body
                  );
                }
                return pickerBody;
              })()}
            </div>
          </div>
        </header>

        <section className="stats-kpi-grid" aria-label="Statistics overview">
          <article className="stats-kpi-card">
            <div className="stats-kpi-top">
              <span className="stats-kpi-icon orange"><Fire size={28} weight="fill" /></span>
              <div className="stats-kpi-title-block">
                <p className="stats-kpi-label">Average calories</p>
                <strong>{avgCalories !== null ? Math.round(avgCalories).toLocaleString("en-IN") : "—"} <small>kcal</small></strong>
              </div>
            </div>
            <div className="stats-kpi-content">
              {!hasCalorieTarget ? (
                <a
                  href="/dashboard/calorie-calculator"
                  className="homev2-target-card-entry orange"
                  onClick={() => captureEvent("calorie_target_entry_clicked", {
                    source: "statistics_calorie_card",
                    target_type: "calories",
                  })}
                >
                  <span><Sparkle size={11} weight="fill" />Set calorie target</span>
                  <ArrowRight size={13} weight="bold" />
                </a>
              ) : (
                <>
                  <div className="stats-kpi-foot">
                    <span>Goal {calorieGoal.toLocaleString("en-IN")} kcal</span>
                  </div>
                  <div className="stats-kpi-progress-row">
                    <div className="stats-kpi-progress"><i className="orange" style={{ width: `${caloriePct}%` }} /></div>
                    <b className="orange">{caloriePct}%</b>
                  </div>
                </>
              )}
            </div>
          </article>

          <article className="stats-kpi-card">
            <div className="stats-kpi-top">
              <span className="stats-kpi-icon coral"><FEProtein size={28} /></span>
              <div className="stats-kpi-title-block">
                <p className="stats-kpi-label">Average protein</p>
                <strong>{avgProtein !== null ? Math.round(avgProtein) : "—"} <small>g</small></strong>
              </div>
            </div>
            <div className="stats-kpi-content">
              {!hasProteinTarget ? (
                <a
                  href="/dashboard/calorie-calculator"
                  className="homev2-target-card-entry"
                  onClick={() => captureEvent("calorie_target_entry_clicked", {
                    source: "statistics_protein_card",
                    target_type: "protein",
                  })}
                >
                  <span><Sparkle size={11} weight="fill" />Set protein target</span>
                  <ArrowRight size={13} weight="bold" />
                </a>
              ) : (
                <>
                  <div className="stats-kpi-foot">
                    <span>Goal {proteinGoal} g</span>
                  </div>
                  <div className="stats-kpi-progress-row">
                    <div className="stats-kpi-progress"><i className="coral" style={{ width: `${proteinPct}%` }} /></div>
                    <b className="coral">{proteinPct}%</b>
                  </div>
                </>
              )}
            </div>
          </article>

          <article className="stats-kpi-card">
            <div className="stats-kpi-top">
              <span className="stats-kpi-icon green"><Heart size={28} weight="fill" /></span>
              <div className="stats-kpi-title-block">
                <p className="stats-kpi-label">Consistency</p>
                <strong>{consistencyPct}<small>%</small></strong>
              </div>
            </div>
            <div className="stats-kpi-content">
              <div className="stats-kpi-foot">
                <span>Logged {loggedDays} of {rangeDays} days</span>
              </div>
              <div className="stats-kpi-progress-row">
                <div className="stats-kpi-progress"><i className="green" style={{ width: `${consistencyPct}%` }} /></div>
                <b className="green">{consistencyTier(consistencyPct)}</b>
              </div>
            </div>
          </article>

          <Link
            href="/dashboard/logs"
            onClick={() => captureEvent("health_logs_entry_clicked", { source: "statistics_logged_foods" })}
            className="stats-kpi-card stats-kpi-link-card"
            aria-label="View logged foods"
          >
            <div className="stats-kpi-top">
              <span className="stats-kpi-icon purple"><ForkKnife size={28} weight="fill" /></span>
              <div className="stats-kpi-title-block">
                <p className="stats-kpi-label">Food logs</p>
                <strong>
                  {foodPatternsLoading ? "—" : totalFoodLogs.toLocaleString("en-IN")}
                  <small style={{ marginLeft: 5 }}>foods</small>
                </strong>
              </div>
            </div>
            <div className="stats-kpi-content">
              <div className="stats-foodlog-foot" style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                minHeight: 22,
              }}>
                <span className="stats-foodlog-days" style={{
                  color: "#5A6680",
                  fontSize: 11.5,
                  lineHeight: 1,
                  fontWeight: 650,
                  whiteSpace: "nowrap",
                }}>
                  {loggedDays} {loggedDays === 1 ? "day" : "days"} with entries
                </span>
                <span className="stats-foodlog-cta" style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#765AF0",
                  fontSize: 10.5,
                  lineHeight: 1,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}>
                  View logs <ArrowRight size={13} weight="bold" />
                </span>
              </div>
            </div>
          </Link>
        </section>

        <section className="stats-chart-row" style={chartRowStyle}>
          <article className="stats-chart-card" style={chartCardStyle}>
            <div className="stats-chart-head" style={chartHeadStyle}>
              <h2 style={chartTitleStyle}>Calories over time</h2>
              {hasCalorieTarget ? (
                <span style={{ ...chartGoalTagStyle, color: "#FF8A1E" }}><GoalSwatch color="#FF8A1E" />Goal {calorieGoal.toLocaleString("en-IN")} kcal</span>
              ) : (
                <a
                  href="/dashboard/calorie-calculator"
                  className="homev2-target-card-entry orange"
                  style={{ marginTop: 0 }}
                  onClick={() => captureEvent("calorie_target_entry_clicked", {
                    source: "statistics_calorie_chart",
                    target_type: "calories",
                  })}
                >
                  <span><Sparkle size={11} weight="fill" />Set calorie target</span>
                  <ArrowRight size={13} weight="bold" />
                </a>
              )}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -6, bottom: 0 }}>
                <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} ticks={chartTicks} padding={{ right: 10 }} tick={{ fontSize: 11, fill: "#8A93AC", fontWeight: 650 }} />
                <YAxis tickLine={false} axisLine={false} width={42} domain={[0, calorieAxisMax]} tick={{ fontSize: 11, fill: "#8A93AC", fontWeight: 650 }} />
                <ReTooltip content={caloriesTooltip} />
                <ReferenceLine
                  y={calorieGoal}
                  stroke="#FF8A1E"
                  strokeDasharray="4 4"
                />
                <Area type="monotone" dataKey="calories" stroke="none" fill="#FF8A1E" fillOpacity={0.12} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="calories" stroke="#FF8A1E" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: "#FF8A1E", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </article>

          <article className="stats-chart-card" style={chartCardStyle}>
            <div className="stats-chart-head" style={chartHeadStyle}>
              <h2 style={chartTitleStyle}>Protein over time</h2>
              {hasProteinTarget ? (
                <span style={{ ...chartGoalTagStyle, color: "#FF4F4F" }}><GoalSwatch color="#FF4F4F" />Goal {proteinGoal} g</span>
              ) : (
                <a
                  href="/dashboard/calorie-calculator"
                  className="homev2-target-card-entry"
                  style={{ marginTop: 0 }}
                  onClick={() => captureEvent("calorie_target_entry_clicked", {
                    source: "statistics_protein_chart",
                    target_type: "protein",
                  })}
                >
                  <span><Sparkle size={11} weight="fill" />Set protein target</span>
                  <ArrowRight size={13} weight="bold" />
                </a>
              )}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -6, bottom: 0 }}>
                <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} ticks={chartTicks} padding={{ right: 10 }} tick={{ fontSize: 11, fill: "#8A93AC", fontWeight: 650 }} />
                <YAxis tickLine={false} axisLine={false} width={42} domain={[0, proteinAxisMax]} tick={{ fontSize: 11, fill: "#8A93AC", fontWeight: 650 }} />
                <ReTooltip content={proteinTooltip} />
                <ReferenceLine
                  y={proteinGoal}
                  stroke="#FF4F4F"
                  strokeDasharray="4 4"
                />
                <Area type="monotone" dataKey="protein" stroke="none" fill="#FF4F4F" fillOpacity={0.1} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="protein" stroke="#FF4F4F" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: "#FF4F4F", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </article>
        </section>

        <section className="stats-details-grid" aria-label="Daily logs and food patterns">
          <article className="stats-detail-card stats-daily-card">
            <div className="stats-detail-heading">
              <div>
                <h2>Daily log details</h2>
                <p>Recent nutrition totals for {selectedName}.</p>
              </div>
            </div>

            {dailyRows.length > 0 ? (
              <div className="stats-log-table-wrap">
                <table className="stats-log-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Calories</th>
                      <th>Protein</th>
                      <th>Source</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((log) => {
                      const isComplete = log.calories !== null && log.protein_g !== null;
                      return (
                        <tr key={log.id}>
                          <td>{formatDailyDate(log.logged_at)}</td>
                          <td className="calorie-value">
                            {log.calories !== null ? `${log.calories.toLocaleString("en-IN")} kcal` : "—"}
                          </td>
                          <td className="protein-value">
                            {log.protein_g !== null ? `${Math.round(log.protein_g)} g` : "—"}
                          </td>
                          <td>
                            <span className="stats-log-source">
                              <WhatsappLogo size={17} weight="fill" />
                              WhatsApp
                            </span>
                          </td>
                          <td>
                            <span className={`stats-log-status ${isComplete ? "complete" : "partial"}`}>
                              {isComplete ? "Complete" : "Partial"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="stats-detail-empty">
                <span><ForkKnife size={20} weight="duotone" /></span>
                <div>
                  <strong>No nutrition logs in this period</strong>
                  <p>Logged calories and protein will appear here.</p>
                </div>
              </div>
            )}

            <Link
              href="/dashboard/logs"
              className="stats-detail-link"
              onClick={() => captureEvent("health_logs_entry_clicked", { source: "statistics_daily_details" })}
            >
              View all logs <ArrowRight size={14} weight="bold" />
            </Link>
          </article>

          <article className="stats-detail-card stats-food-patterns-card">
            <div className="stats-detail-heading">
              <div>
                <h2>Food patterns</h2>
                <p>Based on itemised foods detected in this period.</p>
              </div>
              {foodPatterns && foodPatterns.unique_foods > 0 && (
                <span className="stats-food-variety">{foodPatterns.unique_foods} unique foods</span>
              )}
            </div>

            {foodPatternsLoading ? (
              <div className="stats-food-loading" aria-label="Loading food patterns">
                <span />
                <span />
                <span />
              </div>
            ) : foodPatterns && foodPatterns.top_foods.length > 0 ? (
              <>
                <div className="stats-food-visual">
                  <div className="stats-food-donut-wrap" aria-label="Share of logged foods">
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie
                          data={foodPatternChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={84}
                          paddingAngle={2}
                          cornerRadius={5}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                          isAnimationActive
                        >
                          {foodPatternChartData.map((food, index) => (
                            <Cell
                              key={food.name}
                              fill={FOOD_PATTERN_COLORS[index % FOOD_PATTERN_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <ReTooltip
                          formatter={(value) => [`${Number(value)} logs`, "Logged"]}
                          contentStyle={{
                            border: "1px solid #EAEDF4",
                            borderRadius: 12,
                            boxShadow: "0 10px 24px rgba(23,36,67,.08)",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="stats-food-donut-center">
                      <strong>{totalFoodLogs}</strong>
                      <span>food logs</span>
                    </div>
                  </div>

                  <div className="stats-food-legend">
                    {foodPatternChartData.map((food, index) => {
                      const percentage = totalFoodLogs > 0
                        ? Math.round((food.value / totalFoodLogs) * 100)
                        : 0;
                      return (
                        <div className="stats-food-legend-row" key={food.name}>
                          <i style={{ background: FOOD_PATTERN_COLORS[index % FOOD_PATTERN_COLORS.length] }} />
                          <strong>{food.name}</strong>
                          <span>{percentage}%</span>
                          <small>{food.value}×</small>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="stats-food-highlights">
                  <div>
                    <span>Most repeated</span>
                    <strong>{foodPatterns.most_logged_food}</strong>
                  </div>
                  <div>
                    <span>Top protein contributor</span>
                    <strong>{foodPatterns.top_protein_food}</strong>
                  </div>
                </div>
                <p className="stats-food-note">Nutrition values are estimates from logged food messages.</p>
              </>
            ) : (
              <div className="stats-detail-empty">
                <span><ForkKnife size={20} weight="duotone" /></span>
                <div>
                  <strong>No itemised foods yet</strong>
                  <p>Food patterns will appear after meals are logged and parsed.</p>
                </div>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
