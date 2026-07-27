"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, Clock, Plus, Trash, X } from "@phosphor-icons/react";
import {
  getFoodReminderPreference,
  updateFoodReminderPreference,
  type FamilyMember,
  type FoodReminderMeal,
} from "@/lib/api";
import { captureEvent } from "@/lib/analytics";

const DEFAULT_MEALS: FoodReminderMeal[] = [
  { slot: "breakfast", label: "breakfast", time: "11:00", enabled: true },
  { slot: "lunch", label: "lunch", time: "15:00", enabled: false },
  { slot: "dinner", label: "dinner", time: "22:00", enabled: false },
  { slot: "snack", label: "snack", time: "18:00", enabled: false },
  { slot: "extra", label: "snack", time: "20:00", enabled: false },
];

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return {
    value,
    label: `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`,
  };
});

function memberDisplayName(member: FamilyMember) {
  return member.label || member.name || member.phone;
}

function normalizeMeals(incoming: FoodReminderMeal[] | undefined) {
  return DEFAULT_MEALS.map((fallback) => {
    const meal = incoming?.find((candidate) => candidate.slot === fallback.slot) ?? fallback;
    const time = TIME_OPTIONS.some((option) => option.value === meal.time.slice(0, 5))
      ? meal.time.slice(0, 5)
      : fallback.time;
    return { ...meal, time };
  });
}

