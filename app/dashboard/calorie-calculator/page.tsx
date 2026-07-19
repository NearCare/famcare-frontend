"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CheckCircle,
  Gauge,
  Info,
  PencilSimple,
  Sparkle,
  Target,
  TrendDown,
  TrendUp,
  Minus,
} from "@phosphor-icons/react";
import Sidebar from "../components/Sidebar";
import { calculateUserCalorieTarget, getCurrentUser, updateUserGoals, type User } from "@/lib/api";
import { authPath } from "@/lib/authRedirect";
import { captureEvent, identifyUser, resetAnalytics } from "@/lib/analytics";

type Sex = "female" | "male";
type Activity = "sedentary" | "light" | "moderate" | "active";
type Goal = "lose" | "maintain" | "gain";
type HeightUnit = "cm" | "ft";

type FormState = {
  age: string;
  heightCm: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
  sex: Sex | "";
  activity: Activity | "";
  goal: Goal | "";
};

type Result = {
  maintenance: number;
  target: number;
  low: number;
  high: number;
  bmr: number;
  bmi: number;
  goal: Goal;
  maintenanceOnly: boolean;
  minimumLimited: boolean;
  proteinTarget: number;
};

type SavedCalculatorState = {
  form: FormState;
  heightUnit: HeightUnit;
  result: Result;
};

const SAVED_CALCULATOR_KEY = "famcare_calorie_calculator_result_v1";
const CALCULATOR_PATH = "/dashboard/calorie-calculator";

function calculatorStorageKey(userId?: number) {
  return userId ? `${SAVED_CALCULATOR_KEY}_${userId}` : SAVED_CALCULATOR_KEY;
}

function readStoredUser(): User | null {
  const storedUser = localStorage.getItem("auth_user");
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem("auth_user");
    return null;
  }
}

const initialForm: FormState = {
  age: "",
  heightCm: "",
  heightFeet: "",
  heightInches: "",
  weight: "",
  sex: "",
  activity: "",
  goal: "",
};

const activityOptions: { value: Activity; title: string; helper: string }[] = [
  { value: "sedentary", title: "Mostly seated", helper: "Little planned exercise" },
  { value: "light", title: "Lightly active", helper: "Exercise 1–3 days a week" },
  { value: "moderate", title: "Moderately active", helper: "Exercise 3–5 days a week" },
  { value: "active", title: "Very active", helper: "Hard exercise 6–7 days a week" },
];

const goalOptions: { value: Goal; title: string; helper: string; Icon: typeof TrendDown }[] = [
  { value: "lose", title: "Lose weight", helper: "A gradual 15% reduction", Icon: TrendDown },
  { value: "maintain", title: "Maintain", helper: "Stay around maintenance", Icon: Minus },
  { value: "gain", title: "Gain weight", helper: "A gradual 10% increase", Icon: TrendUp },
];

const calculationStages = [
  "Checking your details",
  "Estimating your daily energy needs",
  "Adjusting the range for your goal",
];

