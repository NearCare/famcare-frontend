"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarBlank,
  CaretDown,
  ChatCircleText,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Dumbbell, Footprints } from "lucide-react";
import Sidebar from "../components/Sidebar";
import PageLoader from "../components/PageLoader";
import { FEFlame } from "../components/FluentEmoji";
import {
  getFamilyMembers,
  getMemberLogEvents,
  getMemberLogs,
  correctLogValues,
  markLogIncorrect,
  deleteLog,
  getUserLogEvents,
  getUserLogs,
  type FamilyMember,
  type HealthLog,
  type HealthLogEvent,
  type User,
} from "@/lib/api";

type LogStatus = "logged" | "estimated" | "failed";

type LogDelta = {
  calories?: number;
  proteinG?: number;
  steps?: number;
  sleepHours?: number;
};

type HealthLogRow = {
  id: string;
  userId: number;
  eventId?: number;
  aggregateLogId?: number;
  sortKey: number;
  loggedAt: string;
  time: string;
  day: string;
  member: string;
  avatar: string;
  source: "text" | "voice";
  message: string;
  status: LogStatus;
  confidence: "High" | "Medium" | "Low";
  summary: string;
  delta: LogDelta;
};

type TimeWindowKey = "24h" | "yesterday" | "7d" | "30d" | "90d";

