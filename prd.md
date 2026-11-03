# Product Requirements & System Design Document (PRD)
## Platform Bookmark & Personal Knowledge Manager (Modular Monolith — Rust + Axum)

**Status Dokumen:** Draft Final v1.0  
**Target Skala Awal:** 100 – 2.000+ User Aktif (~1 – 5 Juta Item Bookmark & Catatan)  
**Target Infrastruktur Backend:** 1x Linux VPS (2 GB RAM) + Cloudflare R2 + Cloudflare Pages/Vercel (Frontend Web)  
**Ekosistem Aplikasi Client:** Web App, Browser Extension, Desktop App (Tauri), Mobile App (iOS & Android via React Native/Expo)

---

## Ringkasan Eksekutif & Prinsip Desain (*Anti-Overkill*)

Produk ini adalah aplikasi penyimpan **Bookmark, Dokumen (PDF/Gambar), dan Catatan (Notes)** lintas perangkat dengan fokus utama pada **kecepatan respons instan**, **pencarian akurat**, dan **efisiensi infrastruktur ekstrem**.

Untuk melayani ratusan hingga ribuan user di atas **VPS 2 GB RAM** sekaligus mendukung **5 platform aplikasi** (Backend API, Web, Extension, Desktop, Mobile), sistem ini menerapkan filosofi **Right-Sized Engineering**:

### Apa yang Kita Terapkan:
1. **Headless Backend API Terpisah (Repo Tersendiri):** Dibangun menggunakan **Rust + Axum** sebagai **Modular Monolith** (HTTP API + Background Worker dalam satu *codebase* dan satu *binary* ringan ~30–50 MB RAM).
2. **Kontrak API Tunggal (`/v1` OpenAPI):** Seluruh client (Web, Extension, Desktop, Mobile) berbicara ke API yang sama menggunakan SDK/tipe yang di-generate otomatis dari spesifikasi OpenAPI.
3. **PostgreSQL 17 sebagai Sumber Kebenaran & Mesin Pencari:** Memanfaatkan `UUIDv7`, *Composite Index*, *Keyset Pagination*, Full-Text Search (`tsvector`), dan *Fuzzy Matching* (`pg_trgm`).
4. **Redis 7 yang Dibatasi Ketat:** Digunakan khusus untuk antrean background worker berprioritas, *rate-limiting*, dan cache deduplikasi metadata URL.
5. **Cloudflare R2 + CDN:** Penyimpanan objek tanpa biaya *egress* untuk *direct upload* file user (PDF/Gambar) dan hasil kompresi thumbnail WebP.
6. **Pemisahan Hosting Frontend:** Aplikasi Web dideploy di **Cloudflare Pages / Vercel**, sehingga VPS 2 GB murni 100% melayani API, Worker, PostgreSQL, dan Redis.

### Apa yang Sengaja TIDAK Kita Gunakan (*Non-Goals / Hindari Overkill*):
- **TIDAK pakai Microservices / Kafka / RabbitMQ / Kubernetes:** Menambah *network latency* dan memakan ratusan MB RAM tanpa manfaat nyata di skala ribuan user.
- **TIDAK pakai Elasticsearch / Meilisearch di fase awal:** Menghindari masalah sinkronisasi dua database (*dual-write*) dan menghemat >500 MB RAM; PostgreSQL FTS + `pg_trgm` sudah mampu menjawab pencarian < 20 ms.
- **TIDAK pakai Headless Browser (Playwright/Puppeteer) atau DOM berat untuk scraping umum:** Ekstraksi metadata cukup membaca stream HTML bagian `<head>` menggunakan streaming parser ringan.
- **TIDAK menyertakan fitur berat di luar inti:** Tidak ada fitur papan gambar (*Drawing/Whiteboard*) atau pengarsipan penuh seluruh halaman web (*Wayback/Full HTML Clone*) agar penyimpanan dan pemrosesan tetap ramping.

---

## Cakupan Fitur Produk (Functional Scope)

### 1. Autentikasi Multi-Platform (Dual Auth)
- Metode masuk: **Email + Password** (`Argon2id`), **Google OAuth**, dan **GitHub OAuth** (mendukung *PKCE* untuk Mobile & Desktop).
- **Dual Session Transport:**
  - **Web App:** Menggunakan `HttpOnly, Secure, SameSite=Lax` Cookie.
  - **Mobile, Desktop, & Browser Extension:** Menggunakan header `Authorization: Bearer <session_token>` yang disimpan di penyimpanan aman perangkat (*Keychain/Keystore* atau `chrome.storage.local`).
- Manajemen sesi aktif (lihat daftar perangkat login & *revoke* sesi jarak jauh).

