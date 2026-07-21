const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function safeAuthDestination(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const base = new URL("https://famcare.local");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return fallback;
    if (destination.pathname === "/login" || destination.pathname.startsWith("/onboarding/")) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export function authPath(path: "/login" | "/onboarding/name", destination: string): string {
  return `${path}?next=${encodeURIComponent(safeAuthDestination(destination))}`;
}

export function requestedAuthDestination(): string {
  if (typeof window === "undefined") return DEFAULT_AUTH_DESTINATION;
  return safeAuthDestination(new URLSearchParams(window.location.search).get("next"));
}