export default function FamilyFoodReminderDrawer({
  members,
  initialMemberId,
  onClose,
}: {
  members: FamilyMember[];
  initialMemberId?: number;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(
    members.some((member) => member.id === initialMemberId) ? initialMemberId! : members[0]?.id ?? 0
  );
  const [enabled, setEnabled] = useState(true);
  const [meals, setMeals] = useState<FoodReminderMeal[]>(DEFAULT_MEALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedMember = members.find((member) => member.id === selectedId) ?? members[0];
  const activeMeals = useMemo(() => meals.filter((meal) => meal.enabled), [meals]);

  useEffect(() => {
    document.body.classList.add("mobile-sheet-open");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("mobile-sheet-open");
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (!selectedMember) return;
    const token = localStorage.getItem("auth_token") ?? "";
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFoodReminderPreference(token, selectedMember.id)
      .then((preference) => {
        if (cancelled) return;
        setEnabled(preference.enabled);
        setMeals(normalizeMeals(preference.meals));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load reminders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMember]);

  const updateMeal = useCallback((slot: string, patch: Partial<FoodReminderMeal>) => {
    setError(null);
    setMeals((current) => current.map((meal) => meal.slot === slot ? { ...meal, ...patch } : meal));
  }, []);

  const removeMeal = useCallback((slot: string) => {
    setMeals((current) => {
      if (enabled && current.filter((meal) => meal.enabled).length <= 1) {
        setError("Keep at least one reminder while reminders are on.");
        return current;
      }
      setError(null);
      return current.map((meal) => meal.slot === slot ? { ...meal, enabled: false } : meal);
    });
  }, [enabled]);

  const addMeal = useCallback(() => {
    setError(null);
    setMeals((current) => {
      const next = current.find((meal) => !meal.enabled);
      if (!next) return current;
      return current.map((meal) => meal.slot === next.slot ? { ...meal, enabled: true } : meal);
    });
  }, []);

  const toggleEnabled = useCallback(() => {
    setError(null);
    setEnabled((current) => {
      const next = !current;
      if (next && meals.every((meal) => !meal.enabled)) {
        setMeals((currentMeals) => currentMeals.map((meal, index) => (
          index === 0 ? { ...meal, enabled: true } : meal
        )));
      }
      return next;
    });
  }, [meals]);

  const save = useCallback(async () => {
    if (!selectedMember || saving) return;
    if (enabled && activeMeals.length === 0) {
      setError("Add at least one reminder before saving.");
      return;
    }
    const token = localStorage.getItem("auth_token") ?? "";
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateFoodReminderPreference(enabled, token, meals, selectedMember.id);
      captureEvent("family_food_reminder_updated", {
        family_member_id: selectedMember.id,
        enabled,
        active_reminder_count: activeMeals.length,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save reminders.");
    } finally {
      setSaving(false);
    }
  }, [activeMeals.length, enabled, meals, onClose, saving, selectedMember]);

  if (!selectedMember) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="familyv2-drawer-layer">
      <button
        type="button"
        aria-label="Close reminder settings"
        className="familyv2-drawer-backdrop"
        onClick={onClose}
      />
      <button
        type="button"
        className="familyv2-drawer-mobile-close"
        aria-label="Close"
        onClick={onClose}
      >
        <X size={16} weight="bold" />
      </button>
      <aside className="familyv2-reminder-drawer" role="dialog" aria-modal="true" aria-labelledby="family-reminder-title">
        <header className="familyv2-drawer-head">
          <span className="familyv2-drawer-icon"><Bell size={20} weight="bold" /></span>
          <div>
            <h2 id="family-reminder-title">Manage food reminders</h2>
            <p>Choose who gets a WhatsApp reminder and when.</p>
          </div>
          <button type="button" className="familyv2-drawer-close modal-inline-close" onClick={onClose} aria-label="Close">
            <X size={17} weight="bold" />
          </button>
        </header>

        <div className="familyv2-drawer-body">
          <section>
            <span className="familyv2-field-label">Family member</span>
            <div className="familyv2-member-picker">
              {members.map((member) => {
                const active = member.id === selectedMember.id;
                const name = memberDisplayName(member);
                return (
                  <button
                    type="button"
                    key={member.id}
                    className={active ? "active" : ""}
                    onClick={() => setSelectedId(member.id)}
                    aria-pressed={active}
                  >
                    <span>{name.charAt(0).toUpperCase()}</span>
                    <b>{name}</b>
                    {active && <Check size={14} weight="bold" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="familyv2-power-row">
            <div>
              <b>Food reminders for {memberDisplayName(selectedMember)}</b>
              <span>Send a gentle prompt when it is time to log food.</span>
            </div>
            <button
              type="button"
              className={`familyv2-switch${enabled ? " on" : ""}`}
              onClick={toggleEnabled}
              aria-pressed={enabled}
              disabled={loading}
            >
              <i />
              <span>{enabled ? "On" : "Off"}</span>
            </button>
          </section>

          {loading ? (
            <div className="familyv2-reminder-loading">
              <span />
              <p>Loading reminder settings…</p>
            </div>
          ) : (
            <section className={`familyv2-reminder-editor${enabled ? "" : " disabled"}`}>
              <div className="familyv2-reminder-editor-title">
                <span className="familyv2-field-label">Reminder schedule</span>
                <small>Up to 5 reminders</small>
              </div>
              <div className="familyv2-reminder-rows">
                {activeMeals.map((meal) => (
                  <div className="familyv2-reminder-row" key={meal.slot}>
                    <span className="familyv2-row-clock"><Clock size={16} weight="bold" /></span>
                    <input
                      type="text"
                      value={meal.label}
                      maxLength={32}
                      aria-label="Reminder name"
                      disabled={!enabled}
                      onChange={(event) => updateMeal(meal.slot, { label: event.target.value })}
                    />
                    <select
                      value={meal.time}
                      aria-label={`${meal.label} reminder time`}
                      disabled={!enabled}
                      onChange={(event) => updateMeal(meal.slot, { time: event.target.value })}
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove ${meal.label} reminder`}
                      disabled={!enabled}
                      onClick={() => removeMeal(meal.slot)}
                    >
                      <Trash size={15} weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
              {activeMeals.length < 5 && (
                <button type="button" className="familyv2-add-reminder" onClick={addMeal} disabled={!enabled}>
                  <Plus size={15} weight="bold" />
                  Add reminder
                </button>
              )}
            </section>
          )}

          {error && <p className="familyv2-drawer-error" role="alert">{error}</p>}
        </div>

        <footer className="familyv2-drawer-foot">
          <span>{activeMeals.length} {activeMeals.length === 1 ? "reminder" : "reminders"} set</span>
          <div>
            <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="primary" onClick={save} disabled={loading || saving}>
              {saving ? "Saving…" : "Save reminders"}
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
