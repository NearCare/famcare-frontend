"use client";

import { useSubscription } from "@/lib/useSubscription";

type BrandMarkProps = {
  className?: string;
  alt?: string;
};

/**
 * Subscription-aware FamCare mark.
 *
 * Keep every authenticated product surface on this component so a paid
 * account consistently receives the FamCare+ artwork.
 */
export default function BrandMark({ className, alt = "" }: BrandMarkProps) {
  const { isSubscribed } = useSubscription();

  return (
    <img
      className={`${className ?? ""}${isSubscribed ? " plus" : ""}`.trim()}
      src={isSubscribed ? "/famcareplus.png" : "/famcare-logo.png"}
      alt={alt}
    />
  );
}
