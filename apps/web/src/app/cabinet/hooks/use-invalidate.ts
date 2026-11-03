import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

export function useInvalidate() {
  const queryClient = useQueryClient()
  const invalidateBookmarks = useCallback(
    () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/v1/bookmarks"] }),
      queryClient.invalidateQueries({ queryKey: ["infinite", "/v1/bookmarks"] }),
      queryClient.invalidateQueries({ queryKey: ["/v1/bookmarks/health"] }),
    ]),
    [queryClient]
  )
  const invalidateFolders = useCallback(() => queryClient.invalidateQueries({ queryKey: ["/v1/folders"] }), [queryClient])
  const invalidateTags = useCallback(() => queryClient.invalidateQueries({ queryKey: ["/v1/tags"] }), [queryClient])
  return { invalidateBookmarks, invalidateFolders, invalidateTags }
}
