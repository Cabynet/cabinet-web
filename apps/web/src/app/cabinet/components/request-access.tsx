"use client"

import React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LockSimple } from "@phosphor-icons/react"
import { AXIOS_INSTANCE } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/sonner"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

/** Shown for a folder link the person can't open yet, like Google Drive's "You need access". */
export function RequestAccess({ folderId }: { folderId: string }) {
  const queryClient = useQueryClient()
  const endpoint = `/v1/folders/${folderId}/access-requests`
  const statusKey = [`${endpoint}/mine`]
  const status = useQuery({
    queryKey: statusKey,
    queryFn: async ({ signal }) => (await AXIOS_INSTANCE.get<{ requested: boolean }>(`${endpoint}/mine`, { signal })).data,
  })
  const [message, setMessage] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    setSending(true)
    try {
      await AXIOS_INSTANCE.post(endpoint, { message: message.trim() || null })
      queryClient.setQueryData(statusKey, { requested: true })
      setMessage("")
      toast.success("Request sent to the owner")
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Could not send the request. Try again.")
    } finally {
      setSending(false)
    }
  }

  const requested = status.data?.requested
  return (
    <Empty className="border border-border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><LockSimple /></EmptyMedia>
        <EmptyTitle>You need access</EmptyTitle>
        <EmptyDescription>
          {requested
            ? "Request sent. Once the owner approves, the folder appears under Shared with me."
            : "Ask the folder's owner for access, or switch to an account that has it."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {status.isPending ? <Spinner /> : (
          <form onSubmit={send} className="flex w-full max-w-sm flex-col gap-3">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              rows={3}
              aria-label="Message for the owner (optional)"
              placeholder="Message for the owner (optional)"
            />
            <Button type="submit" disabled={sending}>
              {sending && <Spinner data-icon="inline-start" />}
              {requested ? "Send again" : "Request access"}
            </Button>
          </form>
        )}
      </EmptyContent>
    </Empty>
  )
}
