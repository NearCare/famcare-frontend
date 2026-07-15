/**
 * Typed API client for the FamCare backend.
 * API calls use same-origin paths; production routing/proxy decides where
 * `/api`, `/auth`, `/family`, and other backend routes resolve.
 */

import { captureEvent } from "./analytics";

const isProductionBuild =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

const BASE_URL = "";

/**
 * Set NEXT_PUBLIC_MOCK_API=true in .env.local to bypass the backend
 * entirely and use canned data — useful for UI-only iteration on the
 * dashboard without running the Ktor server / Supabase / Twilio.
 * Disabled outright in production builds so a misconfigured env var
 * can never serve fake data to real users.
 */
const MOCK_API =
  !isProductionBuild &&
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_MOCK_API === "true";

const MOCK_USER: User = {
  id: 1,
  phone: "+910000000000",
  name: "Test User",
  goal_steps: null,
  goal_protein_g: null,
  goal_calories: null,
  goal_sleep_hours: null,
  created_at: new Date().toISOString(),
};

const MOCK_LOGS: HealthLog[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - i);
  return {
    id: i + 1,
    user_id: 1,
    logged_at: d.toLocaleDateString("en-CA"),
    steps: 4000 + Math.round(Math.random() * 6000),
    protein_g: 40 + Math.round(Math.random() * 40),
    calories: 1600 + Math.round(Math.random() * 900),
    sleep_hours: 5.5 + Math.round(Math.random() * 30) / 10,
    raw_message: i === 0 ? "8200 steps, chicken breast for lunch" : null,
  };
}).filter((_, i) => i !== 4);

