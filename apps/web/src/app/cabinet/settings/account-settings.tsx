"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { GithubLogo, GoogleLogo, Trash } from "@phosphor-icons/react"
import { authClient } from "@/lib/auth-client"
import { toast } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const providers = [["github", "GitHub", GithubLogo], ["google", "Google", GoogleLogo]] as const

const settingsURL = (params = "") => `${window.location.origin}/cabinet/settings?tab=account${params}`

/** Signs in again with a provider and comes back to the account tab. */
async function signInAgain(provider: string, params = "") {
  const { error } = await authClient.signIn.social({ provider, callbackURL: settingsURL(params), errorCallbackURL: settingsURL() })
  if (error) toast.error(error.message || "Could not sign in again. Try again.")
}

export function DeleteAccount() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const [step, setStep] = React.useState<"closed" | "confirm" | "sign-in">("closed")
  const [typed, setTyped] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [formError, setFormError] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)
  const email = session?.user.email ?? ""
  const matches = !!email && typed.trim().toLowerCase() === email.toLowerCase()

  const open = React.useCallback(() => {
    setTyped("")
    setPassword("")
    setFormError("")
    // The server decides whether the sign-in is recent enough (SESSION_NOT_FRESH sends us to "sign-in").
    setStep("confirm")
  }, [])

  // Back from signing in again: pick up where the person left off.
  React.useEffect(() => {
    if (!session) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("delete") !== "1") return
    url.searchParams.delete("delete")
    window.history.replaceState(window.history.state, "", url)
    open()
  }, [session, open])

  const remove = async () => {
    if (!matches) return
    setDeleting(true)
    setFormError("")
    const { error } = await authClient.deleteUser({ currentPassword: password || undefined })
    if (!error) {
      queryClient.clear()
      toast.success("Your account and everything in it were deleted.")
      router.replace("/login")
      return
    }
    setDeleting(false)
    if (error.code === "SESSION_NOT_FRESH") setStep("sign-in")
    else setFormError(error.message || "Could not delete your account. Try again.")
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">Bookmarks, notes, drawings, folders and tags are deleted for good. Folders you share are removed for everyone in them. Export your bookmarks first if you want a copy.</p>
      <Button variant="destructive" className="w-fit" disabled={!session} onClick={open}><Trash data-icon="inline-start" />Delete account</Button>
      <Dialog open={step !== "closed"} onOpenChange={(value) => { if (!value && !deleting) setStep("closed") }}>
        <DialogContent className="sm:max-w-md">
          {step === "sign-in" ? (
            <>
              <DialogHeader>
                <DialogTitle>Sign in again to continue</DialogTitle>
                <DialogDescription>For your safety, Cabinet only deletes an account after a recent sign-in. You&apos;ll come back here to finish.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {providers.map(([provider, label, Icon]) => (
                  <Button key={provider} variant="outline" onClick={() => void signInAgain(provider, "&delete=1")}><Icon data-icon="inline-start" />Continue with {label}</Button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("closed")}>Cancel</Button>
              </DialogFooter>
            </>
          ) : (
            <form className="contents" onSubmit={(event) => { event.preventDefault(); void remove() }}>
              <DialogHeader>
                <DialogTitle>Delete your Cabinet account?</DialogTitle>
                <DialogDescription>This permanently deletes your library: every bookmark, note, drawing, highlight, folder and tag. Folders you share disappear for their members too. This can&apos;t be undone.</DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="delete-account-email">Type your email to confirm</FieldLabel>
                <Input id="delete-account-email" type="email" autoComplete="off" spellCheck={false} placeholder={email} value={typed} onChange={(event) => setTyped(event.target.value)} disabled={deleting} />
                <FieldDescription>{email}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="delete-account-password">Current password</FieldLabel>
                <Input id="delete-account-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={deleting} />
                <FieldDescription>Required if you sign in with a password. Leave it empty if you only use Google or GitHub.</FieldDescription>
              </Field>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={deleting} onClick={() => setStep("closed")}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={!matches || deleting}>{deleting ? <Spinner /> : <Trash data-icon="inline-start" />}Delete account</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
