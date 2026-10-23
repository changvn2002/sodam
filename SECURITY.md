# Security Policy — Sổ Đám

## Reporting a vulnerability / Báo cáo lỗ hổng

Please report suspected vulnerabilities privately through GitHub
Security Advisories:
https://github.com/changvn2002/sodam/security/advisories/new

Do not open a public issue for a security problem, and please do not
include real invite codes or other people's book data in a report —
a redacted description and reproduction steps are enough.

_Báo lỗ hổng qua GitHub Security Advisories (link trên), không mở
issue công khai. Đừng gửi kèm mã mời thật hay dữ liệu sổ của người
khác — mô tả đã che mờ + bước tái hiện là đủ._

## Supported version

Only the live production deployment (the latest commit on `main`) is
supported. There are no maintained release branches.

## Security model (summary)

Sổ Đám has no accounts: a book's 16-character invite code (~79 bits of
entropy) is its only credential, and the server stores just the code's
SHA-256 hash. The consequences of that model — and the mitigations —
are documented in the architecture decision records:

- `docs/adr/0001-no-login-invite-code-credential.md`
- `docs/adr/0002-hash-only-invite-codes.md` (hash-only storage, join
  throttling, timing-parity dummy hash)
- `docs/adr/0003-invite-code-rotation.md` (revoking a leaked code)
- `docs/adr/0004-csp-nonce-middleware.md` (per-request nonce CSP)

Other standing properties: API responses carry `Cache-Control:
no-store`; share links (`/?code=…`) are served with
`X-Robots-Tag: noindex, nofollow`; public error messages are generic
Vietnamese text that never expose configuration or database details.

## Scope notes

- Losing a book's invite code means losing access to that book — there
  is deliberately no recovery flow (see ADR-0002).
- Anything in this repository is public by design; never commit invite
  codes, screenshots showing codes, or environment values.