const MOCK_LOG_EVENTS: HealthLogEvent[] = [
  {
    id: 1,
    user_id: 1,
    logged_at: new Date().toLocaleDateString("en-CA"),
    source: "text",
    raw_message: "4 roti and bhindi sabzi",
    summary: "Logged estimated calories and protein from roti and bhindi sabzi.",
    steps: null,
    protein_g: 14,
    calories: 580,
    sleep_hours: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    user_id: 2,
    logged_at: new Date().toLocaleDateString("en-CA"),
    source: "text",
    raw_message: "6800 steps today",
    summary: "Logged 6,800 steps.",
    steps: 6800,
    protein_g: null,
    calories: null,
    sleep_hours: null,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_SUMMARY: Summary = {
  period_days: 7,
  avg_steps: 6800,
  avg_protein_g: 58,
  avg_calories: 2050,
  avg_sleep_hours: 6.8,
  step_goal_hits: 4,
  last_logged: MOCK_LOGS[0]?.logged_at ?? null,
};

const MOCK_MEMBERS: FamilyMember[] = [
  { id: 2, phone: "+910000000001", name: "Member One", label: "Member 1", type: "family", status: "active", created_at: new Date().toISOString() },
  { id: 3, phone: "+910000000002", name: null, label: "Member 2", type: "family", status: "active", created_at: new Date().toISOString() },
];

// ─── Types (mirror the Kotlin data classes) ──────────────────────────────────

export type User = {
  id: number;
  phone: string;
  name: string | null;
  goal_steps: number | null;
  goal_protein_g: number | null;
  goal_calories: number | null;
  goal_sleep_hours: number | null;
  created_at: string;
};

export type HealthLog = {
  id: number;
  user_id: number;
  logged_at: string; // "YYYY-MM-DD"
  steps: number | null;
  protein_g: number | null;
  calories: number | null;
  sleep_hours: number | null;
  raw_message: string | null;
};

export type HealthLogEvent = {
  id: number;
  user_id: number;
  logged_at: string;
  source: "text" | "voice";
  raw_message: string;
  summary: string | null;
  steps: number | null;
  protein_g: number | null;
  calories: number | null;
  sleep_hours: number | null;
  created_at: string;
};

export type Summary = {
  period_days: number;
  avg_steps: number | null;
  avg_protein_g: number | null;
  avg_calories: number | null;
  avg_sleep_hours: number | null;
  step_goal_hits: number;
  last_logged: string | null;
};

export type FoodReminderPreference = {
  user_id: number;
  enabled: boolean;
  activated: boolean;
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
  meals: FoodReminderMeal[];
};

export type FoodReminderMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "extra";
  label: string;
  time: string;
  enabled: boolean;
};

export type CalorieTargetRequest = {
  age: number;
  sex: "female" | "male";
  height_cm: number;
  weight_kg: number;
  activity: "sedentary" | "light" | "moderate" | "active";
  goal: "lose" | "maintain" | "gain";
};

export type CalorieTargetResponse = {
  maintenance: number;
  target: number;
  low: number;
  high: number;
  bmr: number;
  bmi: number;
  goal: "lose" | "maintain" | "gain";
  maintenance_only: boolean;
  minimum_limited: boolean;
  protein_target: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Logs the real reason a request failed. A bare `fetch` throws the same
 * generic TypeError for a CORS/proxy issue, a timeout, or being offline —
 * this records which context/path/status it actually was so reports of
 * failures come with real diagnostic info instead of none at all. Does not
 * change what's thrown to the caller.
 */
function logRequestFailure(
  context: string,
  path: string,
  info: { status?: number; error?: unknown },
) {
  captureEvent("api_request_failed", {
    context,
    path,
    status: info.status,
    error_name: info.error instanceof Error ? info.error.name : undefined,
    error_message: info.error instanceof Error ? info.error.message : undefined,
  });
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    logRequestFailure("apiFetch", path, { error: err });
    throw err;
  }

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    logRequestFailure("apiFetch", path, { status: res.status });
    throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

function roundTo50(value: number) {
  return Math.round(value / 50) * 50;
}

function mockCalculateCalorieTarget(body: CalorieTargetRequest): CalorieTargetResponse {
  const sexAdjustment = body.sex === "male" ? 5 : -161;
  const bmr = 10 * body.weight_kg + 6.25 * body.height_cm - 5 * body.age + sexAdjustment;
  const activityFactor = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  }[body.activity];
  const maintenance = roundTo50(bmr * activityFactor);
  const bmi = body.weight_kg / ((body.height_cm / 100) ** 2);
  const maintenanceOnly = body.goal === "lose" && bmi < 18.5;
  const goalFactor = maintenanceOnly || body.goal === "maintain" ? 1 : body.goal === "lose" ? 0.85 : 1.1;
  const rawTarget = roundTo50(maintenance * goalFactor);
  const calorieFloor = body.sex === "male" ? 1500 : 1200;
  const minimumLimited = body.goal === "lose" && rawTarget < calorieFloor;
  const target = minimumLimited ? calorieFloor : rawTarget;
  const proteinFactor = body.goal === "maintain" ? 1.2 : 1.6;
  const proteinTarget = Math.min(200, Math.max(40, Math.round(body.weight_kg * proteinFactor)));

  return {
    maintenance,
    target,
    low: body.goal === "lose" ? Math.max(calorieFloor, target - 100) : target - 100,
    high: target + 100,
    bmr: roundTo50(bmr),
    bmi: Math.round(bmi * 10) / 10,
    goal: body.goal,
    maintenance_only: maintenanceOnly,
    minimum_limited: minimumLimited,
    protein_target: proteinTarget,
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export type AuthResponse = {
  token: string;
  user: User;
};

export async function getCurrentUser(token?: string): Promise<User | null> {
  if (MOCK_API) return MOCK_USER;
  const sessionToken =
    token ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "");
  if (!sessionToken) return null;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/auth/me`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    logRequestFailure("getCurrentUser", "/auth/me", { error: err });
    throw err;
  }

  if (res.status === 401 || res.status === 403) return null;

  if (!res.ok) {
    logRequestFailure("getCurrentUser", "/auth/me", { status: res.status });
    throw new Error(`Session check failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<User>;
}

/**
 * Sends a 4-digit OTP to the given WhatsApp number.
 * Phone must include country code, e.g. "+919876543210"
 */
export async function sendOtp(phone: string): Promise<void> {
  if (MOCK_API) return;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
  } catch (err) {
    logRequestFailure("sendOtp", "/auth/send-otp", { error: err });
    throw new Error("Network error. Please check your connection and try again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = (err as { error?: string }).error;
    logRequestFailure("sendOtp", "/auth/send-otp", { status: res.status });
    if (res.status === 429) throw new Error(message ?? "Too many OTP requests today. Please try again tomorrow.");
    if (res.status === 400) throw new Error(message ?? "That doesn't look like a valid phone number.");
    throw new Error(message ?? "Couldn't send the OTP right now. Please try again in a moment.");
  }
}

/**
 * Verifies the OTP entered by the user.
 * Returns a session token + user on success.
 */
export async function verifyOtp(
  phone: string,
  code: string
): Promise<AuthResponse> {
  if (MOCK_API) return { token: "mock-token", user: MOCK_USER };
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
  } catch (err) {
    logRequestFailure("verifyOtp", "/auth/verify-otp", { error: err });
    throw new Error("Network error. Please check your connection and try again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = (err as { error?: string }).error;
    logRequestFailure("verifyOtp", "/auth/verify-otp", { status: res.status });
    if (res.status === 401) throw new Error(message ?? "That code is incorrect or has expired. Request a new one.");
    if (res.status === 400) throw new Error(message ?? "Please enter the 4-digit code sent to your WhatsApp.");
    throw new Error(message ?? "Couldn't verify your code right now. Please try again.");
  }
  return res.json() as Promise<AuthResponse>;
}

/** Updates the user's personal health goals. Pass null to clear a goal. */
export async function updateUserGoals(
  userId: number,
  goals: { goal_steps: number | null; goal_protein_g: number | null; goal_calories: number | null; goal_sleep_hours: number | null },
  token: string,
): Promise<User> {
  if (MOCK_API) return { ...MOCK_USER, ...goals };
  const path = `/api/users/${userId}/goals`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(goals),
    });
  } catch (err) {
    logRequestFailure("updateUserGoals", path, { error: err });
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logRequestFailure("updateUserGoals", path, { status: res.status });
    throw new Error((err as { error?: string }).error ?? "Failed to update goals");
  }
  return res.json() as Promise<User>;
}

