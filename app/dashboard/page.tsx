"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle, Warning, Sparkle, CaretRight, CaretDown, Info, TrendUp, Minus, X,
  Star, CalendarBlank, CalendarCheck, SignOut, UserPlus, Plus, Trash,
} from "@phosphor-icons/react";
import { Flame, Dumbbell, Footprints } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { FEShoe, FEProtein, FEWheat, FEMoon, FEFlame, FEChat } from "./components/FluentEmoji";
import {
  getUserLogs,
  getUserLogEvents,
  getUserSummary,
  getFamilyMembers,
  getMemberSummary,
  getMemberLogs,
  getMemberLogEvents,
  getFoodReminderPreference,
  updateFoodReminderPreference,
  updateUserGoals,
  logsToWeeklyMetric,
  calculateStreak,
  hasLoggedMetric,
  type User,
  type HealthLog,
  type HealthLogEvent,
  type Summary,
  type FamilyMember,
  type FoodReminderPreference,
  type FoodReminderMeal,
} from "@/lib/api";
import { scoreTier, computeScore, scoreFromAverages, ScoreRing } from "./components/Score";
import EmptyState from "./components/EmptyState";
import FeatureIntro from "./components/FeatureIntro";
import Sidebar from "./components/Sidebar";
import AddFamilyModal from "./components/AddFamilyModal";
import StreakPill from "./components/StreakPill";
import { FAMCARE_WHATSAPP_LINK } from "@/lib/whatsapp";
import PageLoader from "./components/PageLoader";
import { captureEvent, identifyUser, resetAnalytics } from "@/lib/analytics";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

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

