<p align="center">
  <img src="public/products/brand/sodam-logo.svg" alt="Sổ Đám" width="128" />
</p>

# Sổ Đám (sodam)

> Receive gifts, return favors, remember who — speak or snap like a village ledger.
>
> Nhận lễ, trả lễ, với ai — nói hoặc chụp ảnh như sổ dưới quê.

[![Live app](https://img.shields.io/badge/live-app-brightgreen)](https://sodam-tawny.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**🔴 Live: https://sodam-tawny.vercel.app** — no account, no sign-in: open the app
and create your first book. Each book is protected by its own invite code; share the
code (or the share link) with family so everyone writes in the same book.
Repository: https://github.com/changvn2002/sodam

<p align="center">
  <img src="docs/screenshots/sodam-desktop.png" alt="Sổ Đám — dashboard of a real family book: 12.000.000 ₫ received, 10.000.000 ₫ still held, 10.000.000 ₫ waiting to be returned" width="900">
</p>
<p align="center"><em>The live dashboard of a real family book — guests gave 12.000.000 ₫, returns are tracked per guest, and there is no sign-in anywhere.</em></p>

**Tóm tắt (Tiếng Việt):** Sổ Đám là sổ ghi lễ cho các đám của người Việt — cưới, đám hỏi,
đám tang, giỗ, mừng thọ, tân gia… Ghi ai đã mừng bao nhiêu bằng tay, bằng giọng nói hoặc
chụp ảnh sổ tay; app tự theo dõi nghĩa vụ trả lễ, cho cả nhà dùng chung một cuốn sổ bằng
mã mời và vẽ cây họ. Dữ liệu nằm trong database PostgreSQL của chính bạn.

**Sổ Đám** is a Vietnamese gift-ledger app for ceremonies — weddings (cưới), engagements
(đám hỏi), funerals (đám tang/ma), death anniversaries (giỗ), longevity celebrations
(mừng thọ), housewarmings (tân gia), birthdays and more. It records who gave what at
events you host, tracks what you owe back ("trả lễ"), and keeps a people/family-relation
graph per book.

This is the **standalone, self-contained** extraction of Sổ Đám: a single Next.js
full-stack app (UI + API routes + database) that anyone can clone, run and develop
further. It was extracted from the Changtotech studio monorepo, where the same product
ran as a client module talking to a NestJS backend.

## ✨ Features

- **Multiple books (sổ)** with **no account at all**: open the app and start. Each book is protected by a high-entropy invite code (12 characters, generated server-side with `crypto.randomBytes`); share the code or the one-tap share link and family members open the book directly and write together. Books you created or joined are remembered on each device (local storage) — there is no login anywhere.
- **Events** across 13 Vietnamese ceremony kinds, hosted or attended, with per-event totals, settled amounts and net balances.
- **Entries (lễ)** recorded manually, in batch, by voice (speech → AI parse of Vietnamese gift lines like *"anh Tuấn 500 nghìn"*), or from a **photo** of a handwritten ledger (vision AI extraction).
- **Return obligations (trả lễ)** generated automatically when guests give at your hosted events; mark them done/skipped and see over-given amounts.
- **People directory** with gift history search, plus a **family tree** built from relations (spouse / parent / child / sibling / other).
- **Dashboard totals**: received, settled, pending returns, over-given, given.
- **CSV export/import** of a book's ledger.
- **Offline outbox (partial offline, stated precisely)**: the app needs a connection to load and open a book — there is no service worker and the app does **not** work fully offline. But if the connection drops while the app is open, new entries you record are queued in an on-device outbox (IndexedDB) and synced automatically when you are back online (entry creations only — see *Known limitations*).
- **Lunar calendar** display for event dates (Vietnamese âm lịch).

## 🖼️ Screenshots

Every screenshot below was captured from the live production deployment at
https://sodam-tawny.vercel.app (the no-login build) with the app in a **real,
populated state** — never an empty first-run screen. The book on screen is
**"Sổ nhà họ Nguyễn"**, holding three events: a hosted
wedding ("Cưới con gái Minh Anh", 18 Oct 2026) with six guests, a hosted death
anniversary ("Giỗ ông nội"), and a wedding the family attended. Two return gifts have
already been marked as returned — one of them 200.000 ₫ more than the guest
originally gave.

### Dashboard — the whole book at a glance

![Desktop 1440×900 — dashboard of "Sổ nhà họ Nguyễn": 12.000.000 ₫ received, 10.000.000 ₫ still held after returns, 10.000.000 ₫ of returns still open](docs/screenshots/sodam-desktop.png)

_After the three events, guests have given 12.000.000 ₫ in total ("Khách đã mừng").
2.000.000 ₫ of it is already settled by return gifts, so the book still holds
10.000.000 ₫ ("Còn giữ"); the family has paid out 2.700.000 ₫ in returns and
attended-event gifts ("Đã trả / đi"), and 10.000.000 ₫ across 7 guests is still
waiting to be returned ("Cần trả lễ"). The "Công thức sổ" line spells the maths out —
including the 200.000 ₫ over-given part._

| Mobile (390×844) | Social / link-preview (1280×640) |
| --- | --- |
| ![Mobile — the same dashboard stacked for phones, book totals on top](docs/screenshots/sodam-mobile.png) | ![Social — 1280×640 preview frame of the dashboard](docs/screenshots/sodam-social.png) |
| _On a phone the four totals stack into a 2×2 grid above the formula line, with the bottom tab bar (Tổng quan / Trả lễ / Người / Họ hàng) always in reach._ | _The 1280×640 frame used when the app link is shared: the totals and the return-gift shortcut (7 guests · 10.000.000 ₫) are visible before the app even opens._ |

### Step by step

**Step 1 — Open the app, create a book.** No account, no sign-in: the home screen
lists the books kept on this device — each with its invite code — next to the
create-book and join-by-code panels. Anyone with the code (or the share link) writes
in the same book. The season card counts 106 days to Tết Nguyên đán (6 Feb 2027).

![Step 1 — home: "Sổ nhà họ Nguyễn" book card, create/join panels and the wedding-season card](docs/screenshots/gallery-01-tao-so.png)

**Step 2 — Record who gave what.** Inside an event, every guest row shows the amount
they gave plus its own return-gift form. Settled rows are badged "Đã trả lễ":
Cậu Tư Lê Văn Đức gave 1.000.000 ₫ and was returned 1.200.000 ₫ — the app flags the
200.000 ₫ over-given part instead of silently absorbing it into the totals.

![Step 2 — guest ledger of the wedding: gift amounts, per-guest return forms, settled rows](docs/screenshots/gallery-02-ghi-le.png)

**Step 3 — Work the return list.** The "Cần trả lễ" screen collects every open
obligation across all events — here the gifts from the "Giỗ ông nội" anniversary
(500.000 ₫, 500.000 ₫ and 1.000.000 ₫) — each with the amount to return, quick-pick
amounts, and mark-done / skip actions.

![Step 3 — open return obligations with per-guest amounts and mark-done actions](docs/screenshots/gallery-03-tra-le.png)

**Step 4 — Every event keeps its own summary.** The wedding received 10.000.000 ₫
from 6 guests; 2.000.000 ₫ is settled, 200.000 ₫ was over-given, and the solar date
(18/10/2026) is shown together with its Vietnamese lunar date (9/9 âm lịch).

![Step 4 — per-event summary for "Cưới con gái Minh Anh": received / kept / settled / over-given](docs/screenshots/gallery-04-tong-ket-su-kien.png)

## 🛠️ Tech stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Framework | Next.js 16 (App Router) + React 19                                |
| Language  | TypeScript (strict)                                               |
| Styling   | Tailwind CSS 4                                                    |
| Database  | PostgreSQL via Prisma 6                                           |
| Access    | No accounts — per-book invite codes (crypto-generated) sent per request; a wrong code answers 404 |
| AI        | Any OpenAI-compatible chat/vision endpoint (env-configured)       |
| Tests     | Vitest (unit specs carried over from the original codebase)       |
| Tooling   | pnpm, ESLint (eslint-config-next), Prettier                       |

## 🚀 Getting started

### Prerequisites

- Node.js ≥ 20
- pnpm 10 (the repo pins `packageManager: pnpm@10.32.1` — `corepack enable` or `npm i -g pnpm`)
- A PostgreSQL database — free tiers work fine: [Supabase](https://supabase.com) or [Neon](https://neon.tech). Create a project and copy its PostgreSQL connection string.

### Install & run

```bash
git clone https://github.com/changvn2002/sodam.git
cd sodam
cp .env.example .env        # fill in DATABASE_URL
pnpm install                # also runs `prisma generate`
pnpm db:push                # create the tables in your database
pnpm dev                    # http://localhost:3100
```

Open the app and create your first book right away — there is no sign-in. No seed data is required.

To try the UI without a database, set `NEXT_PUBLIC_SODAM_API_MODE=mock` in `.env` and run `pnpm dev` — the app uses an in-memory demo store instead of the API.

### Scripts

| Command                        | What it does                                    |
| ------------------------------ | ----------------------------------------------- |
| `pnpm dev`                     | Start the dev server on port 3100               |
| `pnpm build`                   | Production build                                |
| `pnpm start`                   | Run the production build                        |
| `pnpm typecheck`               | Type-check (`tsc --noEmit`)                     |
| `pnpm lint`                    | ESLint over the whole repo                      |
| `pnpm test`                    | Vitest specs (mock API, API-route no-login flow, invite codes, lunar, money parser) |
| `pnpm format` / `format:check` | Prettier write / check                          |
| `pnpm db:push`                 | Apply the Prisma schema to your database        |
| `pnpm db:studio`               | Browse the database with Prisma Studio          |

### Environment variables

| Variable              | Required | Description                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`        | Yes (http mode) | PostgreSQL connection string (pooled string recommended on Supabase/Neon). |
| `OPENAI_API_KEY`      | No | Enables AI parsing/suggestions/photo extraction via an OpenAI-compatible API. |
| `AI_TRANSLATE_BASE_URL` | No | Base URL of the OpenAI-compatible endpoint (default `https://api.openai.com/v1`). |
| `AI_TRANSLATE_MODEL`  | No | Default model for chat + vision (default `gpt-4o-mini`).                    |
| `OPENAI_BASE_URL`, `OPENAI_CHAT_MODEL`, `OPENAI_VISION_MODEL` | No | Optional overrides per capability. |
| `NEXT_PUBLIC_SODAM_API_MODE` | No | `http` (default, real API) or `mock` (in-memory demo, no server data). |
| `NEXT_PUBLIC_SITE_URL` | No (set in production) | Public base URL used for canonical/OG metadata, `sitemap.xml`, `robots.txt` and JSON-LD. The code default is this repo's production domain (`https://sodam-tawny.vercel.app`) — set it to your own URL when you deploy elsewhere. |

See `.env.example` for the documented template.

**AI behavior without a key (honest by design):** voice parse and amount suggestions fall back to the built-in local Vietnamese parser / history average — the same fallback the original host used when its AI platform errored. Photo extraction has no local fallback: the API returns `503` and the UI shows an error instead of inventing names/amounts.

## 📁 Project structure

```
app/
  page.tsx                         # renders the Sổ Đám client app
  api/products/sodam/[[...path]]/ # product API (books, events, entries, people,
                                  #   relations, returns, CSV, AI, sync)
components/sodam/                  # the product client (from the original codebase)
  app.tsx  shell.tsx               # screens + app shell
  api/                             # typed API contract: http client + mock client
  lib/                             # event kinds, lunar calendar, money parser,
                                  #   offline outbox, local book registry (book-store)
  ui/                              # avatar, ledger row, lottie
lib/
  api.ts                           # browser fetch client
  utils.ts                         # cn()
  server/                          # server-only code
    invite-code.ts                 # book invite codes: generation + constant-time check
    prisma.ts                      # Prisma client singleton
    sodam.service.ts               # ledger business logic (ported from NestJS)
    ai.service.ts                  # AI parse / suggest / photo (ported, env-wired)
    sodam-event-kinds.ts           # event-kind source of truth + VI labels
    http.ts  errors.ts             # route helpers, validation, HttpError
prisma/schema.prisma               # Sodam* models (from the original fragment)
public/products/                   # product artwork (logo, hero, lottie)
docs/screenshots/                  # production screenshots used in this README
```

## 🧑‍💻 Development

- Money parsing lives in `components/sodam/lib/parse-money.ts` (client) and `lib/server/parse-gift.ts` (server), lunar conversion in `components/sodam/lib/lunar.ts`, and the event-kind list in `lib/server/sodam-event-kinds.ts` — each ships with specs; run `pnpm test` before opening a PR.
- The UI only talks to the product API through `components/sodam/api` (http / mock clients) — switch modes with `NEXT_PUBLIC_SODAM_API_MODE`, never by importing a client directly into components.
- Code style: TypeScript `strict`, ESLint via `eslint-config-next`, Prettier (single quotes, semicolons, print width 100). Run `pnpm lint && pnpm typecheck` before committing.
- PRs welcome: fork → branch → PR against `main`. Describe the user-visible change and add screenshots for UI changes.

### How the standalone differs from the host version

- **Backend**: the NestJS `SodamModule` was ported to Next.js route handlers under `/api/products/sodam/*` — identical paths, payloads and response shapes. Business logic in `lib/server/sodam.service.ts` is a faithful port of the original `SodamService`.
- **Access**: the host required a Changtotech account (JWT), and the first standalone release shipped its own minimal account system. The current release removes accounts entirely: a book is opened with its invite code — via the share link (`/?code=…`) or by typing the code — and each product endpoint verifies that code against the book before touching data (a wrong code answers `404`, like a book that does not exist). Each device remembers the books it knows in local storage; there are no users, passwords or roles anymore.
- **AI**: the host routed AI through its platform AI service (admin-configured). The standalone calls an OpenAI-compatible endpoint configured by env vars (see above).
- **Data**: the Prisma models and enums are the host's `sodam.prisma.fragment`, minus the book-membership model (no accounts to be a member with).

## Known limitations

- **Offline sync only applies `createEntry` mutations** — this is inherited from the original design, kept faithful on purpose: the server-side `sync()` records every client mutation id (idempotency cursor) and acknowledges it, but only entry creations change data. Other offline edits are not replayed.
- **No offline app shell**: there is no service worker, so opening or reloading the app and loading a book always needs a connection (book data lives in PostgreSQL on the server). The offline outbox above only covers recording *new* entries while the app is already open.
- Photo extraction requires a configured vision-capable AI model; there is no offline/OCR fallback.
- Anyone who holds a book's invite code can read and write that book — that is the sharing model. Treat codes like passwords and share them only with family. Codes cannot be rotated in this release; create a new book if a code leaks.

## 🔍 SEO & PWA

The standalone ships a production SEO/PWA pack built from the app's real brand assets (`public/products/brand/sodam-logo.svg`, `sodam-hero.svg`):

- Full Next.js metadata in `app/layout.tsx`: Vietnamese title/description from the product's real name and tagline, `metadataBase` + canonical, Open Graph (`vi_VN`) and Twitter `summary_large_image` cards using `public/og.png` (a 1200×630 PNG rendition of the hero artwork, generated by the same script), and robots directives.
- `app/robots.ts` and `app/sitemap.ts` generate `robots.txt` / `sitemap.xml` from `NEXT_PUBLIC_SITE_URL`; the sitemap carries a `lastModified` timestamp.
- Favicon from the real app mark (`app/icon.svg`, plus a raster `app/favicon.ico` generated from the same artwork so `/favicon.ico` answers 200 for older clients and bots).
- Security headers on every route via `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` disabling the getUserMedia surfaces the app does not use (voice input runs on the browser's Web Speech API and photo capture uses a file input, so neither is affected).
- Server-rendered content sections on the home page (introduction, 4-step guide, ceremony kinds, the invite-code model) plus an FAQ section — the FAQ is a single source (`lib/faq.ts`) shared with the `FAQPage` JSON-LD, so structured data always matches what visitors read.
- PWA manifest (`app/manifest.ts` → `/manifest.webmanifest`): name, description, `lang: vi`, brand theme color (`#07332b`, the logo's jade) — installable as a standalone app, with raster install icons (`public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, plus `apple-touch-icon.png` for iOS) rendered from the untouched SVG logo by `scripts/generate-brand-pngs.mjs`; the client's offline outbox behavior is unchanged.
- JSON-LD `WebApplication` structured data on the home page with honest fields only (name, description, category, OS) — no ratings or prices.

## ▲ Deploy on Vercel

The production deployment runs at **https://sodam-tawny.vercel.app** (the Next.js app
plus a Neon PostgreSQL database). To deploy your own:

1. Fork/clone this repo, then in Vercel: **Add New → Project** and import it. Framework preset: **Next.js** (auto-detected). Root directory: repository root.
2. Provision a PostgreSQL database (Neon via the Vercel Marketplace, or Supabase) and set the environment variables: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` (your public domain) — plus the AI variables if you want them. No auth secret exists anymore.
3. Set the Build Command to `pnpm db:push && pnpm build` so the tables are created on the first deploy (this is how the production deployment above was set up), or run `pnpm db:push` once against the production database yourself.
   **Upgrading from the account-based release?** The no-login schema drops the `User` and `SodamBookMember` tables, so run `pnpm db:push --accept-data-loss` **once** against the production database before (or as part of) the first no-login deploy — a plain `db:push` refuses the destructive change and the build would stop. Books, events and entries are untouched; only accounts and memberships go away (books created under accounts keep their invite codes and remain joinable by code).
4. Deploy. Every push to `main` redeploys automatically.

Any Node host that can run Next.js and reach a PostgreSQL database works too:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

## 📄 License

MIT — see [LICENSE](LICENSE). © chang2tech
