import type { ReactNode } from "react"
import { Providers } from "../providers"

// The invite page reads the session with React Query, so it needs the provider too.
export default function InviteLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>
}
