/**
 * Shimmer placeholders — use these instead of "Loading..." text so the layout
 * doesn't jump when data arrives.  tone="light" for the admin/reception screens,
 * tone="dark" (default) for the chef / gate screens.
 */
export function Skeleton({ width = '100%', height = 16, radius = 10, tone = 'dark', style }) {
  return (
    <div
      aria-hidden="true"
      className={tone === 'light' ? 'dp-skeleton dp-skeleton-light' : 'dp-skeleton'}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

/** Generic page-content placeholder: title bar + a few cards. */
export function ContentSkeleton({ rows = 3, tone = 'light' }) {
  return (
    <div role="status" aria-label="Loading" style={{ padding: 24, display: 'grid', gap: 16 }}>
      <Skeleton tone={tone} width="min(260px, 60%)" height={28} />
      <Skeleton tone={tone} width="min(420px, 90%)" height={14} />
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 8 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} tone={tone} height={110} radius={16} />
        ))}
      </div>
      <Skeleton tone={tone} height={220} radius={16} />
    </div>
  )
}

/** Stacked row placeholders for tables / lists. */
export function RowsSkeleton({ rows = 5, tone = 'light', height = 52 }) {
  return (
    <div role="status" aria-label="Loading" style={{ display: 'grid', gap: 10, padding: 4 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} tone={tone} height={height} radius={12} />
      ))}
    </div>
  )
}
