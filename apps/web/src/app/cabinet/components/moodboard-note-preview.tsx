"use client"

import React from "react"
import { SearchHighlight } from "./search-highlight"
import { cn } from "@/lib/utils"
import { Check } from "@phosphor-icons/react"

type NoteDocNode = {
  type?: string
  text?: string
  attrs?: Record<string, any>
  content?: NoteDocNode[]
}

function getNodeText(node?: NoteDocNode): string {
  if (!node) return ""
  if (typeof node.text === "string") return node.text
  if (!Array.isArray(node.content)) return ""
  return node.content.map((child) => getNodeText(child)).join("")
}

// Lexical notes (the current format) are adapted to the TipTap-shaped nodes the preview renders.
function lexicalToBlocks(children: any[]): NoteDocNode[] {
  const flat = (node: any): string =>
    typeof node.text === "string" ? node.text : node.type === "linebreak" ? "\n" : (node.children || []).map(flat).join("")
  return children.map((node): NoteDocNode => {
    switch (node.type) {
      case "heading": return { type: "heading", attrs: { level: Number(String(node.tag).slice(1)) || 2 }, content: [{ text: flat(node) }] }
      case "quote": return { type: "blockquote", content: [{ text: flat(node) }] }
      case "code": return { type: "codeBlock", content: [{ text: flat(node) }] }
      case "horizontalrule": return { type: "horizontalRule" }
      case "list": return {
        type: node.listType === "number" ? "orderedList" : node.listType === "check" ? "taskList" : "bulletList",
        content: (node.children || []).map((item: any) => ({ attrs: { checked: item.checked }, content: [{ text: flat(item) }] })),
      }
      default: return { type: "paragraph", content: [{ text: flat(node) }] }
    }
  })
}

function parseNoteBlocks(noteDocument: unknown): NoteDocNode[] {
  if (!noteDocument) return []
  try {
    const parsed =
      typeof noteDocument === "string" ? JSON.parse(noteDocument) : noteDocument
    if (Array.isArray((parsed as any)?.root?.children)) return lexicalToBlocks((parsed as any).root.children)
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as any).content)
    ) {
      return (parsed as any).content as NoteDocNode[]
    }
  } catch {
    return []
  }
  return []
}

