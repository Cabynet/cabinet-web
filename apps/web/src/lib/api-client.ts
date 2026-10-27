"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AXIOS_INSTANCE,
  cabinetMediaApi as sharedCabinetMediaApi,
  type DownloadMediaPayload,
  useListBookmarks,
  useListBookmarksInfinite,
  useCreateBookmark,
  useUpdateBookmark,
  useDeleteBookmark,
  useGetDuplicatesHandler,
  useCleanupDuplicatesHandler,
  useCheckLinkHandler,
  useExportBookmarksHandler,
  useListFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useListTags,
  useDeleteTag,
  useImportHtmlHandler,
  useGetPreviews,
  useGetNoteHandler,
  useUpdateNoteHandler,
  useSearchHandler,
  usePresignUploadHandler,
  useConfirmUploadHandler,
  useUpdateProfileHandler,
  useChangePasswordHandler,
  useDeleteAccountHandler,
} from "@cabinet/api-client"

export {
  AXIOS_INSTANCE,
  useDeleteBookmark as useBookmarksControllerRemove,
  useGetDuplicatesHandler as useBookmarksControllerGetDuplicates,
  useCleanupDuplicatesHandler as useBookmarksControllerCleanDuplicates,
  useExportBookmarksHandler as useBookmarksControllerExportBookmarks,
  useListFolders as useFoldersControllerFindAll,
  useDeleteFolder as useFoldersControllerRemove,
  useListTags as useTagsControllerFindAll,
  useDeleteTag as useTagsControllerRemove,
  useGetPreviews,
  useGetNoteHandler,
  useUpdateNoteHandler,
  useSearchHandler,
  usePresignUploadHandler,
  useConfirmUploadHandler,
  useUpdateProfileHandler,
  useChangePasswordHandler,
  useDeleteAccountHandler,
}

function mapCreateBookmarkPayload(payload: any) {
  const raw = payload?.data ?? payload
  return {
    url: raw.url,
    title: raw.title,
    description: raw.description,
    folder_id: raw.folder_id ?? raw.folderId,
    item_type: raw.item_type ?? raw.type ?? (raw.url ? "LINK" : "NOTE"),
    client_request_id: raw.client_request_id ?? raw.clientRequestId,
    tags: raw.tags,
  }
}

export function useBookmarksControllerCreate(options?: any) {
  const mutation = useCreateBookmark(options)
  return {
    ...mutation,
    mutate: (variables: any, mutateOptions?: any) => {
      return mutation.mutate({ data: mapCreateBookmarkPayload(variables) }, mutateOptions)
    },
    mutateAsync: async (variables: any, mutateOptions?: any) => {
      return mutation.mutateAsync({ data: mapCreateBookmarkPayload(variables) }, mutateOptions)
    },
  }
}

function mapUpdateBookmarkPayload(payload: any) {
  const raw = payload?.data ?? payload
  return {
    title: raw.title,
    description: raw.description,
    folder_id: raw.folder_id ?? raw.folderId,
    is_pinned: raw.is_pinned ?? raw.isPinned,
    is_favorite: raw.is_favorite ?? raw.isFavorite,
    is_archived: raw.is_archived ?? raw.isArchived,
    tags: raw.tags,
  }
}

export function useBookmarksControllerUpdate(options?: any) {
  const mutation = useUpdateBookmark(options)
  return {
    ...mutation,
    mutate: (variables: any, mutateOptions?: any) => {
      const id = variables.id
      const data = mapUpdateBookmarkPayload(variables)
      return (mutation as any).mutate({ id, data }, mutateOptions)
    },
    mutateAsync: async (variables: any, mutateOptions?: any) => {
      const id = variables.id
      const data = mapUpdateBookmarkPayload(variables)
      return (mutation as any).mutateAsync({ id, data }, mutateOptions)
    },
  }
}

function mapCreateFolderPayload(payload: any) {
  const raw = payload?.data ?? payload
  return {
    name: raw.name,
    description: raw.description,
    parent_id: raw.parent_id ?? raw.parentId,
  }
}

export function useFoldersControllerCreate(options?: any) {
  const mutation = useCreateFolder(options)
  return {
    ...mutation,
    mutate: (variables: any, mutateOptions?: any) => {
      return mutation.mutate({ data: mapCreateFolderPayload(variables) }, mutateOptions)
    },
    mutateAsync: async (variables: any, mutateOptions?: any) => {
      return mutation.mutateAsync({ data: mapCreateFolderPayload(variables) }, mutateOptions)
    },
  }
}

