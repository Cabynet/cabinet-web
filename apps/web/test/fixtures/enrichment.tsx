import React from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { AXIOS_INSTANCE } from "../../src/lib/api-client"
import { bookmarkFromApi } from "../../src/lib/api-model"
import { useBookmarkEnrichment } from "../../src/app/cabinet/hooks/use-bookmark-enrichment"
import { BookmarkList } from "../../src/app/cabinet/components/bookmark-list"
import { TooltipProvider } from "../../src/components/ui/tooltip"
import { defaultDisplayPreferences } from "../../src/app/cabinet/components/display-preferences"
import type { BookmarkListResponseDto } from "@cabinet/api-client"

AXIOS_INSTANCE.defaults.baseURL = location.origin
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const id = "12345678-1234-1234-1234-123456789abc"
const item = { id, userId: "me", itemType: "LINK", title: "Pending", rawUrl: "https://example.test/page", description: "Reference", notesPlain: "x".repeat(1000), noteRevision: 0, metadataStatus: "PENDING", updatedAt: "2026-01-01T00:00:00Z", tags: [], access: "owner" }
const key = ["infinite", "/v1/bookmarks", { summary: true }]
client.setQueryData(key, { pages: [{ items: [item], nextCursor: null, totalCount: 1 }], pageParams: [undefined] })
const noop = () => {}
function Fixture() {
  const { data } = useQuery({ queryKey: key, queryFn: async () => { throw new Error("Full-list refetch is forbidden") }, staleTime: Infinity })
  const [preview, setPreview] = React.useState<any>(null)
  useBookmarkEnrichment(data as any, "me", false)
  const items = (data as any).pages.flatMap((page: BookmarkListResponseDto) => page.items.map((item) => ({ ...bookmarkFromApi(item), isSummary: true })))
  return <TooltipProvider>
    <output id="status">{items[0].metadataStatus}</output>
    <button onClick={() => setPreview(items[0])}>Inspect summary</button>
    <BookmarkList bookmarks={items} displayPreferences={defaultDisplayPreferences} isBookmarksLoading={false} folders={[]} viewMode="list" selectedBookmarkIds={[]}
      onToggleSelect={noop} onSelectTag={noop} onToggleFavorite={noop} onToggleArchive={noop} onEditBookmark={noop} onDeleteBookmark={noop} onDuplicateBookmark={noop}
      previewBookmark={preview} onPreviewBookmarkChange={setPreview}
      onUpdateBookmark={async (bookmarkId, body) => bookmarkFromApi((await AXIOS_INSTANCE.patch(`/v1/bookmarks/${bookmarkId}`, { title: body.title, notesPlain: body.notes, baseRevision: body.baseRevision, saveId: body.saveId })).data)} />
  </TooltipProvider>
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>)
