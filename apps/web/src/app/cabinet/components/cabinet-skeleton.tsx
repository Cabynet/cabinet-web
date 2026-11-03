import { Skeleton } from "@/components/ui/skeleton"

export function CabinetSkeleton() {
  return (
    <div
      className="flex h-dvh w-full gap-4 bg-background p-2 md:p-3"
      role="status"
      aria-label="Loading Cabinet"
    >
      <span className="sr-only">Loading Cabinet…</span>
      <div
        aria-hidden="true"
        className="hidden w-64 shrink-0 flex-col gap-6 rounded-lg border border-border bg-card p-4 md:flex"
      >
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-4/5" />
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="flex min-w-0 flex-1 flex-col gap-6 px-2 py-4 sm:px-3"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0" />
          <Skeleton className="h-9 w-full max-w-xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-16 items-center gap-3 px-4">
              <Skeleton className="size-5 shrink-0" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
