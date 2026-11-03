import { cache } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { sharedCollectionItems, type SharedCollection } from "@/lib/shared-collection"
import { SharedCollectionBrowser } from "./shared-collection-browser"

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

const getSharedCollection = cache(async (token: string): Promise<SharedCollection | null> => {
  if (!/^(?:[a-f0-9]{48}|[a-f0-9]{64})$/.test(token)) return null
  const response = await fetch(`${apiUrl}/v1/share/${token}`, { cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Failed to load shared collection")
  const payload = await response.json() as { folder: { name: string }; bookmarks: Array<{ id: string; rawUrl: string; title: string; description: string | null; thumbnailUrl: string | null }> }
  return { name: payload.folder.name, bookmarks: payload.bookmarks.map((item) => ({ id: item.id, url: item.rawUrl, title: item.title, description: item.description, imageUrl: item.thumbnailUrl })) }
})

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const collection = await getSharedCollection(token)
  const title = collection ? `${collection.name} — Cabinet` : "Shared collection — Cabinet"
  const count = collection ? sharedCollectionItems(collection.bookmarks).length : 0
  const description = collection
    ? `${count} saved item${count === 1 ? "" : "s"} shared from Cabinet.`
    : "Shared collection on Cabinet."
  return {
    title, description, referrer: "no-referrer",
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website" },
  }
}

export default async function SharedCollectionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const collection = await getSharedCollection(token)
  if (!collection) notFound()
  const items = sharedCollectionItems(collection.bookmarks)
  const total = items.length

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-6 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-6">
        <Link href="/" className="font-serif text-2xl">Cabinet</Link>
        <span className="text-xs text-muted-foreground">Shared collection · Read only</span>
      </header>
      <section className="flex flex-col gap-3 border-b border-border py-10">
        <p className="text-xs text-muted-foreground">{total} item{total === 1 ? "" : "s"}</p>
        <h1 className="max-w-4xl break-words font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{collection.name}</h1>
      </section>
      <SharedCollectionBrowser token={token} items={items} />
    </main>
  )
}
