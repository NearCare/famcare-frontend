"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarBlank,
  CaretDown,
  CaretRight,
  CheckCircle,
  Info,
  Pill,
  Plus,
  X,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import {
  calculateStreak,
  getFamilyMembers,
  getUserLogs,
  type FamilyMember,
  type User,
} from "@/lib/api";

const WA_LINK = "https://wa.me/";

type PersonOption = {
  id: string;
  name: string;
  label: string;
};

type MedicineForm = {
  personId: string;
  name: string;
  strength: string;
  form: "Tablet" | "Capsule" | "Syrup" | "Injection";
  dose: string;
  timing: "After food" | "Before food" | "Anytime";
  times: string[];
  startDate: string;
  duration: "Ongoing" | "7 days" | "14 days" | "Custom";
  reminders: boolean;
  notes: string;
};

type Medicine = MedicineForm & {
  id: string;
  createdAt: string;
};

type ScheduleRow = {
  id: string;
  time: string;
  name: string;
  dose: string;
  timing: string;
  tone: string;
  status: string;
};

const todayISO = () => new Date().toLocaleDateString("en-CA");

const defaultForm = (personId: string): MedicineForm => ({
  personId,
  name: "",
  strength: "",
  form: "Tablet",
  dose: "1 tablet",
  timing: "After food",
  times: ["08:00"],
  startDate: todayISO(),
  duration: "Ongoing",
  reminders: true,
  notes: "",
});

const demoSchedule: ScheduleRow[] = [
  { id: "demo-1", time: "08:00 AM", name: "Metformin 500mg", dose: "1 tablet", timing: "After Breakfast", tone: "green", status: "Taken" },
  { id: "demo-2", time: "01:00 PM", name: "Telma 40mg", dose: "1 tablet", timing: "After Lunch", tone: "orange", status: "Due in 2h 15m" },
  { id: "demo-3", time: "08:00 PM", name: "Atorvastatin 10mg", dose: "1 tablet", timing: "After Dinner", tone: "violet", status: "Due in 7h" },
  { id: "demo-4", time: "10:00 PM", name: "Vitamin D3 60K", dose: "1 capsule", timing: "After Dinner", tone: "blue", status: "Tomorrow" },
];

function displayName(person: PersonOption | undefined) {
  if (!person) return "family";
  return person.label === "You" ? "you" : person.name;
}

function toneColors(tone: string) {
  if (tone === "orange") return { bg: "var(--he-orange-bg)", text: "var(--he-orange-deep)", border: "#FFE1BE" };
  if (tone === "violet") return { bg: "var(--he-violet-bg)", text: "#6A5BD0", border: "#DED8FF" };
  if (tone === "blue") return { bg: "var(--he-blue-bg)", text: "var(--he-blue-deep)", border: "#D4E8FF" };
  return { bg: "var(--he-green-bg)", text: "var(--he-green-deep)", border: "#CFEFDC" };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--he-ink-2)", marginBottom: 7 }}>
      {children}
    </label>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        height: 42,
        border: "1.5px solid var(--he-card-border)",
        borderRadius: 12,
        padding: "0 13px",
        background: "#FAF9FA",
        color: "var(--he-ink-1)",
        fontFamily: "inherit",
        fontSize: 13.5,
        fontWeight: 600,
        outline: "none",
      }}
    />
  );
}

