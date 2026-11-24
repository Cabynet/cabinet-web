import assert from "node:assert/strict"
import test from "node:test"
import { adjacentPreviewBookmark, moodboardColumnCount, moodboardGap } from "../src/lib/bookmark-view.ts"

test("masonry columns follow container width and density", () => {
  // Comfortable: one column on phones, four at a 1440px window with the sidebar open, never more than four.
  for (const [width, expected] of [[320, 1], [479, 1], [600, 1], [767, 2], [1023, 3], [1132, 4], [1400, 4], [2000, 4]]) {
    assert.equal(moodboardColumnCount(width, "comfortable"), expected, `comfortable ${width}`)
  }
  // Compact and Visual fit two columns on phones and four at a 1440px window with the sidebar open.
  for (const density of ["compact", "visual"]) {
    assert.equal(moodboardColumnCount(358, density), 2, `${density} phone`)
    assert.equal(moodboardColumnCount(1132, density), 4, `${density} desktop`)
    assert.equal(moodboardColumnCount(2400, density), 4, `${density} never more than four columns`)
  }
  // Opening the inspector reduces container width without changing the viewport.
  assert.equal(moodboardColumnCount(1000), 3)
  assert.equal(moodboardColumnCount(0), 4)
  assert.equal(moodboardGap(358, "visual"), 12)
  assert.equal(moodboardGap(1132, "visual"), 20)
})

test("preview navigation follows displayed order, skips notes, and stops at boundaries", () => {
  const bookmarks = [
    { id: "first", url: "https://example.com/1" },
    { id: "note", type: "NOTE", url: "https://example.com/note" },
    { id: "empty" },
    { id: "second", url: "https://example.com/2" },
  ]
  assert.equal(adjacentPreviewBookmark(bookmarks, "first", 1), bookmarks[3])
  assert.equal(adjacentPreviewBookmark(bookmarks, "second", -1), bookmarks[0])
  assert.equal(adjacentPreviewBookmark(bookmarks, "first", -1), undefined)
  assert.equal(adjacentPreviewBookmark(bookmarks, "second", 1), undefined)
  assert.equal(adjacentPreviewBookmark(bookmarks, "missing", 1), undefined)
})