function mapUpdateFolderPayload(payload: any) {
  const raw = payload?.data ?? payload
  return {
    name: raw.name,
    description: raw.description,
    parent_id: raw.parent_id ?? raw.parentId,
    position: raw.position,
  }
}

export function useFoldersControllerUpdate(options?: any) {
  const mutation = useUpdateFolder(options)
  return {
    ...mutation,
    mutate: (variables: any, mutateOptions?: any) => {
      const id = variables.id
      const data = mapUpdateFolderPayload(variables)
      return (mutation as any).mutate({ id, data }, mutateOptions)
    },
    mutateAsync: async (variables: any, mutateOptions?: any) => {
      const id = variables.id
      const data = mapUpdateFolderPayload(variables)
      return (mutation as any).mutateAsync({ id, data }, mutateOptions)
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

export function useBookmarksControllerFindAll(params?: any, options?: any) {
  return useListBookmarks(mapBookmarkParams(params), options)
}

export function useBookmarksControllerFindAllInfinite(params?: any, options?: any) {
  return useListBookmarksInfinite(mapBookmarkParams(params), options)
}

function mapBookmarkParams(params?: any): any {
  if (!params) return undefined
  return {
    limit: params.limit,
    folder_id: params.folder_id ?? params.folderId,
    tag: params.tag,
    domain: params.domain,
    is_archived: params.is_archived ?? params.isArchived,
    is_favorite: params.is_favorite ?? params.isFavorite,
    cursor: params.cursor,
  }
}

export function useBookmarksControllerGetHealthSummary(_options?: any) {
  return useQuery({
    queryKey: ["bookmarks_health_summary"],
    queryFn: async () => ({
      total: 0,
      broken: 0,
      healthy: 0,
      lastCheck: null,
    }),
    staleTime: 60 * 1000,
  })
}

export function useBookmarksControllerTriggerHealthCheck(_options?: any) {
  return useMutation<any, Error, void>({
    mutationFn: async () => {
      return { status: "queued" }
    },
  })
}

export function useBookmarksControllerReorder(_options?: any) {
  return useMutation({
    mutationFn: async (_payload: any) => ({ success: true }),
  })
}

export function useBookmarksControllerBulkAddTags(_options?: any) {
  return useMutation({
    mutationFn: async (_payload: any) => ({ success: true }),
  })
}

export function useBookmarksControllerImport() {
  return useMutation({
    mutationFn: async (payload: any) => {
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

export function useUploadsControllerUpload() {
  return useMutation({
    mutationFn: async (data: { data: FormData }) => {
      const file = data.data.get("file") as File
      return uploadFileToR2(file)
    },
  })
}

export function useUploadsControllerUploadBookmark() {
  return useMutation({
    mutationFn: async (data: { data: FormData }) => {
      const file = data.data.get("file") as File
      const title = data.data.get("title") as string | undefined
      const description = data.data.get("description") as string | undefined
      const folderId = data.data.get("folderId") as string | undefined
      return uploadBookmarkToR2({ file, title, description, folderId })
    },
  })
}

export async function uploadFileToR2(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  const response = await AXIOS_INSTANCE.post("/v1/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return (response.data?.data ?? response.data) as {
    url: string
    key: string
    filename: string
    contentType: string
    size: number
  }
}

export async function uploadBookmarkToR2(params: {
  file: File
  title?: string
  description?: string
  folderId?: string
  tags?: string[]
}) {
  const formData = new FormData()
  formData.append("file", params.file)
  if (params.title?.trim()) formData.append("title", params.title.trim())
  if (params.description?.trim()) formData.append("description", params.description.trim())
  if (params.folderId) formData.append("folderId", params.folderId)
  if (params.tags?.length) formData.append("tags", params.tags.join(","))

  const response = await AXIOS_INSTANCE.post("/v1/uploads/bookmark", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return response.data?.data ?? response.data
}

AXIOS_INSTANCE.defaults.baseURL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
AXIOS_INSTANCE.defaults.withCredentials = true

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.assign("/login")
    }
    return Promise.reject(error)
  }
)
