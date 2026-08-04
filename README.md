# KasaFund

KasaFund is a community finance product for susu groups, personal savings, and fundraising. This repository is an npm-workspace monorepo containing:

```text
./       Expo SDK 54 mobile app
server/  Express and MongoDB API
web/     Public website and protected operations console
```

## Requirements

- Node.js 20.19 or newer
- npm
- A MongoDB database

## Install

Install every workspace from the repository root:

```bash
npm install
```

## Environment

Copy the sanitized templates before starting the apps:

```bash
cp .env.example .env
cp server/.env.example server/.env
cp web/.env.example web/.env.local
```

- Root `.env` configures the Expo mobile client.
- `server/.env` contains private API credentials and must never be committed.
- `web/.env.local` configures hosted web URLs and must never be committed.
- Variables prefixed with `EXPO_PUBLIC_` or `VITE_` are bundled into client
  applications. Never place private API keys or database credentials in them.

Replace every example value before connecting payment, email, KYC, cloud,
WhatsApp, or AI providers. Restrict `CORS_ORIGIN` to the deployed web origin in
production.

## Run locally

Start the API:

```bash
npm run dev:server
```

Start the public website and admin console in a second terminal:

```bash
npm run dev:web
```

The website runs at `http://localhost:5173`. The administrator console is at
`http://localhost:5173/admin`. During local development, Vite proxies `/api`
requests to the API at `http://localhost:5050`.

Start the mobile app with:

```bash
npm start
```

## Web environment

Copy `web/.env.example` to `web/.env.local` when the API is hosted separately:

```env
VITE_API_URL=https://api.example.com/api
VITE_APP_STORE_URL=https://apps.apple.com/...
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/...
```

The mobile app opens the public support and legal pages at:

```text
https://kasafund.com/support
https://kasafund.com/privacy
https://kasafund.com/terms
```

These routes must be deployed before testing them from a device.

## Presentation administrator

The presentation seed includes a dedicated `super_admin` account. Run the seed
against a presentation or demo database to create it:

```bash
npm run seed:presentation --workspace=kasafund-server
```

The demo credentials and database safety rules are documented in
[`server/PRESENTATION_SEED.md`](server/PRESENTATION_SEED.md).

The documented seed password is for an isolated presentation database only.
Set `PRESENTATION_DEMO_PASSWORD` and `PRESENTATION_ADMIN_PASSWORD` to unique
values before exposing a demo server to the internet.

For an existing presentation database, create only the administrator without
resetting other records:

```bash
npm run seed:presentation:admin --workspace=kasafund-server
```

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run check:web
npm run build:web
npm test --workspace=kasafund-server
npm run check --workspace=kasafund-server
```

When deploying the web build, configure the host to serve `index.html` for the
`/admin`, `/support`, `/privacy`, and `/terms` paths so direct visits load the
client application.

## Before pushing

- Keep the GitHub repository private while provider integrations and deployment
  controls are still being finalized.
- Confirm `.env`, `server/.env`, and `web/.env.local` remain ignored with
  `git status --ignored`.
- Never commit production database URIs, JWT secrets, payment keys, webhook
  secrets, private signing files, or demo credentials used by a hosted server.
- Review staged changes with `git diff --cached` before every push.
