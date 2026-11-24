import assert from "node:assert/strict"
import test from "node:test"
import { activateBookmark } from "../src/lib/bookmark-click.ts"

function click(bookmark, options = {}, modifiers = {}) {
  const opened = []
  const calls = []
  globalThis.window = { open: (...args) => opened.push(args) }
  const event = { stopPropagation() {}, preventDefault() {}, currentTarget: {}, shiftKey: false, metaKey: false, ctrlKey: false, ...modifiers }
  activateBookmark(event, {
    bookmark,
    selectionMode: false,
    onToggleSelect: () => calls.push("select"),
    onOpen: () => calls.push("preview"),
    ...options,
  })
  return { opened, calls }
}

const link = { id: "1", url: "https://example.com/article", type: "BOOKMARK" }

test("a click opens the preview by default", () => {
  assert.deepEqual(click(link), { opened: [], calls: ["preview"] })
})

test("with openDirectly a link opens its page in a new tab instead", () => {
  const { opened, calls } = click(link, { openDirectly: true })
  assert.deepEqual(calls, [])
  assert.deepEqual(opened, [["https://example.com/article", "_blank", "noopener,noreferrer"]])
})

test("notes, unsafe URLs and selection keep their own behaviour", () => {
  assert.deepEqual(click({ id: "2", url: null, type: "NOTE" }, { openDirectly: true }).calls, ["preview"])
  assert.deepEqual(click({ id: "3", url: "javascript:alert(1)", type: "BOOKMARK" }, { openDirectly: true }), { opened: [], calls: ["preview"] })
  assert.deepEqual(click(link, { openDirectly: true, selectionMode: true }).calls, ["select"])
  assert.deepEqual(click(link, { openDirectly: true }, { shiftKey: true }).calls, ["select"])
})
