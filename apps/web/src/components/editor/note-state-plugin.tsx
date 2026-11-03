"use client"

import { useEffect, useEffectEvent } from "react"
import { $getRoot } from "lexical"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"

/** Permissions are controlled by Cabinet, never by the editor's preview toggle. */
export function NoteStatePlugin({ editable, onChange }: {
  editable: boolean
  onChange: (document: Record<string, unknown>, text: string) => void
}) {
  const [editor] = useLexicalComposerContext()
  const changed = useEffectEvent(onChange)

  useEffect(() => {
    editor.setEditable(editable)
    if (editable) return
    return editor.registerEditableListener((next) => {
      if (next) editor.setEditable(false)
    })
  }, [editor, editable])

  useEffect(() => editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
    if (!editable || (dirtyElements.size === 0 && dirtyLeaves.size === 0)) return
    editorState.read(() => changed({ ...editorState.toJSON() }, $getRoot().getTextContent()))
  }), [editor, editable])

  return null
}
