"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarBlank,
  ChatCircleText,
  CheckCircle,
  Clock,
  MagnifyingGlass,
  PencilSimple,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Dumbbell, Footprints } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { FEFlame } from "../components/FluentEmoji";

type LogStatus = "logged" | "estimated" | "failed";

type LogDelta = {
  calories?: number;
  proteinG?: number;
  steps?: number;
  sleepHours?: number;
};

type HealthLogRow = {
  id: string;
  time: string;
  day: "Today" | "Yesterday";
  member: string;
  avatar: string;
  source: "text" | "voice";
  message: string;
  status: LogStatus;
  confidence: "High" | "Medium" | "Low";
  summary: string;
  delta: LogDelta;
};

const demoLogs: HealthLogRow[] = [
  {
    id: "log-1",
    time: "9:42 AM",
    day: "Today",
    member: "Priya",
    avatar: "P",
    source: "text",
    message: "3 roti aur mutton curry",
    status: "estimated",
    confidence: "Medium",
    summary: "Estimated home-cooked meal from roti and mutton curry.",
    delta: { calories: 610, proteinG: 27 },
  },
  {
    id: "log-2",
    time: "8:20 AM",
    day: "Today",
    member: "Dad",
    avatar: "D",
    source: "text",
    message: "6800 steps today",
    status: "logged",
    confidence: "High",
    summary: "Steps logged directly from WhatsApp message.",
    delta: { steps: 6800 },
  },
  {
    id: "log-3",
    time: "Yesterday",
    day: "Yesterday",
    member: "Mom",
    avatar: "M",
    source: "voice",
    message: "Voice note: 7.5 hours sleep",
    status: "logged",
    confidence: "High",
    summary: "Sleep duration extracted from a voice note.",
    delta: { sleepHours: 7.5 },
  },
  {
    id: "log-4",
    time: "Yesterday",
    day: "Yesterday",
    member: "Priya",
    avatar: "P",
    source: "text",
    message: "chai aur biscuit",
    status: "estimated",
    confidence: "Medium",
    summary: "Estimated snack from common Indian food defaults.",
    delta: { calories: 130, proteinG: 3 },
  },
  {
    id: "log-5",
    time: "Yesterday",
    day: "Yesterday",
    member: "You",
    avatar: "Y",
    source: "text",
    message: "kal walk kiya",
    status: "failed",
    confidence: "Low",
    summary: "Could not find a clear number to log.",
    delta: {},
  },
];

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
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 10px 28px rgba(31,28,35,.04)",
      minHeight: 84,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: colors.bg, color: colors.color, display: "grid", placeItems: "center", flex: "none" }}>
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, color: "#1A2744", fontSize: 21, fontWeight: 900, lineHeight: 1 }}>{value}</p>
          <p style={{ margin: "5px 0 0", color: "#7C84A8", fontSize: 11.5, fontWeight: 800 }}>{label}</p>
        </div>
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

