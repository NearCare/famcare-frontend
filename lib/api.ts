/**
 * Typed API client for the FamCare backend.
 *
 * Set NEXT_PUBLIC_API_URL in .env.local to point at the Ktor server.
 * Default: http://localhost:8080  (backend should run on 8080 in dev
 *          so it doesn't clash with the Next.js dev server on 3000).
 */

const configuredApiUrl =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
const isProductionBuild =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

if (!configuredApiUrl && isProductionBuild) {
  console.error(
    "[famcare] NEXT_PUBLIC_API_URL is not set in a production build — falling back to " +
    "http://localhost:8080, which will not reach the real backend. Set NEXT_PUBLIC_API_URL " +
    "in the deployment environment."
  );
}

const BASE_URL = configuredApiUrl || "http://localhost:8080";

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

export type Summary = {
  period_days: number;
  avg_steps: number | null;
  avg_protein_g: number | null;
  avg_calories: number | null;
  avg_sleep_hours: number | null;
  step_goal_hits: number;
  last_logged: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export type AuthResponse = {
  token: string;
  user: User;
};

/**
 * Sends a 6-digit OTP to the given WhatsApp number.
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
  } catch {
    throw new Error("Network error. Please check your connection and try again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = (err as { error?: string }).error;
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
  } catch {
    throw new Error("Network error. Please check your connection and try again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = (err as { error?: string }).error;
    if (res.status === 401) throw new Error(message ?? "That code is incorrect or has expired. Request a new one.");
    if (res.status === 400) throw new Error(message ?? "Please enter the 6-digit code sent to your WhatsApp.");
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
  const res = await fetch(`${BASE_URL}/api/users/${userId}/goals`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(goals),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to update goals");
  }
  return res.json() as Promise<User>;
}

/** Sets the caller's display name. Used by the first-login onboarding step. */
export async function updateUserName(userId: number, name: string, token: string): Promise<User> {
  if (MOCK_API) return { ...MOCK_USER, name };
  const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
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

async function authedFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function inviteFamilyMember(
  phone: string, label: string, type: string, token: string
): Promise<FamilyMember> {
  return authedFetch<FamilyMember>("/family/invite", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, label, type }),
  });
}

export async function getFamilyMembers(token: string): Promise<FamilyMember[]> {
  if (MOCK_API) return MOCK_MEMBERS;
  const data = await authedFetch<{ members: FamilyMember[] }>("/family/members", token);
  return data.members;
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

export type TodayDose = {
  id: string;
  medicine: Medicine;
  schedule: MedicineSchedule;
  scheduled_for: string;
  status: "upcoming" | "due" | "taken" | "missed" | "skipped";
  marked_at: string | null;
  marked_by_user_id: number | null;
};

export async function getMedicines(patientUserId: number, token: string): Promise<Medicine[]> {
  if (MOCK_API) return [];
  const data = await authedFetch<{ medicines: Medicine[] }>(
    `/api/medicines?patientUserId=${patientUserId}`,
    token,
  );
  return data.medicines;
}

export async function getTodayMedicineDoses(patientUserId: number, token: string): Promise<TodayDose[]> {
  if (MOCK_API) return [];
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

export async function markMedicineDose(
  medicineId: number,
  input: { schedule_id: number; scheduled_for: string; status: "taken" | "missed" | "skipped"; note?: string | null },
  token: string,
): Promise<TodayDose> {
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
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
  const loggedDates = new Set(logs.map((l) => l.logged_at));
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