const TIME_WINDOWS: { key: TimeWindowKey; label: string; days: number }[] = [
  { key: "24h", label: "Last 24 hours", days: 2 },
  { key: "yesterday", label: "Yesterday", days: 2 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
];

function getTimeWindow(key: TimeWindowKey) {
  return TIME_WINDOWS.find((window) => window.key === key) ?? TIME_WINDOWS[2];
}

function getMemberName(user: User, member?: FamilyMember) {
  if (!member) return user.name?.trim() || "You";
  return member.label?.trim() || member.name?.trim() || member.phone;
}

function avatarFor(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

function dayLabel(dateString: string) {
  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString("en-CA");
  if (dateString === today) return "Today";
  if (dateString === yesterdayKey) return "Yesterday";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function timeLabel(createdAt: string, loggedAt: string) {
  const date = new Date(createdAt);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }
  return dayLabel(loggedAt);
}

function eventStatus(event: HealthLogEvent): LogStatus {
  if (event.calories != null || event.protein_g != null) return "estimated";
  if (event.steps != null || event.sleep_hours != null) return "logged";
  return "failed";
}

function eventToRow(event: HealthLogEvent, user: User, member?: FamilyMember): HealthLogRow {
  const memberName = getMemberName(user, member);
  return {
    id: `event-${event.user_id}-${event.id}`,
    userId: event.user_id,
    eventId: event.id,
    sortKey: new Date(event.created_at).getTime() || new Date(`${event.logged_at}T00:00:00`).getTime(),
    loggedAt: event.logged_at,
    time: timeLabel(event.created_at, event.logged_at),
    day: dayLabel(event.logged_at),
    member: memberName,
    avatar: avatarFor(memberName),
    source: event.source,
    message: event.raw_message,
    status: eventStatus(event),
    confidence: event.calories != null || event.protein_g != null ? "Medium" : "High",
    summary: event.summary ?? "Logged from WhatsApp.",
    delta: {
      calories: event.calories ?? undefined,
      proteinG: event.protein_g ?? undefined,
      steps: event.steps ?? undefined,
      sleepHours: event.sleep_hours ?? undefined,
    },
  };
}

function aggregateToRow(log: HealthLog, user: User, member?: FamilyMember): HealthLogRow {
  const memberName = getMemberName(user, member);
  const hasNutrition = log.calories != null || log.protein_g != null;
  return {
    id: `aggregate-${log.user_id}-${log.id}`,
    userId: log.user_id,
    aggregateLogId: log.id,
    sortKey: new Date(`${log.logged_at}T00:00:00`).getTime(),
    loggedAt: log.logged_at,
    time: dayLabel(log.logged_at),
    day: dayLabel(log.logged_at),
    member: memberName,
    avatar: avatarFor(memberName),
    source: log.raw_message?.startsWith("[voice]") ? "voice" : "text",
    message: log.raw_message || "Daily aggregate log",
    status: hasNutrition ? "estimated" : "logged",
    confidence: hasNutrition ? "Medium" : "High",
    summary: "Daily total from older aggregate logs.",
    delta: {
      calories: log.calories ?? undefined,
      proteinG: log.protein_g ?? undefined,
      steps: log.steps ?? undefined,
      sleepHours: log.sleep_hours ?? undefined,
    },
  };
}

function formatDelta(delta: LogDelta) {
  const chips = [];
  if (delta.calories) chips.push({ label: `+${delta.calories.toLocaleString()} kcal`, tone: "orange" });
  if (delta.proteinG) chips.push({ label: `+${delta.proteinG}g protein`, tone: "green" });
  if (delta.steps) chips.push({ label: `+${delta.steps.toLocaleString()} steps`, tone: "blue" });
  if (delta.sleepHours) chips.push({ label: `+${delta.sleepHours}h sleep`, tone: "violet" });
  return chips;
}

function chipColors(tone: string) {
  if (tone === "green") return { bg: "var(--he-green-bg)", color: "var(--he-green-deep)", border: "#CFEFDC" };
  if (tone === "blue") return { bg: "var(--he-blue-bg)", color: "var(--he-blue-deep)", border: "#D4E8FF" };
  if (tone === "violet") return { bg: "var(--he-violet-bg)", color: "#6A5BD0", border: "#DED8FF" };
  return { bg: "var(--he-orange-bg)", color: "var(--he-orange-deep)", border: "#FFE1BE" };
}

function statusMeta(status: LogStatus) {
  if (status === "logged") return { label: "Logged", icon: CheckCircle, color: "var(--he-green-deep)", bg: "var(--he-green-bg)" };
  if (status === "estimated") return { label: "Estimated", icon: WarningCircle, color: "var(--he-orange-deep)", bg: "var(--he-orange-bg)" };
  return { label: "Needs review", icon: XCircle, color: "var(--he-coral-deep)", bg: "var(--he-coral-bg)" };
}

function statusFromDelta(delta: LogDelta): LogStatus {
  if (delta.calories != null || delta.proteinG != null) return "estimated";
  if (delta.steps != null || delta.sleepHours != null) return "logged";
  return "failed";
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "orange" | "blue" | "violet";
}) {
  const colors = chipColors(tone);
  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid var(--he-card-border)",
      borderRadius: 12,
      padding: "10px 12px",
      boxShadow: "0 2px 8px rgba(31,28,35,.04)",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: colors.bg, color: colors.color, display: "grid", placeItems: "center", flex: "none" }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, color: "#1A2744", fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{value}</p>
        <p style={{ margin: "3px 0 0", color: "#9AA0AD", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
      </div>
    </div>
  );
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        fill="#25D366"
        d="M16 3.2A12.74 12.74 0 0 0 5.2 22.7L4 28l5.42-1.17A12.76 12.76 0 1 0 16 3.2Z"
      />
      <path
        fill="#fff"
        d="M23.4 19.14c-.4-.2-2.33-1.15-2.7-1.28-.36-.13-.63-.2-.9.2-.26.4-1.03 1.28-1.26 1.54-.23.27-.46.3-.86.1-.4-.2-1.68-.62-3.2-1.97-1.18-1.05-1.98-2.35-2.21-2.75-.23-.4-.03-.62.17-.82.18-.17.4-.46.6-.7.2-.23.27-.4.4-.66.13-.27.07-.5-.03-.7-.1-.2-.9-2.16-1.23-2.96-.32-.78-.65-.67-.9-.68h-.77c-.27 0-.7.1-1.06.5-.36.4-1.4 1.37-1.4 3.34s1.43 3.87 1.63 4.14c.2.27 2.82 4.3 6.83 6.03.95.41 1.7.66 2.28.84.96.3 1.83.26 2.52.16.77-.12 2.33-.95 2.66-1.87.33-.92.33-1.7.23-1.87-.1-.16-.36-.26-.76-.46Z"
      />
    </svg>
  );
}

type EditLogValues = {
  calories: string;
  proteinG: string;
  steps: string;
  sleepHours: string;
};

