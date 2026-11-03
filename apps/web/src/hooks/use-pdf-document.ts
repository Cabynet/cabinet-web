"use client"

import { useEffect, useState } from "react"
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist"
import { loadPdfDocument } from "@/lib/pdf-document"

/** One document per viewer; page changes, thumbnails and zoom reuse its worker/data. */
export function usePdfDocument(url: string) {
  const [state, setState] = useState<{ url: string; document: PDFDocumentProxy | null; error: boolean }>({ url, document: null, error: false })
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    let task: PDFDocumentLoadingTask | undefined
    void (async () => {
      try {
        task = await loadPdfDocument(url, controller.signal)
        if (cancelled) { await task.destroy(); return }
        const document = await task.promise
        if (!cancelled) setState({ url, document, error: false })
      } catch {
        if (!cancelled) setState({ url, document: null, error: true })
      }
    })()
    return () => { cancelled = true; controller.abort(); void task?.destroy().catch(() => {}) }
  }, [url])
  return state.url === url ? state : { url, document: null, error: false }
}
