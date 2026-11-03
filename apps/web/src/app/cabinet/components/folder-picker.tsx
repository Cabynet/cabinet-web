"use client"

import { useMemo, useState } from "react"
import { CaretDown, FolderSimple } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { folderOptions, type PickerFolder } from "@/lib/organization-picker"

const RECENT_KEY = "cabinet:recent-folder-ids:v1"
const MAX_RESULTS = 50

export function FolderPicker({ id, folders, value, onChange, invalid, excludeId, unfiledLabel = "Unfiled" }: {
  id: string
  folders: PickerFolder[]
  value: string
  onChange: (id: string) => void
  invalid?: boolean
  excludeId?: string
  unfiledLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [recent, setRecent] = useState<string[]>([])
  const options = useMemo(() => folderOptions(folders, excludeId), [folders, excludeId])
  const selected = options.find((folder) => folder.id === value)
  const search = query.trim().toLowerCase()
  const matches = options.filter((folder) => folder.path.toLowerCase().includes(search))
  const recentOptions = recent.flatMap((id) => options.find((folder) => folder.id === id) ?? [])
  const choose = (next: string) => {
    onChange(next)
    if (next) {
      const ids = [next, ...recent.filter((id) => id !== next)].slice(0, 5)
      setRecent(ids)
      // Store IDs only; names are resolved against the current account's accessible folders.
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids)) } catch { /* Selection still works without storage. */ }
    }
    setOpen(false)
    setQuery("")
  }

  const renderFolder = (folder: { id: string; path: string }) => <CommandItem
    key={folder.id} value={folder.id} data-checked={folder.id === value} onSelect={() => choose(folder.id)}
    className="min-h-10 gap-2" title={folder.path}
  >
    <FolderSimple aria-hidden="true" className="shrink-0 text-muted-foreground" />
    <span className="min-w-0 flex-1 truncate">{folder.path}</span>
  </CommandItem>

  return <Popover open={open} onOpenChange={(next) => {
    setOpen(next)
    if (next) {
      setQuery("")
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
        setRecent(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && options.some((folder) => folder.id === id)).slice(0, 5) : [])
      } catch { setRecent([]) }
    }
  }}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" role="combobox" aria-expanded={open} aria-invalid={invalid} variant="outline" className="h-10 w-full justify-between gap-2 px-3 text-base font-normal md:text-sm">
        <span className="min-w-0 truncate">{selected?.path ?? unfiledLabel}</span>
        <CaretDown aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] gap-0 p-0">
      <Command shouldFilter={false} loop>
        <CommandInput aria-label="Search folders" placeholder="Search folders…" value={query} onValueChange={setQuery} />
        <CommandList className="max-h-64 overscroll-contain">
          <CommandEmpty>No folders found.</CommandEmpty>
          {!search && <>
            <CommandGroup heading="Location">
              <CommandItem value="__root__" data-checked={!value} onSelect={() => choose("")} className="min-h-10 gap-2">
                <span className="flex-1">{unfiledLabel}</span>
              </CommandItem>
              {selected && renderFolder(selected)}
            </CommandGroup>
            {recentOptions.some((folder) => folder.id !== value) && <CommandGroup heading="Recently used">{recentOptions.filter((folder) => folder.id !== value).map(renderFolder)}</CommandGroup>}
          </>}
          <CommandGroup heading={search ? "Search results" : "All folders"}>
            {matches.filter((folder) => search || (folder.id !== value && !recent.includes(folder.id))).slice(0, MAX_RESULTS).map(renderFolder)}
          </CommandGroup>
        </CommandList>
        {matches.length > MAX_RESULTS && <p className="px-3 py-2 text-xs text-muted-foreground">Showing up to {MAX_RESULTS} folders. Search to narrow the list.</p>}
      </Command>
    </PopoverContent>
  </Popover>
}
