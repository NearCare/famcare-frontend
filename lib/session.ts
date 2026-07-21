type StoredUserIdentity = {
  id?: number;
};

export function clearStoredSession(options: { resetFeatureIntro?: boolean } = {}) {
  if (typeof window === "undefined") return;

  if (options.resetFeatureIntro) {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as StoredUserIdentity;
        if (typeof user.id === "number") {
          localStorage.removeItem(`famcare_feature_intro_seen_${user.id}`);
        }
      } catch {
        // Invalid cached identity should not prevent logout.
      }
    }
  }

  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}
