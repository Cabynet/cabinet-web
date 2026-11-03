"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { renderPdfThumbnail } from "@/lib/pdf-document"
import { FilePdf, Clock } from "@phosphor-icons/react"

export function PdfPagePreview({ src, bookmarkId, onRatio }: { src: string; bookmarkId: string; onRatio: (ratio: number) => void }) {
  const { data: preview, isError } = useQuery({
    queryKey: ["pdf-thumbnail", src],
    queryFn: ({ signal }) => renderPdfThumbnail(src, signal),
    enabled: typeof window !== "undefined",
    staleTime: Infinity,
    gcTime: typeof window === "undefined" ? Infinity : 5 * 60 * 1000,
    retry: false,
  })

  React.useLayoutEffect(() => {
    if (preview) onRatio(preview.ratio)
    try {
      if (preview) localStorage.setItem(`cabinet.pdf-ratio:${bookmarkId}`, String(preview.ratio))
      else {
        const ratio = Number(localStorage.getItem(`cabinet.pdf-ratio:${bookmarkId}`))
        if (Number.isFinite(ratio) && ratio > 0 && ratio < 100) onRatio(ratio)
      }
    } catch {
      // Persisted dimensions are optional when browser storage is unavailable.
      return
    }
  }, [preview, bookmarkId, onRatio])

  return preview ? (
    <img src={preview.src} alt="" aria-hidden="true" data-pdf-ready="true" className="absolute inset-0 m-auto h-full w-full bg-white object-contain" />
  ) : (
    <div className="absolute inset-0 flex min-h-44 flex-col items-center justify-center gap-2 bg-muted/20 p-4 text-center text-xs text-muted-foreground" role="status">
      {isError ? <><FilePdf className="size-8" /><span>PDF preview unavailable</span><span>Open the document to try again.</span></> : <><Clock className="size-5 animate-spin" /><span>Loading PDF preview…</span></>}
    </div>
  )
}
