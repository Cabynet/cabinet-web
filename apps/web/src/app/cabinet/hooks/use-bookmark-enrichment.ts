"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { AXIOS_INSTANCE, isRateLimited } from "@/lib/api-client"
import type { BookmarkListResponseDto, BookmarkPreviewsResponseDto } from "@cabinet/api-client"
import { pendingBookmarkIds, mergeBookmarkPage, mergeBookmarkPreviews } from "@/lib/bookmark-polling"

export function useBookmarkEnrichment(data: InfiniteData<BookmarkListResponseDto> | undefined, userId: string | undefined, paused: boolean) {
  const client = useQueryClient()
  const ids = pendingBookmarkIds(data)
  const requestedCount = ids.length
  const updates = useQuery({
    queryKey: ["bookmark-previews", userId, ids],
    enabled: !!userId && !paused && ids.length > 0 && !isRateLimited(),
    queryFn: async ({ signal }) => {
      if (isRateLimited()) return []
      const res = await AXIOS_INSTANCE.get<BookmarkPreviewsResponseDto>("/v1/bookmarks/previews", {
        params: { ids: ids.join(",") }, signal,
      })
      return res.data.previews ?? []
    },
    refetchInterval: () => (isRateLimited() || paused ? false : 2000),
  })
  useEffect(() => {
    if (!updates.data || paused) return
    client.setQueriesData<InfiniteData<BookmarkListResponseDto>>(
      { queryKey: ["infinite", "/v1/bookmarks"] },
      (current) => mergeBookmarkPreviews(current, updates.data!),
    )
    client.setQueriesData<BookmarkListResponseDto>(
      { queryKey: ["/v1/bookmarks"] },
      (current) => mergeBookmarkPage(current, updates.data!),
    )
    if (updates.data.length < requestedCount) {
      // A deleted item or revoked folder access must be removed, not polled forever.
      void client.invalidateQueries({ queryKey: ["infinite", "/v1/bookmarks"] })
    }
  }, [client, updates.data, paused, requestedCount])
}
