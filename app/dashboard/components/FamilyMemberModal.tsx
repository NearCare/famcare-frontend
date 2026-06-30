"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { X, ChartBar, ClipboardText, Scroll, Info, Pill, CalendarCheck, CaretRight } from "@phosphor-icons/react";
import { FEShoe, FEProtein, FEWheat } from "./FluentEmoji";
import {
  getMemberLogs,
  getMedicines,
  getTodayMedicineDoses,
  logsToWeeklyMetric,
  type FamilyMember,
  type HealthLog,
  type Medicine,
  type TodayDose,
} from "@/lib/api";

interface Props {
  member: FamilyMember;
  onClose: () => void;
}

function MiniMetricChart({
  data, unitLabel, activeColor, idleColor,
}: {
  data: { label: string; value: number }[];
  unitLabel: string;
  activeColor: string;
  idleColor: string;
}) {
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
          formatter={(v) => [(Number(v) || 0).toLocaleString() + " " + unitLabel, ""]}
        />
        <Bar dataKey="value" radius={[5, 5, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === maxIdx ? activeColor : idleColor} />
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

function EstimateInfo() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visible = open || hovered;

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        setOpen((current) => !current);
      }}
      onBlur={() => setOpen(false)}
      style={{ display: "inline-flex", position: "relative", cursor: "help", color: "#9AA0AD" }}
      tabIndex={0}
      role="button"
      aria-label="Nutrition estimate info"
    >
      <Info size={11} weight="bold" />
      {visible && (
        <span style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 210,
          background: "#1A2744",
          color: "#fff",
          borderRadius: 12,
          padding: "10px 12px",
          zIndex: 80,
          boxShadow: "0 8px 28px rgba(26,20,20,.22)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.45,
          whiteSpace: "normal",
          pointerEvents: "none",
        }}>
          <span style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 6, overflow: "hidden" }}>
            <span style={{ display: "block", width: 10, height: 10, background: "#1A2744", transform: "rotate(45deg)", margin: "3px auto 0" }} />
          </span>
          Estimated from meal messages. Values are approximate.
        </span>
      )}
    </span>
  );
}

