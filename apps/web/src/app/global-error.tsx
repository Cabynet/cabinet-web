"use client"

// Replaces the root layout, so it needs its own <html>/<body> and no app styles.
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", minHeight: "100dvh", placeItems: "center", textAlign: "center" }}>
        <div>
          <h1>Something went wrong</h1>
          <button onClick={() => unstable_retry()}>Try again</button>
        </div>
      </body>
    </html>
  )
}
