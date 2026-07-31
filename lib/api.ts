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

/**
 * Which plan the mocked account is on: `free` (default), `individual` or
 * `family`. Set NEXT_PUBLIC_MOCK_PLAN in .env.local to preview the dashboard
 * as a paying subscriber without a backend or a real Razorpay payment.
 * Seat counts and prices mirror the backend's PLAN_CATALOG.
 */
const MOCK_PLAN: BillingPlanKey | "free" =
  typeof process !== "undefined" && (process.env.NEXT_PUBLIC_MOCK_PLAN === "individual" || process.env.NEXT_PUBLIC_MOCK_PLAN === "family")
    ? process.env.NEXT_PUBLIC_MOCK_PLAN
    : "free";

const MOCK_PLAN_AMOUNT_PAISE = { free: 0, individual: 14_900, family: 29_900 } as const;
const MOCK_PLAN_SEATS = { free: 1, individual: 1, family: 2 } as const;

const MOCK_USER: User = {
  id: 1,
  phone: "+910000000000",
  name: "Test User",
  goal_steps: 8000,
  goal_protein_g: null,
  goal_calories: null,
  goal_sleep_hours: 8,
  created_at: new Date().toISOString(),
};

const MOCK_LOGS: HealthLog[] = Array.from({ length: 90 }, (_, i) => {
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
}).filter((_, i) => i !== 1 && i % 11 !== 4);

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

export type BackfillYesterdayLogResponse = {
  message: string;
  log: HealthLog;
  event: HealthLogEvent;
};

export type YesterdayFoodPreview = {
  message: string;
  summary: string;
  protein_g: number;
  calories: number;
};

export type FoodPatternItem = {
  food_name: string;
  log_count: number;
  total_protein_g: number;
};

export type FoodPatterns = {
  unique_foods: number;
  total_food_logs: number;
  most_logged_food: string | null;
  top_protein_food: string | null;
  top_foods: FoodPatternItem[];
};

export type ChatConversation = {
  id: number;
  owner_user_id: number;
  subject_user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMetric = {
  label: string;
  current: number | null;
  target: number | null;
  unit: string;
  delta: number | null;
};

export type ChatBlock = {
  type: string;
  title: string;
  metrics?: ChatMetric[];
  items?: string[];
  footnote?: string | null;
  tone?: string;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  blocks?: ChatBlock[];
  suggestions?: string[];
  created_at: string;
  feedback?: ChatFeedback | null;
};

export type ChatFeedback = {
  rating: "up" | "down";
  issue_type?: "wrong_data" | "misunderstood" | "unhelpful" | "too_long" | "unsafe" | "other" | null;
  comment?: string | null;
};

export type HealthAssistantReply = {
  conversation_id: number;
  message: ChatMessage;
  intent: string;
  tools_used: string[];
};

export type MonthlyUsageItem = {
  key: "reminder_delivered" | "ai_chat_answer" | "whatsapp_text_log" | "whatsapp_image_analysis";
  label: string;
  used: number;
  limit: number;
  warning_at: number;
  percentage: number;
  blocked: boolean;
};

export type MonthlyUsageSnapshot = {
  billing_user_id: number;
  period_start: string;
  period_end: string;
  plan_key: "free" | "individual" | "family";
  status: "free" | "trialing" | "active" | "past_due" | "cancelled" | "expired";
  unlimited: boolean;
  items: MonthlyUsageItem[];
  upgrade_url: string;
};

export type BillingPlanKey = "individual" | "family";

export type SubscriptionCheckout = {
  key_id: string;
  subscription_id: string;
  plan_key: BillingPlanKey | "extra_parent";
  amount_paise: number;
  currency: "INR";
  customer_name: string;
  customer_phone: string;
};

export type SubscriptionCheckoutVerification = {
  verified: boolean;
  status: "pending";
  message: string;
};

export type CheckoutStatus = {
  subscription_id: string;
  payment_id?: string | null;
  plan_key: BillingPlanKey | "extra_parent";
  kind: "base" | "extra_parent";
  status: string;
  active: boolean;
  verified: boolean;
  scheduled: boolean;
  amount_paise: number;
  current_period_end?: string | null;
};

export type SubscriptionDetails = {
  active: boolean;
  plan_key: BillingPlanKey | "free";
  status: string;
  amount_paise: number;
  provider_subscription_id?: string | null;
  started_at?: string | null;
  paid_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  extra_parents?: number;
  /**
   * Whether the account is entitled to this plan right now. Not the same as
   * `active`: a cancelled plan stays entitled until its paid period ends, and an
   * `active` mandate whose period lapsed is not. Anything deciding whether to
   * offer a plan for sale must read this, never `plan_key` alone.
   */
  entitled?: boolean;
  /** False for family members on someone else's plan — they can't cancel or buy add-ons. */
  owner?: boolean;
};

export type PlanFeature = { title: string; description: string };

export type BillingPlanInfo = {
  plan_key: BillingPlanKey;
  name: string;
  eyebrow: string;
  description: string;
  included: string;
  amount_paise: number;
  original_amount_paise: number;
  currency: string;
  billing_cycle: string;
  /** Parents this plan can add, before any extra-parent add-ons. */
  parent_seats: number;
  features: PlanFeature[];
};

export type ExtraParentPlanInfo = {
  plan_key: "extra_parent";
  name: string;
  description: string;
  amount_paise: number;
  currency: string;
  billing_cycle: string;
};

export type FamilySeatStatus = {
  plan_key: string;
  used: number;
  limit: number;
  can_add: boolean;
  extra_parents: number;
};

export type BillingInvoice = {
  id: string;
  description: string;
  amount_paise: number;
  currency: string;
  status: string;
  issued_at?: string | null;
  paid_at?: string | null;
  receipt_url?: string | null;
};

export type CancelSubscriptionResult = {
  cancel_at_period_end: boolean;
  current_period_end?: string | null;
  message: string;
};

export type BillingPlansResponse = {
  plans: BillingPlanInfo[];
  extra_parent: ExtraParentPlanInfo;
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

async function chatRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Your session has expired.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? body.message ?? "The assistant could not respond.");
  return body as T;
}

