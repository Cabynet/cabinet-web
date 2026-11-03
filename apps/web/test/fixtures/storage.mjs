export function mockStorage(t, axios, { contentType = "PDF", failUpload = false } = {}) {
  const calls = []
  const url = "https://storage.example.test/cabinet/uploads/file"
  t.mock.method(axios, "post", async (path, data) => {
    calls.push({ path, data })
    if (path === "/v1/media/presign") return { data: { assetId: "asset", uploadUrl: "https://storage.example.test/signed-put", objectKey: "uploads/file" } }
    if (path === "/v1/media/asset/confirm") return { data: { status: "READY", publicUrl: url } }
    if (path === "/v1/bookmarks") return { data: { id: "uploaded", itemType: "FILE", rawUrl: url, title: data.title, contentType: contentType, thumbnailUrl: data.thumbnailUrl, tags: [] } }
    throw new Error(`Unexpected endpoint ${path}`)
  })
  t.mock.method(globalThis, "fetch", async (path, options) => {
    calls.push({ path, options })
    return new Response(null, { status: failUpload ? 503 : 200 })
  })
  return calls
}
