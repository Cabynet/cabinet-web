"use client"

import { useMutation, useQuery, type InfiniteData, type QueryKey, type UseInfiniteQueryOptions, type UseQueryOptions } from "@tanstack/react-query"
import { bookmarkFromApi, folderFromApi } from "./api-model.ts"
import {
  AXIOS_INSTANCE,
  cabinetMediaApi as sharedCabinetMediaApi,
  type DownloadMediaPayload,
  type CreateBookmarkRequest,
  type UpdateBookmarkRequest,
  type CreateFolderRequest,
  type UpdateFolderRequest,
  type ListBookmarksParams,
  type BookmarkListResponse,
  useListBookmarks,
  useListBookmarksInfinite,
  useCreateBookmark,
  useUpdateBookmark,
  useDeleteBookmark,
  useGetDuplicatesHandler,
  useCleanupDuplicatesHandler,
  useListFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useListTags,
  useDeleteTag,
} from "@cabinet/api-client"

export {
  AXIOS_INSTANCE,
  useDeleteBookmark as useBookmarksControllerRemove,
  useCleanupDuplicatesHandler as useBookmarksControllerCleanDuplicates,
  useDeleteFolder as useFoldersControllerRemove,
  useDeleteTag as useTagsControllerRemove,
}

// Request shapes the UI sends. The generated request types are still snake_case, so each mapper
// casts once to the generated type; drop the casts when the spec documents camelCase requests.
type Wrapped<T> = T | { data: T }
const unwrap = <T extends object>(payload: Wrapped<T>): T => ("data" in payload ? payload.data : payload) as T

export type BookmarkInput = {
  url?: string | null; title?: string; description?: string | null; folderId?: string | null
  type?: string; itemType?: string; clientRequestId?: string; tags?: string[]
  noteDocument?: unknown; notesPlain?: string; notes?: string; drawing?: unknown
  thumbnailUrl?: string | null; imageUrl?: string | null; faviconUrl?: string | null; contentType?: string
  baseRevision?: number; saveId?: string; isPinned?: boolean; isFavorite?: boolean; isArchived?: boolean
}
export type FolderInput = { name?: string; description?: string | null; parentId?: string | null; position?: number }

function mapCreateBookmarkPayload(payload: Wrapped<BookmarkInput>) {
  const raw = unwrap(payload)
  return {
    url: raw.url,
    title: raw.title,
    description: raw.description,
    folderId: raw.folderId,
    itemType: raw.itemType ?? raw.type ?? (raw.url ? "LINK" : "NOTE"),
    clientRequestId: raw.clientRequestId,
    tags: raw.tags,
    noteDocument: raw.noteDocument,
    notesPlain: raw.notesPlain ?? raw.notes,
    drawing: raw.drawing,
    thumbnailUrl: raw.thumbnailUrl ?? raw.imageUrl,
    faviconUrl: raw.faviconUrl,
    contentType: raw.contentType,
  }
}

export function useBookmarksControllerCreate(options?: Parameters<typeof useCreateBookmark>[0]) {
  const mutation = useCreateBookmark(options)
  return {
    ...mutation,
    mutate: (variables: Wrapped<BookmarkInput>, mutateOptions?: Parameters<typeof mutation.mutate>[1]) => {
      return mutation.mutate({ data: mapCreateBookmarkPayload(variables) }, mutateOptions)
    },
    mutateAsync: async (variables: Wrapped<BookmarkInput>, mutateOptions?: Parameters<typeof mutation.mutateAsync>[1]) => {
      return bookmarkFromApi(await mutation.mutateAsync({ data: mapCreateBookmarkPayload(variables) }, mutateOptions))
    },
  }
}

function mapUpdateBookmarkPayload(payload: Wrapped<BookmarkInput>) {
  const raw = unwrap(payload)
  return {
    url: raw.url,
    notesPlain: raw.notes,
    baseRevision: raw.baseRevision,
    saveId: raw.saveId,
    setFolder: Object.hasOwn(raw, "folderId"),
    title: raw.title,
    description: raw.description,
    thumbnailUrl: raw.thumbnailUrl ?? raw.imageUrl,
    folderId: raw.folderId,
    isPinned: raw.isPinned,
    isFavorite: raw.isFavorite,
    isArchived: raw.isArchived,
    tags: raw.tags,
  }
}

