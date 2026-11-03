"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function CabinetError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Your library is safe. Try again, and reload the page if it keeps happening.</p>
      <Button onClick={() => unstable_retry()}>Try again</Button>
    </main>
  )
}
