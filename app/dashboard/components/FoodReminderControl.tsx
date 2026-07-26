"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretDown, Plus, Trash } from "@phosphor-icons/react";
import { FEAlarm } from "./FluentEmoji";
import {
  getFoodReminderPreference,
  updateFoodReminderPreference,
  type FoodReminderMeal,
  type FoodReminderPreference,
} from "@/lib/api";
import { captureEvent } from "@/lib/analytics";

const DEFAULT_FOOD_REMINDER_MEALS: FoodReminderMeal[] = [
  { slot: "breakfast", label: "breakfast", time: "11:00", enabled: true },
  { slot: "lunch", label: "lunch", time: "15:00", enabled: false },
  { slot: "dinner", label: "dinner", time: "22:00", enabled: false },
  { slot: "snack", label: "snack", time: "18:00", enabled: false },
  { slot: "extra", label: "snack", time: "20:00", enabled: false },
];

function formatFoodReminderTime(time: string) {
  const [hourPart = "0", minutePart = "0"] = time.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

const FOOD_REMINDER_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { value, label: formatFoodReminderTime(value) };
});

function quarterHourFoodReminderTime(time: string, fallback: string) {
  return FOOD_REMINDER_TIME_OPTIONS.some((option) => option.value === time.slice(0, 5))
    ? time.slice(0, 5)
    : fallback;
}

function foodReminderMealsFromPreference(preference: FoodReminderPreference | null): FoodReminderMeal[] {
  const incoming = preference?.meals ?? [];
  return DEFAULT_FOOD_REMINDER_MEALS.map((fallback) => {
    const meal = incoming.find((candidate) => candidate.slot === fallback.slot) ?? fallback;
    return { ...meal, time: quarterHourFoodReminderTime(meal.time, fallback.time) };
  });
}

