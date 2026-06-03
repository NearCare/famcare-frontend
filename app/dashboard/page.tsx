"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Chart,
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Filler,
  BarController, LineController, DoughnutController,
} from "chart.js";
import {
  getUserLogs,
  getUserSummary,
  logsToWeeklySteps,
  type User,
  type HealthLog,
  type Summary,
} from "@/lib/api";
import EmptyState from "./components/EmptyState";

Chart.register(
  BarElement, LineElement, PointElement, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Filler,
  BarController, LineController, DoughnutController,
);

const navItems = [
  { icon: "🏠", label: "Home", active: true, href: "#" },
  { icon: "📈", label: "Progress", href: "#" },
  { icon: "📅", label: "Appointments", href: "#" },
  { icon: "👤", label: "Nearby Providers", href: "#" },
  { icon: "📄", label: "Health Records", href: "#" },
  { icon: "⚡", label: "Activity", href: "#" },
  { icon: "🔔", label: "Reminders", href: "#" },
  { icon: "⚙️", label: "Settings", href: "#" },
];

// ─── Chart components ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useChart(canvasId: string, buildConfig: () => any, deps: unknown[] = []) {
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    const el = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!el) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(el, buildConfig());
    return () => { chartRef.current?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, ...deps]);
}

function StepsChart({ data }: { data: { label: string; value: number }[] }) {
  const values = data.map((d) => d.value);
  const labels = data.map((d) => d.label);
  const maxIdx = values.indexOf(Math.max(...values));

  useChart("stepsChart", () => ({
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: values.map((_, i) => i === maxIdx ? "#1A2744" : "#BDDEFF"),
        borderRadius: 6,
        borderSkipped: false as const,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { parsed: { y: number } }) => c.parsed.y.toLocaleString() + " steps" } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "DM Sans", size: 10 }, color: "#9AAABB" } },
        y: { grid: { color: "#F5F0F0" }, ticks: { font: { family: "DM Sans", size: 10 }, color: "#9AAABB", callback: (v: number | string) => Number(v) >= 1000 ? Number(v) / 1000 + "k" : v }, beginAtZero: true },
      },
    },
  }), [JSON.stringify(data)]);
  return <canvas id="stepsChart" />;
}

