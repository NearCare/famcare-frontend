import { getFeatureFlags } from "@/lib/api";

export function bypassV2FeatureFlagLocally(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export async function isV2Enabled(token?: string): Promise<boolean> {
  if (bypassV2FeatureFlagLocally()) return true;
  try {
    return (await getFeatureFlags(token)).v2 === true;
  } catch {
    return false;
  }
}