### 2. Manajemen Bookmark, Folder, & Tag
- Simpan URL dengan dukungan **Folder Hierarkis** (bersarang), **Multi-Tag**, **Pin**, **Favorite**, **Archive**, dan **Soft Delete (Trash)**.
- **Deteksi Duplikat:** Memberi peringatan opsional atau daftar pembersihan untuk link yang identik berdasarkan `url_hash` yang sudah dinormalisasi.
- **Custom Reorder & Multi-Sort:** Urutkan berdasarkan terbaru, terlama, judul, domain, atau urutan manual (*pinned-first*).

### 3. Catatan (Notes) Terintegrasi
- Mendukung item bertipe `NOTE` mandiri maupun catatan yang menempel pada `BOOKMARK`.
- Menyimpan dokumen blok terstruktur (`note_document` berupa JSON) sekaligus teks polos hasil ekstraksi (`notes_plain`) untuk kebutuhan preview dan indeks pencarian.
- **Autosave Aman Konflik:** Menggunakan *Optimistic Concurrency Control* berbasis nomor `revision` dan `save_id` idempoten. Jika diedit dari 2 perangkat bersamaan, API mengembalikan `HTTP 409 Conflict` alih-alih menimpa ketikan user secara diam-diam.

### 4. Upload Dokumen & Gambar
- Upload file **PDF** dan **Gambar** (PNG, JPG, WebP, GIF) langsung dari client ke **Cloudflare R2** via *Presigned PUT URL*.
- Gambar yang diunggah dapat berdiri sendiri sebagai item koleksi maupun disematkan di dalam blok editor Catatan.

### 5. Berbagi Koleksi Publik (*Public Folder Share*)
- Setiap folder dapat dibagikan sebagai halaman *read-only* publik melalui tautan `/share/:token` yang dapat dicabut (*revoke*) kapan saja.
- Demi privasi, halaman publik hanya menampilkan bookmark aktif di folder tersebut dan **tidak pernah mengekspos** catatan pribadi, item arsip, isi tempat sampah, atau subfolder privat.

### 6. Import, Export, & Pemeliharaan Koleksi
- **Import HTML (Standar Netscape Bookmark):** Berjalan di background worker lengkap dengan struktur folder bersarang, pelacakan progres (`/v1/tasks`), dan aman di-retry sebagian jika gagal.
- **Export HTML:** Menghasilkan file HTML standar agar user bebas membawa datanya kapan saja (*zero vendor lock-in*).
- **Broken Link Checker:** Pemeriksaan status kesehatan tautan (aktif/redirect/mati) secara terjadwal atau dipicu user dengan batas kuota yang wajar.

---

## 1. Gambaran Arsitektur (Modular Monolith + Async Worker)

Backend dibangun dalam **repository Git tersendiri** menggunakan **Rust + Axum**, terpisah penuh dari repository Frontend/Client.

### Diagram Arsitektur Sistem

```text
  ┌──────────────┐  ┌───────────────────┐  ┌───────────────┐  ┌──────────────────┐
  │   Web App    │  │ Browser Extension │  │  Desktop App  │  │    Mobile App    │
  │(CF/Vercel UI)│  │   (WXT / TS)      │  │ (Tauri Shell) │  │(Expo / RN iOS+An)│
  └──────┬───────┘  └─────────┬─────────┘  └───────┬───────┘  └────────┬─────────┘
         │ (Cookie)           │ (Bearer)           │ (Bearer)          │ (Bearer)
         └────────────────────┴──────────┬─────────┴───────────────────┘
                                         │ HTTPS (/v1/* OpenAPI Contract)
                                         ▼
  ============================== [ LINUX VPS — 2 GB RAM ] ==============================
  │                                                                                    │
  │                        ┌───────────────────────────┐                               │
  │                        │  Caddy 2 (Reverse Proxy)  │ ◄── Auto TLS / HTTP3          │
  │                        └─────────────┬─────────────┘                               │
  │                                      │ 127.0.0.1:4000                              │
  │                                      ▼                                             │
  │        ┌───────────────────────────────────────────────────────────┐               │
  │        │         RUST BACKEND BINARY (Modular Monolith)            │               │
  │        │                                                           │               │
  │        │  ┌─────────────────────────┐   ┌───────────────────────┐  │               │
  │        │  │   Axum HTTP API Server  │   │  Tokio Worker Engine  │  │               │
  │        │  │ (Auth, CRUD, Search,    │   │ (Enrichment, Import,  │  │               │
  │        │  │  Notes, Share, Presign) │   │  Thumbnails, LinkChk) │  │               │
  │        │  └────────────┬────────────┘   └───────────┬───────────┘  │               │
  │        └───────────────┼────────────────────────────┼──────────────┘               │
  │                        │                            │                              │
  │           ┌────────────┴────────────┐  ┌────────────┴────────────┐                 │
  │           ▼                         │  ▼                         │                 │
  │  ┌──────────────────┐         ┌─────┴────────────┐               │                 │
  │  │  PostgreSQL 17   │         │     Redis 7      │               │                 │
  │  │ (Data + FTS/Trgm)│         │ (Queues + Cache) │               │                 │
  │  └──────────────────┘         └──────────────────┘               │                 │
  =====================================================================│================
                                                                       │
                         ┌─────────────────────────────────────────────┴───────────┐
                         ▼ (Outbound Fetch + SSRF Guard)                           ▼ (S3 API / Presign)
              [ Target Websites / URL ]                                 [ Cloudflare R2 + CDN ]
              (Stream < 1MB, Read <head>)                               (Uploads & WebP Thumbnails)
```

