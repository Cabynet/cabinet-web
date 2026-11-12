"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import {
  UploadSimple,
  DownloadSimple,
  GoogleChromeLogo,
  AppleLogo,
  Browsers,
  PuzzlePiece,
  CheckCircle,
  FileHtml,
  Compass,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { PageHeader, PageShell } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { readBookmarkImport } from "@/lib/import-bookmarks"
import { toast } from "@/components/ui/sonner"
import { AXIOS_INSTANCE, useBookmarksControllerImport } from "@/lib/api-client"
import {
  PipelineDiagram,
  ChromeExportIllustration,
  SafariExportIllustration,
  ExtensionWorkflowIllustration,
} from "./integrations-diagrams"

export default function IntegrationsPage() {
  const queryClient = useQueryClient()
  const [guide, setGuide] = useState("chrome")
  const [queuedTask, setQueuedTask] = useState<string | null>(null)
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab")
    if (requested && ["chrome", "safari", "raindrop", "arc-brave", "extension"].includes(requested)) setGuide(requested)
  }, [])
  const importMutation = useBookmarksControllerImport()
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleImportFile = async (file?: File | null) => {
    if (!file || isImporting) return
    if (!file.name.toLowerCase().endsWith(".html") && !file.name.toLowerCase().endsWith(".htm")) {
      toast.error("Choose a standard HTML bookmarks file (e.g. bookmarks.html).")
      return
    }

    setIsImporting(true)
    const toastId = toast.loading(`Importing "${file.name}" into Cabinet…`)
    try {
      const htmlContent = await readBookmarkImport(file)
      const res: any = await importMutation.mutateAsync({ data: { htmlContent } })
      for (const queryKey of [["/v1/bookmarks"], ["infinite", "/v1/bookmarks"], ["/v1/folders"], ["/v1/tags"]]) {
        queryClient.invalidateQueries({ queryKey })
      }
      const task = res?.data ?? res
      if (!task?.id) throw new Error("The server didn't return an import status.")
      setQueuedTask(task.id)
      toast.success("Import queued. You can leave this page.", { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the import. Check that the file is a valid bookmarks export.", { id: toastId })
    } finally {
      setIsImporting(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await AXIOS_INSTANCE.get("/v1/bookmarks/export", { responseType: "blob" })
      const url = URL.createObjectURL(new Blob([response.data], { type: "text/html;charset=utf-8" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `cabinet-bookmarks-${new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("HTML bookmarks file downloaded.")
    } catch {
      toast.error("Couldn't export bookmarks.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Integrations & import"
        description="Move your bookmarks from Google Chrome, Apple Safari, Raindrop, and other browsers into Cabinet without losing your folder structure."
      />

      {queuedTask && <Alert><AlertTitle>Import running in the background</AlertTitle><AlertDescription>Bookmarks already saved stay safe if the import needs to be retried.</AlertDescription></Alert>}
      {/* Direct Interactive Dropzone Area */}
      <section aria-labelledby="quick-import-heading" className="flex flex-col gap-3">
        <h2 id="quick-import-heading" className="text-base font-medium text-foreground">
          Import a bookmarks file
        </h2>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            void handleImportFile(file)
          }}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
            dragOver
              ? "border-library-olive bg-library-highlight/40 dark:bg-library-olive/10"
              : "border-border bg-card hover:bg-muted/30"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
            {isImporting ? <Spinner /> : <FileHtml className="size-6 text-muted-foreground" />}
          </div>
          <div className="mt-4 flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {isImporting ? "Importing your bookmarks…" : "Drag and drop an HTML bookmarks file here"}
            </p>
            <p className="text-xs text-muted-foreground">
              Supports standard HTML exports from Chrome, Safari, Raindrop.io, Arc, Firefox, Edge, and Brave.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <label className="relative cursor-pointer">
              <Button asChild variant="default" disabled={isImporting}>
                <span>
                  <UploadSimple data-icon="inline-start" />
                  {isImporting ? "Importing…" : "Choose HTML file"}
                </span>
              </Button>
              <input
                type="file"
                accept=".html,.htm"
                aria-label="Choose an HTML bookmarks file to import"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  void handleImportFile(file)
                  e.target.value = ""
                }}
                disabled={isImporting}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>

            <Button
              variant="outline"
              disabled={isExporting}
              onClick={handleExport}
              title="Download a backup of all your bookmarks as HTML"
            >
              {isExporting ? <Spinner /> : <DownloadSimple data-icon="inline-start" />}
              {isExporting ? "Preparing…" : "Export from Cabinet"}
            </Button>
          </div>
        </div>
      </section>

      {/* Pipeline Diagram Illustration */}
      <section aria-labelledby="pipeline-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="pipeline-heading" className="text-base font-medium text-foreground">
            How import &amp; export work
          </h2>
          <p className="text-xs text-muted-foreground">
            Cabinet uses the open Netscape Bookmarks format, so your data is never locked into one app.
          </p>
        </div>
        <PipelineDiagram />
      </section>

      {/* Platform-by-Platform Guides */}
      <section aria-labelledby="guides-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="guides-heading" className="text-base font-medium text-foreground">
            Guides by source app
          </h2>
          <p className="text-xs text-muted-foreground">
            Pick the browser or bookmarking app you use now to see its specific steps.
          </p>
        </div>

        <Tabs value={guide} onValueChange={setGuide} className="flex flex-col gap-5">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-10 w-max min-w-full justify-start gap-1 p-1">
              <TabsTrigger value="chrome" className="gap-2 text-xs">
                <GoogleChromeLogo className="size-4" />
                Google Chrome
              </TabsTrigger>
              <TabsTrigger value="safari" className="gap-2 text-xs">
                <AppleLogo className="size-4" />
                Apple Safari
              </TabsTrigger>
              <TabsTrigger value="raindrop" className="gap-2 text-xs">
                <Compass className="size-4" />
                Raindrop.io
              </TabsTrigger>
              <TabsTrigger value="arc-brave" className="gap-2 text-xs">
                <Browsers className="size-4" />
                Arc &amp; Brave
              </TabsTrigger>
              <TabsTrigger value="extension" className="gap-2 text-xs">
                <PuzzlePiece className="size-4" />
                1-click extension
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Chrome Tab */}
          <TabsContent value="chrome" className="flex flex-col gap-6">
            <Card>
              <CardHeader className="gap-1 p-5 sm:p-6">
                <CardTitle className="text-xl">Export from Google Chrome</CardTitle>
                <CardDescription>
                  Chrome exports bookmarks as Netscape HTML, including dates and folder hierarchy.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 p-5 pt-0 sm:p-6 sm:pt-0">
                <ChromeExportIllustration />
                <ol className="flex flex-col gap-3 text-sm text-foreground">
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">1</span>
                    <span>Open Google Chrome on your computer.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">2</span>
                    <span>
                      Click the <strong>three-dot menu (⋮)</strong> in the top-right corner of the browser window.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">3</span>
                    <span>
                      Go to <strong>Bookmarks and lists</strong>, then choose <strong>Bookmark manager</strong>.
                      Or use the shortcut: <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">⌘⌥B</kbd> on Mac or <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl+Shift+O</kbd> on Windows.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">4</span>
                    <span>
                      At the top of the Bookmark manager (next to the search bar), click its own <strong>three-dot menu (⋮)</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">5</span>
                    <span>
                      Choose <strong>Export bookmarks</strong> and save the HTML file to your computer.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">6</span>
                    <span>
                      Drop that file into the import area at the top of this page. Cabinet recreates your folders and imports every link.
                    </span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Safari Tab */}
          <TabsContent value="safari" className="flex flex-col gap-6">
            <Card>
              <CardHeader className="gap-1 p-5 sm:p-6">
                <CardTitle className="text-xl">Export from Apple Safari</CardTitle>
                <CardDescription>
                  Safari on macOS exports all your bookmarks and Reading List to a single HTML file.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 p-5 pt-0 sm:p-6 sm:pt-0">
                <SafariExportIllustration />
                <ol className="flex flex-col gap-3 text-sm text-foreground">
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">1</span>
                    <span>Open Safari on your Mac.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">2</span>
                    <span>
                      In the menu bar at the top of the screen, click <strong>File</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">3</span>
                    <span>
                      Choose <strong>Export Bookmarks…</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">4</span>
                    <span>
                      Pick a location and save the file as <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Safari Bookmarks.html</code>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">5</span>
                    <span>
                      Drag the HTML file into the import area at the top of this page.
                    </span>
                  </li>
                </ol>

                <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">A note on Safari for iPhone &amp; iPad:</p>
                  <p className="mt-1 leading-relaxed">
                    iOS and iPadOS don't offer a bookmark export option. If you turn on <strong>iCloud Safari Sync</strong> in your iPhone Settings, your iPhone bookmarks sync to Safari on your Mac, and you can export them from there.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raindrop Tab */}
          <TabsContent value="raindrop" className="flex flex-col gap-6">
            <Card>
              <CardHeader className="gap-1 p-5 sm:p-6">
                <CardTitle className="text-xl">Export from Raindrop.io</CardTitle>
                <CardDescription>
                  Bring your Raindrop bookmarks, tags, and collections into Cabinet.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 p-5 pt-0 sm:p-6 sm:pt-0">
                <ol className="flex flex-col gap-3 text-sm text-foreground">
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">1</span>
                    <span>Open Raindrop.io in your browser or the desktop app.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">2</span>
                    <span>
                      Click your profile icon or open <strong>Settings</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">3</span>
                    <span>
                      Choose the <strong>Backups</strong> tab in the settings sidebar.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">4</span>
                    <span>
                      Click <strong>Export as HTML</strong>. The backup file downloads right away.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">5</span>
                    <span>
                      Drag the Raindrop HTML file into Cabinet's import area. Your collection folders stay intact.
                    </span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arc & Brave Tab */}
          <TabsContent value="arc-brave" className="flex flex-col gap-6">
            <Card>
              <CardHeader className="gap-1 p-5 sm:p-6">
                <CardTitle className="text-xl">Export from Arc, Brave, &amp; Firefox</CardTitle>
                <CardDescription>
                  Almost every modern browser can export a standard HTML bookmarks file.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 p-5 pt-0 sm:p-6 sm:pt-0">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-muted/20 p-4 text-xs">
                    <p className="font-semibold text-foreground">Arc Browser</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">
                      Press <kbd className="rounded border bg-background px-1 py-0.5">⌘T</kbd> and type <code className="font-mono">Export Bookmarks</code>, or use the menu bar: <strong>Help</strong> &gt; <strong>Export Bookmarks</strong>. Save the HTML file and drag it into Cabinet.
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-4 text-xs">
                    <p className="font-semibold text-foreground">Brave Browser</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">
                      Click the three-line menu in the top right ➔ <strong>Bookmarks</strong> ➔ <strong>Bookmark manager</strong> ➔ click (⋮) at the top right of the bookmarks page ➔ choose <strong>Export bookmarks</strong>.
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-4 text-xs">
                    <p className="font-semibold text-foreground">Mozilla Firefox</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">
                      Press <kbd className="rounded border bg-background px-1 py-0.5">⌘⇧O</kbd> (Mac) or <kbd className="rounded border bg-background px-1 py-0.5">Ctrl+Shift+O</kbd> (Windows) to open the Library. Choose <strong>Import and Backup</strong> ➔ <strong>Export Bookmarks to HTML...</strong>.
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-4 text-xs">
                    <p className="font-semibold text-foreground">Pocket</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">
                      Sign in to Pocket on the web ➔ Account settings ➔ open <strong>Privacy / Export Data</strong> ➔ click <strong>Export HTML file</strong> to download your whole reading list.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Extension 1-Click Tab */}
          <TabsContent value="extension" className="flex flex-col gap-6">
            <Card>
              <CardHeader className="gap-1 p-5 sm:p-6">
                <CardTitle className="text-xl">Save in one click with the browser extension</CardTitle>
                <CardDescription>
                  Don't want to export a file every time? Use the official Cabinet extension for Chrome.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 p-5 pt-0 sm:p-6 sm:pt-0">
                <ExtensionWorkflowIllustration />
                <div className="flex flex-col gap-3 text-sm leading-6">
                  <h3 className="font-medium">Install the extension from the project folder</h3>
                  <p className="text-muted-foreground">For now the extension is installed manually, not from the Chrome Web Store. Use the <code>apps/extension</code> folder from the Cabinet project.</p>
                  <ol className="list-decimal pl-5">
                    <li>Open <code>chrome://extensions</code> and turn on Developer mode.</li>
                    <li>Click Load unpacked, then select the <code>apps/extension</code> folder.</li>
                    <li>Open the extension's Options and set the app and API URLs for your Cabinet server.</li>
                    <li>Sign in to Cabinet, then save a page with the extension. Setup is done once that page shows up in your account.</li>
                  </ol>
                  <p className="text-muted-foreground">If it says Saved locally, the save is still waiting to sync. Don't clear the extension's storage until syncing finishes.</p>
                </div>
                <div className="flex flex-col gap-3 text-sm text-foreground">
                  <p className="leading-relaxed text-muted-foreground">
                    The Cabinet extension uses your active browser session. Save any web page to the folder you want, or save highlighted text as a quote, with a keyboard shortcut.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-border bg-muted/30 p-3">
                      <span className="font-mono text-xs font-semibold text-foreground">⌘⇧S / Ctrl+Shift+S</span>
                      <p className="mt-1 text-xs text-muted-foreground">Open the save popup with folder and tag options.</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-3">
                      <span className="font-mono text-xs font-semibold text-foreground">⌥⇧S / Alt+Shift+S</span>
                      <p className="mt-1 text-xs text-muted-foreground">Save straight to the last-used folder without opening the popup.</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-3">
                      <span className="font-mono text-xs font-semibold text-foreground">⌥⇧H / Alt+Shift+H</span>
                      <p className="mt-1 text-xs text-muted-foreground">Save the highlighted text as a quote.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Helpful Guarantees & FAQ */}
      <section aria-labelledby="faq-heading" className="flex flex-col gap-3 border-t border-border/80 pt-6">
        <h2 id="faq-heading" className="text-base font-medium text-foreground">
          Good to know about importing
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CheckCircle className="size-4 text-library-olive" /> Folder structure preserved
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Subfolders from Chrome or Safari map directly to Cabinet folders, keeping their original order.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CheckCircle className="size-4 text-library-olive" /> Automatic previews
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              After import, Cabinet fetches preview images and OpenGraph descriptions in the background.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CheckCircle className="size-4 text-library-olive" /> Duplicate cleanup
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If the same URL gets imported more than once, duplicate detection in Maintenance can clean it up in one click.
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Footer */}
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg text-foreground">Cabinet</span>
          <span>· Integrations &amp; import guide</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/cabinet/settings" className="hover:text-foreground">
            Open settings
          </Link>
          <Link href="/cabinet" className="hover:text-foreground">
            Go to library
          </Link>
        </div>
      </footer>
    </PageShell>
  )
}
