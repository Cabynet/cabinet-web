import assert from "node:assert/strict"
import test from "node:test"
import { uploadBookmarkToR2, AXIOS_INSTANCE } from "../src/lib/api-client.ts"
import { mockStorage } from "./fixtures/storage.mjs"

test("finder PDF upload preserves its destination folder", async (t) => {
  const calls = mockStorage(t, AXIOS_INSTANCE)
  const file = new File(["%PDF-1.4"], "contract.pdf", { type: "application/pdf" })
  const result = await uploadBookmarkToR2({ file, folderId: "work" })
  assert.equal(calls[3].data.folderId, "work")
  assert.equal(calls[3].data.title, "contract.pdf")
  assert.equal(result.contentType, "PDF")
})
test("finder image upload uses the confirmed asset as its preview", async (t) => {
  const calls = mockStorage(t, AXIOS_INSTANCE, { contentType: "IMAGE" })
  const result = await uploadBookmarkToR2({ file: new File(["image"], "photo.png", { type: "image/png" }) })
  assert.equal(calls[3].data.thumbnailUrl, "https://storage.example.test/cabinet/uploads/file")
  assert.equal(result.contentType, "IMAGE")
  assert.equal(result.imageUrl, result.url)
})
