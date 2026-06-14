"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { X, ChartBar, ClipboardText, Scroll } from "@phosphor-icons/react";
import { FEShoe, FEMeat, FEWheat } from "./FluentEmoji";
import { getMemberSummary, getMemberLogs, logsToWeeklySteps, type FamilyMember, type Summary, type HealthLog } from "@/lib/api";

interface Props {
  member: FamilyMember;
  onClose: () => void;
}

function MiniStepsChart({ data }: { data: { label: string; value: number }[] }) {
  const values = data.map(d => d.value);
  const maxIdx = values.indexOf(Math.max(...values));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barSize={22} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="label" axisLine={false} tickLine={false}
          tick={{ fontSize: 10, fill: "#9AA0AD", fontFamily: "Plus Jakarta Sans" }} />
        <YAxis axisLine={false} tickLine={false}
          tick={{ fontSize: 9, fill: "#9AA0AD" }}
          tickFormatter={(v: number) => v >= 1000 ? v / 1000 + "k" : String(v)} />
        <ReTooltip
          cursor={{ fill: "rgba(0,0,0,0.04)", radius: 6 }}
          contentStyle={{ background: "#2C2F3A", border: "none", borderRadius: 8, fontSize: 11 }}
          itemStyle={{ color: "#fff", fontWeight: 700 }}
          formatter={(v) => [(Number(v) || 0).toLocaleString() + " steps", ""]}
        />
        <Bar dataKey="value" radius={[5, 5, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === maxIdx ? "#7C6FF7" : "#E8E4FF"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
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
              color: "#5A5F6E", flexShrink: 0,
            }}
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { icon: <FEShoe size={24} />, label: "Steps today", val: loading ? null : todaySteps ? `${todaySteps.toLocaleString()}` : "—", unit: "", bar: todayStepPct, color: "#7C6FF7", bg: "#F0EEFF" },
              { icon: <FEMeat size={24} />, label: "Avg protein", val: loading ? null : summary?.avg_protein_g != null ? `${summary.avg_protein_g.toFixed(0)}` : "—", unit: "g", bar: Math.min(Math.round(((summary?.avg_protein_g ?? 0) / 50) * 100), 100), color: "#2FBE76", bg: "#EAFBF0" },
              { icon: <FEShoe size={24} />, label: "Avg steps", val: loading ? null : summary?.avg_steps != null ? `${Math.round(summary.avg_steps).toLocaleString()}` : "—", unit: "", bar: Math.min(Math.round(((summary?.avg_steps ?? 0) / 10000) * 100), 100), color: "#FF9F45", bg: "#FFF4E8" },
            ].map(card => (
              <div key={card.label} style={{ background: card.bg, borderRadius: 14, padding: "14px 14px 12px" }}>
                <div style={{ marginBottom: 6 }}>{card.icon}</div>
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
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 7 }}>
              <ChartBar size={15} weight="bold" color="#7C6FF7" /> Steps this week
            </div>
            {loading ? <Skel h={120} /> : <MiniStepsChart data={weeklySteps} />}
          </div>

          {/* Today's log */}
          <div style={{ background: "#FAFAFA", borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 7 }}>
              <ClipboardText size={15} weight="bold" color="#7C6FF7" /> Today&apos;s log
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skel h={14} /><Skel h={14} w="70%" />
              </div>
            ) : todayLog ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { ic: <FEShoe size={20} />, label: "Steps", val: todayLog.steps != null ? todayLog.steps.toLocaleString() : "—" },
                  { ic: <FEMeat size={20} />, label: "Protein", val: todayLog.protein_g != null ? `${todayLog.protein_g.toFixed(0)}g` : "—" },
                  { ic: <FEWheat size={20} />, label: "Carbs", val: todayLog.carbs_g != null ? `${todayLog.carbs_g.toFixed(0)}g` : "—" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                    <span style={{ display: "flex", alignItems: "center" }}>{row.ic}</span>
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
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 7 }}>
                <Scroll size={15} weight="bold" color="#7C6FF7" /> Recent logs
              </div>
              {logs.slice(0, 5).map(log => (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #F0EEF5" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EDE8FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ClipboardText size={16} weight="bold" color="#7C6FF7" />
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
