import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { registerHooks } from "node:module"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { transformSync } from "esbuild"

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/link") {
      return {
        url: new URL("./fixtures/next-link.mjs", import.meta.url).href,
        shortCircuit: true,
      }
    }
    if (specifier === "next/navigation") {
      return {
        url: "data:text/javascript,export function useRouter(){return{push(){},replace(){},back(){}}};",
        shortCircuit: true,
      }
    }
    if (specifier === "@/lib/api-client") {
      return {
        url: "data:text/javascript,export function useBookmarksControllerImport(){return {mutateAsync(){}}};export const AXIOS_INSTANCE={get:async()=>({data:''}),delete:async()=>({data:''}),post:async()=>({data:''}),patch:async()=>({data:''})};",
        shortCircuit: true,
      }
    }
    if (specifier.startsWith("@/") || (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))) {
      const path = specifier.startsWith("@/")
        ? new URL(`../src/${specifier.slice(2)}`, import.meta.url)
        : new URL(specifier, context.parentURL)
      for (const extension of [".tsx", ".ts"]) {
        try {
          readFileSync(new URL(path.href + extension))
          return { url: path.href + extension, shortCircuit: true }
        } catch {}
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith(".tsx") || url.endsWith(".ts")) {
      return {
        format: "module",
        shortCircuit: true,
        source: transformSync(readFileSync(new URL(url), "utf8"), {
          loader: url.endsWith(".tsx") ? "tsx" : "ts", jsx: "automatic", format: "esm",
        }).code,
      }
    }
    return next(url, context)
  },
})

const { Providers } = await import("../src/app/providers.tsx")
const IntegrationsPage = (await import("../src/app/cabinet/integrations/page.tsx")).default
const { SafariExportIllustration, ExtensionWorkflowIllustration } = await import("../src/app/cabinet/integrations/integrations-diagrams.tsx")

test("IntegrationsPage renders with illustrations, guides, and dropzone", () => {
  const html = renderToStaticMarkup(
    React.createElement(Providers, null, React.createElement(IntegrationsPage, null))
  )

  // Header & Navigation
  assert.match(html, /Integrations &amp; import|Integrations & import/)
  assert.match(html, /Back to Cabinet/)

  // Interactive dropzone & action buttons
  assert.match(html, /Drag and drop an HTML bookmarks file here/)
  assert.match(html, /Choose HTML file/)
  assert.match(html, /Export from Cabinet/)

  // Pipeline diagram
  assert.match(html, /How import &amp; export work|How import & export work/)
  assert.match(html, /Standard HTML file/)
  assert.match(html, /Your Cabinet library/)

  // Platform Guides
  assert.match(html, /Google Chrome/)
  assert.match(html, /Apple Safari/)
  assert.match(html, /Raindrop\.io/)
  assert.match(html, /Arc &amp; Brave|Arc & Brave/)
  assert.match(html, /1-click extension/)

  // Illustrations & Content
  assert.match(html, /chrome:\/\/bookmarks/)
  assert.match(html, /Folder structure preserved/)
  assert.match(html, /Automatic previews/)

  // Dedicated illustrations
  const safariHtml = renderToStaticMarkup(React.createElement(SafariExportIllustration))
  assert.match(safariHtml, /Safari Bookmarks\.html/)
  assert.match(safariHtml, /Export Bookmarks\.\.\./)

  const extensionHtml = renderToStaticMarkup(React.createElement(ExtensionWorkflowIllustration))
  assert.match(extensionHtml, /Cabinet Extension/)
  assert.match(extensionHtml, /Save to Cabinet/)
})
