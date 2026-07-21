"use client";

import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import { identifyStoredUser, initAnalytics, posthog } from "@/lib/analytics";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
    identifyStoredUser();
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
