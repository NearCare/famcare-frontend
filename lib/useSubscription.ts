"use client";

import { useEffect, useState } from "react";
import { getMonthlyUsage, type MonthlyUsageSnapshot } from "./api";

/**
 * Shared subscription state.
 *
 * Several parts of the dashboard (sidebar brand, home top bar, profile) need to
 * know whether the account is on a paid plan. They render independently, so the
 * snapshot is cached at module level and shared with every subscriber to keep
 * this to a single request per page load.
 */
let cachedSnapshot: MonthlyUsageSnapshot | null = null;
let cachedError: string | null = null;
let cachedAt = 0;
let inFlight: Promise<MonthlyUsageSnapshot | null> | null = null;
type CachedState = { snapshot: MonthlyUsageSnapshot | null; error: string | null };
const subscribers = new Set<(state: CachedState) => void>();
const CACHE_TTL_MS = 30_000;

function publish() {
  const state = { snapshot: cachedSnapshot, error: cachedError };
  subscribers.forEach((notify) => notify(state));
}

function loadSnapshot(): Promise<MonthlyUsageSnapshot | null> {
  if (cachedSnapshot && Date.now() - cachedAt < CACHE_TTL_MS) {
    return Promise.resolve(cachedSnapshot);
  }
  if (inFlight) return inFlight;

  inFlight = getMonthlyUsage()
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      cachedError = null;
      cachedAt = Date.now();
      publish();
      return snapshot;
    })
    .catch((error) => {
      cachedError = error instanceof Error ? error.message : "Plan status could not be loaded.";
      publish();
      return null;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Drops the cached snapshot and refetches, pushing the result to every mounted
 * subscriber. Call this after a plan change (checkout confirmed, add-on bought)
 * so the FamCare+ marker appears without needing a hard reload — client-side
 * navigation alone would keep serving the pre-payment cache.
 */
export function refreshSubscriptionState(): Promise<MonthlyUsageSnapshot | null> {
  cachedSnapshot = null;
  cachedError = null;
  cachedAt = 0;
  inFlight = null;
  return loadSnapshot();
}

export type SubscriptionState = {
  /** True once the account is on an active paid plan. */
  isSubscribed: boolean;
  planKey: MonthlyUsageSnapshot["plan_key"] | null;
  usage: MonthlyUsageSnapshot | null;
  loading: boolean;
  error: string | null;
  retry: () => Promise<MonthlyUsageSnapshot | null>;
};

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<CachedState>({
    snapshot: cachedSnapshot,
    error: cachedError,
  });

  useEffect(() => {
    subscribers.add(setState);
    void loadSnapshot();
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  return {
    isSubscribed: state.snapshot?.unlimited === true,
    planKey: state.snapshot?.plan_key ?? null,
    usage: state.snapshot,
    loading: state.snapshot === null && state.error === null,
    error: state.error,
    retry: refreshSubscriptionState,
  };
}
