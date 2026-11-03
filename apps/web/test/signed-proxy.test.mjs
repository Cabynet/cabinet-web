import assert from "node:assert/strict"
import test from "node:test"
import { signProxyUrl } from "../src/lib/signed-proxy.ts"

test("same-tick signing shares one request, dedupes URLs, sends the share token and prefixes the API base", async () => {
  const calls = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url, body, credentials: init.credentials })
    return Response.json({ items: body.urls.filter((u) => !u.includes("other")).map((u) => ({ url: u, signedUrl: `/v1/bookmarks/proxy-image?url=${encodeURIComponent(u)}&sig=s` })) })
  }
  const [a, a2, b] = await Promise.all([
    signProxyUrl("https://x.test/a.jpg", { shareToken: "tok" }),
    signProxyUrl("https://x.test/a.jpg", { shareToken: "tok" }),
    signProxyUrl("https://x.test/b.jpg", { shareToken: "tok" }),
  ])
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].body, { urls: ["https://x.test/a.jpg", "https://x.test/b.jpg"], shareToken: "tok" })
  assert.equal(calls[0].credentials, "include")
  assert.match(calls[0].url, /\/v1\/bookmarks\/proxy-image\/sign$/)
  assert.equal(a, a2)
  assert.match(a, /^http:\/\/localhost:4000\/v1\/bookmarks\/proxy-image\?url=.*&sig=s$/)
  assert.ok(b.includes("b.jpg"))
  // Cached: no second request.
  await signProxyUrl("https://x.test/a.jpg", { shareToken: "tok" })
  assert.equal(calls.length, 1)
})

test("URLs the API drops reject (so callers show nothing) and are retried later; batches are capped at 100", async () => {
  let calls = 0
  globalThis.fetch = async (_url, init) => { calls++; return Response.json({ items: JSON.parse(init.body).urls.filter((u) => !u.includes("other")).map((u) => ({ url: u, signedUrl: "/s?sig=1" })) }) }
  await assert.rejects(signProxyUrl("https://other.test/x.jpg"))
  await assert.rejects(signProxyUrl("https://other.test/x.jpg"))
  assert.equal(calls, 2)
  const sizes = []
  globalThis.fetch = async (_url, init) => { const { urls } = JSON.parse(init.body); sizes.push(urls.length); return Response.json({ items: urls.map((u) => ({ url: u, signedUrl: "/s" })) }) }
  await Promise.all(Array.from({ length: 150 }, (_, i) => signProxyUrl(`https://big.test/${i}.jpg`)))
  assert.deepEqual(sizes, [100, 50])
})