function getHeightCm(form: FormState, unit: HeightUnit) {
  if (unit === "cm") return Number(form.heightCm);
  const feet = Number(form.heightFeet);
  const inches = Number(form.heightInches || 0);
  if (!feet) return 0;
  return (feet * 12 + inches) * 2.54;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function NumberField({
  id,
  label,
  unit,
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="cc-number-field" htmlFor={id}>
      <span>{label}</span>
      <span className="cc-input-wrap">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <span className="cc-unit">{unit}</span>
      </span>
    </label>
  );
}

export default function CalorieCalculatorPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"form" | "calculating" | "result">("form");
  const [calculationStage, setCalculationStage] = useState(0);
  const [goalStatus, setGoalStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [goalError, setGoalError] = useState<string | null>(null);

  const answered = useMemo(() => [
    form.age,
    getHeightCm(form, heightUnit) > 0 ? "height" : "",
    form.weight,
    form.sex,
    form.activity,
    form.goal,
  ].filter(Boolean).length, [form, heightUnit]);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      const token = localStorage.getItem("auth_token");
      const storedUser = readStoredUser();
      if (!token || !storedUser) {
        router.replace(authPath("/login", CALCULATOR_PATH));
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);
        if (cancelled) return;
        if (!currentUser) {
          resetAnalytics();
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          router.replace(authPath("/login", CALCULATOR_PATH));
          return;
        }

        localStorage.setItem("auth_user", JSON.stringify(currentUser));
        identifyUser(currentUser);
        if (!currentUser.name) {
          router.replace(authPath("/onboarding/name", CALCULATOR_PATH));
          return;
        }
        captureEvent("calorie_calculator_viewed", { has_saved_goal: currentUser.goal_calories != null });
        setAuthReady(true);
      } catch {
        if (!cancelled) router.replace(authPath("/login", CALCULATOR_PATH));
      }
    }

    verifySession();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!authReady) return;
    const storedUser = readStoredUser();
    const userId = storedUser?.id;
    const stored = localStorage.getItem(calculatorStorageKey(userId)) ?? localStorage.getItem(SAVED_CALCULATOR_KEY);
    if (!stored) return;
    try {
      const saved = JSON.parse(stored) as SavedCalculatorState;
      if (!saved.form || !saved.result || !saved.heightUnit) return;
      if (userId) {
        localStorage.setItem(calculatorStorageKey(userId), stored);
        localStorage.removeItem(SAVED_CALCULATOR_KEY);
      }
      setForm(saved.form);
      setHeightUnit(saved.heightUnit);
      setResult(saved.result);
      setGoalStatus("saved");
      setView("result");
    } catch {
      localStorage.removeItem(calculatorStorageKey(userId));
      localStorage.removeItem(SAVED_CALCULATOR_KEY);
    }
  }, [authReady]);

  useEffect(() => {
    if (view !== "calculating") return;
    setCalculationStage(0);
    const stageTimer = window.setInterval(() => {
      setCalculationStage((current) => Math.min(current + 1, calculationStages.length - 1));
    }, 1000);
    return () => {
      window.clearInterval(stageTimer);
    };
  }, [view]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
  }

  function changeHeightUnit(nextUnit: HeightUnit) {
    if (nextUnit === heightUnit) return;
    setForm((current) => {
      if (nextUnit === "ft" && current.heightCm) {
        const totalInches = Math.round(Number(current.heightCm) / 2.54);
        return {
          ...current,
          heightFeet: String(Math.floor(totalInches / 12)),
          heightInches: String(totalInches % 12),
        };
      }
      if (nextUnit === "cm" && current.heightFeet) {
        const cm = Math.round((Number(current.heightFeet) * 12 + Number(current.heightInches || 0)) * 2.54);
        return { ...current, heightCm: String(cm) };
      }
      return current;
    });
    setHeightUnit(nextUnit);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const age = Number(form.age);
    const height = getHeightCm(form, heightUnit);
    const weight = Number(form.weight);

    if (age < 18 || age > 100) {
      setError("This calculator currently supports adults aged 18 to 100.");
      return;
    }
    if (height < 120 || height > 230) {
      setError(heightUnit === "cm" ? "Enter a height between 120 and 230 cm." : "Enter a height between 4 ft and 7 ft 6 in.");
      return;
    }
    if (weight < 35 || weight > 300) {
      setError("Enter a weight between 35 and 300 kg.");
      return;
    }
    if (!form.sex || !form.activity || !form.goal) {
      setError("Answer all six questions to see your estimate.");
      return;
    }

    if (heightUnit === "ft" && (Number(form.heightInches || 0) < 0 || Number(form.heightInches || 0) > 11)) {
      setError("Enter inches between 0 and 11.");
      return;
    }

    const token = localStorage.getItem("auth_token");
    const storedUser = readStoredUser();
    if (!token || !storedUser) {
      setError("Log in again to calculate and save your target.");
      return;
    }

    setError(null);
    setGoalStatus("idle");
    setGoalError(null);
    setView("calculating");

    try {
      const [serverResult] = await Promise.all([
        calculateUserCalorieTarget(storedUser.id, {
          age,
          sex: form.sex,
          height_cm: height,
          weight_kg: weight,
          activity: form.activity,
          goal: form.goal,
        }, token),
        wait(3000),
      ]);
      setResult({
        maintenance: serverResult.maintenance,
        target: serverResult.target,
        low: serverResult.low,
        high: serverResult.high,
        bmr: serverResult.bmr,
        bmi: serverResult.bmi,
        goal: serverResult.goal,
        maintenanceOnly: serverResult.maintenance_only,
        minimumLimited: serverResult.minimum_limited,
        proteinTarget: serverResult.protein_target,
      });
      setView("result");
      captureEvent("calorie_target_calculated", {
        goal: form.goal,
        activity: form.activity,
        minimum_limited: serverResult.minimum_limited,
      });
      window.requestAnimationFrame(() => {
        document.getElementById("calorie-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (calculateError) {
      captureEvent("calorie_target_calculation_failed");
      setView("form");
      setError(calculateError instanceof Error ? calculateError.message : "Could not calculate your target. Try again.");
    }
  }

  function editDetails() {
    const storedUser = readStoredUser();
    localStorage.removeItem(calculatorStorageKey(storedUser?.id));
    localStorage.removeItem(SAVED_CALCULATOR_KEY);
    setResult(null);
    setError(null);
    setGoalStatus("idle");
    setGoalError(null);
    setView("form");
  }

  async function saveTargets() {
    if (!result || goalStatus === "saving") return;
    setGoalStatus("saving");
    setGoalError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const storedUser = readStoredUser();
      if (!token || !storedUser) throw new Error("Log in again to save this goal.");
      const updated = await updateUserGoals(storedUser.id, {
        goal_steps: storedUser.goal_steps,
        goal_protein_g: result.proteinTarget,
        goal_calories: result.target,
        goal_sleep_hours: storedUser.goal_sleep_hours,
      }, token);
      localStorage.setItem("auth_user", JSON.stringify(updated));
      localStorage.setItem(calculatorStorageKey(storedUser.id), JSON.stringify({ form, heightUnit, result } satisfies SavedCalculatorState));
      localStorage.removeItem(SAVED_CALCULATOR_KEY);
      setGoalStatus("saved");
      captureEvent("calorie_goal_saved", { goal: result.goal });
    } catch (saveError) {
      setGoalStatus("idle");
      setGoalError(saveError instanceof Error ? saveError.message : "Could not save this goal. Try again.");
    }
  }

  const resultTitle = result?.goal === "lose"
    ? "Your gradual loss range"
    : result?.goal === "gain"
      ? "Your gradual gain range"
      : "Your maintenance range";

  if (!authReady) return null;

  return (
    <div className="db-page">
      <Sidebar />
      <main className="db-main cc-main">
        <header className="cc-hero">
          <div>
            <h1>Calorie Calculator</h1>
            <p>Everything orbits your energy.</p>
            <div className="cc-hero-mini-chip"><Sparkle size={11} weight="fill" /> Balance your universe.</div>
          </div>
          <div className="cc-food-galaxy" aria-hidden="true">
            <span className="cc-orbit orbit-one" />
            <span className="cc-orbit orbit-two" />
            <span className="cc-orbit orbit-three" />
            <span className="cc-galaxy-sparkle sparkle-one">✦</span>
            <span className="cc-galaxy-sparkle sparkle-two">✧</span>
            <div className="cc-fuel-sun">
              <span>Daily fuel</span>
              <strong>Find yours</strong>
              <small>kcal/day</small>
            </div>
            <div className="cc-planet planet-broccoli"><span>🥦</span></div>
            <div className="cc-planet planet-dumbbell"><span>🏋️</span></div>
            <div className="cc-planet planet-protein"><span>💪</span></div>
            <div className="cc-planet planet-moon"><span>🌙</span></div>
          </div>
        </header>

        <div className="cc-layout cc-single-layout">
          {view === "form" && (
            <form className="cc-form" onSubmit={handleSubmit} noValidate>
            <div className="cc-form-progress" aria-label={`${answered} of 6 questions answered`}>
              <div>
                <span>Your details</span>
                <strong>{answered}/6 answered</strong>
              </div>
              <div className="cc-progress-track"><span style={{ width: `${(answered / 6) * 100}%` }} /></div>
            </div>

            <section className="cc-question-section">
              <div className="cc-section-heading">
                <span className="cc-step">1</span>
                <div><h2>Your body</h2><p>Used to estimate how much energy your body needs at rest.</p></div>
              </div>
              <div className="cc-number-grid">
                <NumberField id="cc-age" label="Age" unit="years" value={form.age} min={18} max={100} placeholder="32" onChange={(value) => update("age", value)} />
                <NumberField id="cc-weight" label="Weight" unit="kg" value={form.weight} min={35} max={300} placeholder="70" onChange={(value) => update("weight", value)} />
                <div className="cc-height-field">
                  <span className="cc-height-label">Height</span>
                  <div className="cc-height-unit-pill" aria-label="Height unit">
                    <button type="button" className={heightUnit === "cm" ? "cc-height-unit-active" : ""} onClick={() => changeHeightUnit("cm")}>cm</button>
                    <button type="button" className={heightUnit === "ft" ? "cc-height-unit-active" : ""} onClick={() => changeHeightUnit("ft")}>feet</button>
                  </div>
                  {heightUnit === "cm" ? (
                    <label className="cc-input-wrap" htmlFor="cc-height-cm">
                      <input id="cc-height-cm" type="number" inputMode="decimal" min={120} max={230} placeholder="170" value={form.heightCm} onChange={(event) => update("heightCm", event.target.value)} required />
                      <span className="cc-unit">cm</span>
                    </label>
                  ) : (
                    <div className="cc-height-split">
                      <label className="cc-input-wrap" htmlFor="cc-height-feet">
                        <input id="cc-height-feet" aria-label="Height in feet" type="number" inputMode="numeric" min={3} max={7} placeholder="5" value={form.heightFeet} onChange={(event) => update("heightFeet", event.target.value)} required />
                        <span className="cc-unit">ft</span>
                      </label>
                      <label className="cc-input-wrap" htmlFor="cc-height-inches">
                        <input id="cc-height-inches" aria-label="Additional inches" type="number" inputMode="numeric" min={0} max={11} placeholder="7" value={form.heightInches} onChange={(event) => update("heightInches", event.target.value)} />
                        <span className="cc-unit">in</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <fieldset className="cc-fieldset">
                <legend>Sex used for the estimate</legend>
                <p className="cc-field-help">Metabolic equations use different constants. Choose the one that applies to your physiology.</p>
                <div className="cc-two-options">
                  {(["female", "male"] as Sex[]).map((value) => (
                    <label key={value} className={`cc-choice${form.sex === value ? " selected" : ""}`}>
                      <input type="radio" name="sex" value={value} checked={form.sex === value} onChange={() => update("sex", value)} />
                      <span className="cc-radio" />
                      <span>{value === "female" ? "Female" : "Male"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="cc-question-section">
              <div className="cc-section-heading">
                <span className="cc-step">2</span>
                <div><h2>Your usual week</h2><p>Choose what most weeks look like—not your most active week.</p></div>
              </div>
              <fieldset className="cc-fieldset">
                <legend className="sr-only">Activity level</legend>
                <div className="cc-activity-grid">
                  {activityOptions.map((option) => (
                    <label key={option.value} className={`cc-activity${form.activity === option.value ? " selected" : ""}`}>
                      <input type="radio" name="activity" value={option.value} checked={form.activity === option.value} onChange={() => update("activity", option.value)} />
                      <span className="cc-activity-icon"><Gauge size={20} weight={form.activity === option.value ? "fill" : "bold"} /></span>
                      <strong>{option.title}</strong>
                      <span>{option.helper}</span>
                      {form.activity === option.value && <CheckCircle className="cc-selected-check" size={19} weight="fill" />}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="cc-question-section">
              <div className="cc-section-heading">
                <span className="cc-step">3</span>
                <div><h2>Your goal</h2><p>We use a gradual adjustment designed as a sensible starting point.</p></div>
              </div>
              <fieldset className="cc-fieldset">
                <legend className="sr-only">Weight goal</legend>
                <div className="cc-goal-grid">
                  {goalOptions.map(({ value, title, helper, Icon }) => (
                    <label key={value} className={`cc-goal${form.goal === value ? " selected" : ""}`}>
                      <input type="radio" name="goal" value={value} checked={form.goal === value} onChange={() => update("goal", value)} />
                      <Icon size={21} weight="bold" />
                      <strong>{title}</strong>
                      <span>{helper}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            {error && <div className="cc-error" role="alert">{error}</div>}

            <button className="cc-submit" type="submit">
              Calculate my range <Calculator size={18} weight="bold" />
            </button>
            </form>
          )}

          {view === "calculating" && (
            <section className="cc-calculating-card" aria-live="polite" aria-busy="true">
              <div className="cc-calculation-visual" aria-hidden="true">
                <svg viewBox="0 0 360 190" role="presentation">
                  <defs>
                    <linearGradient id="cc-core-gradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#FF8A7A" />
                      <stop offset="1" stopColor="#FF6B6B" />
                    </linearGradient>
                  </defs>
                  <path className="cc-flow-path path-one" d="M48 44 C104 44 114 88 159 92" />
                  <path className="cc-flow-path path-two" d="M48 145 C105 145 117 105 159 100" />
                  <path className="cc-flow-path path-three" d="M312 96 C264 96 253 96 213 96" />
                  <circle className="cc-visual-node node-one" cx="40" cy="44" r="13" />
                  <circle className="cc-visual-node node-two" cx="40" cy="145" r="13" />
                  <circle className="cc-visual-node node-three" cx="320" cy="96" r="13" />
                  <circle className="cc-core-ring ring-two" cx="186" cy="96" r="44" />
                  <circle className="cc-core-ring" cx="186" cy="96" r="35" />
                  <circle cx="186" cy="96" r="27" fill="url(#cc-core-gradient)" />
                  <path className="cc-heart-line" d="M171 97 H179 L184 86 L191 108 L196 97 H203" />
                </svg>
                <span className="cc-visual-label label-one">Body</span>
                <span className="cc-visual-label label-two">Activity</span>
                <span className="cc-visual-label label-three">Goal</span>
                <Sparkle className="cc-visual-sparkle" size={16} weight="fill" />
              </div>
              <div className="cc-calculating-eyebrow">Working through your answers</div>
              <h2>{calculationStages[calculationStage]}</h2>
              <p>We&apos;re applying a standard metabolic equation and your selected activity and goal.</p>
              <div className="cc-stage-list">
                {calculationStages.map((stage, index) => (
                  <div key={stage} className={index < calculationStage ? "done" : index === calculationStage ? "active" : ""}>
                    <span>{index < calculationStage ? <CheckCircle size={17} weight="fill" /> : index + 1}</span>
                    <strong>{stage}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view === "result" && result && (
            <aside className="cc-result-card cc-result-single has-result" id="calorie-result" aria-live="polite">
              <div className="cc-result-content">
                <div className="cc-result-label"><Target size={16} weight="fill" /> {resultTitle}</div>
                <div className="cc-dial cc-dial-result">
                  <div><span>Daily starting range</span><strong>{result.low.toLocaleString("en-IN")}–{result.high.toLocaleString("en-IN")}</strong><span>kcal per day</span></div>
                </div>

                <div className="cc-target-pair">
                  <div>
                    <span>Calorie target</span>
                    <strong>{result.target.toLocaleString("en-IN")} <small>kcal</small></strong>
                  </div>
                  <div>
                    <span>Protein target</span>
                    <strong>{result.proteinTarget.toLocaleString("en-IN")} <small>g</small></strong>
                  </div>
                </div>

                {result.maintenanceOnly && (
                  <div className="cc-safety-note">
                    <Info size={18} weight="fill" />
                    <span>Your answers suggest that weight loss may not be an appropriate automatic target. We’re showing maintenance calories instead; speak with a qualified professional for personal guidance.</span>
                  </div>
                )}

                {!result.maintenanceOnly && result.minimumLimited && (
                  <div className="cc-safety-note">
                    <Info size={18} weight="fill" />
                    <span>The calculated reduction was below this calculator&apos;s conservative lower boundary, so the displayed range has been limited. Personal guidance may be more appropriate.</span>
                  </div>
                )}

                <div className="cc-result-summary">
                  <div><span>Estimated maintenance</span><strong>~{result.maintenance.toLocaleString("en-IN")} kcal</strong></div>
                  <div><span>Estimated resting need</span><strong>~{result.bmr.toLocaleString("en-IN")} kcal</strong></div>
                </div>

                <div className="cc-result-explainer">
                  <h3>How to use this</h3>
                  <p>Start near <strong>{result.target.toLocaleString("en-IN")} kcal/day</strong>. Follow the range for 2–3 weeks, then review your weight trend, energy, hunger, and logging consistency before adjusting.</p>
                </div>

                <div className="cc-estimate-note">
                  <Info size={16} weight="fill" />
                  <span>Food logs and calorie needs are estimates. Pregnancy, breastfeeding, medical conditions, and athletic training need individual guidance.</span>
                </div>

                {goalError && <div className="cc-error cc-goal-error" role="alert">{goalError}</div>}

                <div className="cc-result-actions">
                  <button
                    type="button"
                    className={`cc-save-goal${goalStatus === "saved" ? " saved" : ""}`}
                    onClick={saveTargets}
                    disabled={goalStatus !== "idle"}
                  >
                    {goalStatus === "saving" ? (
                      <><span className="cc-button-spinner" /> Saving goal...</>
                    ) : goalStatus === "saved" ? (
                      <><CheckCircle size={17} weight="fill" /> Calorie and protein targets saved</>
                    ) : (
                      <><Target size={17} weight="bold" /> Set calorie &amp; protein targets</>
                    )}
                  </button>
                  <button type="button" className="cc-reset" onClick={editDetails}>
                    <PencilSimple size={16} weight="bold" /> Edit details
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
