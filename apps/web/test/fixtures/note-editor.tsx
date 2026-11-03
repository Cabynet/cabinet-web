import { useState } from "react"
import { createRoot } from "react-dom/client"
import { NoteEditor } from "../../src/components/editor/note-editor"
import { legacyNoteToDocument } from "../../src/lib/note-document"

const initial = legacyNoteToDocument("Write your note here.")

function Fixture() {
  const [editable, setEditable] = useState(true)
  const [version, setVersion] = useState(0)
  const [document, setDocument] = useState(initial)
  return <main className="mx-auto max-w-4xl px-6 py-12">
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-3xl font-semibold">Research notebook</h1>
      <div id="note-header-actions" className="flex items-center" />
    </div>
    <button id="permissions" onClick={() => setEditable((value) => !value)}>Toggle permissions</button>
    <button id="new" onClick={() => { setDocument(initial); setVersion((value) => value + 1) }}>New document</button>
    <button id="reload" onClick={() => setVersion((value) => value + 1)}>Reload saved document</button>
    <NoteEditor key={version} value={document} editable={editable} onChange={(next, text) => {
      setDocument(next)
      Object.assign(window, { noteDocument: next, noteText: text, noteChanges: ((window as any).noteChanges ?? 0) + 1 })
    }} />
  </main>
}

createRoot(window.document.getElementById("root")!).render(<Fixture />)
