# Cabinet

Cabinet is a personal library for bookmarks, notes, and saved reading. It is one product, not a portal for multiple applications.

## Features

- Save links immediately with client metadata; fill missing preview fields in a deduplicated background worker without overwriting user edits.
- Upload PDF documents and images directly to Cloudflare R2 storage; organize them in the library and embed uploaded images inside note editor blocks.
- Write notes in a Notion-style Lexical editor: slash commands, draggable blocks, contextual formatting, tables, images, equations, columns, collapsibles, polls, cards, reviews, mentions, emoji, and embeds.
- Autosave note changes to the account, with visible save errors, retries, and a browser-local draft backup.
- Organize bookmarks and notes with folders and tags. The bookmark dialog searches folders by full ancestor path, remembers five recent folder selections locally (IDs only), and hides the folder field when no folders exist. Its full-width tag field supports searchable multi-selection, usage-ranked suggestions, normalized creation, removable chips, and a compact summary after three tags. Parent-folder selection also searches paths and excludes the edited folder and all descendants.
- Share any folder as a read-only public bookmark collection at `/share/[token]`, and revoke the link at any time without exposing notes, archived items, or subfolders.
- Search with title-weighted relevance, multiword matching, title typo tolerance, and highlighted results.
- Refine by domain, item type, tag, and inclusive UTC date range; save named searches to the account for reuse on other devices.
- Favorite, archive, and reorder saved items.
- Import bookmarks through durable background tasks with nested folders, visible progress, and retry-safe partial imports; export bookmarks as HTML.
- Inspect import, link-check, and metadata status at `/cabinet/activity`, with account-scoped retry controls.
- Follow a dismissible, account-backed first-use guide whose completion reflects actual saves and organization.
- Measure API memory/CPU and request/query latency at `/cabinet/operations`, restricted to explicitly configured operators.
- Check broken links and duplicate bookmarks.
- Open saved links in a browser tab.
- Download supported media.
- Sign in with GitHub, Google, or email and password.
- Automatically create accounts for new OAuth users with verified email addresses.
- Keep folders, bookmarks, and tags private to each user.

## Structure

```text
apps/
  web/              Next.js Cabinet frontend and web-only UI
  api/              NestJS Cabinet API and background workers
packages/
  api-client/       Shared API client and types
  eslint-config/    Lint configuration
  typescript-config/ TypeScript configuration
```

Web UI components, hooks, and styles live in `apps/web/src`. Better Auth handles browser authentication through `apps/web/src/lib/auth-client.ts` and runs in the NestJS API with Prisma-backed sessions. The web API adapter at `apps/web/src/lib/api-client.ts` configures cookie requests, expired-session redirects, and browser downloads. Shared API code has no DOM access or browser authentication policy, so a future React Native application can configure its own transport.

The API contains only the Cabinet feature module. Authentication, user profiles, health checks, and database services support Cabinet.

One Next.js frontend serves all routes:

- `/` is the public landing page, rendered as a Server Component and prerendered for SEO.
- `/login` handles authentication and redirects signed-in users to `/cabinet`.
- `/share/[token]` renders an unindexed, read-only public collection of direct bookmarks in a shared folder.
- `/cabinet` runs the dashboard entirely in the browser using `next/dynamic` with `ssr: false`. Only its loading shell is prerendered; user data is fetched from the separate NestJS API after the dashboard loads.

Query, tooltip, confirmation, and toast providers are scoped to login and Cabinet routes. The landing page does not load the dashboard or make authentication requests. Private routes are excluded from search indexing. API guards remain responsible for authorization; client-side rendering is not a security boundary.

## Notes

Creating or opening a note navigates to `/cabinet/notes/[id]`. The editor is dynamically loaded with server rendering disabled, independently of the dashboard. Blank new pages are not saved until the first change. The API's authenticated `PUT /v1/bookmarks/:id/note` uses a stable UUID so retrying a creation does not create another note. Requests are debounced and serialized; leaving through the Cabinet button flushes outstanding changes.

Structured content is stored in the optional `Bookmark.noteDocument` JSON column. `Bookmark.notes` remains a plain-text preview for the library and search. Legacy text is loaded as literal paragraphs, not HTML, and retains blank lines and markup. Existing folders and tags remain attached. The additive migration does not rewrite old records.

The editor sends a base revision and a stable save UUID. The API atomically checks the revision before updating content and returns HTTP 409 instead of silently overwriting another tab or device. The editor pauses autosave on a conflict; users can review the saved note or explicitly replace the latest version with their draft. Lost-response retries reuse the same save UUID before sending newer typing. The optional revision fields preserve compatibility with older API clients; clients that omit them do not get conflict prevention.

Network failures, HTTP 408/429, and server errors retry with capped exponential backoff while the editor remains open, and immediately when the browser reports reconnection. Permission and validation failures require attention rather than endless retries. “Waiting to sync”, “Saving”, saved, failed, and conflict states are shown separately. This is not a full offline app: loading an existing note still requires the API, and automatic note sync stops when its editor is closed.