### Struktur Modular di Dalam Codebase Rust
Walaupun dikompilasi menjadi **1 file binary tunggal** (hemat memori & mudah di-deploy), batas antar domain di dalam kode dijaga ketat layaknya modul independen:

```text
bookmark-api/
├── Cargo.toml
├── migrations/              # SQLx pure SQL migrations (terkontrol versi)
└── src/
    ├── main.rs              # Entrypoint (--mode=all | api | worker)
    ├── config.rs            # Validasi env vars saat startup (fail-fast)
    ├── infra/               # Pool SQLx, Redis client, R2 S3 signer, SSRF HTTP client
    ├── modules/
    │   ├── auth/            # Cookie + Bearer middleware, OAuth PKCE, Argon2id, Sessions
    │   ├── bookmarks/       # CRUD, URL normalizer, deduplikasi, cursor pagination
    │   ├── notes/           # JSON document storage, revision conflict check (409)
    │   ├── folders/         # Hierarchy tree, public share token
    │   ├── tags/            # User-scoped tags & batch assignment
    │   ├── search/          # Query builder FTS + pg_trgm + saved searches
    │   ├── media/           # Presigned upload R2, kuota user, konfirmasi aset
    │   └── tasks/           # Import/export HTML & status progres background task
    └── worker/              # Consumer Redis queue (interactive vs bulk) + Semaphores
```

### Rekomendasi Stack Crate Rust (Ringan & Teruji)
- **Web & Middleware:** `axum`, `tokio`, `tower`, `tower-http` (CORS lintas web/extension/tauri, compression, request-id, timeout).
- **Database:** `sqlx` (compile-time checked SQL untuk PostgreSQL, tanpa overhead ORM berat).
- **Redis:** `fred` atau `redis` (async connection pool).
- **OpenAPI & Kontrak Client:** `utoipa` + `utoipa-axum` (menghasilkan `openapi.json` otomatis dari struct `serde` Rust untuk di-generate menjadi TypeScript client bagi Web, Extension, Desktop, dan Mobile).
- **HTTP Scraper & HTML Streaming:** `reqwest` (dengan custom `Resolve` DNS guard) + `lol_html` (streaming HTML rewriter/parser berbasis C/Rust milik Cloudflare dengan pemakaian memori konstan beberapa KB).
- **Object Storage (Cloudflare R2):** `rust-s3` atau signer S3 ringan berbasis `hmac`/`sha2` (menghindari kompilasi AWS SDK raksasa jika hanya butuh Presigned URL, `PutObject`, dan `DeleteObject`).
- **Keamanan & Kriptografi:** `argon2` (password hashing), `rand` + `sha2` (session & share token hashing), `uuid` (fitur `v7`).

### Strategi Multi-Client & Kompatibilitas API
- Semua route diprefiks dengan `/v1/...`.
- **Aturan Anti-Breaking Change:** Karena aplikasi Mobile (App Store / Play Store) dan Browser Extension (Chrome Web Store) memiliki jeda review dan user tidak selalu langsung update, API `/v1` **dilarang menghapus atau mengubah tipe field JSON yang sudah rilis**. Penambahan fitur hanya boleh bersifat *additive* (field opsional baru).
- **Desktop & Mobile Reuse:**
  - **Desktop App:** Dibangun dengan **Tauri** membungkus UI Web App + fitur native OS (*Global Shortcut* simpan cepat & *System Tray*).
  - **Mobile App:** Dibangun dengan **React Native (Expo)** fokus pada kecepatan buka koleksi dan integrasi **OS Share Sheet** (simpan link langsung dari browser/aplikasi lain di HP).

---

## 2. Jalur Tulis (Write Path): *"Save-First, Enrich-Later"*

Operasi menyimpan bookmark dari Web, Mobile Share Sheet, maupun Browser Extension **tidak boleh pernah menunggu** respons dari website tujuan.

### Alur Penyimpanan Instan (Target Latensi API: `p95 < 25 ms`)

```text
Client (Web / Ext / Mobile)                Axum API                     PostgreSQL          Redis Queue
            │                                 │                             │                    │
            ├── POST /v1/bookmarks ──────────►│                             │                    │
            │   { url, title?, folder_id?,    │ 1. Validasi & Normalisasi   │                    │
            │     client_request_id }         │    URL -> hitung url_hash   │                    │
            │                                 │                             │                    │
            │                                 ├── 2. INSERT ON CONFLICT ───►│                    │
            │                                 │   (user_id, client_req_id)  │                    │
            │                                 │◄─ Return row (PENDING) ─────┤                    │
            │                                 │                             │                    │
            │                                 ├── 3. LPUSH queue:interactive┼───────────────────►│
            │                                 │                             │                    │
            │◄── 201 Created (< 25ms) ────────┤                             │                    │
            │   (Langsung tampil di UI)       │                             │                    │
```

