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
let inFlight: Promise<MonthlyUsageSnapshot | null> | null = null;
const subscribers = new Set<(snapshot: MonthlyUsageSnapshot | null) => void>();

function loadSnapshot(): Promise<MonthlyUsageSnapshot | null> {
  if (cachedSnapshot) return Promise.resolve(cachedSnapshot);
  if (inFlight) return inFlight;

  inFlight = getMonthlyUsage()
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      subscribers.forEach((notify) => notify(snapshot));
      return snapshot;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export type SubscriptionState = {
  /** True once the account is on an active paid plan. */
  isSubscribed: boolean;
  planKey: MonthlyUsageSnapshot["plan_key"] | null;
  usage: MonthlyUsageSnapshot | null;
};

export function useSubscription(): SubscriptionState {
  const [snapshot, setSnapshot] = useState<MonthlyUsageSnapshot | null>(cachedSnapshot);

  useEffect(() => {
    subscribers.add(setSnapshot);
    void loadSnapshot().then((loaded) => {
      if (loaded) setSnapshot(loaded);
    });
    return () => {
      subscribers.delete(setSnapshot);
    };
  }, []);

  return {
    isSubscribed: snapshot?.unlimited === true,
    planKey: snapshot?.plan_key ?? null,
    usage: snapshot,
  };
}
