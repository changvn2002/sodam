# Bên thứ ba — thư viện, dịch vụ, và dữ liệu rời khỏi hệ thống

Tài liệu khai báo (phục vụ DATA-08/DOC): mọi thành phần không phải code
của dự án mà bản production dùng tới, và chính xác dữ liệu nào rời khỏi
máy người dùng trong từng trường hợp. Cập nhật mỗi khi thêm dependency
hoặc dịch vụ.

## Dịch vụ hạ tầng

| Dịch vụ | Vai trò | Dữ liệu nhận được |
|---|---|---|
| Vercel | Hosting (build + phục vụ app/API) | Request của người dùng theo thông lệ hosting (IP, header); biến môi trường của dự án |
| Neon (qua Vercel Storage) | PostgreSQL production | Toàn bộ dữ liệu sổ (tên đám, tên người, số tiền, ghi chú) — đây là DB của chính ứng dụng; mã mời chỉ ở dạng hash SHA-256 |
| GitHub | Chứa mã nguồn + CI | Chỉ mã nguồn; repo không chứa dữ liệu người dùng hay secret |

## Dịch vụ AI (tuỳ chọn — hiện KHÔNG bật trên production)

Mã nguồn có tích hợp OpenAI cho hai tính năng phụ (phân tích dòng ghi
bằng giọng nói thành {tên, số tiền}, và đọc ảnh sổ tay). Chúng chỉ hoạt
động khi máy chủ được cấu hình khoá API riêng:

- **Bản public hiện tại không cấu hình khoá** → tính năng đọc ảnh tắt
  hẳn (endpoint trả 503 với thông điệp chung, lối vào trên giao diện đã ẩn);
  phần giọng nói dùng bộ phân tích cục bộ trên thiết bị.
- Nếu một bản triển khai khác bật khoá: nội dung được gửi là đúng đoạn
  văn bản/ảnh người dùng vừa cung cấp cho tính năng đó, tới API của
  OpenAI theo điều khoản của OpenAI. Không gửi mã mời, không gửi dữ
  liệu các cuốn sổ khác.

## Thư viện runtime chính (license lấy từ chính package đã cài)

| Package | Phiên bản | License | Dùng cho |
|---|---|---|---|
| next | 16.3.6 | MIT | Framework app + API routes |
| react / react-dom | 19.2.1 | MIT | Giao diện |
| @prisma/client (+ prisma CLI) | 6.19.x | Apache-2.0 | Truy cập PostgreSQL |
| lucide-react | 1.61.0 | ISC | Icon hệ thống (icon loại đám là SVG vẽ tay riêng) |
| @dicebear/core + @dicebear/collection | 9.4.x | MIT (thư viện); hình initials theo điều khoản CC0 của DiceBear | Avatar chữ cái đầu, sinh 100% trên thiết bị từ seed nội bộ — không gọi API ngoài, không gửi tên/id ra ngoài |
| @fontsource/ibm-plex-sans / ibm-plex-mono | 5.3.0 | OFL-1.1 | Font IBM Plex tự host (kèm subset tiếng Việt), không gọi Google Fonts |

## Những thứ KHÔNG dùng

- Không analytics/tracking bên thứ ba, không quảng cáo, không pixel.
- Không CDN font hay script ngoài — CSP `default-src 'self'`
  (ADR-0004) khoá toàn bộ tải tài nguyên về cùng origin + `data:` cho
  ảnh avatar.
- Service worker là code viết tay trong repo (`public/sw.js`), không
  thư viện ngoài.
