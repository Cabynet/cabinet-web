"use client"

import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { SearchHighlight } from "./search-highlight"
import { Masonry } from "@/components/ui/masonry"
import { cn } from "@/lib/utils"
import { startBookmarkDrag } from "@/lib/bookmark-drag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Star, PushPin, Archive, PencilSimple, Trash, ArrowSquareOut, Copy, DotsThreeVertical, LinkSimple, ArrowCounterClockwise, FileText, FilePdf, DownloadSimple, VideoCamera, Clock, FolderSimple, Scribble, Eye, CheckSquare, type Icon } from "@phosphor-icons/react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { toast } from "@/components/ui/sonner"
import { canDownloadMedia, highlightQuote, isDrawingBookmark, isImageBookmark, isNoteBookmark, isVideoBookmark, isPdfBookmark, itemAccess } from "@/lib/bookmark-kind"
import { safeHttpUrl } from "@/lib/shared-collection"
import { activateBookmark, bookmarkOriginalHref } from "@/lib/bookmark-click"
import { useProxiedImageUrl } from "@/lib/signed-proxy"
import { defaultDisplayPreferences, type DisplayPreferences } from "./display-preferences"
import { NoteContentPreview } from "./moodboard-note-preview"
import { PdfPagePreview } from "./moodboard-pdf-preview"

export interface MoodboardCardProps {
  showActions?: boolean
  nativeDrag?: boolean
  onTogglePin?: (bookmark: any) => void
  displayPreferences?: DisplayPreferences
  bookmark: any
  folders?: any[]
  onSelectTag: (tagName: string) => void
  onToggleFavorite: (bookmark: any) => void
  onToggleArchive: (bookmark: any) => void
  onEditBookmark: (bookmark: any) => void
  onDeleteBookmark: (id: string) => void
  onDuplicateBookmark: (bookmark: any) => void
  getHostname: (url: string) => string
  isSelected: boolean
  hasSelectedItems?: boolean
  selectedBookmarkIds?: string[]
  onToggleSelect: () => void
  isTrashView?: boolean
  onRestoreBookmark?: (id: string) => void
  onPermanentDeleteBookmark?: (id: string) => void
  onOpenActionSheet?: (bookmark: any) => void
  onOpenDownload?: (bookmark: any) => void
  onInspectBookmark?: (bookmark: any) => void
}

export type CardAction = {
  key: string
  label: string
  Icon: Icon
  onSelect?: () => void
  /** Opens in a new tab instead of running onSelect. */
  href?: string
  destructive?: boolean
  /** Only in the right-click menu; the card already shows a button for it. */
  contextOnly?: boolean
}

