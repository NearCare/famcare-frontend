"use client";
import { useEffect, useRef, useState } from "react";
import {
  Chart, BarElement, BarController,
  CategoryScale, LinearScale, Tooltip,
} from "chart.js";
import { getMemberSummary, getMemberLogs, logsToWeeklySteps, type FamilyMember, type Summary, type HealthLog } from "@/lib/api";

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip);

interface Props {
  member: FamilyMember;
  onClose: () => void;
}

function MiniStepsChart({ data }: { data: { label: string; value: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    chartRef.current?.destroy();
    const values = data.map(d => d.value);
    const maxIdx = values.indexOf(Math.max(...values));
    chartRef.current = new Chart(el, {
      type: "bar",
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: values,
          backgroundColor: values.map((_, i) => i === maxIdx ? "#7C6FF7" : "#E8E4FF"),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#2C2F3A",
            callbacks: { label: (c: { parsed: { y: number | null } }) => (c.parsed.y ?? 0).toLocaleString() + " steps" },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9AA0AD" }, border: { display: false } },
          y: {
            grid: { color: "#F2F1F3" }, beginAtZero: true, border: { display: false },
            ticks: {
              font: { size: 9 }, color: "#9AA0AD",
              callback: (v: number | string) => Number(v) >= 1000 ? Number(v) / 1000 + "k" : v,
            },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);

  return <canvas ref={ref} />;
}

function Skel({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: "linear-gradient(90deg,#F5EEEE 25%,#EFE8E8 50%,#F5EEEE 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

export default function FamilyMemberModal({ member, onClose }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") ?? "";
    Promise.all([
      getMemberSummary(member.id, token),
      getMemberLogs(member.id, token, 7),
    ]).then(([s, l]) => {
      setSummary(s);
      setLogs(l);
    }).finally(() => setLoading(false));
  }, [member.id]);

  const weeklySteps = logsToWeeklySteps(logs);
  const todayIST = new Date().toLocaleDateString("en-CA");
  const todayLog = logs.find(l => l.logged_at === todayIST);
  const todaySteps = todayLog?.steps ?? 0;
  const todayStepPct = Math.min(Math.round((todaySteps / 10000) * 100), 100);

  const avatarLetter = (member.name ?? member.label).charAt(0).toUpperCase();

  const typeColor = member.type === "family" ? "#7C6FF7" : "#FF9F45";
  const typeBg   = member.type === "family" ? "#F0EEFF"  : "#FFF4E8";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 22,
          width: "100%", maxWidth: 640,
          maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "24px 28px 20px",
          borderBottom: "1.5px solid #F2F1F3",
          display: "flex", alignItems: "center", gap: 14,
          position: "sticky", top: 0, background: "#fff", zIndex: 2,
          borderRadius: "22px 22px 0 0",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: typeBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 800, color: typeColor,
            flexShrink: 0,
          }}>
            {avatarLetter}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#2C2F3A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {member.name ?? member.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: typeColor, background: typeBg, padding: "2px 9px", borderRadius: 20 }}>
                {member.label}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "#9AA0AD", marginTop: 2 }}>{member.phone}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#F5F3F8", border: "none", borderRadius: 10,
              width: 32, height: 32, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "#5A5F6E", flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { emoji: "👟", label: "Steps today", val: loading ? null : todaySteps ? `${todaySteps.toLocaleString()}` : "—", unit: "", bar: todayStepPct, color: "#7C6FF7", bg: "#F0EEFF" },
              { emoji: "🥩", label: "Avg protein", val: loading ? null : summary?.avg_protein_g != null ? `${summary.avg_protein_g.toFixed(0)}` : "—", unit: "g", bar: Math.min(Math.round(((summary?.avg_protein_g ?? 0) / 50) * 100), 100), color: "#2FBE76", bg: "#EAFBF0" },
              { emoji: "🦶", label: "Avg steps", val: loading ? null : summary?.avg_steps != null ? `${Math.round(summary.avg_steps).toLocaleString()}` : "—", unit: "", bar: Math.min(Math.round(((summary?.avg_steps ?? 0) / 10000) * 100), 100), color: "#FF9F45", bg: "#FFF4E8" },
            ].map(card => (
              <div key={card.label} style={{ background: card.bg, borderRadius: 14, padding: "14px 14px 12px" }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{card.emoji}</div>
                {loading ? (
                  <Skel h={24} w="60%" />
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#2C2F3A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {card.val}<span style={{ fontSize: 13, fontWeight: 600, color: "#7A8099" }}>{card.unit}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#7A8099", marginTop: 3 }}>{card.label}</div>
                <div style={{ height: 4, borderRadius: 4, background: "rgba(0,0,0,0.08)", marginTop: 8 }}>
                  <div style={{ height: "100%", borderRadius: 4, background: card.color, width: `${card.bar}%`, transition: "width .6s ease" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Steps chart */}
          <div style={{ background: "#FAFAFA", borderRadius: 16, padding: "18px 18px 14px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              📊 Steps this week
            </div>
            {loading ? <Skel h={120} /> : (
              <div style={{ height: 120 }}>
                <MiniStepsChart data={weeklySteps} />
              </div>
            )}
          </div>

          {/* Today's log */}
          <div style={{ background: "#FAFAFA", borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              📋 Today&apos;s log
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skel h={14} /><Skel h={14} w="70%" />
              </div>
            ) : todayLog ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { ic: "👟", label: "Steps", val: todayLog.steps != null ? todayLog.steps.toLocaleString() : "—" },
                  { ic: "🥩", label: "Protein", val: todayLog.protein_g != null ? `${todayLog.protein_g.toFixed(0)}g` : "—" },
                  { ic: "🌾", label: "Carbs", val: todayLog.carbs_g != null ? `${todayLog.carbs_g.toFixed(0)}g` : "—" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                    <span style={{ fontSize: 16 }}>{row.ic}</span>
                    <span style={{ color: "#7A8099", flex: 1 }}>{row.label}</span>
                    <span style={{ fontWeight: 700, color: "#2C2F3A" }}>{row.val}</span>
                  </div>
                ))}
                {todayLog.raw_message && (
                  <div style={{ marginTop: 6, padding: "9px 12px", background: "#F0EEFF", borderRadius: 10, fontSize: 12, color: "#5A5F6E", lineHeight: 1.45 }}>
                    💬 &ldquo;{todayLog.raw_message}&rdquo;
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#9AA0AD", margin: 0 }}>Nothing logged today yet.</p>
            )}
          </div>

          {/* Recent logs */}
          {!loading && logs.length > 1 && (
            <div style={{ background: "#FAFAFA", borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                📜 Recent logs
              </div>
              {logs.slice(0, 5).map(log => (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #F0EEF5" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EDE8FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                    📋
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2C2F3A" }}>
                      {log.steps != null ? `${log.steps.toLocaleString()} steps` : "No steps"}
                    </div>
                    <div style={{ fontSize: 11, color: "#9AA0AD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.raw_message
                        ? log.raw_message
                        : [
                            log.protein_g != null ? `protein ${log.protein_g.toFixed(0)}g` : null,
                            log.carbs_g != null ? `carbs ${log.carbs_g.toFixed(0)}g` : null,
                          ].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9AA0AD", flexShrink: 0 }}>
                    {new Date(log.logged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9AA0AD", fontSize: 13.5 }}>
              No health logs yet. Ask them to send a WhatsApp message! 📱
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