function AddMedicineDrawer({
  people,
  initialPersonId,
  onClose,
  onSave,
}: {
  people: PersonOption[];
  initialPersonId: string;
  onClose: () => void;
  onSave: (medicine: Medicine) => void;
}) {
  const [form, setForm] = useState<MedicineForm>(() => defaultForm(initialPersonId));
  const selectedPerson = people.find((person) => person.id === form.personId);
  const canSave = form.personId && form.name.trim() && form.strength.trim() && form.times.length > 0;

  const update = <K extends keyof MedicineForm>(key: K, value: MedicineForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    if (!canSave) return;
    onSave({
      ...form,
      name: form.name.trim(),
      strength: form.strength.trim(),
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400 }}>
      <button
        aria-label="Close add medicine"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: "none", background: "rgba(26, 20, 20, .24)", cursor: "pointer" }}
      />
      <section
        className="med-drawer"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 460,
          maxWidth: "100%",
          height: "100%",
          background: "#fff",
          boxShadow: "-18px 0 46px rgba(31,28,35,.16)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Plus Jakarta Sans', var(--font-jakarta), system-ui, sans-serif",
        }}
      >
        <div style={{ padding: "24px 24px 18px", borderBottom: "1px solid var(--he-hairline)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: "var(--he-coral-bg)", display: "grid", placeItems: "center", flex: "none" }}>
            <Pill size={21} weight="bold" color="var(--he-coral)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.4px" }}>Add Medicine</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 500, color: "var(--he-ink-3)", lineHeight: 1.5 }}>
              Set dosage and reminders for {displayName(selectedPerson)}.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "#FAF9FA", width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={17} weight="bold" color="var(--he-ink-2)" />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel>Who is this medicine for?</FieldLabel>
            <select
              value={form.personId}
              onChange={(e) => update("personId", e.target.value)}
              style={{
                width: "100%",
                height: 44,
                border: "1.5px solid #D8F5E4",
                borderRadius: 13,
                padding: "0 13px",
                background: "var(--he-green-bg)",
                color: "var(--he-green-deep)",
                fontFamily: "inherit",
                fontSize: 13.5,
                fontWeight: 800,
                outline: "none",
              }}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.name} {person.label === "You" ? "(You)" : ""}</option>
              ))}
            </select>
          </div>

          <div className="med-form-grid">
            <div>
              <FieldLabel>Medicine name</FieldLabel>
              <TextField value={form.name} onChange={(value) => update("name", value)} placeholder="e.g. Metformin" />
            </div>
            <div>
              <FieldLabel>Strength</FieldLabel>
              <TextField value={form.strength} onChange={(value) => update("strength", value)} placeholder="500 mg" />
            </div>
          </div>

          <div>
            <FieldLabel>Form</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {(["Tablet", "Capsule", "Syrup", "Injection"] as MedicineForm["form"][]).map((option) => {
                const active = form.form === option;
                return (
                  <button
                    key={option}
                    onClick={() => update("form", option)}
                    style={{
                      height: 36,
                      border: `1.5px solid ${active ? "var(--he-coral)" : "var(--he-card-border)"}`,
                      borderRadius: 11,
                      background: active ? "var(--he-coral-bg)" : "#fff",
                      color: active ? "var(--he-coral-deep)" : "var(--he-ink-2)",
                      fontFamily: "inherit",
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="med-form-grid">
            <div>
              <FieldLabel>Dose</FieldLabel>
              <TextField value={form.dose} onChange={(value) => update("dose", value)} placeholder="1 tablet" />
            </div>
            <div>
              <FieldLabel>When to take</FieldLabel>
              <select
                value={form.timing}
                onChange={(e) => update("timing", e.target.value as MedicineForm["timing"])}
                style={{ width: "100%", height: 42, border: "1.5px solid var(--he-card-border)", borderRadius: 12, padding: "0 13px", background: "#FAF9FA", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: "var(--he-ink-1)" }}
              >
                <option>After food</option>
                <option>Before food</option>
                <option>Anytime</option>
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Schedule</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              {form.times.map((time, index) => (
                <input
                  key={`${time}-${index}`}
                  type="time"
                  value={time}
                  onChange={(e) => {
                    const next = [...form.times];
                    next[index] = e.target.value;
                    update("times", next);
                  }}
                  style={{ height: 38, border: "1.5px solid var(--he-blue-bg-2)", borderRadius: 11, background: "var(--he-blue-bg)", padding: "0 10px", color: "var(--he-blue-deep)", fontWeight: 800, fontFamily: "inherit" }}
                />
              ))}
              <button
                onClick={() => update("times", [...form.times, "20:00"])}
                style={{ height: 38, border: "1.5px dashed var(--he-coral)", borderRadius: 11, background: "#fff", color: "var(--he-coral-deep)", padding: "0 12px", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
              >
                + Add time
              </button>
            </div>
          </div>

          <div className="med-form-grid">
            <div>
              <FieldLabel>Start date</FieldLabel>
              <TextField type="date" value={form.startDate} onChange={(value) => update("startDate", value)} />
            </div>
            <div>
              <FieldLabel>Duration</FieldLabel>
              <select
                value={form.duration}
                onChange={(e) => update("duration", e.target.value as MedicineForm["duration"])}
                style={{ width: "100%", height: 42, border: "1.5px solid var(--he-card-border)", borderRadius: 12, padding: "0 13px", background: "#FAF9FA", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: "var(--he-ink-1)" }}
              >
                <option>Ongoing</option>
                <option>7 days</option>
                <option>14 days</option>
                <option>Custom</option>
              </select>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, border: "1px solid var(--he-hairline)", borderRadius: 14, padding: "13px 14px", cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--he-orange-bg)", display: "grid", placeItems: "center" }}>
                <Bell size={16} weight="bold" color="var(--he-orange-deep)" />
              </span>
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "var(--he-ink-1)" }}>WhatsApp reminder</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--he-ink-3)", fontWeight: 600 }}>Send reminders before each dose</span>
              </span>
            </span>
            <input type="checkbox" checked={form.reminders} onChange={(e) => update("reminders", e.target.checked)} />
          </label>

          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Optional instructions"
              rows={3}
              style={{ width: "100%", border: "1.5px solid var(--he-card-border)", borderRadius: 12, padding: "12px 13px", background: "#FAF9FA", color: "var(--he-ink-1)", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, outline: "none", resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ marginTop: "auto", padding: 18, borderTop: "1px solid var(--he-hairline)", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, border: "1.5px solid var(--he-card-border)", borderRadius: 13, background: "#fff", color: "var(--he-ink-2)", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={save} disabled={!canSave} style={{ flex: 1.4, height: 44, border: "none", borderRadius: 13, background: canSave ? "linear-gradient(150deg, var(--he-coral-2), var(--he-coral))" : "#F0A0A0", color: "#fff", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, cursor: canSave ? "pointer" : "not-allowed", boxShadow: canSave ? "0 8px 18px rgba(255,107,107,.28)" : "none" }}>
            Save Medicine
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  detail: string;
  tone: "green" | "orange" | "blue" | "violet";
}) {
  const colors = toneColors(tone);
  return (
    <div className="med-stat-card" style={{ border: `1.5px solid ${colors.border}`, background: "var(--he-card)", borderRadius: 18, padding: 20, minHeight: 132 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: colors.bg, display: "grid", placeItems: "center", flex: "none" }}>
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 29, fontWeight: 800, color: "var(--he-ink-1)", lineHeight: 1 }}>{value}</p>
          <p style={{ margin: "7px 0 0", fontSize: 13.5, fontWeight: 800, color: "var(--he-ink-1)" }}>{label}</p>
        </div>
      </div>
      <div style={{ height: 1, background: "var(--he-hairline)", margin: "17px 0 13px" }} />
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--he-ink-2)", lineHeight: 1.55 }}>{detail}</p>
    </div>
  );
}

export default function MedicationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("self");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem("auth_user");
      const authUser: User | null = stored ? JSON.parse(stored) : null;
      if (!authUser) { window.location.href = "/login"; return; }
      setUser(authUser);

      const token = localStorage.getItem("auth_token") ?? "";
      const [members, logs] = await Promise.all([
        getFamilyMembers(token).catch(() => [] as FamilyMember[]),
        getUserLogs(authUser.id, 30).catch(() => []),
      ]);
      setStreak(calculateStreak(logs));
      const options: PersonOption[] = [
        { id: "self", name: authUser.name ?? "You", label: "You" },
        ...members
          .filter((member) => member.status === "active")
          .map((member) => ({
            id: `member-${member.id}`,
            name: member.name ?? member.label,
            label: member.label,
          })),
      ];
      setPeople(options);
      setSelectedPersonId(options[0]?.id ?? "self");

      const saved = localStorage.getItem("nearcare_medicines");
      if (saved) setMedicines(JSON.parse(saved) as Medicine[]);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("nearcare_medicines", JSON.stringify(medicines));
  }, [medicines]);

  const selectedPerson = people.find((person) => person.id === selectedPersonId);
  const visibleMedicines = useMemo(
    () => medicines.filter((medicine) => medicine.personId === selectedPersonId),
    [medicines, selectedPersonId]
  );
  const hasMedicines = visibleMedicines.length > 0;
  const activeCount = visibleMedicines.length;
  const dosesToday = visibleMedicines.reduce((count, medicine) => count + medicine.times.length, 0);
  const avatarLetter = (user?.name ?? "T").charAt(0).toUpperCase();

  const scheduleRows = hasMedicines
    ? visibleMedicines.flatMap((medicine) => medicine.times.map((time, index) => ({
        id: `${medicine.id}-${index}`,
        time,
        name: `${medicine.name} ${medicine.strength}`,
        dose: medicine.dose,
        timing: medicine.timing,
        tone: index % 4 === 1 ? "orange" : index % 4 === 2 ? "violet" : index % 4 === 3 ? "blue" : "green",
        status: index === 0 ? "Upcoming" : "Scheduled",
      }))).sort((a, b) => a.time.localeCompare(b.time))
    : demoSchedule;

  const openAdd = () => setShowAddDrawer(true);

  return (
    <div className="db-page">
      <Sidebar />
      <div className="db-main">
        <div className="db-topbar">
          <div>
            <h1 className="db-greeting">Good afternoon, {user?.name ?? "Test User"}! 👋</h1>
            <p className="db-subtitle">Here&apos;s your health overview for today.</p>
          </div>
          <div className="db-top-actions">
            <div className="db-pill db-topbar-date" style={{ cursor: "default" }}>
              <CalendarBlank size={15} weight="bold" />
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div className="db-pill" style={{
              background: streak > 0 ? "#FFF3E8" : "#F5F3F8",
              border: `1.5px solid ${streak > 0 ? "#FFD0A0" : "#EDE6E6"}`,
              color: streak > 0 ? "#CC6A00" : "#9AA0AD",
              fontWeight: 800,
              cursor: "default",
            }}>
              🔥 {streak} {streak === 1 ? "day" : "days"}
            </div>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="db-pill cta">
              Log via WhatsApp
            </a>
            <div className="db-avatar">{avatarLetter}</div>
          </div>
        </div>

        <section className="db-card med-shell">
          <div className="med-page-head">
            <div>
              <h2 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.5px" }}>Medications</h2>
              <p style={{ margin: "6px 0 0", fontSize: 14.5, fontWeight: 500, color: "var(--he-ink-2)" }}>
                Manage medicines, doses and reminders for your family.
              </p>
            </div>
            <button onClick={openAdd} className="db-pill cta med-add-main">
              <Plus size={18} weight="bold" />
              Add New Medicine
            </button>
          </div>

          <div className="med-context-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--he-ink-3)", fontWeight: 800 }}>Viewing medicines for</span>
              <div style={{ position: "relative" }}>
                <select
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  style={{
                    appearance: "none",
                    height: 38,
                    minWidth: 180,
                    border: "1.5px solid #D8F5E4",
                    borderRadius: 12,
                    padding: "0 36px 0 13px",
                    background: "var(--he-green-bg)",
                    color: "var(--he-green-deep)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 800,
                    outline: "none",
                  }}
                >
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>{person.name} {person.label === "You" ? "(You)" : ""}</option>
                  ))}
                </select>
                <CaretDown size={14} weight="bold" color="var(--he-green-deep)" style={{ position: "absolute", right: 12, top: 12, pointerEvents: "none" }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--he-ink-3)", fontSize: 12.5, fontWeight: 700 }}>
              <Info size={15} weight="bold" />
              Kids can manage reminders for parents from here.
            </div>
          </div>

          <div className="med-stat-grid">
            <StatCard icon={<Pill size={23} weight="bold" color="var(--he-green-deep)" />} value={`${activeCount}`} label="Active Medicines" detail={hasMedicines ? `All medicines for ${displayName(selectedPerson)} are tracked.` : "No medicines added yet"} tone="green" />
            <StatCard icon={<Bell size={23} weight="fill" color="var(--he-orange-deep)" />} value={hasMedicines ? "1" : "0"} label="Due Soon" detail={hasMedicines ? "Next reminder depends on schedule" : "Add a schedule to see reminders"} tone="orange" />
            <StatCard icon={<CheckCircle size={23} weight="bold" color="var(--he-blue-deep)" />} value={hasMedicines ? "92%" : "--"} label="Adherence" detail={hasMedicines ? "This week" : "Starts after first dose"} tone="blue" />
            <StatCard icon={<CalendarBlank size={23} weight="bold" color="#6A5BD0" />} value={`${dosesToday}`} label="Doses Today" detail={hasMedicines ? `Across ${displayName(selectedPerson)}` : "Nothing scheduled today"} tone="violet" />
          </div>

          <section className="med-schedule-card">
            <div className="med-schedule-head">
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--he-ink-1)" }}>Today&apos;s Schedule</h3>
              <button className="db-pill" style={{ height: 38, boxShadow: "none" }}>
                <CalendarBlank size={15} weight="bold" />
                View Calendar
              </button>
            </div>

            {!hasMedicines ? (
              <div className="med-empty-state">
                <div style={{ width: 72, height: 72, borderRadius: 24, background: "linear-gradient(150deg, var(--he-coral-bg), var(--he-green-bg))", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
                  <Pill size={34} weight="bold" color="var(--he-coral)" />
                </div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.4px" }}>No medicines added yet</h3>
                <p style={{ margin: "8px auto 0", maxWidth: 500, fontSize: 14, lineHeight: 1.65, color: "var(--he-ink-2)", fontWeight: 500 }}>
                  Add your first medicine for {displayName(selectedPerson)} to track doses, reminders, and family adherence in one place.
                </p>
                <div className="med-empty-actions">
                  <button onClick={openAdd} className="db-pill cta" style={{ height: 44 }}>
                    <Plus size={17} weight="bold" />
                    Add First Medicine
                  </button>
                  <button style={{ border: "none", background: "transparent", color: "var(--he-ink-2)", fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
                    Learn how reminders work
                  </button>
                </div>
                <div className="med-empty-checks">
                  {["Set dose times", "Get WhatsApp reminders", "Track taken or missed doses"].map((item) => (
                    <span key={item}><CheckCircle size={14} weight="fill" color="var(--he-green)" /> {item}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {scheduleRows.map((row) => {
                  const colors = toneColors(row.tone);
                  return (
                    <div key={row.id} className="med-dose-row">
                      <div style={{ width: 64, height: 56, borderRadius: 13, background: colors.bg, color: colors.text, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, lineHeight: 1.2, textAlign: "center", flex: "none" }}>
                        {row.time.replace(" ", "\n")}
                      </div>
                      <div style={{ width: 48, height: 48, borderRadius: 13, background: colors.bg, display: "grid", placeItems: "center", flex: "none" }}>
                        <Pill size={23} weight="bold" color={colors.text} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, color: "var(--he-ink-1)", fontSize: 15.5, fontWeight: 800 }}>{row.name}</p>
                        <p style={{ margin: "4px 0 0", color: "var(--he-ink-2)", fontSize: 12.5, fontWeight: 600 }}>{row.dose} &nbsp;•&nbsp; {row.timing}</p>
                      </div>
                      <span style={{ background: colors.bg, color: colors.text, borderRadius: 99, padding: "7px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{row.status}</span>
                      <CaretRight size={18} weight="bold" color="var(--he-ink-3)" />
                    </div>
                  );
                })}
              </div>
            )}

            {hasMedicines && (
              <button style={{ width: "100%", height: 44, marginTop: 12, border: "1.5px solid var(--he-card-border)", background: "#fff", borderRadius: 13, fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, color: "var(--he-ink-1)", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                View All Medicines <CaretRight size={14} weight="bold" />
              </button>
            )}
          </section>
        </section>
      </div>

      {showAddDrawer && (
        <AddMedicineDrawer
          people={people}
          initialPersonId={selectedPersonId}
          onClose={() => setShowAddDrawer(false)}
          onSave={(medicine) => {
            setMedicines((current) => [...current, medicine]);
            setSelectedPersonId(medicine.personId);
            setShowAddDrawer(false);
          }}
        />
      )}
    </div>
  );
}
