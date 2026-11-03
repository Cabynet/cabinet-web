# Running Cabinet (web)

This repository holds the Next.js web app (`apps/web`), the browser extension (`apps/extension`) and the API client hooks and types (`packages/api-client`). The Rust API lives in its own repository, [Cabynet/cabinet-api](https://github.com/Cabynet/cabinet-api); deployment of the API is documented there.

## Requirements

- Node.js 22+ and pnpm 11+
- A running Cabinet API (local or hosted)

## Run the web app

```bash
pnpm install
pnpm --filter @cabinet/web dev                 # http://localhost:3000
```

Create `apps/web/.env.local` first:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000      # or https://api.cabinety.space
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Run the API locally

In a clone of `cabinet-api` (needs Rust and Docker):

```bash
docker compose -f docker/docker-compose.yml up -d   # Postgres + Redis
cp .env.example .env                                # then fill in R2_* and PROXY_SIGNING_KEY
cargo run
```

Migrations run when the API starts. Use a parent `COOKIE_DOMAIN` only when web and API share a domain; leave it empty locally.

## Checks

```bash
pnpm lint
pnpm test
pnpm build          # builds the API client, type-checks and builds the web app
```

Browser tests (`pnpm --filter @cabinet/web test:moodboard`, `test:notes`, ...) are run by hand. `NEXT_PUBLIC_API_URL` must be unset when running `pnpm test`.

## Changing the API

The web app talks to the API through hand-written hooks and types in `packages/api-client/src` (`hooks.ts`, `types.ts`). There is no code generator: when an endpoint or response shape changes in `cabinet-api`, update those two files by hand and run:

```bash
pnpm --filter @cabinet/api-client build
pnpm --filter @cabinet/web exec tsc --noEmit
```

The API still publishes `openapi.json` (and Swagger UI at `/api/docs`) as reference documentation.

The web app is deployed from this repository by Vercel (`apps/web/vercel.json`).
