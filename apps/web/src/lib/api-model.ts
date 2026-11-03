import type { BookmarkListItem, FolderDto } from "@cabinet/api-client"

/** API JSON is camelCase already; this only adds UI-only aliases and derived fields. */
export function bookmarkFromApi(item: BookmarkListItem) {
  return {
    ...item,
    type: item.itemType === "LINK" ? "BOOKMARK" : item.itemType,
    url: item.rawUrl,
    domain: item.normalizedDomain,
    imageUrl: item.thumbnailUrl,
    notes: item.notesPlain ?? "",
    folder: null as { id: string; name: string } | null,
    canEdit: item.access === "owner",
    access: item.access as "owner" | "editor" | "viewer",
  }
}
export function folderFromApi(folder: FolderDto) {
  return { ...folder, access: folder.access as "OWNER" | "VIEWER" | "CONTRIBUTOR" | "EDITOR", isOwner: folder.access === "OWNER" }
}

/** A bookmark as the UI sees it; summaries come from list responses without full note/drawing bodies. */
export type Bookmark = ReturnType<typeof bookmarkFromApi> & { isSummary?: boolean }