export default function FoodReminderControl({ userId }: { userId: number }) {
  const [preference, setPreference] = useState<FoodReminderPreference | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftMeals, setDraftMeals] = useState<FoodReminderMeal[]>(DEFAULT_FOOD_REMINDER_MEALS);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") ?? "";
    if (!token) return;
    getFoodReminderPreference(token)
      .then(setPreference)
      .catch((err) => {
        console.warn("[FoodReminderControl] Failed to load preference", err);
      });
  }, []);

  useEffect(() => {
    setDraftEnabled(preference?.enabled ?? true);
    setDraftMeals(foodReminderMealsFromPreference(preference));
  }, [preference]);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const updateDraftMeal = useCallback((slot: FoodReminderMeal["slot"], patch: Partial<FoodReminderMeal>) => {
    setDraftError(null);
    setDraftMeals((current) => current.map((meal) => (meal.slot === slot ? { ...meal, ...patch } : meal)));
  }, []);

  const ensureOneDraftMeal = useCallback(() => {
    setDraftMeals((current) => {
      if (current.some((meal) => meal.enabled)) return current;
      const firstSlot = current[0]?.slot;
      if (!firstSlot) return current;
      return current.map((meal) => (meal.slot === firstSlot ? { ...meal, enabled: true } : meal));
    });
  }, []);

  const setDraftPower = useCallback((enabled: boolean) => {
    setDraftError(null);
    setDraftEnabled(enabled);
    if (enabled) ensureOneDraftMeal();
  }, [ensureOneDraftMeal]);

  const removeDraftMeal = useCallback((slot: FoodReminderMeal["slot"]) => {
    setDraftMeals((current) => {
      const activeCount = current.filter((meal) => meal.enabled).length;
      if (draftEnabled && activeCount <= 1) {
        setDraftError("At least one reminder is needed while food reminders are On. Turn Off reminders to remove all.");
        return current;
      }
      setDraftError(null);
      return current.map((meal) => (meal.slot === slot ? { ...meal, enabled: false } : meal));
    });
  }, [draftEnabled]);

  const setDraftMealEnabled = useCallback((slot: FoodReminderMeal["slot"], enabled: boolean) => {
    if (!enabled) {
      removeDraftMeal(slot);
      return;
    }
    updateDraftMeal(slot, { enabled: true });
  }, [removeDraftMeal, updateDraftMeal]);

  const addDraftMeal = useCallback(() => {
    setDraftError(null);
    setDraftMeals((current) => {
      const nextSlot = current.find((meal) => !meal.enabled)?.slot;
      if (!nextSlot) return current;
      return current.map((meal) => (meal.slot === nextSlot ? { ...meal, enabled: true } : meal));
    });
  }, []);

  const saveSetup = useCallback(async () => {
    const token = localStorage.getItem("auth_token") ?? "";
    if (!token || saving) return;
    const safeMeals = draftEnabled && draftMeals.every((meal) => !meal.enabled)
      ? draftMeals.map((meal, index) => (index === 0 ? { ...meal, enabled: true } : meal))
      : draftMeals;
    if (safeMeals !== draftMeals) setDraftMeals(safeMeals);
    setSaving(true);
    const previous = preference;
    const optimisticMeals = safeMeals;
    setPreference((current): FoodReminderPreference => ({
      user_id: current?.user_id ?? userId,
      enabled: draftEnabled,
      activated: current?.activated || draftEnabled,
      breakfast_time: optimisticMeals.find((meal) => meal.slot === "breakfast")?.time ?? "11:00",
      lunch_time: optimisticMeals.find((meal) => meal.slot === "lunch")?.time ?? "15:00",
      dinner_time: optimisticMeals.find((meal) => meal.slot === "dinner")?.time ?? "22:00",
      meals: optimisticMeals,
    }));
    try {
      const updated = await updateFoodReminderPreference(draftEnabled, token, optimisticMeals);
      setPreference(updated);
      setShowMenu(false);
      captureEvent("food_reminder_preference_updated", {
        enabled: updated.enabled,
        active_meal_count: updated.meals.filter((meal) => meal.enabled).length,
      });
    } catch (err) {
      setPreference(previous);
      console.warn("[FoodReminderControl] Failed to update preference", err);
    } finally {
      setSaving(false);
    }
  }, [draftEnabled, draftMeals, preference, saving, userId]);

  const enabled = preference?.enabled ?? true;

  return (
    <div className="food-reminder-control" ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setShowMenu((current) => !current)}
        disabled={saving}
        aria-pressed={enabled}
        aria-expanded={showMenu}
        className={`db-pill food-reminder-trigger${enabled ? " enabled" : ""}`}
        title={enabled
          ? "Manage breakfast, lunch, dinner, and snack logging reminders"
          : "Turn on meal logging reminders"}
      >
        <FEAlarm size={15} />
        Food reminders
        <span className="food-reminder-status">{enabled ? "ON" : "OFF"}</span>
        <CaretDown size={14} weight="bold" />
      </button>
      {showMenu && (
        <div
          className="food-reminder-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            zIndex: 120,
            width: "min(438px, calc(100vw - 28px))",
            padding: 14,
            border: "1px solid #DDF4E7",
            borderRadius: 22,
            background: "radial-gradient(circle at top left, rgba(32,168,101,.12), transparent 36%), #fff",
            boxShadow: "0 22px 55px rgba(26, 38, 52, .16)",
            fontFamily: "inherit",
          }}
        >
          <div className="food-reminder-menu-head" style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <strong style={{ display: "block", color: "var(--he-ink-1)", fontSize: 14.5, fontWeight: 900 }}>Food reminders</strong>
              <span style={{ display: "block", marginTop: 3, color: "var(--he-ink-3)", fontSize: 11.5, fontWeight: 700, lineHeight: 1.35 }}>Choose what FamCare should remind you to log.</span>
            </div>
            <label
              className="food-reminder-switch"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 9px",
                borderRadius: 999,
                background: draftEnabled ? "#DDF7EA" : "#F1EEF2",
                border: `1px solid ${draftEnabled ? "#BDEFD3" : "#E3DEE5"}`,
                color: draftEnabled ? "var(--he-green-deep)" : "#8D92A1",
                fontSize: 11,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={draftEnabled}
                onChange={(event) => setDraftPower(event.target.checked)}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
              />
              <i
                aria-hidden="true"
                style={{
                  position: "relative",
                  width: 34,
                  height: 20,
                  borderRadius: 999,
                  background: draftEnabled ? "#33C879" : "#C8CDD4",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,.10)",
                }}
              >
                <b
                  style={{
                    position: "absolute",
                    top: 3,
                    left: draftEnabled ? 17 : 3,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 2px 5px rgba(16, 31, 23, .18)",
                  }}
                />
              </i>
              <span>{draftEnabled ? "ON" : "OFF"}</span>
            </label>
          </div>

          <div
            className={`food-reminder-rows${draftEnabled ? "" : " disabled"}`}
            style={{ display: "grid", gap: 8, opacity: draftEnabled ? 1 : 0.55 }}
          >
            {draftMeals.filter((meal) => meal.enabled).map((meal) => (
              <div
                className="food-reminder-row"
                key={meal.slot}
                style={{ display: "grid", gridTemplateColumns: "28px 1fr 124px 36px", gap: 8, alignItems: "center" }}
              >
                <label className="food-reminder-row-check" aria-label={`Enable ${meal.slot} reminder`} style={{ width: 28, height: 38, display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={meal.enabled}
                    disabled={!draftEnabled}
                    onChange={(event) => setDraftMealEnabled(meal.slot, event.target.checked)}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                  />
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 7,
                      border: `1.5px solid ${meal.enabled ? "var(--he-green)" : "#DCE3E0"}`,
                      background: meal.enabled ? "var(--he-green)" : "#fff",
                      boxShadow: meal.enabled ? "inset 0 0 0 4px #fff" : "none",
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={meal.label}
                  placeholder="Reminder name"
                  maxLength={32}
                  disabled={!draftEnabled || !meal.enabled}
                  onChange={(event) => updateDraftMeal(meal.slot, { label: event.target.value })}
                  style={{
                    height: 38,
                    border: "1.5px solid #E8E3E5",
                    borderRadius: 12,
                    background: draftEnabled && meal.enabled ? "rgba(255,255,255,.88)" : "#F8F6F7",
                    color: draftEnabled && meal.enabled ? "var(--he-ink-1)" : "#A0A6AD",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 850,
                    padding: "0 10px",
                    outline: "none",
                  }}
                />
                <select
                  value={meal.time}
                  disabled={!draftEnabled || !meal.enabled}
                  onChange={(event) => updateDraftMeal(meal.slot, { time: event.target.value })}
                  style={{
                    height: 38,
                    border: "1.5px solid #E8E3E5",
                    borderRadius: 12,
                    background: draftEnabled && meal.enabled ? "rgba(255,255,255,.88)" : "#F8F6F7",
                    color: draftEnabled && meal.enabled ? "var(--he-ink-1)" : "#A0A6AD",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 850,
                    padding: "0 10px",
                    outline: "none",
                    cursor: draftEnabled && meal.enabled ? "pointer" : "not-allowed",
                  }}
                >
                  {FOOD_REMINDER_TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${meal.label || "reminder"}`}
                  onClick={() => removeDraftMeal(meal.slot)}
                  disabled={!draftEnabled}
                  style={{
                    width: 36,
                    height: 38,
                    display: "grid",
                    placeItems: "center",
                    border: "1.5px solid #F0DDDD",
                    borderRadius: 12,
                    background: draftEnabled ? "#FFF7F6" : "#F8F6F7",
                    color: draftEnabled ? "var(--he-coral)" : "#A0A6AD",
                    cursor: draftEnabled ? "pointer" : "not-allowed",
                  }}
                >
                  <Trash size={16} weight="bold" />
                </button>
              </div>
            ))}
            {draftMeals.filter((meal) => meal.enabled).length < 5 && (
              <button
                type="button"
                onClick={addDraftMeal}
                disabled={!draftEnabled}
                style={{
                  height: 42,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  border: "1.5px dashed #BDEFD3",
                  borderRadius: 14,
                  background: draftEnabled ? "#F3FCF7" : "#F8F6F7",
                  color: draftEnabled ? "var(--he-green-deep)" : "#A0A6AD",
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  fontWeight: 900,
                  cursor: draftEnabled ? "pointer" : "not-allowed",
                }}
              >
                <Plus size={15} weight="bold" />
                Add reminder
              </button>
            )}
          </div>

          {draftError && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                padding: "9px 11px",
                borderRadius: 12,
                border: "1px solid #FFD6D1",
                background: "#FFF5F3",
                color: "#D94E45",
                fontSize: 11.5,
                fontWeight: 800,
                lineHeight: 1.35,
              }}
            >
              {draftError}
            </div>
          )}

          <div className="food-reminder-menu-foot" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0ECEE" }}>
            <span style={{ color: "var(--he-ink-3)", fontSize: 11.5, fontWeight: 800 }}>
              {draftMeals.filter((meal) => meal.enabled).length} {draftMeals.filter((meal) => meal.enabled).length === 1 ? "reminder" : "reminders"} selected
            </span>
            <button
              type="button"
              onClick={saveSetup}
              disabled={saving}
              style={{
                height: 36,
                padding: "0 16px",
                border: "none",
                borderRadius: 12,
                background: "linear-gradient(150deg, #38D184, var(--he-green))",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 900,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.72 : 1,
                boxShadow: "0 9px 18px rgba(32,168,101,.22)",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
