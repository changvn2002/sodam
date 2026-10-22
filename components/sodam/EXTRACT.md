# Sổ Đám (`sodam`) — extract / demo / bán

Mọi code sản phẩm nằm trong folder này (client) và `server/src/products/sodam` (server). Không phụ thuộc CMS studio.

## Chế độ API

- `NEXT_PUBLIC_SODAM_API_MODE=http` (mặc định) — gọi `/api/products/sodam` trên host.
- `NEXT_PUBLIC_SODAM_API_MODE=mock` — demo UI không cần server (in-memory).

Chỉ import từ `./api` trong UI.

## Export từ monorepo Changtotech

```bash
node scripts/export-sodam.mjs --mode client --out ./dist-sodam-client
node scripts/export-sodam.mjs --mode full --out ./dist-sodam-full
```

- **client**: folder UI + EXTRACT + mock. Gắn vào Next shell bất kỳ tại route sản phẩm.
- **full**: thêm `server/src/products/sodam` + `server/prisma/sodam.prisma.fragment`. Buyer gắn `SodamModule` vào Nest và merge fragment vào Prisma schema.

## Platform AI (host Changtotech)

Trên Changtotech, AI đi qua `PlatformAiService` + Admin `/admin/ai`.  
Bản **full** bán ra có thể:

1. Giữ gọi OpenAI-compatible bằng env `OPENAI_API_KEY`, hoặc  
2. Port `PlatformAiService` từ host.

Bản **client-only** mock: AI parse local (`parse-money`) + fake photo candidates.

## Auth

HTTP mode cần JWT Changtotech (`changto_token`). Buyer thay `http.ts` base URL / header nếu auth khác.
