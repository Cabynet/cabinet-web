import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"
import { chromium, expect } from "@playwright/test"

const root = fileURLToPath(new URL("../", import.meta.url))
const bundle = await build({ absWorkingDir: root, entryPoints: ["test/fixtures/organization-picker.tsx"], bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" } })
const css = await postcss([tailwind()]).process(await readFile(`${root}src/app/globals.css`, "utf8"), { from: `${root}src/app/globals.css` })
const server = createServer((req, res) => {
  if (req.url === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return }
  if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(css.css); return }
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-geist-sans:Arial,sans-serif;--font-geist-mono:monospace}</style><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>')
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const url = `http://127.0.0.1:${server.address().port}`
if (process.env.PICKER_PREVIEW) { console.log(url); await new Promise(() => {}) }
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.stack) })
  await page.goto(url)
  const folder = page.getByRole("combobox", { name: "Folder", exact: true })
  await folder.click()
  const search = page.getByRole("combobox", { name: "Search folders", exact: true })
  await search.fill("typography")
  await expect(page.getByRole("option", { name: "Design / References / Typography", exact: true })).toBeVisible()
  await search.press("Enter")
  await expect(folder).toHaveText("Design / References / Typography")
  await folder.click()
  await search.fill("Research 219")
  await search.press("Enter")
  await expect(folder).toHaveText("Research 219")
  await folder.click()
  await expect(page.getByRole("group", { name: "Recently used", exact: true })).toContainText("Design / References / Typography")
  await search.press("Escape")
  await expect(page.getByRole("dialog", { name: "New bookmark", exact: true })).toBeVisible()

  const input = page.getByRole("combobox", { name: "Tags", exact: true })
  await input.fill("design")
  await page.getByRole("option", { name: "#design", exact: true }).click()
  await expect(input).toBeFocused()
  await expect(page.getByRole("listbox", { name: "Tag suggestions" })).toBeVisible()
  await input.fill("design-system")
  await input.press("Enter")
  await input.fill(" DESIGN ")
  await expect(page.getByRole("option", { name: /Create/ })).toHaveCount(0)
  await input.fill("design review")
  await expect(page.getByRole("option", { name: "Create “design review”", exact: true })).toBeVisible()
  await input.press("Enter")
  await input.fill("typography")
  await input.press("Enter")
  await expect(page.getByRole("button", { name: "+1 more", exact: true })).toBeVisible()
  assert.deepEqual(JSON.parse(await page.locator("#values").textContent()).tags, ["#design", "#design-system", "#design review", "#typography"])
  assert.equal(await page.evaluate(() => window.saved), undefined, "Enter chooses a tag without submitting the bookmark")
  await page.getByRole("button", { name: "+1 more", exact: true }).click()
  await page.getByRole("button", { name: "Remove #typography", exact: true }).click()
  await input.fill("missing tag")
  await input.press("Escape")
  await expect(page.getByRole("dialog", { name: "New bookmark", exact: true })).toBeVisible()

  await mkdir(`${root}test/artifacts`, { recursive: true })
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await input.click()
    await input.fill("design")
    await expect(page.getByRole("listbox", { name: "Tag suggestions" })).toBeVisible()
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${root}test/artifacts/organization-picker-${width}.png`, fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`)
    await input.press("Escape")
  }
  await page.goto(`${url}/?empty=1`)
  await expect(page.getByRole("combobox", { name: "Folder", exact: true })).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: "Tags", exact: true })).toBeVisible()
  await page.goto(`${url}/?parent=1`)
  await page.getByRole("combobox", { name: "Parent Folder (optional)", exact: true }).click()
  await expect(page.getByRole("option", { name: "Design", exact: true })).toHaveCount(0)
  await search.fill("typography")
  await expect(page.getByRole("option")).toHaveCount(0)
  await expect(page.getByText("No folders found.")).toBeVisible()
  assert.deepEqual(errors, [])
  console.log("PASS organization pickers: nested folder search, recents, parent exclusions, tag multiselect/create/deduplication/removal, keyboard, empty state, responsive screenshots")
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)) }
