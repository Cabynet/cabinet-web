export type SharedBookmark = {
  id: string
  url: string
  title: string
  description: string | null
  imageUrl: string | null
}

export type SharedCollection = { name: string; bookmarks: SharedBookmark[] }

export function safeHttpUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { href: parsed.href, hostname: parsed.hostname.replace(/^www\./, "") }
    }
  } catch {}
  return null
}

export function sharedCollectionItems(bookmarks: SharedBookmark[]) {
  return bookmarks.flatMap((bookmark) => {
    const safe = safeHttpUrl(bookmark.url)
    if (!safe) return []
    const image = bookmark.imageUrl ? safeHttpUrl(bookmark.imageUrl) : null
    return [{
      ...bookmark,
      ...safe,
      // Raw image URL; the page signs it for the proxy with the share token (see useProxiedImageUrl).
      preview: image ? image.href : null,
      searchText: `${bookmark.title} ${bookmark.description || ""} ${safe.href} ${safe.hostname}`.toLowerCase(),
    }]
  })
}

export type SharedCollectionItem = ReturnType<typeof sharedCollectionItems>[number]
