"use client";

import posthog from "posthog-js";
import type { User } from "./api";

const POSTHOG_HOST = "https://us.i.posthog.com";

let initialized = false;

export function initAnalytics() {
  if (initialized) return true;
  if (typeof window === "undefined") return false;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;

  posthog.init(key, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
  initialized = true;
  return true;
}

export function identifyUser(user: User) {
  if (!initAnalytics()) return;
  posthog.identify(String(user.id), {
    user_id: user.id,
    phone_last4: user.phone.slice(-4),
    has_name: Boolean(user.name),
  });
}

export function captureEvent(
  event: string,
  properties: Record<string, string | number | boolean | null | undefined> = {},
) {
  if (!initAnalytics()) return;
  posthog.capture(event, properties);
}

export { posthog };