Pending changes are backed up in localStorage under the current user and note ID. A recovered draft for an existing server-backed note requires an explicit restore choice before it can replace the saved content. Clearing browser storage removes this local backup, not account data. Images can use public HTTP(S) URLs or be inserted from the file picker, clipboard, or drag-and-drop. Local images are embedded as data URLs in the document, not uploaded to R2; large images increase document and local-draft size.

The note editor uses the MIT-licensed [shadcn-editor](https://github.com/htmujahid/shadcn-editor) extensions and stores serialized Lexical editor state in `Bookmark.noteDocument`. There is no fixed top toolbar: use `/` or the block's `+` handle to insert blocks, drag handles to reorder, and select text to reveal formatting. The bottom activity strip provides counts, undo/redo, import/export, dictation (when the browser supports speech recognition), read-only preview, shortcuts, and language selection. YouTube, X/Twitter, and Figma URLs support embeds; `/equation`, `/image URL`, and `/find` expose tools previously available only from a toolbar. Mentions and autocomplete use the upstream sample names and word dictionaries, not Cabinet account lookup.

Editor-specific Base UI controls live under `src/components/editor/ui` so the existing Cabinet Radix components are unchanged. The editor preview toggle cannot override a viewer's or unrestored draft's read-only restriction. Existing documents from the previous editor are loaded from their plain-text preview; new edits are saved in Lexical format. Run `pnpm --filter @cabinet/web test:notes` for browser checks of insertion, serialization/reload, permissions, and responsive layouts.

## File previews and card sizing

All gallery/card densities enforce a 208px minimum card height; visual preview surfaces have a 176px minimum. Content can still grow taller and PDF previews keep the document's page ratio. List-view rows are unchanged.

PDF thumbnails and the live viewer use the same PDF.js loader. Public file URLs are fetched without cross-origin credentials so wildcard CORS on storage such as R2 works; the file host must still allow cross-origin GET requests. The viewer reuses one document for thumbnails, page changes, rotation, zoom, and continuous layout, and cancels render tasks/destroys workers on close. Loading and unavailable states replace silent blank thumbnails. Run `pnpm --filter @cabinet/web test:pdf` to verify actual PDF/worker rendering against a separate-origin public server, pixel output, viewer controls, failures, and minimum card heights.

## Search

PostgreSQL ranks title matches above descriptions, URLs, and note text. Each search word must match; words of at least four characters also use `pg_trgm` word similarity against titles. Search is limited to 200 characters and the first ten unique words. Highlighting uses React text nodes, never HTML from the database. Personal annotations on other people's links are excluded from both matching and results. Existing folder-access and personal-view rules still apply before pagination.

Search defaults to Best matches; explicit newest, oldest, title, and domain ordering remains available. Domain filters match the normalized host exactly (without `www.`), not arbitrary subdomains. Date endpoints include the selected day in UTC. Named searches store a relative Cabinet URL, belong to the signed-in user, and are deleted with that account.

Apply `20261023000000_search_and_resilient_saves` before deploying the new API. The database role must be allowed to install PostgreSQL's `pg_trgm` extension (or an administrator must install it first). This additive migration introduces saved searches, note revisions, and an account-scoped unique create-request ID.

## Browser extension offline saves

The extension persists bookmark/highlight requests in `chrome.storage.local` before sending them. One background worker serializes queue changes; a Chrome alarm retries pending requests about once a minute, including after the popup closes. The popup lists pending/blocked saves and offers Retry sync and Discard. Reload the extension after updating so Chrome grants its new `alarms` permission.

Retries reuse a UUID protected by an API uniqueness constraint. This prevents duplicate *retry operations*; deliberately saving the same URL twice is still allowed. Queue entries are bound to the account and API origin that captured them. A fresh session must match before sending, and the API rejects an unexpected account, so changing accounts or API addresses cannot replay someone else's drafts. Signing in once online is required before offline capture; folder choices use an account-scoped cached snapshot and can be rejected if permissions later change.

Queued highlights and local note drafts are browser-local data, not encrypted backups. Clearing browser storage or uninstalling the extension removes unsynced data. The queue is not available on another device until synchronization succeeds.

## Data compatibility

Reader View, Live Web View, article extraction, reading progress, and Wayback backup requests are removed. Existing article records remain in the database but are no longer fetched or updated.

The existing database name and migration history remain unchanged. The rename does not delete stored bookmarks, notes, articles, or credentials. Passkey endpoints are disabled; legacy credential records remain stored. Verified Google and GitHub identities automatically link to an existing account with the same email; user records are never merged.

See [how-to-run.md](./how-to-run.md) for setup and development commands, and [operations.md](./operations.md) for worker recovery, import semantics, first-use guidance, operator permissions, and repeatable performance measurements.
