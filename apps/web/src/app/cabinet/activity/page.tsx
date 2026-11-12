"use client"

import { ArrowClockwise } from "@phosphor-icons/react"
import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AXIOS_INSTANCE, isRateLimited } from "@/lib/api-client"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { PageHeader, PageShell } from "@/components/page-header"

type Activity = {
  tasks: { id: string; kind: string; status: string; totalItems: number; processedItems: number; failedItems: number; errorMessage: string | null }[]
  metadata: { id: string; title: string; status: string; error: string | null }[]
  page: number
  hasMore: boolean
}
const STATUS: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  PENDING: { label: "Waiting", variant: "outline" },
  RUNNING: { label: "Running", variant: "secondary" },
  PROCESSING: { label: "Running", variant: "secondary" },
  COMPLETED: { label: "Done", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
}
const statusLabel = (status: string) =>
  STATUS[status] ?? { label: status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " "), variant: "outline" as const }

export default function ActivityPage() {
  const { data: session } = authClient.useSession()
  const [page, setPage] = useState(1)
  const activity = useQuery({
    queryKey: ["activity", session?.user.id, page], enabled: !!session?.user.id,
    queryFn: async ({ signal }): Promise<Activity> => (await AXIOS_INSTANCE.get("/v1/activity", { params: { page }, signal })).data,
    refetchInterval: (query) =>
      isRateLimited()
        ? false
        : query.state.data?.metadata.some((m) => ["PENDING", "PROCESSING"].includes(m.status)) ||
          query.state.data?.tasks.some((t) => ["PENDING", "RUNNING"].includes(t.status))
        ? 3000
        : 30000,
  })
  const retry = useMutation({ mutationFn: async (id: string) => AXIOS_INSTANCE.post(`/v1/activity/metadata/${id}/retry`), onSuccess: () => activity.refetch() })
  const tasks = activity.data?.tasks ?? []
  const metadata = activity.data?.metadata ?? []
  return <PageShell>
    <PageHeader title="Activity" description="Your imports, link checks, and link previews." actions={<Button variant="outline" onClick={() => void activity.refetch()} disabled={activity.isFetching}><ArrowClockwise data-icon="inline-start" />Refresh</Button>} />
    {activity.isPending && <Skeleton className="h-32 w-full" aria-label="Loading activity" />}
    {activity.isError && <Alert><AlertTitle>Activity could not be loaded</AlertTitle><AlertDescription><Button variant="outline" size="sm" onClick={() => void activity.refetch()}>Try again</Button></AlertDescription></Alert>}
    {retry.isError && <Alert><AlertTitle>Could not retry this preview</AlertTitle><AlertDescription>Refresh and try again.</AlertDescription></Alert>}
    {activity.data && <>
      <section className="flex flex-col gap-3" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className="text-base font-medium">Imports and link checks</h2>
        {!tasks.length ? <Empty className="border border-dashed"><EmptyHeader><EmptyTitle>No background tasks</EmptyTitle><EmptyDescription>Imports and link checks appear here after you start them.</EmptyDescription></EmptyHeader></Empty> : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border bg-card">
            {tasks.map((task) => {
              const status = statusLabel(task.status)
              const percent = task.totalItems ? Math.round((task.processedItems / task.totalItems) * 100) : 0
              const active = task.status === "PENDING" || task.status === "RUNNING"
              return <li key={task.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-medium">{task.kind === "IMPORT_HTML" ? "Bookmark import" : "Link check"}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {task.processedItems.toLocaleString()} of {task.totalItems.toLocaleString()} processed
                      {task.failedItems > 0 && <> · <span className="text-destructive">{task.failedItems.toLocaleString()} failed</span></>}
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                {active && <div role="progressbar" aria-label={`${task.kind === "IMPORT_HTML" ? "Import" : "Link check"} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} /></div>}
                {task.errorMessage && <p className="text-sm text-destructive">{task.errorMessage}</p>}
              </li>
            })}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="previews-heading">
        <h2 id="previews-heading" className="text-base font-medium">Link previews</h2>
        {!metadata.length ? <Empty className="border border-dashed"><EmptyHeader><EmptyTitle>No link previews yet</EmptyTitle><EmptyDescription>Save a link to start extracting its preview.</EmptyDescription></EmptyHeader></Empty> : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border bg-card">
            {metadata.map((item) => {
              const status = statusLabel(item.status)
              return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="break-words font-medium">{item.title}</p>
                  {item.error && <p className="break-words text-sm text-muted-foreground">{item.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {item.status === "FAILED" && <Button variant="outline" size="sm" disabled={retry.isPending} onClick={() => retry.mutate(item.id)}>Retry preview</Button>}
                </div>
              </li>
            })}
          </ul>
        )}
      </section>
      {(page > 1 || activity.data.hasMore) && <nav aria-label="Activity pages" className="flex items-center justify-between gap-4"><Button variant="outline" disabled={page === 1 || activity.isFetching} onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="text-sm tabular-nums text-muted-foreground">Page {page}</span><Button variant="outline" disabled={!activity.data.hasMore || activity.isFetching} onClick={() => setPage((p) => p + 1)}>Next</Button></nav>}
    </>}
  </PageShell>
}
