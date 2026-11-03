import { createRoot } from "react-dom/client"
import { useEffect } from "react"
import { useForm } from "@tanstack/react-form"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BookmarkDialog } from "../../src/app/cabinet/components/bookmark-dialog"
import { FolderDialog } from "../../src/app/cabinet/components/folder-dialog"

const folders = [
  { id: "design", name: "Design" },
  { id: "references", name: "References", parentId: "design" },
  { id: "typography", name: "Typography", parentId: "references" },
  { id: "work", name: "Work" },
  { id: "other-references", name: "References", parentId: "work" },
  ...Array.from({ length: 220 }, (_, index) => ({ id: `folder-${index}`, name: `Research ${String(index).padStart(3, "0")}` })),
]
const tags = [
  { name: "design", bookmarkCount: 25 },
  { name: "design-system", bookmarkCount: 10 },
  { name: "typography", bookmarkCount: 20 },
  { name: "reference", bookmarkCount: 15 },
  ...Array.from({ length: 150 }, (_, index) => ({ name: `topic-${index}`, bookmarkCount: 0 })),
]

const client = new QueryClient()

function Fixture() {
  const query = new URLSearchParams(location.search)
  const form = useForm({ defaultValues: { url: "", title: "", description: "", folderId: "", tags: [] as string[], type: "BOOKMARK" }, onSubmit: ({ value }) => { Object.assign(window, { saved: value }) } })
  const parentForm = useForm({ defaultValues: { name: "Design", description: "", parentId: "" }, onSubmit: () => {} })
  const folderChoices = query.has("empty") ? [] : folders
  useEffect(() => {
    if (!query.has("preview")) return
    const timer = setTimeout(() => document.querySelector<HTMLElement>("#folderId")?.click(), 400)
    return () => clearTimeout(timer)
    // Preview mode opens the picker for screenshot inspection only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <QueryClientProvider client={client}>
    <h1 className="p-6 text-xl font-semibold">Cabinet</h1>
    {query.has("parent")
      ? <FolderDialog isOpen onOpenChange={() => {}} onClose={() => {}} folderToEdit={folders[0]} folderForm={parentForm} folders={folderChoices} />
      : <BookmarkDialog isOpen onOpenChange={() => {}} onClose={() => {}} bookmarkToEdit={null} bookmarkForm={form} folders={folderChoices} tags={tags} />}
    <form.Subscribe selector={(state) => state.values} children={(values) => <output id="values" hidden>{JSON.stringify(values)}</output>} />
  </QueryClientProvider>
}

createRoot(document.getElementById("root")!).render(<Fixture />)
