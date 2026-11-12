import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "@phosphor-icons/react/ssr"
import { cn } from "@/lib/utils"

/** Shared frame for full-page screens outside the library (Settings, Activity, Integrations…). */
export function PageShell({ children, wide = false, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <main className={cn("mx-auto flex min-h-dvh w-full flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10", wide ? "max-w-6xl" : "max-w-5xl", className)}>
      {children}
    </main>
  )
}

export function PageHeader({ title, description, actions, backHref = "/cabinet", backLabel = "Back to Cabinet" }: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <header className="flex flex-col gap-6">
      <Link href={backHref} className="-ml-1 inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <ArrowLeft aria-hidden="true" />{backLabel}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}
