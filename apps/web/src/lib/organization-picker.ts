export interface PickerFolder {
  id: string
  name: string
  parentId?: string | null
}

export interface PickerTag {
  name: string
  bookmarkCount?: number
}

/** Paths disambiguate duplicate names; the visited set also handles malformed cycles. */
export function folderOptions(folders: PickerFolder[], excludeId?: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  return folders.flatMap((folder) => {
    const path: string[] = []
    const visited = new Set<string>()
    let current: PickerFolder | undefined = folder
    while (current && !visited.has(current.id)) {
      if (current.id === excludeId) return []
      visited.add(current.id)
      path.unshift(current.name)
      current = byId.get(current.parentId ?? "")
    }
    return [{ id: folder.id, path: path.join(" / ") }]
  }).sort((a, b) => a.path.localeCompare(b.path))
}

export function normalizeTag(value: string) {
  return value.trim().replace(/^#+/, "").trim().replace(/\s+/g, " ").toLowerCase()
}

/** Existing forms use #tag values; API submission strips the prefix. */
export function selectedTags(values: string[]) {
  return [...new Set(values.map(normalizeTag).filter(Boolean))].map((name) => `#${name}`)
}

export function popularTags(tags: PickerTag[], query: string) {
  const search = normalizeTag(query)
  const unique = new Map<string, number>()
  for (const tag of tags) {
    const name = normalizeTag(tag.name)
    if (!name || (search && !name.includes(search))) continue
    unique.set(name, Math.max(unique.get(name) ?? 0, tag.bookmarkCount ?? 0))
  }
  return [...unique].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name)
}
