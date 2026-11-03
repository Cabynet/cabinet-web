"use client"

import { useEffect, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { AXIOS_INSTANCE } from "@/lib/api-client"
import type { BookmarkListResponse } from "@cabinet/api-client"
import { bookmarkUrl } from "@/lib/bookmark-url"
import { bookmarkFromApi } from "@/lib/api-model"

export async function searchBookmarks(params: { search?: string; domain?: string }, cursor?: string, signal?: AbortSignal, limit = 20) {
  const response = await AXIOS_INSTANCE.get<BookmarkListResponse>('/v1/bookmarks', {
    params: { ...params, cursor, limit, summary: true }, signal,
  })
  const items = (response.data?.items ?? []).map(bookmarkFromApi)
  return { data: items, nextCursor: response.data?.nextCursor ?? null, totalCount: items.length }
}

export async function findExistingBookmark(url: string, signal?: AbortSignal, excludeId?: string) {
  const canonical = bookmarkUrl(url)
  if (!canonical) return null
  let cursor: string | undefined
  const seen = new Set<string>()
  try {
    const hostname = new URL(canonical).hostname.replace(/^www\./, '')
    do {
      // Match across URL spellings (default ports, fragments and trailing slashes).
      const page = await searchBookmarks({ domain: hostname }, cursor, signal, 100)
      const list = page?.data || []
      const match = list.find((item) => {
        const itemUrl = item.rawUrl || ''
        return item.id !== excludeId && bookmarkUrl(itemUrl) === canonical
      })
      if (match) return match
      cursor = page?.nextCursor || undefined
      if (cursor && seen.has(cursor)) break
      if (cursor) seen.add(cursor)
    } while (cursor)
  } catch {
    return null
  }
  return null
}

export function useBookmarkSearch(value: string, enabled: boolean) {
  const search = value.trim()
  const [debounced, setDebounced] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(timer)
  }, [search])
  const query = useInfiniteQuery({
    queryKey: ['/v1/bookmarks', 'search', debounced],
    queryFn: ({ pageParam, signal }) => searchBookmarks({ search: debounced }, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor || undefined,
    enabled: enabled && !!debounced && debounced === search,
    retry: false,
  })
  return { ...query, isDebouncing: search !== debounced, items: query.data?.pages.flatMap((page) => page.data) || [] }
}
