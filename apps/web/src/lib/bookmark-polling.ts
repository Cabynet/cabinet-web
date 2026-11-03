import type { BookmarkListResponseDto, BookmarkPreviewDto } from "@cabinet/api-client"
import type { InfiniteData } from "@tanstack/react-query"

type Pages = InfiniteData<BookmarkListResponseDto>
export function pendingBookmarkIds(data: Pages | undefined): string[] {
  const ids = new Set<string>()
  for (const page of data?.pages ?? []) {
    for (const item of page.items) {
      if (item.metadataStatus === "PENDING" || item.metadataStatus === "PROCESSING") ids.add(item.id)
      if (ids.size === 100) return [...ids]
    }
  }
  return [...ids]
}
export function mergeBookmarkPage(page: BookmarkListResponseDto | undefined, updates: readonly BookmarkPreviewDto[]) {
  // The ['/v1/bookmarks'] prefix also matches search caches, which have no items array.
  if (!page || !Array.isArray(page.items)) return page
  const byId = new Map(updates.map((item) => [item.id, item]))
  return {
    ...page,
    items: page.items.map((item) => {
      const update = byId.get(item.id)
      if (!update || update.rawUrl !== item.rawUrl || Date.parse(update.updatedAt) < Date.parse(item.updatedAt)) return item
      return { ...item, ...update }
    }),
  }
}
export function mergeBookmarkPreviews(data: Pages | undefined, updates: readonly BookmarkPreviewDto[]) {
  return data && { ...data, pages: data.pages.map((page) => mergeBookmarkPage(page, updates)!) }
}