export async function getMonthlyUsage(): Promise<MonthlyUsageSnapshot> {
  if (MOCK_API) {
    const items: MonthlyUsageItem[] = [
      { key: "reminder_delivered", label: "Reminders", used: 18, limit: 30, warning_at: 24, percentage: 60, blocked: false },
      { key: "ai_chat_answer", label: "AI Coach answers", used: 8, limit: 20, warning_at: 16, percentage: 40, blocked: false },
      { key: "whatsapp_text_log", label: "WhatsApp food logs", used: 25, limit: 40, warning_at: 32, percentage: 63, blocked: false },
      { key: "whatsapp_image_analysis", label: "WhatsApp photo analyses", used: 2, limit: 5, warning_at: 4, percentage: 40, blocked: false },
    ];
    return {
      billing_user_id: MOCK_USER.id,
      period_start: new Date().toLocaleDateString("en-CA").slice(0, 8) + "01",
      period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        .toLocaleDateString("en-CA"),
      plan_key: MOCK_PLAN,
      status: MOCK_PLAN === "free" ? "free" : "active",
      // Paid plans lift every meter — this is what drives the FamCare+ mark.
      unlimited: MOCK_PLAN !== "free",
      upgrade_url: "/dashboard/payments",
      // Mirrors UsageService: `limit` stays, only percentage/blocked reset.
      items: MOCK_PLAN === "free"
        ? items
        : items.map((item) => ({ ...item, percentage: 0, blocked: false })),
    };
  }
  return apiFetch<MonthlyUsageSnapshot>("/api/usage/monthly");
}

