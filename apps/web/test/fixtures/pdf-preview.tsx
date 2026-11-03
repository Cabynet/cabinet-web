import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MoodboardCard } from "../../src/app/cabinet/components/bookmark-moodboard-view"
import { BookmarkWebview } from "../../src/app/cabinet/components/bookmark-webview"
import { defaultDisplayPreferences } from "../../src/app/cabinet/components/display-preferences"
import { TooltipProvider } from "../../src/components/ui/tooltip"
import { loadPdfDocument } from "../../src/lib/pdf-document"

;(window as any).testLoadPdf = async (url: string, abort = false) => {
  const controller = new AbortController()
  const loading = loadPdfDocument(url, controller.signal)
  if (abort) setTimeout(() => controller.abort(), 50)
  const task = await loading
  const pdf = await task.promise
  const pages = pdf.numPages
  await task.destroy()
  return pages
}

const noop = () => {}
const client = new QueryClient()
const source = (window as any).PDF_ORIGIN
const bookmarks = [
  { id: "pdf", title: "Research document", url: `${source}/sample.pdf`, contentType: "PDF" },
  { id: "note", title: "Short note", type: "NOTE", notes: "One line." },
  { id: "link", title: "Saved link", url: "https://example.test/", imageUrl: null },
  { id: "image", title: "Panoramic image", url: `${source}/wide.svg`, imageUrl: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="40"><rect width="800" height="40" fill="#6a7a68"/></svg>')}`, contentType: "IMAGE" },
  { id: "file", title: "Saved file", url: "https://example.test/file.zip", contentType: "FILE" },
  { id: "broken-pdf", title: "Unavailable document", url: `${source}/broken.pdf`, contentType: "PDF" },
]

function Fixture() {
  const [preview, setPreview] = useState<any>(null)
  const [density, setDensity] = useState<"visual" | "compact" | "comfortable">("visual")
  const [section, setSection] = useState("all")
  return <QueryClientProvider client={client}><TooltipProvider>
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Cabinet files</h1>
      <div className="mb-6 flex gap-3">{(["visual", "compact", "comfortable"] as const).map((value) => <button key={value} onClick={() => setDensity(value)}>{value}</button>)}</div>
      <nav><button onClick={() => setSection("favorites")}>Favorites</button><button onClick={() => setSection("all")}>All items</button></nav>
      <div key={section} id="cards" className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(section === "all" ? bookmarks : bookmarks.filter((bookmark) => ["pdf", "image"].includes(bookmark.id))).map((bookmark) => <MoodboardCard key={bookmark.id} bookmark={{ canEdit: true, access: "owner", metadataStatus: "COMPLETED", ...bookmark }}
          displayPreferences={{ ...defaultDisplayPreferences, density }}
          nativeDrag={false} showActions={false} onSelectTag={noop} onToggleFavorite={noop} onToggleArchive={noop} onEditBookmark={noop} onDeleteBookmark={noop} onDuplicateBookmark={noop}
          getHostname={(url) => url ? new URL(url).hostname : ""} onInspectBookmark={setPreview} />)}
      </div>
      {preview && <BookmarkWebview bookmark={preview} onClose={() => setPreview(null)} />}
    </main>
  </TooltipProvider></QueryClientProvider>
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture /></React.StrictMode>)
