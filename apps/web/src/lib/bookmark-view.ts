type Density = "comfortable" | "compact" | "visual"

// Narrowest a card may get before the grid drops a column. Phones allow two
// small columns for the denser layouts; Comfortable stays a single readable column.
// Comfortable fits four columns at a 1440px window with the sidebar open.
const MIN_CARD_WIDTH: Record<Density, number> = { comfortable: 250, compact: 240, visual: 220 }
const PHONE_MIN_CARD_WIDTH: Record<Density, number> = { comfortable: 300, compact: 150, visual: 150 }
const PHONE_WIDTH = 640
// Every density tops out at four columns; wider screens get wider cards instead.
const MAX_COLUMNS = 4

export function moodboardGap(width: number, density: Density = "comfortable"): number {
  return density === "visual" && width >= PHONE_WIDTH ? 20 : 12
}

export function moodboardColumnCount(width: number, density: Density = "comfortable"): number {
  if (width <= 0) return 4
  const min = (width < PHONE_WIDTH ? PHONE_MIN_CARD_WIDTH : MIN_CARD_WIDTH)[density]
  const gap = moodboardGap(width, density)
  return Math.min(MAX_COLUMNS, Math.max(1, Math.floor((width + gap) / (min + gap))))
}

export function adjacentPreviewBookmark<T extends { id: string; url?: string; type?: string }>(
  bookmarks: T[], currentId: string, offset: -1 | 1,
) {
  const previewable = bookmarks.filter((bookmark) => bookmark.url && bookmark.type !== "NOTE")
  const index = previewable.findIndex((bookmark) => bookmark.id === currentId)
  return index < 0 ? undefined : previewable[index + offset]
}