export function useBookmarksControllerUpdate(options?: Parameters<typeof useUpdateBookmark>[0]) {
  const mutation = useUpdateBookmark(options)
  return {
    ...mutation,
    mutate: (variables: { id: string } & Wrapped<BookmarkInput>, mutateOptions?: Parameters<typeof mutation.mutate>[1]) => {
      const id = variables.id
      const data = mapUpdateBookmarkPayload(variables)
      return mutation.mutate({ id, data }, mutateOptions)
    },
    mutateAsync: async (variables: { id: string } & Wrapped<BookmarkInput>, mutateOptions?: Parameters<typeof mutation.mutateAsync>[1]) => {
      const id = variables.id
      const data = mapUpdateBookmarkPayload(variables)
      return bookmarkFromApi(await mutation.mutateAsync({ id, data }, mutateOptions))
    },
  }
}

export async function getBookmark(id: string, signal?: AbortSignal) {
  const { data } = await AXIOS_INSTANCE.get(`/v1/bookmarks/${id}`, { signal })
  return bookmarkFromApi(data)
}

// Module-level so react-query can memoize the selected result between renders.
const selectFolders = (folders: Parameters<typeof folderFromApi>[0][]) => folders.map(folderFromApi)
const selectTags = <T extends { bookmarkCount: number }>(tags: T[]) => tags.map((tag) => ({ ...tag, _count: { bookmarks: tag.bookmarkCount } }))

export function useFoldersControllerFindAll(options?: Parameters<typeof useListFolders>[0]) {
  return useListFolders<ReturnType<typeof folderFromApi>[]>({ ...options, query: { ...options?.query, select: selectFolders } })
}

export function useTagsControllerFindAll(options?: Parameters<typeof useListTags>[0]) {
  return useListTags({ ...options, query: { ...options?.query, select: selectTags } })
}

function mapCreateFolderPayload(payload: Wrapped<FolderInput>) {
  const raw = unwrap(payload)
  return { name: raw.name ?? "", description: raw.description, parentId: raw.parentId }
}

export function useFoldersControllerCreate(options?: Parameters<typeof useCreateFolder>[0]) {
  const mutation = useCreateFolder(options)
  return {
    ...mutation,
    mutate: (variables: Wrapped<FolderInput>, mutateOptions?: Parameters<typeof mutation.mutate>[1]) => {
      return mutation.mutate({ data: mapCreateFolderPayload(variables) }, mutateOptions)
    },
    mutateAsync: async (variables: Wrapped<FolderInput>, mutateOptions?: Parameters<typeof mutation.mutateAsync>[1]) => {
      return mutation.mutateAsync({ data: mapCreateFolderPayload(variables) }, mutateOptions)
    },
  }
}

function mapUpdateFolderPayload(payload: Wrapped<FolderInput>) {
  const raw = unwrap(payload)
  return {
    name: raw.name,
    description: raw.description,
    // Explicit null moves to root; undefined leaves the parent unchanged.
    parentId: raw.parentId,
    position: raw.position,
  }
}

export function useFoldersControllerUpdate(options?: Parameters<typeof useUpdateFolder>[0]) {
  const mutation = useUpdateFolder(options)
  return {
    ...mutation,
    mutate: (variables: { id: string } & Wrapped<FolderInput>, mutateOptions?: Parameters<typeof mutation.mutate>[1]) => {
      const id = variables.id
      const data = mapUpdateFolderPayload(variables)
      return mutation.mutate({ id, data }, mutateOptions)
    },
    mutateAsync: async (variables: { id: string } & Wrapped<FolderInput>, mutateOptions?: Parameters<typeof mutation.mutateAsync>[1]) => {
      const id = variables.id
      const data = mapUpdateFolderPayload(variables)
      return mutation.mutateAsync({ id, data }, mutateOptions)
    },
  }
}

export type { MediaFormat, MediaInfo } from "@cabinet/api-client"