export async function calculateUserCalorieTarget(
  userId: number,
  body: CalorieTargetRequest,
  token: string,
): Promise<CalorieTargetResponse> {
  if (MOCK_API) return mockCalculateCalorieTarget(body);
  const path = `/api/users/${userId}/calorie-target`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logRequestFailure("calculateUserCalorieTarget", path, { error: err });
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logRequestFailure("calculateUserCalorieTarget", path, { status: res.status });
    throw new Error((err as { error?: string }).error ?? "Failed to calculate calorie target");
  }
  return res.json() as Promise<CalorieTargetResponse>;
}

/** Sets the caller's display name. Used by the first-login onboarding step. */
export async function updateUserName(userId: number, name: string, token: string): Promise<User> {
  if (MOCK_API) return { ...MOCK_USER, name };
  const path = `/api/users/${userId}`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
  } catch (err) {
    logRequestFailure("updateUserName", path, { error: err });
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logRequestFailure("updateUserName", path, { status: res.status });
    throw new Error((err as { error?: string }).error ?? "Failed to update name");
  }
  return res.json() as Promise<User>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns raw daily health logs for a user.
 * @param days  How many past days to fetch (default 30)
 */
export async function getUserLogs(
  userId: number,
  days = 30
): Promise<HealthLog[]> {
  if (MOCK_API) return MOCK_LOGS;
  const data = await apiFetch<{ logs: HealthLog[] }>(
    `/api/users/${userId}/logs?days=${days}`
  );
  return data.logs;
}

export async function getUserLogEvents(userId: number, days = 7): Promise<HealthLogEvent[]> {
  if (MOCK_API) return MOCK_LOG_EVENTS.filter((event) => event.user_id === userId);
  const data = await apiFetch<{ log_events: HealthLogEvent[] }>(
    `/api/users/${userId}/log-events?days=${days}`
  );
  return data.log_events;
}

/**
 * Returns the 7-day aggregated summary for a user.
 * Returns null when the backend reports "No data given yet".
 */
export async function getUserSummary(userId: number): Promise<Summary | null> {
  if (MOCK_API) return MOCK_SUMMARY;
  // Backend returns { message: "No data given yet" } when logs are empty —
  // we catch that and normalise to null. Any real network/server error
  // is re-thrown so the dashboard can surface it.
  const data = await apiFetch<Summary | { message: string }>(
    `/api/users/${userId}/summary`
  );
  if ("message" in data) return null;
  return data as Summary;
}

// ─── Family ──────────────────────────────────────────────────────────────────

export type FamilyMember = {
  id: number;
  phone: string;
  name: string | null;
  label: string;
  type: string;
  status: string;   // "pending" | "active"
  created_at: string;
};

export type InviteFamilyResponse = {
  member: FamilyMember;
  method: "otp" | "template";
};

