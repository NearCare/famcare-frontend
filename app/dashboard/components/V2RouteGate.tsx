"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { bypassV2FeatureFlagLocally, isV2Enabled } from "@/lib/v2Feature";
import PageLoader from "./PageLoader";

export default function V2RouteGate({
  children,
  fallback = "/dashboard",
}: {
  children: ReactNode;
  fallback?: string;
}) {
  const router = useRouter();
  const localBypass = bypassV2FeatureFlagLocally();
  const [allowed, setAllowed] = useState(localBypass);
  const [resolved, setResolved] = useState(localBypass);

  useEffect(() => {
    if (localBypass) return;
    let cancelled = false;

    isV2Enabled().then((enabled) => {
      if (cancelled) return;
      setAllowed(enabled);
      setResolved(true);
      if (!enabled) router.replace(fallback);
    });

    return () => {
      cancelled = true;
    };
  }, [fallback, localBypass, router]);

  if (!resolved || !allowed) return <PageLoader />;
  return children;
}

