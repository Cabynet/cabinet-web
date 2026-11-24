"use client"

import React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNowStrict } from "date-fns"
import { Globe, Link as LinkIcon, LockSimple, ShareNetwork } from "@phosphor-icons/react"
import { AXIOS_INSTANCE } from "@/lib/api-client"
import { authClient } from "@/lib/auth-client"
import { folderRoles, type FolderRole } from "@/lib/folder-roles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select"

type Person = { name: string; email?: string | null; avatar?: string | null }
type Member = { userId: string; role: FolderRole; user: Person }
type Collaboration = {
  owner?: Person & { id: string }
  /** An older separate invite link is still on; it can only be turned off. */
  inviteEnabled: boolean
  members: Member[]
}
type Sharing = { shareToken: string | null; expiresAt?: string | null; role?: FolderRole }

const errorMessage = (error: any, fallback: string) =>
  typeof error?.response?.data?.error?.message === "string" ? error.response.data.error.message : fallback

function Initial({ person }: { person: Person }) {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-foreground">
      {(person.name || person.email || "?").trim().charAt(0).toUpperCase()}
    </span>
  )
}

function RoleSelect({ value, onChange, onRemove, disabled, label }: {
  value: FolderRole
  onChange: (role: FolderRole) => void
  onRemove?: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === "__remove__") onRemove?.()
        else onChange(next as FolderRole)
      }}
    >
      <SelectTrigger size="sm" aria-label={label} className="w-auto shrink-0 border-none bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {folderRoles.map((role) => (
            <SelectItem key={role.value} value={role.value} description={role.description}>{role.label}</SelectItem>
          ))}
        </SelectGroup>
        {onRemove && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectItem value="__remove__" className="text-destructive focus:text-destructive">Remove access</SelectItem>
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  )
}

const expiryChoices = [
  { value: "never", label: "Never" },
  { value: "1", label: "In 1 day" },
  { value: "7", label: "In 7 days" },
  { value: "30", label: "In 30 days" },
]

/** Inline "Never expires ▾" / "Expires in 6 days ▾" control; each choice counts from now. */
function ExpirySelect({ expiresAt, onChange, disabled, label }: {
  expiresAt?: string | null
  onChange: (days: number | null) => void
  disabled?: boolean
  label: string
}) {
  const current = expiresAt ? `Expires in ${formatDistanceToNowStrict(new Date(expiresAt))}` : "Never expires"
  return (
    // No item matches "", so the trigger always shows the current state as its placeholder.
    <Select value="" disabled={disabled} onValueChange={(value) => onChange(value === "never" ? null : Number(value))}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        title={expiresAt ? new Date(expiresAt).toLocaleString() : undefined}
        className="h-auto w-auto gap-0.5 rounded-sm border-none bg-transparent p-0 text-xs font-medium text-foreground shadow-none underline-offset-4 hover:underline data-[size=sm]:h-auto data-placeholder:text-foreground dark:bg-transparent dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-3"
      >
        <SelectValue placeholder={current} />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          <SelectLabel>Link expires</SelectLabel>
          {expiryChoices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function PersonRow({ person, you, children }: { person: Person; you?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex min-h-12 items-center gap-3">
      <Initial person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {person.name || person.email}
          {you && <span className="text-muted-foreground"> (you)</span>}
        </p>
        {person.email && person.name && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
      </div>
      {children}
    </li>
  )
}

function AccessRow({ icon, title, subline, action }: {
  icon: React.ReactNode
  title: React.ReactNode
  subline: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <li className="flex min-h-12 items-center gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-7 items-center text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{subline}</div>
      </div>
      {action}
    </li>
  )
}

/** Status text and its actions on one line, separated by quiet dots. */
function Actions({ children }: { children: React.ReactNode }) {
  const parts = React.Children.toArray(children).flatMap((child) =>
    React.isValidElement(child) && child.type === React.Fragment
      ? React.Children.toArray((child.props as { children?: React.ReactNode }).children)
      : [child]
  )
  return (
    <span className="flex flex-wrap items-center gap-x-1.5">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span aria-hidden="true">·</span>}
          {part}
        </React.Fragment>
      ))}
    </span>
  )
}

function TextAction({ children, onClick, disabled, label }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn("rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50")}
    >
      {children}
    </button>
  )
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(done)
  } catch {
    toast.error("Could not copy. Select the link and copy it manually.")
  }
}

/** What "Anyone with the link" grants at each role, in the dialog's words. */
const linkAccess: Record<FolderRole, string> = {
  VIEWER: "Anyone with the link can view, no sign-in needed",
  CONTRIBUTOR: "Anyone with the link can view; people who sign in can add items",
  EDITOR: "Anyone with the link can view; people who sign in can add and edit",
}