export function MoodboardCard({
  showActions = true,
  nativeDrag = true,
  onTogglePin,
  displayPreferences,
  bookmark,
  folders = [],
  onSelectTag,
  onToggleFavorite,
  onToggleArchive,
  onEditBookmark,
  onDeleteBookmark,
  onDuplicateBookmark,
  getHostname,
  isSelected,
  hasSelectedItems = false,
  selectedBookmarkIds = [],
  onToggleSelect,
  isTrashView,
  onRestoreBookmark,
  onPermanentDeleteBookmark,
  onOpenActionSheet,
  onOpenDownload,
  onInspectBookmark,
}: MoodboardCardProps) {
  const queryClient = useQueryClient()
  const hostname = getHostname(bookmark.url)
  const folderName = folders.find((folder) => folder.id === bookmark.folderId)?.name
  const preferences = displayPreferences ?? defaultDisplayPreferences
  const isNote = isNoteBookmark(bookmark)
  // Highlights saved from a page by the browser extension; their link points back to that page.
  const quote = highlightQuote(bookmark)
  const sourceHref = isNote ? safeHttpUrl(bookmark.url || "")?.href : undefined
  const isDrawing = isDrawingBookmark(bookmark)
  const isPdf = isPdfBookmark(bookmark)
  const isImage = isImageBookmark(bookmark)
  const showWebsite = preferences.showWebsite && !isPdf && !isImage
  // Notes and drawings live in Cabinet; everything link-specific skips them.
  const inCabinet = isNote || isDrawing
  const isVideo = isVideoBookmark(bookmark)
  // Personal actions (select, pin, favorite, archive) belong to the item's author.
  const access = itemAccess(bookmark)
  const own = access === "owner"
  const canDownload = canDownloadMedia(bookmark)
  const originalHref = bookmarkOriginalHref(bookmark)
  const activate = (event: React.MouseEvent) =>
    activateBookmark(event, {
      bookmark,
      selectionMode: hasSelectedItems,
      onToggleSelect,
      onOpen: () => (onInspectBookmark ?? onEditBookmark)(bookmark),
    })

  const cleanHost = hostname.replace(/^www\./, "")
  const siteLabel = bookmark.siteName || cleanHost
  const rawTitle = (bookmark.title || "").trim()
  const titleDuplicatesHost =
    !rawTitle ||
    rawTitle.toLowerCase() === hostname.toLowerCase() ||
    rawTitle.toLowerCase() === cleanHost.toLowerCase() ||
    rawTitle.toLowerCase() === siteLabel.toLowerCase()
  const typeOnlyHeadline = React.useMemo(() => {
    if (!titleDuplicatesHost) return rawTitle
    try {
      const parsed = new URL(bookmark.url || "")
      const path = decodeURIComponent(parsed.pathname).replace(/^\/+|\/+$/g, "")
      if (path) return path
    } catch {
      return cleanHost || rawTitle || bookmark.url || "Untitled link"
    }
    return cleanHost || rawTitle || bookmark.url || "Untitled link"
  }, [titleDuplicatesHost, rawTitle, bookmark.url, cleanHost])

  const faviconUrl = safeHttpUrl(bookmark.faviconUrl || "")?.href ||
    (safeHttpUrl(bookmark.url || "") ? new URL("/favicon.ico", bookmark.url).href : "")
  const faviconSrc = useProxiedImageUrl(preferences.showImage ? faviconUrl : null)
  const fallbackIcon = preferences.showImage && faviconSrc ? (
    <img key={faviconUrl} src={faviconSrc} alt="" width={24} height={24} loading="lazy" decoding="async" draggable={false}
      className="size-6 shrink-0 object-contain" onError={(event) => { event.currentTarget.hidden = true }} />
  ) : null

  const rawImageUrl = bookmark.imageUrl || ""
  const isPendingEnrichment =
    !inCabinet &&
    (bookmark.metadataStatus === "PENDING" ||
      bookmark.metadataStatus === "PROCESSING")

  const proxiedImageUrl = useProxiedImageUrl(rawImageUrl)
  const cachedImageSrc = queryClient.getQueryData<string>(["bookmark-image", rawImageUrl])
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [imageRequested, setImageRequested] = React.useState(!!cachedImageSrc)
  const [currentSrc, setCurrentSrc] = React.useState<string>(cachedImageSrc || proxiedImageUrl)
  const [imageStatus, setImageStatus] = React.useState<
    "loading" | "ready" | "error"
  >(cachedImageSrc ? "ready" : rawImageUrl || isPendingEnrichment ? "loading" : "error")
  const [pdfAspectRatio, setPdfAspectRatio] = React.useState(16 / 10)

  React.useEffect(() => {
    const cached = queryClient.getQueryData<string>(["bookmark-image", bookmark.imageUrl || ""])
    const nextSrc = cached || proxiedImageUrl
    setCurrentSrc(nextSrc)
    const image = imageRef.current
    const ready = !!cached || (image?.getAttribute("src") === nextSrc && image.complete && image.naturalWidth > 0)
    setImageRequested(ready)
    setImageStatus(ready ? "ready" : bookmark.imageUrl || isPendingEnrichment ? "loading" : "error")
  }, [bookmark.imageUrl, proxiedImageUrl, isPendingEnrichment, queryClient])

  React.useEffect(() => {
    const image = imageRef.current
    if (!image || imageRequested) return
    if (typeof IntersectionObserver === "undefined") { setImageRequested(true); return }
    let observer: IntersectionObserver | undefined
    let secondFrame = 0
    // Masonry first measures hidden cards at the origin; observe only after positioning.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        let root = image.parentElement
        while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement
        observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setImageRequested(true)
            observer?.disconnect()
          }
        }, { root, rootMargin: "600px 0px" })
        observer.observe(image)
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      observer?.disconnect()
    }
  }, [currentSrc, imageRequested])

  const handleImageLoad = () => {
    queryClient.setQueryData(["bookmark-image", rawImageUrl], currentSrc)
    setImageStatus("ready")
  }

  const handleImageError = () => {
    queryClient.removeQueries({ queryKey: ["bookmark-image", rawImageUrl], exact: true })
    // If the proxied image failed, try falling back directly to raw URL before giving up
    if (
      currentSrc === proxiedImageUrl &&
      rawImageUrl &&
      proxiedImageUrl !== rawImageUrl
    ) {
      setCurrentSrc(rawImageUrl)
    } else {
      setImageStatus("error")
    }
  }

  const copyUrl = () => {
    navigator.clipboard?.writeText(bookmark.url)
    toast.success("URL copied to clipboard")
  }

  // One action list feeds the ⋯ menu and the right-click menu. Pin and favorite already have
  // their own buttons beside the ⋯ menu, so they, Open and Select only appear on right-click.
  const actionGroups: CardAction[][] = isTrashView
    ? [[
        { key: "restore", label: "Restore", Icon: ArrowCounterClockwise, onSelect: () => onRestoreBookmark?.(bookmark.id), contextOnly: true },
      ], [
        { key: "delete-permanently", label: "Delete permanently", Icon: Trash, onSelect: () => onPermanentDeleteBookmark?.(bookmark.id), destructive: true, contextOnly: true },
      ]]
    : [
        [
          { key: "open", label: isNote ? "Open note" : isDrawing ? "Open drawing" : "Open preview", Icon: Eye, onSelect: () => (onInspectBookmark ?? onEditBookmark)(bookmark), contextOnly: true },
          ...(sourceHref ? [{ key: "source", label: "Open source page", Icon: ArrowSquareOut, href: sourceHref }] : []),
          ...(!inCabinet && originalHref ? [{ key: "original", label: "Open original", Icon: ArrowSquareOut, href: originalHref }] : []),
          ...(!inCabinet ? [{ key: "copy", label: "Copy link", Icon: LinkSimple, onSelect: copyUrl }] : []),
        ],
        access === "viewer" ? [] : [
          ...(own && onTogglePin ? [{ key: "pin", label: bookmark.isPinned ? "Unpin" : "Pin to top", Icon: PushPin, onSelect: () => onTogglePin(bookmark), contextOnly: true }] : []),
          ...(own ? [{ key: "favorite", label: bookmark.isFavorite ? "Remove from favorites" : "Add to favorites", Icon: Star, onSelect: () => onToggleFavorite(bookmark), contextOnly: true }] : []),
          ...(own ? [{ key: "select", label: isSelected ? "Deselect" : "Select", Icon: CheckSquare, onSelect: onToggleSelect, contextOnly: true }] : []),
          ...(canDownload && onOpenDownload ? [{ key: "download", label: "Download media", Icon: DownloadSimple, onSelect: () => onOpenDownload(bookmark) }] : []),
        ],
        access === "viewer" ? [] : [
          { key: "edit", label: "Edit details", Icon: PencilSimple, onSelect: () => onEditBookmark(bookmark) },
          ...(!isDrawing ? [{ key: "duplicate", label: "Duplicate", Icon: Copy, onSelect: () => onDuplicateBookmark(bookmark) }] : []),
          ...(own ? [{ key: "archive", label: bookmark.isArchived ? "Unarchive" : "Archive", Icon: Archive, onSelect: () => onToggleArchive(bookmark) }] : []),
        ],
        access === "viewer" ? [] : [
          { key: "trash", label: "Move to Trash", Icon: Trash, onSelect: () => onDeleteBookmark(bookmark.id), destructive: true },
        ],
      ]

  const renderMenuActions = (menu: "dropdown" | "context") => {
    const Item = (menu === "dropdown" ? DropdownMenuItem : ContextMenuItem) as typeof ContextMenuItem
    const Separator = menu === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator
    const itemClass = menu === "dropdown" ? "flex items-center gap-2 text-xs" : undefined
    const iconClass = menu === "dropdown" ? "size-3.5" : undefined
    return actionGroups
      .map((group) => group.filter((action) => menu === "context" || !action.contextOnly))
      .filter((group) => group.length > 0)
      .map((group, index) => (
        <React.Fragment key={group.map((action) => action.key).join()}>
          {index > 0 && <Separator />}
          {group.map(({ key, label, Icon, onSelect, href, destructive }) => href ? (
            <Item key={key} asChild className={itemClass}>
              <a href={href} target="_blank" rel="noopener noreferrer"><Icon className={iconClass} /><span>{label}</span></a>
            </Item>
          ) : (
            <Item key={key} variant={destructive ? "destructive" : "default"} onSelect={onSelect} className={itemClass}>
              <Icon className={iconClass} /><span>{label}</span>
            </Item>
          ))}
        </React.Fragment>
      ))
  }

  // Right-click and the keyboard menu key only: on touch, long-press already starts a drag and ⋯ opens the action sheet.
  const lastPointerType = React.useRef("mouse")
  const withContextMenu = (card: React.ReactElement) => (
    <ContextMenu modal={false}>
      <ContextMenuTrigger
        asChild
        disabled={!showActions}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType
          if (event.pointerType !== "mouse") event.preventDefault()
        }}
        onContextMenu={(event) => { if (lastPointerType.current !== "mouse") event.preventDefault() }}
      >
        {card}
      </ContextMenuTrigger>
      {/* Menu clicks must not reach the sortable item or the card behind the portal. */}
      <ContextMenuContent className="w-52" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        {renderMenuActions("context")}
      </ContextMenuContent>
    </ContextMenu>
  )

  // Shared by the card styles: selection checkbox and hover actions over the preview.
  const overlays = (
    <>
      {showActions && own && <div data-bookmark-actions
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute top-2.5 left-2.5 z-20 flex items-center gap-1 rounded-sm border border-border/60 bg-card/95 p-1 shadow-xs transition-opacity",
          isSelected || hasSelectedItems
            ? "opacity-100"
            : "hidden focus-within:opacity-100 sm:flex sm:opacity-0 sm:group-hover/card:opacity-100"
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select ${bookmark.title || "bookmark"}`}
          className="border-input"
        />
      </div>}

      {/* Standalone favorite badge shown at rest without keeping the whole action toolbar visible */}
      {bookmark.isFavorite && (
        <div
          aria-label="Favorite"
          className="pointer-events-none absolute top-2.5 right-2.5 z-10 flex size-6 items-center justify-center rounded-sm bg-card/90 text-amber-500 shadow-xs transition-opacity sm:group-hover/card:opacity-0 sm:group-focus-within/card:opacity-0 dark:text-amber-400"
        >
          <Star weight="fill" className="size-3.5" />
        </div>
      )}

      {/* Desktop quick actions stay off the saved preview until hovered or focused. */}
      {showActions && (
        <div
          data-bookmark-actions
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 z-20 hidden items-center gap-0.5 rounded-sm border border-border/60 bg-card/95 p-0.5 shadow-xs transition-opacity sm:flex sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-within:opacity-100"
        >
        {isTrashView ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onRestoreBookmark?.(bookmark.id)}
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 text-brand-charcoal hover:bg-brand-charcoal/10"
                  title="Restore"
                >
                  <ArrowCounterClockwise className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restore</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onPermanentDeleteBookmark?.(bookmark.id)}
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  title="Delete permanently"
                >
                  <Trash className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete permanently</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            {onTogglePin && own && (
              <Button
                className="hidden sm:inline-flex"
                variant="ghost"
                size="icon-xs"
                onClick={() => onTogglePin(bookmark)}
                title={bookmark.isPinned ? "Unpin bookmark" : "Pin to top"}
                aria-label={bookmark.isPinned ? "Unpin bookmark" : "Pin to top"}
                aria-pressed={!!bookmark.isPinned}
              >
                <PushPin weight={bookmark.isPinned ? "fill" : "regular"} />
              </Button>
            )}
            {/* Star / Favorite */}
            {own && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onToggleFavorite(bookmark)}
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      "hidden size-6 sm:inline-flex",
                      bookmark.isFavorite && "text-amber-500 hover:text-amber-600 dark:text-amber-400"
                    )}
                    title={bookmark.isFavorite ? "Unfavorite" : "Favorite"}
                  >
                    <Star
                      className="size-3.5"
                      weight={bookmark.isFavorite ? "fill" : "regular"}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{bookmark.isFavorite ? "Remove from favorites" : "Add to favorites"}</TooltipContent>
              </Tooltip>
            )}

            {/* Download Video Media if available */}
            {canDownload && onOpenDownload && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onOpenDownload(bookmark)}
                    variant="ghost"
                    size="icon-xs"
                    className="hidden size-6 sm:inline-flex"
                    title="Download media"
                  >
                    <DownloadSimple className="size-3.5" weight="bold" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download media</TooltipContent>
              </Tooltip>
            )}

            {/* Desktop 3-Dot Dropdown */}
            <div className="hidden md:inline-flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-6 text-brand-muted hover:text-brand-charcoal"
                    title="More actions"
                  >
                    <DotsThreeVertical className="size-3.5" weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {renderMenuActions("dropdown")}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
      )}
    </>
  )

  const cardBehavior = {
    // The context menu trigger would otherwise stamp its own data-slot over the card's.
    "data-slot": "card",
    draggable: nativeDrag && bookmark.canEdit !== false,
    "data-readonly": access === "viewer",
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
      if (!nativeDrag) {
        e.preventDefault()
        return
      }
      // Pack selected IDs if current card is part of selection, otherwise pack this single ID
      const ids = isSelected && selectedBookmarkIds.length > 0 ? selectedBookmarkIds : [bookmark.id]
      startBookmarkDrag(e, ids, bookmark.title || hostname || "Bookmark")
    },
    onClick: activate,
  }

  if (preferences.density === "visual") {
    const showPicture = !inCabinet && preferences.showImage && imageStatus !== "error"
    // Type-only links use their URL-derived headline as the caption beneath the card.
    const typeOnly = !inCabinet && !showPicture && !isPdf
    // A quote is credited to its site, the way a pull quote names its source.
    const caption = (preferences.showTitle || isPdf)
      ? quote ? hostname.replace(/^www\./, "") : typeOnly ? typeOnlyHeadline : bookmark.title || (isDrawing ? "Untitled drawing" : isNote ? "Untitled note" : hostname)
      : ""
    const linkStatus = inCabinet ? "" : bookmark.status === "BROKEN" ? "Broken" : bookmark.status === "REDIRECTED" ? "Redirected" : ""
    const mobileActions = showActions && onOpenActionSheet && access !== "viewer"
    const CaptionTag = inCabinet ? "button" : "p"

    return withContextMenu(
      <Card
        {...cardBehavior}
        className="group/card [&[data-readonly=true]_[data-bookmark-actions]]:hidden flex h-auto min-h-52 w-full cursor-pointer flex-col gap-2.5 overflow-visible border-0 bg-transparent text-card-foreground shadow-none"
      >
        <div
          className={cn(
            "relative min-h-44 w-full overflow-hidden rounded-lg bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-18px_rgb(0_0_0/0.28)] transition-shadow group-hover/card:shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_40px_-18px_rgb(0_0_0/0.36)] motion-reduce:transition-none dark:shadow-none",
            isSelected ? "ring-2 ring-inset ring-library-olive" : "dark:ring-1 dark:ring-border/60"
          )}
        >
          {overlays}
          {quote ? (
            <figure onClick={activate} className="flex min-h-44 flex-col items-center justify-center gap-2 px-8 py-7 text-center font-serif text-foreground">
              <span aria-hidden="true" className="text-2xl leading-none text-muted-foreground">“</span>
              <blockquote className="line-clamp-[10] text-lg leading-relaxed whitespace-pre-line"><SearchHighlight text={quote} /></blockquote>
              <span aria-hidden="true" className="text-2xl leading-none text-muted-foreground">”</span>
            </figure>
          ) : isNote ? (
            // Gallery cards stay evenly padded; the hover actions only cover the corner while pointed at.
            <div onClick={activate} className="flex min-h-44 flex-col p-6 text-foreground">
              <NoteContentPreview bookmark={bookmark} showHeader={true} />
            </div>
          ) : isDrawing ? (
            <div onClick={activate} className="flex aspect-[16/10] w-full items-center justify-center bg-white dark:hue-rotate-180 dark:invert">
              {bookmark.imageUrl
                ? <img src={bookmark.imageUrl} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-contain p-3" />
                : <span className="text-xs text-neutral-500">Empty drawing</span>}
            </div>
          ) : isPdf ? (
            <a
              href={originalHref || undefined}
              aria-label={`Open ${bookmark.title || "PDF"} in Cabinet`}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              onClick={activate}
              className="relative flex min-h-44 w-full flex-col justify-end overflow-hidden bg-muted/20 text-center hover:bg-muted/30"
              style={{ aspectRatio: pdfAspectRatio }}
            >
              {originalHref ? (
                <PdfPagePreview src={originalHref} bookmarkId={bookmark.id} onRatio={setPdfAspectRatio} />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-lg bg-card shadow-xs">
                  <FilePdf className="size-7 text-destructive" />
                </div>
              )}
            </a>
          ) : (
            <a
              href={originalHref || undefined}
              aria-label={`Preview ${bookmark.title || hostname} in Cabinet`}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              onClick={activate}
              className="relative block w-full"
            >
              {showPicture ? (
                <>
                  {imageStatus === "loading" && (
                    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-muted/40 text-xs text-muted-foreground" role="status" aria-label="Loading thumbnail">
                      <Clock className="size-5 animate-spin" style={{ animationDuration: "3s" }} />
                      {isPendingEnrichment ? "Generating preview..." : "Loading thumbnail..."}
                    </div>
                  )}
                  {currentSrc && (
                    <img
                      ref={imageRef}
                      draggable={false}
                      // Keep a layout box while loading so native lazy loading can observe it.
                      loading="lazy"
                      decoding="async"
                      src={imageRequested ? currentSrc : undefined}
                      alt={bookmark.title || hostname}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      className={cn("block h-auto min-h-44 max-h-[36rem] w-full object-cover transition-opacity duration-200 motion-reduce:transition-none", imageStatus === "ready" ? "opacity-100" : "absolute inset-0 h-full opacity-0")}
                    />
                  )}
                  {isVideo && imageStatus === "ready" && (
                    <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-sm bg-card/90 px-1.5 py-0.5 text-xs text-foreground">
                      <VideoCamera className="size-3" aria-hidden="true" />Video
                    </span>
                  )}
                </>
              ) : (
                <span className="flex min-h-44 flex-col justify-between gap-3 p-6">
                  {fallbackIcon}
                  {showWebsite && (!titleDuplicatesHost || typeOnlyHeadline !== siteLabel) && <span className="truncate font-serif text-base text-muted-foreground">{siteLabel}</span>}
                </span>
              )}
            </a>
          )}
        </div>

        {(caption || linkStatus || bookmark.isPinned || mobileActions) && (
          <div className="flex items-start gap-1 px-1">
            {/* Balances the mobile actions button so the caption stays centred under the card. */}
            {mobileActions && <span aria-hidden="true" className="size-11 shrink-0 md:hidden" />}
            <CaptionTag
              {...(inCabinet ? { type: "button" as const, onClick: activate } : {})}
              className="line-clamp-2 min-w-0 flex-1 text-center text-sm leading-5 text-muted-foreground"
            >
              {bookmark.isPinned && <PushPin className="mr-1 inline size-3 align-[-1px] text-library-olive" weight="fill" aria-label="Pinned" />}
              {linkStatus && <span className={cn("mr-1.5", linkStatus === "Broken" && "text-destructive")}>{linkStatus}{caption && " ·"}</span>}
              {caption}
            </CaptionTag>
            {mobileActions && <Button data-bookmark-actions type="button" variant="ghost" size="icon" className="-my-3 size-11 shrink-0 md:hidden" aria-label="Bookmark actions" onClick={(event) => { event.stopPropagation(); onOpenActionSheet(bookmark) }}><DotsThreeVertical /></Button>}
          </div>
        )}
      </Card>
    )
  }

  return withContextMenu(
    <Card
      {...cardBehavior}
      className={cn(
        "group/card [&[data-readonly=true]_[data-bookmark-actions]]:hidden flex h-auto min-h-52 w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border/80 bg-card text-card-foreground shadow-none transition-colors hover:border-foreground/25",
        isSelected
          ? "border-library-olive ring-1 ring-library-olive/30"
          : "border-border/80"
      )}
    >
      {/* Top Visual Image Header Container */}
      <div className={cn("relative w-full shrink-0 overflow-hidden bg-muted/30", showActions && !inCabinet && !preferences.showImage && (hasSelectedItems ? "min-h-10" : "sm:min-h-10"))}>
        {/* Checkbox Overlay (Top Left) */}
        {overlays}

        {isNote ? (
          <div
            onClick={activate}
            // Top padding keeps the hover checkbox and actions clear of the note's first line.
            className={cn("relative flex min-h-36 w-full cursor-pointer flex-col bg-muted/40 p-4 text-foreground", showActions && "pt-11")}
          >
            <div className="space-y-1.5">
              {/* The note body is the card's preview, like a link's image, so it ignores the Description toggle. */}
              <NoteContentPreview bookmark={bookmark} showHeader={false} />
            </div>
          </div>
        ) : isDrawing ? (
          <div
            onClick={activate}
            // Drawings are stored on white; dark mode inverts the whole preview the way Excalidraw's own dark theme does.
            className={cn("relative flex aspect-[16/10] w-full cursor-pointer items-center justify-center overflow-hidden bg-white dark:hue-rotate-180 dark:invert", showActions && "pt-8")}
          >
            {bookmark.imageUrl ? (
              <img src={bookmark.imageUrl} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-contain p-3" />
            ) : (
              <span className="text-xs text-neutral-500">Empty drawing</span>
            )}
          </div>
        ) : isPdf && preferences.showImage ? (
          <a
            href={originalHref || undefined}
            aria-label={`Preview ${bookmark.title || "PDF"} in Cabinet`}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onClick={activate}
            className="group/header relative block w-full overflow-hidden bg-muted/20"
          >
            <div className="relative min-h-44 w-full overflow-hidden bg-white" style={{ aspectRatio: pdfAspectRatio }}>
              {originalHref ? <PdfPagePreview src={originalHref} bookmarkId={bookmark.id} onRatio={setPdfAspectRatio} /> : <div className="flex h-full min-h-28 items-center justify-center"><FilePdf className="size-8 text-muted-foreground" /></div>}
            </div>
          </a>
        ) : preferences.showImage ? (
          <a
            href={originalHref || undefined}
            aria-label={`Preview ${bookmark.title || hostname} in Cabinet`}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onClick={activate}
            className="group/header relative block w-full overflow-hidden bg-muted/20"
          >
            <>
              {/* Thumbnail loading state with Clock icon */}
              {imageStatus === "loading" && (
                <div
                  className="relative flex aspect-[16/10] w-full flex-col items-center justify-center bg-muted/40 p-4 text-muted-foreground"
                  role="status"
                  aria-label="Loading thumbnail"
                >
                  <div className="flex size-10 items-center justify-center rounded-sm border border-border/60 bg-background/80 shadow-2xs">
                    <Clock
                      className="size-5 text-muted-foreground animate-spin"
                      style={{ animationDuration: "3s" }}
                    />
                  </div>
                  <span className="mt-2 text-xs text-muted-foreground">
                    {isPendingEnrichment
                      ? "Generating preview..."
                      : "Loading thumbnail..."}
                  </span>
                </div>
              )}

              {currentSrc && (
                <img
                  ref={imageRef}
                  draggable={false}
                  // Keep a layout box while loading so native lazy loading can observe it.
                  loading="lazy"
                  decoding="async"
                  src={imageRequested ? currentSrc : undefined}
                  alt={bookmark.title || hostname}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  className={cn(
                    "block h-auto max-h-96 w-full object-cover transition-opacity duration-200 motion-reduce:transition-none",
                    imageStatus === "ready" ? "opacity-100" : "absolute inset-0 h-full opacity-0"
                  )}
                />
              )}

              {imageStatus === "error" && (
                <div className={cn("relative flex w-full flex-col justify-end bg-muted/50 px-4 pb-4 pt-14", showWebsite ? "min-h-28" : "min-h-14")}>
                  {fallbackIcon}
                  {showWebsite && <span className="max-w-full truncate font-serif text-2xl tracking-tight text-muted-foreground">{hostname.replace(/^www\./, "")}</span>}
                </div>
              )}
            </>
          </a>
        ) : null}
      </div>

      {/* Card Content */}
      <CardContent className={cn("flex flex-1 flex-col", preferences.density === "compact" ? "gap-2 p-3" : "gap-3 p-4")}>
        <div className="flex flex-col gap-1.5">
          {isVideo && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="rounded-sm border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                <VideoCamera className="mr-1 inline-block size-3" />
                Video
              </Badge>
            </div>
          )}

          {preferences.showTitle &&
            (inCabinet ? (
              <button
                type="button"
                onClick={activate}
                className={cn("group/title flex items-start gap-1.5 text-left leading-6 font-medium text-foreground", preferences.density === "compact" ? "text-sm" : "text-[15px]")}
              >
                {isDrawing
                  ? <Scribble aria-label="Drawing" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  : <FileText aria-label="Note" className="mt-1 size-4 shrink-0 text-muted-foreground" />}
                <span className="line-clamp-2 group-hover/title:underline"><SearchHighlight text={bookmark.title || (isDrawing ? "Untitled drawing" : "Untitled note")} /></span>
              </button>
            ) : (
              <a
                href={originalHref || undefined}
                title={bookmark.title || bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                onClick={(event) => event.stopPropagation()}
                className={cn("group/link line-clamp-2 leading-6 font-medium text-foreground decoration-foreground/30 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring", preferences.density === "compact" ? "text-sm" : "text-[15px]")}
              >
                <SearchHighlight text={bookmark.title || bookmark.url} />
              </a>
            ))}
          {!inCabinet &&
            (bookmark.status === "BROKEN" ||
              bookmark.status === "REDIRECTED") && (
              <div className="flex flex-wrap items-center gap-1.5">
                {bookmark.status === "BROKEN" && (
                  <Badge
                    variant="outline"
                    className="shrink-0 rounded-sm border-none bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
                  >
                    Broken
                  </Badge>
                )}
                {bookmark.status === "REDIRECTED" && (
                  <Badge
                    variant="outline"
                    className="shrink-0 rounded-sm border-none bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    title="URL updated automatically to new address"
                  >
                    Redirected
                  </Badge>
                )}
              </div>
            )}
          {preferences.showDescription && !inCabinet && bookmark.description && (
            <p className={cn("line-clamp-2 leading-5 text-muted-foreground", preferences.density === "compact" ? "text-xs" : "text-sm")}>
              <SearchHighlight text={bookmark.description} />
            </p>
          )}
          {showWebsite && hostname && (imageStatus !== "error" || !preferences.showImage) && (
            <p className="truncate text-xs leading-5 text-muted-foreground">
              {hostname}
            </p>
          )}
        </div>

        {access === "viewer" && <p className="text-xs text-muted-foreground">Shared · View only</p>}
        {(preferences.showFolder || preferences.showDate || bookmark.isPinned) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs leading-5 text-muted-foreground">
            {bookmark.isPinned && <span className="flex items-center gap-1 text-library-olive"><PushPin className="size-3" weight="fill" />Pinned</span>}
            {preferences.showFolder && (
              <span className="flex min-w-0 max-w-full items-center gap-1" title={folderName || "Unfiled"}>
                <FolderSimple className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{folderName || "Unfiled"}</span>
              </span>
            )}
            {preferences.showDate && bookmark.createdAt && (
              <time dateTime={bookmark.createdAt} title="Date added" className="whitespace-nowrap">
                {new Date(bookmark.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </time>
            )}
          </div>
        )}
        {(bookmark.tags?.length > 0 || (showActions && onOpenActionSheet && access !== "viewer")) && (
          <div className={cn("flex items-center justify-between gap-2", !bookmark.tags?.length && "md:hidden")}>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {bookmark.tags?.slice(0, 3).map((tag: any) => (
              <button
                type="button"
                key={tag.id || tag.name}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectTag(tag.name)
                }}
                className="cursor-pointer rounded-sm bg-muted/60 px-1.5 py-1 text-xs text-muted-foreground hover:bg-library-highlight hover:text-library-olive focus-visible:outline-2 focus-visible:outline-ring"
              >
                #{tag.name}
              </button>
            ))}
            {bookmark.tags?.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{bookmark.tags.length - 3}
              </span>
            )}
          </div>
          {showActions && onOpenActionSheet && access !== "viewer" && <Button data-bookmark-actions type="button" variant="ghost" size="icon" className="size-11 shrink-0 md:hidden" aria-label="Bookmark actions" onClick={(event) => { event.stopPropagation(); onOpenActionSheet(bookmark) }}><DotsThreeVertical /></Button>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