### Aturan Penting pada Write Path:
1. **Idempotency Wajib (`client_request_id`):**
   - Setiap client men-generate UUID saat tombol *Save* ditekan dan menyimpannya di *offline queue* lokal perangkat sampai mendapat respons `200/201`.
   - Constraint database `UNIQUE (user_id, client_request_id)` menjamin bahwa meskipun sinyal HP/WiFi putus dan client melakukan *retry* 5 kali, hanya **1 bookmark** yang tercatat dan server mengembalikan item yang sama dengan aman.
2. **Prinsip *"Fill-Missing, Never Overwrite User Intent"*:**
   - Tabel `bookmarks` melacak apakah `title` atau `description` diisi secara eksplisit oleh user (`user_edited_title`, `user_edited_desc`) atau hanya *fallback* sementara dari URL/tab browser.
   - Saat background worker selesai mengambil metadata 2 detik kemudian, query `UPDATE` hanya mengisi kolom yang belum pernah diedit manual oleh user:
     ```sql
     UPDATE bookmarks
     SET
       title = CASE WHEN user_edited_title THEN title ELSE COALESCE($2, title) END,
       description = CASE WHEN user_edited_desc THEN description ELSE COALESCE($3, description) END,
       thumbnail_url = COALESCE(thumbnail_url, $4),
       favicon_url = COALESCE(favicon_url, $5),
       site_name = COALESCE(site_name, $6),
       metadata_status = 'COMPLETED',
       last_enriched_at = NOW(),
       updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL;
     ```

---

## 3. Desain Database & Indexing (80% Sumber Performa)

Seluruh skema dirancang di PostgreSQL 17 menggunakan **`UUIDv7`** (time-ordered UUID) sebagai Primary Key. Berbeda dengan `UUIDv4` yang acak dan memecah halaman *B-Tree index* (*index fragmentation*), `UUIDv7` menjaga urutan waktu sehingga operasi `INSERT` dan pembacaan rentang waktu berjalan jauh lebih cepat dan hemat memori cache.

### Skema Tabel Inti (Ringkasan DDL)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Users & Auth (Mendukung Cookie Web & Bearer Token Mobile/Ext/Desktop)
CREATE TABLE users (
    id UUID PRIMARY KEY, -- UUIDv7
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash TEXT,  -- Nullable untuk akun murni OAuth
    name TEXT NOT NULL,
    avatar_url TEXT,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    storage_quota_bytes BIGINT NOT NULL DEFAULT 524288000, -- Default 500 MB/user
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL UNIQUE, -- SHA-256 dari raw session token (tidak simpan token polos!)
    client_type VARCHAR(20) NOT NULL DEFAULT 'WEB', -- WEB | EXTENSION | DESKTOP | MOBILE
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Folders (Adjacency List + Public Share Token)
CREATE TABLE folders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    position INT NOT NULL DEFAULT 0,
    share_token_hash BYTEA UNIQUE, -- Untuk akses publik /share/:token yang aman
    share_enabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bookmarks & Notes
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY, -- UUIDv7
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    item_type VARCHAR(16) NOT NULL DEFAULT 'LINK', -- LINK | NOTE | PDF | IMAGE

    -- URL & Dedup Fields (Nullable jika murni NOTE)
    raw_url TEXT,
    normalized_url TEXT,
    url_hash BYTEA,               -- SHA-256(normalized_url) untuk lookup duplikat O(1)
    normalized_domain VARCHAR(255),

    -- Konten & Metadata
    title TEXT NOT NULL,
    description TEXT,
    site_name VARCHAR(120),
    thumbnail_url TEXT,
    favicon_url TEXT,
    user_edited_title BOOLEAN NOT NULL DEFAULT FALSE,
    user_edited_desc BOOLEAN NOT NULL DEFAULT FALSE,

    -- Catatan (Notes) & Optimistic Concurrency
    notes_plain TEXT,             -- Dipakai untuk preview list & Full-Text Search
    note_document JSONB,          -- Hanya di-SELECT saat membuka halaman detail/editor catatan!
    note_revision INT NOT NULL DEFAULT 0,
    last_note_save_id UUID,

    -- Status Organisasi & Pengurutan
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL DEFAULT 0,

    -- Status Worker & Kesehatan Link
    client_request_id UUID,
    source VARCHAR(16) NOT NULL DEFAULT 'WEB',
    metadata_status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSING | COMPLETED | FAILED
    metadata_error VARCHAR(300),
    last_enriched_at TIMESTAMPTZ,
    http_status_code SMALLINT,
    link_health VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',     -- UNKNOWN | OK | REDIRECT | BROKEN
    last_checked_at TIMESTAMPTZ,

    -- Search Vector (Diperbarui via Trigger ringan saat INSERT/UPDATE teks/tag)
    search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_user_client_req UNIQUE (user_id, client_request_id)
);