/**
 * One place to share a folder, modeled on Google Drive: people with their roles, then
 * General access (Restricted or Anyone with the link, with the link's role), and one Copy link.
 */
export function ShareFolderDialog({ folder }: { folder: { id: string; name: string } }) {
  const [open, setOpen] = React.useState(false)
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const endpoint = `/v1/folders/${folder.id}`
  const collaborationKey = [endpoint, "collaboration"]
  const shareKey = [`${endpoint}/share`]

  const collaboration = useQuery({
    queryKey: collaborationKey,
    enabled: open,
    queryFn: async ({ signal }) =>
      (await AXIOS_INSTANCE.get<Collaboration>(`${endpoint}/collaboration`, { signal })).data,
  })
  const sharing = useQuery({
    queryKey: shareKey,
    enabled: open,
    queryFn: async ({ signal }) => toSharing((await AXIOS_INSTANCE.get<Sharing>(`${endpoint}/share`, { signal })).data),
  })

  const [email, setEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState<FolderRole>("VIEWER")
  const [addError, setAddError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setEmail("")
      setAddError(null)
    }
  }, [open])

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: collaborationKey }),
    queryClient.invalidateQueries({ queryKey: ["/v1/folders"] }),
  ])

  const run = async (key: string, action: () => Promise<unknown>, failure: string) => {
    setBusy(key)
    try {
      await action()
      await refresh()
      return true
    } catch (error) {
      toast.error(errorMessage(error, failure))
      return false
    } finally {
      setBusy(null)
    }
  }

  const addPerson = async (event: React.FormEvent) => {
    event.preventDefault()
    const address = email.trim()
    if (!address) return
    setBusy("add")
    setAddError(null)
    try {
      await AXIOS_INSTANCE.post(`${endpoint}/members`, { email: address, role: newRole })
      await refresh()
      setEmail("")
      toast.success(`Shared with ${address}`)
    } catch (error) {
      setAddError(errorMessage(error, "Could not share with that person. Try again."))
    } finally {
      setBusy(null)
    }
  }

  const changeRole = (member: Member, role: FolderRole) =>
    run(`role-${member.userId}`, () => AXIOS_INSTANCE.patch(`${endpoint}/members/${member.userId}`, { role }), "Could not change access")

  const removePerson = async (member: Member) => {
    const name = member.user.name || member.user.email
    if (await run(`role-${member.userId}`, () => AXIOS_INSTANCE.delete(`${endpoint}/members/${member.userId}`), "Could not remove access")) {
      const linkLetsThemBack = !!sharing.data?.shareToken && sharing.data.role !== "VIEWER"
      toast.success(linkLetsThemBack ? `Removed ${name}. Anyone with the link can still join; set General access to Restricted to stop that.` : `Removed ${name}`)
    }
  }

  // Every link change goes through here so the dialog always shows the server's state.
  const updateLink = async (request: () => Promise<{ data: Sharing }>, failure: string, success?: string) => {
    setBusy("link")
    try {
      const response = await request()
      queryClient.setQueryData<Sharing>(shareKey, toSharing(response.data))
      await queryClient.invalidateQueries({ queryKey: ["/v1/folders"] })
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error, failure))
      // The link may have expired meanwhile.
      void sharing.refetch()
    } finally {
      setBusy(null)
    }
  }

  const setGeneralAccess = (anyone: boolean) => updateLink(
    () => anyone
      ? AXIOS_INSTANCE.post<Sharing>(`${endpoint}/share`, { role: "VIEWER" })
      : AXIOS_INSTANCE.delete<Sharing>(`${endpoint}/share`),
    "Could not change general access",
    anyone ? "Anyone with the link can now view this folder" : "Only people with access can open this folder now",
  )
  const changeLinkRole = (role: FolderRole) =>
    updateLink(() => AXIOS_INSTANCE.patch<Sharing>(`${endpoint}/share`, { role }), "Could not change what the link allows")
  const changeLinkExpiry = (days: number | null) =>
    updateLink(() => AXIOS_INSTANCE.patch<Sharing>(`${endpoint}/share`, { expiresInDays: days }), "Could not change when the link expires")

  const turnOffOldInvite = () =>
    run("invite", () => AXIOS_INSTANCE.delete(`${endpoint}/invitation`), "Could not turn off the old invite link")

  const data = collaboration.data
  const owner = data?.owner ?? { name: session?.user?.name || "You", email: session?.user?.email }
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const linkToken = sharing.data?.shareToken
  const linkRole: FolderRole = sharing.data?.role ?? "VIEWER"
  // Like Drive, there is always a link to copy: the public one, or the folder itself for people with access.
  const link = linkToken
    ? new URL(`/share/${linkToken}`, process.env.NEXT_PUBLIC_SITE_URL || origin || "http://localhost").href
    : `${origin}/cabinet/folders/${folder.id}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShareNetwork data-icon="inline-start" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-6 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">Share “{folder.name}”</DialogTitle>
          <DialogDescription className="text-xs">
            Links, notes, and drawings in this folder are shared. Subfolders stay private.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={addPerson} className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setAddError(null) }}
              placeholder="Add people by email"
              aria-label="Email address"
              aria-invalid={!!addError}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 text-base sm:h-9 md:text-sm"
            />
            {/* One row, one height: the field, its role, and the action line up. */}
            <>
                <Select value={newRole} onValueChange={(role) => setNewRole(role as FolderRole)}>
                  <SelectTrigger aria-label="Role for the new person" className="w-auto shrink-0 data-[size=default]:h-11 sm:data-[size=default]:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectGroup>
                      {folderRoles.map((role) => (
                        <SelectItem key={role.value} value={role.value} description={role.description}>{role.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={!email.trim() || busy === "add"} className="h-11 sm:h-9">
                  {busy === "add" && <Spinner />}Share
                </Button>
            </>
          </div>
          {addError && <p role="alert" className="text-xs text-destructive">{addError}</p>}
        </form>

        <section aria-labelledby="share-people" className="flex flex-col gap-2">
          <h3 id="share-people" className="text-xs font-medium text-muted-foreground">People with access</h3>
          {collaboration.isPending ? (
            <div role="status" aria-label="Loading people" className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
            </div>
          ) : collaboration.isError ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
              Could not load people with access.
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void collaboration.refetch()}>Try again</Button>
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              <PersonRow person={owner} you>
                <span className="px-2 text-sm text-muted-foreground">Owner</span>
              </PersonRow>
              {data!.members.map((member) => (
                <PersonRow key={member.userId} person={member.user}>
                  <RoleSelect
                    value={member.role ?? "CONTRIBUTOR"}
                    disabled={busy === `role-${member.userId}`}
                    label={`Access for ${member.user.name || member.user.email}`}
                    onChange={(role) => void changeRole(member, role)}
                    onRemove={() => void removePerson(member)}
                  />
                </PersonRow>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="share-general" className="flex flex-col gap-2">
          <h3 id="share-general" className="text-xs font-medium text-muted-foreground">General access</h3>
          <ul className="flex flex-col gap-1">
            <AccessRow
              icon={linkToken ? <Globe /> : <LockSimple />}
              title={
                sharing.isPending ? <Skeleton className="h-5 w-32" /> : (
                  <Select value={linkToken ? "anyone" : "restricted"} disabled={busy === "link" || sharing.isError} onValueChange={(value) => void setGeneralAccess(value === "anyone")}>
                    <SelectTrigger size="sm" aria-label="General access" className="-ml-2 h-7 w-auto border-none bg-transparent px-2 font-medium shadow-none hover:bg-muted dark:bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="restricted" description="Only people with access can open with the link">Restricted</SelectItem>
                        <SelectItem value="anyone" description="Anyone on the internet with the link can open it">Anyone with the link</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )
              }
              subline={
                sharing.isError ? "Could not load general access." : linkToken ? (
                  <Actions>
                    <span>{linkAccess[linkRole]}</span>
                    <ExpirySelect
                      expiresAt={sharing.data?.expiresAt}
                      disabled={busy === "link"}
                      label="When the link expires"
                      onChange={(days) => void changeLinkExpiry(days)}
                    />
                  </Actions>
                ) : "Only people with access can open with the link"
              }
              action={linkToken ? (
                <RoleSelect
                  value={linkRole}
                  label="Role for anyone with the link"
                  disabled={busy === "link"}
                  onChange={(role) => void changeLinkRole(role)}
                />
              ) : undefined}
            />
            {data?.inviteEnabled && (
              // Separate invite links came before General access; offer to retire any still on.
              <AccessRow
                icon={<LinkIcon />}
                title={<span className="font-medium">Older invite link</span>}
                subline={
                  <Actions>
                    <span>Still lets people join</span>
                    <TextAction onClick={() => void turnOffOldInvite()} disabled={busy === "invite"}>Turn off</TextAction>
                  </Actions>
                }
              />
            )}
          </ul>
        </section>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button variant="outline" disabled={sharing.isPending} onClick={() => void copy(link, linkToken ? "Link copied" : "Link copied. Only people with access can open it.")}>
            <LinkIcon data-icon="inline-start" />Copy link
          </Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toSharing(data: Sharing): Sharing {
  return { shareToken: data.shareToken, expiresAt: data.expiresAt ?? null, role: data.role ?? "VIEWER" }
}
