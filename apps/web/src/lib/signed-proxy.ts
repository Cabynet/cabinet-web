import { useEffect, useState } from "react"

const MAX_BATCH = 100
const apiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

/** The URL if the browser can load it directly, "" for no URL, or null when it must go through the signed proxy. */
export function directImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl) return ""
  if (imageUrl.startsWith("/") || imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")) return imageUrl
  // Cached thumbnails in R2 or CDNs have immutable public URLs
  if (
    imageUrl.includes(".r2.cloudflarestorage.com") ||
    imageUrl.includes(".r2.dev") ||
    /\/uploads\/[^/]+\/\d{4}-\d{2}\/[0-9a-f-]{36}-thumbnail\.webp$/.test(imageUrl)
  ) return imageUrl
  return null
}

type Waiter = { resolve: (signed: string) => void; reject: (error: Error) => void }
type Batch = { waiters: Map<string, Waiter[]> }
// Signatures never expire, so a signed URL is cached for the page's lifetime.
const cache = new Map<string, Promise<string>>()
const batches = new Map<string, Batch>()

/** Hook point for the page proxy: one more `kind` value, sent to the API as-is. */
type Options = { shareToken?: string; kind?: "image" | "page" }

async function flush(key: string, { shareToken, kind }: Options) {
  const batch = batches.get(key)
  batches.delete(key)
  if (!batch) return
  const urls = [...batch.waiters.keys()]
  for (let i = 0; i < urls.length; i += MAX_BATCH) {
    const chunk = urls.slice(i, i + MAX_BATCH)
    const settle = (fn: (waiter: Waiter) => void) => chunk.forEach((url) => batch.waiters.get(url)?.forEach(fn))
    try {
      const response = await fetch(`${apiBase()}/v1/bookmarks/proxy-image/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ urls: chunk, ...(shareToken && { shareToken }), ...(kind === "page" && { kind }) }),
      })
      if (!response.ok) throw new Error(`Signing failed (${response.status})`)
      const { items } = await response.json() as { items: Array<{ url: string; signedUrl: string }> }
      const signed = new Map(items.map((item) => [item.url, item.signedUrl]))
      for (const url of chunk) {
        const signedUrl = signed.get(url)
        const waiters = batch.waiters.get(url) ?? []
        // Dropped by the API (e.g. not in the shared folder): fail so the caller shows nothing.
        if (signedUrl) waiters.forEach((w) => w.resolve(signedUrl.startsWith("/") ? `${apiBase()}${signedUrl}` : signedUrl))
        else waiters.forEach((w) => w.reject(new Error("URL cannot be signed")))
      }
    } catch (error) {
      settle((w) => w.reject(error instanceof Error ? error : new Error("Signing failed")))
    }
  }
}

/** Signs one URL; calls made in the same tick share a single request (≤100 URLs each). */
export function signProxyUrl(url: string, options: Options = {}): Promise<string> {
  const cacheKey = `${options.kind ?? "image"}|${options.shareToken ?? ""}|${url}`
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const batchKey = `${options.kind ?? "image"}|${options.shareToken ?? ""}`
  const promise = new Promise<string>((resolve, reject) => {
    let batch = batches.get(batchKey)
    if (!batch) {
      batch = { waiters: new Map() }
      batches.set(batchKey, batch)
      setTimeout(() => void flush(batchKey, options), 10)
    }
    batch.waiters.set(url, [...(batch.waiters.get(url) ?? []), { resolve, reject }])
  })
  cache.set(cacheKey, promise)
  // Let a later render retry instead of caching the failure.
  promise.catch(() => cache.delete(cacheKey))
  return promise
}

function useSignedUrl(url: string | null | undefined, enabled: boolean, options: Options): string {
  const [signed, setSigned] = useState<{ url: string; src: string } | null>(null)
  const { shareToken, kind } = options
  useEffect(() => {
    if (!enabled || !url) return
    let active = true
    signProxyUrl(url, { shareToken, kind }).then((src) => active && setSigned({ url, src }), () => {})
    return () => { active = false }
  }, [enabled, url, shareToken, kind])
  return signed && signed.url === url ? signed.src : ""
}

/** Direct URL, signed proxy URL, or "" while signing or when it cannot be signed (never a broken link). */
export function useProxiedImageUrl(imageUrl?: string | null, options: Options = {}): string {
  const direct = directImageUrl(imageUrl)
  const signed = useSignedUrl(imageUrl, direct === null, { ...options, kind: "image" })
  return direct ?? signed
}

/** Signed URL that serves a page the browser refuses to frame, or "" until signed. Pass null to skip. */
export function useProxiedPageUrl(pageUrl: string | null): string {
  const signed = useSignedUrl(pageUrl, !!pageUrl, { kind: "page" })
  return signed ? `${signed}&v=4` : ""
}