-- 4. Tags & Relasi Many-to-Many
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug VARCHAR(64) NOT NULL,  -- lowercase trimmed untuk keunikan konsisten
    name VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_tag_slug UNIQUE (user_id, slug)
);

CREATE TABLE bookmark_tags (
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);

-- 5. Media Assets (Pelacakan File R2 & Kuota Penyimpanan)
CREATE TABLE media_assets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bookmark_id UUID REFERENCES bookmarks(id) ON DELETE SET NULL,
    object_key TEXT NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING_UPLOAD', -- PENDING_UPLOAD | READY | DELETED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Background Tasks (Visibilitas Progres Import / Bulk Check ke User)
CREATE TABLE background_tasks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(24) NOT NULL, -- IMPORT_HTML | CHECK_LINKS
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    total_items INT NOT NULL DEFAULT 0,
    processed_items INT NOT NULL DEFAULT 0,
    failed_items INT NOT NULL DEFAULT 0,
    error_message VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);
```

### Strategi Indexing Presisi (Tanpa *Index Bloat*)
Setiap index utama meletakkan `user_id` di kolom pertama dan menggunakan **Partial Index (`WHERE deleted_at IS NULL`)** agar ukuran index di RAM tetap ramping:

```sql
-- Listing utama (All / Archive) dengan Keyset Pagination instan
CREATE INDEX idx_bookmarks_main_feed
    ON bookmarks (user_id, is_archived, is_pinned DESC, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Listing per Folder
CREATE INDEX idx_bookmarks_folder_feed
    ON bookmarks (user_id, folder_id, is_pinned DESC, position ASC, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Filter Favorit
CREATE INDEX idx_bookmarks_favorites
    ON bookmarks (user_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL AND is_favorite = TRUE;

-- Filter Domain & Deteksi Duplikat O(1)
CREATE INDEX idx_bookmarks_domain
    ON bookmarks (user_id, normalized_domain, created_at DESC)
    WHERE deleted_at IS NULL AND normalized_domain IS NOT NULL;

CREATE INDEX idx_bookmarks_url_hash
    ON bookmarks (user_id, url_hash)
    WHERE deleted_at IS NULL AND url_hash IS NOT NULL;

-- Reverse lookup untuk filter berdasarkan Tag
CREATE INDEX idx_bookmark_tags_reverse ON bookmark_tags (tag_id, bookmark_id);

-- Folder Tree milik 1 user (diambil sekaligus ke memori dalam < 2ms)
CREATE INDEX idx_folders_user ON folders (user_id, parent_id, position);
```

### Aturan Query Database:
1. **Wajib Keyset (Cursor) Pagination:** Jangan gunakan `OFFSET`. Cursor dikodekan secara *opaque* (`base64url` dari `(is_pinned, sort_value, id)`), menjaga kecepatan halaman ke-1 maupun halaman ke-500 tetap konsisten **< 5 ms**.
2. **Jangan pernah `SELECT *` pada endpoint Listing:** Kolom `note_document` (JSON blok editor yang bisa berukuran puluhan/ratusan KB per item) **dilarang** ikut diambil pada endpoint daftar bookmark (`GET /v1/bookmarks`). Kolom tersebut hanya diambil pada `GET /v1/bookmarks/:id`.

---

## 4. Arsitektur Pencarian (Search): Maksimalkan PostgreSQL

Pencarian dirancang 100% di atas PostgreSQL menggunakan kombinasi **Weighted `tsvector`** dan **Trigram (`pg_trgm`)** agar sanggup menangani bahasa campuran (Indonesia, Inggris, istilah koding/teknis) sekaligus toleran terhadap salah ketik (*typo*).

### Bobot Relevansi (`search_vector`)
Gunakan konfigurasi `'simple'` (bukan `'english'` saja, supaya kata bahasa Indonesia dan istilah teknis tidak terpotong keliru oleh *stemmer* bahasa Inggris):
- **Weight `A` (Prioritas Tertinggi):** `title` + daftar nama `tags`
- **Weight `B` (Menengah):** `normalized_domain` + token jalan URL (`raw_url`)
- **Weight `C` (Pendukung):** `description` + `notes_plain`

### Index Pencarian
```sql
-- GIN Index untuk Full-Text Search cepat
CREATE INDEX idx_bookmarks_search_vector
    ON bookmarks USING GIN (search_vector)
    WHERE deleted_at IS NULL;

-- GIN Trigram Index khusus pada Title untuk Typo Tolerance & Substring
CREATE INDEX idx_bookmarks_title_trgm
    ON bookmarks USING GIN (title gin_trgm_ops)
    WHERE deleted_at IS NULL;
```

### Strategi Eksekusi & Ranking Pencarian
1. Batasi panjang kueri pencarian maksimal **200 karakter** dan maksimal **8 kata unik** agar aman dari *query abuse*.
2. Setiap kata pencarian dengan panjang $\ge 4$ karakter dicocokkan menggunakan gabungan:
   - Pencocokan kata/prefix via `tsquery` (`word:*`), **ATAU**
   - Kemiripan kata pada judul via `pg_trgm` (`word_similarity(word, title) >= 0.45`).
3. Skor akhir diurutkan menggunakan kombinasi `ts_rank_cd(search_vector, query)` ditambah bonus skor kemiripan judul (`word_similarity`), dengan fallback pengurutan `created_at DESC, id DESC`.
4. **Keamanan Highlighting:** API mengembalikan posisi/potongan kata yang cocok atau teks polos; rendering `<mark>` dilakukan murni di sisi komponen UI (tidak pernah merender raw HTML dari database untuk mencegah XSS).

---

## 5. Keamanan & Ketahanan Background Worker (Sangat Krusial!)

Background worker berjalan sebagai task terkelola di atas runtime `Tokio` yang dikendalikan dengan `tokio::sync::Semaphore` ketat agar pemakaian CPU dan RAM selalu terprediksi di VPS 2 GB.

### A. Pemisahan Antrean & *Fairness* di Redis (Anti *Noisy Neighbor*)
Jika User A mengimpor 10.000 bookmark HTML, User B yang baru menyimpan 1 link dari ekstensi Chrome **tidak boleh ikut mengantre di belakang 10.000 item tersebut**.
- **`queue:interactive` (Prioritas Tinggi):** Dipakai untuk simpan link satuan (`POST /v1/bookmarks`). Concurrency semaphore: `4` task paralel.
- **`queue:bulk` (Prioritas Rendah + Per-User Fairness):** Dipakai untuk *HTML Import* dan *Broken Link Check*. Menggunakan mekanisme *round-robin per aktif user* di Redis dengan batas maksimal `2` fetch paralel per user, dan total global semaphore `3` task paralel.
- **Deduplikasi Metadata (`meta:cache:<url_hash>`):** Hasil ekstraksi metadata disimpan sementara di Redis dengan **TTL 24 jam**. Jika beberapa user menyimpan artikel populer yang sama di hari yang sama, worker cukup membaca cache Redis dalam `< 1 ms` tanpa menembak website tujuan lagi.

### B. Proteksi SSRF (*Server-Side Request Forgery*) Berlapis — WAJIB
Karena URL berasal dari input user, HTTP client milik worker **wajib** menerapkan custom DNS resolver (`reqwest::dns::Resolve`):
1. Hanya izinkan skema `http://` dan `https://` pada port standar (`80` dan `443`, atau tolak port sensitif internal).
2. Sebelum koneksi TCP dibuka, resolve hostname ke daftar IP dan **blokir keras** seluruh rentang IP non-publik:
   - Loopback: `127.0.0.0/8`, `::1`
   - Private networks (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Link-local & Cloud Metadata (AWS/GCP/DO/Vultr): `169.254.0.0/16`, `fe80::/10`
   - Unique Local IPv6, Carrier-Grade NAT (`100.64.0.0/10`), Multicast, Broadcast, dan `0.0.0.0/8`.
3. **Validasi Ulang di Setiap Redirect:** Nonaktifkan auto-redirect buta! Batasi maksimal **5 kali redirect**, dan setiap URL tujuan redirect wajib melewati pemeriksaan SSRF IP yang sama (mencegah serangan redirect dari domain publik ke `http://127.0.0.1:4000`).

### C. Batas Sumber Daya (*Resource Bounding*) saat Membaca URL
1. **Timeout Ketat:** TCP connect timeout **3 detik**, total operasi baca maksimal **8 detik**.
2. **Stream Limit & Early Abort:**
   - Cek header `Content-Type`. Jika bertipe binary besar (`video/*`, `audio/*`, `application/zip`, `application/octet-stream`), **langsung batalkan pembacaan body** dan catat tipe kontennya berdasarkan header/ekstensi URL saja.
   - Untuk `text/html`, alirkan *byte chunks* langsung ke streaming parser **`lol_html`** dengan batas keras maksimal **1 MB**.
   - Begitu tag penutup **`</head>`** ditemukan (biasanya hanya di 15–50 KB pertama!), **segera hentikan koneksi HTTP** tanpa mengunduh sisa `<body>` halaman. Memori worker tetap rata di kisaran beberapa ratus KB per job!
3. **Retry Cerdas:** Hanya ulangi kegagalan jaringan sementara (`timeout`, `429`, `502/503/504`) maksimal **3 kali** dengan *exponential backoff* (`5s`, `30s`, `2m`). Error permanen (`404`, `403`, DNS gagal, SSRF ditolak) langsung ditandai `FAILED` tanpa mengulang sia-sia.

---

## 6. Penanganan Gambar, File Upload, dan *Perceived Performance*

### A. Pipeline Thumbnail & Favicon (Bebas Hotlink & Cepat Dibuka)
Membiarkan browser user me-load 50 gambar `og:image` asli langsung dari 50 server pihak ketiga membuat dashboard terasa lambat, membocorkan IP user, dan sering rusak karena *link rot* atau ukuran gambar asli mencapai 5 MB.

**Alur yang diterapkan:**
1. Saat worker mendapatkan URL `og:image`, worker mengunduh gambar tersebut (melalui SSRF guard yang sama, batas ukuran download gambar sumber maks **5 MB**, timeout **6 detik**).
2. Di-decode dan di-resize di memori (dibatasi `Semaphore` khusus **maksimal 1 atau 2 konversi gambar bersamaan** agar RAM VPS 2 GB aman dari lonjakan piksel mentah) menjadi **WebP** ukuran lebar maks `640px` (~25–50 KB).
3. Disimpan di **Cloudflare R2** dengan key deterministik `thumbs/<url_hash>.webp` dan header `Cache-Control: public, max-age=31536000, immutable`.
4. Karena berbasis `url_hash`, gambar otomatis terdeduplikasi lintas seluruh user dan disajikan super cepat dari edge CDN Cloudflare. Jika konversi gagal, sistem menampilkan placeholder bersih berbasis domain/inisial tanpa membuat kartu tampak rusak.

### B. Direct Upload ke Cloudflare R2 (*Zero Binary Pass-Through di API*)
File dokumen user (PDF & Gambar resolusi penuh) **dilarang melewati memori server API Rust**:
1. **`POST /v1/media/presign`:** Client mengirim `{ filename, mime_type, size_bytes }`. API mengecek sisa kuota user (`storage_used_bytes + size_bytes <= storage_quota_bytes`), mencatat baris `PENDING_UPLOAD` di `media_assets`, dan mengembalikan **Presigned PUT URL** R2 (berlaku 10 menit, terkunci pada `Content-Length` dan `Content-Type` tersebut).
2. **Direct PUT:** Client mengunggah file langsung dari browser/HP ke Cloudflare R2. Beban RAM dan bandwidth VPS = **0 byte**.
3. **`POST /v1/media/:id/confirm`:** API memverifikasi keberadaan objek via `HEAD` request ringan ke R2, mengubah status menjadi `READY`, memperbarui `storage_used_bytes` user, dan membuat/menautkan item bookmark.
4. **Pembersihan Otomatis:** Konfigurasikan *R2 Object Lifecycle Rule* untuk membatalkan *incomplete multipart uploads* dalam 1 hari, ditambah job pembersih harian yang menghapus objek `PENDING_UPLOAD` berusia > 24 jam.

### C. *Perceived Performance* di Sisi Aplikasi Client
1. **Optimistic Updates:** Aksi pin, favorit, arsip, pindah folder, rename, dan pasang tag langsung mengubah state lokal UI dalam `< 16 ms` sebelum respons jaringan kembali.
2. **Payload Ringan & Bertahap:** Daftar bookmark hanya mengirim field kartu ringkas (`id`, `title`, `domain`, `raw_url`, `thumbnail_url`, `favicon_url`, `tags`, `flags`, `metadata_status`).
3. **Sinkronisasi Status Enrichment Hemat Request:** Saat user baru menyimpan link (`metadata_status = PENDING`), client hanya mengecek endpoint ringan `GET /v1/bookmarks/previews?ids=...` dengan interval bertahap (`2s -> 4s -> 8s`, berhenti otomatis setelah `COMPLETED`/`FAILED`) — tidak melakukan *refetch* seluruh daftar bookmark.
4. **Virtualisasi Daftar:** Pada Web, Desktop, dan Mobile, daftar panjang menggunakan *list/grid virtualization* agar ribuan item tetap berjalan mulus 60 FPS.

---

## 7. Anggaran Infrastruktur VPS 2 GB RAM, Tuning, & Operasional

Dengan menempatkan Frontend Web di Cloudflare Pages / Vercel, seluruh kapasitas **VPS 2 GB (2048 MB)** dialokasikan secara disiplin sebagai berikut:

### Tabel Anggaran Memori VPS 2 GB

| Layanan / Komponen | Alokasi Normal | Hard Limit Docker | Keterangan |
| :--- | :--- | :--- | :--- |
| **Linux Kernel + SSH + Docker** | ~220 MB | — | Sistem dasar OS |
| **Caddy 2 (Reverse Proxy + TLS)** | ~35 MB | `96m` | Terminasi HTTPS & HTTP/3 otomatis |
| **Rust API + Worker Binary** | **~35 – 65 MB** | `256m` | Termasuk buffer streaming & image resize semaphore |
| **PostgreSQL 17** | ~380 MB | `640m` | `shared_buffers = 256MB` + koneksi aktif |
| **Redis 7** | ~50 MB | `128m` | `--maxmemory 96mb` (antrean + cache metadata 24 jam) |
| **Total Pemakaian Aktif** | **~720 – 750 MB** | — | Sangat aman dari batas fisik 2048 MB |
| **Sisa RAM (Linux OS Page Cache)** | **~1.25 – 1.30 GB** | — | **Otomatis meng-cache tabel & index PostgreSQL di RAM!** |

### Aturan Wajib Deployment & Konfigurasi VPS 2 GB

1. **DILARANG KERAS Menjalankan `cargo build` di Dalam VPS!**
   - Kompilasi Rust membutuhkan RAM 2–4 GB dan akan langsung memicu *Linux OOM Killer* yang mematikan PostgreSQL.
   - **Solusi:** Kompilasi binary dilakukan di **GitHub Actions** (menggunakan `cargo-chef` / `Swatinem/rust-cache`), dibungkus ke image minimal (`debian:bookworm-slim` + `ca-certificates` berukuran total ~40 MB), di-push ke `ghcr.io`, lalu VPS hanya menjalankan `docker compose pull && docker compose up -d`.
2. **Wajib Aktifkan Swap File 2 GB di SSD VPS:**
   - Sebagai sabuk pengaman terhadap lonjakan tak terduga dengan `vm.swappiness = 10`.
3. **Konfigurasi `postgresql.conf` untuk VPS 2 GB:**
   ```ini
   shared_buffers = 256MB
   effective_cache_size = 1280MB
   work_mem = 4MB
   maintenance_work_mem = 64MB
   max_connections = 35
   random_page_cost = 1.1         # Untuk penyimpanan SSD/NVMe
   ```
   *(Catatan: Pool `SQLx` di Rust diset `max_connections = 15` untuk melayani API + Worker sekaligus).*
4. **Konfigurasi `redis-server`:**
   - Gunakan dua kebijakan jelas atau pisahkan DB logis: jaga antrean tetap ramping (hapus job segera setelah selesai diproses, simpan riwayat ringkasnya di tabel `background_tasks` PostgreSQL), dengan `--appendonly yes --appendfsync everysec --maxmemory 96mb`.
5. **Backup Terjadwal Off-Site:**
   - Cron harian menjalankan `pg_dump -Fc` terkompresi, dienkripsi, dan diunggah ke bucket backup terpisah di Cloudflare R2 dengan retensi 14–30 hari.

---

## Target Standar Performa (SLO) & Tahapan Implementasi

### Target Performa Produksi (1.000 User / 2 Juta Bookmark di VPS 2 GB)
- **Simpan Bookmark (`POST /v1/bookmarks`):** `p95 < 25 ms`
- **Buka Daftar Bookmark / Folder (`GET /v1/bookmarks`):** `p95 < 20 ms`
- **Pencarian Full-Text + Trigram (`GET /v1/search`):** `p95 < 35 ms`
- **Autosave Catatan (`PUT /v1/bookmarks/:id/note`):** `p95 < 25 ms`
- **Penyelesaian Metadata Enrichment URL Normal:** `< 3 detik` di belakang layar
- **Total RAM Idle Seluruh Stack di VPS:** `< 800 MB` dari `2048 MB`

### Peta Jalan Eksekusi (*Phased Delivery*)
1. **Fase 1 — Fondasi Backend Rust & Database:**
   Setup repository Rust (`Axum` + `SQLx` + `utoipa`), migrasi skema PostgreSQL (`UUIDv7`, index, FTS + `pg_trgm`), Dual Auth (Cookie + Bearer + Google/GitHub OAuth), serta CRUD Folder, Tag, dan Bookmark dengan *Cursor Pagination*.
2. **Fase 2 — Worker Aman, Media R2, & Notes:**
   Implementasi Redis dual-queue (`interactive` vs `bulk`), HTTP scraper dengan SSRF DNS guard + `lol_html` stream limit 1 MB, kompresi thumbnail WebP ke R2, Presigned Upload PDF/Gambar, serta endpoint Notes dengan *revision conflict check* (`409`).
3. **Fase 3 — OpenAPI SDK, Import/Export, & Integrasi Web + Extension:**
   Generate `openapi.json` -> paket TypeScript client bersama; selesaikan fitur Public Share (`/share/:token`), Import/Export HTML, Broken Link Checker, dan hubungkan ke aplikasi Web (di Cloudflare Pages/Vercel) serta Browser Extension.
4. **Fase 4 — Ekspansi Desktop & Mobile:**
   Bungkus Web App ke dalam **Tauri** untuk rilis Desktop (macOS/Windows/Linux) dengan *Global Shortcut*, dan bangun aplikasi **React Native (Expo)** dengan fokus utama pada *OS Share Sheet* serta *Offline Save Queue*.