function withOpacity(hexColor: string, opacity: number) {
  const normalized = hexColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hexColor;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function compactLogMessage(message: string | null | undefined) {
  const trimmed = message?.replace(/^\[voice\]\s*/i, "").trim();
  if (!trimmed) return "Health log added";
  return trimmed.length > 24 ? `${trimmed.slice(0, 24).trim()}…` : trimmed;
}

function logMetricsText(log: Pick<HealthLogEvent, "calories" | "protein_g" | "steps" | "sleep_hours">) {
  const parts: string[] = [];
  if (log.calories != null) parts.push(`${log.calories.toLocaleString()} kcal`);
  if (log.protein_g != null) parts.push(`${Math.round(log.protein_g)}g protein`);
  if (log.steps != null) parts.push(`${log.steps.toLocaleString()} steps`);
  if (log.sleep_hours != null) parts.push(`${log.sleep_hours}h sleep`);
  return parts.length ? parts.join(" · ") : "Logged";
}

type RecentLogItem = {
  key: string;
  message: string;
  metrics: string;
};

function recentItemFromEvent(event: HealthLogEvent): RecentLogItem {
  return {
    key: `event-${event.id}`,
    message: compactLogMessage(event.raw_message),
    metrics: logMetricsText(event),
  };
}

function recentItemFromAggregate(log: HealthLog): RecentLogItem {
  return {
    key: `log-${log.id}`,
    message: compactLogMessage(log.raw_message),
    metrics: logMetricsText(log),
  };
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

type MetricDetail = {
  label: string;
  data: { label: string; value: number }[];
  color: string;
  unit: string;
  goal?: number;
  decimals?: number;
};

function MetricDetailFloater({ detail, onClose, onSetGoal }: { detail: MetricDetail; onClose: () => void; onSetGoal?: () => void }) {
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setChartReady(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setChartReady(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detail]);

  const todayIdx = detail.data.length - 1;
  const maxVal = useMemo(
    () => Math.max(...detail.data.map(d => d.value), detail.goal ? detail.goal * 0.5 : 1),
    [detail],
  );
  const fmt = useCallback(
    (v: number) => detail.decimals ? v.toFixed(detail.decimals) : Math.round(v).toLocaleString(),
    [detail.decimals],
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(26,20,20,.38)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 24, padding: "26px 26px 22px",
          width: "100%", maxWidth: 460, boxShadow: "0 24px 60px rgba(26,20,20,.18)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          contain: "layout paint",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1A2744" }}>{detail.label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#9AA0AD", fontWeight: 500 }}>
                Last 7 days{detail.goal ? ` · Goal: ${detail.goal.toLocaleString()} ${detail.unit}/day` : ""}
              </p>
              {onSetGoal && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(); onSetGoal(); }}
                  style={{
                    padding: "2px 8px", border: "1.5px solid #E0DCF0", borderRadius: 20,
                    background: "none", cursor: "pointer", fontSize: 10.5, fontWeight: 700,
                    color: "#7C6FF7", fontFamily: "inherit", lineHeight: 1.5,
                  }}
                >
                  {detail.goal ? "Edit goal" : "Set goal"}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "none",
              background: "#F5F3F8", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <X size={15} weight="bold" color="#9AA0AD" />
          </button>
        </div>

        {chartReady ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={detail.data} barSize={32} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fontWeight: 700, fill: "#9AA0AD", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
              <YAxis hide domain={[0, maxVal * 1.25]} />
              <ReTooltip
                cursor={{ fill: "rgba(0,0,0,.04)", radius: 8 }}
                contentStyle={{ background: "#fff", border: "1px solid #F2F1F3", borderRadius: 10, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                labelStyle={{ color: "#9AA0AD", fontSize: 11, fontWeight: 700 }}
                itemStyle={{ fontWeight: 700 }}
                formatter={(v) => [`${fmt(Number(v))} ${detail.unit}`, detail.label]}
              />
              {detail.goal && (
                <ReferenceLine
                  y={detail.goal}
                  stroke="#E0DCF0" strokeDasharray="5 4" strokeWidth={1.5}
                  label={{ value: "Goal", position: "right", fontSize: 10, fill: "#BFC4CE", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
              )}
              <Bar dataKey="value" radius={[7, 7, 3, 3]}>
                {detail.data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={i === todayIdx
                      ? detail.color
                      : detail.goal
                        ? (entry.value >= detail.goal ? detail.color + "CC" : detail.color + "44")
                        : detail.color + "88"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 180, display: "grid", alignItems: "end", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, padding: "14px 2px 8px" }}>
            {detail.data.map((entry, i) => {
              const pct = maxVal > 0 ? Math.max(8, Math.round((entry.value / (maxVal * 1.25)) * 100)) : 8;
              return (
                <div key={`${entry.label}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: "100%",
                    maxWidth: 32,
                    height: `${pct}%`,
                    minHeight: 12,
                    borderRadius: "7px 7px 3px 3px",
                    background: i === todayIdx ? detail.color : detail.color + "44",
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9AA0AD" }}>{entry.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          {(detail.goal ? [
            { dot: detail.color, label: "Today" },
            { dot: detail.color + "CC", label: "Goal met" },
            { dot: detail.color + "44", label: "Below goal" },
          ] : [
            { dot: detail.color, label: "Today" },
            { dot: detail.color + "88", label: "Other days" },
          ]).map(({ dot, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#9AA0AD" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: dot, display: "inline-block" }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalsModal({
  user,
  token,
  onSave,
  onClose,
}: {
  user: User;
  token: string;
  onSave: (updated: User) => void;
  onClose: () => void;
}) {
  const [steps, setSteps] = useState(user.goal_steps?.toString() ?? "");
  const [protein, setProtein] = useState(user.goal_protein_g?.toString() ?? "");
  const [calories, setCalories] = useState(user.goal_calories?.toString() ?? "");
  const [sleep, setSleep] = useState(user.goal_sleep_hours?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUserGoals(user.id, {
        goal_steps: steps ? parseInt(steps, 10) : null,
        goal_protein_g: protein ? parseFloat(protein) : null,
        goal_calories: calories ? parseInt(calories, 10) : null,
        goal_sleep_hours: sleep ? parseFloat(sleep) : null,
      }, token);
      localStorage.setItem("auth_user", JSON.stringify(updated));
      onSave(updated);
      onClose();
    } catch (e) {
      setError((e as Error).message ?? "Failed to save goals");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1.5px solid #E8E6EC",
    borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: "#2C2F3A",
    outline: "none", boxSizing: "border-box", background: "#FAFAFA",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#9AA0AD", marginBottom: 5, display: "block" };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 380,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#2C2F3A" }}>Set Your Goals</div>
            <div style={{ fontSize: 12.5, color: "#9AA0AD", marginTop: 2 }}>Leave blank to hide goal from tiles</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9AA0AD", padding: 4 }}>
            <X size={18} weight="bold" />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Daily Steps</label>
            <input type="number" placeholder="e.g. 10000" value={steps} onChange={e => setSteps(e.target.value)} style={inputStyle} min={0} />
          </div>
          <div>
            <label style={labelStyle}>Protein (g)</label>
            <input type="number" placeholder="e.g. 50" value={protein} onChange={e => setProtein(e.target.value)} style={inputStyle} min={0} />
          </div>
          <div>
            <label style={labelStyle}>Calories (kcal)</label>
            <input type="number" placeholder="e.g. 2000" value={calories} onChange={e => setCalories(e.target.value)} style={inputStyle} min={0} />
          </div>
          <div>
            <label style={labelStyle}>Sleep (hours)</label>
            <input type="number" placeholder="e.g. 8" value={sleep} onChange={e => setSleep(e.target.value)} style={inputStyle} min={0} max={24} step={0.5} />
          </div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: "#E85C5C", marginTop: 12 }}>{error}</div>}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 22, width: "100%", padding: "13px 0", borderRadius: 12,
            background: saving ? "#C5B9F8" : "#7C6FF7", border: "none", cursor: saving ? "not-allowed" : "pointer",
            fontSize: 14.5, fontWeight: 800, color: "#fff", fontFamily: "inherit",
          }}
        >
          {saving ? "Saving…" : "Save Goals"}
        </button>
      </div>
    </div>
  );
}

function MetricTile({
  icon, label, color, deepColor, chipBg, stripBg, value, unit, goalText, pct, deltaDown, deltaText, sparkline, onClick, onSetGoal, estimated = false,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  deepColor: string;
  chipBg: string;
  stripBg: string;
  value: React.ReactNode;
  unit?: string;
  goalText?: string;
  pct?: number;
  deltaDown: boolean;
  deltaText: string;
  sparkline: number[];
  onClick?: () => void;
  onSetGoal?: () => void;
  estimated?: boolean;
}) {
  return (
    <div className="db-card fo-metric-tile" onClick={onClick} style={{ display: "flex", flexDirection: "column", padding: "13px 14px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: chipBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: deepColor }}>{label}</span>
          {estimated && <EstimateInfo color={deepColor} />}
        </div>
        <CaretRight size={13} color="#BFC4CE" />
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#1A2744", letterSpacing: "-.5px" }}>{value}</span>
        {unit && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9AA0AD", marginLeft: 3 }}>{unit}</span>}
      </div>

      {goalText ? (
        <p style={{ margin: "1px 0 0", fontSize: 10.5, color: "#9AA0AD", fontWeight: 500 }}>{goalText}</p>
      ) : onSetGoal ? (
        <button
          onClick={(e) => { e.stopPropagation(); onSetGoal?.(); }}
          style={{
            marginTop: 2, padding: "1px 7px", border: "1.5px dashed #D8D4F0",
            borderRadius: 20, background: "none", cursor: "pointer",
            fontSize: 10.5, fontWeight: 700, color: "#9B93E0", fontFamily: "inherit",
            alignSelf: "flex-start",
          }}
        >
          + Set goal
        </button>
      ) : (
        <div style={{ marginTop: 2, height: 18 }} />
      )}

      {pct !== undefined ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7 }}>
          <div className="db-bar-track" style={{ flex: 1, margin: 0, height: 5 }}>
            <div className="db-bar-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color }}>{pct}%</span>
        </div>
      ) : (
        <div style={{ marginTop: 4, height: 5 }} />
      )}

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

function EstimateInfo({ color = "#9AA0AD" }: { color?: string }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visible = open || hovered;

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((current) => !current);
      }}
      onBlur={() => setOpen(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        cursor: "help",
        color,
      }}
      tabIndex={0}
      role="button"
      aria-label="Nutrition estimate info"
    >
      <Info size={13} weight="bold" />
      {visible && (
        <span style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 230,
          background: "#1A2744",
          color: "#fff",
          borderRadius: 12,
          padding: "10px 12px",
          zIndex: 80,
          boxShadow: "0 8px 28px rgba(26,20,20,.22)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1.45,
          whiteSpace: "normal",
          pointerEvents: "none",
        }}>
          <span style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 6, overflow: "hidden" }}>
            <span style={{ display: "block", width: 10, height: 10, background: "#1A2744", transform: "rotate(45deg)", margin: "3px auto 0" }} />
          </span>
          Estimated from your meal messages. Values are approximate and not medical advice.
        </span>
      )}
    </span>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const WA_LINK = FAMCARE_WHATSAPP_LINK;

const DEFAULT_FOOD_REMINDER_MEALS: FoodReminderMeal[] = [
  { slot: "breakfast", label: "breakfast", time: "09:00", enabled: true },
  { slot: "lunch", label: "lunch", time: "15:00", enabled: true },
  { slot: "dinner", label: "dinner", time: "22:00", enabled: true },
  { slot: "snack", label: "snack", time: "18:00", enabled: false },
  { slot: "extra", label: "snack", time: "20:00", enabled: false },
];

function formatFoodReminderTime(time: string) {
  const [hourPart = "0", minutePart = "0"] = time.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

const FOOD_REMINDER_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { value, label: formatFoodReminderTime(value) };
});

function quarterHourFoodReminderTime(time: string, fallback: string) {
  return FOOD_REMINDER_TIME_OPTIONS.some((option) => option.value === time.slice(0, 5))
    ? time.slice(0, 5)
    : fallback;
}

function foodReminderMealsFromPreference(preference: FoodReminderPreference | null): FoodReminderMeal[] {
  const incoming = preference?.meals ?? [];
  return DEFAULT_FOOD_REMINDER_MEALS.map((fallback) => {
    const meal = incoming.find((candidate) => candidate.slot === fallback.slot) ?? fallback;
    return { ...meal, time: quarterHourFoodReminderTime(meal.time, fallback.time) };
  });
}

const WaIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

type MemberRow = { member: FamilyMember; summary: Summary | null; logs: HealthLog[]; events: HealthLogEvent[] };

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [logEvents, setLogEvents] = useState<HealthLogEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState("self");
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showFeatureIntro, setShowFeatureIntro] = useState(false);
  const [featureIntroChecked, setFeatureIntroChecked] = useState(false);
  const [metricDetail, setMetricDetail] = useState<MetricDetail | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [foodReminderPreference, setFoodReminderPreference] = useState<FoodReminderPreference | null>(null);
  const [showFoodReminderMenu, setShowFoodReminderMenu] = useState(false);
  const [foodReminderDraftEnabled, setFoodReminderDraftEnabled] = useState(true);
  const [foodReminderDraftMeals, setFoodReminderDraftMeals] = useState<FoodReminderMeal[]>(DEFAULT_FOOD_REMINDER_MEALS);
  const [foodReminderDraftError, setFoodReminderDraftError] = useState<string | null>(null);
  const [savingFoodReminder, setSavingFoodReminder] = useState(false);
  const [recentLogsOpen, setRecentLogsOpen] = useState<Record<string, boolean>>({});
  const [profileCarouselProgress, setProfileCarouselProgress] = useState(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const foodReminderMenuRef = useRef<HTMLDivElement>(null);
  const scoreInfoRef = useRef<HTMLDivElement>(null);
  const profileCarouselRef = useRef<HTMLDivElement>(null);

  const handleProfileCarouselScroll = useCallback(() => {
    const carousel = profileCarouselRef.current;
    if (!carousel) return;
    if (carousel.scrollTop !== 0) carousel.scrollTop = 0;
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    setProfileCarouselProgress(maxScroll > 0 ? carousel.scrollLeft / maxScroll : 0);
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

  useEffect(() => {
    if (!showScoreInfo) return;
    function handleClickOutside(e: MouseEvent) {
      if (scoreInfoRef.current && !scoreInfoRef.current.contains(e.target as Node)) {
        setShowScoreInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showScoreInfo]);

  useEffect(() => {
    if (!showFoodReminderMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (foodReminderMenuRef.current && !foodReminderMenuRef.current.contains(e.target as Node)) {
        setShowFoodReminderMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFoodReminderMenu]);

  useEffect(() => {
    if (profileCarouselRef.current) profileCarouselRef.current.scrollTop = 0;
  }, [logs.length, memberRows.length]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setShowFeatureIntro(false);
      setFeatureIntroChecked(true);
      return;
    }

    const storageKey = `famcare_feature_intro_seen_${user.id}`;
    const seen = IS_PRODUCTION && localStorage.getItem(storageKey) === "true";
    const shouldShow = IS_PRODUCTION ? logs.length === 0 && !seen : true;
    setShowFeatureIntro(shouldShow);
    setFeatureIntroChecked(true);
  }, [loading, logs.length, user]);

  useEffect(() => {
    setFoodReminderDraftEnabled(foodReminderPreference?.enabled ?? true);
    setFoodReminderDraftMeals(foodReminderMealsFromPreference(foodReminderPreference));
  }, [foodReminderPreference]);

  const handleLogout = () => {
    captureEvent("logout");
    resetAnalytics();
    if (user) localStorage.removeItem(`famcare_feature_intro_seen_${user.id}`);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
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
      const [fetchedLogs, fetchedEvents, fetchedSummary, members] = await Promise.all([
        getUserLogs(authUser.id, 30),
        getUserLogEvents(authUser.id, 7).catch(() => []),
        getUserSummary(authUser.id),
        getFamilyMembers(token).catch((err) => {
          if (err?.message === "Unauthorized") throw err;
          return [] as FamilyMember[];
        }),
      ]);
      setLogs(fetchedLogs);
      setLogEvents(fetchedEvents);
      setSummary(fetchedSummary);
      getFoodReminderPreference(token)
        .then(setFoodReminderPreference)
        .catch((err) => {
          console.warn("[Dashboard] Failed to load food reminder preference", err);
        });

      const activeMembers = members.filter((m) => m.status === "active");
      identifyUser(authUser);
      captureEvent("dashboard_viewed", {
        family_member_count: activeMembers.length,
        health_log_count: fetchedLogs.length,
        has_family_members: activeMembers.length > 0,
      });
      const rows = await Promise.all(
        activeMembers.map(async (member) => {
          const [memberSummary, memberLogs, memberEvents] = await Promise.all([
            getMemberSummary(member.id, token).catch(() => null),
            getMemberLogs(member.id, token, 7).catch(() => []),
            getMemberLogEvents(member.id, token, 7).catch(() => []),
          ]);
          return {
            member,
            summary: memberSummary,
            logs: memberLogs,
            events: memberEvents,
          };
        })
      );
      setMemberRows(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const updateFoodReminderDraftMeal = useCallback((slot: FoodReminderMeal["slot"], patch: Partial<FoodReminderMeal>) => {
    setFoodReminderDraftError(null);
    setFoodReminderDraftMeals((current) => current.map((meal) => (
      meal.slot === slot ? { ...meal, ...patch } : meal
    )));
  }, []);

  const ensureOneFoodReminderDraftMeal = useCallback(() => {
    setFoodReminderDraftMeals((current) => {
      if (current.some((meal) => meal.enabled)) return current;
      const firstSlot = current[0]?.slot;
      if (!firstSlot) return current;
      return current.map((meal) => (
        meal.slot === firstSlot ? { ...meal, enabled: true } : meal
      ));
    });
  }, []);

  const setFoodReminderDraftPower = useCallback((enabled: boolean) => {
    setFoodReminderDraftError(null);
    setFoodReminderDraftEnabled(enabled);
    if (enabled) ensureOneFoodReminderDraftMeal();
  }, [ensureOneFoodReminderDraftMeal]);

  const removeFoodReminderDraftMeal = useCallback((slot: FoodReminderMeal["slot"]) => {
    setFoodReminderDraftMeals((current) => {
      const activeCount = current.filter((meal) => meal.enabled).length;
      if (foodReminderDraftEnabled && activeCount <= 1) {
        setFoodReminderDraftError("At least one reminder is needed while food reminders are On. Turn Off reminders to remove all.");
        return current;
      }
      setFoodReminderDraftError(null);
      return current.map((meal) => (
        meal.slot === slot ? { ...meal, enabled: false } : meal
      ));
    });
  }, [foodReminderDraftEnabled]);

  const setFoodReminderDraftMealEnabled = useCallback((slot: FoodReminderMeal["slot"], enabled: boolean) => {
    if (!enabled) {
      removeFoodReminderDraftMeal(slot);
      return;
    }
    updateFoodReminderDraftMeal(slot, { enabled: true });
  }, [removeFoodReminderDraftMeal, updateFoodReminderDraftMeal]);

  const addFoodReminderDraftMeal = useCallback(() => {
    setFoodReminderDraftError(null);
    setFoodReminderDraftMeals((current) => {
      const nextSlot = current.find((meal) => !meal.enabled)?.slot;
      if (!nextSlot) return current;
      return current.map((meal) => (
        meal.slot === nextSlot ? { ...meal, enabled: true } : meal
      ));
    });
  }, []);

  const saveFoodReminderSetup = useCallback(async () => {
    const token = localStorage.getItem("auth_token") ?? "";
    if (!token || savingFoodReminder) return;
    const safeMeals = foodReminderDraftEnabled && foodReminderDraftMeals.every((meal) => !meal.enabled)
      ? foodReminderDraftMeals.map((meal, index) => index === 0 ? { ...meal, enabled: true } : meal)
      : foodReminderDraftMeals;
    if (safeMeals !== foodReminderDraftMeals) setFoodReminderDraftMeals(safeMeals);
    setSavingFoodReminder(true);
    const previous = foodReminderPreference;
    const optimisticMeals = safeMeals;
    setFoodReminderPreference((current): FoodReminderPreference => ({
      user_id: current?.user_id ?? user?.id ?? 0,
      enabled: foodReminderDraftEnabled,
      activated: current?.activated || foodReminderDraftEnabled,
      breakfast_time: optimisticMeals.find((meal) => meal.slot === "breakfast")?.time ?? "09:00",
      lunch_time: optimisticMeals.find((meal) => meal.slot === "lunch")?.time ?? "15:00",
      dinner_time: optimisticMeals.find((meal) => meal.slot === "dinner")?.time ?? "22:00",
      meals: optimisticMeals,
    }));
    try {
      const updated = await updateFoodReminderPreference(foodReminderDraftEnabled, token, optimisticMeals);
      setFoodReminderPreference(updated);
      setShowFoodReminderMenu(false);
      captureEvent("food_reminder_preference_updated", {
        enabled: updated.enabled,
        active_meal_count: updated.meals.filter((meal) => meal.enabled).length,
      });
    } catch (err) {
      setFoodReminderPreference(previous);
      setError(err instanceof Error ? err.message : "Failed to update food reminder preference");
    } finally {
      setSavingFoodReminder(false);
    }
  }, [foodReminderDraftEnabled, foodReminderDraftMeals, foodReminderPreference, savingFoodReminder, user?.id]);

  useEffect(() => {
    (async () => {
      await loadDashboard();
    })();
  }, [loadDashboard]);

  const selectedMemberRow = useMemo(() => {
    if (selectedCardId === "self") return null;
    return memberRows.find(({ member }) => `member-${member.id}` === selectedCardId) ?? null;
  }, [memberRows, selectedCardId]);
  const selectedProfileLogs = selectedMemberRow?.logs ?? logs;
  const selectedProfileSummary = selectedMemberRow?.summary ?? summary;
  const selectedProfileIsSelf = selectedCardId === "self" || !selectedMemberRow;
  const selectedProfileName = selectedProfileIsSelf
    ? user?.name ?? "You"
    : selectedMemberRow.member.name ?? selectedMemberRow.member.label;
  const selectedProfilePossessive = selectedProfileIsSelf ? "Your" : `${selectedProfileName}'s`;
  const selectedProfileSubject = selectedProfileIsSelf ? "You" : selectedProfileName;

  const weeklySteps = useMemo(() => logsToWeeklyMetric(selectedProfileLogs, "steps"), [selectedProfileLogs]);
  const weeklyProtein = useMemo(() => logsToWeeklyMetric(selectedProfileLogs, "protein_g"), [selectedProfileLogs]);
  const weeklyCalories = useMemo(() => logsToWeeklyMetric(selectedProfileLogs, "calories"), [selectedProfileLogs]);
  const weeklySleep = useMemo(() => logsToWeeklyMetric(selectedProfileLogs, "sleep_hours"), [selectedProfileLogs]);
  const streak = useMemo(() => calculateStreak(selectedProfileLogs), [selectedProfileLogs]);
  const proteinSeries = useMemo(() => weeklyProtein.map((d) => d.value), [weeklyProtein]);
  const caloriesSeries = useMemo(() => weeklyCalories.map((d) => d.value), [weeklyCalories]);
  const stepsSeries = useMemo(() => weeklySteps.map((d) => d.value), [weeklySteps]);
  const sleepSeries = useMemo(() => weeklySleep.map((d) => d.value), [weeklySleep]);
  const hasData = !!selectedProfileSummary?.last_logged;
  const proteinAvg = selectedProfileSummary?.avg_protein_g ?? 0;
  const caloriesAvg = selectedProfileSummary?.avg_calories ?? 0;
  const stepsAvg = selectedProfileSummary?.avg_steps ?? 0;
  const sleepAvg = selectedProfileSummary?.avg_sleep_hours ?? 0;

  const goalProtein = user?.goal_protein_g ?? null;
  const goalCalories = user?.goal_calories ?? null;
  const goalSteps = user?.goal_steps ?? null;
  const goalSleep = user?.goal_sleep_hours ?? null;

  const todayIST = new Date().toLocaleDateString("en-CA");
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIST = yesterdayDate.toLocaleDateString("en-CA");
  const todayLog = selectedProfileLogs.find((l) => l.logged_at === todayIST);
  const yesterdayLog = selectedProfileLogs.find((l) => l.logged_at === yesterdayIST);
  const todayProtein = todayLog?.protein_g ?? 0;
  const todayCalories = todayLog?.calories ?? 0;
  const todaySteps = todayLog?.steps ?? 0;
  const todaySleep = todayLog?.sleep_hours ?? null;
  const yesterdayProtein = yesterdayLog?.protein_g ?? 0;
  const yesterdayCalories = yesterdayLog?.calories ?? 0;
  const yesterdaySteps = yesterdayLog?.steps ?? 0;
  const yesterdaySleep = yesterdayLog?.sleep_hours ?? null;
  const proteinTodayPct = goalProtein ? Math.min(Math.round((todayProtein / goalProtein) * 100), 100) : undefined;
  const caloriesTodayPct = goalCalories ? Math.min(Math.round((todayCalories / goalCalories) * 100), 100) : undefined;
  const stepsTodayPct = goalSteps ? Math.min(Math.round((todaySteps / goalSteps) * 100), 100) : undefined;
  const sleepTodayPct = goalSleep && todaySleep != null ? Math.min(Math.round((todaySleep / goalSleep) * 100), 100) : undefined;
  const proteinVsYesterday = todayProtein - yesterdayProtein;
  const caloriesVsYesterday = todayCalories - yesterdayCalories;
  const stepsVsYesterday = todaySteps - yesterdaySteps;
  const sleepVsYesterday = todaySleep != null && yesterdaySleep != null ? todaySleep - yesterdaySleep : null;
  const hasWeeklySleep = sleepSeries.some((value) => value > 0);

  const stepsAvgPctForScore = Math.min(Math.round((stepsAvg / (goalSteps ?? 10000)) * 100), 100);
  const proteinPctForScore = Math.min(Math.round((proteinAvg / (goalProtein ?? 50)) * 100), 100);
  const caloriesPctForScore = Math.min(Math.round((caloriesAvg / (goalCalories ?? 2000)) * 100), 100);
  const stepsPts = hasData ? Math.round(stepsAvgPctForScore * 0.4) : 0;
  const proteinPts = hasData ? Math.round(proteinPctForScore * 0.3) : 0;
  const caloriesPts = hasData ? Math.round(caloriesPctForScore * 0.3) : 0;
  const personalScore = hasData ? stepsPts + proteinPts + caloriesPts : null;
  const personalTier = scoreTier(personalScore);

  const prevWeekAvgs = useMemo(() => rangeAverages(selectedProfileLogs, 7, 13), [selectedProfileLogs]);
  const prevWeekScore = prevWeekAvgs ? scoreFromAverages(prevWeekAvgs.steps, prevWeekAvgs.protein, prevWeekAvgs.calories) : null;
  const scoreDelta = personalScore !== null && prevWeekScore !== null ? personalScore - prevWeekScore : null;
  const daysLoggedThisWeek = useMemo(() => {
    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("en-CA");
    });
    return last7Dates.filter((date) => selectedProfileLogs.some((l) => l.logged_at === date && hasLoggedMetric(l))).length;
  }, [selectedProfileLogs]);
  const weeklyActivity = useMemo(() => {
    const loggedDates = new Set(selectedProfileLogs.filter(hasLoggedMetric).map((log) => log.logged_at));
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toLocaleDateString("en-CA");
      return {
        label: days[d.getDay() === 0 ? 6 : d.getDay() - 1],
        logged: loggedDates.has(key),
      };
    });
  }, [selectedProfileLogs]);
  const consistencyMessage = daysLoggedThisWeek === 7
    ? "Amazing consistency! 🎉"
    : daysLoggedThisWeek >= 5
    ? "Great job staying consistent!"
    : daysLoggedThisWeek >= 1
    ? "Keep logging to build your streak."
    : "Start logging today to see your trends.";

  const bestDay = weeklySteps.reduce((best, d) => (d.value > best.value ? d : best), weeklySteps[0] ?? { label: "—", value: 0 });

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
          <PageLoader
            title="Loading your health dashboard..."
            subtitle="We're preparing your insights and latest updates."
          />
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

  if (user && !featureIntroChecked) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PageLoader
            title="Preparing your quick guide..."
            subtitle="Just a moment before your dashboard opens."
          />
        </div>
      </div>
    );
  }

  const featureIntroOverlay = user && showFeatureIntro ? (
    <FeatureIntro
      onDone={() => {
        if (IS_PRODUCTION) {
          localStorage.setItem(`famcare_feature_intro_seen_${user.id}`, "true");
        }
        setShowFeatureIntro(false);
      }}
    />
  ) : null;

  if (!user || logs.length === 0) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main">
          <EmptyState userName={user?.name ?? undefined} />
        </div>
        {featureIntroOverlay}
      </div>
    );
  }

  const displayName = user.name ?? "there";
  const foodReminderEnabled = foodReminderPreference?.enabled ?? true;
  const avatarLetter = user.name
    ? user.name.charAt(0).toUpperCase()
    : user.phone.slice(-4, -3) || "U";
  const selfMember: FamilyMember = {
    id: user.id,
    phone: user.phone,
    name: user.name,
    label: "You",
    type: "self",
    status: "active",
    created_at: user.created_at,
  };
  const homeMemberRows = [
    { member: selfMember, summary, logs, events: logEvents, isSelf: true },
    ...memberRows.map((row) => ({ ...row, isSelf: false })),
  ];

  return (
    <div className="db-page">
      <Sidebar />
      {featureIntroOverlay}

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
            <StreakPill streak={streak} />
            <div className="food-reminder-control" ref={foodReminderMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowFoodReminderMenu((current) => !current)}
                disabled={savingFoodReminder}
                aria-pressed={foodReminderEnabled}
                aria-expanded={showFoodReminderMenu}
                className={`db-pill food-reminder-trigger${foodReminderEnabled ? " enabled" : ""}`}
                title={foodReminderEnabled
                  ? "Manage breakfast, lunch, dinner, and snack logging reminders"
                  : "Turn on meal logging reminders"}
              >
                <FEWheat size={15} />
                Food reminders
                <span className="food-reminder-status">{foodReminderEnabled ? "ON" : "OFF"}</span>
                <CaretDown size={14} weight="bold" />
              </button>
              {showFoodReminderMenu && (
                <div
                  className="food-reminder-menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    zIndex: 120,
                    width: "min(438px, calc(100vw - 28px))",
                    padding: 14,
                    border: "1px solid #DDF4E7",
                    borderRadius: 22,
                    background: "radial-gradient(circle at top left, rgba(32,168,101,.12), transparent 36%), #fff",
                    boxShadow: "0 22px 55px rgba(26, 38, 52, .16)",
                    fontFamily: "inherit",
                  }}
                >
                  <div className="food-reminder-menu-head" style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <strong style={{ display: "block", color: "var(--he-ink-1)", fontSize: 14.5, fontWeight: 900 }}>Food reminders</strong>
                      <span style={{ display: "block", marginTop: 3, color: "var(--he-ink-3)", fontSize: 11.5, fontWeight: 700, lineHeight: 1.35 }}>Choose what FamCare should remind you to log.</span>
                    </div>
                    <label
                      className="food-reminder-switch"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "6px 9px",
                        borderRadius: 999,
                        background: foodReminderDraftEnabled ? "#DDF7EA" : "#F1EEF2",
                        border: `1px solid ${foodReminderDraftEnabled ? "#BDEFD3" : "#E3DEE5"}`,
                        color: foodReminderDraftEnabled ? "var(--he-green-deep)" : "#8D92A1",
                        fontSize: 11,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={foodReminderDraftEnabled}
                        onChange={(event) => setFoodReminderDraftPower(event.target.checked)}
                        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                      />
                      <i
                        aria-hidden="true"
                        style={{
                          position: "relative",
                          width: 34,
                          height: 20,
                          borderRadius: 999,
                          background: foodReminderDraftEnabled ? "#33C879" : "#C8CDD4",
                          boxShadow: "inset 0 1px 2px rgba(0,0,0,.10)",
                        }}
                      >
                        <b
                          style={{
                            position: "absolute",
                            top: 3,
                            left: foodReminderDraftEnabled ? 17 : 3,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#fff",
                            boxShadow: "0 2px 5px rgba(16, 31, 23, .18)",
                          }}
                        />
                      </i>
                      <span>{foodReminderDraftEnabled ? "ON" : "OFF"}</span>
                    </label>
                  </div>

                  <div
                    className={`food-reminder-rows${foodReminderDraftEnabled ? "" : " disabled"}`}
                    style={{ display: "grid", gap: 8, opacity: foodReminderDraftEnabled ? 1 : 0.55 }}
                  >
                    {foodReminderDraftMeals.filter((meal) => meal.enabled).map((meal) => (
                      <div
                        className="food-reminder-row"
                        key={meal.slot}
                        style={{ display: "grid", gridTemplateColumns: "28px 1fr 124px 36px", gap: 8, alignItems: "center" }}
                      >
                        <label className="food-reminder-row-check" aria-label={`Enable ${meal.slot} reminder`} style={{ width: 28, height: 38, display: "grid", placeItems: "center", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={meal.enabled}
                            disabled={!foodReminderDraftEnabled}
                            onChange={(event) => setFoodReminderDraftMealEnabled(meal.slot, event.target.checked)}
                            style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                          />
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 7,
                              border: `1.5px solid ${meal.enabled ? "var(--he-green)" : "#DCE3E0"}`,
                              background: meal.enabled ? "var(--he-green)" : "#fff",
                              boxShadow: meal.enabled ? "inset 0 0 0 4px #fff" : "none",
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          value={meal.label}
                          placeholder="Reminder name"
                          maxLength={32}
                          disabled={!foodReminderDraftEnabled || !meal.enabled}
                          onChange={(event) => updateFoodReminderDraftMeal(meal.slot, { label: event.target.value })}
                          style={{
                            height: 38,
                            border: "1.5px solid #E8E3E5",
                            borderRadius: 12,
                            background: foodReminderDraftEnabled && meal.enabled ? "rgba(255,255,255,.88)" : "#F8F6F7",
                            color: foodReminderDraftEnabled && meal.enabled ? "var(--he-ink-1)" : "#A0A6AD",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 850,
                            padding: "0 10px",
                            outline: "none",
                          }}
                        />
                        <select
                          value={meal.time}
                          disabled={!foodReminderDraftEnabled || !meal.enabled}
                          onChange={(event) => updateFoodReminderDraftMeal(meal.slot, { time: event.target.value })}
                          style={{
                            height: 38,
                            border: "1.5px solid #E8E3E5",
                            borderRadius: 12,
                            background: foodReminderDraftEnabled && meal.enabled ? "rgba(255,255,255,.88)" : "#F8F6F7",
                            color: foodReminderDraftEnabled && meal.enabled ? "var(--he-ink-1)" : "#A0A6AD",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 850,
                            padding: "0 10px",
                            outline: "none",
                            cursor: foodReminderDraftEnabled && meal.enabled ? "pointer" : "not-allowed",
                          }}
                        >
                          {FOOD_REMINDER_TIME_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          aria-label={`Remove ${meal.label || "reminder"}`}
                          onClick={() => removeFoodReminderDraftMeal(meal.slot)}
                          disabled={!foodReminderDraftEnabled}
                          style={{
                            width: 36,
                            height: 38,
                            display: "grid",
                            placeItems: "center",
                            border: "1.5px solid #F0DDDD",
                            borderRadius: 12,
                            background: foodReminderDraftEnabled ? "#FFF7F6" : "#F8F6F7",
                            color: foodReminderDraftEnabled ? "var(--he-coral)" : "#A0A6AD",
                            cursor: foodReminderDraftEnabled ? "pointer" : "not-allowed",
                          }}
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </div>
                    ))}
                    {foodReminderDraftMeals.filter((meal) => meal.enabled).length < 5 && (
                      <button
                        type="button"
                        onClick={addFoodReminderDraftMeal}
                        disabled={!foodReminderDraftEnabled}
                        style={{
                          height: 42,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          border: "1.5px dashed #BDEFD3",
                          borderRadius: 14,
                          background: foodReminderDraftEnabled ? "#F3FCF7" : "#F8F6F7",
                          color: foodReminderDraftEnabled ? "var(--he-green-deep)" : "#A0A6AD",
                          fontFamily: "inherit",
                          fontSize: 12.5,
                          fontWeight: 900,
                          cursor: foodReminderDraftEnabled ? "pointer" : "not-allowed",
                        }}
                      >
                        <Plus size={15} weight="bold" />
                        Add reminder
                      </button>
                    )}
                  </div>

                  {foodReminderDraftError && (
                    <div
                      role="alert"
                      style={{
                        marginTop: 10,
                        padding: "9px 11px",
                        borderRadius: 12,
                        border: "1px solid #FFD6D1",
                        background: "#FFF5F3",
                        color: "#D94E45",
                        fontSize: 11.5,
                        fontWeight: 800,
                        lineHeight: 1.35,
                      }}
                    >
                      {foodReminderDraftError}
                    </div>
                  )}

                  <div className="food-reminder-menu-foot" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0ECEE" }}>
                    <span style={{ color: "var(--he-ink-3)", fontSize: 11.5, fontWeight: 800 }}>
                      {foodReminderDraftMeals.filter((meal) => meal.enabled).length} {foodReminderDraftMeals.filter((meal) => meal.enabled).length === 1 ? "reminder" : "reminders"} selected
                    </span>
                    <button
                      type="button"
                      onClick={saveFoodReminderSetup}
                      disabled={savingFoodReminder}
                      style={{
                        height: 36,
                        padding: "0 16px",
                        border: "none",
                        borderRadius: 12,
                        background: "linear-gradient(150deg, #38D184, var(--he-green))",
                        color: "#fff",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: savingFoodReminder ? "wait" : "pointer",
                        opacity: savingFoodReminder ? 0.72 : 1,
                        boxShadow: "0 9px 18px rgba(32,168,101,.22)",
                      }}
                    >
                      {savingFoodReminder ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
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
                    onClick={() => { setShowGoals(true); setShowAccountMenu(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 9,
                      padding: "11px 16px", background: "none", border: "none",
                      borderBottom: "1px solid #F2EFEF",
                      fontSize: 13.5, fontWeight: 700, color: "#2C2F3A", cursor: "pointer",
                      fontFamily: "inherit", textAlign: "left",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F9F8FA"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    <Star size={16} weight="bold" />
                    Set Goals
                  </button>
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

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 480px", minWidth: 320 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#2C2F3A", margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Family
              </h2>
              {memberRows.length > 0 && (
                <Link href="/dashboard/family-overview" style={{
                  display: "flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 700,
                  color: "#7C6FF7", textDecoration: "none",
                }}>
                  Manage <CaretRight size={11} weight="bold" />
                </Link>
              )}
            </div>
            <div
              ref={profileCarouselRef}
              onScroll={handleProfileCarouselScroll}
              className="db-profile-carousel"
              style={{ display: "flex", alignItems: "flex-start", gap: 16, overflowX: "auto", overflowY: "hidden", padding: "22px 8px 10px", scrollSnapType: "x proximity" }}
            >
              {homeMemberRows.map(({ member, summary: memberSummary, logs: memberLogs, events: memberEvents, isSelf }) => {
                const score = computeScore(memberSummary);
                const tier = scoreTier(score);
                const avatarLetter = (member.name ?? member.label).charAt(0).toUpperCase();
                const memberTodayLog = memberLogs.find((l) => l.logged_at === todayIST);
                const memberTodayCalories = memberTodayLog?.calories ?? null;
                const memberTodayProtein = memberTodayLog?.protein_g ?? null;
                const memberTodaySteps = memberTodayLog?.steps ?? null;
                const cardId = isSelf ? "self" : `member-${member.id}`;
                const isSelectedCard = selectedCardId === cardId;
                const sortedRecentEvents = [...memberEvents].sort(
                  (a, b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0),
                );
                const sortedRecentLogs = [...memberLogs].sort(
                  (a, b) => (new Date(`${b.logged_at}T00:00:00`).getTime() || 0) - (new Date(`${a.logged_at}T00:00:00`).getTime() || 0),
                );
                const recentCount = sortedRecentEvents.length || sortedRecentLogs.length;
                const recentLogItems = sortedRecentEvents.length > 0
                  ? sortedRecentEvents.slice(0, 2).map(recentItemFromEvent)
                  : sortedRecentLogs.slice(0, 2).map(recentItemFromAggregate);
                const visibleRecentItems = recentLogItems.length > 0
                  ? recentLogItems
                  : [{ key: "empty", message: "No logs yet", metrics: "Send a WhatsApp log" }];
                const isRecentOpen = recentLogsOpen[cardId] ?? false;
                const selectedTone = tier.label === "All good"
                  ? "good"
                  : tier.label === "Needs attention"
                  ? "attention"
                  : tier.label === "Action required"
                  ? "danger"
                  : "neutral";
                const unselectedBorderStart = withOpacity(tier.border, 0.7);
                const unselectedBorderEnd = withOpacity(tier.ring, 0.7);
                const selectProfile = () => {
                  setSelectedCardId(cardId);
                  captureEvent("dashboard_profile_selected", {
                    profile_type: isSelf ? "self" : "family",
                    member_id: isSelf ? undefined : member.id,
                  });
                };
                return (
                  <div
                    key={cardId}
                    className={`fo-member-card db-home-member-card${isSelectedCard ? ` is-selected-profile selected-profile-${selectedTone}` : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelectedCard}
                    onClick={selectProfile}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectProfile();
                      }
                    }}
                    style={{
                      flex: "0 0 300px", minWidth: 300,
                      background:
                        isSelectedCard
                          ? `linear-gradient(165deg, ${tier.bg} 0%, #fff 55%)`
                          : `linear-gradient(165deg, ${tier.bg} 0%, #fff 55%) padding-box, linear-gradient(135deg, ${unselectedBorderStart}, ${unselectedBorderEnd}) border-box`,
                      borderRadius: 24, border: isSelectedCard ? "none" : "1.5px solid transparent",
                      boxShadow: "0 4px 16px rgba(26,20,20,.05)", padding: "22px 22px 20px",
                      cursor: "pointer",
                      scrollSnapAlign: "start",
                      transform: isSelectedCard ? "translateY(-2px)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "relative" }}>
                      <div className="hm-head" style={{ display: "flex", gap: 11 }}>
                        <div className="hm-avatar" style={{
                          width: 42, height: 42, borderRadius: "50%",
                          background: `linear-gradient(150deg, ${tier.ring}, ${tier.textColor})`,
                          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 16, flexShrink: 0,
                          boxShadow: `0 4px 10px ${tier.ring}55`,
                        }}>
                          {avatarLetter}
                        </div>
                        <div>
                          <p className="hm-name" style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#1A2744" }}>{isSelf ? displayName : member.name ?? member.label}</p>
                          <p className="hm-label" style={{ margin: 0, fontSize: 11.5, color: "#9AA0AD" }}>{isSelf ? "You" : member.label}</p>
                          <span className="hm-badge" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: tier.bg, color: tier.textColor, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
                            {score !== null && (
                              score >= 40
                                ? <CheckCircle size={13} weight="fill" color={tier.ring} />
                                : <Warning size={13} weight="fill" color={tier.ring} />
                            )}
                            {tier.label}
                          </span>
                        </div>
                      </div>
                      <div className="hm-score" style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <ScoreRing score={score} tier={tier} size={68} />
                        <span className="hm-score-label" style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: tier.textColor }}>Score</span>
                      </div>
                    </div>
                    <div className="hm-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 20, textAlign: "center" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "center" }}><Flame size={20} color="#FF9F45" /></div>
                        <p className="hm-stat-val" style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberTodayCalories != null ? memberTodayCalories.toLocaleString() : "—"}</p>
                        <p className="hm-stat-label" style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Cal today</p>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "center" }}><Dumbbell size={20} color="#4F9BF5" /></div>
                        <p className="hm-stat-val" style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberTodayProtein != null ? `${memberTodayProtein.toFixed(0)}g` : "—"}</p>
                        <p className="hm-stat-label" style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Protein today</p>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "center" }}><Footprints size={20} color="#20A865" /></div>
                        <p className="hm-stat-val" style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberTodaySteps != null ? memberTodaySteps.toLocaleString() : "—"}</p>
                        <p className="hm-stat-label" style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Steps today</p>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 16,
                        border: `1.5px solid ${withOpacity(tier.border, 0.72)}`,
                        borderRadius: isRecentOpen ? "18px 18px 0 0" : 18,
                        borderBottomColor: isRecentOpen ? "transparent" : withOpacity(tier.border, 0.72),
                        background: "rgba(255,255,255,.72)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
                        overflow: "visible",
                        position: "relative",
                        zIndex: isRecentOpen ? 6 : 2,
                        transition: "border-radius .2s ease, border-color .2s ease",
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setRecentLogsOpen((current) => ({ ...current, [cardId]: !isRecentOpen }))}
                        style={{
                          width: "100%",
                          minHeight: 44,
                          border: "none",
                          background: "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                          cursor: "pointer",
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                          <span style={{
                            width: 28, height: 28, borderRadius: 10,
                            background: "#FFF0EE", color: "var(--he-coral)",
                            display: "inline-grid", placeItems: "center", flex: "none",
                          }}>
                            <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true" style={{ display: "block" }}>
                              <path d="M3 4h7M3 6.5h7M3 9h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </span>
                          <span style={{ color: "#1A2744", fontSize: 13.5, fontWeight: 900, whiteSpace: "nowrap" }}>Recent logs</span>
                          <span style={{
                            minWidth: 23, height: 23, borderRadius: 999,
                            background: "#FFE6E4", color: "var(--he-coral)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 900,
                          }}>
                            {recentCount}
                          </span>
                        </span>
                        <CaretDown
                          size={18}
                          weight="bold"
                          color="#1A2744"
                          style={{ flexShrink: 0, transform: isRecentOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .18s ease" }}
                        />
                      </button>
                      <div style={{
                        position: "absolute",
                        top: "100%",
                        left: -1.5,
                        right: -1.5,
                        height: 148,
                        clipPath: isRecentOpen ? "inset(0 0 0 0 round 0 0 18px 18px)" : "inset(0 0 100% 0 round 0 0 18px 18px)",
                        transform: isRecentOpen ? "translateY(0) scaleY(1)" : "translateY(-6px) scaleY(.98)",
                        overflow: "hidden",
                        pointerEvents: isRecentOpen ? "auto" : "none",
                        border: `1.5px solid ${withOpacity(tier.border, 0.72)}`,
                        borderTop: "none",
                        borderRadius: "0 0 18px 18px",
                        background: "#FFFFFF",
                        boxShadow: "0 18px 30px rgba(26, 39, 68, .12)",
                        transformOrigin: "top center",
                        zIndex: 20,
                        transition: "clip-path .28s cubic-bezier(.2,.8,.2,1), transform .28s cubic-bezier(.2,.8,.2,1)",
                      }}>
                        <div style={{
                          padding: "11px 12px 10px",
                          position: "relative",
                          zIndex: 1,
                        }}>
                          <div style={{ display: "grid", gap: 8 }}>
                            {visibleRecentItems.map((item) => (
                              <div
                                key={item.key}
                                style={{
                                  display: "flex",
                                  gap: 10,
                                  alignItems: "center",
                                  minWidth: 0,
                                  width: "100%",
                                }}
                              >
                                <span style={{ minWidth: 0, flex: "1 1 0", display: "inline-flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.key === "empty" ? "#D7DDE8" : "var(--he-coral)", flexShrink: 0 }} />
                                  <span style={{
                                    minWidth: 0,
                                    flex: "1 1 auto",
                                    color: "#1A2744",
                                    fontSize: 12.2,
                                    fontWeight: 900,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}>
                                    {item.message}
                                  </span>
                                </span>
                                <span style={{
                                  color: "#8790A8",
                                  fontSize: 10.4,
                                  fontWeight: 900,
                                  whiteSpace: "nowrap",
                                  textAlign: "right",
                                  flex: "0 1 118px",
                                  maxWidth: 118,
                                  minWidth: 72,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}>
                                  {item.metrics}
                                </span>
                              </div>
                            ))}
                          </div>
                          <Link
                            href="/dashboard/logs"
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              marginTop: 9,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: 4,
                              color: "#2F7DE1",
                              fontSize: 12,
                              fontWeight: 900,
                              textDecoration: "none",
                            }}
                          >
                            View all logs <CaretRight size={13} weight="bold" />
                          </Link>
                        </div>
                      </div>
                    </div>
                    <button
                      className="hm-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectProfile();
                      }}
                      style={{
                        width: "100%", marginTop: 18, padding: "10px 0", border: `1.5px solid ${tier.border}`, borderRadius: 14,
                        background: tier.bg, color: tier.textColor, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      {isSelectedCard ? "Selected" : "View profile"}
                      {!isSelectedCard && <CaretRight size={13} weight="bold" />}
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
            <div className="db-profile-scroll-track" aria-hidden="true">
              <span
                className="db-profile-scroll-thumb"
                style={{ transform: `translateX(${profileCarouselProgress * 68}px)` }}
              />
            </div>
          </div>
        </div>
        </div>

        <div className="db-wellness-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 11fr) minmax(420px, 9fr)", gap: 16, alignItems: "stretch" }}>
          <div className="db-card db-weekly-score-card" style={{ minWidth: 0, padding: "24px 26px 22px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 22 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#1A2744", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selectedProfilePossessive} Weekly Score</span>
              <div ref={scoreInfoRef} style={{ position: "relative", display: "flex" }}>
                <button
                  onClick={() => setShowScoreInfo(v => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}
                >
                  <Info size={15} weight="bold" color={showScoreInfo ? "#7C6FF7" : "#BFC4CE"} />
                </button>
                {showScoreInfo && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                    background: "#1A2744", color: "#fff", borderRadius: 14, padding: "14px 16px",
                    width: 260, zIndex: 50, boxShadow: "0 8px 28px rgba(26,20,20,.22)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}>
                    <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 6, overflow: "hidden" }}>
                      <div style={{ width: 10, height: 10, background: "#1A2744", transform: "rotate(45deg)", margin: "3px auto 0" }} />
                    </div>
                    <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, color: "#fff" }}>How your score is calculated</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {[
                        { label: "Steps", detail: "avg vs 10,000/day goal", weight: "40 pts" },
                        { label: "Protein", detail: "est. avg vs 50 g/day goal", weight: "30 pts" },
                        { label: "Calories", detail: "est. avg vs 2,000 kcal/day goal", weight: "30 pts" },
                      ].map(({ label, detail, weight }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{label}</span>
                            <span style={{ fontSize: 11, color: "#9AA0AD", marginLeft: 5 }}>{detail}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#7C6FF7", flexShrink: 0 }}>{weight}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 10.5, color: "#9AA0AD", lineHeight: 1.5 }}>
                      Each metric is scored as a % of goal, then weighted. Food nutrition values are estimates from your logged meals.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="db-weekly-score-body" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div className="db-weekly-score-ring" style={{
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

              <div className="db-weekly-score-breakdown" style={{ flex: "1 1 280px", minWidth: 240 }}>
                <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 800, color: "#1A2744" }}>Score Breakdown</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEShoe size={20} />
                    <span style={{ width: 78, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>Steps</span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: `${(stepsPts / 40) * 100}%`, background: "var(--he-green)" }} /></div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#9AA0AD" }}>{stepsPts}/40</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEProtein size={20} />
                    <span style={{ width: 78, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Protein <EstimateInfo />
                    </span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: `${(proteinPts / 30) * 100}%`, background: "var(--he-coral)" }} /></div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#9AA0AD" }}>{proteinPts}/30</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEWheat size={20} />
                    <span style={{ width: 78, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Calories <EstimateInfo />
                    </span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: `${(caloriesPts / 30) * 100}%`, background: "#FFB877" }} /></div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#9AA0AD" }}>{caloriesPts}/30</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FEMoon size={20} />
                    <span style={{ width: 78, fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>Sleep</span>
                    <div className="db-bar-track" style={{ flex: 1, margin: 0 }}><div className="db-bar-fill" style={{ width: `${Math.min(Math.round((sleepAvg / 8) * 100), 100)}%`, background: "#8B7FE8" }} /></div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#9AA0AD" }}>{sleepAvg ? `${sleepAvg.toFixed(1)}h` : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--he-hairline)", margin: "22px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
              <div className="wa-card" style={{ border: "1px solid var(--he-card-border)", borderRadius: 20, padding: "20px 22px", background: "#fff", boxShadow: "0 10px 26px rgba(31,28,35,.04)" }}>
                <div className="wa-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <span className="wa-head-ic" style={{ width: 48, height: 48, borderRadius: 16, background: "var(--he-orange-bg)", display: "grid", placeItems: "center", flex: "none" }}>
                      <CalendarBlank size={24} weight="bold" color="var(--he-orange-deep)" />
                    </span>
                    <span>
                      <span className="wa-title" style={{ display: "block", color: "#1A2744", fontSize: 20, fontWeight: 900, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-.3px" }}>7-Day Activity</span>
                      <span className="wa-subtitle" style={{ display: "block", color: "#7C84A8", fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>{selectedProfilePossessive} logging this week</span>
                    </span>
                  </div>
                  <span className="wa-badge" style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, background: "var(--he-green-bg)", color: "var(--he-green-deep)", padding: "8px 13px", fontSize: 13.5, fontWeight: 900, whiteSpace: "nowrap" }}>
                    <CheckCircle size={16} weight="fill" />
                    {daysLoggedThisWeek}/7 days
                  </span>
                </div>

                <div className="wa-days" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10, alignItems: "center" }}>
                  {weeklyActivity.map((d, i) => {
                    const colors = d.logged
                      ? { bg: "var(--he-orange-bg)", border: "#FFD8AE", text: "var(--he-orange-deep)" }
                      : { bg: "var(--he-blue-bg)", border: "#D4E8FF", text: "var(--he-blue-deep)" };
                    return (
                      <div key={i} className="wa-day" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span className="wa-day-label" style={{ color: "#5A6170", fontSize: 12, fontWeight: 800 }}>
                          <span className="wa-day-label-full">{d.label}</span>
                          <span className="wa-day-label-short">{d.label.slice(0, 1)}</span>
                        </span>
                        <span className="wa-day-ic" style={{ width: 48, height: 48, borderRadius: "50%", background: colors.bg, border: `1.5px solid ${colors.border}`, display: "grid", placeItems: "center", color: colors.text, boxShadow: "0 8px 18px rgba(31,28,35,.05)" }}>
                          {d.logged ? <FEFlame size={22} /> : <Minus size={22} weight="bold" />}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="wa-legend" style={{ borderTop: "1px dashed #ECE8EE", marginTop: 22, paddingTop: 16, display: "flex", justifyContent: "center", gap: 22, flexWrap: "wrap", color: "#7C84A8", fontSize: 12.5, fontWeight: 800 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><FEFlame size={17} /> Logged</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Minus size={17} weight="bold" color="var(--he-blue)" /> Missed</span>
                </div>
              </div>

            </div>

            <div className="wa-highlights" style={{
              marginTop: 18,
              border: "1px solid #CFEFDC",
              background: "linear-gradient(135deg, #F7FFFA, #FFFFFF)",
              borderRadius: 20,
              padding: "16px 18px",
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
              alignItems: "center",
            }}>
              {[
                { icon: "🏆", label: "Best day", value: bestDay.label, color: "var(--he-green-deep)" },
                { icon: "👟", label: "Most steps", value: `${bestDay.value.toLocaleString()} steps`, color: "var(--he-blue-deep)" },
                { icon: "🔥", label: "Logging streak", value: `${streak} ${streak === 1 ? "day" : "days"}`, color: "var(--he-orange-deep)" },
              ].map((item, index) => (
                <div key={item.label} className="wa-highlight" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minWidth: 0, borderLeft: index === 0 ? "none" : "1px solid #DDEFE5", paddingLeft: index === 0 ? 0 : 14 }}>
                  <span className="wa-highlight-ic" style={{ width: 44, height: 44, borderRadius: "50%", background: index === 0 ? "var(--he-green-bg)" : index === 1 ? "var(--he-blue-bg)" : "var(--he-orange-bg)", display: "grid", placeItems: "center", fontSize: 20, flex: "none" }}>{item.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="wa-highlight-label" style={{ display: "block", color: "#7C84A8", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{item.label}</span>
                    <span className="wa-highlight-val" style={{ display: "block", color: item.color, fontSize: 18, fontWeight: 900, lineHeight: 1.12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ minWidth: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, alignContent: "start" }}>
              <MetricTile
                icon={<FEProtein size={16} />} label={`${selectedProfilePossessive} Protein today`}
                color="var(--he-coral)" deepColor="var(--he-coral-deep)" chipBg="var(--he-coral-bg-2)" stripBg="var(--he-coral-bg)"
                value={todayProtein ? todayProtein.toFixed(0) : "—"} unit="g"
                goalText={goalProtein ? `of ${goalProtein}g goal` : undefined}
                pct={proteinTodayPct}
                deltaDown={proteinVsYesterday < 0}
                deltaText={`${Math.abs(proteinVsYesterday).toFixed(0)}g vs yesterday`}
                sparkline={proteinSeries}
                onClick={() => setMetricDetail({ label: "Protein", data: weeklyProtein, color: "#FF6B6B", unit: "g", goal: goalProtein ?? undefined, decimals: 0 })}
                onSetGoal={selectedProfileIsSelf ? () => setShowGoals(true) : undefined}
                estimated
              />
              <MetricTile
                icon={<FEWheat size={16} />} label={`${selectedProfilePossessive} Calories today`}
                color="var(--he-orange)" deepColor="var(--he-orange-deep)" chipBg="var(--he-orange-bg-2)" stripBg="var(--he-orange-bg)"
                value={todayCalories ? todayCalories.toLocaleString() : "—"} unit="kcal"
                goalText={goalCalories ? `of ${goalCalories.toLocaleString()} kcal goal` : undefined}
                pct={caloriesTodayPct}
                deltaDown={caloriesVsYesterday < 0}
                deltaText={`${Math.abs(caloriesVsYesterday).toLocaleString()} kcal vs yesterday`}
                sparkline={caloriesSeries}
                onClick={() => setMetricDetail({ label: "Calories", data: weeklyCalories, color: "#FF9F45", unit: "kcal", goal: goalCalories ?? undefined })}
                onSetGoal={selectedProfileIsSelf ? () => setShowGoals(true) : undefined}
                estimated
              />
              <MetricTile
                icon={<FEShoe size={16} />} label={`${selectedProfilePossessive} Steps today`}
                color="var(--he-green)" deepColor="var(--he-green-deep)" chipBg="var(--he-green-bg-2)" stripBg="var(--he-green-bg)"
                value={todaySteps ? todaySteps.toLocaleString() : "—"}
                goalText={goalSteps ? `of ${goalSteps.toLocaleString()} steps goal` : undefined}
                pct={stepsTodayPct}
                deltaDown={stepsVsYesterday < 0}
                deltaText={`${Math.abs(stepsVsYesterday).toLocaleString()} vs yesterday`}
                sparkline={stepsSeries}
                onClick={() => setMetricDetail({ label: "Steps", data: weeklySteps, color: "#2FBE76", unit: "steps", goal: goalSteps ?? undefined })}
                onSetGoal={selectedProfileIsSelf ? () => setShowGoals(true) : undefined}
              />
              <MetricTile
                icon={<FEMoon size={16} />} label={`${selectedProfilePossessive} Sleep today`}
                color="#8B7FE8" deepColor="#6A5BD0" chipBg="#E4E0FB" stripBg="var(--he-violet-bg)"
                value={todaySleep != null ? todaySleep.toFixed(1) : "—"} unit="hrs"
                goalText={goalSleep ? `of ${goalSleep}h goal` : undefined}
                pct={sleepTodayPct}
                deltaDown={(sleepVsYesterday ?? 0) < 0}
                deltaText={
                  todaySleep == null
                    ? "No sleep logged today"
                    : sleepVsYesterday == null
                    ? "Logged today"
                    : `${Math.abs(sleepVsYesterday).toFixed(1)}h vs yesterday`
                }
                sparkline={sleepSeries}
                onClick={hasWeeklySleep ? () => setMetricDetail({ label: "Sleep", data: weeklySleep, color: "#8B7FE8", unit: "hrs", goal: goalSleep ?? undefined, decimals: 1 }) : undefined}
                onSetGoal={selectedProfileIsSelf ? () => setShowGoals(true) : undefined}
              />
              <div className="db-card" style={{
                gridColumn: "1 / -1",
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
                {selectedProfileSubject} logged {daysLoggedThisWeek} of 7 days this week
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

      {showAddFamily && (
        <AddFamilyModal
          onClose={() => setShowAddFamily(false)}
          onAdded={(member) => {
            setMemberRows((rows) => {
              const idx = rows.findIndex((r) => r.member.id === member.id);
              if (idx === -1) return [...rows, { member, summary: null, logs: [], events: [] }];
              const next = [...rows];
              next[idx] = { ...next[idx], member };
              return next;
            });
            captureEvent("family_member_added", {
              member_id: member.id,
              member_status: member.status,
              member_type: member.type,
            });
          }}
          onActivated={() => loadDashboard(true)}
        />
      )}

      {metricDetail && (
        <MetricDetailFloater
          detail={metricDetail}
          onClose={() => setMetricDetail(null)}
          onSetGoal={selectedProfileIsSelf ? () => setShowGoals(true) : undefined}
        />
      )}

      {showGoals && user && (
        <GoalsModal
          user={user}
          token={localStorage.getItem("auth_token") ?? ""}
          onSave={(updated) => setUser(updated)}
          onClose={() => setShowGoals(false)}
        />
      )}
    </div>
  );
}