export const cabinetMediaApi = {
  ...sharedCabinetMediaApi,
  download: async (payload: DownloadMediaPayload): Promise<void> => {
    const blob = await sharedCabinetMediaApi.download(payload)
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const extension = payload.mediaType === "AUDIO" ? "mp3" : "mp4"
    const title = payload.title.replace(/[^\w\s-]/gi, "").trim() || "download"
    try {
      link.href = downloadUrl
      link.download = `${title}.${extension}`
      document.body.appendChild(link)
      link.click()
    } finally {
      link.remove()
      URL.revokeObjectURL(downloadUrl)
    }
  },
}

export function useBookmarksControllerGetDuplicates(options?: Parameters<typeof useGetDuplicatesHandler>[0]) {
  return useGetDuplicatesHandler({ ...options, query: { ...options?.query, select: (report) => report.groups.map((group) => ({ url: group.url, bookmarks: group.items.map(bookmarkFromApi) })) } })
}

export type BookmarkQuery = {
  limit?: number; folderId?: string; tag?: string; domain?: string; isArchived?: boolean; isFavorite?: boolean
  cursor?: string; search?: string; type?: string; trash?: boolean; isTrash?: boolean; status?: string
  contentType?: string; sort?: string; addedAfter?: string; addedBefore?: string; summary?: boolean
}

export function useBookmarksControllerFindAll(params?: BookmarkQuery, options?: { query?: Partial<UseQueryOptions<BookmarkListResponse>> }) {
  return useListBookmarks(mapBookmarkParams(params), options)
}

export function useBookmarksControllerFindAllInfinite(params?: BookmarkQuery, options?: { query?: Partial<UseInfiniteQueryOptions<BookmarkListResponse, unknown, InfiniteData<BookmarkListResponse, string | null | undefined>, QueryKey, string | null | undefined>> }) {
  return useListBookmarksInfinite(mapBookmarkParams(params), options)
}

function mapBookmarkParams(params?: BookmarkQuery): ListBookmarksParams | undefined {
  if (!params) return undefined
  return {
    limit: params.limit,
    folderId: params.folderId,
    tag: params.tag,
    domain: params.domain,
    isArchived: params.isArchived,
    isFavorite: params.isFavorite,
    cursor: params.cursor,
    search: params.search,
    type: params.type,
    trash: params.trash ?? params.isTrash,
    status: params.status,
    contentType: params.contentType,
    sort: params.sort,
    addedAfter: params.addedAfter ? new Date(params.addedAfter).toISOString() : undefined,
    addedBefore: params.addedBefore ? new Date(`${params.addedBefore}T23:59:59.999Z`).toISOString() : undefined,
    summary: params.summary,
  }
}

export function useBookmarksControllerGetHealthSummary(options?: { query?: { enabled?: boolean } }) {
  return useQuery({ ...options?.query, queryKey: ["/v1/bookmarks/health"], queryFn: async () => (await AXIOS_INSTANCE.get("/v1/bookmarks/health")).data, staleTime: 60_000 })
}

export function useBookmarksControllerTriggerHealthCheck(options?: { mutation?: object }) {
  return useMutation<unknown, Error, void>({ ...options?.mutation, mutationFn: async () => (await AXIOS_INSTANCE.post("/v1/bookmarks/health/check")).data })
}

export function useBookmarksControllerReorder(options?: { mutation?: object }) {
  return useMutation({ ...options?.mutation, mutationFn: async (payload: { data: { ids: string[] } }) => (await AXIOS_INSTANCE.post("/v1/bookmarks/reorder", payload.data)).data })
}

