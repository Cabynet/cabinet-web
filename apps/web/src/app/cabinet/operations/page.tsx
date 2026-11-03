"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowClockwise } from "@phosphor-icons/react"
import type { OperationsMetrics, LatencyMeasurement } from "@cabinet/api-client"
import { authClient } from "@/lib/auth-client"
import { AXIOS_INSTANCE, isRateLimited } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

const number = (value: number | null, unit = "") => value === null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`
function Latencies({ rows, label }: { rows: LatencyMeasurement[]; label: string }) {
  const p50 = (r: LatencyMeasurement) => r.p50Ms ?? null
  const p95 = (r: LatencyMeasurement) => r.p95Ms ?? null
  const max = (r: LatencyMeasurement) => r.maxMs ?? null
  return rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={label}>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-3 pr-4 font-normal">{label === "API latency" ? "Route" : "Query group"}</th>
            <th className="px-2 text-right font-normal">Requests</th>
            <th className="px-2 text-right font-normal">p50</th>
            <th className="px-2 text-right font-normal">p95</th>
            <th className="pl-2 text-right font-normal">Max</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice().sort((a, b) => (p95(b) ?? 0) - (p95(a) ?? 0)).map((row) => (
            <tr key={row.name} className="border-t border-border/60">
              <th scope="row" className="max-w-64 break-words py-3 pr-4 text-left font-normal">{row.name}</th>
              <td className="px-2 text-right tabular-nums">{row.count.toLocaleString()}</td>
              <td className="whitespace-nowrap px-2 text-right tabular-nums">{number(p50(row), " ms")}</td>
              <td className="whitespace-nowrap px-2 text-right tabular-nums">{number(p95(row), " ms")}</td>
              <td className="whitespace-nowrap pl-2 text-right tabular-nums">{number(max(row), " ms")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No measurements yet</EmptyTitle>
        <EmptyDescription>Measurements appear after this API process receives requests.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
export default function OperationsPage() {
  const { data: session } = authClient.useSession()
  const access = useQuery({ queryKey: ["operations-access", session?.user.id], enabled: !!session?.user.id, queryFn: async () => (await AXIOS_INSTANCE.get("/v1/operations/access")).data as { enabled: boolean } })
  const metrics = useQuery({ queryKey: ["operations-metrics", session?.user.id], enabled: !!access.data?.enabled, queryFn: async (): Promise<OperationsMetrics> => (await AXIOS_INSTANCE.get("/v1/operations/metrics")).data, refetchInterval: () => (isRateLimited() ? false : 5000) })
  const data = metrics.data
  return <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
    <header className="flex flex-col gap-5"><Link href="/cabinet" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft />Cabinet</Link><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex flex-col gap-2"><h1 className="text-2xl font-semibold tracking-tight">Server measurements</h1><p className="text-sm text-muted-foreground">This API process, measured live. Operator access only.</p></div><Button variant="outline" disabled={!access.data?.enabled || metrics.isFetching} onClick={() => void metrics.refetch()}><ArrowClockwise data-icon="inline-start" />Refresh</Button></div></header>
    {access.isError ? <Alert><AlertTitle>Could not check operator access</AlertTitle><AlertDescription><Button variant="outline" size="sm" onClick={() => void access.refetch()}>Try again</Button></AlertDescription></Alert> : access.data && !access.data.enabled ? <Alert><AlertTitle>Operator access required</AlertTitle><AlertDescription>Ask the server administrator to configure OPERATIONS_USER_IDS. No server measurements are exposed to other accounts.</AlertDescription></Alert> : metrics.isError ? <Alert><AlertTitle>Measurements are unavailable</AlertTitle><AlertDescription>Last good measurements are retained in this page. <Button variant="outline" size="sm" onClick={() => void metrics.refetch()}>Retry</Button></AlertDescription></Alert> : !data ? <div role="status" aria-label="Loading measurements" className="flex flex-col gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div> : null}
    {data && <>
      <section aria-labelledby="runtime-title" className="flex flex-col gap-4">
        <h2 id="runtime-title" className="text-base font-medium">Runtime</h2>
        <dl className="grid grid-cols-2 gap-6 rounded-lg bg-muted/40 p-5 sm:grid-cols-4">
          {[
            ["Resident memory", number(data.rssBytes === null ? null : data.rssBytes / 1048576, " MiB")],
            ["Uptime", number(Math.floor(data.uptimeSeconds / 60), " min")],
          ].map(([title, value]) => (
            <div key={title} className="flex flex-col gap-2">
              <dt className="text-sm text-muted-foreground">{title}</dt>
              <dd className="text-xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">Refreshes every 5 seconds. Unavailable platform measurements are shown as —.</p>
      </section>
      <section aria-labelledby="api-latency-title" className="flex flex-col gap-3"><h2 id="api-latency-title" className="text-base font-medium">API latency</h2><p className="text-sm text-muted-foreground">Slowest p95 first. Request paths and personal query parameters are not retained.</p><Latencies rows={data.routes} label="API latency" /></section>
      <section aria-labelledby="queue-title" className="flex flex-col gap-4"><h2 id="queue-title" className="text-base font-medium">Background work · all accounts</h2><div className="grid gap-5 sm:grid-cols-2">{[["Imports & link checks", data.tasks], ["Metadata", data.metadata]].map(([title, counts]) => <div key={String(title)} className="flex flex-col gap-3"><h3 className="text-sm font-medium">{String(title)}</h3><dl className="flex flex-col gap-2">{["PENDING", title === "Metadata" ? "PROCESSING" : "RUNNING", "FAILED", "COMPLETED"].map((status) => <div key={status} className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">{{ PENDING: "Waiting", RUNNING: "Running", PROCESSING: "Running", FAILED: "Failed", COMPLETED: "Complete" }[status]}</dt><dd className="tabular-nums">{((counts as Record<string, number>)[status] || 0).toLocaleString()}</dd></div>)}</dl></div>)}</div></section>
      <p className="text-sm leading-6 text-muted-foreground">{data.sampling} Measurements are process-local, not a fleet-wide monitoring service. Resident memory includes native allocations.</p>
    </>}
  </main>
}
