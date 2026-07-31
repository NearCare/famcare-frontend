/**
 * Placeholder blocks shown while a section's data is in flight.
 *
 * These exist so a slow fetch degrades one region instead of replacing the
 * whole screen with a loader: the sidebar, header and page chrome render
 * immediately, and only the parts that genuinely depend on the network wait.
 *
 * Shapes should roughly match the real content so the page doesn't jump when
 * the data lands.
 */
export function Skeleton({
  width,
  height = 14,
  radius = 7,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/**
 * Wrapper for a whole loading region. `label` is what a screen reader announces
 * — the shimmer blocks themselves are decorative and hidden from the tree.
 */
export function SkeletonRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-label={label} className="skeleton-region">
      {children}
    </div>
  );
}

/** A card-shaped placeholder: the common case in the dashboard grids. */
export function SkeletonCard({ height = 150 }: { height?: number }) {
  return <span className="skeleton skeleton-card" style={{ height }} aria-hidden="true" />;
}
