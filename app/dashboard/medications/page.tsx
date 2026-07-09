"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarBlank,
  CaretDown,
  CaretRight,
  CheckCircle,
  Info,
  PencilSimple,
  Pill,
  Plus,
  Trash,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import {
  calculateStreak,
  createMedicine,
  deleteMedicine,
  getFamilyMembers,
  getMedicines,
  getTodayMedicineDoses,
  getUserLogs,
  markMedicineDose,
  updateMedicine,
  type FamilyMember,
  type Medicine,
  type TodayDose,
  type User,
} from "@/lib/api";
import StreakPill from "../components/StreakPill";
import PageLoader from "../components/PageLoader";
import { captureEvent, identifyUser } from "@/lib/analytics";
import { FAMCARE_WHATSAPP_LINK } from "@/lib/whatsapp";

const WA_LINK = FAMCARE_WHATSAPP_LINK;

type PersonOption = {
  id: string;
  userId: number;
  name: string;
  label: string;
};

type DayPart = "Morning" | "Afternoon" | "Evening" | "Night";

type ScheduledTime = {
  dayPart: DayPart;
  time: string;
};

type WeekDay = {
  value: number;
  label: string;
  short: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type MedicineForm = {
  personId: string;
  name: string;
  dose: string;
  form: "Tablet" | "Capsule" | "Syrup" | "Injection";
  dayPart: DayPart;
  times: ScheduledTime[];
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  reminders: boolean;
};

type ScheduleRow = {
  id: string;
  medicineId: number;
  scheduleId: number;
  scheduledFor: string;
  timeLabel: string;
  name: string;
  dose: string;
  timing: string;
  tone: string;
  status: string;
  actionStatus: TodayDose["status"];
  canMarkTaken: boolean;
};

const todayISO = () => new Date().toLocaleDateString("en-CA");

const defaultForm = (personId: string): MedicineForm => ({
  personId,
  name: "",
  dose: "",
  form: "Tablet",
  dayPart: "Morning",
  times: [
    { dayPart: "Morning", time: "08:00" },
    { dayPart: "Afternoon", time: "13:00" },
    { dayPart: "Evening", time: "17:00" },
    { dayPart: "Night", time: "22:00" },
  ],
  startDate: todayISO(),
  endDate: "",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  reminders: true,
});

const DEFAULT_TIMES_BY_DAY_PART: Record<DayPart, string> = {
  Morning: "08:00",
  Afternoon: "13:00",
  Evening: "17:00",
  Night: "22:00",
};

function normalizeQuarterHourTime(value: string) {
  const [hourPart = "0", minutePart = "0"] = value.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;

  const roundedMinute = Math.round(minute / 15) * 15;
  const normalizedHour = (hour + Math.floor(roundedMinute / 60)) % 24;
  const normalizedMinute = roundedMinute % 60;
  return `${String(normalizedHour).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`;
}

const WEEK_DAYS: WeekDay[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

function displayName(person: PersonOption | undefined) {
  if (!person) return "family";
  return person.label === "You" ? "you" : person.name;
}

function toApiForm(form: MedicineForm["form"]) {
  return form.toLowerCase();
}

function toUiForm(form: string): MedicineForm["form"] {
  if (form === "capsule") return "Capsule";
  if (form === "syrup") return "Syrup";
  if (form === "injection") return "Injection";
  return "Tablet";
}

function dayPartForTime(time: string): DayPart {
  const hour = Number(time.split(":")[0] ?? 0);
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

function formFromMedicine(medicine: Medicine, personId: string): MedicineForm {
  const firstSchedule = medicine.schedules[0];
  return {
    personId,
    name: medicine.name,
    dose: medicine.dose === "As prescribed" ? "" : medicine.dose,
    form: toUiForm(medicine.form),
    dayPart: firstSchedule ? dayPartForTime(firstSchedule.time_of_day) : "Morning",
    times: medicine.schedules.map((schedule) => ({
      dayPart: dayPartForTime(schedule.time_of_day),
      time: schedule.time_of_day.slice(0, 5),
    })),
    startDate: medicine.start_date,
    endDate: medicine.end_date ?? "",
    daysOfWeek: firstSchedule?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
    reminders: medicine.schedules.every((schedule) => schedule.reminder_enabled),
  };
}

function formatTiming(timing: string | null) {
  if (timing === "after_food") return "After food";
  if (timing === "before_food") return "Before food";
  if (timing === "with_food") return "With food";
  if (timing === "empty_stomach") return "Empty stomach";
  return "Anytime";
}

function formatTimeLabel(timeOfDay: string) {
  const [hourPart = "0", minutePart = "0"] = timeOfDay.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return timeOfDay;
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${period}`;
}

function statusLabel(status: TodayDose["status"]) {
  if (status === "taken") return "Taken";
  if (status === "missed") return "Missed";
  if (status === "skipped") return "Skipped";
  if (status === "due") return "Due now";
  return "Upcoming";
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

function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p style={{ margin: "7px 0 0", color: "var(--he-coral-deep)", fontSize: 11.5, fontWeight: 800 }}>
      {children}
    </p>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  error = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  error?: boolean;
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
        border: `1.5px solid ${error ? "var(--he-coral)" : "var(--he-card-border)"}`,
        borderRadius: 12,
        padding: "0 13px",
        background: error ? "var(--he-coral-bg)" : "#FAF9FA",
        color: "var(--he-ink-1)",
        fontFamily: "inherit",
        fontSize: 13.5,
        fontWeight: 600,
        outline: "none",
      }}
    />
  );
}

function FancySelect({
  value,
  options,
  onChange,
  tone = "neutral",
  compact = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  tone?: "neutral" | "green";
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const isGreen = tone === "green";

  return (
    <div
      tabIndex={0}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      style={{ position: "relative", minWidth: compact ? 190 : undefined }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          height: compact ? 38 : 44,
          border: `1.5px solid ${isGreen ? "#D8F5E4" : "var(--he-card-border)"}`,
          borderRadius: compact ? 12 : 13,
          padding: compact ? "0 36px 0 13px" : "0 38px 0 13px",
          background: isGreen ? "var(--he-green-bg)" : "#FAF9FA",
          color: isGreen ? "var(--he-green-deep)" : "var(--he-ink-1)",
          fontFamily: "inherit",
          fontSize: compact ? 13 : 13.5,
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          boxShadow: open ? "0 8px 22px rgba(31,28,35,.1)" : "none",
          outline: "none",
          textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label}</span>
        <CaretDown
          size={14}
          weight="bold"
          color={isGreen ? "var(--he-green-deep)" : "var(--he-ink-2)"}
          style={{ position: "absolute", right: 13, transform: open ? "rotate(180deg)" : "none", transition: "transform .16s ease" }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "#fff",
            border: "1.5px solid var(--he-card-border)",
            borderRadius: 13,
            boxShadow: "0 16px 34px rgba(31,28,35,.16)",
            padding: 5,
            overflow: "hidden",
          }}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  minHeight: 36,
                  border: "none",
                  borderRadius: 9,
                  background: active ? (isGreen ? "var(--he-green-bg)" : "var(--he-coral-bg)") : "#fff",
                  color: active ? (isGreen ? "var(--he-green-deep)" : "var(--he-coral-deep)") : "var(--he-ink-2)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: active ? 800 : 700,
                  cursor: "pointer",
                  padding: "8px 10px",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ width: 16, color: active ? "currentColor" : "transparent", fontWeight: 900 }}>✓</span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddMedicineDrawer({
  people,
  initialPersonId,
  initialForm,
  mode = "add",
  saving,
  onClose,
  onSave,
}: {
  people: PersonOption[];
  initialPersonId: string;
  initialForm?: MedicineForm;
  mode?: "add" | "edit";
  saving: boolean;
  onClose: () => void;
  onSave: (form: MedicineForm) => Promise<void>;
}) {
  const [form, setForm] = useState<MedicineForm>(() => initialForm ?? defaultForm(initialPersonId));
  const [submitted, setSubmitted] = useState(false);
  const selectedPerson = people.find((person) => person.id === form.personId);
  const invalidDateRange = Boolean(form.endDate && form.startDate && form.endDate < form.startDate);
  const errors = {
    personId: !form.personId ? "Choose who this medicine is for." : "",
    name: !form.name.trim() ? "Enter the medicine name." : "",
    dose: !form.dose.trim() ? "Enter the dose, e.g. 1 tablet." : "",
    times: form.times.length === 0 ? "Add at least one reminder time." : "",
    daysOfWeek: form.daysOfWeek.length === 0 ? "Choose at least one repeat day." : "",
    startDate: !form.startDate ? "Choose a start date." : "",
    endDate: invalidDateRange ? "End date cannot be before start date." : "",
  };
  const canSave = Object.values(errors).every((message) => !message);
  const personOptions = people.map((person) => ({
    value: person.id,
    label: `${person.name} ${person.label === "You" ? "(You)" : ""}`,
  }));

  const update = <K extends keyof MedicineForm>(key: K, value: MedicineForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    setSubmitted(true);
    if (!canSave || saving) return;
    void onSave({
      ...form,
      name: form.name.trim(),
      dose: form.dose.trim(),
    });
  };

  const addScheduleTime = () => {
    update("times", [...form.times, { dayPart: form.dayPart, time: DEFAULT_TIMES_BY_DAY_PART[form.dayPart] }]);
  };

  const removeScheduleTime = (index: number) => {
    update("times", form.times.filter((_, itemIndex) => itemIndex !== index));
  };

  const toggleWeekDay = (day: number) => {
    const selected = form.daysOfWeek.includes(day);
    const nextDays = selected
      ? form.daysOfWeek.filter((item) => item !== day)
      : [...form.daysOfWeek, day].sort((a, b) => a - b);
    update("daysOfWeek", nextDays);
  };
  const weeklySelected = form.daysOfWeek.length === WEEK_DAYS.length;
  const toggleWeekly = () => {
    update("daysOfWeek", weeklySelected ? [] : WEEK_DAYS.map((day) => day.value));
  };
  const selectedTimes = form.times
    .map((schedule, index) => ({ schedule, index }))
    .filter(({ schedule }) => schedule.dayPart === form.dayPart);

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
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.4px" }}>{mode === "edit" ? "Edit Medicine" : "Add Medicine"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 500, color: "var(--he-ink-3)", lineHeight: 1.5 }}>
              Set reminders for {displayName(selectedPerson)}.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "#FAF9FA", width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={17} weight="bold" color="var(--he-ink-2)" />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel>Who is this medicine for?</FieldLabel>
            <FancySelect
              value={form.personId}
              options={personOptions}
              onChange={(nextValue) => update("personId", nextValue)}
              tone="green"
            />
            <FieldError>{submitted && errors.personId}</FieldError>
          </div>

          <div className="med-form-grid">
            <div>
              <FieldLabel>Medicine name</FieldLabel>
              <TextField value={form.name} onChange={(value) => update("name", value)} placeholder="e.g. Metformin" error={submitted && Boolean(errors.name)} />
              <FieldError>{submitted && errors.name}</FieldError>
            </div>
            <div>
              <FieldLabel>Dose</FieldLabel>
              <TextField value={form.dose} onChange={(value) => update("dose", value)} placeholder="e.g. 1 tablet" error={submitted && Boolean(errors.dose)} />
              <FieldError>{submitted && errors.dose}</FieldError>
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

          <div>
            <FieldLabel>Reminder times</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              {(["Morning", "Afternoon", "Evening", "Night"] as DayPart[]).map((option) => {
                const active = form.dayPart === option;
                return (
                  <button
                    key={option}
                    onClick={() => update("dayPart", option)}
                    style={{
                      height: 36,
                      border: `1.5px solid ${active ? "var(--he-blue-deep)" : "var(--he-card-border)"}`,
                      borderRadius: 11,
                      background: active ? "var(--he-blue-bg)" : "#fff",
                      color: active ? "var(--he-blue-deep)" : "var(--he-ink-2)",
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
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {selectedTimes.map(({ schedule, index }) => (
                <div
                  key={`${schedule.dayPart}-${schedule.time}-${index}`}
                  style={{ display: "flex", alignItems: "center", gap: 9, border: "1.5px solid var(--he-blue-bg-2)", borderRadius: 12, background: "var(--he-blue-bg)", padding: "8px 9px" }}
                >
                  <span style={{ minWidth: 76, color: "var(--he-blue-deep)", fontSize: 12, fontWeight: 800 }}>{schedule.dayPart}</span>
                  <input
                    type="time"
                    step={900}
                    value={schedule.time}
                    onChange={(e) => {
                      const next = [...form.times];
                      next[index] = { ...schedule, time: normalizeQuarterHourTime(e.target.value) };
                      update("times", next);
                    }}
                    style={{ height: 34, border: "1px solid #CFE4FF", borderRadius: 10, background: "#fff", padding: "0 10px", color: "var(--he-blue-deep)", fontWeight: 800, fontFamily: "inherit", flex: 1 }}
                  />
                  <button
                    onClick={() => removeScheduleTime(index)}
                    aria-label={`Remove time ${index + 1}`}
                    style={{ height: 34, border: "1px solid #FFD7D7", borderRadius: 10, background: "#fff", color: "var(--he-coral-deep)", padding: "0 10px", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {selectedTimes.length === 0 && (
                <button
                  onClick={addScheduleTime}
                  style={{ height: 40, border: "1.5px dashed var(--he-green)", borderRadius: 12, background: "#fff", color: "var(--he-green-deep)", padding: "0 12px", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
                >
                  + Schedule {form.dayPart.toLowerCase()} time
                </button>
              )}
              <FieldError>{submitted && errors.times}</FieldError>
            </div>
          </div>

          <div>
            <FieldLabel>Repeat on</FieldLabel>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10, color: "var(--he-ink-2)", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
              <input type="checkbox" checked={weeklySelected} onChange={toggleWeekly} />
              Weekly
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 7 }}>
              {WEEK_DAYS.map((day) => {
                const active = form.daysOfWeek.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekDay(day.value)}
                    aria-pressed={active}
                    title={day.label}
                    style={{
                      height: 34,
                      border: `1.5px solid ${active ? "var(--he-green)" : "var(--he-card-border)"}`,
                      borderRadius: 11,
                      background: active ? "var(--he-green-bg)" : "#fff",
                      color: active ? "var(--he-green-deep)" : "var(--he-ink-2)",
                      fontFamily: "inherit",
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: "7px 0 0", fontSize: 11.5, color: "var(--he-ink-3)", fontWeight: 600 }}>
              Medicines stay ongoing until you remove them.
            </p>
            <FieldError>{submitted && errors.daysOfWeek}</FieldError>
          </div>

          <div className="med-form-grid">
            <div>
              <FieldLabel>Start date</FieldLabel>
              <TextField type="date" value={form.startDate} onChange={(value) => update("startDate", value)} error={submitted && Boolean(errors.startDate)} />
              <FieldError>{submitted && errors.startDate}</FieldError>
            </div>
            <div>
              <FieldLabel>End date</FieldLabel>
              <TextField type="date" value={form.endDate} onChange={(value) => update("endDate", value)} error={submitted && Boolean(errors.endDate)} />
              <FieldError>{submitted && errors.endDate}</FieldError>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, border: "1px solid var(--he-hairline)", borderRadius: 14, padding: "13px 14px", cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--he-orange-bg)", display: "grid", placeItems: "center" }}>
                <WhatsappLogo size={17} weight="fill" color="#25D366" />
              </span>
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "var(--he-ink-1)" }}>WhatsApp reminder</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--he-ink-3)", fontWeight: 600 }}>Send reminders before each dose</span>
              </span>
            </span>
            <input type="checkbox" checked={form.reminders} onChange={(e) => update("reminders", e.target.checked)} />
          </label>

	        </div>

        <div style={{ marginTop: "auto", padding: 18, borderTop: "1px solid var(--he-hairline)", display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ flex: 1, height: 44, border: "1.5px solid var(--he-card-border)", borderRadius: 13, background: "#fff", color: "var(--he-ink-2)", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}>
            Cancel
          </button>
          <button onClick={save} disabled={!canSave || saving} style={{ flex: 1.4, height: 44, border: "none", borderRadius: 13, background: canSave && !saving ? "linear-gradient(150deg, #38D184, var(--he-green))" : "#BDE8CF", color: "#fff", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, cursor: canSave && !saving ? "pointer" : "not-allowed", boxShadow: canSave && !saving ? "0 8px 18px rgba(32,168,101,.24)" : "none" }}>
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Medicine"}
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
  return (
    <Suspense fallback={
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PageLoader
            title="Loading medications..."
            subtitle="We're loading schedules, reminders, and family medicine data."
          />
        </div>
      </div>
    }>
      <MedicationsContent />
    </Suspense>
  );
}

function MedicationsContent() {
  const searchParams = useSearchParams();
  const requestedPersonId = searchParams.get("person");
  const [user, setUser] = useState<User | null>(null);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("self");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [todayDoses, setTodayDoses] = useState<TodayDose[]>([]);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [streak, setStreak] = useState(0);
  const [initializing, setInitializing] = useState(true);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [savingMedicine, setSavingMedicine] = useState(false);
  const [deletingMedicineId, setDeletingMedicineId] = useState<number | null>(null);
  const [markingDoseId, setMarkingDoseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("auth_user");
        const authUser: User | null = stored ? JSON.parse(stored) : null;
        if (!authUser) { window.location.href = "/login"; return; }
        setUser(authUser);

        const token = localStorage.getItem("auth_token") ?? "";
        const [members, logs] = await Promise.all([
          getFamilyMembers(token).catch(() => [] as FamilyMember[]),
          getUserLogs(authUser.id, 30).catch(() => []),
        ]);
        const activeMembers = members.filter((member) => member.status === "active");
        setStreak(calculateStreak(logs));
        identifyUser(authUser);
        captureEvent("medications_viewed", {
          family_member_count: activeMembers.length,
          has_family_members: activeMembers.length > 0,
        });
        const options: PersonOption[] = [
          { id: "self", userId: authUser.id, name: authUser.name ?? "You", label: "You" },
          ...activeMembers
            .map((member) => ({
              id: `member-${member.id}`,
              userId: member.id,
              name: member.name ?? member.label,
              label: member.label,
            })),
        ];
        setPeople(options);
        setSelectedPersonId(options.some((option) => option.id === requestedPersonId) ? requestedPersonId! : options[0]?.id ?? "self");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load medications");
      } finally {
        setInitializing(false);
      }
    })();
  }, [requestedPersonId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const selected = people.find((person) => person.id === selectedPersonId);
      if (!selected) return;
      const token = localStorage.getItem("auth_token") ?? "";
      setLoadingMedicines(true);
      setError(null);
      try {
        const [nextMedicines, nextDoses] = await Promise.all([
          getMedicines(selected.userId, token),
          getTodayMedicineDoses(selected.userId, token),
        ]);
        if (cancelled) return;
        setMedicines(nextMedicines);
        setTodayDoses(nextDoses);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load medicines");
        setMedicines([]);
        setTodayDoses([]);
      } finally {
        if (!cancelled) setLoadingMedicines(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [people, selectedPersonId]);

  const selectedPerson = people.find((person) => person.id === selectedPersonId);
  const activeMedicines = useMemo(() => medicines.filter((medicine) => medicine.is_active), [medicines]);
  const hasMedicines = activeMedicines.length > 0;
  const activeCount = activeMedicines.length;
  const dosesToday = todayDoses.length;
  const completedDoses = todayDoses.filter((dose) => ["taken", "missed", "skipped"].includes(dose.status));
  const takenDoses = todayDoses.filter((dose) => dose.status === "taken");
  const adherence = completedDoses.length ? Math.round((takenDoses.length / completedDoses.length) * 100) : null;
  const dueSoon = todayDoses.filter((dose) => dose.status === "due" || dose.status === "upcoming").length;
  const avatarLetter = (user?.name ?? "T").charAt(0).toUpperCase();
  const selectedPersonOptions = people.map((person) => ({
    value: person.id,
    label: `${person.name} ${person.label === "You" ? "(You)" : ""}`,
  }));

  const scheduleRows: ScheduleRow[] = todayDoses.map((dose, index) => ({
    id: dose.id,
    medicineId: dose.medicine.id,
    scheduleId: dose.schedule.id,
    scheduledFor: dose.scheduled_for,
    timeLabel: formatTimeLabel(dose.schedule.time_of_day),
    name: `${dose.medicine.name}${dose.medicine.strength ? ` ${dose.medicine.strength}` : ""}`,
    dose: dose.medicine.dose,
    timing: dose.medicine.timing === "anytime" ? "" : formatTiming(dose.medicine.timing),
    tone: index % 4 === 1 ? "orange" : index % 4 === 2 ? "violet" : index % 4 === 3 ? "blue" : "green",
    status: statusLabel(dose.status),
    actionStatus: dose.status,
    canMarkTaken: dose.status !== "taken" && dose.status !== "upcoming",
  }));

  const openAdd = () => {
    setEditingMedicine(null);
    captureEvent("medicine_add_opened", {
      patient_type: selectedPersonId === "self" ? "self" : "family",
    });
    setShowAddDrawer(true);
  };

  const openEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setShowAddDrawer(true);
    captureEvent("medicine_edit_opened", {
      medicine_id: medicine.id,
    });
  };
  const refreshMedicinesFor = async (patientUserId: number) => {
    const token = localStorage.getItem("auth_token") ?? "";
    const [nextMedicines, nextDoses] = await Promise.all([
      getMedicines(patientUserId, token),
      getTodayMedicineDoses(patientUserId, token),
    ]);
    setMedicines(nextMedicines);
    setTodayDoses(nextDoses);
  };
  const refreshSelectedMedicines = async () => {
    if (!selectedPerson) return;
    await refreshMedicinesFor(selectedPerson.userId);
  };

  const saveMedicine = async (form: MedicineForm) => {
    const person = people.find((item) => item.id === form.personId);
    if (!person) return;
    const token = localStorage.getItem("auth_token") ?? "";
    setSavingMedicine(true);
    setError(null);
    try {
      const payload = {
        patient_user_id: person.userId,
        name: form.name,
        strength: null,
        form: toApiForm(form.form),
        dose: form.dose,
        timing: "anytime",
        start_date: form.startDate,
        end_date: form.endDate || null,
        notes: null,
        schedules: form.times.map((schedule) => ({
          time_of_day: schedule.time,
          days_of_week: form.daysOfWeek,
          reminder_enabled: form.reminders,
          reminder_offset_minutes: 0,
        })),
      };
      if (editingMedicine) {
        await updateMedicine(editingMedicine.id, payload, token);
        captureEvent("medicine_updated", {
          medicine_id: editingMedicine.id,
          schedules_count: form.times.length,
          reminders_enabled: form.reminders,
          days_count: form.daysOfWeek.length,
        });
      } else {
        await createMedicine(payload, token);
        captureEvent("medicine_added", {
          patient_type: form.personId === "self" ? "self" : "family",
          schedules_count: form.times.length,
          reminders_enabled: form.reminders,
          days_count: form.daysOfWeek.length,
        });
      }
      setSelectedPersonId(form.personId);
      setShowAddDrawer(false);
      setEditingMedicine(null);
      await refreshMedicinesFor(person.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save medicine");
    } finally {
      setSavingMedicine(false);
    }
  };

  const archiveMedicine = async (medicine: Medicine) => {
    const confirmed = window.confirm(`Delete ${medicine.name}? Reminders for this medicine will stop.`);
    if (!confirmed) return;
    const token = localStorage.getItem("auth_token") ?? "";
    setDeletingMedicineId(medicine.id);
    setError(null);
    try {
      await deleteMedicine(medicine.id, token);
      captureEvent("medicine_deleted", { medicine_id: medicine.id });
      await refreshSelectedMedicines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete medicine");
    } finally {
      setDeletingMedicineId(null);
    }
  };

  const markTaken = async (row: ScheduleRow) => {
    const token = localStorage.getItem("auth_token") ?? "";
    setMarkingDoseId(row.id);
    setError(null);
    try {
      await markMedicineDose(row.medicineId, {
        schedule_id: row.scheduleId,
        scheduled_for: row.scheduledFor,
        status: "taken",
      }, token);
      captureEvent("medicine_dose_marked", {
        status: "taken",
        medicine_id: row.medicineId,
      });
      await refreshSelectedMedicines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark dose");
    } finally {
      setMarkingDoseId(null);
    }
  };

  if (initializing) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PageLoader
            title="Loading medications..."
            subtitle="We're loading schedules, reminders, and family medicine data."
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
            <h1 className="db-greeting">Good afternoon, {user?.name ?? "Test User"}! 👋</h1>
            <p className="db-subtitle">Here&apos;s your health overview for today.</p>
          </div>
          <div className="db-top-actions">
            <div className="db-pill db-topbar-date" style={{ cursor: "default" }}>
              <CalendarBlank size={15} weight="bold" />
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <StreakPill streak={streak} />
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
              <FancySelect
                value={selectedPersonId}
                options={selectedPersonOptions}
                onChange={setSelectedPersonId}
                tone="green"
                compact
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--he-ink-3)", fontSize: 12.5, fontWeight: 700 }}>
              <Info size={15} weight="bold" />
              Child can manage reminders for parents from here.
            </div>
          </div>

          <div className="med-stat-grid">
            <StatCard icon={<Pill size={23} weight="bold" color="var(--he-green-deep)" />} value={`${activeCount}`} label="Active Medicines" detail={hasMedicines ? `All medicines for ${displayName(selectedPerson)} are tracked.` : "No medicines added yet"} tone="green" />
            <StatCard icon={<Bell size={23} weight="fill" color="var(--he-orange-deep)" />} value={`${dueSoon}`} label="Due Soon" detail={hasMedicines ? "Based on today's schedule" : "Add a schedule to see reminders"} tone="orange" />
            <StatCard icon={<CheckCircle size={23} weight="bold" color="var(--he-blue-deep)" />} value={adherence === null ? "--" : `${adherence}%`} label="Adherence" detail={completedDoses.length ? "From marked doses today" : "Starts after first marked dose"} tone="blue" />
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

            {error && (
              <div style={{ marginBottom: 12, border: "1px solid #FFD2D2", background: "#FFF5F5", color: "var(--he-coral-deep)", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, fontWeight: 800 }}>
                {error}
              </div>
            )}

            {loadingMedicines ? (
              <div className="med-empty-state">
                <div style={{ width: 72, height: 72, borderRadius: 24, background: "var(--he-blue-bg)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
                  <Pill size={34} weight="bold" color="var(--he-blue-deep)" />
                </div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.4px" }}>Loading medicines...</h3>
              </div>
            ) : !hasMedicines ? (
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
            ) : scheduleRows.length === 0 ? (
              <div className="med-empty-state">
                <div style={{ width: 72, height: 72, borderRadius: 24, background: "var(--he-green-bg)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
                  <CalendarBlank size={34} weight="bold" color="var(--he-green-deep)" />
                </div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.4px" }}>No doses scheduled today</h3>
                <p style={{ margin: "8px auto 0", maxWidth: 500, fontSize: 14, lineHeight: 1.65, color: "var(--he-ink-2)", fontWeight: 500 }}>
                  Medicines are saved for {displayName(selectedPerson)}, but none are due on today&apos;s schedule.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {scheduleRows.map((row) => {
                  const colors = toneColors(row.tone);
                  return (
                    <div key={row.id} className="med-dose-row">
                      <div style={{ width: 64, height: 56, borderRadius: 13, background: colors.bg, color: colors.text, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, lineHeight: 1.2, textAlign: "center", flex: "none" }}>
                        {row.timeLabel.replace(" ", "\n")}
                      </div>
                      <div style={{ width: 48, height: 48, borderRadius: 13, background: colors.bg, display: "grid", placeItems: "center", flex: "none" }}>
                        <Pill size={23} weight="bold" color={colors.text} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, color: "var(--he-ink-1)", fontSize: 15.5, fontWeight: 800 }}>{row.name}</p>
                        <p style={{ margin: "4px 0 0", color: "var(--he-ink-2)", fontSize: 12.5, fontWeight: 600 }}>
                          {row.timing ? `${row.dose} • ${row.timing}` : row.dose}
                        </p>
                      </div>
                      <span style={{ background: colors.bg, color: colors.text, borderRadius: 99, padding: "7px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{row.status}</span>
                      {row.canMarkTaken ? (
                        <button
                          onClick={() => markTaken(row)}
                          disabled={markingDoseId === row.id}
                          style={{ border: "none", borderRadius: 999, padding: "8px 12px", background: "var(--he-green-bg)", color: "var(--he-green-deep)", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: markingDoseId === row.id ? "wait" : "pointer", whiteSpace: "nowrap" }}
                        >
                          {markingDoseId === row.id ? "Saving..." : "Mark taken"}
                        </button>
                      ) : row.actionStatus === "upcoming" ? (
                        <span style={{ color: "var(--he-ink-3)", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
                          Not due yet
                        </span>
                      ) : null}
                      <CaretRight size={18} weight="bold" color="var(--he-ink-3)" />
                    </div>
                  );
                })}
              </div>
            )}

            {hasMedicines && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--he-hairline)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--he-ink-1)" }}>All medicines</h3>
                  <span style={{ color: "var(--he-ink-3)", fontSize: 12, fontWeight: 800 }}>{activeMedicines.length} active</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {activeMedicines.map((medicine) => {
                    const nextTimes = medicine.schedules.map((schedule) => formatTimeLabel(schedule.time_of_day)).join(", ");
                    return (
                      <div
                        key={medicine.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          border: "1.5px solid var(--he-card-border)",
                          borderRadius: 14,
                          padding: "11px 12px",
                          background: "#fff",
                        }}
                      >
                        <div style={{ width: 42, height: 42, borderRadius: 13, background: "var(--he-coral-bg)", display: "grid", placeItems: "center", flex: "none" }}>
                          <Pill size={20} weight="bold" color="var(--he-coral)" />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "var(--he-ink-1)" }}>
                            {medicine.name}{medicine.strength ? ` ${medicine.strength}` : ""}
                          </p>
                          <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 700, color: "var(--he-ink-3)" }}>
                            {medicine.dose} • {nextTimes || "No reminder time"}
                            {medicine.end_date ? ` • until ${medicine.end_date}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => openEdit(medicine)}
                          style={{ border: "1.5px solid var(--he-blue-bg-2)", borderRadius: 11, background: "var(--he-blue-bg)", color: "var(--he-blue-deep)", height: 36, padding: "0 11px", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 900, cursor: "pointer" }}
                        >
                          <PencilSimple size={14} weight="bold" /> Edit
                        </button>
                        <button
                          onClick={() => archiveMedicine(medicine)}
                          disabled={deletingMedicineId === medicine.id}
                          style={{ border: "1.5px solid #FFD7D7", borderRadius: 11, background: "#fff", color: "var(--he-coral-deep)", height: 36, padding: "0 11px", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 900, cursor: deletingMedicineId === medicine.id ? "wait" : "pointer", opacity: deletingMedicineId === medicine.id ? .65 : 1 }}
                        >
                          <Trash size={14} weight="bold" /> {deletingMedicineId === medicine.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </section>
      </div>

      {showAddDrawer && (
        <AddMedicineDrawer
          people={people}
          initialPersonId={selectedPersonId}
          initialForm={editingMedicine && selectedPerson ? formFromMedicine(editingMedicine, selectedPerson.id) : undefined}
          mode={editingMedicine ? "edit" : "add"}
          saving={savingMedicine}
          onClose={() => {
            setShowAddDrawer(false);
            setEditingMedicine(null);
          }}
          onSave={saveMedicine}
        />
      )}
    </div>
  );
}
