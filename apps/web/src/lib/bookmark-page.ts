/** The proxied page asks the app to load a clicked link; the proxy reports failures. */
export const PREVIEW_NAVIGATE_MESSAGE = "cabinet-preview-navigate"
export const PREVIEW_ERROR_MESSAGE = "cabinet-preview-error"
export const PREVIEW_READY_MESSAGE = "cabinet-preview-ready"

/** Sandbox for the proxied frame. Never allow-same-origin: the document sits on the API origin. */
export const PROXIED_FRAME_SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
export const DIRECT_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"

/** Converts a YouTube video link into its embed player URL, or null for any other address. */
export function getYouTubeEmbedUrl(pageUrl?: string | null): string | null {
  if (!pageUrl) return null
  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "")
  let id: string | null = null
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v")
    } else {
      const match = /^\/(?:shorts|live|embed)\/([^/?#]+)/.exec(url.pathname)
      id = match?.[1] ?? null
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null
}