function SelectedDetail({
  log,
  busyAction,
  notice,
  onSaveValues,
  onMarkIncorrect,
  onDeleteLog,
}: {
  log: HealthLogRow;
  busyAction: "edit" | "incorrect" | "delete" | null;
  notice: string | null;
  onSaveValues: (log: HealthLogRow, values: LogDelta) => Promise<void>;
  onMarkIncorrect: (log: HealthLogRow) => Promise<void>;
  onDeleteLog: (log: HealthLogRow) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<EditLogValues>({
    calories: "",
    proteinG: "",
    steps: "",
    sleepHours: "",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditing(false);
    setEditError(null);
    setConfirmDelete(false);
    setEditValues({
      calories: log.delta.calories?.toString() ?? "",
      proteinG: log.delta.proteinG?.toString() ?? "",
      steps: log.delta.steps?.toString() ?? "",
      sleepHours: log.delta.sleepHours?.toString() ?? "",
    });
  }, [log.id, log.delta.calories, log.delta.proteinG, log.delta.steps, log.delta.sleepHours]);

  const additions = [
    { label: "Calories", value: log.delta.calories ? `+${log.delta.calories} kcal` : "No change", tone: "orange" },
    { label: "Protein", value: log.delta.proteinG ? `+${log.delta.proteinG}g` : "No change", tone: "green" },
    { label: "Steps", value: log.delta.steps ? `+${log.delta.steps.toLocaleString()}` : "No change", tone: "blue" },
    { label: "Sleep", value: log.delta.sleepHours ? `+${log.delta.sleepHours}h` : "No change", tone: "violet" },
  ];
  const meta = statusMeta(log.status);
  const StatusIcon = meta.icon;
  const submitting = busyAction != null;

  function updateEditValue(key: keyof EditLogValues, value: string) {
    setEditError(null);
    setEditValues((current) => ({ ...current, [key]: value }));
  }

  function parseOptionalNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return { ok: true as const, value: undefined };
    const parsed = Number(trimmed);
    return Number.isFinite(parsed)
      ? { ok: true as const, value: parsed }
      : { ok: false as const };
  }

  async function handleSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = {
      calories: parseOptionalNumber(editValues.calories),
      proteinG: parseOptionalNumber(editValues.proteinG),
      steps: parseOptionalNumber(editValues.steps),
      sleepHours: parseOptionalNumber(editValues.sleepHours),
    };
    if (Object.values(parsed).some((result) => !result.ok)) {
      setEditError("Enter valid numbers only.");
      return;
    }
    const nextValues = {
      calories: parsed.calories.value,
      proteinG: parsed.proteinG.value,
      steps: parsed.steps.value,
      sleepHours: parsed.sleepHours.value,
    };
    if (Object.values(nextValues).every((value) => value == null)) {
      setEditError("Add at least one value before saving.");
      return;
    }
    await onSaveValues(log, nextValues);
    setEditing(false);
  }

  return (
    <aside className="logs-detail-panel" style={{
      background: "#fff",
      border: "1.5px solid var(--he-card-border)",
      borderRadius: 18,
      padding: 20,
      boxShadow: "0 12px 32px rgba(31,28,35,.05)",
      position: "sticky",
      top: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: "#1A2744", fontSize: 18, fontWeight: 900 }}>Selected log</h2>
          <p style={{ margin: "4px 0 0", color: "#9AA0AD", fontSize: 12.5, fontWeight: 700 }}>{log.member} · {log.time}</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: meta.bg, color: meta.color, borderRadius: 999, padding: "7px 10px", fontSize: 11.5, fontWeight: 900, whiteSpace: "nowrap" }}>
          <StatusIcon size={14} weight="fill" /> {meta.label}
        </span>
      </div>

      <div style={{ background: "#FAFAFA", borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <p style={{ margin: "0 0 7px", color: "#7C84A8", fontSize: 11.5, fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 7 }}>
          <WhatsAppIcon /> Original message
        </p>
        <p style={{ margin: 0, color: "#1A2744", fontSize: 14, fontWeight: 800, lineHeight: 1.55 }}>&ldquo;{log.message}&rdquo;</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
        <p style={{ margin: "0 0 2px", color: "#1A2744", fontSize: 13.5, fontWeight: 900 }}>Added to daily total</p>
        {additions.map((item) => {
          const colors = chipColors(item.tone);
          const changed = item.value !== "No change";
          return (
            <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #F0EEF5", borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ color: "#7C84A8", fontSize: 12.5, fontWeight: 800 }}>{item.label}</span>
              <span style={{ color: changed ? colors.color : "#B0B5C2", background: changed ? colors.bg : "#FAFAFA", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 }}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          disabled={submitting}
          style={{ height: 42, border: "none", borderRadius: 12, background: "var(--he-coral)", color: "#fff", fontSize: 13, fontWeight: 900, cursor: submitting ? "wait" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: submitting ? .72 : 1 }}
        >
          <PencilSimple size={15} weight="bold" /> Edit values
        </button>
        <button
          type="button"
          onClick={() => onMarkIncorrect(log)}
          disabled={submitting}
          style={{ height: 42, border: "1.5px solid var(--he-card-border)", borderRadius: 12, background: "#fff", color: "#5A6170", fontSize: 13, fontWeight: 900, cursor: submitting ? "wait" : "pointer", opacity: submitting ? .72 : 1 }}
        >
          {busyAction === "incorrect" ? "Saving..." : "Mark incorrect"}
        </button>
      </div>

      {confirmDelete ? (
        <div style={{ marginTop: 10, background: "#FFF4F4", border: "1px solid #FFD7D7", borderRadius: 14, padding: 14 }}>
          <p style={{ margin: 0, color: "#2C2F3A", fontSize: 13, fontWeight: 800 }}>Delete this log entry?</p>
          <p style={{ margin: "5px 0 0", color: "#7A8099", fontSize: 12, lineHeight: 1.45 }}>
            This removes it from daily totals and can&apos;t be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={submitting}
              style={{ border: "1px solid #E7E4EE", borderRadius: 999, background: "#fff", color: "#5A5F6E", padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDeleteLog(log);
                setConfirmDelete(false);
              }}
              disabled={submitting}
              style={{ border: "none", borderRadius: 999, background: submitting ? "#F3A0A0" : "#E85C5C", color: "#fff", padding: "9px 14px", fontSize: 12, fontWeight: 900, cursor: submitting ? "not-allowed" : "pointer" }}
            >
              {busyAction === "delete" ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={submitting}
          style={{ marginTop: 10, width: "100%", height: 42, border: "1.5px solid #FFD7D7", borderRadius: 12, background: "#FFF4F4", color: "#E85C5C", fontSize: 13, fontWeight: 900, cursor: submitting ? "wait" : "pointer", opacity: submitting ? .72 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        >
          <Trash size={15} weight="bold" /> Delete log
        </button>
      )}

      {notice && (
        <div style={{ marginTop: 12, borderRadius: 12, padding: "10px 12px", background: "var(--he-green-bg)", color: "var(--he-green-deep)", fontSize: 12.5, fontWeight: 900 }}>
          {notice}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmitEdit} style={{ marginTop: 14, border: "1.5px solid var(--he-card-border)", borderRadius: 14, padding: 12, background: "#FAFAFA" }}>
          <p style={{ margin: "0 0 10px", color: "#1A2744", fontSize: 13, fontWeight: 900 }}>Correct values</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {([
              ["calories", "Calories"],
              ["proteinG", "Protein (g)"],
              ["steps", "Steps"],
              ["sleepHours", "Sleep (h)"],
            ] as const).map(([key, label]) => (
              <label key={key} style={{ display: "grid", gap: 5, color: "#7C84A8", fontSize: 11.5, fontWeight: 900 }}>
                {label}
                <input
                  value={editValues[key]}
                  onChange={(event) => updateEditValue(key, event.target.value)}
                  type="number"
                  min="0"
                  max={key === "sleepHours" ? 24 : undefined}
                  step={key === "proteinG" || key === "sleepHours" ? "0.1" : "1"}
                  placeholder="No change"
                  style={{ width: "100%", boxSizing: "border-box", height: 38, border: "1.5px solid var(--he-card-border)", borderRadius: 10, outline: "none", padding: "0 10px", color: "#1A2744", fontFamily: "inherit", fontSize: 13, fontWeight: 800, background: "#fff" }}
                />
              </label>
            ))}
          </div>
          {editError && (
            <div style={{ marginTop: 10, color: "var(--he-coral-deep)", fontSize: 12, fontWeight: 900 }}>
              {editError}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setEditing(false)} disabled={submitting} style={{ height: 38, border: "1.5px solid var(--he-card-border)", borderRadius: 10, background: "#fff", color: "#5A6170", fontFamily: "inherit", fontSize: 12.5, fontWeight: 900, cursor: submitting ? "wait" : "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ height: 38, border: "none", borderRadius: 10, background: "var(--he-coral)", color: "#fff", fontFamily: "inherit", fontSize: 12.5, fontWeight: 900, cursor: submitting ? "wait" : "pointer" }}>
              {busyAction === "edit" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}

export default function LogsPage() {
  const [query, setQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState("All");
  const [timeWindow, setTimeWindow] = useState<TimeWindowKey>("7d");
  const [selectedId, setSelectedId] = useState("");
  const [rows, setRows] = useState<HealthLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"edit" | "incorrect" | "delete" | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchDays = getTimeWindow(timeWindow).days;

    async function loadLogs() {
      try {
        setLoading(true);
        setError(null);
        const stored = localStorage.getItem("auth_user");
        const user: User | null = stored ? JSON.parse(stored) : null;
        const token = localStorage.getItem("auth_token") ?? "";
        if (!user || !token) {
          window.location.href = "/login";
          return;
        }

        const [ownEvents, ownDailyLogs, members] = await Promise.all([
          getUserLogEvents(user.id, fetchDays).catch(() => []),
          getUserLogs(user.id, fetchDays).catch(() => []),
          getFamilyMembers(token).catch(() => []),
        ]);

        const activeMembers = members.filter((member) => member.status === "active");
        const familyRows = await Promise.all(
          activeMembers.map(async (member) => {
            const [events, dailyLogs] = await Promise.all([
              getMemberLogEvents(member.id, token, fetchDays).catch(() => []),
              getMemberLogs(member.id, token, fetchDays).catch(() => []),
            ]);
            return events.length
              ? events.map((event) => eventToRow(event, user, member))
              : dailyLogs.map((log) => aggregateToRow(log, user, member));
          }),
        );

        const ownRows = ownEvents.length
          ? ownEvents.map((event) => eventToRow(event, user))
          : ownDailyLogs.map((log) => aggregateToRow(log, user));
        const nextRows = [...ownRows, ...familyRows.flat()].sort((a, b) => b.sortKey - a.sortKey);

        if (!cancelled) {
          setRows(nextRows);
          setSelectedId((current) => current || nextRows[0]?.id || "");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLogs();
    return () => { cancelled = true; };
  }, [timeWindow]);

  const familyMembers = useMemo(() => ["All", ...Array.from(new Set(rows.map((log) => log.member)))], [rows]);
  const timeFilteredRows = useMemo(() => {
    if (timeWindow === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const key = yesterday.toLocaleDateString("en-CA");
      return rows.filter((log) => log.loggedAt === key);
    }
    if (timeWindow === "24h") {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      return rows.filter((log) => log.sortKey >= since);
    }
    return rows;
  }, [rows, timeWindow]);
  const memberLogs = useMemo(() => (
    selectedMember === "All" ? timeFilteredRows : timeFilteredRows.filter((log) => log.member === selectedMember)
  ), [selectedMember, timeFilteredRows]);
  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return memberLogs;
    return memberLogs.filter((log) =>
      [log.member, log.message, log.status, log.summary].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [memberLogs, query]);
  const selected = filteredLogs.length ? (filteredLogs.find((log) => log.id === selectedId) ?? filteredLogs[0]) : undefined;

  useEffect(() => {
    if (filteredLogs.length && !filteredLogs.some((log) => log.id === selectedId)) {
      setSelectedId(filteredLogs[0].id);
    }
  }, [filteredLogs, selectedId]);

  useEffect(() => {
    setActionNotice(null);
  }, [selectedId]);

  const totals = useMemo(() => memberLogs.reduce(
    (acc, log) => ({
      logs: acc.logs + (log.status !== "failed" ? 1 : 0),
      calories: acc.calories + (log.delta.calories ?? 0),
      proteinG: acc.proteinG + (log.delta.proteinG ?? 0),
      steps: acc.steps + (log.delta.steps ?? 0),
    }),
    { logs: 0, calories: 0, proteinG: 0, steps: 0 },
  ), [memberLogs]);

  async function handleSaveValues(log: HealthLogRow, values: LogDelta) {
    setBusyAction("edit");
    setActionNotice(null);
    setError(null);
    const nextDelta: LogDelta = {
      calories: values.calories,
      proteinG: values.proteinG,
      steps: values.steps,
      sleepHours: values.sleepHours,
    };
    if (Object.values(nextDelta).every((value) => value == null)) {
      setBusyAction(null);
      setError("Add at least one value before saving.");
      return;
    }
    try {
      await correctLogValues({
        event_id: log.eventId,
        log_id: log.aggregateLogId,
        calories: nextDelta.calories ?? null,
        protein_g: nextDelta.proteinG ?? null,
        steps: nextDelta.steps ?? null,
        sleep_hours: nextDelta.sleepHours ?? null,
      });
      setRows((current) => current.map((row) => (
        row.id === log.id
          ? {
              ...row,
              delta: nextDelta,
              status: statusFromDelta(nextDelta),
              summary: "Corrected from dashboard.",
            }
          : row
      )));
      setActionNotice("Updated. Daily totals now use these corrected values.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update log values");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMarkIncorrect(log: HealthLogRow) {
    setBusyAction("incorrect");
    setActionNotice(null);
    setError(null);
    try {
      await markLogIncorrect({
        event_id: log.eventId,
        log_id: log.aggregateLogId,
      });
      setActionNotice("Marked incorrect. Saved to the review table for verification.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark log incorrect");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteLog(log: HealthLogRow) {
    setBusyAction("delete");
    setActionNotice(null);
    setError(null);
    try {
      await deleteLog({
        event_id: log.eventId,
        log_id: log.aggregateLogId,
      });
      setRows((current) => current.filter((row) => row.id !== log.id));
      setSelectedId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete log");
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PageLoader
            title="Loading health logs..."
            subtitle="We're fetching WhatsApp logs and the values added to totals."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="db-page">
      <Sidebar />
      <div className="db-main">
        <div className="db-topbar">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <h1 className="db-greeting">Health Logs</h1>
              <label className="db-pill" style={{ cursor: "pointer", position: "relative", paddingRight: 12, minHeight: 46 }}>
                <CalendarBlank size={17} weight="bold" />
                <select
                  value={timeWindow}
                  onChange={(event) => setTimeWindow(event.target.value as TimeWindowKey)}
                  aria-label="Select logs time window"
                  style={{
                    appearance: "none",
                    WebkitAppearance: "none",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "inherit",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    fontWeight: 800,
                    cursor: "pointer",
                    paddingRight: 8,
                  }}
                >
                  {TIME_WINDOWS.map((window) => (
                    <option key={window.key} value={window.key}>{window.label}</option>
                  ))}
                </select>
                <CaretDown size={18} weight="bold" color="#68708A" style={{ flex: "none", pointerEvents: "none" }} />
              </label>
            </div>
            <p className="db-subtitle">Review what was logged and how it updated daily totals.</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", border: "1.5px solid var(--he-card-border)", borderRadius: 999, padding: 4, marginTop: 12, boxShadow: "0 8px 22px rgba(31,28,35,.04)", maxWidth: "100%", overflowX: "auto" }}>
              {familyMembers.map((member) => {
                const active = selectedMember === member;
                return (
                  <button
                    key={member}
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      background: active ? "var(--he-coral)" : "transparent",
                      color: active ? "#fff" : "#68708A",
                      padding: "8px 13px",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      fontWeight: 900,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {member}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <section className="logs-metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
          <MetricCard icon={<ChatCircleText size={18} weight="bold" />} label="Logs accepted" value={`${totals.logs}`} tone="violet" />
          <MetricCard icon={<FEFlame size={21} />} label="Calories added" value={`${totals.calories.toLocaleString()}`} tone="orange" />
          <MetricCard icon={<Dumbbell size={18} />} label="Protein added" value={`${totals.proteinG}g`} tone="green" />
          <MetricCard icon={<Footprints size={18} />} label="Steps added" value={totals.steps.toLocaleString()} tone="blue" />
        </section>

        <section className="logs-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 16, alignItems: "start" }}>
          <div className="logs-list-pane" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {error && (
              <div style={{ background: "var(--he-coral-bg)", color: "var(--he-coral-deep)", border: "1.5px solid #FFD2D2", borderRadius: 14, padding: "12px 14px", fontSize: 13, fontWeight: 800 }}>
                Couldn&apos;t load health logs. {error}
              </div>
            )}
            <div style={{ background: "#fff", border: "1.5px solid var(--he-card-border)", borderRadius: 18, boxShadow: "0 12px 32px rgba(31,28,35,.04)", overflow: "hidden" }}>
              <div className="logs-card-head" style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottom: "1px solid #F0EEF5" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#1A2744", fontSize: 17, fontWeight: 900 }}>Recent WhatsApp logs</h2>
                  <p style={{ margin: "4px 0 0", color: "#9AA0AD", fontSize: 12.5, fontWeight: 700 }}>Real WhatsApp messages and the values added to totals</p>
                </div>
                <label className="logs-search" style={{ width: 260, maxWidth: "100%", height: 40, borderRadius: 999, border: "1.5px solid var(--he-card-border)", display: "flex", alignItems: "center", gap: 9, padding: "0 13px", background: "#FAFAFA" }}>
                  <MagnifyingGlass size={15} weight="bold" color="#9AA0AD" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search logs"
                    style={{ border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#1A2744", width: "100%" }}
                  />
                </label>
              </div>

              <div style={{ display: "flex", flexDirection: "column", maxHeight: 530, overflowY: "auto" }}>
                {loading && (
                  <div style={{ padding: "28px 20px", color: "#9AA0AD", fontSize: 13, fontWeight: 800, textAlign: "center" }}>
                    Loading WhatsApp logs...
                  </div>
                )}
                {!loading && filteredLogs.map((log) => {
                  const selectedRow = log.id === selected?.id;
                  const meta = statusMeta(log.status);
                  const StatusIcon = meta.icon;
                  return (
                    <button
                      className="logs-row"
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedId(log.id)}
                      style={{
                        border: "none",
                        borderBottom: "1px solid #F4F1F5",
                        background: selectedRow ? "linear-gradient(90deg, var(--he-coral-bg), #fff)" : "#fff",
                        padding: "15px 20px",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "grid",
                        gridTemplateColumns: "86px 150px minmax(0, 1fr) 132px",
                        gap: 14,
                        alignItems: "center",
                        fontFamily: "inherit",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, color: "#1A2744", fontSize: 12.5, fontWeight: 900 }}>{log.time}</p>
                        <p style={{ margin: "3px 0 0", color: "#9AA0AD", fontSize: 11.5, fontWeight: 700 }}>{log.day}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 12, background: "var(--he-coral-bg)", color: "var(--he-coral-deep)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 900, flex: "none" }}>{log.avatar}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", color: "#1A2744", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.member}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#9AA0AD", fontSize: 11.5, fontWeight: 700 }}>
                            <Clock size={11} weight="bold" /> {log.source}
                          </span>
                        </span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, color: "#1A2744", fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.message}</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {formatDelta(log.delta).length ? formatDelta(log.delta).map((chip) => {
                            const colors = chipColors(chip.tone);
                            return (
                              <span key={chip.label} style={{ background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 900 }}>
                                {chip.label}
                              </span>
                            );
                          }) : (
                            <span style={{ background: "#FAFAFA", color: "#B0B5C2", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 900 }}>No value added</span>
                          )}
                        </div>
                      </div>
                      <span className="logs-row-status" style={{ justifySelf: "end", display: "inline-flex", alignItems: "center", gap: 6, background: meta.bg, color: meta.color, borderRadius: 999, padding: "7px 10px", fontSize: 11.5, fontWeight: 900 }}>
                        <StatusIcon size={14} weight="fill" /> {meta.label}
                      </span>
                    </button>
                  );
                })}
                {!loading && !filteredLogs.length && (
                  <div style={{ padding: "28px 20px", color: "#9AA0AD", fontSize: 13, fontWeight: 800, textAlign: "center" }}>
                    No logs found for this filter.
                  </div>
                )}
              </div>
            </div>
          </div>

          {selected && (
            <SelectedDetail
              log={selected}
              busyAction={busyAction}
              notice={actionNotice}
              onSaveValues={handleSaveValues}
              onMarkIncorrect={handleMarkIncorrect}
              onDeleteLog={handleDeleteLog}
            />
          )}
        </section>
      </div>
    </div>
  );
}
