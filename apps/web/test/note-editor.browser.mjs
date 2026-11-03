import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { chromium, expect } from "@playwright/test"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"

const root = fileURLToPath(new URL("../", import.meta.url))
const bundle = await build({ absWorkingDir: root, entryPoints: ["test/fixtures/note-editor.tsx"], bundle: true, write: false,
  outdir: "test/.note-editor", platform: "browser", format: "esm", jsx: "automatic", loader: { ".woff2": "dataurl", ".woff": "dataurl", ".ttf": "dataurl" },
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" } })
const css = await postcss([tailwind()]).process(await readFile(`${root}src/app/globals.css`, "utf8"), { from: `${root}src/app/globals.css` })
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles.find((file) => file.path.endsWith(".js")).text); return }
  if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css + (bundle.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "")); return }
  res.end('<!doctype html><html><head><style>:root{--font-geist-sans:Arial,sans-serif;--font-geist-mono:monospace}</style><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>')
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.stack) })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const editor = page.locator('[contenteditable="true"]').first()
  await expect(editor).toContainText("Write your note here.")
  await expect(page.getByRole("toolbar")).toHaveCount(0)
  await page.waitForTimeout(400)
  assert.equal(await page.evaluate(() => window.noteChanges ?? 0), 0, "Loading a note must not schedule an autosave")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("/heading", { delay: 50 })
  await expect(page.getByRole("option", { name: "Heading 1", exact: true })).toBeVisible()
  await page.keyboard.press("Enter")
  await page.keyboard.type("Project notes")
  await expect(editor.locator("h1")).toHaveText("Project notes")
  await page.keyboard.press("Enter")
  await page.keyboard.type("/table", { delay: 50 })
  await page.getByRole("option", { name: "Table", exact: true }).click()
  await expect(editor.locator("table")).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.noteDocument))).toContain('"type":"table"')
  await page.locator("#reload").click()
  await expect(page.locator(".cabinet-editor table")).toBeVisible()
  await page.locator("#permissions").click()
  await expect(page.locator('.cabinet-editor [contenteditable="true"]')).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Switch to edit mode/ })).toHaveCount(0)
  await page.locator("#permissions").click()
  await expect(page.locator('.cabinet-editor [contenteditable="true"]').first()).toBeVisible()
  for (const [query, label, type] of [
    ["card", "Card", "card"],
    ["collapsible", "Collapsible", "collapsible-container"],
    ["poll", "Poll", "poll"],
    ["review", "Review", "review"],
    ["pull quote", "Pull quote", "pullquote"],
    ["code", "Code block", "code"],
    ["columns", "Two columns", "layout-container"],
    ["date", "Date & time", "datetime"],
    ["check", "Check List", "list"],
    ["horizontal", "Horizontal rule", "horizontalrule"],
  ]) {
    console.log(`Checking ${label}`)
    await page.locator("#new").click()
    const surface = page.locator('.cabinet-editor [contenteditable="true"]').first()
    await surface.click()
    await page.keyboard.press("ControlOrMeta+End")
    await page.keyboard.press("Enter")
    await page.keyboard.type(`/${query}`, { delay: 50 })
    await page.getByRole("option", { name: label, exact: true }).click()
    await expect.poll(() => page.evaluate(() => JSON.stringify(window.noteDocument))).toContain(`"type":"${type}"`)
    await page.locator("#reload").click()
    await expect(page.locator(".cabinet-editor")).toBeVisible()
    await page.locator("#permissions").click()
    await expect(page.locator('.cabinet-editor [contenteditable="true"]')).toHaveCount(0)
    await page.locator("#permissions").click()
  }
  await page.locator("#new").click()
  await page.locator('.cabinet-editor [contenteditable="true"]').first().click()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("Second block")
  const paragraphs = page.locator('.cabinet-editor [contenteditable="true"] > p')
  await paragraphs.first().hover({ position: { x: 10, y: 10 } })
  const handle = page.locator('.draggable-block-menu')
  await handle.dragTo(paragraphs.nth(1), { force: true, targetPosition: { x: 10, y: 18 } })
  await expect(paragraphs.first()).toHaveText("Second block")
  await page.getByRole("button", { name: "Note options", exact: true }).click()
  await page.getByRole("menuitem", { name: "Switch to read-only mode", exact: true }).click()
  await expect(page.locator('.cabinet-editor [contenteditable="true"]')).toHaveCount(0)
  await expect(page.locator('.draggable-block-menu')).toHaveCount(0)
  await page.getByRole("button", { name: "Note options", exact: true }).click()
  await page.getByRole("menuitem", { name: "Switch to edit mode", exact: true }).click()
  await page.locator("#new").click()
  await page.locator('.cabinet-editor [contenteditable="true"]').first().click()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("/image", { delay: 50 })
  // Images are uploaded to storage and referenced by URL; stub the presign, PUT and confirm calls.
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh2sAAAAASUVORK5CYII="
  const cors = { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" }
  await page.route("**/v1/media/**", (route) => route.request().method() === "OPTIONS"
    ? route.fulfill({ status: 204, headers: cors })
    : route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(route.request().url().endsWith("/presign") ? { uploadUrl: "http://localhost:4000/_put", assetId: "asset-1", objectKey: "k" } : { publicUrl: pixel }) }))
  await page.route("**/_put", (route) => route.fulfill({ status: 200, headers: cors }))
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("option", { name: "Image", exact: true }).click()
  await (await chooser).setFiles({ name: "pixel.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh2sAAAAASUVORK5CYII=", "base64") })
  await expect(page.locator('.cabinet-editor img[alt="pixel.png"]')).toBeVisible()
  await page.locator("#reload").click()
  await expect(page.locator('.cabinet-editor img[alt="pixel.png"]')).toBeVisible()
  await page.locator("#new").click()
  await page.locator('.cabinet-editor [contenteditable="true"]').first().click()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("/equation", { delay: 50 })
  await page.getByRole("option", { name: "Equation", exact: true }).click()
  await page.getByRole("textbox", { name: "LaTeX", exact: true }).fill("x^2 + y^2 = z^2")
  await page.getByRole("button", { name: "Insert", exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.noteDocument))).toContain('"type":"equation"')
  await page.locator("#reload").click()
  await expect(page.locator(".katex")).toBeVisible()
  // Selection formatting stays contextual, never a fixed toolbar.
  await page.locator('.cabinet-editor [contenteditable="true"] > p').first().dblclick({ position: { x: 20, y: 10 } })
  const toolbar = page.getByRole("toolbar", { name: "Text formatting", exact: true })
  await expect(toolbar).toBeVisible()
  await expect(toolbar.getByRole("button", { name: "Clear editor", exact: true })).toHaveCount(0)
  await toolbar.getByRole("button", { name: "Bold", exact: true }).click()
  await expect(page.locator('.cabinet-editor [contenteditable="true"] > p').first().locator('strong, [style*="font-weight"], .font-bold')).toBeVisible()
  await toolbar.getByRole("button", { name: "More formatting", exact: true }).click()
  const more = page.getByRole("dialog", { name: "More formatting", exact: true })
  await expect(more).toBeVisible()
  const size = more.getByRole("textbox", { name: "Font size", exact: true })
  await size.fill("18")
  await size.press("Enter")
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.noteDocument))).toContain("font-size: 18px")
  await size.press("Escape")
  await page.locator('.cabinet-editor [contenteditable="true"] > p').first().click({ position: { x: 20, y: 10 } })
  await mkdir(`${root}test/artifacts`, { recursive: true })
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('.cabinet-editor [contenteditable="true"] > p').first().dblclick({ position: { x: 20, y: 10 } })
    await expect(toolbar).toBeVisible()
    const box = await toolbar.boundingBox()
    assert.ok(box.height <= 42, `Toolbar stays one row at ${width}`)
    assert.ok(box.x >= 0 && box.x + box.width <= width, `Toolbar fits at ${width}`)
    await page.screenshot({ path: `${root}test/artifacts/note-editor-${width}.png`, fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No overflow at ${width}`)
  }
  assert.deepEqual(errors, [])
  console.log("PASS note editor: slash commands, advanced blocks, equations, persistence, permission locks, contextual toolbar, responsive screenshots")
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)) }
