"use client"

import * as React from "react"
import { ArrowSquareOut, Copy, FolderSimple, List, MagnifyingGlass, SignIn, SquaresFour, UsersThree, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty"
import { Masonry, MasonryItem } from "@/components/ui/masonry"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { SharedCollectionItem, SharedLinkRole } from "@/lib/shared-collection"
import { useProxiedImageUrl } from "@/lib/signed-proxy"

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

type Viewer = "unknown" | "guest" | "member"

// One session check per page, shared by the header and the save button.
let viewerRequest: Promise<Viewer> | null = null
function loadViewer(): Promise<Viewer> {
  viewerRequest ??= fetch(`${apiUrl}/v1/auth/me`, { credentials: "include" })
    .then(async (response) => {
      if (!response.ok) return "guest" as const
      const user = await response.json().catch(() => null) as { id?: unknown } | null
      return typeof user?.id === "string" ? "member" as const : "guest" as const
    })
    // If the check fails, keep the button that discovers sign-in on click.
    .catch(() => "unknown" as const)
  return viewerRequest
}

function useViewer() {
  const [viewer, setViewer] = React.useState<Viewer>("unknown")
  React.useEffect(() => {
    let active = true
    void loadViewer().then((value) => { if (active) setViewer(value) })
    return () => { active = false }
  }, [])
  return viewer
}

/** Login returns here with ?save=1 or ?join=1 so the action finishes without a second click. */
const afterLogin = (token: string, action: "save" | "join") => `/login?next=${encodeURIComponent(`/share/${token}?${action}=1`)}`

const joinLabel: Record<Exclude<SharedLinkRole, "VIEWER">, { action: string; hint: string }> = {
  CONTRIBUTOR: { action: "Join to add items", hint: "You'll join as a contributor and see this folder in your Cabinet." },
  EDITOR: { action: "Join to edit", hint: "You'll join as an editor and see this folder in your Cabinet." },
}

/** Header link: sign in for visitors, back to the library for members. */
export function SharedCollectionAccount({ token }: { token: string }) {
  const viewer = useViewer()
  if (viewer === "member") return <Button asChild variant="ghost" size="sm"><a href="/cabinet">Open my Cabinet</a></Button>
  if (viewer === "guest") return <Button asChild variant="ghost" size="sm"><a href={`/login?next=${encodeURIComponent(`/share/${token}`)}`}>Sign in</a></Button>
  return null
}

function SharedBookmarkLink({ item, view, token }: { item: SharedCollectionItem; view: "grid" | "list"; token: string }) {
  const [imageFailed, setImageFailed] = React.useState(false)
  const preview = useProxiedImageUrl(view === "grid" ? item.preview : null, { shareToken: token })
  return (
    <a href={item.href} target="_blank" rel="noopener noreferrer"
      className={cn(
        "group flex w-full border-border bg-card text-card-foreground transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-4",
        view === "grid" ? "flex-col overflow-hidden rounded-lg border" : "items-start gap-4 py-4 sm:items-center",
      )}
    >
      {preview && !imageFailed && (
        <div className="overflow-hidden border-b border-border bg-muted/40">
          <img src={preview} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)}
            className="block max-h-80 w-full object-cover" />
        </div>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2", view === "grid" && "p-4")}>
        <h2 className="break-words text-sm leading-snug font-semibold group-hover:underline">{item.title || item.hostname}</h2>
        {item.description && <p className={cn("break-words text-xs leading-relaxed text-muted-foreground", view === "grid" ? "line-clamp-3" : "line-clamp-2")}>{item.description}</p>}
        {view === "list" && <span className="truncate text-xs text-muted-foreground">{item.hostname}</span>}
      </div>
      <div className={cn("flex shrink-0 items-center gap-2 text-muted-foreground", view === "grid" && "justify-between border-t border-border px-4 py-2.5")}>
        {view === "grid" && <span className="min-w-0 truncate text-xs">{item.hostname}</span>}
        <ArrowSquareOut className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">Opens in a new tab</span>
      </div>
    </a>
  )
}

export function SharedCollectionBrowser({ token, items, role = "VIEWER" }: { token: string; items: SharedCollectionItem[]; role?: SharedLinkRole }) {
  const [query, setQuery] = React.useState("")
  const [view, setView] = React.useState<"grid" | "list">("grid")
  const [columns, setColumns] = React.useState(1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const copyInFlight = React.useRef(false)
  const [isCopying, setIsCopying] = React.useState(false)
  const [copyError, setCopyError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState<{ folderId: string; count: number } | null>(null)
  const search = query.trim().toLowerCase()
  const filtered = React.useMemo(() => items.filter((item) => item.searchText.includes(search)), [items, search])
  const total = items.length
  const shown = filtered.length
  const viewer = useViewer()
  const autoAction = React.useRef(false)
  const joins = role !== "VIEWER" ? joinLabel[role] : null
  const [isJoining, setIsJoining] = React.useState(false)
  const [joinError, setJoinError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const resize = () => setColumns(Math.max(1, Math.min(3, Math.floor((container.clientWidth + 16) / 280))))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  async function copyCollection() {
    if (copyInFlight.current || copied) return
    copyInFlight.current = true
    setIsCopying(true)
    setCopyError(null)
    try {
      const response = await fetch(`${apiUrl}/v1/share/${token}/copy`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      })
      if (response.status === 401) {
        window.location.assign(afterLogin(token, "save"))
        return
      }
      if (response.status === 404) throw new Error("This collection is no longer shared. Reload the page to check its availability.")
      if (!response.ok) throw new Error("Could not copy this collection. Please try again.")
      const payload = await response.json() as { folderId: string; copied: number }
      const data = { folderId: payload.folderId, copied: payload.copied }
      if (!data || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.folderId) || !Number.isInteger(data.copied) || data.copied < 0) throw new Error("Could not confirm the copied collection. Please reload your Cabinet.")
      setCopied({ folderId: data.folderId, count: data.copied })
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : "Could not copy this collection. Please try again.")
    } finally {
      copyInFlight.current = false
      setIsCopying(false)
    }
  }

  async function joinFolder() {
    if (isJoining) return
    setIsJoining(true)
    setJoinError(null)
    try {
      const response = await fetch(`${apiUrl}/v1/share/${token}/join`, { method: "POST", credentials: "include" })
      if (response.status === 401) {
        window.location.assign(afterLogin(token, "join"))
        return
      }
      if (response.status === 404) throw new Error("This link no longer works. Ask the owner for a new one.")
      if (!response.ok) throw new Error("Could not join this folder. Please try again.")
      const { folderId } = await response.json() as { folderId?: unknown }
      if (typeof folderId !== "string" || !/^[a-f0-9-]{36}$/i.test(folderId)) throw new Error("Could not open the folder. Please reload your Cabinet.")
      // A full navigation gives Cabinet a fresh query cache that includes the joined folder.
      window.location.assign(`/cabinet/folders/${folderId}`)
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Could not join this folder. Please try again.")
      setIsJoining(false)
    }
  }

  // Back from sign-in with ?save=1 or ?join=1: drop the flag and finish what the visitor asked for.
  React.useEffect(() => {
    if (viewer === "unknown" || autoAction.current) return
    const url = new URL(window.location.href)
    const action = url.searchParams.get("save") === "1" ? "save" : url.searchParams.get("join") === "1" ? "join" : null
    if (!action) return
    autoAction.current = true
    url.searchParams.delete(action)
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
    if (viewer !== "member") return
    if (action === "join" && joins) void joinFolder()
    if (action === "save" && !joins) void copyCollection()
  })

  return (
    <section ref={containerRef} className="flex flex-1 flex-col gap-6 py-6 sm:py-8" aria-label="Shared bookmarks">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap">
        <div className="flex w-full min-w-0 flex-1 items-center gap-3 sm:w-auto">
          <InputGroup className="h-9 min-w-0 flex-1 sm:w-72 sm:flex-initial">
            <InputGroupAddon><MagnifyingGlass /></InputGroupAddon>
            <InputGroupInput type="search" aria-label="Search this collection" placeholder="Search this collection…" value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <InputGroupAddon align="inline-end"><Button variant="ghost" size="icon-xs" onClick={() => setQuery("")} aria-label="Clear search"><X /></Button></InputGroupAddon>}
          </InputGroup>
          <ToggleGroup type="single" variant="outline" spacing={0} size="lg" value={view} aria-label="Collection view"
            onValueChange={(value) => { if (value === "grid" || value === "list") setView(value) }}>
            <ToggleGroupItem value="grid" aria-label="Grid view"><SquaresFour /><span className="sr-only">Grid</span></ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view"><List /><span className="sr-only">List</span></ToggleGroupItem>
          </ToggleGroup>
        </div>
        {joins ? (
          <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
            {viewer === "guest" ? (
              <Button asChild><a href={afterLogin(token, "join")}><SignIn data-icon="inline-start" />Sign in to join</a></Button>
            ) : (
              <Button onClick={joinFolder} disabled={isJoining} aria-busy={isJoining}>
                {isJoining ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <UsersThree data-icon="inline-start" />}
                {isJoining ? "Joining…" : joins.action}
              </Button>
            )}
            {joinError && <p role="alert" className="max-w-sm text-xs text-destructive">{joinError}</p>}
            <p className="max-w-sm text-xs text-muted-foreground sm:text-right">
              {viewer === "guest" ? `Free with GitHub or Google. ${joins.hint}` : joins.hint}
            </p>
          </div>
        ) : (
        <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
          {copied ? (
            // A full navigation gives Cabinet a fresh query cache after copying.
            <Button asChild><a href={`/cabinet?folder=${copied.folderId}`}>Open copied collection<ArrowSquareOut data-icon="inline-end" /></a></Button>
          ) : viewer === "guest" ? (
            <Button asChild><a href={afterLogin(token, "save")}><SignIn data-icon="inline-start" />Sign in to save</a></Button>
          ) : (
            <Button onClick={copyCollection} disabled={isCopying} aria-busy={isCopying}>
              {isCopying ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" />}
              {isCopying ? "Copying…" : "Copy Collection"}
            </Button>
          )}
          {copyError && <p role="alert" className="max-w-sm text-xs text-destructive">{copyError}</p>}
          <p className="text-xs text-muted-foreground" role={copied ? "status" : undefined}>
            {copied
              ? `${copied.count} ${copied.count === 1 ? "item" : "items"} copied to your Cabinet.`
              : viewer === "guest"
                ? `Free with GitHub or Google. Saves all ${total} ${total === 1 ? "item" : "items"} as a private copy.`
                : `Save all ${total} ${total === 1 ? "item" : "items"} as a private copy.`}
          </p>
        </div>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {search ? `${shown} of ${total}` : total} item{(search ? shown : total) === 1 ? "" : "s"}
      </p>
      {!shown ? (
        <Empty className="border border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FolderSimple /></EmptyMedia>
            <EmptyTitle>{total ? "Nothing matches" : "This collection is empty"}</EmptyTitle>
            <EmptyDescription>{total ? "Try a different title, description, or website." : "Links and files added directly to this folder will appear here."}</EmptyDescription>
          </EmptyHeader>
          {search && <Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>}
        </Empty>
      ) : view === "grid" ? (
        <Masonry columnCount={columns} gap={16} linear virtualize={false} role="list" aria-label="Bookmarks" data-view="grid">
          {filtered.map((item) => <MasonryItem key={item.id} role="listitem"><SharedBookmarkLink item={item} view="grid" token={token} /></MasonryItem>)}
        </Masonry>
      ) : (
        <ul aria-label="Bookmarks" data-view="list" className="flex flex-col divide-y divide-border">
          {filtered.map((item) => <li key={item.id}><SharedBookmarkLink item={item} view="list" token={token} /></li>)}
        </ul>
      )}
    </section>
  )
}
