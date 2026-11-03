import assert from "node:assert/strict"
import test from "node:test"
import { folderOptions, normalizeTag, selectedTags, popularTags } from "../src/lib/organization-picker.ts"

const folders = [
  { id: "design", name: "Design" },
  { id: "refs", name: "References", parentId: "design" },
  { id: "type", name: "Typography", parentId: "refs" },
  { id: "work", name: "Work" },
  { id: "other", name: "References", parentId: "work" },
]

test("folder search options disambiguate duplicate names with ancestor paths", () => {
  const options = folderOptions(folders)
  assert.equal(options.find((folder) => folder.id === "type").path, "Design / References / Typography")
  assert.equal(options.find((folder) => folder.id === "other").path, "Work / References")
  assert.deepEqual(folderOptions([]), [])
})

test("parent-folder choices exclude self and all descendants", () => {
  assert.deepEqual(folderOptions(folders, "design").map((folder) => folder.id), ["work", "other"])
})

test("folder paths handle missing parents and cycles without hanging", () => {
  assert.equal(folderOptions([{ id: "a", name: "A", parentId: "missing" }])[0].path, "A")
  assert.equal(folderOptions([{ id: "a", name: "A", parentId: "b" }, { id: "b", name: "B", parentId: "a" }]).length, 2)
})

test("tags normalize case, prefixes, and repeated whitespace before deduplication", () => {
  assert.equal(normalizeTag("  ## Design   Review  "), "design review")
  assert.deepEqual(selectedTags(["#Design", " design ", "#", "##UX", "ux"]), ["#design", "#ux"])
})

test("tag suggestions are unique, searchable, and ordered by real usage", () => {
  const tags = [{ name: "design", bookmarkCount: 8 }, { name: "UX", bookmarkCount: 20 }, { name: "Design", bookmarkCount: 1 }, { name: "design-system", bookmarkCount: 4 }]
  assert.deepEqual(popularTags(tags, ""), ["ux", "design", "design-system"])
  assert.deepEqual(popularTags(tags, "#DESIGN"), ["design", "design-system"])
})
