/** Routes remote preview images through the API to avoid hotlink and CORS blocks. */
export function getProxiedImageUrl(imageUrl?: string | null): string {
  if (!imageUrl) return ""
  if (imageUrl.startsWith("/") || imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")) {
    return imageUrl
  }
  // Cached thumbnails in R2 or CDNs have immutable public URLs
  if (
    imageUrl.includes(".r2.cloudflarestorage.com") ||
    imageUrl.includes(".r2.dev") ||
    /\/uploads\/[^/]+\/\d{4}-\d{2}\/[0-9a-f-]{36}-thumbnail\.webp$/.test(imageUrl)
  ) {
    return imageUrl
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
  // Invalidate previews cached before the Reddit share-image request fix.
  return `${apiBase}/v1/bookmarks/proxy-image?v=2&url=${encodeURIComponent(imageUrl)}`
}
