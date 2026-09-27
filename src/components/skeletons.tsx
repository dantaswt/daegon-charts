import { Skeleton } from "@/components/ui/skeleton";

export function ChartCardSkeleton() {
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <Skeleton className="aspect-square w-full rounded-none bg-[var(--muted)]" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4 bg-[var(--muted)]" />
        <Skeleton className="h-3 w-1/2 bg-[var(--muted)]" />
      </div>
    </div>
  );
}

export function ChartRowSkeleton() {
  return (
    <div className="chart-card w-full">
      <div className="hidden md:grid gap-3 items-center" style={{ gridTemplateColumns: "auto auto auto minmax(0,1fr) auto" }}>
        <div className="flex flex-col items-center justify-center w-16">
          <Skeleton className="w-12 h-12 bg-[var(--muted)]" />
        </div>
        <Skeleton className="w-24 h-24 bg-[var(--muted)]" />
        <Skeleton className="w-8 h-8 bg-[var(--muted)]" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-5 w-3/4 bg-[var(--muted)]" />
          <Skeleton className="h-4 w-1/2 bg-[var(--muted)]" />
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
            <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
            <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
          </div>
        </div>
      </div>
      <div className="md:hidden flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Skeleton className="w-10 h-10 bg-[var(--muted)]" />
          <Skeleton className="w-14 h-14 bg-[var(--muted)]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4 bg-[var(--muted)]" />
            <Skeleton className="h-3 w-1/2 bg-[var(--muted)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChartPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-10 w-64 bg-[var(--muted)]" />
      <Skeleton className="h-8 w-48 bg-[var(--muted)]" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20 bg-[var(--muted)]" />
        <Skeleton className="h-10 w-20 bg-[var(--muted)]" />
        <Skeleton className="h-10 w-20 bg-[var(--muted)]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <ChartRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ArtistPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
      <Skeleton className="h-6 w-48 bg-[var(--muted)]" />
      <div className="flex flex-col sm:flex-row gap-6 bg-[var(--card)] rounded-3xl p-6 border border-[var(--border)]">
        <Skeleton className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-[var(--muted)] shrink-0 mx-auto sm:mx-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-4 w-32 bg-[var(--muted)]" />
          <Skeleton className="h-10 w-64 bg-[var(--muted)]" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--muted)] p-4">
                <Skeleton className="h-3 w-16 bg-[var(--border)]" />
                <Skeleton className="h-6 w-20 mt-2 bg-[var(--border)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-[var(--muted)]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--card)] rounded-3xl p-5 border border-[var(--border)] space-y-3">
              <Skeleton className="h-4 w-24 bg-[var(--muted)]" />
              <div className="flex gap-2">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="w-9 h-9 rounded-lg bg-[var(--muted)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SongPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
      <Skeleton className="h-6 w-48 bg-[var(--muted)]" />
      <div className="flex flex-col sm:flex-row gap-6 bg-[var(--card)] rounded-3xl p-6 border border-[var(--border)]">
        <Skeleton className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-[var(--muted)] shrink-0 mx-auto sm:mx-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-4 w-32 bg-[var(--muted)]" />
          <Skeleton className="h-10 w-64 bg-[var(--muted)]" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-[var(--border)] bg-[var(--muted)] p-4">
                <Skeleton className="h-3 w-16 bg-[var(--border)]" />
                <Skeleton className="h-6 w-20 mt-2 bg-[var(--border)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-[var(--muted)]" />
        <div className="bg-[var(--card)] rounded-3xl p-5 border border-[var(--border)] space-y-4">
          <Skeleton className="h-4 w-24 bg-[var(--muted)]" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="w-9 h-9 rounded-lg bg-[var(--muted)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-14">
      {/* Hero */}
      <div className="text-center space-y-4 py-12">
        <Skeleton className="h-16 w-96 mx-auto bg-[var(--muted)]" />
        <Skeleton className="h-6 w-64 mx-auto bg-[var(--muted)]" />
      </div>
      {/* Top Charts */}
      <section className="space-y-6">
        <Skeleton className="h-12 w-full bg-[var(--muted)]" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 bg-[var(--muted)]" />
          <Skeleton className="h-10 w-24 bg-[var(--muted)]" />
          <Skeleton className="h-10 w-24 bg-[var(--muted)]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <ChartCardSkeleton key={i} />
          ))}
        </div>
      </section>
      {/* Number Ones */}
      <section className="space-y-6">
        <Skeleton className="h-12 w-full bg-[var(--muted)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-16 h-16 bg-[var(--muted)]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-16 bg-[var(--muted)]" />
                  <Skeleton className="h-4 w-32 bg-[var(--muted)]" />
                  <Skeleton className="h-3 w-24 bg-[var(--muted)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
