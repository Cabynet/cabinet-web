"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AXIOS_INSTANCE, isRateLimited } from "@/lib/api-client"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

type Activity = {
  tasks: { id: string; kind: string; status: string; totalItems: number; processedItems: number; failedItems: number; errorMessage: string | null }[]
  metadata: { id: string; title: string; status: string; error: string | null }[]
  page: number
  hasMore: boolean
}
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
  return <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
    <header className="flex flex-col gap-4">
      <nav aria-label="Cabinet"><Link href="/cabinet" className="text-sm underline underline-offset-4">Cabinet</Link></nav>
      <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Activity</h1><p className="mt-2 text-sm text-muted-foreground">Your imports, link checks, and link previews.</p></div><Button variant="outline" onClick={() => void activity.refetch()} disabled={activity.isFetching}>Refresh</Button></div>
    </header>
    {activity.isPending && <Skeleton className="h-32 w-full" aria-label="Loading activity" />}
    {activity.isError && <p role="alert">Activity could not be loaded. <Button variant="outline" onClick={() => void activity.refetch()}>Retry</Button></p>}
    {retry.isError && <p role="alert">Could not retry this preview. Refresh and try again.</p>}
    {activity.data && <>
      <section className="flex flex-col gap-4" aria-labelledby="tasks-heading"><h2 id="tasks-heading" className="text-base font-medium">Imports and link checks</h2>
        {!activity.data.tasks.length ? <Empty><EmptyHeader><EmptyTitle>No background tasks</EmptyTitle><EmptyDescription>Imports and link checks appear here after you start them.</EmptyDescription></EmptyHeader></Empty> : <ul className="flex flex-col divide-y divide-border">{activity.data.tasks.map((task) => <li key={task.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-medium">{task.kind === "IMPORT_HTML" ? "Bookmark import" : "Link check"}</p><p className="text-sm text-muted-foreground">{task.processedItems} of {task.totalItems} processed · {task.failedItems} failed</p>{task.errorMessage && <p className="text-sm">{task.errorMessage}</p>}</div><Badge variant="secondary">{task.status}</Badge></li>)}</ul>}
      </section>
      <section className="flex flex-col gap-4" aria-labelledby="previews-heading"><h2 id="previews-heading" className="text-base font-medium">Link previews</h2>
        {!activity.data.metadata.length ? <Empty><EmptyHeader><EmptyTitle>No link previews yet</EmptyTitle><EmptyDescription>Save a link to start extracting its preview.</EmptyDescription></EmptyHeader></Empty> : <ul className="flex flex-col divide-y divide-border">{activity.data.metadata.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="break-words font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.status}</p>{item.error && <p className="break-words text-sm">{item.error}</p>}</div>{item.status === "FAILED" && <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(item.id)}>Retry preview</Button>}</li>)}</ul>}
      </section>
      <nav aria-label="Activity pages" className="flex items-center justify-between gap-4"><Button variant="outline" disabled={page === 1 || activity.isFetching} onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="text-sm tabular-nums">Page {page}</span><Button variant="outline" disabled={!activity.data.hasMore || activity.isFetching} onClick={() => setPage((p) => p + 1)}>Next</Button></nav>
    </>}
    <Link href="/cabinet/operations" className="text-sm underline underline-offset-4">Operator measurements</Link>
  </main>
}
