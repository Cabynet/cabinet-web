# Cabinet optimization audit

## Scope and baseline

Reviewed the API bookmark listing/export/duplicate/reorder paths, dashboard lazy-loaded media dialog, and the existing local changes in web enrichment/polling, thumbnail generation, and summary responses. Existing uncommitted changes were retained; no generated client, dependency manifest, schema, migration, or unrelated application code was reset.

Baseline `pnpm test` passed API (24 suites/257 tests), extension (12 tests), and web (84 tests). Baseline lint was blocked because `eslint` was unavailable in `packages/api-client`; baseline API/web `tsc --noEmit` completed without diagnostics. The repository's installed Next package does not expose the mandated `node_modules/next/dist/docs/` path, so no Next-specific API changes were made other than the standard `next/dynamic` client import.

## Changes and evidence

- `BookmarksService.exportBookmarks`: exports only the fields used by the Netscape HTML serializer and runs folder/root reads concurrently. It no longer fetches note bodies, rich note documents, or drawing payloads. Ordering, escaping, and output markup are unchanged.
- `BookmarksService.findAll`: loads editable-folder permissions only for distinct shared folder IDs on the returned page; performs no permission query if the page contains no shared items. Existing access policy and note sanitization remain intact.
- `BookmarksService.reorder`: validates the complete submitted ID set as before, computes pinned/unloaded slot placements, skips unchanged positions, and updates changed rows in parameterized batches of at most 500 inside the existing transaction. Updates remain scoped to active unpinned user-owned rows and refresh `updatedAt`.
- Duplicate list uses a single grouping pass while preserving URL-group and item order. Cleanup now uses the same active bookmark-only candidate predicate as reporting, selects only required cleanup fields, retains the oldest, and soft-deletes.
- `DownloadMediaDialog` is loaded through `next/dynamic`; the existing open state remains the trigger, with a visible loading overlay while its chunk loads.
- Website metadata thumbnails now keep the original remote `imageUrl`; the enrichment worker no longer copies these images into object storage. User-uploaded media storage remains unchanged. Remote preview display still uses the existing API image proxy for SSRF/hotlink protection. The now-unreferenced thumbnail storage service and its tests were removed.
- Preview metadata polling interval increased from 2 seconds to 5 seconds to reduce repeated requests while enrichment runs.

## Verification and limits

API unit tests and web tests were rerun during implementation. The first API test run exposed stale expectations for the optimized folder query and reorder mock, which were updated. Re-run results are recorded in the implementation summary. No local PostgreSQL/Redis performance harness, isolated synthetic benchmark, browser benchmark, or production-sized query plan was run. No index, schema, data, endpoint, or public client export was changed. Full lint/build verification remains subject to the local toolchain availability noted above.
