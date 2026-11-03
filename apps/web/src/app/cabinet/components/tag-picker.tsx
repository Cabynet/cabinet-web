"use client"

import { useMemo, useRef, useState } from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Plus, X } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { normalizeTag, popularTags, selectedTags, type PickerTag } from "@/lib/organization-picker"

export function TagPicker({ value, tags, onChange, onBlur, invalid, labelId }: {
  value: string[]
  tags: PickerTag[]
  onChange: (value: string[]) => void
  onBlur?: () => void
  invalid?: boolean
  labelId?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const selected = selectedTags(value)
  const normalized = normalizeTag(query)
  const available = useMemo(() => [...tags, ...value.map((name) => ({ name }))], [tags, value])
  const matches = useMemo(() => popularTags(available, query), [available, query])
  const limit = normalized ? 50 : 8
  const canCreate = !!normalized && !available.some((tag) => normalizeTag(tag.name) === normalized)
  const choose = (name: string) => {
    const tag = `#${normalizeTag(name)}`
    onChange(selected.includes(tag) ? selected.filter((value) => value !== tag) : [...selected, tag])
    setQuery("")
    setOpen(true)
    input.current?.focus()
  }

  return <Command label="Tags" shouldFilter={false} loop className="overflow-visible rounded-md bg-transparent">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchor} className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 focus-within:ring-1 focus-within:ring-ring" data-invalid={invalid || undefined}>
          {(expanded ? selected : selected.slice(0, 3)).map((tag) => <Badge key={tag} variant="secondary" className="max-w-full gap-1 rounded-sm py-0.5 font-normal">
            <span className="truncate">{tag}</span>
            <button type="button" aria-label={`Remove ${tag}`} className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" onMouseDown={(event) => event.preventDefault()} onKeyDown={(event) => event.stopPropagation()} onClick={() => onChange(selected.filter((value) => value !== tag))}>
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </Badge>)}
          {!expanded && selected.length > 3 && <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onMouseDown={(event) => event.preventDefault()} onKeyDown={(event) => event.stopPropagation()} onClick={() => { setExpanded(true); input.current?.focus(); setOpen(true) }}>+{selected.length - 3} more</Button>}
          <CommandPrimitive.Input
            asChild
            ref={input}
            aria-label="Tags"
            aria-invalid={invalid}
            placeholder={selected.length ? "Add tags…" : "Search or create tags…"}
            maxLength={30}
            value={query}
            onValueChange={(next) => { setQuery(next); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={onBlur}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") setOpen(true)
              if (event.key === "Backspace" && !query && selected.length) onChange(selected.slice(0, -1))
            }}
            className="min-w-28 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
          ><input aria-expanded={open} aria-labelledby={labelId} /></CommandPrimitive.Input>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] gap-0 p-0" onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()} onInteractOutside={(event) => { if (anchor.current?.contains(event.target as Node)) event.preventDefault() }}>
        <CommandList className="max-h-60 overscroll-contain" label="Tag suggestions">
          <CommandGroup heading={normalized ? "Matching tags" : "Frequently used"}>
            {matches.slice(0, limit).map((name) => <CommandItem key={name} value={name} data-checked={selected.includes(`#${name}`)} onMouseDown={(event) => event.preventDefault()} onSelect={() => choose(name)} className="min-h-10 gap-2" aria-description={selected.includes(`#${name}`) ? "Selected" : undefined}>
              <span className="min-w-0 flex-1 truncate">#{name}</span>
            </CommandItem>)}
            {canCreate && <CommandItem value={`create:${normalized}`} onMouseDown={(event) => event.preventDefault()} onSelect={() => choose(normalized)} className="min-h-10 gap-2">
              <Plus aria-hidden="true" /><span className="min-w-0 truncate">Create “{normalized}”</span>
            </CommandItem>}
          </CommandGroup>
          {!matches.length && !canCreate && <p className="px-3 py-4 text-sm text-muted-foreground">Type to create your first tag.</p>}
        </CommandList>
        {matches.length > limit && <p className="px-3 py-2 text-xs text-muted-foreground">{normalized ? "Search more specifically to narrow the list." : "Search to find more tags."}</p>}
      </PopoverContent>
    </Popover>
  </Command>
}