function renderNoteBlock(node: NoteDocNode, index: number) {
  const type = node.type

  if (type === "horizontalRule") {
    return <hr key={`divider-${index}`} className="my-1.5 border-t border-border/80" />
  }

  if (type === "heading") {
    const level = Number(node.attrs?.level || 2)
    const text = getNodeText(node).trim()
    if (!text) return null
    return (
      <p
        key={`heading-${index}`}
        className={cn(
          "line-clamp-1 font-semibold text-foreground tracking-tight",
          level === 1 ? "text-sm mt-1" : level === 2 ? "text-[13px] mt-0.5" : "text-xs font-medium"
        )}
      >
        <SearchHighlight text={text} />
      </p>
    )
  }

  if (type === "bulletList") {
    const items = (node.content || [])
      .map((item) => getNodeText(item).trim())
      .filter(Boolean)
      .slice(0, 4)
    if (!items.length) return null
    return (
      <ul key={`list-${index}`} className="space-y-1 text-xs text-foreground/90">
        {items.map((item, itemIndex) => (
          <li key={`list-item-${index}-${itemIndex}`} className="flex items-start gap-1.5 leading-relaxed">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/60" />
            <span className="line-clamp-1 min-w-0 flex-1"><SearchHighlight text={item} /></span>
          </li>
        ))}
      </ul>
    )
  }

  if (type === "orderedList") {
    const items = (node.content || [])
      .map((item) => getNodeText(item).trim())
      .filter(Boolean)
      .slice(0, 4)
    if (!items.length) return null
    return (
      <ol key={`ordered-${index}`} className="space-y-1 text-xs text-foreground/90">
        {items.map((item, itemIndex) => (
          <li key={`ordered-item-${index}-${itemIndex}`} className="flex items-start gap-1.5 leading-relaxed">
            <span aria-hidden="true" className="shrink-0 font-mono text-[11px] text-muted-foreground">{itemIndex + 1}.</span>
            <span className="line-clamp-1 min-w-0 flex-1"><SearchHighlight text={item} /></span>
          </li>
        ))}
      </ol>
    )
  }

  if (type === "taskList") {
    const items = (node.content || [])
      .map((item) => ({
        text: getNodeText(item).trim(),
        checked: Boolean(item.attrs?.checked),
      }))
      .filter((item) => item.text)
      .slice(0, 4)

    if (!items.length) return null
    return (
      <ul key={`tasks-${index}`} className="space-y-1 text-xs text-foreground/90">
        {items.map((item, itemIndex) => (
          <li key={`task-item-${index}-${itemIndex}`} className="flex items-start gap-2 leading-relaxed">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-xs border text-xs",
                item.checked
                  ? "border-library-olive bg-library-olive text-white"
                  : "border-muted-foreground/40 bg-background/50"
              )}
            >
              {item.checked && <Check className="size-2.5" weight="bold" />}
            </span>
            <span className={cn("line-clamp-1 min-w-0 flex-1", item.checked && "line-through text-muted-foreground")}>
              <SearchHighlight text={item.text} />
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (type === "blockquote") {
    const text = (node.content || []).map((child) => getNodeText(child).trim()).filter(Boolean).join(" ")
    if (!text) return null
    return (
      <blockquote key={`quote-${index}`} className="line-clamp-3 border-l-2 border-library-olive/50 pl-3 font-serif text-xs leading-relaxed text-foreground">
        <SearchHighlight text={text} />
      </blockquote>
    )
  }

  if (type === "codeBlock") {
    const text = getNodeText(node).trim()
    if (!text) return null
    return (
      <pre
        key={`code-${index}`}
        className="line-clamp-2 rounded-sm bg-muted/60 px-2 py-1 font-mono text-xs leading-relaxed text-foreground/90"
      >
        <SearchHighlight text={text} />
      </pre>
    )
  }

  const text = getNodeText(node).trim()
  if (!text) return null

  return (
    <p key={`paragraph-${index}`} className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
      <SearchHighlight text={text} />
    </p>
  )
}

function parsePlainTextBlocks(plain?: string): NoteDocNode[] {
  if (!plain) return []
  const lines = plain.split("\n").map((l) => l.trim()).filter(Boolean)
  const nodes: NoteDocNode[] = []
  let currentBullets: NoteDocNode[] = []
  let currentTasks: NoteDocNode[] = []

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      nodes.push({ type: "bulletList", content: currentBullets })
      currentBullets = []
    }
  }
  const flushTasks = () => {
    if (currentTasks.length > 0) {
      nodes.push({ type: "taskList", content: currentTasks })
      currentTasks = []
    }
  }

  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) {
      flushTasks()
      currentBullets.push({ text: line.replace(/^[-*]\s+/, "") })
    } else if (/^\[([ xX])\]\s+/.test(line)) {
      flushBullets()
      const match = line.match(/^\[([ xX])\]\s+(.*)$/)
      const checked = match?.[1]?.toLowerCase() === "x"
      const text = match ? match[2] : line
      currentTasks.push({ text, attrs: { checked } })
    } else if (/^---+$/.test(line) || /^___+$/.test(line)) {
      flushBullets()
      flushTasks()
      nodes.push({ type: "horizontalRule" })
    } else if (/^#+\s+/.test(line)) {
      flushBullets()
      flushTasks()
      const level = line.match(/^(#+)/)?.[1]?.length || 1
      nodes.push({ type: "heading", attrs: { level }, text: line.replace(/^#+\s+/, "") })
    } else {
      flushBullets()
      flushTasks()
      nodes.push({ type: "paragraph", text: line })
    }
  }
  flushBullets()
  flushTasks()
  return nodes
}

export function NoteContentPreview({
  bookmark,
  showHeader = false,
}: {
  bookmark: any
  showHeader?: boolean
}) {
  const blocks = React.useMemo(() => {
    const rawBlocks = parseNoteBlocks(bookmark.noteDocument)
    const valid = rawBlocks.filter((node) => {
      if (node.type === "horizontalRule") return true
      if (
        node.type === "bulletList" ||
        node.type === "orderedList" ||
        node.type === "taskList"
      ) {
        return (node.content || []).length > 0
      }
      if (
        node.type === "codeBlock" ||
        node.type === "blockquote" ||
        node.type === "heading" ||
        node.type === "paragraph"
      ) {
        return getNodeText(node).trim().length > 0
      }
      return false
    })

    if (valid.length > 0) return valid.slice(0, 6)
    return parsePlainTextBlocks(bookmark.notes || bookmark.description).slice(0, 6)
  }, [bookmark.noteDocument, bookmark.notes, bookmark.description])

  const title = bookmark.title?.trim()
  const displayTitle = title && title !== "Untitled note" ? title : null
  const tags = (bookmark.tags || []).filter((t: any) => t?.name)

  return (
    <div className="flex w-full flex-col gap-2">
      {showHeader && (displayTitle || tags.length > 0) && (
        <div className="flex flex-col gap-1.5 pb-1">
          {displayTitle && (
            <h4 className="line-clamp-2 text-sm font-semibold tracking-tight text-foreground">
              <SearchHighlight text={displayTitle} />
            </h4>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {tags.slice(0, 3).map((tag: any) => (
                <span
                  key={tag.id || tag.name}
                  className="rounded-xs bg-muted/80 px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  #{tag.name}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="line-clamp-4 text-[13px] leading-6 text-foreground/90">
          <SearchHighlight
            text={
              bookmark.notes ||
              bookmark.description ||
              "Click to add note content..."
            }
          />
        </p>
      ) : (
        <div className="max-h-56 space-y-1.5 overflow-hidden">
          {blocks.map((node, index) => renderNoteBlock(node, index))}
        </div>
      )}
    </div>
  )
}
