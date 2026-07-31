"use client";

import { Fragment, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  CalendarBlank,
  CaretDown,
  CheckCircle,
  PencilSimple,
  Pill,
  Plus,
  Trash,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import {
  createMedicine,
  deleteMedicine,
  getFamilyMembers,
  getMedicines,
  getTodayMedicineDoses,
  markMedicineDose,
  updateMedicine,
  type FamilyMember,
  type Medicine,
  type TodayDose,
  type User,
} from "@/lib/api";
import PageLoader from "../components/PageLoader";
import { captureEvent, identifyUser } from "@/lib/analytics";

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
  ownerLabel: string;
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

type OwnedMedicine = Medicine & {
  ownerLabel: string;
  ownerPersonId: string;
  rowKey: string;
};

type OwnedTodayDose = TodayDose & {
  ownerLabel: string;
  ownerPersonId: string;
  rowKey: string;
};

const todayISO = () => new Date().toLocaleDateString("en-CA");

const isFutureDose = (dose: TodayDose, nowMs: number) => {
  const scheduledMs = new Date(dose.scheduled_for).getTime();
  return Number.isFinite(scheduledMs) && scheduledMs > nowMs;
};

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

const DAY_PARTS: DayPart[] = ["Morning", "Afternoon", "Evening", "Night"];

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

function isDateInMedicineRange(dateKey: string, medicine: Medicine) {
  if (medicine.start_date && dateKey < medicine.start_date) return false;
  if (medicine.end_date && dateKey > medicine.end_date) return false;
  return true;
}

const QUARTER_HOUR_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return {
    value,
    label: formatTimeLabel(value).toUpperCase(),
  };
});

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

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--he-ink-2)", marginBottom: 7 }}>
      {children}
      {required && <span style={{ color: "var(--he-coral-deep)", marginLeft: 3 }}>*</span>}
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

  useEffect(() => {
    document.body.classList.add("mobile-sheet-open");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("mobile-sheet-open");
      document.body.style.overflow = previousOverflow;
    };
  }, []);
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

  const toggleDayPartReminder = (dayPart: DayPart) => {
    setForm((current) => {
      const hasTime = current.times.some((schedule) => schedule.dayPart === dayPart);
      return {
        ...current,
        dayPart,
        times: hasTime
          ? current.times.filter((schedule) => schedule.dayPart !== dayPart)
          : [...current.times, { dayPart, time: DEFAULT_TIMES_BY_DAY_PART[dayPart] }],
      };
    });
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
    .sort((a, b) => DAY_PARTS.indexOf(a.schedule.dayPart) - DAY_PARTS.indexOf(b.schedule.dayPart));

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="med-drawer-layer" style={{ position: "fixed", inset: 0, zIndex: 400 }}>
      <button
        aria-label="Close add medicine"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: "none", background: "rgba(26, 20, 20, .24)", cursor: "pointer" }}
      />
      <button
        type="button"
        className="med-drawer-close"
        aria-label="Close"
        onClick={onClose}
      >
        <X size={16} weight="bold" />
      </button>
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
          <button className="modal-inline-close" onClick={onClose} aria-label="Close" style={{ border: "none", background: "#FAF9FA", width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <X size={17} weight="bold" color="var(--he-ink-2)" />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel required>Who is this medicine for?</FieldLabel>
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
              <FieldLabel required>Medicine name</FieldLabel>
              <TextField value={form.name} onChange={(value) => update("name", value)} placeholder="e.g. Metformin" error={submitted && Boolean(errors.name)} />
              <FieldError>{submitted && errors.name}</FieldError>
            </div>
            <div>
              <FieldLabel required>Dose</FieldLabel>
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
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel required>Reminder times</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
              {DAY_PARTS.map((option) => {
                const hasReminder = form.times.some((schedule) => schedule.dayPart === option);
                return (
                  <button
                    key={option}
                    onClick={() => toggleDayPartReminder(option)}
                    aria-pressed={hasReminder}
                    style={{
                      height: 36,
                      border: `1.5px solid ${hasReminder ? "var(--he-green)" : "var(--he-card-border)"}`,
                      borderRadius: 11,
                      background: hasReminder ? "var(--he-green-bg)" : "#fff",
                      color: hasReminder ? "var(--he-green-deep)" : "var(--he-ink-2)",
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
                  style={{ display: "flex", alignItems: "center", gap: 9, border: "1.5px solid #CFEFDC", borderRadius: 12, background: "var(--he-green-bg)", padding: "8px 9px" }}
                >
                  <span style={{ minWidth: 76, color: "var(--he-green-deep)", fontSize: 12, fontWeight: 800 }}>{schedule.dayPart}</span>
                  <select
                    value={schedule.time}
                    onChange={(e) => {
                      const next = [...form.times];
                      next[index] = { ...schedule, time: e.target.value };
                      update("times", next);
                    }}
                    style={{ height: 34, border: "1px solid #CFEFDC", borderRadius: 10, background: "#fff", padding: "0 10px", color: "var(--he-green-deep)", fontWeight: 800, fontFamily: "inherit", flex: 1, cursor: "pointer" }}
                  >
                    {QUARTER_HOUR_TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeScheduleTime(index)}
                    aria-label={`Remove time ${index + 1}`}
                    style={{ width: 34, height: 34, border: "1px solid #FFD7D7", borderRadius: 10, background: "#fff", color: "var(--he-coral-deep)", display: "grid", placeItems: "center", cursor: "pointer" }}
                  >
                    <Trash size={15} weight="bold" />
                  </button>
                </div>
              ))}
              {selectedTimes.length === 0 && (
                <div style={{ border: "1.5px dashed var(--he-card-border)", borderRadius: 12, background: "#fff", color: "var(--he-ink-3)", padding: "11px 12px", fontSize: 12.5, fontWeight: 800 }}>
                  Select at least one reminder time.
                </div>
              )}
              <FieldError>{submitted && errors.times}</FieldError>
            </div>
          </div>

          <div>
            <FieldLabel required>Repeat on</FieldLabel>
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
              <FieldLabel required>Start date</FieldLabel>
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
    </div>,
    document.body
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
  return (
    <article className={`med-stat-card ${tone}`}>
      <div className="med-stat-top">
        <span className="med-stat-icon">{icon}</span>
        <div>
          <p>{label}</p>
          <strong>{value}</strong>
        </div>
      </div>
      <p className="med-stat-detail">{detail}</p>
    </article>
  );
}

export default function MedicationsPage() {
  return (
    <Suspense fallback={
      <div className="db-page">
        <Sidebar />
        <div className="db-main">
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
  const [selectedPersonId, setSelectedPersonId] = useState("all");
  const [medicines, setMedicines] = useState<OwnedMedicine[]>([]);
  const [todayDoses, setTodayDoses] = useState<OwnedTodayDose[]>([]);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loadingMedicines, setLoadingMedicines] = useState(false);
  const [savingMedicine, setSavingMedicine] = useState(false);
  const [deletingMedicineId, setDeletingMedicineId] = useState<number | null>(null);
  const [pendingDeleteMedicine, setPendingDeleteMedicine] = useState<Medicine | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [markingDoseId, setMarkingDoseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("auth_user");
        const authUser: User | null = stored ? JSON.parse(stored) : null;
        if (!authUser) { window.location.href = "/login"; return; }
        setUser(authUser);

        const token = localStorage.getItem("auth_token") ?? "";
        const members = await getFamilyMembers(token).catch(() => [] as FamilyMember[]);
        const activeMembers = members.filter((member) => member.status === "active");
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
        setSelectedPersonId(options.some((option) => option.id === requestedPersonId) ? requestedPersonId! : "all");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load medications");
      } finally {
        setInitializing(false);
      }
    })();
  }, [requestedPersonId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const selectedPeople = selectedPersonId === "all"
        ? people
        : people.filter((person) => person.id === selectedPersonId);
      if (selectedPeople.length === 0) return;
      const token = localStorage.getItem("auth_token") ?? "";
      setLoadingMedicines(true);
      setError(null);
      try {
        const results = await Promise.all(selectedPeople.map(async (person) => {
          const [personMedicines, personDoses] = await Promise.all([
            getMedicines(person.userId, token),
            getTodayMedicineDoses(person.userId, token),
          ]);
          const ownerLabel = person.label === "You"
            ? "You"
            : person.label?.trim() || person.name || "Family";
          return {
            personMedicines: personMedicines.map((medicine) => ({
              ...medicine,
              ownerLabel,
              ownerPersonId: person.id,
              rowKey: `${person.id}-medicine-${medicine.id}`,
            })),
            personDoses: personDoses.map((dose) => ({
              ...dose,
              ownerLabel,
              ownerPersonId: person.id,
              rowKey: `${person.id}-dose-${dose.id}`,
            })),
          };
        }));
        if (cancelled) return;
        setMedicines(results.flatMap((result) => result.personMedicines));
        setTodayDoses(results.flatMap((result) => result.personDoses));
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
  const upcomingDoses = useMemo(
    () => todayDoses
      .filter((dose) => dose.status === "upcoming" && isFutureDose(dose, nowMs))
      .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()),
    [todayDoses, nowMs],
  );
  const earlierDoses = useMemo(
    () => todayDoses
      .filter((dose) => !(dose.status === "upcoming" && isFutureDose(dose, nowMs)))
      .sort((a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()),
    [todayDoses, nowMs],
  );
  const hasMedicines = activeMedicines.length > 0;
  const activeCount = activeMedicines.length;
  const dosesToday = todayDoses.length;
  const takenDoses = todayDoses.filter((dose) => dose.status === "taken");
  const memberFilters = [
    { id: "all", label: "All" },
    ...people.map((person) => ({
      id: person.id,
      label: person.label === "You"
        ? "You"
        : person.label?.trim() || person.name,
    })),
  ];
  const activeMemberFilterIndex = Math.max(
    0,
    memberFilters.findIndex((filter) => filter.id === selectedPersonId),
  );
  const calendarDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const dateKey = date.toLocaleDateString("en-CA");
      const weekDay = date.getDay();
      const items = activeMedicines
        .flatMap((medicine) =>
          medicine.schedules
            .filter((schedule) => {
              const days = schedule.days_of_week ?? [0, 1, 2, 3, 4, 5, 6];
              return days.includes(weekDay) && isDateInMedicineRange(dateKey, medicine);
            })
            .map((schedule) => ({
              id: `${medicine.rowKey}-${schedule.id}-${dateKey}`,
              name: medicine.name,
              dose: medicine.dose,
              time: formatTimeLabel(schedule.time_of_day),
            }))
        )
        .sort((a, b) => a.time.localeCompare(b.time));

      return {
        key: dateKey,
        label: index === 0 ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" }),
        date: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        items,
      };
    });
  }, [activeMedicines]);

  const scheduleRows: ScheduleRow[] = [...upcomingDoses, ...earlierDoses].map((dose, index) => {
    const actionStatus: TodayDose["status"] =
      dose.status === "upcoming" && !isFutureDose(dose, nowMs) ? "due" : dose.status;
    const tone = actionStatus === "taken"
      ? "green"
      : actionStatus === "due" || actionStatus === "missed"
        ? "orange"
        : actionStatus === "skipped"
          ? "violet"
          : index % 2 === 0 ? "blue" : "green";
    return {
      id: dose.rowKey,
      medicineId: dose.medicine.id,
      scheduleId: dose.schedule.id,
      ownerLabel: dose.ownerLabel,
      scheduledFor: dose.scheduled_for,
      timeLabel: formatTimeLabel(dose.schedule.time_of_day),
      name: `${dose.medicine.name}${dose.medicine.strength ? ` ${dose.medicine.strength}` : ""}`,
      dose: dose.medicine.dose,
      timing: dose.medicine.timing === "anytime" ? "" : formatTiming(dose.medicine.timing),
      tone,
      status: statusLabel(actionStatus),
      actionStatus,
      canMarkTaken: actionStatus === "due" || actionStatus === "missed",
    };
  });

  const openAdd = () => {
    setEditingMedicine(null);
    captureEvent("medicine_add_opened", {
      patient_type: selectedPersonId === "self" ? "self" : selectedPersonId === "all" ? "all" : "family",
    });
    setShowAddDrawer(true);
  };

  const openEdit = (medicine: OwnedMedicine) => {
    setSelectedPersonId(medicine.ownerPersonId);
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
    const person = people.find((item) => item.userId === patientUserId);
    const ownerLabel = person?.label === "You"
      ? "You"
      : person?.label?.trim() || person?.name || "Family";
    const ownerPersonId = person?.id ?? `user-${patientUserId}`;
    setMedicines(nextMedicines.map((medicine) => ({
      ...medicine,
      ownerLabel,
      ownerPersonId,
      rowKey: `${ownerPersonId}-medicine-${medicine.id}`,
    })));
    setTodayDoses(nextDoses.map((dose) => ({
      ...dose,
      ownerLabel,
      ownerPersonId,
      rowKey: `${ownerPersonId}-dose-${dose.id}`,
    })));
  };
  const refreshSelectedMedicines = async () => {
    if (selectedPersonId === "all") {
      const token = localStorage.getItem("auth_token") ?? "";
      const results = await Promise.all(people.map(async (person) => {
        const [personMedicines, personDoses] = await Promise.all([
          getMedicines(person.userId, token),
          getTodayMedicineDoses(person.userId, token),
        ]);
        const ownerLabel = person.label === "You"
          ? "You"
          : person.label?.trim() || person.name || "Family";
        return {
          personMedicines: personMedicines.map((medicine) => ({
            ...medicine,
            ownerLabel,
            ownerPersonId: person.id,
            rowKey: `${person.id}-medicine-${medicine.id}`,
          })),
          personDoses: personDoses.map((dose) => ({
            ...dose,
            ownerLabel,
            ownerPersonId: person.id,
            rowKey: `${person.id}-dose-${dose.id}`,
          })),
        };
      }));
      setMedicines(results.flatMap((result) => result.personMedicines));
      setTodayDoses(results.flatMap((result) => result.personDoses));
      return;
    }
    if (selectedPerson) await refreshMedicinesFor(selectedPerson.userId);
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
    const token = localStorage.getItem("auth_token") ?? "";
    setDeletingMedicineId(medicine.id);
    setError(null);
    try {
      await deleteMedicine(medicine.id, token);
      captureEvent("medicine_deleted", { medicine_id: medicine.id });
      await refreshSelectedMedicines();
      setPendingDeleteMedicine(null);
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
        <div className="db-main">
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
      <main className="db-main med-main">
        <header className="med-header">
          <div>
            <h1>Medications</h1>
            <p>Manage medicines, dose times, and reminders for your family.</p>
          </div>
          <div className="med-header-actions">
            <button onClick={openAdd} className="db-pill cta med-add-main">
              <Plus size={15} weight="bold" />
              Add medicine
            </button>
          </div>
        </header>

        <section className="med-member-filters" aria-label="Filter medications by family member">
          <span className="med-member-filter-label">View schedule</span>
          <div className="med-member-filter-scroll">
            <div
              className="med-member-filter-list"
              style={{
                "--med-member-count": memberFilters.length,
                "--med-member-index": activeMemberFilterIndex,
              } as CSSProperties}
            >
              <span className="med-member-filter-slider" aria-hidden="true" />
              {memberFilters.map((filter) => (
                <button
                  type="button"
                  className={`med-member-filter${selectedPersonId === filter.id ? " active" : ""}`}
                  key={filter.id}
                  onClick={() => setSelectedPersonId(filter.id)}
                  aria-pressed={selectedPersonId === filter.id}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="med-stat-grid" aria-label="Medication overview">
            <StatCard icon={<Pill size={20} weight="bold" color="var(--he-green-deep)" />} value={`${activeCount}`} label="Active medicines" detail={hasMedicines ? selectedPersonId === "all" ? "Medicines across your family are tracked." : `All medicines for ${displayName(selectedPerson)} are tracked.` : "No medicines added yet"} tone="green" />
            <StatCard icon={<CheckCircle size={20} weight="bold" color="var(--he-blue-deep)" />} value={`${takenDoses.length}/${dosesToday}`} label="Taken today" detail={dosesToday ? `${takenDoses.length} of ${dosesToday} scheduled doses taken` : "Nothing scheduled today"} tone="blue" />
        </section>

        <section className="med-schedule-card">
            <div className="med-schedule-head">
              <div>
                <span className="med-section-eyebrow">Today</span>
                <h2>Medicine schedule</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendar((current) => !current)}
                className={`med-calendar-trigger${showCalendar ? " active" : ""}`}
                aria-expanded={showCalendar}
              >
                <CalendarBlank size={15} weight="bold" />
                {showCalendar ? "Hide week" : "View week"}
              </button>
            </div>

            {showCalendar && (
              <div style={{
                marginBottom: 16,
                border: "1.5px solid var(--he-green-bg-2)",
                borderRadius: 18,
                background: "linear-gradient(135deg, #F7FFFA, #FFFFFF)",
                padding: 14,
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 9 }}>
                  {calendarDays.map((day) => (
                    <div key={day.key} style={{
                      minWidth: 0,
                      border: "1px solid var(--he-card-border)",
                      borderRadius: 14,
                      background: day.label === "Today" ? "var(--he-green-bg)" : "#fff",
                      padding: 10,
                      minHeight: 124,
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
                        <span style={{ color: "var(--he-ink-1)", fontSize: 12.5, fontWeight: 950 }}>{day.label}</span>
                        <span style={{ color: "var(--he-ink-3)", fontSize: 10.5, fontWeight: 800 }}>{day.date}</span>
                      </div>
                      {day.items.length === 0 ? (
                        <p style={{ margin: "18px 0 0", color: "var(--he-ink-3)", fontSize: 11.5, fontWeight: 750 }}>No dose</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {day.items.slice(0, 3).map((item) => (
                            <div key={item.id} style={{ borderRadius: 10, background: "#fff", border: "1px solid #E8F4ED", padding: "7px 8px" }}>
                              <div style={{ color: "var(--he-green-deep)", fontSize: 11.5, fontWeight: 950 }}>{item.time}</div>
                              <div style={{ color: "var(--he-ink-1)", fontSize: 11.5, fontWeight: 850, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                            </div>
                          ))}
                          {day.items.length > 3 && (
                            <span style={{ color: "var(--he-ink-3)", fontSize: 10.5, fontWeight: 850 }}>+{day.items.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ marginBottom: 12, border: "1px solid #FFD2D2", background: "#FFF5F5", color: "var(--he-coral-deep)", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, fontWeight: 800 }}>
                {error}
              </div>
            )}

            {loadingMedicines ? (
              <div className="med-empty-state">
                <div style={{ width: 52, height: 52, borderRadius: 17, background: "var(--he-blue-bg)", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
                  <Pill size={25} weight="bold" color="var(--he-blue-deep)" />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.25px" }}>Loading medicines...</h3>
              </div>
            ) : !hasMedicines ? (
              <div className="med-empty-state">
                <div style={{ width: 52, height: 52, borderRadius: 17, background: "linear-gradient(150deg, var(--he-coral-bg), var(--he-green-bg))", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
                  <Pill size={25} weight="bold" color="var(--he-coral)" />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.25px" }}>No medicines added yet</h3>
                <p style={{ margin: "6px auto 0", maxWidth: 460, fontSize: 11.5, lineHeight: 1.55, color: "var(--he-ink-2)", fontWeight: 520 }}>
                  Add your first medicine to track doses, reminders, and family adherence in one place.
                </p>
                <div className="med-empty-actions">
                  <button onClick={openAdd} className="db-pill cta" style={{ height: 38, fontSize: 11 }}>
                    <Plus size={15} weight="bold" />
                    Add first medicine
                  </button>
                  <button style={{ border: "none", background: "transparent", color: "var(--he-ink-2)", fontSize: 10.5, fontWeight: 780, fontFamily: "inherit", cursor: "pointer" }}>
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
                <div style={{ width: 52, height: 52, borderRadius: 17, background: "var(--he-green-bg)", display: "grid", placeItems: "center", margin: "0 auto 13px" }}>
                  <CalendarBlank size={25} weight="bold" color="var(--he-green-deep)" />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--he-ink-1)", letterSpacing: "-.25px" }}>No doses today</h3>
                <p style={{ margin: "6px auto 0", maxWidth: 460, fontSize: 11.5, lineHeight: 1.55, color: "var(--he-ink-2)", fontWeight: 520 }}>
                  {selectedPersonId === "all"
                    ? "Your family has medicines saved, but nothing is scheduled for today."
                    : `Medicines are saved for ${displayName(selectedPerson)}, but nothing is scheduled for today.`}
                </p>
              </div>
            ) : (
              <div className="med-dose-list">
                {scheduleRows.map((row, index) => {
                  const colors = toneColors(row.tone);
                  const startsEarlierGroup = index === upcomingDoses.length && earlierDoses.length > 0;
                  const [time, period] = row.timeLabel.split(" ");
                  return (
                    <Fragment key={row.id}>
                      {(index === 0 || startsEarlierGroup) && (
                        <div
                          className="med-dose-group-label"
                          style={{ marginTop: startsEarlierGroup && upcomingDoses.length > 0 ? 8 : 0 }}
                        >
                          {startsEarlierGroup || upcomingDoses.length === 0 ? "Earlier today" : "Upcoming"}
                        </div>
                      )}
                      <div className="med-dose-row">
                      <div className="med-dose-time" style={{ background: colors.bg, color: colors.text }}>
                        <span>{time}</span>
                        <span>{period}</span>
                      </div>
                      <div className="med-dose-icon" style={{ background: colors.bg }}>
                        <Pill size={19} weight="bold" color={colors.text} />
                      </div>
                      <div className="med-dose-copy">
                        <div className="med-row-title">
                          <p>{row.name}</p>
                          <span className="med-person-chip">For {row.ownerLabel}</span>
                        </div>
                        <span className="med-row-detail">
                          {row.timing ? `${row.dose} • ${row.timing}` : row.dose}
                        </span>
                      </div>
                      {row.canMarkTaken ? (
                        <button
                          className="med-dose-mark"
                          onClick={(event) => {
                            event.stopPropagation();
                            markTaken(row);
                          }}
                          disabled={markingDoseId === row.id}
                        >
                          {markingDoseId === row.id ? "Saving..." : "Mark taken"}
                        </button>
                      ) : (
                        <span className="med-dose-status" style={{ background: colors.bg, color: colors.text }}>{row.status}</span>
                      )}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}

            {hasMedicines && (
              <div className="med-all-medicines">
                <div className="med-all-head">
                  <h3>All medicines</h3>
                  <span>{activeMedicines.length} active</span>
                </div>
                <div className="med-all-list">
                  {activeMedicines.map((medicine) => {
                    const nextTimes = medicine.schedules.map((schedule) => formatTimeLabel(schedule.time_of_day)).join(", ");
                    return (
                      <article className="med-medicine-row" key={medicine.rowKey}>
                        <span className="med-medicine-icon">
                          <Pill size={18} weight="bold" color="var(--he-coral)" />
                        </span>
                        <div className="med-medicine-copy">
                          <div className="med-row-title">
                            <p>
                              {medicine.name}{medicine.strength ? ` ${medicine.strength}` : ""}
                            </p>
                            <span className="med-person-chip">For {medicine.ownerLabel}</span>
                          </div>
                          <span className="med-row-detail">
                            {medicine.dose} • {nextTimes || "No reminder time"}
                            {medicine.end_date ? ` • until ${medicine.end_date}` : ""}
                          </span>
                        </div>
                        <button
                          className="med-row-action edit"
                          onClick={() => openEdit(medicine)}
                        >
                          <PencilSimple size={14} weight="bold" /> Edit
                        </button>
                        <button
                          className="med-row-action delete"
                          onClick={() => setPendingDeleteMedicine(medicine)}
                          disabled={deletingMedicineId === medicine.id}
                        >
                          <Trash size={14} weight="bold" /> {deletingMedicineId === medicine.id ? "Deleting" : "Delete"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
        </section>
      </main>

      {showAddDrawer && (
        <AddMedicineDrawer
          people={people}
          initialPersonId={selectedPersonId === "all" ? people[0]?.id ?? "self" : selectedPersonId}
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

      {pendingDeleteMedicine && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-medicine-title"
          onClick={() => {
            if (deletingMedicineId == null) setPendingDeleteMedicine(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(18, 22, 28, .42)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(460px, 100%)",
              borderRadius: 24,
              border: "1px solid rgba(255, 107, 107, .22)",
              background: "#fff",
              boxShadow: "0 24px 70px rgba(31, 28, 35, .24)",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 16, background: "var(--he-coral-bg)", color: "var(--he-coral-deep)", display: "grid", placeItems: "center", flex: "none" }}>
                <Trash size={22} weight="bold" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 id="delete-medicine-title" style={{ margin: 0, color: "var(--he-ink-1)", fontSize: 22, fontWeight: 950, letterSpacing: "-.4px" }}>
                  Delete {pendingDeleteMedicine.name}?
                </h3>
                <p style={{ margin: "8px 0 0", color: "var(--he-ink-3)", fontSize: 14, fontWeight: 700, lineHeight: 1.6 }}>
                  Reminders for this medicine will stop. You can add it again later if needed.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setPendingDeleteMedicine(null)}
                disabled={deletingMedicineId != null}
                style={{
                  height: 44,
                  padding: "0 18px",
                  borderRadius: 14,
                  border: "1.5px solid var(--he-card-border)",
                  background: "#fff",
                  color: "var(--he-ink-2)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: deletingMedicineId == null ? "pointer" : "not-allowed",
                  opacity: deletingMedicineId == null ? 1 : .65,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => archiveMedicine(pendingDeleteMedicine)}
                disabled={deletingMedicineId != null}
                style={{
                  height: 44,
                  padding: "0 18px",
                  borderRadius: 14,
                  border: "none",
                  background: "var(--he-coral)",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 950,
                  cursor: deletingMedicineId == null ? "pointer" : "wait",
                  boxShadow: "0 10px 24px rgba(255, 107, 107, .24)",
                }}
              >
                {deletingMedicineId === pendingDeleteMedicine.id ? "Deleting..." : "Delete medicine"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
