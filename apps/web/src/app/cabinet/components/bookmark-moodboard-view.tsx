"use client"

import React from "react"
import { useDndContext } from "@dnd-kit/core"
import { Masonry, MasonryItem } from "@/components/ui/masonry"
import { bookmarkCollisionDetection, masonrySortingStrategy } from "@/lib/bookmark-sortable"
import { Badge } from "@/components/ui/badge"
import { type DisplayPreferences } from "./display-preferences"
import { Sortable, SortableContent, SortableItem, SortableOverlay } from "@/components/ui/sortable"
import { MoodboardCard } from "./moodboard-card"
import type { MoodboardCardProps } from "./moodboard-card"
export { MoodboardCard }

export function MoodboardDragPreview({ bookmark, count, children }: {
  bookmark: any
  count: number
  children: React.ReactNode
}) {
  const { over } = useDndContext()
  return (
    <div inert aria-hidden="true" className="pointer-events-none">
      {over?.data.current?.type === "folder" ? (
        <Badge variant="secondary" className="max-w-44 truncate">
          {count > 1 ? `${count} bookmarks` : bookmark.title || "Bookmark"}
        </Badge>
      ) : children}
    </div>
  )
}

interface BookmarkMoodboardViewProps {
  /** Dashboard shares its drag context with sidebar folder targets. */
  sortableInParent?: boolean
  onTogglePin?: (bookmark: any) => void
  displayPreferences?: DisplayPreferences
  bookmarks: any[]
  folders?: any[]
  activeColumnCount: number
  selectedBookmarkIds: string[]
  onToggleSelect: (id: string) => void
  onSelectTag: (tagName: string) => void
  onToggleFavorite: (bookmark: any) => void
  onToggleArchive: (bookmark: any) => void
  onEditBookmark: (bookmark: any) => void
  onDeleteBookmark: (id: string) => void
  onDuplicateBookmark: (bookmark: any) => void
  getHostname: (url: string) => string
  onReorder?: (newOrder: any[]) => void
  isTrashView?: boolean
  onRestoreBookmark?: (id: string) => void
  onPermanentDeleteBookmark?: (id: string) => void
  onOpenActionSheet?: (bookmark: any) => void
  onOpenDownload?: (bookmark: any) => void
  onInspectBookmark?: (bookmark: any) => void
}

const NO_SELECTION: string[] = []

type GridCardProps = Omit<MoodboardCardProps, "onToggleSelect"> & { onToggleSelect: (id: string) => void }

/** Re-renders only when its own bookmark, selection state or a (stable) handler changes. */
const GridCard = React.memo(function GridCard({ onToggleSelect, ...props }: GridCardProps) {
  const id = props.bookmark.id
  const toggle = React.useCallback(() => onToggleSelect(id), [onToggleSelect, id])
  return <MoodboardCard {...props} onToggleSelect={toggle} />
})

export function BookmarkMoodboardView({
  sortableInParent = false,
  onTogglePin,
  displayPreferences,
  bookmarks,
  folders,
  activeColumnCount,
  selectedBookmarkIds,
  onToggleSelect,
  onSelectTag,
  onToggleFavorite,
  onToggleArchive,
  onEditBookmark,
  onDeleteBookmark,
  onDuplicateBookmark,
  getHostname,
  onReorder,
  isTrashView,
  onRestoreBookmark,
  onPermanentDeleteBookmark,
  onOpenActionSheet,
  onOpenDownload,
  onInspectBookmark,
}: BookmarkMoodboardViewProps) {
  const canSort = !isTrashView && !!onReorder
  const hasSelectedItems = selectedBookmarkIds.length > 0
  const renderCard = (bookmark: any) => {
    const isSelected = selectedBookmarkIds.includes(bookmark.id)
    return (
      <GridCard
        nativeDrag={false}
        onTogglePin={onTogglePin}
        displayPreferences={displayPreferences}
        bookmark={bookmark}
        folders={folders}
        onSelectTag={onSelectTag}
        onToggleFavorite={onToggleFavorite}
        onToggleArchive={onToggleArchive}
        onEditBookmark={onEditBookmark}
        onDeleteBookmark={onDeleteBookmark}
        onDuplicateBookmark={onDuplicateBookmark}
        getHostname={getHostname}
        isSelected={isSelected}
        hasSelectedItems={hasSelectedItems}
        // Only a selected card reads the selection (to drag the whole group), so the others keep a stable prop.
        selectedBookmarkIds={isSelected ? selectedBookmarkIds : NO_SELECTION}
        onToggleSelect={onToggleSelect}
        isTrashView={isTrashView}
        onRestoreBookmark={onRestoreBookmark}
        onPermanentDeleteBookmark={onPermanentDeleteBookmark}
        onOpenActionSheet={onOpenActionSheet}
        onOpenDownload={onOpenDownload}
        onInspectBookmark={onInspectBookmark}
      />
    )
  }
  const content = (
    <>
      <SortableContent withoutSlot>
        <Masonry columnCount={activeColumnCount} gap={displayPreferences?.density === "visual" ? 20 : 12} linear virtualize={false}>
          {bookmarks.map((bookmark) => (
            <MasonryItem key={bookmark.id}>
              <SortableItem
                value={bookmark.id}
                asHandle={canSort && !bookmark.isPinned && bookmark.canEdit !== false}
                disabled={!canSort || bookmark.isPinned || bookmark.canEdit === false}
                aria-label={`Reorder ${bookmark.title || "bookmark"}`}
                className="w-full rounded-md data-dragging:opacity-30 data-sort-over:ring-2 data-sort-over:ring-primary"
              >
                {renderCard(bookmark)}
              </SortableItem>
            </MasonryItem>
          ))}
        </Masonry>
      </SortableContent>
      <SortableOverlay dropAnimation={null}>
        {({ value }) => {
          const bookmark = bookmarks.find((item) => item.id === value)
          return bookmark ? (
            <MoodboardDragPreview
              bookmark={bookmark}
              count={selectedBookmarkIds.includes(bookmark.id) ? selectedBookmarkIds.length : 1}
            >
              {renderCard(bookmark)}
            </MoodboardDragPreview>
          ) : null
        }}
      </SortableOverlay>
    </>
  )
  return sortableInParent ? content : (
    <Sortable
      value={bookmarks}
      onValueChange={onReorder}
      getItemValue={(item) => item.id}
      orientation="mixed"
      strategy={masonrySortingStrategy}
      collisionDetection={bookmarkCollisionDetection}
    >
      {content}
    </Sortable>
  )
}