async function authedFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    logRequestFailure("authedFetch", path, { error: err });
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    logRequestFailure("authedFetch", path, { status: res.status });
    throw new Error((err as { error?: string }).error ?? `API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function inviteFamilyMember(
  phone: string, label: string, type: string, token: string
): Promise<InviteFamilyResponse> {
  if (MOCK_API) {
    return {
      member: { id: 4, phone, name: null, label, type, status: "pending", created_at: new Date().toISOString() },
      method: "otp",
    };
  }
  return authedFetch<InviteFamilyResponse>("/family/invite", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, label, type }),
  });
}

export async function verifyFamilyInviteOtp(
  phone: string, code: string, token: string
): Promise<FamilyMember> {
  if (MOCK_API) {
    return { id: 4, phone, name: null, label: "Dad", type: "family", status: "active", created_at: new Date().toISOString() };
  }
  return authedFetch<FamilyMember>("/family/invite/verify-otp", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
}

export async function getFamilyMembers(token: string): Promise<FamilyMember[]> {
  if (MOCK_API) return MOCK_MEMBERS;
  const data = await authedFetch<{ members: FamilyMember[] }>("/family/members", token);
  return data.members;
}

export async function removeFamilyMember(memberId: number, token: string): Promise<void> {
  if (MOCK_API) return;
  await authedFetch<{ message: string }>(`/family/members/${memberId}`, token, {
    method: "DELETE",
  });
}

export async function getMemberSummary(memberId: number, token: string): Promise<Summary | null> {
  if (MOCK_API) return MOCK_SUMMARY;
  const data = await authedFetch<Summary | { message: string }>(
    `/family/members/${memberId}/summary`, token
  );
  if ("message" in data) return null;
  return data as Summary;
}

export async function getMemberLogs(memberId: number, token: string, days = 7): Promise<HealthLog[]> {
  if (MOCK_API) return MOCK_LOGS;
  const data = await authedFetch<{ logs: HealthLog[] }>(
    `/family/members/${memberId}/logs?days=${days}`, token
  );
  return data.logs;
}

export async function getMemberLogEvents(memberId: number, token: string, days = 7): Promise<HealthLogEvent[]> {
  if (MOCK_API) return MOCK_LOG_EVENTS.filter((event) => event.user_id === memberId);
  const data = await authedFetch<{ log_events: HealthLogEvent[] }>(
    `/family/members/${memberId}/log-events?days=${days}`, token
  );
  return data.log_events;
}

export type ReviewFeedbackType = "feature" | "improvement" | "issue" | "praise" | "other";

export async function submitReviewFeedback(input: {
  type: ReviewFeedbackType;
  message: string;
  page_url?: string;
}): Promise<void> {
  if (MOCK_API) return;
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
  if (!token) throw new Error("Please log in again before submitting feedback.");
  await authedFetch<{ message: string }>("/api/review", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getFoodReminderPreference(token: string): Promise<FoodReminderPreference> {
  if (MOCK_API) {
    return {
      user_id: MOCK_USER.id,
      enabled: true,
      activated: true,
      breakfast_time: "09:00",
      lunch_time: "15:00",
      dinner_time: "22:00",
      meals: [
        { slot: "breakfast", label: "breakfast", time: "09:00", enabled: true },
        { slot: "lunch", label: "lunch", time: "15:00", enabled: true },
        { slot: "dinner", label: "dinner", time: "22:00", enabled: true },
        { slot: "snack", label: "snack", time: "18:00", enabled: false },
        { slot: "extra", label: "snack", time: "20:00", enabled: false },
      ],
    };
  }
  return authedFetch<FoodReminderPreference>("/api/food-reminders/preference", token);
}

export async function updateFoodReminderPreference(
  enabled: boolean,
  token: string,
  meals?: FoodReminderMeal[],
): Promise<FoodReminderPreference> {
  if (MOCK_API) {
    return {
      user_id: MOCK_USER.id,
      enabled,
      activated: enabled,
      breakfast_time: "09:00",
      lunch_time: "15:00",
      dinner_time: "22:00",
      meals: meals ?? [
        { slot: "breakfast", label: "breakfast", time: "09:00", enabled: true },
        { slot: "lunch", label: "lunch", time: "15:00", enabled: true },
        { slot: "dinner", label: "dinner", time: "22:00", enabled: true },
        { slot: "snack", label: "snack", time: "18:00", enabled: false },
        { slot: "extra", label: "snack", time: "20:00", enabled: false },
      ],
    };
  }
  return authedFetch<FoodReminderPreference>("/api/food-reminders/preference", token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, meals }),
  });
}

export type CorrectLogValuesInput = {
  event_id?: number;
  log_id?: number;
  steps: number | null;
  protein_g: number | null;
  calories: number | null;
  sleep_hours: number | null;
};

export async function correctLogValues(input: CorrectLogValuesInput): Promise<void> {
  if (MOCK_API) return;
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
  if (!token) throw new Error("Please log in again before updating this log.");
  await authedFetch<{ message: string }>("/api/log-values", token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type MarkLogIncorrectInput = {
  event_id?: number;
  log_id?: number;
  note?: string | null;
};

export async function markLogIncorrect(input: MarkLogIncorrectInput): Promise<void> {
  if (MOCK_API) return;
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
  if (!token) throw new Error("Please log in again before marking this log.");
  await authedFetch<{ message: string }>("/api/log-issues", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type DeleteLogInput = {
  event_id?: number;
  log_id?: number;
};

export async function deleteLog(input: DeleteLogInput): Promise<void> {
  if (MOCK_API) return;
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
  if (!token) throw new Error("Please log in again before deleting this log.");
  await authedFetch<{ message: string }>("/api/log-values", token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ─── Medications ──────────────────────────────────────────────────────────────

export type MedicineSchedule = {
  id: number;
  medicine_id: number;
  time_of_day: string;
  days_of_week: number[] | null;
  reminder_enabled: boolean;
  reminder_offset_minutes: number;
  created_at: string;
  updated_at: string;
};

export type Medicine = {
  id: number;
  owner_id: number;
  patient_user_id: number;
  created_by_user_id: number;
  name: string;
  strength: string | null;
  form: string;
  dose: string;
  timing: string | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  schedules: MedicineSchedule[];
};

export type MedicineScheduleInput = {
  time_of_day: string;
  days_of_week?: number[] | null;
  reminder_enabled: boolean;
  reminder_offset_minutes: number;
};

export type CreateMedicineInput = {
  patient_user_id: number;
  name: string;
  strength?: string | null;
  form: string;
  dose: string;
  timing?: string | null;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
  schedules: MedicineScheduleInput[];
};

export type UpdateMedicineInput = Partial<Omit<CreateMedicineInput, "patient_user_id">> & {
  is_active?: boolean;
};

export type TodayDose = {
  id: string;
  medicine: Medicine;
  schedule: MedicineSchedule;
  scheduled_for: string;
  status: "upcoming" | "due" | "taken" | "missed" | "skipped";
  marked_at: string | null;
  marked_by_user_id: number | null;
};

const MOCK_TAKEN_SCHEDULE_IDS = new Set<number>([902]);

function buildMockMedicationData(patientUserId: number): { medicines: Medicine[]; doses: TodayDose[] } {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA");
  const timestamp = now.toISOString();
  const atOffset = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  const timeOfDay = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  const scheduleTimes = [atOffset(-150), atOffset(-60), atOffset(60), atOffset(180)];
  const schedules: MedicineSchedule[] = scheduleTimes.map((date, index) => ({
    id: 901 + index,
    medicine_id: index < 2 ? 101 : 102,
    time_of_day: timeOfDay(date),
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    reminder_enabled: true,
    reminder_offset_minutes: 0,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  const medicines: Medicine[] = [
    {
      id: 101,
      owner_id: patientUserId,
      patient_user_id: patientUserId,
      created_by_user_id: patientUserId,
      name: "Metformin",
      strength: "500 mg",
      form: "tablet",
      dose: "1 tablet after food",
      timing: "after_food",
      start_date: today,
      end_date: null,
      notes: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
      schedules: schedules.slice(0, 2),
    },
    {
      id: 102,
      owner_id: patientUserId,
      patient_user_id: patientUserId,
      created_by_user_id: patientUserId,
      name: "Vitamin D3",
      strength: null,
      form: "capsule",
      dose: "1 capsule",
      timing: "with_food",
      start_date: today,
      end_date: null,
      notes: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
      schedules: schedules.slice(2),
    },
  ];

  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  const statuses: TodayDose["status"][] = schedules.map((schedule, index) =>
    MOCK_TAKEN_SCHEDULE_IDS.has(schedule.id) ? "taken" : index < 2 ? "due" : "upcoming"
  );
  const doses = schedules.map((schedule, index): TodayDose => ({
    id: `mock-dose-${schedule.id}`,
    medicine: medicineById.get(schedule.medicine_id)!,
    schedule,
    scheduled_for: scheduleTimes[index].toISOString(),
    status: statuses[index],
    marked_at: statuses[index] === "taken" ? atOffset(-55).toISOString() : null,
    marked_by_user_id: statuses[index] === "taken" ? patientUserId : null,
  }));

  return { medicines, doses };
}

export async function getMedicines(patientUserId: number, token: string): Promise<Medicine[]> {
  if (MOCK_API) return buildMockMedicationData(patientUserId).medicines;
  const data = await authedFetch<{ medicines: Medicine[] }>(
    `/api/medicines?patientUserId=${patientUserId}`,
    token,
  );
  return data.medicines;
}

export async function getTodayMedicineDoses(patientUserId: number, token: string): Promise<TodayDose[]> {
  if (MOCK_API) return buildMockMedicationData(patientUserId).doses;
  const data = await authedFetch<{ doses: TodayDose[] }>(
    `/api/medicines/today?patientUserId=${patientUserId}`,
    token,
  );
  return data.doses;
}

export async function createMedicine(input: CreateMedicineInput, token: string): Promise<Medicine> {
  return authedFetch<Medicine>("/api/medicines", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateMedicine(medicineId: number, input: UpdateMedicineInput, token: string): Promise<Medicine> {
  return authedFetch<Medicine>(`/api/medicines/${medicineId}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteMedicine(medicineId: number, token: string): Promise<void> {
  await authedFetch<{ archived: boolean }>(`/api/medicines/${medicineId}`, token, {
    method: "DELETE",
  });
}

export async function markMedicineDose(
  medicineId: number,
  input: { schedule_id: number; scheduled_for: string; status: "taken" | "missed" | "skipped"; note?: string | null },
  token: string,
): Promise<TodayDose> {
  if (MOCK_API) {
    MOCK_TAKEN_SCHEDULE_IDS.add(input.schedule_id);
    const mockDose = buildMockMedicationData(1).doses.find((dose) => dose.schedule.id === input.schedule_id);
    if (!mockDose) throw new Error("Mock dose not found");
    return mockDose;
  }
  return authedFetch<TodayDose>(`/api/medicines/${medicineId}/doses`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ─── Derived helpers used by the dashboard ───────────────────────────────────

/** Pull the last 7 logs and bucket a given metric into Mon–Sun arrays for charts. */
export function logsToWeeklyMetric(
  logs: HealthLog[],
  metric: "steps" | "protein_g" | "calories" | "sleep_hours"
): { label: string; value: number }[] {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  // Build a map: YYYY-MM-DD → metric value (sleep replaces, others accumulate)
  const byDate: Record<string, number> = {};
  for (const l of logs) {
    const v = l[metric] ?? 0;
    if (metric === "sleep_hours") {
      byDate[l.logged_at] = v; // last write wins
    } else {
      byDate[l.logged_at] = (byDate[l.logged_at] ?? 0) + v;
    }
  }

  // Walk the last 7 days
  const result: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local timezone
    result.push({
      label: days[d.getDay() === 0 ? 6 : d.getDay() - 1],
      value: byDate[key] ?? 0,
    });
  }
  return result;
}

/** Pull the last 7 logs and bucket steps into Mon–Sun arrays for charts. */
export function logsToWeeklySteps(
  logs: HealthLog[]
): { label: string; value: number }[] {
  return logsToWeeklyMetric(logs, "steps");
}

/** Counts consecutive days (ending today or yesterday) the user has a logged entry. */
export function calculateStreak(logs: HealthLog[]): number {
  const loggedDates = new Set(logs.filter(hasLoggedMetric).map((l) => l.logged_at));
  const d = new Date();
  let key = d.toLocaleDateString("en-CA");

  // If today has no log yet, start counting from yesterday so an
  // in-progress day doesn't reset an otherwise-intact streak.
  if (!loggedDates.has(key)) {
    d.setDate(d.getDate() - 1);
    key = d.toLocaleDateString("en-CA");
  }

  let streak = 0;
  while (loggedDates.has(key)) {
    streak++;
    d.setDate(d.getDate() - 1);
    key = d.toLocaleDateString("en-CA");
  }
  return streak;
}

export function hasLoggedMetric(log: HealthLog): boolean {
  return log.steps != null || log.protein_g != null || log.calories != null || log.sleep_hours != null;
}
