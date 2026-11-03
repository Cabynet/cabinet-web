import assert from "node:assert/strict"
import test from "node:test"
import { pendingBookmarkIds, mergeBookmarkPreviews, mergeBookmarkPage } from "../src/lib/bookmark-polling.ts"
import { directImageUrl } from "../src/lib/signed-proxy.ts"
const item = (id, metadataStatus = "PENDING") => ({ id, metadataStatus, rawUrl: `https://example.test/${id}`, updatedAt: "2026-01-01T00:00:00Z", notesPlain: "Personal note", tags: [{ name: "design" }] })
const pages = (...items) => ({ pages: [{ items, nextCursor: "next", totalCount: 300, hasMore: true }], pageParams: [undefined] })
test("only pending IDs are requested across pages, deduplicated and bounded", () => {
  const data = pages(item("1"), item("2", "COMPLETED"), item("3", "PROCESSING"), item("4", "FAILED"))
  data.pages.push(pages(item("1")).pages[0])
  assert.deepEqual(pendingBookmarkIds(data), ["1", "3"])
  assert.equal(pendingBookmarkIds(pages(...Array.from({ length: 200 }, (_, i) => item(String(i))))).length, 100)
  assert.deepEqual(pendingBookmarkIds(undefined), [])
})
test("preview patches preserve personal fields and pagination", () => {
  const data = pages(item("1"), item("2"))
  const updated = mergeBookmarkPreviews(data, [{ id: "1", rawUrl: "https://example.test/1", updatedAt: "2026-01-02T00:00:00Z", metadataStatus: "COMPLETED", thumbnailUrl: "https://cdn.test/a.webp" }])
  assert.equal(updated.pages[0].items[0].thumbnailUrl, "https://cdn.test/a.webp")
  assert.equal(updated.pages[0].items[0].notesPlain, "Personal note")
  assert.deepEqual(updated.pages[0].items[0].tags, [{ name: "design" }])
  assert.equal(updated.pages[0].nextCursor, "next")
  assert.equal(updated.pages[0].totalCount, 300)
  assert.equal(updated.pages[0].items[1], data.pages[0].items[1])
  assert.equal(data.pages[0].items[0].metadataStatus, "PENDING")
  assert.deepEqual(pendingBookmarkIds(updated), ["2"])
})
test("late worker patches cannot replace a changed URL or newer edits", () => {
  const data = pages(item("1"))
  for (const patch of [
    { id: "1", rawUrl: "https://other.test/", updatedAt: "2026-01-02T00:00:00Z" },
    { id: "1", rawUrl: "https://example.test/1", updatedAt: "2025-12-31T00:00:00Z" },
  ]) assert.equal(mergeBookmarkPreviews(data, [patch]).pages[0].items[0], data.pages[0].items[0])
})
test("cached public thumbnails bypass the remote hotlink proxy", () => {
  const key = "/uploads/u1/2026-10/12345678-1234-1234-1234-123456789abc-thumbnail.webp"
  assert.equal(directImageUrl(`https://cdn.test${key}`), `https://cdn.test${key}`)
  assert.equal(directImageUrl("https://mobbin.com/api/og/app?a=b"), null) // needs a signed proxy URL
  assert.equal(directImageUrl(""), "")
})

test("page merge ignores query data without items, such as search infinite queries", () => {
  const searchCache = { pages: [], pageParams: [] }
  assert.equal(mergeBookmarkPage(searchCache, []), searchCache)
})
