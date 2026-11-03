import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { customInstance } from "./custom-instance"
import type {
  BookmarkListItem,
  BookmarkListResponse,
  CreateBookmarkRequest,
  CreateFolderRequest,
  DuplicateCleanupResponse,
  DuplicateReportResponse,
  FolderDto,
  ListBookmarksParams,
  TagDto,
  UpdateBookmarkRequest,
  UpdateFolderRequest,
} from "./types"

// Query keys are part of the contract: the web app invalidates and patches caches by these prefixes.
type Cursor = ListBookmarksParams["cursor"]
type QueryOptions<TResult, TData> = { query?: Partial<UseQueryOptions<TResult, Error, TData>> }
type MutationOptions<TResult, TVars, TError, TContext> = {
  mutation?: UseMutationOptions<TResult, TError, TVars, TContext>
}

const listBookmarks = (params?: ListBookmarksParams, signal?: AbortSignal) =>
  customInstance<BookmarkListResponse>({ url: "/v1/bookmarks", method: "GET", params, signal })

export function useListBookmarks<TData = BookmarkListResponse>(
  params?: ListBookmarksParams,
  options?: QueryOptions<BookmarkListResponse, TData>
) {
  return useQuery({
    queryKey: ["/v1/bookmarks", ...(params ? [params] : [])],
    queryFn: ({ signal }) => listBookmarks(params, signal),
    ...options?.query,
  })
}

export function useListBookmarksInfinite<TData = InfiniteData<BookmarkListResponse, Cursor>>(
  params?: ListBookmarksParams,
  options?: { query?: Partial<UseInfiniteQueryOptions<BookmarkListResponse, unknown, TData, QueryKey, Cursor>> }
) {
  return useInfiniteQuery({
    queryKey: ["infinite", "/v1/bookmarks", ...(params ? [params] : [])],
    queryFn: ({ signal, pageParam }: { signal: AbortSignal; pageParam?: Cursor }) =>
      listBookmarks({ ...params, cursor: pageParam ?? params?.cursor }, signal),
    ...options?.query,
  } as UseInfiniteQueryOptions<BookmarkListResponse, unknown, TData, QueryKey, Cursor>)
}

export function useCreateBookmark<TError = unknown, TContext = unknown>(
  options?: MutationOptions<BookmarkListItem, { data: CreateBookmarkRequest }, TError, TContext>
) {
  return useMutation({
    mutationFn: ({ data }: { data: CreateBookmarkRequest }) =>
      customInstance<BookmarkListItem>({ url: "/v1/bookmarks", method: "POST", data }),
    ...options?.mutation,
  })
}

export function useUpdateBookmark<TError = unknown, TContext = unknown>(
  options?: MutationOptions<BookmarkListItem, { id: string; data: UpdateBookmarkRequest }, TError, TContext>
) {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookmarkRequest }) =>
      customInstance<BookmarkListItem>({ url: `/v1/bookmarks/${id}`, method: "PATCH", data }),
    ...options?.mutation,
  })
}

export function useDeleteBookmark<TError = unknown, TContext = unknown>(
  options?: MutationOptions<void, { id: string }, TError, TContext>
) {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => customInstance<void>({ url: `/v1/bookmarks/${id}`, method: "DELETE" }),
    ...options?.mutation,
  })
}

export function useGetDuplicatesHandler<TData = DuplicateReportResponse>(
  options?: QueryOptions<DuplicateReportResponse, TData>
) {
  return useQuery({
    queryKey: ["/v1/bookmarks/duplicates"],
    queryFn: ({ signal }) =>
      customInstance<DuplicateReportResponse>({ url: "/v1/bookmarks/duplicates", method: "GET", signal }),
    ...options?.query,
  })
}

export function useCleanupDuplicatesHandler<TError = unknown, TContext = unknown>(
  options?: MutationOptions<DuplicateCleanupResponse, void, TError, TContext>
) {
  return useMutation({
    mutationFn: () =>
      customInstance<DuplicateCleanupResponse>({ url: "/v1/bookmarks/duplicates/cleanup", method: "POST" }),
    ...options?.mutation,
  })
}

export function useListFolders<TData = FolderDto[]>(options?: QueryOptions<FolderDto[], TData>) {
  return useQuery({
    queryKey: ["/v1/folders"],
    queryFn: ({ signal }) => customInstance<FolderDto[]>({ url: "/v1/folders", method: "GET", signal }),
    ...options?.query,
  })
}

export function useCreateFolder<TError = unknown, TContext = unknown>(
  options?: MutationOptions<FolderDto, { data: CreateFolderRequest }, TError, TContext>
) {
  return useMutation({
    mutationFn: ({ data }: { data: CreateFolderRequest }) =>
      customInstance<FolderDto>({ url: "/v1/folders", method: "POST", data }),
    ...options?.mutation,
  })
}

export function useUpdateFolder<TError = unknown, TContext = unknown>(
  options?: MutationOptions<FolderDto, { id: string; data: UpdateFolderRequest }, TError, TContext>
) {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFolderRequest }) =>
      customInstance<FolderDto>({ url: `/v1/folders/${id}`, method: "PUT", data }),
    ...options?.mutation,
  })
}

export function useDeleteFolder<TError = unknown, TContext = unknown>(
  options?: MutationOptions<void, { id: string }, TError, TContext>
) {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => customInstance<void>({ url: `/v1/folders/${id}`, method: "DELETE" }),
    ...options?.mutation,
  })
}

export function useListTags<TData = TagDto[]>(options?: QueryOptions<TagDto[], TData>) {
  return useQuery({
    queryKey: ["/v1/tags"],
    queryFn: ({ signal }) => customInstance<TagDto[]>({ url: "/v1/tags", method: "GET", signal }),
    ...options?.query,
  })
}

export function useDeleteTag<TError = unknown, TContext = unknown>(
  options?: MutationOptions<void, { id: string }, TError, TContext>
) {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => customInstance<void>({ url: `/v1/tags/${id}`, method: "DELETE" }),
    ...options?.mutation,
  })
}