function TripleDonut({ stepPct, proteinPct, carbsPct }: { stepPct: number; proteinPct: number; carbsPct: number }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;

  // Three rings: outer=steps, middle=protein, inner=carbs
  const rings = [
    { r: 68, stroke: "#4A8FE2", track: "#E8F3FF", pct: stepPct,    label: "Steps"   },
    { r: 52, stroke: "#3EB86A", track: "#E8F8EE", pct: proteinPct, label: "Protein" },
    { r: 36, stroke: "#F5A623", track: "#FFF8E0", pct: carbsPct,   label: "Carbs"   },
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map(({ r, stroke, track, pct }) => {
        const circumference = 2 * Math.PI * r;
        const dash = (pct / 100) * circumference;
        return (
          <g key={r}>
            {/* Track */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={10} />
            {/* Progress */}
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke={stroke} strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray .6s ease" }}
            />
          </g>
        );
      })}
      {/* Centre label — show step pct as primary */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1A2744" fontFamily="DM Sans, sans-serif">
        {stepPct}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#9AAABB" fontFamily="DM Sans, sans-serif">
        step goal
      </text>
    </svg>
  );
}

function ProgressChart({ data }: { data: { label: string; value: number }[] }) {
  useChart("progressChart", () => ({
    type: "line",
    data: {
      labels: data.map((d) => d.label),
      datasets: [{
        data: data.map((d) => d.value),
        borderColor: "#4A8FE2", backgroundColor: "rgba(74,143,226,.09)",
        fill: true, tension: 0.42, borderWidth: 2,
        pointRadius: 3, pointBackgroundColor: "#4A8FE2",
        pointBorderColor: "#fff", pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: "DM Sans", size: 9 }, color: "#9AAABB" } },
        y: { display: false },
      },
    },
  }), [JSON.stringify(data)]);
  return <canvas id="progressChart" />;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 20, radius = 6 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg, #F5EEEE 25%, #F0E8E8 50%, #F5EEEE 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Read logged-in user from localStorage (set by login page after OTP verify)
        const stored = localStorage.getItem("auth_user");
        const authUser: User | null = stored ? JSON.parse(stored) : null;

        if (!authUser) {
          // Not logged in — redirect to login
          window.location.href = "/login";
          return;
        }

        setUser(authUser);
        const [fetchedLogs, fetchedSummary] = await Promise.all([
          getUserLogs(authUser.id, 7),
          getUserSummary(authUser.id),
        ]);
        setLogs(fetchedLogs);
        setSummary(fetchedSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const weeklySteps = logsToWeeklySteps(logs);
  const avgSteps = summary?.avg_steps ?? 0;
  const stepGoalPct = Math.min(Math.round((avgSteps / 10000) * 100), 100);
  const todayLog = logs.find((l) => l.logged_at === new Date().toISOString().split("T")[0]);
  const todaySteps = todayLog?.steps ?? 0;
  const todayStepPct = Math.min(Math.round((todaySteps / 10000) * 100), 100);
  const proteinAvg = summary?.avg_protein_g ?? 0;
  const carbsAvg = summary?.avg_carbs_g ?? 0;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <div style={{ marginLeft: 214, padding: "22px 22px 36px", flex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <Skeleton h={28} w={260} />
            <div style={{ marginTop: 8 }}><Skeleton h={16} w={200} /></div>
          </div>
          <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 13, marginBottom: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "17px 19px", boxShadow: "0 2px 12px rgba(26,20,20,.07)" }}>
                <Skeleton h={50} w={50} radius={14} />
                <div style={{ marginTop: 12 }}><Skeleton h={30} w={100} /></div>
                <div style={{ marginTop: 6 }}><Skeleton h={5} radius={3} /></div>
              </div>
            ))}
          </div>
          <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <div style={{ marginLeft: 214, display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1A2744", marginBottom: 8 }}>Couldn&apos;t reach the backend</h3>
            <p style={{ fontSize: 13.5, color: "#6B7A9A", maxWidth: 340, lineHeight: 1.7 }}>
              Make sure the GharSehat backend is running on{" "}
              <code style={{ background: "#F5EEEE", padding: "1px 6px", borderRadius: 4 }}>
                {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}
              </code>
            </p>
            <p style={{ fontSize: 12, color: "#B0BFCC", marginTop: 10 }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state — no users or no logs ───────────────────────────────────────
  if (!user || logs.length === 0) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <div style={{ marginLeft: 214, flex: 1 }}>
          <EmptyState userName={user?.name ?? undefined} />
        </div>
      </div>
    );
  }

  // ── Full dashboard ───────────────────────────────────────────────────────────
  // If name is null, show "there" in greeting and use phone last 4 digits for avatar
  const displayName = user.name ?? "there";
  const avatarLetter = user.name
    ? user.name.charAt(0).toUpperCase()
    : user.phone.slice(-4, -3) || "U";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      {/* Main */}
      <div className="dashboard-main" style={{ marginLeft: 214, padding: "22px 22px 36px", flex: 1 }}>
        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.2px" }}>{getGreeting()}, {displayName}! 👋</h2>
            <p style={{ fontSize: 13, color: "#6B7A9A", marginTop: 3 }}>Here&apos;s your health overview for today.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, background: "#fff",
              border: "1.5px solid #EDE6E6", borderRadius: 8, padding: "8px 13px",
              fontSize: 12.5, color: "#6B7A9A", fontWeight: 500,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg,#FFD0C8,#FF9E9E)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
            }}>
              {avatarLetter}
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 13, marginBottom: 14 }}>
          {[
            {
              ico: "👟", icoColor: "rgba(74,143,226,.15)", lblColor: "#4A8FE2",
              label: "Steps Today", val: todaySteps.toLocaleString(),
              fillColor: "#4A8FE2", pct: todayStepPct,
              goal: "Goal: 10,000 steps", blue: true,
            },
            {
              ico: "🥩", icoColor: "#F0FFF6", lblColor: "#3EB86A",
              label: "Avg Protein (7d)", val: proteinAvg ? `${proteinAvg.toFixed(0)}g` : "—",
              fillColor: "#3EB86A", pct: Math.min(Math.round((proteinAvg / 50) * 100), 100),
              goal: "Goal: 50g / day", blue: false,
            },
            {
              ico: "🌾", icoColor: "#FFF8E0", lblColor: "#F5A623",
              label: "Avg Carbs (7d)", val: carbsAvg ? `${carbsAvg.toFixed(0)}g` : "—",
              fillColor: "#F5A623", pct: Math.min(Math.round((carbsAvg / 200) * 100), 100),
              goal: "Goal: 200g / day", blue: false,
            },
          ].map((s) => (
            <div key={s.label} style={{
              background: s.blue ? "linear-gradient(145deg,#EBF3FF,#D4E8FF)" : "#fff",
              borderRadius: 16, padding: "17px 19px",
              boxShadow: "0 2px 12px rgba(26,20,20,.07)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14, background: s.icoColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, flexShrink: 0,
                }}>{s.ico}</div>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: s.lblColor }}>{s.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.5px", lineHeight: 1.1, marginTop: 3 }}>{s.val}</div>
                </div>
              </div>
              <div style={{ marginTop: 13 }}>
                <div style={{ height: 5, background: s.blue ? "rgba(74,143,226,.18)" : "rgba(0,0,0,.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: s.fillColor, width: `${s.pct}%`, transition: "width .6s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11 }}>
                  <span style={{ color: "#B0BFCC" }}>{s.goal}</span>
                  <strong style={{ color: "#6B7A9A", fontWeight: 600 }}>{s.pct}%</strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart grid */}
        <div className="chart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 272px", gap: 13, marginBottom: 13 }}>
          {/* Steps chart */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "17px 19px", boxShadow: "0 2px 12px rgba(26,20,20,.07)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13 }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>Steps Overview</div>
                <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.4px", marginTop: 4 }}>
                  {avgSteps ? avgSteps.toLocaleString() : "—"}
                </div>
                <div style={{ fontSize: 12, color: "#6B7A9A", marginTop: 2 }}>7-day average</div>
                {summary && summary.step_goal_hits > 0 && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#3EB86A", marginTop: 4 }}>
                    🎯 {summary.step_goal_hits} day{summary.step_goal_hits !== 1 ? "s" : ""} hit goal this week
                  </div>
                )}
              </div>
            </div>
            <div style={{ position: "relative", height: 140 }}>
              <StepsChart data={weeklySteps} />
            </div>
          </div>

          {/* Recent logs */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "17px 19px", boxShadow: "0 2px 12px rgba(26,20,20,.07)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13 }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>Recent Logs</div>
                <div style={{ fontSize: 11, color: "#E85C5C", fontWeight: 600, marginTop: 2 }}>Last 7 days</div>
              </div>
            </div>
            <div>
              {logs.slice(0, 4).map((log) => (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #F5EFEF" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: "#FFEDEC",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                  }}>📋</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {log.steps != null ? `${log.steps.toLocaleString()} steps` : "No steps logged"}
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7A9A", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {log.raw_message ?? (
                        [
                          log.protein_g != null ? `protein ${log.protein_g.toFixed(0)}g` : null,
                          log.carbs_g != null ? `carbs ${log.carbs_g.toFixed(0)}g` : null,
                        ].filter(Boolean).join(" · ") || "No details"
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#6B7A9A" }}>
                      {new Date(log.logged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                    <div style={{
                      display: "inline-block", marginTop: 3, padding: "2px 8px",
                      borderRadius: 20, fontSize: 10, fontWeight: 600,
                      background: "#E8F8EE", color: "#3EB86A",
                    }}>Logged</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 7, marginTop: 11,
              padding: "9px 11px", border: "1.5px dashed #EDE6E6", borderRadius: 10,
              fontSize: 12, color: "#6B7A9A",
            }}>
              <span>💬</span>
              Log more via WhatsApp
            </div>
          </div>

          {/* Activity donut — triple ring */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "17px 19px", boxShadow: "0 2px 12px rgba(26,20,20,.07)" }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Activity Summary</div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 8 }}>
              <TripleDonut
                stepPct={stepGoalPct}
                proteinPct={Math.min(Math.round((proteinAvg / 50) * 100), 100)}
                carbsPct={Math.min(Math.round((carbsAvg / 200) * 100), 100)}
              />
            </div>
            {/* Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 8 }}>
              {[
                { color: "#4A8FE2", label: "Steps",   val: `${avgSteps ? avgSteps.toLocaleString() : "—"} / 10k avg` },
                { color: "#3EB86A", label: "Protein", val: `${proteinAvg ? proteinAvg.toFixed(0) : "—"}g / 50g` },
                { color: "#F5A623", label: "Carbs",   val: `${carbsAvg ? carbsAvg.toFixed(0) : "—"}g / 200g` },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#6B7A9A" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />
                    {row.label}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{row.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress row */}
        <div className="progress-grid" style={{ display: "grid", gridTemplateColumns: "1fr 272px", gap: 13 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "17px 19px", boxShadow: "0 2px 12px rgba(26,20,20,.07)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>Steps Trend (7 days)</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.4px" }}>
                {avgSteps ? avgSteps.toLocaleString() : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#6B7A9A" }}>Steps (avg)</div>
            </div>
            <div style={{ position: "relative", height: 90 }}>
              <ProgressChart data={weeklySteps} />
            </div>
          </div>

          <div style={{
            background: "linear-gradient(145deg,#FFF5F3,#FFE4DE)",
            borderRadius: 16, padding: 17, display: "flex", gap: 14,
            alignItems: "flex-start", boxShadow: "0 2px 12px rgba(26,20,20,.07)",
          }}>
            <div style={{ fontSize: 38, lineHeight: 1, flexShrink: 0 }}>🤗</div>
            <div>
              <h3 style={{ fontSize: 13.5, fontWeight: 700 }}>
                {summary && summary.step_goal_hits >= 3
                  ? "You're on fire! 🔥"
                  : "Keep going! 🌸"}
              </h3>
              <p style={{ fontSize: 12, color: "#6B7A9A", marginTop: 5, lineHeight: 1.6 }}>
                {summary && summary.last_logged
                  ? `Last logged ${new Date(summary.last_logged).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}. Consistency is key!`
                  : "Every step counts — keep sending updates over WhatsApp!"}
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 12, color: "#6B7A9A" }}>← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar (shared between loading / full dashboard) ─────────────────────────

function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mobile top bar */}
      <div style={{
        display: "none", position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "#fff", borderBottom: "1px solid #F5EEEE", padding: "12px 16px",
        alignItems: "center", justifyContent: "space-between",
      }} className="mobile-topbar">
        <span style={{ fontSize: 16, fontWeight: 700 }}>
          Health<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Ease</em>
        </span>
        <button onClick={() => setOpen(!open)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 22,
        }}>☰</button>
      </div>

      {/* Overlay */}
      {open && <div onClick={() => setOpen(false)} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 150,
      }} />}

      <div style={{
        width: 214, minHeight: "100vh", background: "#fff",
        borderRight: "1px solid #F5EEEE", padding: "24px 14px",
        display: "flex", flexDirection: "column", position: "fixed",
        top: 0, left: 0, bottom: 0, zIndex: 200,
        transform: open ? "translateX(0)" : undefined,
      }} className="sidebar">
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 26 }}>
        <div style={{
          width: 32, height: 32, background: "#E85C5C", borderRadius: 9, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 17.2C10 17.2 2.5 12.5 2.5 7.5A5 5 0 0 1 10 3.84 5 5 0 0 1 17.5 7.5C17.5 12.5 10 17.2 10 17.2Z" fill="white" />
          </svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700 }}>
          Health<em style={{ color: "#E85C5C", fontStyle: "normal" }}>Ease</em>
        </span>
      </div>

      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => (
          <li key={item.label}>
            <a href={item.href} style={{
              display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
              borderRadius: 10, fontSize: 13.5, fontWeight: item.active ? 600 : 500,
              color: item.active ? "#E85C5C" : "#6B7A9A",
              background: item.active ? "#FFEDEC" : "transparent",
              textDecoration: "none",
            }}>
              <span>{item.icon}</span> {item.label}
            </a>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "auto", paddingTop: 14 }}>
        <div style={{ background: "linear-gradient(145deg,#FFF5F3,#FFE4DE)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🌱</div>
          <h4 style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 }}>Stay consistent,<br />see the change!</h4>
          <p style={{ fontSize: 11.5, color: "#6B7A9A", marginTop: 5, lineHeight: 1.5 }}>Small steps today,<br />a healthier tomorrow.</p>
        </div>
      </div>
    </div>
    <style>{`
      @media (max-width: 768px) {
        .sidebar { transform: translateX(-100%); transition: transform .25s ease; }
        .mobile-topbar { display: flex !important; }
        .dashboard-main { margin-left: 0 !important; padding-top: 64px !important; }
        .stat-grid { grid-template-columns: 1fr !important; }
        .chart-grid { grid-template-columns: 1fr !important; }
        .progress-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
    </>
  );
}
