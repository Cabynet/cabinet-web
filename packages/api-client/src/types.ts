// API response/request shapes the web app uses. Hand-written: keep in sync with the Rust API (cabinet-api).

export interface BookmarkTagSummary {
  id: string
  name: string
  slug: string
}

export interface BookmarkListItem {
  access: string
  contentType?: string | null
  createdAt: string
  deletedAt?: string | null
  description?: string | null
  drawing?: unknown | null
  faviconUrl?: string | null
  folderId?: string | null
  id: string
  isArchived: boolean
  isFavorite: boolean
  isPinned: boolean
  itemType: string
  metadataError?: string | null
  metadataStatus: string
  normalizedDomain?: string | null
  noteDocument?: unknown | null
  noteRevision: number
  notesPlain?: string | null
  position: number
  rawUrl?: string | null
  siteName?: string | null
  tags: BookmarkTagSummary[]
  thumbnailUrl?: string | null
  title: string
  updatedAt: string
  userId: string
}

export interface BookmarkListResponse {
  hasMore: boolean
  items: BookmarkListItem[]
  nextCursor?: string | null
  totalCount: number
}

export interface BookmarkPreviewDto {
  description?: string | null
  faviconUrl?: string | null
  id: string
  metadataStatus: string
  rawUrl?: string | null
  siteName?: string | null
  thumbnailUrl?: string | null
  title: string
  updatedAt: string
}

export interface BookmarkPreviewsResponse {
  previews: BookmarkPreviewDto[]
}

export interface FolderDto {
  access: string
  createdAt: string
  description?: string | null
  id: string
  name: string
  parentId?: string | null
  position: number
  shareEnabled: boolean
  updatedAt: string
}

export interface TagDto {
  bookmarkCount: number
  createdAt: string
  id: string
  name: string
  slug: string
}

export interface DuplicateGroupDto {
  count: number
  domain?: string | null
  items: BookmarkListItem[]
  url: string
}

export interface DuplicateReportResponse {
  groups: DuplicateGroupDto[]
  totalDuplicateGroups: number
  totalRedundantItems: number
}

export interface DuplicateCleanupResponse {
  cleanedItems: number
  message: string
}

export interface CreateBookmarkRequest {
  clientRequestId?: string | null
  contentType?: string | null
  description?: string | null
  drawing?: unknown | null
  faviconUrl?: string | null
  folderId?: string | null
  itemType?: string | null
  noteDocument?: unknown | null
  notesPlain?: string | null
  tags?: string[] | null
  thumbnailUrl?: string | null
  title?: string | null
  url?: string | null
}

export interface UpdateBookmarkRequest {
  baseRevision?: number | null
  description?: string | null
  folderId?: string | null
  isArchived?: boolean | null
  isFavorite?: boolean | null
  isPinned?: boolean | null
  notesPlain?: string | null
  saveId?: string | null
  setFolder?: boolean | null
  tags?: string[] | null
  thumbnailUrl?: string | null
  title?: string | null
  url?: string | null
}

export interface CreateFolderRequest {
  description?: string | null
  name: string
  parentId?: string | null
}

export interface UpdateFolderRequest {
  description?: string | null
  name?: string | null
  parentId?: string | null
  position?: number | null
}

export type ListBookmarksParams = {
  folderId?: string | null
  tag?: string | null
  domain?: string | null
  isArchived?: boolean | null
  isFavorite?: boolean | null
  trash?: boolean | null
  status?: string | null
  search?: string | null
  type?: string | null
  contentType?: string | null
  addedAfter?: string | null
  addedBefore?: string | null
  sort?: string | null
  summary?: boolean | null
  cursor?: string | null
  limit?: number | null
}
