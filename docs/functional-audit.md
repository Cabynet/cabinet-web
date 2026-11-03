# Audit fungsional frontend–backend (Pasca-Perbaikan)

## Kesimpulan

Seluruh ketidakcocokan kontrak utama antara frontend Next.js dan backend Rust (`apps/api-rust`) telah diperbaiki dan diverifikasi menggunakan suite tes terisolasi.

## Hasil Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| `bash apps/api-rust/scripts/test.sh` | **14 suite integrasi + unit test lulus (0 gagal, 0 compiler warning)** pada PostgreSQL & Redis kontainer terisolasi |
| `pnpm --filter @cabinet/api-client generate && pnpm --filter @cabinet/api-client build` | Lulus (OpenAPI & klien Orval tersinkronisasi) |
| `pnpm --filter @cabinet/web exec tsc --noEmit` | Lulus (0 error) |
| `pnpm --filter @cabinet/web test` | **85 tes lulus, 0 gagal** |
| `pnpm --filter @cabinet/web build` | Lulus |
| Browser `enrichment.browser.mjs` | Lulus |
| Browser `moodboard.browser.mjs` | Lulus |
| Browser `shared-collection.browser.mjs` | Lulus |
| Browser `search-and-sync.browser.mjs` | Lulus |
| Browser `account-settings.browser.mjs` | Lulus |

## Ringkasan Perbaikan

1. **Sesi & Proxy (`P0`)**:
   - `apps/web/src/proxy.ts` kini mengenali cookie `cabinet_session` dan menyertakan `?next=` saat redirect.
   - `apps/api-rust/src/modules/auth/handlers.rs` mendukung atribut `Secure` dan `Domain` sesuai konfigurasi serta mengembalikan metadata sesi pada `/v1/auth/me`.

2. **Batas Model & Kontrak API (`P1`)**:
   - Menambahkan `apps/web/src/lib/api-model.ts` (`bookmarkFromApi`, `folderFromApi`) sebagai satu-satunya batas pemetaan `snake_case` API ke model UI.
   - Memperbaiki pembacaan folder/tag sidebar, `total_count` library, duplikat, dan cache React Query.
   - Menyinkronkan OpenAPI Rust dan menghasilkan ulang `@cabinet/api-client`.

3. **Autosave Catatan & Konflik Revisi (`P1`)**:
   - `PUT /v1/bookmarks/:id/note` dan `PATCH /v1/bookmarks/:id` kini menjaga optimistic concurrency (`base_revision`, `save_id` idempoten) serta mendukung pembuatan catatan baru (`?new=1`).
   - Inspector bookmark menyertakan `baseRevision` dan `saveId` sehingga tidak menimpa catatan dari tab lain.

4. **Public Share & Kolaborasi Folder (`P1`)**:
   - Token share distandarkan menjadi 64 karakter hex (`GET/POST/PUT/DELETE /v1/folders/:id/share`, `GET /v1/share/:token`, `POST /v1/share/:token/copy`).
   - Menambahkan endpoint kolaborasi folder (`/collaboration`, `/members`, `/invitation`, `/invitations/:token/accept`) dengan penegakan peran `OWNER`, `EDITOR`, `CONTRIBUTOR`, dan `VIEWER`.

5. **Upload R2, Trash, Bulk Action, Reorder, & Drawing (`P1`)**:
   - `uploadFileToR2` dan `uploadBookmarkToR2` kini memakai alur `/v1/media/presign` -> `PUT` -> `/v1/media/:id/confirm` dengan verifikasi objek & kuota.
   - Menambahkan endpoint `/v1/bookmarks/bulk/:action`, `/reorder`, `/trash/empty`, `/:id/restore`, `/:id/permanent`, `/:id/drawing`, `/health`, `/health/check`, `/scrape`, dan `/embeddable`.
   - Menambahkan manajemen tag (`PATCH /v1/tags/:id`, `POST /v1/tags/:id/merge`, `DELETE /v1/tags/unused`).

6. **Activity, Operations, & Worker (`P2`)**:
   - Menambahkan `/v1/activity`, `/v1/operations/access`, `/v1/operations/metrics`, serta halaman `/cabinet/activity`.
   - Worker metadata kini mendukung wake-up instan (`Notify`), klaim atomik di database, retry eksponensial hingga 3 percobaan, dan polling preview 2 detik.
   - Menambahkan `apps/api-rust/scripts/test.sh` dan `tests/functional_contract_test.rs` agar seluruh tes berjalan di database/Redis kontainer sementara tanpa menyentuh data pengembangan.
