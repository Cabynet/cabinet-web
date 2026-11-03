import type { NoteSnapshot } from "./note-autosave"

export function legacyNoteToDocument(text: string): Record<string, unknown> {
  return {
    root: {
      children: text.split(/\r?\n/).map((line) => ({
        children: line ? [{ detail: 0, format: 0, mode: "normal", style: "", text: line, type: "text", version: 1 }] : [],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      })),
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  }
}

export function parseNoteDraft(value: string | null): NoteSnapshot | null {
  if (!value) return null
  try {
    const draft = JSON.parse(value)
    return typeof draft.title === "string" &&
      typeof draft.notes === "string" &&
      draft.noteDocument?.root?.type === "root" &&
      Array.isArray(draft.noteDocument.root.children)
      ? draft
      : null
  } catch {
    return null
  }
}

type Json = Record<string, any>
const FORMAT = { bold: 1, italic: 2, strike: 4, underline: 8, code: 16 } as const
const base = { direction: null, format: "", indent: 0, version: 1 }
const el = (type: string, children: Json[], extra: Json = {}): Json => ({ ...base, type, children, ...extra })
const text = (value: string, format = 0): Json => ({ detail: 0, format, mode: "normal", style: "", text: value, type: "text", version: 1 })

function inline(nodes: Json[] = []): Json[] {
  return nodes.flatMap((node): Json[] => {
    if (node.type === "hardBreak") return [{ type: "linebreak", version: 1 }]
    if (node.type === "image" && node.attrs?.src) return [{ type: "image", version: 1, src: node.attrs.src, altText: node.attrs.alt ?? "", maxWidth: 500 }]
    if (typeof node.text !== "string") return inline(node.content)
    const marks: Json[] = node.marks ?? []
    const format = marks.reduce((bits, mark) => bits | (FORMAT[mark.type as keyof typeof FORMAT] ?? 0), 0)
    const leaf = text(node.text, format)
    const link = marks.find((mark) => mark.type === "link" && mark.attrs?.href)
    return [link ? el("link", [leaf], { url: link.attrs.href, rel: null, target: null, title: null }) : leaf]
  })
}

const plain = (node: Json): string => (typeof node.text === "string" ? node.text : (node.content ?? []).map(plain).join(""))

function list(node: Json, listType: "bullet" | "number" | "check"): Json {
  const children = (node.content ?? []).flatMap((item: Json): Json[] => {
    const [head, ...rest]: Json[] = item.content ?? []
    const nested = rest.filter((child: Json) => /List$/.test(child.type))
    const row = el("listitem", inline(head?.content), { value: 1, ...(listType === "check" ? { checked: !!item.attrs?.checked } : {}) })
    return [row, ...nested.map((child: Json) => el("listitem", block(child), { value: 1 }))]
  })
  return el("list", children, { listType, start: 1, tag: listType === "number" ? "ol" : "ul" })
}

function block(node: Json): Json[] {
  switch (node.type) {
    case "paragraph": return [el("paragraph", inline(node.content), { textFormat: 0, textStyle: "" })]
    case "heading": return [el("heading", inline(node.content), { tag: `h${Math.min(Math.max(node.attrs?.level ?? 1, 1), 6)}` })]
    case "bulletList": return [list(node, "bullet")]
    case "orderedList": return [list(node, "number")]
    case "taskList": return [list(node, "check")]
    case "blockquote": return [el("quote", (node.content ?? []).flatMap((child: Json, i: number) => [...(i ? [{ type: "linebreak", version: 1 }] : []), ...inline(child.content)]))]
    case "codeBlock": return [el("code", plain(node).split("\n").flatMap((line, i) => [...(i ? [{ type: "linebreak", version: 1 }] : []), ...(line ? [text(line)] : [])]), { language: node.attrs?.language ?? null })]
    case "horizontalRule": return [{ type: "horizontalrule", version: 1 }]
    case "image": return [el("paragraph", inline([node]))]
    default: {
      // Unknown node: keep its text rather than dropping it.
      const value = plain(node)
      return value ? [el("paragraph", [text(value)])] : []
    }
  }
}

/** Converts a pre-Lexical TipTap document to Lexical JSON so opening an old note keeps its formatting. */
export function tiptapToDocument(doc: Json): Json {
  const children = (doc.content ?? []).flatMap(block)
  return { root: el("root", children.length ? children : [el("paragraph", [])]) }
}

export function isTiptapDocument(doc: unknown): doc is Json {
  return !!doc && typeof doc === "object" && (doc as Json).type === "doc" && Array.isArray((doc as Json).content)
}
