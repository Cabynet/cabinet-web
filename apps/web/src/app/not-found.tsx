import Link from "next/link"
import { Compass } from "@phosphor-icons/react/ssr"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col px-6 sm:px-10">
      <header className="border-b border-border py-6">
        <Link href="/" className="font-serif text-2xl">Cabinet</Link>
      </header>
      <div className="flex flex-1 items-center py-16">
        <Empty className="border border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Compass /></EmptyMedia>
            <EmptyTitle>Page not found</EmptyTitle>
            <EmptyDescription>This page doesn&apos;t exist or has moved. Your library is right where you left it.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild size="sm"><Link href="/cabinet">Open Cabinet</Link></Button>
          </EmptyContent>
        </Empty>
      </div>
    </main>
  )
}