const MOCK_PLANS: BillingPlansResponse = {
  plans: [
    {
      plan_key: "individual",
      name: "Individual plan",
      eyebrow: "For your own health",
      description: "Smart WhatsApp health tracking for one person.",
      included: "Your account",
      amount_paise: 14_900,
      original_amount_paise: 19_900,
      currency: "INR",
      billing_cycle: "monthly",
      parent_seats: 1,
      features: [
        { title: "WhatsApp food logs", description: "Log meals by text or photo" },
        { title: "Medication reminders", description: "Stay on time with every dose" },
        { title: "AI health coach", description: "Understand your nutrition trends" },
        { title: "Health insights", description: "See calories, protein and consistency" },
      ],
    },
    {
      plan_key: "family",
      name: "Family plan",
      eyebrow: "Most popular",
      description: "Everything you need to stay close to your parents’ health.",
      included: "You + 2 parents",
      amount_paise: 29_900,
      original_amount_paise: 49_900,
      currency: "INR",
      billing_cycle: "monthly",
      parent_seats: 2,
      features: [
        { title: "Track meals on WhatsApp", description: "Parents log naturally, you see the insights" },
        { title: "Medication reminders", description: "Help everyone stay on schedule" },
        { title: "Family dashboard", description: "See your family’s progress together" },
        { title: "AI health coach", description: "Ask about your family’s nutrition trends" },
      ],
    },
  ],
  extra_parent: {
    plan_key: "extra_parent",
    name: "Extra parent",
    description: "Add another parent to an active Family plan.",
    amount_paise: 14_900,
    currency: "INR",
    billing_cycle: "monthly",
  },
};

export async function getBillingPlans(): Promise<BillingPlansResponse> {
  if (MOCK_API) return MOCK_PLANS;
  return apiFetch<BillingPlansResponse>("/api/billing/plans");
}

export async function createSubscriptionCheckout(
  planKey: BillingPlanKey,
): Promise<SubscriptionCheckout> {
  if (MOCK_API) {
    return {
      key_id: "rzp_test_famcare",
      subscription_id: `sub_mock_${planKey}`,
      plan_key: planKey,
      amount_paise: planKey === "family" ? 29_900 : 14_900,
      currency: "INR",
      customer_name: MOCK_USER.name ?? "FamCare user",
      customer_phone: MOCK_USER.phone,
    };
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  return authedFetch<SubscriptionCheckout>("/api/billing/subscriptions", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_key: planKey }),
  });
}

