import assert from "node:assert/strict"
import test from "node:test"
import { uploadFileToR2, uploadBookmarkToR2, AXIOS_INSTANCE } from "../src/lib/api-client.ts"
import { mockStorage } from "./fixtures/storage.mjs"

test("upload sends bytes directly to storage and confirms only after PUT", async (t) => {
  const calls = mockStorage(t, AXIOS_INSTANCE)
  const file = new File(["pdf content"], "test.pdf", { type: "application/pdf" })
  const result = await uploadFileToR2(file)
  assert.deepEqual(calls[0], { path: "/v1/media/presign", data: { filename: file.name, mimeType: file.type, sizeBytes: file.size } })
  assert.equal(calls[1].options.method, "PUT")
  assert.equal(calls[1].options.body, file)
  assert.equal(calls[2].path, "/v1/media/asset/confirm")
  assert.equal(result.url, "https://storage.example.test/cabinet/uploads/file")
})
test("bookmark upload uses the canonical create contract after storage confirmation", async (t) => {
  const calls = mockStorage(t, AXIOS_INSTANCE)
  const file = new File(["content"], "doc.pdf", { type: "application/pdf" })
  const result = await uploadBookmarkToR2({ file, title: "My Title", description: "Description", folderId: "folder", tags: ["research"] })
  assert.equal(calls[2].path, "/v1/media/asset/confirm")
  assert.equal(calls[3].path, "/v1/bookmarks")
  assert.equal(calls[3].data.folderId, "folder")
  assert.deepEqual(calls[3].data.tags, ["research"])
  assert.equal(calls[3].data.itemType, "FILE")
  assert.equal(result.title, "My Title")
})
test("failed storage PUT never confirms or creates a bookmark", async (t) => {
  const calls = mockStorage(t, AXIOS_INSTANCE, { failUpload: true })
  await assert.rejects(uploadBookmarkToR2({ file: new File(["data"], "doc.pdf", { type: "application/pdf" }) }), /Storage upload failed/)
  assert.equal(calls.length, 2)
})