function SelectedDetail({ log }: { log: HealthLogRow }) {
  const additions = [
    { label: "Calories", value: log.delta.calories ? `+${log.delta.calories} kcal` : "No change", tone: "orange" },
    { label: "Protein", value: log.delta.proteinG ? `+${log.delta.proteinG}g` : "No change", tone: "green" },
    { label: "Steps", value: log.delta.steps ? `+${log.delta.steps.toLocaleString()}` : "No change", tone: "blue" },
    { label: "Sleep", value: log.delta.sleepHours ? `+${log.delta.sleepHours}h` : "No change", tone: "violet" },
  ];
  const meta = statusMeta(log.status);
  const StatusIcon = meta.icon;

  return (
    <aside style={{
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
        <button style={{ height: 42, border: "none", borderRadius: 12, background: "var(--he-coral)", color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <PencilSimple size={15} weight="bold" /> Edit values
        </button>
        <button style={{ height: 42, border: "1.5px solid var(--he-card-border)", borderRadius: 12, background: "#fff", color: "#5A6170", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
          Mark incorrect
        </button>
      </div>
    </aside>
  );
}

export default function LogsPage() {
  const [query, setQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState("All");
  const [selectedId, setSelectedId] = useState(demoLogs[0]?.id ?? "");
  const familyMembers = useMemo(() => ["All", ...Array.from(new Set(demoLogs.map((log) => log.member)))], []);
  const memberLogs = useMemo(() => (
    selectedMember === "All" ? demoLogs : demoLogs.filter((log) => log.member === selectedMember)
  ), [selectedMember]);
  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return memberLogs;
    return memberLogs.filter((log) =>
      [log.member, log.message, log.status, log.summary].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [memberLogs, query]);
  const selected = filteredLogs.find((log) => log.id === selectedId) ?? filteredLogs[0] ?? demoLogs[0];

  useEffect(() => {
    if (filteredLogs.length && !filteredLogs.some((log) => log.id === selectedId)) {
      setSelectedId(filteredLogs[0].id);
    }
  }, [filteredLogs, selectedId]);

  const totals = useMemo(() => memberLogs.reduce(
    (acc, log) => ({
      logs: acc.logs + (log.status !== "failed" ? 1 : 0),
      calories: acc.calories + (log.delta.calories ?? 0),
      proteinG: acc.proteinG + (log.delta.proteinG ?? 0),
      steps: acc.steps + (log.delta.steps ?? 0),
    }),
    { logs: 0, calories: 0, proteinG: 0, steps: 0 },
  ), [memberLogs]);

  return (
    <div className="db-page">
      <Sidebar />
      <div className="db-main">
        <div className="db-topbar">
          <div>
            <h1 className="db-greeting">Health Logs</h1>
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
          <div className="db-top-actions">
            <div className="db-pill" style={{ cursor: "default" }}>
              <CalendarBlank size={15} weight="bold" />
              Last 7 days
            </div>
          </div>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
          <MetricCard icon={<ChatCircleText size={18} weight="bold" />} label="Logs accepted" value={`${totals.logs}`} tone="violet" />
          <MetricCard icon={<FEFlame size={21} />} label="Calories added" value={`${totals.calories.toLocaleString()}`} tone="orange" />
          <MetricCard icon={<Dumbbell size={18} />} label="Protein added" value={`${totals.proteinG}g`} tone="green" />
          <MetricCard icon={<Footprints size={18} />} label="Steps added" value={totals.steps.toLocaleString()} tone="blue" />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div style={{ background: "#fff", border: "1.5px solid var(--he-card-border)", borderRadius: 18, boxShadow: "0 12px 32px rgba(31,28,35,.04)", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottom: "1px solid #F0EEF5" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#1A2744", fontSize: 17, fontWeight: 900 }}>Recent WhatsApp logs</h2>
                  <p style={{ margin: "4px 0 0", color: "#9AA0AD", fontSize: 12.5, fontWeight: 700 }}>Dummy data for localhost preview</p>
                </div>
                <label style={{ width: 260, maxWidth: "100%", height: 40, borderRadius: 999, border: "1.5px solid var(--he-card-border)", display: "flex", alignItems: "center", gap: 9, padding: "0 13px", background: "#FAFAFA" }}>
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
                {filteredLogs.map((log) => {
                  const selectedRow = log.id === selected.id;
                  const meta = statusMeta(log.status);
                  const StatusIcon = meta.icon;
                  return (
                    <button
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
                      <span style={{ justifySelf: "end", display: "inline-flex", alignItems: "center", gap: 6, background: meta.bg, color: meta.color, borderRadius: 999, padding: "7px 10px", fontSize: 11.5, fontWeight: 900 }}>
                        <StatusIcon size={14} weight="fill" /> {meta.label}
                      </span>
                    </button>
                  );
                })}
                {!filteredLogs.length && (
                  <div style={{ padding: "28px 20px", color: "#9AA0AD", fontSize: 13, fontWeight: 800, textAlign: "center" }}>
                    No logs found for this filter.
                  </div>
                )}
              </div>
            </div>
          </div>

          {selected && <SelectedDetail log={selected} />}
        </section>
      </div>
    </div>
  );
}
