import type { PDFDocumentLoadingTask } from "pdfjs-dist"
import { signProxyUrl } from "./signed-proxy"

/** True for URLs the browser can fetch itself without the proxy. */
function isLocalPdfUrl(url: string): boolean {
  if (!url || url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return true
  try {
    return typeof window !== "undefined" && new URL(url).origin === window.location.origin
  } catch {
    return true
  }
}

/**
 * Loads a PDF document with PDF.js.
 * Cloudflare R2 public buckets and most third-party sites forbid cross-origin fetch
 * from the browser; requests to those domains or those that fail with CORS are routed
 * through Cabinet's backend proxy.
 */
export async function loadPdfDocument(url: string, signal?: AbortSignal): Promise<PDFDocumentLoadingTask> {
  signal?.throwIfAborted()
  const pdfjs = await import("pdfjs-dist")
  signal?.throwIfAborted()
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

  const hostname = new URL(url, window.location.href).hostname
  const proxyFirst = hostname.endsWith(".r2.dev") || hostname.endsWith(".r2.cloudflarestorage.com")
  // Signed lazily so a PDF that loads directly never costs a signing request.
  let proxied: string | null = null
  const proxiedSource = async () => (proxied ??= await signProxyUrl(url).catch(() => url))
  const sources: Array<() => Promise<string>> = isLocalPdfUrl(url)
    ? [async () => url]
    : proxyFirst ? [proxiedSource, async () => url] : [async () => url, proxiedSource]
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    let transient = false
    const tried = new Set<string>()
    for (const resolveSource of sources) {
      signal?.throwIfAborted()
      const source = await resolveSource()
      signal?.throwIfAborted()
      if (tried.has(source)) continue
      tried.add(source)
      // Use the user's API quota without sending session cookies to external PDF hosts.
      const task = pdfjs.getDocument({ url: source, withCredentials: source === proxied && source !== url })
      let rejectAbort: (reason: unknown) => void = () => {}
      const aborted = new Promise<never>((_, reject) => { rejectAbort = reject })
      const abort = () => { rejectAbort(signal?.reason); void task.destroy().catch(() => {}) }
      signal?.addEventListener("abort", abort, { once: true })
      try {
        // PDF.js can leave task.promise pending when destroyed during its initial fetch.
        await Promise.race([task.promise, aborted])
        signal?.throwIfAborted()
        return task
      } catch (error) {
        await task.destroy().catch(() => {})
        signal?.throwIfAborted()
        lastError = error
        const failure = error as { name?: string; status?: number }
        transient ||= failure.name === "UnknownErrorException" || failure.name === "TypeError" ||
          failure.status === 0 || failure.status === 408 || failure.status === 429 || (failure.status ?? 0) >= 500
      } finally {
        signal?.removeEventListener("abort", abort)
      }
    }
    if (!transient || attempt === 1) break
    // Retry temporary network/proxy failures once, not malformed or missing PDFs.
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw lastError
}

/** Keep only a small rendered first page in the query cache, not a live PDF worker. */
export async function renderPdfThumbnail(url: string, signal: AbortSignal) {
  const task = await loadPdfDocument(url, signal)
  try {
    signal.throwIfAborted()
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const size = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(1.5, 640 / size.width, 960 / size.height) })
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas is unavailable")
    signal.throwIfAborted()
    const rendering = page.render({ canvas, canvasContext: context, viewport })
    const abort = () => rendering.cancel()
    signal.addEventListener("abort", abort, { once: true })
    try {
      await rendering.promise
      signal.throwIfAborted()
      return { src: canvas.toDataURL("image/webp", 0.85), ratio: size.width / size.height }
    } finally {
      signal.removeEventListener("abort", abort)
    }
  } finally {
    await task.destroy()
  }
}