export async function verifySubscriptionCheckout(input: {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}): Promise<SubscriptionCheckoutVerification> {
  if (MOCK_API) {
    return {
      verified: true,
      status: "pending",
      message: "Payment verified. Your plan will activate in a moment.",
    };
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  return authedFetch<SubscriptionCheckoutVerification>("/api/billing/checkout/verify", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getCheckoutStatus(subscriptionId: string): Promise<CheckoutStatus> {
  if (MOCK_API) {
    const planKey = subscriptionId.includes("extra") ? "extra_parent" : "family";
    return {
      subscription_id: subscriptionId,
      payment_id: "pay_mock_verified",
      plan_key: planKey,
      kind: planKey === "extra_parent" ? "extra_parent" : "base",
      status: "active",
      active: true,
      verified: true,
      scheduled: false,
      amount_paise: planKey === "extra_parent" ? 14_900 : 29_900,
    };
  }
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  return authedFetch<CheckoutStatus>(
    `/api/billing/checkout/status?subscription_id=${encodeURIComponent(subscriptionId)}`,
    token,
  );
}

export async function getSubscriptionDetails(): Promise<SubscriptionDetails> {
  if (MOCK_API) {
    if (MOCK_PLAN === "free") {
      return { active: false, plan_key: "free", status: "free", amount_paise: 0 };
    }
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const startedAt = new Date();
    startedAt.setMonth(startedAt.getMonth() - 1);
    return {
      active: true,
      plan_key: MOCK_PLAN,
      status: "active",
      amount_paise: MOCK_PLAN_AMOUNT_PAISE[MOCK_PLAN],
      provider_subscription_id: `sub_mock_${MOCK_PLAN}`,
      started_at: startedAt.toISOString(),
      paid_at: startedAt.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      extra_parents: 0,
      // Without these the mocked paid plan reads as un-entitled and the payments
      // page falls back to the plan picker, which is not what MOCK_PLAN means.
      entitled: true,
      owner: true,
    };
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  return authedFetch<SubscriptionDetails>("/api/billing/subscription", token);
}

export async function getFamilySeats(): Promise<FamilySeatStatus> {
  if (MOCK_API) {
    const limit = MOCK_PLAN_SEATS[MOCK_PLAN];
    return { plan_key: MOCK_PLAN, used: 0, limit, can_add: 0 < limit, extra_parents: 0 };
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  return authedFetch<FamilySeatStatus>("/api/billing/seats", token);
}

export async function getBillingInvoices(): Promise<BillingInvoice[]> {
  if (MOCK_API) {
    if (MOCK_PLAN === "free") return [];
    // One receipt per past month so the billing history has something to show.
    return Array.from({ length: 2 }, (_, i) => {
      const paidAt = new Date();
      paidAt.setMonth(paidAt.getMonth() - (i + 1));
      return {
        id: `inv_mock_${i + 1}`,
        description: MOCK_PLAN === "family" ? "FamCare Family plan" : "FamCare Individual plan",
        amount_paise: MOCK_PLAN_AMOUNT_PAISE[MOCK_PLAN],
        currency: "INR",
        status: "paid",
        issued_at: paidAt.toISOString(),
        paid_at: paidAt.toISOString(),
        receipt_url: null,
      };
    });
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  const body = await authedFetch<{ invoices: BillingInvoice[] }>("/api/billing/invoices", token);
  return body.invoices;
}

export async function cancelSubscription(): Promise<CancelSubscriptionResult> {
  if (MOCK_API) {
    return {
      cancel_at_period_end: true,
      message: "Your plan will stay active until the end of this billing period, then stop renewing.",
    };
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  return authedFetch<CancelSubscriptionResult>("/api/billing/cancel", token, { method: "POST" });
}

export async function createExtraParentCheckout(): Promise<SubscriptionCheckout> {
  if (MOCK_API) {
    return {
      key_id: "rzp_test_famcare",
      subscription_id: `sub_mock_extra_parent_${Date.now()}`,
      plan_key: "extra_parent",
      amount_paise: MOCK_PLANS.extra_parent.amount_paise,
      currency: "INR",
      customer_name: MOCK_USER.name ?? "FamCare user",
      customer_phone: MOCK_USER.phone,
    };
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new Error("Please log in again to continue.");
  return authedFetch<SubscriptionCheckout>("/api/billing/extra-parent", token, {
    method: "POST",
  });
}


export async function getChatConversations(token: string): Promise<ChatConversation[]> {
  const body = await chatRequest<{ conversations: ChatConversation[] }>("/api/chat/conversations", token);
  return body.conversations;
}

export async function createChatConversation(token: string, subjectUserId: number): Promise<ChatConversation> {
  return chatRequest<ChatConversation>("/api/chat/conversations", token, {
    method: "POST",
    body: JSON.stringify({ subject_user_id: subjectUserId }),
  });
}

export async function getChatMessages(token: string, conversationId: number): Promise<ChatMessage[]> {
  const body = await chatRequest<{ messages: ChatMessage[] }>(
    `/api/chat/conversations/${conversationId}/messages`, token,
  );
  return body.messages;
}

export async function clearChatMessages(token: string, conversationId: number): Promise<void> {
  await chatRequest<Record<string, never>>(`/api/chat/conversations/${conversationId}/messages`, token, {
    method: "DELETE",
  });
}

export async function sendHealthAssistantMessage(
  token: string,
  conversationId: number,
  subjectUserId: number,
  message: string,
): Promise<HealthAssistantReply> {
  return chatRequest<HealthAssistantReply>("/api/chat/messages", token, {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      subject_user_id: subjectUserId,
      message,
    }),
  });
}

export async function submitChatFeedback(
  token: string,
  messageId: number,
  feedback: ChatFeedback,
): Promise<ChatFeedback> {
  return chatRequest<ChatFeedback>(`/api/chat/messages/${messageId}/feedback`, token, {
    method: "POST",
    body: JSON.stringify(feedback),
  });
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
  if (MOCK_API) return MOCK_LOGS.slice(0, days);
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

export async function previewYesterdayFood(
  message: string,
  token: string,
): Promise<YesterdayFoodPreview> {
  if (MOCK_API) {
    return {
      message,
      summary: `Estimated nutrition for ${message}`,
      protein_g: 18,
      calories: 420,
    };
  }
  return authedFetch<YesterdayFoodPreview>("/api/health-logs/backfill-yesterday/preview", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

export async function backfillYesterdayFood(
  preview: YesterdayFoodPreview,
  token: string,
): Promise<BackfillYesterdayLogResponse> {
  if (MOCK_API) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const loggedAt = yesterday.toLocaleDateString("en-CA");
    const event: HealthLogEvent = {
      id: Date.now(),
      user_id: MOCK_USER.id,
      logged_at: loggedAt,
      source: "text",
      raw_message: preview.message,
      summary: preview.summary,
      steps: null,
      protein_g: preview.protein_g,
      calories: preview.calories,
      sleep_hours: null,
      created_at: new Date().toISOString(),
    };
    return {
      message: "Yesterday's food was logged",
      event,
      log: {
        id: Date.now(),
        user_id: MOCK_USER.id,
        logged_at: loggedAt,
        steps: null,
        protein_g: event.protein_g,
        calories: event.calories,
        sleep_hours: null,
        raw_message: preview.message,
      },
    };
  }
  return authedFetch<BackfillYesterdayLogResponse>("/api/health-logs/backfill-yesterday", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preview),
  });
}

export async function getUserFoodPatterns(
  userId: number,
  days = 30,
  start?: string,
  end?: string,
): Promise<FoodPatterns> {
  if (MOCK_API) {
    return {
      unique_foods: 8,
      total_food_logs: 62,
      most_logged_food: "Oats",
      top_protein_food: "Grilled chicken",
      top_foods: [
        { food_name: "Oats", log_count: 12, total_protein_g: 96 },
        { food_name: "Boiled eggs", log_count: 10, total_protein_g: 120 },
        { food_name: "Dal", log_count: 9, total_protein_g: 108 },
        { food_name: "Grilled chicken", log_count: 7, total_protein_g: 280 },
        { food_name: "Banana", log_count: 6, total_protein_g: 8 },
      ],
    };
  }
  const query = new URLSearchParams({ days: String(days) });
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  return apiFetch<FoodPatterns>(`/api/users/${userId}/food-patterns?${query.toString()}`);
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
  if (MOCK_API) return MOCK_LOGS.slice(0, days);
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

export async function getMemberFoodPatterns(
  memberId: number,
  token: string,
  days = 30,
  start?: string,
  end?: string,
): Promise<FoodPatterns> {
  if (MOCK_API) return getUserFoodPatterns(memberId, days, start, end);
  const query = new URLSearchParams({ days: String(days) });
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  return authedFetch<FoodPatterns>(
    `/family/members/${memberId}/food-patterns?${query.toString()}`,
    token,
  );
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

export async function getFoodReminderPreference(token: string, patientUserId?: number): Promise<FoodReminderPreference> {
  if (MOCK_API) {
    return {
      user_id: patientUserId ?? MOCK_USER.id,
      enabled: true,
      activated: true,
      breakfast_time: "11:00",
      lunch_time: "15:00",
      dinner_time: "22:00",
      meals: [
        { slot: "breakfast", label: "breakfast", time: "11:00", enabled: true },
        { slot: "lunch", label: "lunch", time: "15:00", enabled: false },
        { slot: "dinner", label: "dinner", time: "22:00", enabled: false },
        { slot: "snack", label: "snack", time: "18:00", enabled: false },
        { slot: "extra", label: "snack", time: "20:00", enabled: false },
      ],
    };
  }
  const path = patientUserId
    ? `/api/food-reminders/preference?patientUserId=${patientUserId}`
    : "/api/food-reminders/preference";
  return authedFetch<FoodReminderPreference>(path, token);
}

export async function updateFoodReminderPreference(
  enabled: boolean,
  token: string,
  meals?: FoodReminderMeal[],
  patientUserId?: number,
): Promise<FoodReminderPreference> {
  if (MOCK_API) {
    return {
      user_id: patientUserId ?? MOCK_USER.id,
      enabled,
      activated: enabled,
      breakfast_time: "11:00",
      lunch_time: "15:00",
      dinner_time: "22:00",
      meals: meals ?? [
        { slot: "breakfast", label: "breakfast", time: "11:00", enabled: true },
        { slot: "lunch", label: "lunch", time: "15:00", enabled: false },
        { slot: "dinner", label: "dinner", time: "22:00", enabled: false },
        { slot: "snack", label: "snack", time: "18:00", enabled: false },
        { slot: "extra", label: "snack", time: "20:00", enabled: false },
      ],
    };
  }
  const path = patientUserId
    ? `/api/food-reminders/preference?patientUserId=${patientUserId}`
    : "/api/food-reminders/preference";
  return authedFetch<FoodReminderPreference>(path, token, {
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