export default function FamilyMemberModal({ member, onClose }: Props) {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [todayDoses, setTodayDoses] = useState<TodayDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [medicationLoading, setMedicationLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") ?? "";
    getMemberLogs(member.id, token, 7)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [member.id]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") ?? "";
    setMedicationLoading(true);
    Promise.all([
      getMedicines(member.id, token).catch(() => [] as Medicine[]),
      getTodayMedicineDoses(member.id, token).catch(() => [] as TodayDose[]),
    ])
      .then(([nextMedicines, nextDoses]) => {
        setMedicines(nextMedicines);
        setTodayDoses(nextDoses);
      })
      .finally(() => setMedicationLoading(false));
  }, [member.id]);

  const weeklySteps = logsToWeeklyMetric(logs, "steps");
  const weeklyProtein = logsToWeeklyMetric(logs, "protein_g");
  const weeklyCalories = logsToWeeklyMetric(logs, "calories");
  const todayIST = new Date().toLocaleDateString("en-CA");
  const todayLog = logs.find(l => l.logged_at === todayIST);
  const todaySteps = todayLog?.steps ?? 0;
  const todayProtein = todayLog?.protein_g ?? 0;
  const todayCalories = todayLog?.calories ?? 0;
  const todayStepPct = Math.min(Math.round((todaySteps / 10000) * 100), 100);
  const todayProteinPct = Math.min(Math.round((todayProtein / 50) * 100), 100);
  const todayCaloriesPct = Math.min(Math.round((todayCalories / 2000) * 100), 100);
  const activeMedicines = medicines.filter((medicine) => medicine.is_active);
  const takenDoses = todayDoses.filter((dose) => dose.status === "taken");
  const medicationHref = `/dashboard/medications?person=member-${member.id}`;

  const avatarLetter = (member.name ?? member.label).charAt(0).toUpperCase();

  const typeColor = member.type === "family" ? "#7C6FF7" : "#FF9F45";
  const typeBg   = member.type === "family" ? "#F0EEFF"  : "#FFF4E8";

  return (
    <div
      onClick={onClose}
      className="db-modal-overlay"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="db-modal-sheet"
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
              { icon: <FEProtein size={24} />, label: "Protein today", estimated: true, val: loading ? null : todayProtein ? `${todayProtein.toFixed(0)}` : "—", unit: "g", bar: todayProteinPct, color: "#2FBE76", bg: "#EAFBF0" },
              { icon: <FEWheat size={24} />, label: "Calories today", estimated: true, val: loading ? null : todayCalories ? `${todayCalories.toLocaleString()}` : "—", unit: "", bar: todayCaloriesPct, color: "#FF9F45", bg: "#FFF4E8" },
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
                <div style={{ fontSize: 11, color: "#7A8099", marginTop: 3, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {card.label}{card.estimated && <EstimateInfo />}
                </div>
                <div style={{ height: 4, borderRadius: 4, background: "rgba(0,0,0,0.08)", marginTop: 8 }}>
                  <div style={{ height: "100%", borderRadius: 4, background: card.color, width: `${card.bar}%`, transition: "width .6s ease" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Weekly charts */}
          {[
            { title: "Steps this week", data: weeklySteps, unitLabel: "steps", activeColor: "#7C6FF7", idleColor: "#E8E4FF" },
            { title: "Protein this week (est.)", data: weeklyProtein, unitLabel: "g", activeColor: "#2FBE76", idleColor: "#DBF6E6" },
            { title: "Calories this week (est.)", data: weeklyCalories, unitLabel: "kcal", activeColor: "#FF9F45", idleColor: "#FFE7CC" },
          ].map(chart => (
            <div key={chart.title} style={{ background: "#FAFAFA", borderRadius: 16, padding: "18px 18px 14px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", marginBottom: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 7 }}>
                <ChartBar size={15} weight="bold" color="#7C6FF7" /> {chart.title}
              </div>
              {loading ? <Skel h={120} /> : (
                <MiniMetricChart
                  data={chart.data}
                  unitLabel={chart.unitLabel}
                  activeColor={chart.activeColor}
                  idleColor={chart.idleColor}
                />
              )}
            </div>
          ))}

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
                  { ic: <FEProtein size={20} />, label: "Protein", estimated: true, val: todayLog.protein_g != null ? `${todayLog.protein_g.toFixed(0)}g` : "—" },
                  { ic: <FEWheat size={20} />, label: "Calories", estimated: true, val: todayLog.calories != null ? `${todayLog.calories} kcal` : "—" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                    <span style={{ display: "flex", alignItems: "center" }}>{row.ic}</span>
                    <span style={{ color: "#7A8099", flex: 1, display: "inline-flex", alignItems: "center", gap: 4 }}>{row.label}{row.estimated && <EstimateInfo />}</span>
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

          {/* Medication summary */}
          <div style={{ background: "#FAFAFA", borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2C2F3A", fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", alignItems: "center", gap: 7 }}>
                <Pill size={15} weight="bold" color="#FF6B6B" /> Medications
              </div>
              <Link
                href={medicationHref}
                onClick={onClose}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#E85C5C",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Manage <CaretRight size={13} weight="bold" />
              </Link>
            </div>

            {medicationLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skel h={14} /><Skel h={14} w="75%" />
              </div>
            ) : activeMedicines.length ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: "Active", value: activeMedicines.length, color: "#20A865", bg: "#EAFBF0" },
                    { label: "Doses today", value: todayDoses.length, color: "#7C6FF7", bg: "#F0EEFF" },
                    { label: "Taken", value: takenDoses.length, color: "#4F9BF5", bg: "#EBF3FF" },
                  ].map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: item.bg, padding: "10px 11px" }}>
                      <p style={{ margin: 0, color: item.color, fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{item.value}</p>
                      <p style={{ margin: "5px 0 0", color: "#7A8099", fontSize: 10.5, fontWeight: 700 }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                {todayDoses.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {todayDoses.slice(0, 3).map((dose) => {
                      const statusColor = dose.status === "taken" ? "#20A865" : dose.status === "due" ? "#FF8A1F" : "#7C84A8";
                      return (
                        <div key={dose.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #F0EEF5", borderRadius: 12, padding: "9px 10px", background: "#fff" }}>
                          <CalendarCheck size={18} weight="bold" color="#7C6FF7" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "#2C2F3A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {dose.medicine.name}{dose.medicine.strength ? ` ${dose.medicine.strength}` : ""}
                            </p>
                            <p style={{ margin: "2px 0 0", color: "#9AA0AD", fontSize: 11, fontWeight: 700 }}>{dose.schedule.time_of_day}</p>
                          </div>
                          <span style={{ color: statusColor, background: "#FAFAFA", borderRadius: 999, padding: "5px 8px", fontSize: 10.5, fontWeight: 800, textTransform: "capitalize" }}>
                            {dose.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: "#9AA0AD", margin: 0 }}>No doses scheduled for today.</p>
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <p style={{ fontSize: 12.5, color: "#9AA0AD", margin: 0 }}>No medicines added yet.</p>
                <Link
                  href={medicationHref}
                  onClick={onClose}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    background: "#FFF1F0",
                    color: "#E85C5C",
                    padding: "8px 11px",
                    textDecoration: "none",
                    fontSize: 11.5,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  Add medicine
                </Link>
              </div>
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
                            log.calories != null ? `${log.calories} kcal` : null,
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
