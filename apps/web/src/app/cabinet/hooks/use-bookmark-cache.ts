import { useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { useCallback } from "react"
import type { BookmarkListItem, BookmarkListResponse } from "@cabinet/api-client"
import { bookmarkFromApi } from "@/lib/api-model"

type Bookmark = ReturnType<typeof bookmarkFromApi>
export function useBookmarkCache() {
  const client = useQueryClient()
  const patch = useCallback((change: (item: BookmarkListItem) => BookmarkListItem | null) => {
    const page = (data: BookmarkListResponse | undefined) => data && ({ ...data, items: data.items.flatMap((item) => { const next = change(item); return next ? [next] : [] }) })
    client.setQueriesData<InfiniteData<BookmarkListResponse>>({ queryKey: ["infinite", "/v1/bookmarks"] }, (data) => data && ({ ...data, pages: data.pages.map((p) => page(p)!) }))
    client.setQueriesData<BookmarkListResponse>({ queryKey: ["/v1/bookmarks"], predicate: (q) => Array.isArray((q.state.data as BookmarkListResponse | undefined)?.items) }, page)
  }, [client])
  const updateBookmarkInCache = useCallback((id: string, update: (item: Bookmark) => Bookmark) => patch((item) => {
    if (item.id !== id) return item
    const next = update(bookmarkFromApi(item))
    return { ...item, isFavorite: next.isFavorite, isPinned: next.isPinned, isArchived: next.isArchived, folderId: next.folderId }
  }), [patch])
  const removeBookmarkFromCache = useCallback((id: string) => patch((item) => item.id === id ? null : item), [patch])
  return { updateBookmarkInCache, removeBookmarkFromCache }
}
