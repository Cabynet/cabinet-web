import { useMemo, useState } from "react"
import { $getRoot, $getSelection } from "lexical"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { INSERT_EQUATION_COMMAND } from "@/components/editor/extensions/equation"
import { INSERT_FIGMA_COMMAND } from "@/components/editor/extensions/figma"
import { INSERT_TWEET_COMMAND } from "@/components/editor/extensions/twitter"
import { INSERT_YOUTUBE_COMMAND } from "@/components/editor/extensions/youtube"
import { TOGGLE_FIND_REPLACE_COMMAND } from "@/components/editor/extensions/find-replace"
import { INSERT_IMAGE_COMMAND } from "@/components/editor/nodes/image-node"
import { parseFigmaDocumentID } from "@/components/editor/plugins/block-insert/insert-figma-plugin"
import { parseYouTubeVideoID } from "@/components/editor/plugins/block-insert/insert-youtube-plugin"
import { parseTweetID } from "@/components/editor/plugins/block-insert/insert-twitter-plugin"
import { useComponentPickerItems } from "./component-picker-plugin"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"

type Block = "Equation" | "YouTube" | "Tweet" | "Figma" | "Image URL" | "Emoji"

/** Blocks previously reachable only from the fixed toolbar. */
export function ExtraBlocksPickerPlugin() {
  const [editor] = useLexicalComposerContext()
  const [block, setBlock] = useState<Block | null>(null)
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const items = useMemo(() => {
    const blocks: Block[] = ["Equation", "YouTube", "Tweet", "Figma", "Image URL", "Emoji"]
    return [
      ...blocks.map((name) => ({ value: `extra-${name}`, label: name, keywords: [name.toLowerCase(), name === "Equation" ? "math latex" : "embed"], onSelect: () => { setValue(""); setError(""); setBlock(name) } })),
      { value: "find-replace", label: "Find and replace", keywords: ["search", "replace"], onSelect: () => { editor.dispatchCommand(TOGGLE_FIND_REPLACE_COMMAND, undefined) } },
    ]
  }, [editor])
  useComponentPickerItems(items)

  function insert() {
    if (!editor.isEditable() || !block || !value.trim()) return
    const text = value.trim()
    const id = block === "YouTube" ? parseYouTubeVideoID(text) : block === "Tweet" ? parseTweetID(text) : block === "Figma" ? parseFigmaDocumentID(text) : null
    if (["YouTube", "Tweet", "Figma"].includes(block) && !id) { setError(`Enter a valid ${block} URL.`); return }
    if (block === "Image URL") {
      try { if (!["https:", "http:"].includes(new URL(text).protocol)) throw new Error() }
      catch { setError("Use an HTTP or HTTPS image URL."); return }
    }
    editor.update(() => { if (!$getSelection()) $getRoot().selectEnd() })
    if (block === "Equation") editor.dispatchCommand(INSERT_EQUATION_COMMAND, { equation: text, inline: false })
    if (block === "YouTube" && id) editor.dispatchCommand(INSERT_YOUTUBE_COMMAND, id)
    if (block === "Tweet" && id) editor.dispatchCommand(INSERT_TWEET_COMMAND, id)
    if (block === "Figma" && id) editor.dispatchCommand(INSERT_FIGMA_COMMAND, id)
    if (block === "Image URL") editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src: text, altText: "" })
    if (block === "Emoji") editor.update(() => $getSelection()?.insertText(text))
    setBlock(null)
  }

  return <Dialog open={block !== null} onOpenChange={(open) => { if (!open) setBlock(null) }}>
    <DialogContent>
      <DialogHeader><DialogTitle>Insert {block}</DialogTitle><DialogDescription>{block === "Equation" ? "Enter a LaTeX expression." : block === "Emoji" ? "Enter or paste an emoji." : "Paste the URL to embed in your note."}</DialogDescription></DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); insert() }} className="flex flex-col gap-4">
        <Field><FieldLabel htmlFor="block-value">{block === "Equation" ? "LaTeX" : block === "Emoji" ? "Emoji" : "URL"}</FieldLabel><Input id="block-value" autoFocus value={value} onChange={(event) => { setValue(event.target.value); setError("") }} aria-invalid={!!error} /></Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="submit" disabled={!value.trim()}>Insert</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
