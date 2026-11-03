import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFile, mkdir } from "node:fs/promises"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"
import { chromium, expect } from "@playwright/test"

const root = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(import.meta.url)
const worker = await readFile(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"))
function samplePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << >> /Contents 4 0 R >>",
    "",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << >> /Contents 6 0 R >>",
    "",
  ]
  for (const [index, color] of [[3, "0.1 0.3 0.6"], [5, "0.2 0.5 0.3"]]) {
    const content = `${color} rg\n40 40 520 720 re f\n1 1 1 rg\n80 560 440 80 re f\n80 450 280 40 re f\n`
    objects[index] = `<< /Length ${content.length} >>\nstream\n${content}endstream`
  }
  let text = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(text.length); text += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = text.length
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) text += `${String(offset).padStart(10, "0")} 00000 n \n`
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(text)
}
const pdf = samplePdf()
let downloads = 0
const transientAttempts = { direct: 0, proxy: 0 }
const cookies = { direct: [], proxy: [] }
const media = createServer((req, res) => {
  const requestUrl = new URL(req.url, "http://media.test")
  if (requestUrl.pathname === "/v1/bookmarks/proxy-image/sign") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "null")
    res.setHeader("Access-Control-Allow-Credentials", "true")
    res.setHeader("Access-Control-Allow-Headers", "content-type")
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return }
    let body = ""
    req.on("data", (chunk) => { body += chunk })
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ items: JSON.parse(body).urls.map((url) => ({ url, signedUrl: `/v1/bookmarks/proxy-image?url=${encodeURIComponent(url)}&sig=test` })) }))
    })
    return
  }
  const proxied = requestUrl.pathname === "/v1/bookmarks/proxy-image"
  cookies[proxied ? "proxy" : "direct"].push(req.headers.cookie || "")
  // Cabinet's proxy supports sessions; public R2-style URLs deliberately do not.
  res.setHeader("Access-Control-Allow-Origin", proxied ? req.headers.origin || "null" : "*")
  if (proxied) res.setHeader("Access-Control-Allow-Credentials", "true")
  const path = proxied ? new URL(requestUrl.searchParams.get("url")).pathname : requestUrl.pathname
  if (path === "/transient.pdf" && ++transientAttempts[proxied ? "proxy" : "direct"] === 1) {
    res.statusCode = 503; res.end("Temporarily unavailable"); return
  }
  if (path === "/slow.pdf") {
    setTimeout(() => { res.setHeader("Content-Type", "application/pdf"); res.end(pdf) }, 500)
    return
  }
  if (["/cors-blocked.pdf", "/session.pdf"].includes(path) && !proxied) res.removeHeader("Access-Control-Allow-Origin")
  if (path === "/session.pdf" && proxied && !req.headers.cookie?.includes("cabinet_session=pdf-test")) {
    res.statusCode = 429; res.setHeader("Retry-After", "60"); res.end("Anonymous proxy quota exhausted"); return
  }
  if (["/sample.pdf", "/transient.pdf", "/cors-blocked.pdf", "/session.pdf"].includes(path)) {
    downloads++
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Length", pdf.length)
    res.end(pdf)
  } else { res.statusCode = 404; res.end("Not found") }
})
await new Promise((resolve) => media.listen(0, "127.0.0.1", resolve))
const origin = `http://127.0.0.1:${media.address().port}`
const bundle = await build({ absWorkingDir: root, entryPoints: ["test/fixtures/pdf-preview.tsx"], bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(origin), "process.env": "{}" } })
const css = await postcss([tailwind()]).process(await readFile(`${root}src/app/globals.css`, "utf8"), { from: `${root}src/app/globals.css` })
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return }
  if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css); return }
  if (req.url.endsWith("pdf.worker.min.mjs")) { res.setHeader("Content-Type", "text/javascript"); res.end(worker); return }
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-geist-sans:Arial,sans-serif;--font-geist-mono:monospace}</style><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.PDF_ORIGIN=${JSON.stringify(origin)}</script><script type="module" src="/app.js"></script></body></html>`)
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const browser = await chromium.launch({ headless: true })
const nonblank = (preview) => preview.evaluate((node) => {
  let canvas = node
  if (node instanceof HTMLImageElement) {
    if (!node.complete || !node.naturalWidth) return false
    canvas = document.createElement("canvas")
    canvas.width = node.naturalWidth; canvas.height = node.naturalHeight
    canvas.getContext("2d").drawImage(node, 0, 0)
  }
  if (!canvas.width || !canvas.height) return false
  const pixels = canvas.getContext("2d").getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data
  return pixels[3] > 0 && Math.min(...pixels.slice(0, 3)) < 200
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  await page.context().addCookies([{ name: "cabinet_session", value: "pdf-test", url: origin }])
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.stack) })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const thumbnail = page.locator('#cards [data-pdf-ready="true"]').first()
  await expect(thumbnail).toBeVisible({ timeout: 20000 })
  await expect.poll(() => nonblank(thumbnail), { message: "Thumbnail must contain rendered PDF pixels" }).toBe(true)
  await expect(page.getByText("PDF preview unavailable", { exact: true })).toBeVisible()
  for (const density of ["visual", "compact", "comfortable"]) {
    await page.getByRole("button", { name: density, exact: true }).click()
    await expect(page.locator('#cards [data-pdf-ready="true"]').first()).toBeVisible()
    const heights = await page.locator('#cards > [data-slot="card"]').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
    assert.equal(heights.length, 6)
    assert.ok(heights.every((height) => height >= 208), `${density}: every card is at least 208px, got ${heights}`)
  }
  await page.getByRole("button", { name: "visual", exact: true }).click()
  await expect.poll(() => nonblank(thumbnail)).toBe(true)
  const warmDownloads = downloads
  await page.evaluate(() => {
    window.previewFlashes = []
    window.previewObserver = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        const statuses = [...node.querySelectorAll('[role="status"]')]
        if (node.matches('[role="status"]')) statuses.push(node)
        for (const status of statuses) {
          // Only successful previews are warm; the deliberately missing PDF may retry.
          if (!status.closest('[data-slot="card"]')?.querySelector('a[href$="/sample.pdf"], img[alt="Panoramic image"]')) continue
          if (/Loading PDF preview|Loading thumbnail|Generating preview/.test(status.textContent)) window.previewFlashes.push(status.textContent)
        }
      }
    })
    window.previewObserver.observe(document.body, { childList: true, subtree: true })
  })
  for (const section of ["Favorites", "All items", "Favorites", "All items"]) {
    await page.getByRole("button", { name: section, exact: true }).click()
    await expect.poll(() => nonblank(thumbnail)).toBe(true)
  }
  assert.deepEqual(await page.evaluate(() => { window.previewObserver.disconnect(); return window.previewFlashes }), [], "Warm navigation must not flash preview loading states")
  assert.equal(downloads, warmDownloads, "Warm navigation must reuse rendered PDF thumbnails without downloading again")
  await page.getByRole("link", { name: "Open Research document in Cabinet", exact: true }).click()
  const dialog = page.getByRole("dialog")
  const main = dialog.locator('canvas[aria-label="Research document, page 1"]')
  await expect.poll(() => nonblank(main)).toBe(true)
  await expect(dialog.getByText("1 / 2", { exact: true })).toBeVisible()
  const loaded = downloads
  await dialog.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(dialog.getByText("2 / 2", { exact: true })).toBeVisible()
  await expect.poll(() => nonblank(dialog.locator('canvas[aria-label="Research document, page 2"]'))).toBe(true)
  await dialog.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(dialog.getByText("125%", { exact: true })).toBeVisible()
  await dialog.getByRole("radio", { name: "Continuous", exact: true }).click()
  await expect(dialog.locator('canvas[aria-label="PDF page 1"]')).toBeVisible()
  await expect.poll(() => nonblank(dialog.locator('canvas[aria-label="PDF page 1"]'))).toBe(true)
  assert.equal(downloads, loaded, "Page changes, zoom and thumbnails must reuse one loaded PDF")
  await dialog.getByRole("radio", { name: "Single page", exact: true }).click()
  await expect.poll(() => nonblank(dialog.locator('canvas[aria-label="Research document, page 2"]'))).toBe(true)
  await mkdir(`${root}test/artifacts`, { recursive: true })
  await page.screenshot({ path: `${root}test/artifacts/pdf-modal-lightmode.png` })
  await page.keyboard.press("Escape")
  await page.getByRole("link", { name: "Open Unavailable document in Cabinet", exact: true }).click()
  await expect(page.getByText("Couldn’t render this PDF preview.", { exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await mkdir(`${root}test/artifacts`, { recursive: true })
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({ path: `${root}test/artifacts/pdf-cards-${width}.png`, fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`)
  }
  assert.equal(await page.evaluate((url) => window.testLoadPdf(url), `${origin}/transient.pdf`), 2, "Transient direct and proxy failures should recover without reopening")
  assert.ok(transientAttempts.direct >= 2, "Must retry after both routes temporarily fail")
  assert.equal(await page.evaluate((url) => window.testLoadPdf(url), `${origin}/cors-blocked.pdf`), 2, "CORS-blocked documents should use the proxy")
  assert.equal(await page.evaluate((url) => window.testLoadPdf(url), `${origin}/session.pdf`), 2, "The API proxy must receive the session instead of using the shared anonymous quota")
  assert.ok(cookies.proxy.some((cookie) => cookie.includes("cabinet_session=pdf-test")), "Proxy requests must include the Cabinet session")
  assert.ok(cookies.direct.every((cookie) => !cookie), "Direct PDF requests must not send cookies to external storage")
  assert.equal(await page.evaluate(async (url) => {
    try { await window.testLoadPdf(url, true); return "loaded" } catch (error) { return error.name }
  }, `${origin}/slow.pdf`), "AbortError", "Unmounting must cancel an in-flight PDF")
  assert.deepEqual(errors, [])
  console.log("PASS PDF: cross-origin rendering, thumbnails, pagination/zoom/continuous reuse, failure states, card heights, transient recovery, CORS proxy fallback, session isolation, warm navigation without flicker or PDF downloads, cancellation")
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); await new Promise((resolve) => media.close(resolve)) }
