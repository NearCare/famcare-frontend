/**
 * Typed API client for the GharSehat / NearCare backend.
 *
 * Set NEXT_PUBLIC_API_URL in .env.local to point at the Ktor server.
 * Default: http://localhost:8080  (backend should run on 8080 in dev
 *          so it doesn't clash with the Next.js dev server on 3000).
 */

const BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8080";

// ─── Types (mirror the Kotlin data classes) ──────────────────────────────────

export type User = {
  id: string;
  phone: string;
  name: string | null;
  created_at: string;
};

export type HealthLog = {
  id: string;
  user_id: string;
  logged_at: string; // "YYYY-MM-DD"
  steps: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  raw_message: string | null;
};

export type Summary = {
  period_days: number;
  avg_steps: number | null;
  avg_protein_g: number | null;
  avg_carbs_g: number | null;
  step_goal_hits: number;
  last_logged: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    // Don't cache — dashboard data should always be fresh
    cache: "no-store",
  });

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
  const res = await fetch(`${BASE_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to send OTP");
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
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Invalid OTP");
  }
  return res.json() as Promise<AuthResponse>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns all registered users (family members tracked via WhatsApp).
 */
export async function getUsers(): Promise<User[]> {
  const data = await apiFetch<{ users: User[] }>("/api/users");
  return data.users;
}

/**
 * Returns raw daily health logs for a user.
 * @param days  How many past days to fetch (default 30)
 */
export async function getUserLogs(
  userId: string,
  days = 30
): Promise<HealthLog[]> {
  const data = await apiFetch<{ logs: HealthLog[] }>(
    `/api/users/${userId}/logs?days=${days}`
  );
  return data.logs;
}

/**
 * Returns the 7-day aggregated summary for a user.
 * Returns null when the backend reports "No data given yet".
 */
export async function getUserSummary(userId: string): Promise<Summary | null> {
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
  id: string;
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
  const data = await authedFetch<{ members: FamilyMember[] }>("/family/members", token);
  return data.members;
}

export async function getMemberSummary(memberId: string, token: string): Promise<Summary | null> {
  const data = await authedFetch<Summary | { message: string }>(
    `/family/members/${memberId}/summary`, token
  );
  if ("message" in data) return null;
  return data as Summary;
}

export async function getMemberLogs(memberId: string, token: string, days = 7): Promise<HealthLog[]> {
  const data = await authedFetch<{ logs: HealthLog[] }>(
    `/family/members/${memberId}/logs?days=${days}`, token
  );
  return data.logs;
}

// ─── Derived helpers used by the dashboard ───────────────────────────────────

/** Pull the last 7 logs and bucket them into Mon–Sun arrays for charts. */
export function logsToWeeklySteps(
  logs: HealthLog[]
): { label: string; value: number }[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // Build a map: YYYY-MM-DD → steps
  const byDate: Record<string, number> = {};
  for (const l of logs) {
    byDate[l.logged_at] = (byDate[l.logged_at] ?? 0) + (l.steps ?? 0);
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
