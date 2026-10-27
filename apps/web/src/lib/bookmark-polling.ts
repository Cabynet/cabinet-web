import type { BookmarkListResponseDto, BookmarkPreviewDto } from "@cabinet/api-client"
import type { InfiniteData } from "@tanstack/react-query"

type Pages = InfiniteData<BookmarkListResponseDto>

export function pendingBookmarkIds(data: Pages | undefined): string[] {
  const ids = new Set<string>()
  for (const page of data?.pages ?? []) {
    const list = (page as any)?.items ?? (page as any)?.data?.data ?? []
    for (const item of list) {
      const status = item.metadata_status ?? item.metadataStatus
      if (status === "PENDING" || status === "PROCESSING") ids.add(item.id)
      if (ids.size === 100) return [...ids]
    }
  }
  return [...ids]
}

export function mergeBookmarkPage(page: BookmarkListResponseDto | undefined, updates: readonly BookmarkPreviewDto[]) {
  if (!page) return page
  const byId = new Map(updates.map((item) => [item.id, item]))
  const pageAny = page as any

  if (pageAny.data?.data) {
    return {
      ...page,
      data: {
        ...pageAny.data,
        data: pageAny.data.data.map((item: any) => {
          const update = byId.get(item.id) as any
          if (!update) return item
          const updateUrl = update.url || update.raw_url
          const itemUrl = item.url || item.raw_url
          const updateTime = update.updatedAt || update.updated_at
          const itemTime = item.updatedAt || item.updated_at
          if (updateUrl && itemUrl && updateUrl !== itemUrl) return item
          if (updateTime && itemTime && Date.parse(updateTime) < Date.parse(itemTime)) return item
          return { ...item, ...update }
        }),
      },
    }
  }

  if (pageAny.items) {
    return {
      ...page,
      items: pageAny.items.map((item: any) => {
        const update = byId.get(item.id) as any
        if (!update) return item
        const updateUrl = update.url || update.raw_url
        const itemUrl = item.url || item.raw_url
        const updateTime = update.updatedAt || update.updated_at
        const itemTime = item.updatedAt || item.updated_at
        if (updateUrl && itemUrl && updateUrl !== itemUrl) return item
        if (updateTime && itemTime && Date.parse(updateTime) < Date.parse(itemTime)) return item
        return { ...item, ...update }
      }),
    }
  }

  return page
}

export function mergeBookmarkPreviews(data: Pages | undefined, updates: readonly BookmarkPreviewDto[]) {
  if (!data) return data
  return { ...data, pages: data.pages.map((page) => mergeBookmarkPage(page, updates)!) }
}
