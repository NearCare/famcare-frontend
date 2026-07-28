"use client";

import { useSubscription } from "@/lib/useSubscription";

/**
 * FamCare wordmark. Renders a "+" suffix once the account is on a paid plan so
 * the subscription is visible everywhere the brand appears.
 */
export default function BrandName({ className }: { className?: string }) {
  const { isSubscribed } = useSubscription();

  return (
    <span className={className}>
      Fam<span className="care">Care</span>
      {isSubscribed && <sup className="brand-plus" aria-label="Plus subscription">+</sup>}
    </span>
  );
}
