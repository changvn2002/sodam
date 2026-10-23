import { FAQS } from '@/lib/faq';

/**
 * Nội dung chữ tĩnh dưới fold của trang chủ — để công cụ tìm kiếm (và người
 * lần đầu ghé) hiểu Sổ Đám làm gì. Toàn bộ nằm trong accordion <details>
 * mặc định đóng (COPY-DIET B1–B5): nội dung vẫn server-render đầy đủ trong
 * HTML cho SEO, nhưng không đẩy công cụ chính xuống và không render dưới
 * workspace của một cuốn sổ đang mở. FAQ dùng chung dữ liệu với FAQPage
 * JSON-LD trong app/page.tsx.
 */
const EVENT_KINDS: ReadonlyArray<string> = [
  'Đám cưới',
  'Đám hỏi',
  'Đám tang',
  'Đám giỗ',
  'Mừng thọ',
  'Thôi nôi',
  'Đầy tháng',
  'Tân gia',
  'Khai trương',
  'Sinh nhật',
  'Mừng tuổi / lì xì',
  'Tốt nghiệp',
];

function AccordionItem({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary
        id={id}
        className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[17px] font-semibold text-ink marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden"
      >
        {title}
        <span
          aria-hidden
          className="text-xl leading-none font-normal text-muted transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

export default function InfoSections() {
  return (
    <div className="border-t border-line bg-paper text-ink">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <AccordionItem id="gioi-thieu" title="Giới thiệu">
          <p className="max-w-3xl leading-relaxed text-muted">
            Nhà có đám là có cả trăm phong bì khó quản: ai mừng bao nhiêu, ở đám nào, rồi nhà mình
            trả lễ ai, bao nhiêu cho phải phép. Sổ giấy dễ thất lạc, khó cộng tổng. Sổ Đám ghi từng
            khoản, tự cộng tổng theo từng đám và giữ danh sách trả lễ để không sót ai. Không cần tài
            khoản: tạo sổ, nhận mã mời, cả nhà cùng dùng mã đó vào một cuốn sổ.
          </p>
        </AccordionItem>

        <AccordionItem id="cach-dung" title="Cách dùng trong 4 bước">
          <ol className="max-w-3xl list-none space-y-3">
            <li className="flex gap-3">
              <span className="font-mono font-semibold text-indigo-700">1.</span>
              <p className="leading-relaxed text-muted">
                <span className="font-medium text-ink">Tạo sổ, nhận mã mời.</span> Mở app, tạo cuốn
                sổ đầu tiên, không cần tài khoản hay mật khẩu.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-semibold text-indigo-700">2.</span>
              <p className="leading-relaxed text-muted">
                <span className="font-medium text-ink">Chia sẻ cho cả nhà.</span> Gửi mã mời hoặc
                link chia sẻ; ai mở link là vào thẳng sổ và ghi cùng.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-semibold text-indigo-700">3.</span>
              <p className="leading-relaxed text-muted">
                <span className="font-medium text-ink">Ghi lễ bằng tay hoặc giọng nói.</span> Gõ tên
                và số tiền, hoặc đọc một câu để app tự tách tên cùng số tiền.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-semibold text-indigo-700">4.</span>
              <p className="leading-relaxed text-muted">
                <span className="font-medium text-ink">Theo dõi trả lễ và tổng kết.</span> Xem đã
                nhận, đã trả, còn chờ, đưa quá tay theo từng đám; xuất CSV khi cần.
              </p>
            </li>
          </ol>
        </AccordionItem>

        <AccordionItem id="cac-loai-dam" title="Các loại đám">
          <p className="max-w-3xl leading-relaxed text-muted">
            Sổ Đám có sẵn các loại sự kiện theo đúng phong tục Việt, cho cả đám nhà bạn tổ chức lẫn
            đám bạn đi dự:
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {EVENT_KINDS.map((kind) => (
              <li
                key={kind}
                className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium"
              >
                {kind}
              </li>
            ))}
            <li className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium">
              Và các dịp khác
            </li>
          </ul>
        </AccordionItem>

        <AccordionItem id="ma-moi" title="Mã mời là chìa khóa">
          <p className="max-w-3xl leading-relaxed text-muted">
            Sổ Đám bỏ tài khoản, mật khẩu để người lớn tuổi mở lên là dùng được. Mỗi sổ có mã mời 16
            ký tự là chìa khóa: sai mã, app trả lời như sổ không tồn tại. Ai giữ mã đều vào được,
            nên chỉ gửi mã cho người thân qua kênh riêng.
          </p>
        </AccordionItem>

        <AccordionItem id="faq" title="Câu hỏi thường gặp">
          <div className="max-w-3xl space-y-5">
            {FAQS.map((faq) => (
              <article key={faq.question}>
                <h3 className="font-semibold text-ink">{faq.question}</h3>
                <p className="mt-1 leading-relaxed text-muted">{faq.answer}</p>
              </article>
            ))}
          </div>
        </AccordionItem>
      </div>
    </div>
  );
}
