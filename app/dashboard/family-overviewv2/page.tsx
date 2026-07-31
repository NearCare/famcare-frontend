"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Barbell,
  Bell,
  Clock,
  Crown,
  Flame,
  Footprints,
  ForkKnife,
  Pill,
  Plus,
  UsersThree,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import AddFamilyModal from "../components/AddFamilyModal";
import FamilyFoodReminderDrawer from "../components/FamilyFoodReminderDrawer";
import PageLoader from "../components/PageLoader";
import {
  getFamilyMembers,
  getFoodReminderPreference,
  getMemberLogEvents,
  getMemberLogs,
  getMemberSummary,
  getTodayMedicineDoses,
  getUserLogEvents,
  getUserLogs,
  getUserSummary,
  type FamilyMember,
  type FoodReminderPreference,
  type HealthLog,
  type HealthLogEvent,
  type Summary,
  type TodayDose,
  type User,
} from "@/lib/api";
import { captureEvent, identifyUser } from "@/lib/analytics";
import { useSubscription } from "@/lib/useSubscription";
import { isV2Enabled } from "@/lib/v2Feature";

type FamilyOverviewRow = {
  id: number;
  name: string;
  label: string;
  isSelf: boolean;
  summary: Summary | null;
  todayLog: HealthLog | null;
  recentEvents: HealthLogEvent[];
  doses: TodayDose[];
  foodReminder: FoodReminderPreference | null;
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "F";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function compactNumber(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("en-IN");
}

function eventTitle(event: HealthLogEvent | undefined) {
  if (!event) return "Add your first log";
  return event.raw_message?.trim() || event.summary?.trim() || "Health log";
}

function eventDetails(event: HealthLogEvent | undefined) {
  if (!event) return "Stay on track";
  const parts = [
    event.calories == null ? null : `${Math.round(event.calories)} kcal`,
    event.protein_g == null ? null : `${Math.round(event.protein_g)}g protein`,
  ].filter(Boolean);
  return parts.join(" · ") || "Health update";
}

function formatTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function nextFoodReminder(preference: FoodReminderPreference | null) {
  if (!preference?.enabled) return null;
  const enabledMeals = preference.meals.filter((meal) => meal.enabled);
  if (enabledMeals.length === 0) return null;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return [...enabledMeals].sort((left, right) => {
    const minutes = (time: string) => {
      const [hour, minute] = time.slice(0, 5).split(":").map(Number);
      const total = hour * 60 + minute;
      return total >= currentMinutes ? total - currentMinutes : total + 24 * 60 - currentMinutes;
    };
    return minutes(left.time) - minutes(right.time);
  })[0];
}

function nextMedicineDose(doses: TodayDose[]) {
  return [...doses]
    .filter((dose) => dose.status === "upcoming" || dose.status === "due")
    .sort((left, right) => new Date(left.scheduled_for).getTime() - new Date(right.scheduled_for).getTime())[0] ?? null;
}

export default function FamilyOverviewV2Page() {
  const { planKey } = useSubscription();
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [rows, setRows] = useState<FamilyOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [reminderTargetId, setReminderTargetId] = useState<number | null>(null);
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const reminderPeople = useMemo<FamilyMember[]>(() => {
    const self: FamilyMember[] = user ? [{
      id: user.id,
      phone: user.phone,
      name: user.name,
      label: "You",
      type: "self",
      status: "active",
      created_at: user.created_at,
    }] : [];
    return [...self, ...activeMembers];
  }, [activeMembers, user]);

  const load = useCallback(async () => {
    let redirecting = false;
    try {
      setLoading(true);
      setError(null);
      const stored = localStorage.getItem("auth_user");
      const authUser: User | null = stored ? JSON.parse(stored) : null;
      if (!authUser) {
        redirecting = true;
        window.location.href = "/login";
        return;
      }
      setUser(authUser);
      identifyUser(authUser);
      const token = localStorage.getItem("auth_token") ?? "";
      const [loadedMembers, v2Enabled] = await Promise.all([
        getFamilyMembers(token),
        isV2Enabled(token),
      ]);
      if (!v2Enabled) {
        redirecting = true;
        window.location.replace("/dashboard");
        return;
      }
      const active = loadedMembers.filter((member) => member.status === "active");
      setMembers(loadedMembers);
      captureEvent("family_overview_v2_viewed", { member_count: active.length });

      const loadRow = async (person: {
        id: number;
        name: string;
        label: string;
        isSelf: boolean;
      }): Promise<FamilyOverviewRow> => {
        const [summaryResult, logsResult, eventsResult, dosesResult, foodResult] = await Promise.allSettled([
          person.isSelf ? getUserSummary(person.id) : getMemberSummary(person.id, token),
          person.isSelf ? getUserLogs(person.id, 7) : getMemberLogs(person.id, token, 7),
          person.isSelf ? getUserLogEvents(person.id, 7) : getMemberLogEvents(person.id, token, 7),
          getTodayMedicineDoses(person.id, token),
          person.isSelf || v2Enabled
            ? getFoodReminderPreference(token, person.id)
            : Promise.resolve(null),
        ]);
        const logs = logsResult.status === "fulfilled" ? logsResult.value : [];
        const events = eventsResult.status === "fulfilled" ? eventsResult.value : [];
        return {
          ...person,
          summary: summaryResult.status === "fulfilled" ? summaryResult.value : null,
          todayLog: logs.find((log) => log.logged_at.slice(0, 10) === todayKey()) ?? null,
          recentEvents: events
            .filter((event) => event.calories != null || event.protein_g != null)
            .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
          doses: dosesResult.status === "fulfilled" ? dosesResult.value : [],
          foodReminder: foodResult.status === "fulfilled" ? foodResult.value : null,
        };
      };

      const people = [
        { id: authUser.id, name: authUser.name || "You", label: "Primary account", isSelf: true },
        ...active.map((member) => ({
          id: member.id,
          name: member.name || member.label || member.phone,
          label: member.label || "Family member",
          isSelf: false,
        })),
      ];
      setRows(await Promise.all(people.map(loadRow)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your family.");
    } finally {
      if (!redirecting) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="db-page">
        <Sidebar />
        <main className="db-main familyv2-main familyv2-loading">
          <PageLoader title="Loading family overview…" subtitle="We’re getting your family details ready." />
        </main>
      </div>
    );
  }

  return (
    <div className="db-page">
      <Sidebar />
      <main className="db-main familyv2-main">
        <header className="familyv2-header">
          <div className="familyv2-title-wrap">
            <div className="familyv2-title-line">
              <h1>Family Overview</h1>
              <span className="familyv2-member-count">
                <UsersThree size={15} weight="bold" />
                {activeMembers.length} {activeMembers.length === 1 ? "member" : "members"}
              </span>
            </div>
            <p>Track everyone&apos;s health in one place.</p>
          </div>

          <div className="familyv2-header-actions">
            <button
              type="button"
              className="familyv2-action secondary"
              onClick={() => {
                setReminderTargetId(activeMembers[0]?.id ?? null);
                setShowReminders(true);
                captureEvent("family_reminders_opened", { source: "family_overview_header" });
              }}
              disabled={activeMembers.length === 0}
              title={activeMembers.length === 0 ? "Add a family member first" : "Manage family food reminders"}
            >
              <Bell size={17} weight="bold" />
              Manage reminders
            </button>
            <button type="button" className="familyv2-action primary" onClick={() => {
              setShowAddFamily(true);
              captureEvent("family_member_add_started", { source: "family_overview_header" });
            }}>
              <Plus size={18} weight="bold" />
              Add family member
            </button>
          </div>
        </header>

        {planKey && <Link
          href="/dashboard/payments"
          className={`familyv2-upgrade-entry ${planKey}`}
          onClick={() => captureEvent("billing_entry_clicked", {
            source: "family_overview_v2",
            current_plan: planKey,
          })}
          aria-label={
            planKey === "family"
              ? "Add another parent to FamCare"
              : planKey === "individual"
                ? "Upgrade to the FamCare Family plan"
                : "Explore FamCare Plus plans"
          }
        >
          <span className="familyv2-upgrade-icon"><Crown size={18} weight="fill" /></span>
          <span className="familyv2-upgrade-copy">
            <strong>
              {planKey === "family"
                ? "Need room for another parent?"
                : planKey === "individual"
                  ? "Care for both parents together"
                  : "Bring more family care into FamCare"}
            </strong>
            <small>
              {planKey === "family"
                ? "Add a separate family profile with their own logs and reminders."
                : planKey === "individual"
                  ? "Upgrade to Family for two parent profiles and shared family insights."
                  : "Compare Individual and Family plans when you’re ready."}
            </small>
          </span>
          <span className="familyv2-upgrade-action">
            {planKey === "family"
              ? "Add parent · ₹149/mo"
              : planKey === "individual"
                ? "Upgrade to Family"
                : "Explore FamCare+"}
            <ArrowRight size={14} weight="bold" />
          </span>
        </Link>}

        {error && <p className="familyv2-page-error" role="alert">{error}</p>}
        <section className="familyv2-table-shell" aria-label="Family health overview">
          <div className="familyv2-table-head" aria-hidden="true">
            <span>Member</span>
            <span>Today&apos;s progress</span>
            <span>Recent logs</span>
            <span>Next medication reminder</span>
            <span>Medications</span>
            <span>Food reminder</span>
          </div>

          <div className="familyv2-table-body">
            {rows.map((row) => {
              const latestEvent = row.recentEvents[0];
              const nextDose = nextMedicineDose(row.doses);
              const takenDoses = row.doses.filter((dose) => dose.status === "taken").length;
              const pendingDoses = row.doses.filter((dose) => dose.status !== "taken" && dose.status !== "skipped").length;
              const foodReminder = nextFoodReminder(row.foodReminder);
              const caloriesGoal = row.isSelf ? user?.goal_calories ?? 2000 : 2000;
              const proteinGoal = row.isSelf ? user?.goal_protein_g ?? 60 : 60;
              const stepsGoal = row.isSelf ? user?.goal_steps ?? 5000 : 5000;
              const progress = [
                {
                  key: "calories",
                  icon: <Flame size={12} weight="fill" />,
                  value: row.todayLog?.calories,
                  goal: caloriesGoal,
                  unit: "kcal",
                  color: "#FF8B2D",
                },
                {
                  key: "protein",
                  icon: <Barbell size={12} weight="bold" />,
                  value: row.todayLog?.protein_g,
                  goal: proteinGoal,
                  unit: "g",
                  color: "#4A95F8",
                },
                {
                  key: "steps",
                  icon: <Footprints size={12} weight="fill" />,
                  value: row.todayLog?.steps,
                  goal: stepsGoal,
                  unit: "",
                  color: "#20B66A",
                },
              ];

              return (
                <article className="familyv2-table-row" key={`${row.isSelf ? "self" : "member"}-${row.id}`}>
                  <div className="familyv2-member-cell" data-label="Member">
                    <span className="familyv2-avatar">
                      {initials(row.name)}
                      <i />
                    </span>
                    <div>
                      <b><span>{firstName(row.name)}</span>{row.isSelf && <em>You</em>}</b>
                      <span>{row.label}</span>
                    </div>
                  </div>

                  <div className="familyv2-progress-cell" data-label="Today’s progress">
                    {progress.map((metric) => {
                      const percentage = metric.value == null ? 0 : Math.min((metric.value / metric.goal) * 100, 100);
                      return (
                        <div className="familyv2-progress-metric" key={metric.key}>
                          <div>
                            <span style={{ color: metric.color }}>{metric.icon}</span>
                            <b>{compactNumber(metric.value)} <small>{metric.unit}</small></b>
                          </div>
                          <i><span style={{ width: `${percentage}%`, background: metric.color }} /></i>
                          <small>{compactNumber(metric.goal)} goal</small>
                        </div>
                      );
                    })}
                  </div>

                  <div className="familyv2-compact-card logs" data-label="Recent logs">
                    <div className="familyv2-card-eyebrow">
                      <span>Recent logs</span>
                      <em>{row.recentEvents.length > 0 ? `${row.recentEvents.length} recent ${row.recentEvents.length === 1 ? "entry" : "entries"}` : "No recent entries"}</em>
                    </div>
                    <b title={eventTitle(latestEvent)}>{eventTitle(latestEvent)}</b>
                    <span>{eventDetails(latestEvent)}</span>
                    <Link
                      href="/dashboard/logs"
                      onClick={() => captureEvent("health_logs_entry_clicked", {
                        source: "family_overview_v2",
                        subject_type: row.isSelf ? "self" : "family",
                      })}
                    >
                      View logs <ArrowRight size={13} weight="bold" />
                    </Link>
                  </div>

                  <div className="familyv2-compact-card medicine" data-label="Next medication reminder">
                    <div className="familyv2-card-eyebrow">
                      <Clock size={14} weight="bold" />
                      <span>Next med reminder</span>
                    </div>
                    {nextDose ? (
                      <>
                        <b>{formatTime(nextDose.scheduled_for)}</b>
                        <span>{nextDose.medicine.name}{nextDose.medicine.strength ? ` · ${nextDose.medicine.strength}` : ""}</span>
                        <small>{nextDose.medicine.dose}</small>
                      </>
                    ) : (
                      <>
                        <b>All clear</b>
                        <span>No upcoming dose today</span>
                      </>
                    )}
                    <Link
                      href={`/dashboard/medications?person=${row.isSelf ? "self" : `member-${row.id}`}`}
                      onClick={() => captureEvent("medications_entry_clicked", {
                        source: "family_overview_v2",
                        subject_type: row.isSelf ? "self" : "family",
                      })}
                    >
                      View all reminders <ArrowRight size={13} weight="bold" />
                    </Link>
                  </div>

                  <div className="familyv2-medication-count" data-label="Medications">
                    <Pill size={17} weight="duotone" />
                    <div>
                      <b>{row.doses.length > 0 ? `${takenDoses} of ${row.doses.length} taken` : "No doses today"}</b>
                      <span>{pendingDoses > 0 ? `${pendingDoses} pending` : row.doses.length > 0 ? "All done" : "Nothing scheduled"}</span>
                    </div>
                  </div>

                  <div className="familyv2-compact-card food" data-label="Food reminder">
                    <div className="familyv2-card-eyebrow">
                      <ForkKnife size={14} weight="bold" />
                      <span>Next food reminder</span>
                    </div>
                    {foodReminder ? (
                      <>
                        <b>{formatTime(`${todayKey()}T${foodReminder.time.slice(0, 5)}:00`)}</b>
                        <span>{foodReminder.label}</span>
                      </>
                    ) : (
                      <>
                        <b>Reminder off</b>
                        <span>Set a logging time</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setReminderTargetId(row.id);
                        setShowReminders(true);
                        captureEvent("family_reminders_opened", {
                          source: "family_overview_row",
                          subject_type: row.isSelf ? "self" : "family",
                        });
                      }}
                    >
                      Set food reminder <ArrowRight size={13} weight="bold" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {showAddFamily && (
        <AddFamilyModal
          onClose={() => setShowAddFamily(false)}
          onAdded={(member) => {
            setMembers((current) => (
              current.some((item) => item.id === member.id)
                ? current.map((item) => item.id === member.id ? member : item)
                : [...current, member]
            ));
            captureEvent("family_member_added", { source: "family_overview_v2" });
          }}
          onActivated={() => void load()}
        />
      )}
      {showReminders && reminderPeople.length > 0 && (
        <FamilyFoodReminderDrawer
          members={reminderPeople}
          initialMemberId={reminderTargetId ?? reminderPeople[0].id}
          onClose={() => setShowReminders(false)}
        />
      )}
    </div>
  );
}
