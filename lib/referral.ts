const REFERRAL_STORAGE_KEY = "famcare_referral_attribution";
const REFERRAL_ATTRIBUTION_MS = 30 * 24 * 60 * 60 * 1000;
const REFERRAL_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{8}$/;

type StoredReferral = {
  code: string;
  captured_at: number;
};

export function captureReferralFromCurrentUrl(): string | null {
  if (typeof window === "undefined") return null;
  const rawCode = new URLSearchParams(window.location.search).get("ref");
  const code = rawCode?.trim().toUpperCase() ?? "";
  if (!REFERRAL_CODE_PATTERN.test(code)) return getStoredReferralCode();

  // First valid attribution wins for 30 days. Opening a different person's
  // link later must not silently replace the original referrer.
  const existing = getStoredReferralCode();
  if (existing) return existing;

  localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({
    code,
    captured_at: Date.now(),
  } satisfies StoredReferral));
  return code;
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredReferral;
    const valid = REFERRAL_CODE_PATTERN.test(stored.code)
      && Number.isFinite(stored.captured_at)
      && Date.now() - stored.captured_at <= REFERRAL_ATTRIBUTION_MS;
    if (valid) return stored.code;
  } catch {
    // Invalid browser state is treated exactly like an expired attribution.
  }
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  return null;
}

export function clearStoredReferralCode() {
  if (typeof window !== "undefined") localStorage.removeItem(REFERRAL_STORAGE_KEY);
}
