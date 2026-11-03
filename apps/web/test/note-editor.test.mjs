import assert from "node:assert/strict"
import test from "node:test"
import { NoteAutosave } from "../src/lib/note-autosave.ts"
import {
  legacyNoteToDocument,
  parseNoteDraft,
  tiptapToDocument,
  isTiptapDocument,
} from "../src/lib/note-document.ts"

const snapshot = (title) => ({
  title,
  notes: title,
  noteDocument: legacyNoteToDocument(title),
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test("legacy notes retain literal markup, blank lines, and Unicode", () => {
  const document = legacyNoteToDocument(
    '# Old note\r\n\r\n<script>alert("no")</script> & 日本語'
  )
  assert.equal(document.root.type, "root")
  assert.equal(document.root.children.length, 3)
  assert.equal(document.root.children[0].children[0].text, "# Old note")
  assert.deepEqual(document.root.children[1].children, [])
  assert.equal(
    document.root.children[2].children[0].text,
    '<script>alert("no")</script> & 日本語'
  )
})

test("drafts accept valid snapshots and ignore corrupted storage", () => {
  const value = snapshot("Recovered")
  assert.deepEqual(parseNoteDraft(JSON.stringify(value)), value)
  for (const invalid of [
    null,
    "{",
    "null",
    "{}",
    '{"title":"x","notes":"x","noteDocument":{"type":"paragraph"}}',
  ]) {
    assert.equal(parseNoteDraft(invalid), null)
  }
})

test("autosave collapses rapid edits into the latest snapshot", async () => {
  const saved = []
  const queue = new NoteAutosave(
    async (value) => {
      saved.push(value)
    },
    () => {},
    60_000
  )
  queue.schedule(snapshot("First"))
  queue.schedule(snapshot("Latest"))
  assert.equal(queue.hasUnsavedChanges, true)
  assert.equal(await queue.flush(), true)
  assert.deepEqual(
    saved.map((value) => value.title),
    ["Latest"]
  )
  assert.equal(queue.hasUnsavedChanges, false)
  queue.dispose()
})

test("edits during a request are saved serially, not overwritten by older writes", async () => {
  const first = deferred()
  const saved = []
  let concurrent = 0
  const queue = new NoteAutosave(
    async (value) => {
      assert.equal(++concurrent, 1)
      saved.push(value.title)
      if (saved.length === 1) await first.promise
      concurrent--
    },
    () => {},
    60_000
  )
  queue.schedule(snapshot("First"))
  const pending = queue.flush()
  queue.schedule(snapshot("Second"))
  queue.schedule(snapshot("Latest"))
  assert.equal(queue.flush(), pending)
  first.resolve()
  assert.equal(await pending, true)
  assert.deepEqual(saved, ["First", "Latest"])
  assert.equal(queue.hasUnsavedChanges, false)
  queue.dispose()
})

test("failed saves retain the newest draft and expose a retryable error", async () => {
  let fail = true
  const states = []
  const saved = []
  const queue = new NoteAutosave(
    async (value) => {
      if (fail) throw new Error("Offline")
      saved.push(value.title)
    },
    (state) => states.push(state),
    60_000
  )
  queue.schedule(snapshot("Keep this"))
  assert.equal(await queue.flush(), false)
  assert.equal(states.at(-1), "error")
  assert.equal(queue.hasUnsavedChanges, true)
  fail = false
  assert.equal(await queue.flush(), true)
  assert.deepEqual(saved, ["Keep this"])
  assert.equal(states.at(-1), "saved")
  queue.dispose()
})

test("a failed earlier request does not replace edits made while it was saving", async () => {
  const first = deferred()
  let fail = true
  const saved = []
  const queue = new NoteAutosave(
    async (value) => {
      if (fail) {
        await first.promise
        throw new Error("Offline")
      }
      saved.push(value.title)
    },
    () => {},
    60_000
  )
  queue.schedule(snapshot("Old"))
  const pending = queue.flush()
  queue.schedule(snapshot("Newest"))
  first.resolve()
  assert.equal(await pending, false)
  fail = false
  assert.equal(await queue.flush(), true)
  assert.deepEqual(saved, ["Newest"])
  queue.dispose()
})

test("TipTap notes convert to Lexical without losing formatting", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      { type: "paragraph", content: [
        { type: "text", text: "bold", marks: [{ type: "bold" }, { type: "italic" }] },
        { type: "text", text: "site", marks: [{ type: "link", attrs: { href: "https://a.test" } }] },
      ] },
      { type: "bulletList", content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }, { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "nested" }] }] }] }] },
      ] },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "done" }] }] }] },
      { type: "codeBlock", content: [{ type: "text", text: "a\nb" }] },
      { type: "horizontalRule" },
      { type: "image", attrs: { src: "https://i.test/x.png", alt: "x" } },
      { type: "mystery", content: [{ type: "text", text: "kept" }] },
    ],
  }
  assert.ok(isTiptapDocument(doc))
  const { children } = tiptapToDocument(doc).root
  assert.deepEqual(children.map((c) => c.type), ["heading", "paragraph", "list", "list", "code", "horizontalrule", "paragraph", "paragraph"])
  assert.equal(children[0].tag, "h2")
  assert.equal(children[1].children[0].format, 3)
  assert.equal(children[1].children[1].type, "link")
  assert.deepEqual(children[2].children.map((c) => c.type), ["listitem", "listitem"])
  assert.equal(children[2].children[1].children[0].listType, "number")
  assert.equal(children[3].children[0].checked, true)
  assert.equal(children[6].children[0].src, "https://i.test/x.png")
  assert.equal(children[7].children[0].text, "kept")
  assert.equal(tiptapToDocument({ type: "doc", content: [] }).root.children.length, 1)
})
