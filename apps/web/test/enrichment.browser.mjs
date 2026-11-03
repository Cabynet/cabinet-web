import assert from "node:assert/strict"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { chromium, expect } from "@playwright/test"

const root = fileURLToPath(new URL("../", import.meta.url))
const bundle = await build({ absWorkingDir: root, entryPoints: ["test/fixtures/enrichment.tsx"], bundle: true, write: false,
  platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" } })
const id = "12345678-1234-1234-1234-123456789abc"
const preview = { id, rawUrl: "https://example.test/page", title: "Enriched", description: "Reference", thumbnailUrl: null, faviconUrl: null, siteName: "Example", contentType: null, metadataStatus: "COMPLETED", metadataError: null, updatedAt: "2026-01-02T00:00:00Z" }
const requests = [], saves = []
let details = 0
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://test")
  if (url.pathname === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return }
  if (url.pathname.startsWith("/v1/")) {
    requests.push(url.pathname)
    res.setHeader("Content-Type", "application/json")
    if (url.pathname === "/v1/bookmarks/previews") {
      assert.equal(url.searchParams.get("ids"), id)
      res.end(JSON.stringify({ previews: [preview] })); return
    }
    if (url.pathname === `/v1/bookmarks/${id}`) {
      if (req.method === "PATCH") {
        let body = ""
        for await (const chunk of req) body += chunk
        saves.push(JSON.parse(body))
        res.end(JSON.stringify({ ...preview, noteRevision: 1, ...saves.at(-1) })); return
      }
      details++
      if (details === 1) { res.statusCode = 503; res.end('{}'); return }
      res.end(JSON.stringify({ ...preview, userId: "me", itemType: "LINK", notesPlain: "x".repeat(5000), noteRevision: 0, tags: [], access: "owner" })); return
    }
    res.end(JSON.stringify({ success: true, data: { embeddable: false } })); return
  }
  res.end('<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>')
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await expect(page.locator("#status")).toHaveText("COMPLETED")
  const polls = requests.filter((path) => path === "/v1/bookmarks/previews").length
  await page.waitForTimeout(2200)
  assert.equal(requests.filter((path) => path === "/v1/bookmarks/previews").length, polls, "Polling must stop after completion")
  assert.ok(!requests.includes("/v1/bookmarks"), "Enrichment must not refetch complete lists")
  await page.getByRole("button", { name: "Inspect summary" }).click()
  await expect(page.getByText("Details could not be loaded.")).toBeVisible()
  assert.equal(await page.getByRole("textbox", { name: "Title", exact: true }).count(), 0, "A summary must never become an editable draft")
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  const inspector = page.getByLabel("Bookmark inspector")
  await expect(inspector.getByRole("textbox", { name: "Personal Note" })).toHaveValue("x".repeat(5000))
  await inspector.getByRole("textbox", { name: "Title", exact: true }).fill("Edited title")
  await expect.poll(() => saves.length).toBeGreaterThan(0)
  assert.equal(saves.at(-1).notesPlain.length, 5000, "Editing a title must not truncate the stored notes")
  assert.deepEqual(errors, [])
  console.log("PASS enrichment: targeted polling, automatic cache updates, stop on completion, detail failure/retry, full-note autosave")
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
