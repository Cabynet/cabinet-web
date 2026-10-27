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
} from "@cabinet/api-client"

export {
  AXIOS_INSTANCE,
  useCreateBookmark as useBookmarksControllerCreate,
  useUpdateBookmark as useBookmarksControllerUpdate,
  useDeleteBookmark as useBookmarksControllerRemove,
  useGetDuplicatesHandler as useBookmarksControllerGetDuplicates,
  useCleanupDuplicatesHandler as useBookmarksControllerCleanDuplicates,
  useExportBookmarksHandler as useBookmarksControllerExportBookmarks,
  useListFolders as useFoldersControllerFindAll,
  useCreateFolder as useFoldersControllerCreate,
  useUpdateFolder as useFoldersControllerUpdate,
  useDeleteFolder as useFoldersControllerRemove,
  useListTags as useTagsControllerFindAll,
  useDeleteTag as useTagsControllerRemove,
  useGetPreviews,
  useGetNoteHandler,
  useUpdateNoteHandler,
  useSearchHandler,
  usePresignUploadHandler,
  useConfirmUploadHandler,
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