export function useBookmarksControllerImport() {
  return useMutation({
    mutationFn: async (payload: FormData | { htmlContent?: string; data?: { htmlContent?: string; file?: Blob } }) => {
      let formData: FormData
      if (payload instanceof FormData) {
        formData = payload
      } else {
        formData = new FormData()
        const content = payload?.data?.htmlContent || payload?.htmlContent
        if (content) {
          formData.append("html", content)
        } else if (payload?.data?.file) {
          formData.append("file", payload.data.file)
        }
      }
      const res = await AXIOS_INSTANCE.post("/v1/tasks/import-html", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      return res.data
    },
  })
}

export async function uploadFileToR2(file: File) {
  const { data: upload } = await AXIOS_INSTANCE.post("/v1/media/presign", { filename: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size })
  let response: Response
  try {
    response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file })
  } catch {
    // Direct browser PUT failed (e.g. CORS preflight refused by R2 bucket) — fallback to backend proxy
    const formData = new FormData()
    formData.append("file", file)
    const fallback = await AXIOS_INSTANCE.post("/v1/uploads", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    const res = fallback.data?.data ?? fallback.data
    return { url: res.url, key: res.key, filename: file.name, contentType: file.type, size: file.size }
  }
  if (!response.ok) throw new Error(`Storage upload failed (${response.status})`)
  const { data: confirmed } = await AXIOS_INSTANCE.post(`/v1/media/${upload.assetId}/confirm`)
  return { url: confirmed.publicUrl, key: upload.objectKey, filename: file.name, contentType: file.type, size: file.size }
}

export async function uploadBookmarkToR2(params: {
  file: File
  title?: string
  description?: string
  folderId?: string
  tags?: string[]
}) {
  const upload = await uploadFileToR2(params.file)
  const { data } = await AXIOS_INSTANCE.post("/v1/bookmarks", {
    url: upload.url, title: params.title?.trim() || params.file.name, description: params.description,
    folderId: params.folderId, tags: params.tags, itemType: "FILE",
    contentType: params.file.type === "application/pdf" ? "PDF" : params.file.type.startsWith("image/") ? "IMAGE" : "FILE",
    thumbnailUrl: params.file.type.startsWith("image/") ? upload.url : undefined,
  })
  return bookmarkFromApi(data)
}

AXIOS_INSTANCE.defaults.baseURL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
AXIOS_INSTANCE.defaults.withCredentials = true

let throttledUntil = 0
let throttleTimer: ReturnType<typeof setTimeout> | null = null

export function getRateLimitCooldown(): number {
  return Math.max(0, Math.ceil((throttledUntil - Date.now()) / 1000))
}

export function isRateLimited(): boolean {
  return Date.now() < throttledUntil
}

export function resetRateLimitCooldown(): void {
  throttledUntil = 0
  if (throttleTimer) {
    clearTimeout(throttleTimer)
    throttleTimer = null
  }
}

export function setRateLimitCooldown(seconds: number): void {
  const cooldownMs = Math.max(1, seconds) * 1000
  throttledUntil = Math.max(throttledUntil, Date.now() + cooldownMs)
  if (throttleTimer) clearTimeout(throttleTimer)
  throttleTimer = setTimeout(() => {
    throttleTimer = null
  }, cooldownMs)
}

AXIOS_INSTANCE.interceptors.request.use((config) => {
  if (isRateLimited()) {
    const remaining = getRateLimitCooldown()
    const error: Error & { response?: unknown } = new Error(
      `Requests are paused due to rate limiting. Please wait ${remaining}s.`
    )
    error.name = "RateLimitCooldownError"
    error.response = {
      status: 429,
      headers: { "retry-after": String(remaining) },
      data: {
        error: {
          code: "RATE_LIMIT_COOLDOWN",
          message: `Rate limit active. Please wait ${remaining} seconds.`,
          retryAfterSeconds: remaining,
        },
      },
    }
    return Promise.reject(error)
  }
  return config
})

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      const headerVal = error.response.headers?.["retry-after"]
      const retryAfterSeconds =
        Number(headerVal) ||
        error.response.data?.error?.retryAfterSeconds ||
        60

      setRateLimitCooldown(retryAfterSeconds)

      if (typeof window !== "undefined") {
        try {
          const { toast } = await import("@/components/ui/sonner")
          toast.error(
            `Too many requests. Please wait ${retryAfterSeconds}s before trying again.`,
            { id: "rate-limit-toast", duration: 5000 }
          )
        } catch {
          // Toast may not be mounted in non-DOM test environments.
        }
      }
    } else if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.assign("/login")
    }
    return Promise.reject(error)
  }
)
